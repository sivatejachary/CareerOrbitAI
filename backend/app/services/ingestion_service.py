import hashlib
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.models.job import Job
from backend.app.models.job_application import JobApplication
from backend.app.models.candidate_job import CandidateJob
from backend.app.models.ingestion_event import IngestionEvent
from backend.app.models.candidate_application import CandidateApplication
from backend.app.services.identity_service import find_or_create_candidate, normalize_email
from backend.app.services.resume_service import store_and_process_resume
from backend.app.services.screening_service import run_job_screening

def ingest_job_application(
    db: Session,
    job_id: str,
    source: str,
    candidate_data: dict,
    answers_payload: dict = None,
    file_bytes: bytes = None,
    filename: str = None,
    mime_type: str = None,
    form_id: str = None,
    custom_idempotency_key: str = None
) -> JobApplication:
    # 1. Fetch & validate job
    job = db.query(Job).filter(Job.id == job_id, Job.archived_at.is_(None)).first()
    if not job:
        raise ValueError(f"Job with ID '{job_id}' not found or archived")

    if job.status not in ["Active", "Published", "Open"]:
        # If webhooks or public forms submit, ensure job is active
        pass

    email = normalize_email(candidate_data.get("email", ""))
    full_name = candidate_data.get("full_name", "").strip() or "Applicant"
    if not email:
        raise ValueError("Candidate email is required for application submission")

    # 2. Idempotency Check
    if custom_idempotency_key:
        idempotency_key = custom_idempotency_key
    else:
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        raw_key = f"{job.id}:{email}:{today_str}"
        idempotency_key = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    existing_app = db.query(JobApplication).filter(
        JobApplication.idempotency_key == idempotency_key
    ).first()
    if existing_app:
        return existing_app

    # 3. Identity Resolution (Find or Create Candidate)
    candidate = find_or_create_candidate(
        db=db,
        organization_id=job.organization_id,
        email=email,
        full_name=full_name,
        phone=candidate_data.get("phone"),
        current_location=candidate_data.get("current_location"),
        total_experience=candidate_data.get("total_experience"),
        skills=candidate_data.get("skills"),
        current_company=candidate_data.get("current_company"),
        notice_period=candidate_data.get("notice_period"),
        source=source
    )

    # 4. Resume Processing
    resume = None
    if file_bytes and filename:
        resume = store_and_process_resume(
            db=db,
            organization_id=job.organization_id,
            candidate_id=candidate.id,
            file_bytes=file_bytes,
            original_filename=filename,
            mime_type=mime_type or "application/octet-stream"
        )

    # Profile snapshot at time of application
    profile_snapshot = {
        "candidate_id": candidate.id,
        "candidate_code": candidate.candidate_code,
        "full_name": candidate.full_name,
        "email": candidate.email,
        "phone": candidate.phone,
        "location": candidate.current_location,
        "total_experience": candidate.total_experience,
        "skills": candidate.skills,
        "current_company": candidate.current_company,
        "notice_period": candidate.notice_period,
    }

    # 5. Create JobApplication
    application = JobApplication(
        candidate_id=candidate.id,
        job_id=job.id,
        job_revision_at_submission=job.revision,
        source=source,
        idempotency_key=idempotency_key,
        status="Submitted",
        resume_id=resume.id if resume else None,
        form_id=form_id,
        answers_payload=answers_payload or {},
        profile_snapshot=profile_snapshot
    )
    db.add(application)
    db.flush()

    # Also keep backward-compatible CandidateApplication record
    legacy_app = CandidateApplication(
        candidate_id=candidate.id,
        job_id=job.id,
        organization_id=job.organization_id,
        application_form_id=form_id,
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        current_location=candidate.current_location,
        total_experience=candidate.total_experience,
        resume_url=resume.file_path if resume else None,
        source_channel=source,
        status="Submitted",
        answers_payload=answers_payload or {}
    )
    db.add(legacy_app)

    # 6. Ingestion Event (Outbox)
    event = IngestionEvent(
        job_application_id=application.id,
        event_type="APPLICATION_INGESTED",
        status="Completed",
        payload={
            "application_id": application.id,
            "candidate_id": candidate.id,
            "job_id": job.id,
            "source": source
        },
        processed_at=datetime.now(timezone.utc)
    )
    db.add(event)
    db.flush()

    # 7. Workflow Enrollment & Execution
    wf_execution = None
    try:
        from backend.app.services.workflow_engine import enroll_application_in_workflow
        wf_execution = enroll_application_in_workflow(db, application.id)
    except Exception as e:
        # Fallback to direct screening if workflow enrollment hits an edge case
        try:
            run_job_screening(db, application.id)
        except Exception:
            pass

    # 8. Create / update CandidateJob — canonical enterprise record
    try:
        existing_cj = db.query(CandidateJob).filter(
            CandidateJob.organization_id == job.organization_id,
            CandidateJob.candidate_id == candidate.id,
            CandidateJob.job_id == job.id
        ).first()

        if not existing_cj:
            candidate_job = CandidateJob(
                organization_id=job.organization_id,
                candidate_id=candidate.id,
                job_id=job.id,
                job_application_id=application.id,
                resume_id=resume.id if resume else None,
                source=source,
                received_at=datetime.now(timezone.utc),
                extraction_status="QUEUED",
                screening_status="QUEUED",
                stage="APPLIED",
                workflow_execution_id=wf_execution.id if wf_execution else None,
            )
            db.add(candidate_job)
            db.flush()
        else:
            # Update resume and workflow links if new submission
            if resume:
                existing_cj.resume_id = resume.id
                existing_cj.extraction_status = "QUEUED"
                existing_cj.screening_status = "QUEUED"
            if wf_execution:
                existing_cj.workflow_execution_id = wf_execution.id
            existing_cj.job_application_id = application.id
            existing_cj.updated_at = datetime.now(timezone.utc)
            db.flush()
            candidate_job = existing_cj

        # 9. Run extraction + screening in-process (async-compatible)
        if resume and candidate_job.extraction_status == "QUEUED":
            try:
                from backend.app.services.groq_extraction_service import run_extraction_for_candidate_job
                run_extraction_for_candidate_job(db, candidate_job.id)
            except Exception as ex:
                pass  # Already handled inside the service

        if candidate_job.extraction_status == "SUCCEEDED" and candidate_job.screening_status == "QUEUED":
            try:
                from backend.app.services.groq_screening_service import run_screening_for_candidate_job
                run_screening_for_candidate_job(db, candidate_job.id)
            except Exception as ex:
                pass  # Already handled inside the service

    except Exception as cj_err:
        # CandidateJob creation must not break the main application flow
        pass

    db.commit()
    db.refresh(application)
    return application
