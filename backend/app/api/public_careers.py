from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import Optional
import json

from backend.app.database import get_db
from backend.app.models.job import Job
from backend.app.models.application_form import ApplicationForm
from backend.app.services.ingestion_service import ingest_job_application

router = APIRouter(prefix="/api/public/jobs", tags=["Public Careers"])

@router.get("/{job_code}")
def get_public_job_details(job_code: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(
        Job.job_code == job_code,
        Job.archived_at.is_(None)
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found")

    if job.status not in ["Active", "Published", "Open"] and not job.career_page_published:
        raise HTTPException(status_code=404, detail="This job posting is not currently accepting applications")

    form = db.query(ApplicationForm).filter(
        ApplicationForm.job_id == job.id,
        ApplicationForm.publication_state == "Published"
    ).first()

    # Mask salary if show_salary is False
    salary_info = None
    if job.show_salary:
        salary_info = {
            "min_salary": job.min_salary,
            "max_salary": job.max_salary,
            "currency": job.currency,
            "salary_type": job.salary_type
        }

    return {
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
        "allow_relocation": job.allow_relocation,
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
        "application_deadline": job.application_deadline,
        "career_page_published": job.career_page_published,
        "form_schema": form.questions_schema if form else None
    }

@router.post("/{job_code}/apply")
async def submit_public_application(
    job_code: str,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    current_location: Optional[str] = Form(None),
    total_experience: Optional[float] = Form(None),
    current_company: Optional[str] = Form(None),
    notice_period: Optional[str] = Form(None),
    skills_raw: Optional[str] = Form(None),
    answers_json: Optional[str] = Form(None),
    resume: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(
        Job.job_code == job_code,
        Job.archived_at.is_(None)
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found")

    skills_list = []
    if skills_raw:
        skills_list = [s.strip() for s in skills_raw.split(",") if s.strip()]

    answers_payload = {}
    if answers_json:
        try:
            answers_payload = json.loads(answers_json)
        except Exception:
            pass

    file_bytes = None
    filename = None
    mime_type = None
    if resume:
        file_bytes = await resume.read()
        filename = resume.filename
        mime_type = resume.content_type

    candidate_data = {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "current_location": current_location,
        "total_experience": total_experience,
        "current_company": current_company,
        "notice_period": notice_period,
        "skills": skills_list
    }

    try:
        application = ingest_job_application(
            db=db,
            job_id=job.id,
            source="CareerPage",
            candidate_data=candidate_data,
            answers_payload=answers_payload,
            file_bytes=file_bytes,
            filename=filename,
            mime_type=mime_type
        )
        return {
            "success": True,
            "application_id": application.id,
            "message": "Your application has been submitted successfully!"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Application submission failed: {str(e)}")
