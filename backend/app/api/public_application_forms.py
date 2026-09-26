import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.job import Job
from backend.app.models.application_form import ApplicationForm
from backend.app.services.job_service import check_and_update_deadline_expiry
from backend.app.services.file_validation_service import validate_resume_file
from backend.app.services.ingestion_service import ingest_job_application
from backend.app.services.identity_service import normalize_email

router = APIRouter(prefix="/api/public/application-forms", tags=["Public Application Forms"])

@router.get("/{job_code}/{token}")
def get_public_form_details(job_code: str, token: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(
        Job.job_code == job_code,
        Job.archived_at.is_(None)
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job posting '{job_code}' not found."
        )

    # Check deadline expiration
    check_and_update_deadline_expiry(job, db)

    form = db.query(ApplicationForm).filter(
        ApplicationForm.job_id == job.id,
        ApplicationForm.public_token == token
    ).first()

    if not form:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application form not found or invalid public token."
        )

    # Prepare salary info
    salary_info = None
    if job.show_salary:
        salary_info = {
            "min_salary": job.min_salary,
            "max_salary": job.max_salary,
            "currency": job.currency,
            "salary_type": job.salary_type
        }

    is_open_for_submissions = (
        form.allow_public_submissions and
        form.publication_state in ["Active", "Published"] and
        job.status in ["Open", "Active", "Published"]
    )

    state_message = None
    if not form.allow_public_submissions:
        state_message = "Submissions are currently disabled for this application form."
    elif form.publication_state == "Draft":
        state_message = "This application form is currently in Draft mode and not yet accepting submissions."
    elif form.publication_state == "Paused":
        state_message = "This application form is temporarily paused."
    elif form.publication_state == "Closed":
        state_message = "Applications for this position are now closed."
    elif job.status in ["Closed", "Expired"]:
        state_message = "This job posting has expired or is closed."

    return {
        "job": {
            "id": job.id,
            "job_code": job.job_code,
            "title": job.title,
            "department": job.department,
            "job_type": job.job_type,
            "employment_type": job.employment_type,
            "work_mode": job.work_mode,
            "openings": job.openings,
            "country": job.country,
            "state": job.state,
            "city": job.city,
            "office_location": job.office_location,
            "min_experience": job.min_experience,
            "max_experience": job.max_experience,
            "min_qualification": job.min_qualification,
            "skills": job.skills or [],
            "salary_info": salary_info,
            "benefits": job.benefits or [],
            "description": job.description,
            "responsibilities": job.responsibilities or [],
            "required_qualifications": job.required_qualifications,
            "preferred_qualifications": job.preferred_qualifications,
            "tech_requirements": job.tech_requirements,
            "application_deadline": job.application_deadline,
            "status": job.status
        },
        "form": {
            "id": form.id,
            "title": form.title,
            "description": form.description,
            "publication_state": form.publication_state,
            "allow_public_submissions": form.allow_public_submissions,
            "questions": form.questions_schema or [],
            "is_open_for_submissions": is_open_for_submissions,
            "state_message": state_message
        }
    }

@router.post("/{job_code}/{token}/submit")
async def submit_public_application_form(
    job_code: str,
    token: str,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    current_location: Optional[str] = Form(None),
    total_experience: Optional[float] = Form(None),
    current_company: Optional[str] = Form(None),
    notice_period: Optional[str] = Form(None),
    skills_raw: Optional[str] = Form(None),
    answers_json: Optional[str] = Form(None),
    resume: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(
        Job.job_code == job_code,
        Job.archived_at.is_(None)
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job posting '{job_code}' not found."
        )

    check_and_update_deadline_expiry(job, db)
    if job.status in ["Closed", "Expired"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Applications for this job posting are closed."
        )

    form = db.query(ApplicationForm).filter(
        ApplicationForm.job_id == job.id,
        ApplicationForm.public_token == token
    ).first()

    if not form:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application form not found or invalid public token."
        )

    if not form.allow_public_submissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Submissions are currently disabled for this application form."
        )

    if form.publication_state not in ["Active", "Published"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This application form is currently not accepting submissions (status: {form.publication_state})."
        )

    clean_email = normalize_email(email)
    if not clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required."
        )

    # 1. Read & Strictly Validate Resume File (magic bytes, ext, 10MB limit)
    try:
        file_bytes = await resume.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded resume file: {str(e)}"
        )

    cleaned_filename, mime_type = validate_resume_file(file_bytes, resume.filename or "resume.pdf")

    # 2. Parse skills & custom answers
    skills_list = []
    if skills_raw:
        skills_list = [s.strip() for s in skills_raw.split(",") if s.strip()]

    answers_payload = {}
    if answers_json:
        try:
            answers_payload = json.loads(answers_json)
        except Exception:
            pass

    # Store base answers in answers_payload as well
    answers_payload["q_full_name"] = full_name
    answers_payload["q_email"] = clean_email
    if phone:
        answers_payload["q_phone"] = phone
    if current_location:
        answers_payload["q_current_location"] = current_location
    if total_experience is not None:
        answers_payload["q_total_experience"] = total_experience
    if notice_period:
        answers_payload["q_notice_period"] = notice_period
    answers_payload["q_resume"] = cleaned_filename

    candidate_data = {
        "full_name": full_name.strip(),
        "email": clean_email,
        "phone": phone.strip() if phone else None,
        "current_location": current_location.strip() if current_location else None,
        "total_experience": total_experience,
        "current_company": current_company.strip() if current_company else None,
        "notice_period": notice_period.strip() if notice_period else None,
        "skills": skills_list
    }

    # 3. Ingest Application (Identity resolution, resume persistence, hash, transactional outbox)
    try:
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        custom_key = f"cof:{job.id}:{clean_email}:{today_str}"
        application = ingest_job_application(
            db=db,
            job_id=job.id,
            source="CAREERORBIT_FORM",
            candidate_data=candidate_data,
            answers_payload=answers_payload,
            file_bytes=file_bytes,
            filename=cleaned_filename,
            mime_type=mime_type,
            form_id=form.id,
            custom_idempotency_key=custom_key
        )

        return {
            "success": True,
            "application_id": application.id,
            "candidate_id": application.candidate_id,
            "status": application.status,
            "job_title": job.title,
            "job_code": job.job_code,
            "submitted_at": (getattr(application, "submitted_at", None) or datetime.now(timezone.utc)).isoformat(),
            "message": f"Your application for '{job.title}' has been submitted successfully!"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application submission failed: {str(e)}"
        )
