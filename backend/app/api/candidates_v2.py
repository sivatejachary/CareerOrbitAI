import os
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.candidate import Candidate
from backend.app.models.job_application import JobApplication
from backend.app.models.job import Job
from backend.app.models.resume import Resume
from backend.app.core.security import get_current_user

router = APIRouter(prefix="/candidates", tags=["Candidates"])

@router.get("")
def list_candidates(
    search: Optional[str] = Query(None, description="Search by name, email, or candidate code"),
    skill: Optional[str] = Query(None, description="Filter by skill"),
    min_experience: Optional[float] = Query(None, description="Filter by min total experience"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Candidate).filter(
        Candidate.organization_id == current_user.organization_id,
        Candidate.archived_at.is_(None)
    )

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Candidate.full_name.ilike(search_fmt),
                Candidate.email.ilike(search_fmt),
                Candidate.candidate_code.ilike(search_fmt),
                Candidate.phone.ilike(search_fmt)
            )
        )

    if min_experience is not None:
        query = query.filter(Candidate.total_experience >= min_experience)

    total_count = query.count()
    candidates = query.order_by(Candidate.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for c in candidates:
        apps_count = db.query(JobApplication).filter(JobApplication.candidate_id == c.id).count()
        latest_app = db.query(JobApplication).filter(JobApplication.candidate_id == c.id).order_by(JobApplication.received_at.desc()).first()
        
        items.append({
            "id": c.id,
            "candidate_code": c.candidate_code,
            "full_name": c.full_name,
            "email": c.email,
            "phone": c.phone,
            "current_location": c.current_location,
            "total_experience": c.total_experience,
            "skills": c.skills or [],
            "current_company": c.current_company,
            "notice_period": c.notice_period,
            "first_source": c.first_source,
            "total_applications": apps_count,
            "latest_application_status": latest_app.status if latest_app else None,
            "created_at": c.created_at
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size if total_count > 0 else 1
    }

@router.get("/{candidate_id}")
def get_candidate_detail(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    candidate = db.query(Candidate).filter(
        Candidate.id == candidate_id,
        Candidate.organization_id == current_user.organization_id
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    resumes = db.query(Resume).filter(Resume.candidate_id == candidate.id).order_by(Resume.created_at.desc()).all()
    applications = db.query(JobApplication).filter(JobApplication.candidate_id == candidate.id).order_by(JobApplication.received_at.desc()).all()

    app_list = []
    for app in applications:
        job = db.query(Job).filter(Job.id == app.job_id).first()
        app_list.append({
            "id": app.id,
            "job_id": app.job_id,
            "job_title": job.title if job else "Unknown Job",
            "job_code": job.job_code if job else "",
            "source": app.source,
            "status": app.status,
            "answers_payload": app.answers_payload or {},
            "received_at": app.received_at,
            "submitted_at": app.submitted_at
        })

    resume_list = []
    for r in resumes:
        resume_list.append({
            "id": r.id,
            "original_filename": r.original_filename,
            "file_size": r.file_size,
            "mime_type": r.mime_type,
            "processing_status": r.processing_status,
            "extracted_text_preview": (r.extracted_text[:300] + "...") if r.extracted_text else None,
            "parsed_data": r.parsed_data,
            "created_at": r.created_at
        })

    return {
        "id": candidate.id,
        "candidate_code": candidate.candidate_code,
        "full_name": candidate.full_name,
        "email": candidate.email,
        "phone": candidate.phone,
        "current_location": candidate.current_location,
        "total_experience": candidate.total_experience,
        "skills": candidate.skills or [],
        "current_company": candidate.current_company,
        "notice_period": candidate.notice_period,
        "first_source": candidate.first_source,
        "created_at": candidate.created_at,
        "resumes": resume_list,
        "applications": app_list
    }

@router.get("/{candidate_id}/resumes/{resume_id}/download")
def download_resume(
    candidate_id: str,
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    candidate = db.query(Candidate).filter(
        Candidate.id == candidate_id,
        Candidate.organization_id == current_user.organization_id
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.candidate_id == candidate.id
    ).first()

    if not resume or not os.path.exists(resume.file_path):
        raise HTTPException(status_code=404, detail="Resume file not found")

    return FileResponse(
        path=resume.file_path,
        filename=resume.original_filename,
        media_type=resume.mime_type
    )
