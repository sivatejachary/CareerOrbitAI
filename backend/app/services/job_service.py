import math
import secrets
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from backend.app.models.job import Job
from backend.app.models.user import User
from backend.app.models.audit_log import AuditLog
from backend.app.models.application_form import ApplicationForm
from backend.app.models.application_form_question import ApplicationFormQuestion
from backend.app.schemas.job import JobCreate, JobUpdate
from backend.app.services.job_code_service import generate_job_code
from backend.app.services.sanitizer_service import sanitize_html
from backend.app.services.form_generator_service import generate_questions_from_job

VALID_TRANSITIONS = {
    "Draft": ["Open"],
    "Open": ["Paused", "Closed", "Expired"],
    "Paused": ["Open", "Closed", "Expired"],
    "Closed": ["Draft"],
    "Expired": ["Draft"]
}

def check_and_update_deadline_expiry(job: Job, db: Session):
    """Check if an Open or Paused job deadline has passed and transition to Expired."""
    if job.status in ["Open", "Paused"] and job.application_deadline:
        now_utc = datetime.now(timezone.utc)
        if job.application_deadline.tzinfo is None:
            job_deadline = job.application_deadline.replace(tzinfo=timezone.utc)
        else:
            job_deadline = job.application_deadline

        if now_utc > job_deadline:
            job.status = "Expired"
            job.updated_at = now_utc
            db.commit()

def create_job(db: Session, job_in: JobCreate, user: User) -> Job:
    # 1. Generate unique job code
    job_code = generate_job_code(db, tz_name=job_in.timezone)

    # 2. Sanitize rich text description
    clean_description = sanitize_html(job_in.description)

    # 3. Dump skills & JSON fields
    skills_data = [s.model_dump() for s in job_in.skills]

    job = Job(
        organization_id=user.organization_id,
        created_by_id=user.id,
        updated_by_id=user.id,
        job_code=job_code,
        title=job_in.title,
        department=job_in.department,
        job_type=job_in.job_type,
        employment_type=job_in.employment_type,
        work_mode=job_in.work_mode,
        openings=job_in.openings,
        priority=job_in.priority,
        country=job_in.country,
        state=job_in.state,
        city=job_in.city,
        office_location=job_in.office_location,
        pin_code=job_in.pin_code,
        allow_relocation=job_in.allow_relocation,
        min_experience=job_in.min_experience,
        max_experience=job_in.max_experience,
        allow_freshers=job_in.allow_freshers,
        min_qualification=job_in.min_qualification,
        degree=job_in.degree,
        specialization=job_in.specialization,
        salary_type=job_in.salary_type,
        min_salary=job_in.min_salary,
        max_salary=job_in.max_salary,
        currency=job_in.currency,
        show_salary=job_in.show_salary,
        benefits=job_in.benefits,
        skills=skills_data,
        description=clean_description,
        responsibilities=job_in.responsibilities,
        required_qualifications=job_in.required_qualifications,
        preferred_qualifications=job_in.preferred_qualifications,
        tech_requirements=job_in.tech_requirements,
        soft_skills=job_in.soft_skills,
        certifications=job_in.certifications,
        other_requirements=job_in.other_requirements,
        application_deadline=job_in.application_deadline,
        timezone=job_in.timezone,
        notice_periods=job_in.notice_periods,
        languages=job_in.languages,
        inclusion_info=job_in.inclusion_info,
        career_page_published=job_in.career_page_published,
        status="Draft",
        revision=1
    )

    db.add(job)
    db.flush()

    # Automatically create primary website ApplicationForm in Draft state
    default_questions = generate_questions_from_job(job)
    questions_data = [q.model_dump() for q in default_questions]
    public_token = secrets.token_urlsafe(32)

    primary_form = ApplicationForm(
        job_id=job.id,
        organization_id=user.organization_id,
        created_by_id=user.id,
        form_version=1,
        source_job_revision=job.revision,
        title=f"Application for {job.title}",
        description=f"Submit your application for the {job.title} position.",
        questions_schema=questions_data,
        public_token=public_token,
        token_generated_at=datetime.now(timezone.utc),
        allow_public_submissions=True,
        is_primary_website_form=True,
        provider="Native",
        respondent_url=f"/apply/{job.job_code}/{public_token}",
        creation_status="Created",
        publication_state="Draft",
        resume_collection_mode="NativeUpload",
        resume_setup_status="Verified"
    )
    db.add(primary_form)
    db.flush()

    for idx, q in enumerate(default_questions):
        afq = ApplicationFormQuestion(
            application_form_id=primary_form.id,
            question_key=q.id or f"q_{idx}",
            label=q.label,
            question_type=q.type,
            required=q.required,
            order_index=q.display_order or idx
        )
        db.add(afq)

    audit = AuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action="JOB_CREATE",
        resource_type="Job",
        resource_id=job.id,
        details={"job_code": job_code, "title": job.title, "form_token": public_token}
    )
    db.add(audit)
    db.commit()
    db.refresh(job)
    return job

def list_jobs(
    db: Session,
    organization_id: str,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    size: int = 10
) -> Tuple[List[Job], int, int]:
    query = db.query(Job).filter(
        Job.organization_id == organization_id,
        Job.archived_at.is_(None)
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Job.title.ilike(term),
                Job.job_code.ilike(term),
                Job.department.ilike(term)
            )
        )

    if status_filter and status_filter.strip() and status_filter != "All":
        query = query.filter(Job.status == status_filter.strip())

    total = query.count()
    pages = math.ceil(total / size) if size > 0 else 1

    jobs = query.order_by(Job.updated_at.desc()).offset((page - 1) * size).limit(size).all()

    # Dynamic check for deadline expiry
    for j in jobs:
        check_and_update_deadline_expiry(j, db)

    return jobs, total, pages

def get_job(db: Session, job_id: str, organization_id: str) -> Job:
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.organization_id == organization_id,
        Job.archived_at.is_(None)
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with ID '{job_id}' was not found."
        )

    check_and_update_deadline_expiry(job, db)
    return job

def update_job(db: Session, job_id: str, job_in: JobUpdate, user: User) -> Job:
    job = get_job(db, job_id, user.organization_id)

    # Optimistic concurrency check
    if job.revision != job_in.revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict detected: This job has been updated by another action (Current revision: {job.revision}, your revision: {job_in.revision}). Please refresh and try again."
        )

    clean_description = sanitize_html(job_in.description)
    skills_data = [s.model_dump() for s in job_in.skills]

    # Update attributes
    job.title = job_in.title
    job.department = job_in.department
    job.job_type = job_in.job_type
    job.employment_type = job_in.employment_type
    job.work_mode = job_in.work_mode
    job.openings = job_in.openings
    job.priority = job_in.priority
    job.country = job_in.country
    job.state = job_in.state
    job.city = job_in.city
    job.office_location = job_in.office_location
    job.pin_code = job_in.pin_code
    job.allow_relocation = job_in.allow_relocation
    job.min_experience = job_in.min_experience
    job.max_experience = job_in.max_experience
    job.allow_freshers = job_in.allow_freshers
    job.min_qualification = job_in.min_qualification
    job.degree = job_in.degree
    job.specialization = job_in.specialization
    job.salary_type = job_in.salary_type
    job.min_salary = job_in.min_salary
    job.max_salary = job_in.max_salary
    job.currency = job_in.currency
    job.show_salary = job_in.show_salary
    job.benefits = job_in.benefits
    job.skills = skills_data
    job.description = clean_description
    job.responsibilities = job_in.responsibilities
    job.required_qualifications = job_in.required_qualifications
    job.preferred_qualifications = job_in.preferred_qualifications
    job.tech_requirements = job_in.tech_requirements
    job.soft_skills = job_in.soft_skills
    job.certifications = job_in.certifications
    job.other_requirements = job_in.other_requirements
    job.application_deadline = job_in.application_deadline
    job.timezone = job_in.timezone
    job.notice_periods = job_in.notice_periods
    job.languages = job_in.languages
    job.inclusion_info = job_in.inclusion_info
    job.career_page_published = job_in.career_page_published

    job.revision += 1
    job.updated_by_id = user.id
    job.updated_at = datetime.now(timezone.utc)

    audit = AuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action="JOB_UPDATE",
        resource_type="Job",
        resource_id=job.id,
        details={"new_revision": job.revision}
    )
    db.add(audit)
    db.commit()
    db.refresh(job)
    return job

def update_job_status(db: Session, job_id: str, new_status: str, user: User) -> Job:
    job = get_job(db, job_id, user.organization_id)
    current_status = job.status

    if new_status not in VALID_TRANSITIONS.get(current_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition job status from '{current_status}' to '{new_status}'. Allowed transitions: {VALID_TRANSITIONS.get(current_status, [])}"
        )

    # Validation before opening
    if new_status == "Open":
        if not job.description or not job.description.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot publish job: Job description is required."
            )
        if job.application_deadline:
            now_utc = datetime.now(timezone.utc)
            deadline = job.application_deadline.replace(tzinfo=timezone.utc) if job.application_deadline.tzinfo is None else job.application_deadline
            if now_utc > deadline:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot open job: Application deadline has already passed."
                )

    job.status = new_status
    job.updated_by_id = user.id
    job.updated_at = datetime.now(timezone.utc)

    audit = AuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action="JOB_STATUS_CHANGE",
        resource_type="Job",
        resource_id=job.id,
        details={"from": current_status, "to": new_status}
    )
    db.add(audit)
    db.commit()
    db.refresh(job)
    return job

def archive_job(db: Session, job_id: str, user: User) -> Job:
    job = get_job(db, job_id, user.organization_id)
    job.archived_at = datetime.now(timezone.utc)
    job.updated_by_id = user.id

    audit = AuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action="JOB_ARCHIVE",
        resource_type="Job",
        resource_id=job.id,
        details={"archived_at": str(job.archived_at)}
    )
    db.add(audit)
    db.commit()
    return job

def backfill_job_application_forms(db: Session) -> int:
    """Ensure every existing job has a primary website ApplicationForm with a secure public token."""
    jobs = db.query(Job).all()
    count = 0
    for job in jobs:
        # Check if job already has a primary website form
        primary_form = db.query(ApplicationForm).filter(
            ApplicationForm.job_id == job.id,
            ApplicationForm.is_primary_website_form == True
        ).first()

        if not primary_form:
            # Check if there is an existing Native form to promote
            native_form = db.query(ApplicationForm).filter(
                ApplicationForm.job_id == job.id,
                ApplicationForm.provider == "Native"
            ).first()

            if native_form:
                native_form.is_primary_website_form = True
                if not native_form.public_token:
                    native_form.public_token = secrets.token_urlsafe(32)
                    native_form.token_generated_at = datetime.now(timezone.utc)
                if not native_form.respondent_url:
                    native_form.respondent_url = f"/apply/{job.job_code}/{native_form.public_token}"
                count += 1
            else:
                # Create brand new primary form
                default_questions = generate_questions_from_job(job)
                questions_data = [q.model_dump() for q in default_questions]
                token = secrets.token_urlsafe(32)
                max_ver = db.query(func.max(ApplicationForm.form_version)).filter(
                    ApplicationForm.job_id == job.id
                ).scalar() or 0
                new_form = ApplicationForm(
                    job_id=job.id,
                    organization_id=job.organization_id,
                    created_by_id=job.created_by_id,
                    form_version=max_ver + 1,
                    source_job_revision=job.revision,
                    title=f"Application for {job.title}",
                    description=f"Submit your application for the {job.title} position.",
                    questions_schema=questions_data,
                    public_token=token,
                    token_generated_at=datetime.now(timezone.utc),
                    allow_public_submissions=True,
                    is_primary_website_form=True,
                    provider="Native",
                    respondent_url=f"/apply/{job.job_code}/{token}",
                    creation_status="Created",
                    publication_state="Draft",
                    resume_collection_mode="NativeUpload",
                    resume_setup_status="Verified"
                )
                db.add(new_form)
                db.flush()
                for idx, q in enumerate(default_questions):
                    afq = ApplicationFormQuestion(
                        application_form_id=new_form.id,
                        question_key=q.id or f"q_{idx}",
                        label=q.label,
                        question_type=q.type,
                        required=q.required,
                        order_index=q.display_order or idx
                    )
                    db.add(afq)
                count += 1
    if count > 0:
        db.commit()
    return count
