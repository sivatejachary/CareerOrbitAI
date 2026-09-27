from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.candidate import Candidate
from backend.app.models.job_application import JobApplication
from backend.app.models.job import Job
from backend.app.models.resume import Resume
from backend.app.models.screening_run import ScreeningRun
from backend.app.models.hr_decision import HRDecision
from backend.app.models.hr_note import HRNote
from backend.app.core.security import get_current_user
from backend.app.services.screening_service import run_job_screening

router = APIRouter(prefix="/applications", tags=["Applications"])

class HRDecisionRequest(BaseModel):
    decision: str  # Shortlisted, UnderReview, Rejected
    reason: Optional[str] = None
    screening_run_id: Optional[str] = None

class HRNoteRequest(BaseModel):
    content: str

@router.get("")
def list_applications(
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    source: Optional[str] = Query(None, description="Filter by source channel"),
    search: Optional[str] = Query(None, description="Search candidate name or email"),
    sort: str = Query("newest", pattern="^(newest|name)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(JobApplication).join(Candidate, JobApplication.candidate_id == Candidate.id).filter(
        Candidate.organization_id == current_user.organization_id
    )

    if job_id:
        query = query.filter(JobApplication.job_id == job_id)

    if status_filter:
        query = query.filter(JobApplication.status == status_filter)

    if source:
        query = query.filter(JobApplication.source == source)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Candidate.full_name.ilike(search_fmt),
                Candidate.email.ilike(search_fmt),
                Candidate.candidate_code.ilike(search_fmt)
            )
        )

    total_count = query.count()
    applications = query.order_by(Candidate.full_name.asc() if sort == "name" else JobApplication.received_at.desc(), JobApplication.id.asc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for app in applications:
        candidate = app.candidate
        job = db.query(Job).filter(Job.id == app.job_id).first()
        latest_screening = db.query(ScreeningRun).filter(
            ScreeningRun.application_id == app.id
        ).order_by(ScreeningRun.created_at.desc()).first()

        items.append({
            "id": app.id,
            "candidate_id": candidate.id,
            "candidate_code": candidate.candidate_code,
            "candidate_name": candidate.full_name,
            "candidate_email": candidate.email,
            "job_id": app.job_id,
            "job_title": job.title if job else "Unknown Job",
            "job_code": job.job_code if job else "",
            "source": app.source,
            "status": app.status,
            "received_at": app.received_at,
            "screening_recommendation": latest_screening.recommendation if latest_screening else None,
            "screening_score": latest_screening.criterion_results[0].get("score") if latest_screening and latest_screening.criterion_results else None
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size if total_count > 0 else 1
    }

@router.get("/{application_id}")
def get_application_detail(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    app = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")

    candidate = db.query(Candidate).filter(
        Candidate.id == app.candidate_id,
        Candidate.organization_id == current_user.organization_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate application not accessible")

    job = db.query(Job).filter(Job.id == app.job_id).first()
    resume = db.query(Resume).filter(Resume.id == app.resume_id).first() if app.resume_id else None
    screenings = db.query(ScreeningRun).filter(
        ScreeningRun.application_id == app.id
    ).order_by(ScreeningRun.created_at.desc()).all()
    decisions = db.query(HRDecision).filter(
        HRDecision.application_id == app.id
    ).order_by(HRDecision.created_at.desc()).all()
    notes = db.query(HRNote).filter(
        HRNote.application_id == app.id
    ).order_by(HRNote.created_at.desc()).all()

    screening_list = []
    for s in screenings:
        screening_list.append({
            "id": s.id,
            "engine_version": s.engine_version,
            "status": s.status,
            "recommendation": s.recommendation,
            "rationale": s.rationale,
            "criterion_results": s.criterion_results,
            "created_at": s.created_at
        })

    decision_list = []
    for d in decisions:
        decided_by_user = d.decided_by
        decision_list.append({
            "id": d.id,
            "decision": d.decision,
            "reason": d.reason,
            "decided_by": decided_by_user.full_name if decided_by_user else "HR User",
            "created_at": d.created_at
        })

    note_list = []
    for n in notes:
        created_by_user = n.created_by
        note_list.append({
            "id": n.id,
            "content": n.content,
            "created_by": created_by_user.full_name if created_by_user else "HR User",
            "created_at": n.created_at
        })

    return {
        "id": app.id,
        "candidate": {
            "id": candidate.id,
            "candidate_code": candidate.candidate_code,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "current_location": candidate.current_location,
            "total_experience": candidate.total_experience,
            "skills": candidate.skills or [],
            "current_company": candidate.current_company,
            "notice_period": candidate.notice_period
        },
        "job": {
            "id": job.id,
            "title": job.title,
            "job_code": job.job_code,
            "department": job.department
        } if job else None,
        "source": app.source,
        "status": app.status,
        "answers_payload": app.answers_payload or {},
        "profile_snapshot": app.profile_snapshot or {},
        "received_at": app.received_at,
        "resume": {
            "id": resume.id,
            "original_filename": resume.original_filename,
            "file_size": resume.file_size,
            "mime_type": resume.mime_type,
            "extracted_text": resume.extracted_text,
            "parsed_data": resume.parsed_data
        } if resume else None,
        "screening_runs": screening_list,
        "hr_decisions": decision_list,
        "notes": note_list
    }

@router.post("/{application_id}/screen")
def trigger_screening(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    app = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")

    candidate = db.query(Candidate).filter(
        Candidate.id == app.candidate_id,
        Candidate.organization_id == current_user.organization_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Access denied")

    screening = run_job_screening(db, app.id)
    db.commit()
    db.refresh(screening)

    return {
        "id": screening.id,
        "recommendation": screening.recommendation,
        "rationale": screening.rationale,
        "criterion_results": screening.criterion_results,
        "created_at": screening.created_at
    }

@router.post("/{application_id}/decision")
def record_hr_decision(
    application_id: str,
    payload: HRDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    valid_decisions = ["Shortlisted", "UnderReview", "Rejected"]
    if payload.decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Invalid decision. Must be one of {valid_decisions}")

    app = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")

    candidate = db.query(Candidate).filter(
        Candidate.id == app.candidate_id,
        Candidate.organization_id == current_user.organization_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Access denied")

    hr_decision = HRDecision(
        application_id=app.id,
        decided_by_id=current_user.id,
        decision=payload.decision,
        reason=payload.reason,
        screening_run_id=payload.screening_run_id
    )
    db.add(hr_decision)

    # Update application status
    app.status = payload.decision
    app.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(hr_decision)

    return {
        "id": hr_decision.id,
        "application_id": app.id,
        "decision": hr_decision.decision,
        "reason": hr_decision.reason,
        "status": app.status,
        "created_at": hr_decision.created_at
    }

@router.post("/{application_id}/notes")
def add_hr_note(
    application_id: str,
    payload: HRNoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not payload.content or not payload.content.strip():
        raise HTTPException(status_code=400, detail="Note content cannot be empty")

    app = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Job application not found")

    candidate = db.query(Candidate).filter(
        Candidate.id == app.candidate_id,
        Candidate.organization_id == current_user.organization_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Access denied")

    note = HRNote(
        application_id=app.id,
        created_by_id=current_user.id,
        content=payload.content.strip()
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return {
        "id": note.id,
        "application_id": app.id,
        "content": note.content,
        "created_by": current_user.full_name,
        "created_at": note.created_at
    }
