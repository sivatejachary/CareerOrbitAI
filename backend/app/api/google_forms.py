from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.application_form import ApplicationForm
from backend.app.models.source_response import SourceResponse
from backend.app.core.security import get_current_user
from backend.app.services.google_service import (
    create_real_google_form,
    verify_google_form_setup,
    verify_google_resume_upload_setup,
    publish_google_form,
    sync_google_form_responses
)

router = APIRouter(tags=["Google Forms Integration"])

@router.post("/api/jobs/{job_id}/application-forms/google")
def create_google_form_endpoint(
    job_id: str,
    connection_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    form = create_real_google_form(db, job_id, current_user, connection_id)
    return {
        "id": form.id,
        "job_id": form.job_id,
        "provider": form.provider,
        "provider_form_id": form.provider_form_id,
        "respondent_url": form.respondent_url,
        "editor_url": form.editor_url,
        "creation_status": form.creation_status,
        "publication_state": form.publication_state,
        "resume_collection_mode": form.resume_collection_mode,
        "resume_setup_status": form.resume_setup_status,
        "questions_count": len(form.questions_schema)
    }

@router.post("/api/application-forms/{form_id}/verify")
def verify_form_setup_endpoint(
    form_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    form = verify_google_form_setup(db, form_id, current_user)
    return {
        "id": form.id,
        "publication_state": form.publication_state,
        "resume_setup_status": form.resume_setup_status,
        "google_resume_question_id": form.google_resume_question_id,
        "last_verified_at": form.last_verified_at,
        "message": "Form setup verified successfully."
    }

@router.post("/api/application-forms/{form_id}/verify-resume-setup")
def verify_resume_setup_endpoint(
    form_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return verify_google_resume_upload_setup(db, form_id, current_user)

@router.post("/api/application-forms/{form_id}/publish")
def publish_form_endpoint(
    form_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    form = publish_google_form(db, form_id, current_user)
    return {
        "id": form.id,
        "publication_state": form.publication_state,
        "message": "Google Form published successfully."
    }

@router.post("/api/application-forms/{form_id}/sync")
def sync_form_responses_endpoint(
    form_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    form = db.query(ApplicationForm).filter(
        ApplicationForm.id == form_id,
        ApplicationForm.organization_id == current_user.organization_id
    ).first()

    if not form:
        raise HTTPException(status_code=404, detail="Application Form not found")

    result = sync_google_form_responses(db, form.id)
    return result

@router.get("/api/application-forms/{form_id}/responses")
def get_form_source_responses(
    form_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    form = db.query(ApplicationForm).filter(
        ApplicationForm.id == form_id,
        ApplicationForm.organization_id == current_user.organization_id
    ).first()

    if not form:
        raise HTTPException(status_code=404, detail="Application Form not found")

    responses = db.query(SourceResponse).filter(
        SourceResponse.application_form_id == form.id,
        SourceResponse.organization_id == current_user.organization_id
    ).order_by(SourceResponse.latest_submitted_at.desc()).all()

    items = []
    for r in responses:
        items.append({
            "id": r.id,
            "provider_response_id": r.provider_response_id,
            "original_submitted_at": r.original_submitted_at,
            "latest_submitted_at": r.latest_submitted_at,
            "processing_status": r.processing_status,
            "job_application_id": r.job_application_id,
            "error_details": r.error_details,
            "raw_payload": r.raw_payload
        })

    return {
        "items": items,
        "total": len(items),
        "sync_status": form.sync_status,
        "last_sync_at": form.last_sync_at
    }
