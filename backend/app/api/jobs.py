from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.schemas.job import JobCreate, JobUpdate, JobStatusUpdate, JobResponse, JobListResponse
from backend.app.core.security import get_current_user
from backend.app.services import job_service

router = APIRouter(prefix="/jobs", tags=["Jobs"])

@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    job_in: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return job_service.create_job(db, job_in, current_user)

@router.get("", response_model=JobListResponse)
def list_jobs(
    search: Optional[str] = Query(None, description="Search term for title, job code, or department"),
    status: Optional[str] = Query(None, description="Status filter (Draft, Open, Paused, Closed, Expired)"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items, total, pages = job_service.list_jobs(
        db,
        organization_id=current_user.organization_id,
        search=search,
        status_filter=status,
        page=page,
        size=size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }

@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return job_service.get_job(db, job_id, current_user.organization_id)

@router.patch("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: str,
    job_in: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return job_service.update_job(db, job_id, job_in, current_user)

@router.patch("/{job_id}/status", response_model=JobResponse)
def update_job_status(
    job_id: str,
    status_in: JobStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return job_service.update_job_status(db, job_id, status_in.status, current_user)

@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job_service.archive_job(db, job_id, current_user)
    return None
