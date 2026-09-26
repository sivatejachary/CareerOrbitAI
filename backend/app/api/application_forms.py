import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.application_form import ApplicationForm
from backend.app.models.audit_log import AuditLog
from backend.app.schemas.application_form import (
    ApplicationFormCreate,
    ApplicationFormResponse,
    QuestionPreviewResponse
)
from backend.app.core.security import get_current_user
from backend.app.services.job_service import get_job
from backend.app.services.form_generator_service import generate_questions_from_job
from backend.app.adapters.google_forms_adapter import GoogleFormsAdapter
from backend.app.adapters.microsoft_forms_adapter import MicrosoftFormsAdapter

class FormStateUpdate(BaseModel):
    state: str

router = APIRouter(prefix="/jobs/{job_id}/application-forms", tags=["Application Forms"])

@router.post("/preview", response_model=QuestionPreviewResponse)
def preview_application_questions(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = get_job(db, job_id, current_user.organization_id)
    questions = generate_questions_from_job(job)

    return QuestionPreviewResponse(
        job_id=job.id,
        job_revision=job.revision,
        suggested_title=f"Application Form - {job.title} ({job.job_code})",
        questions=questions
    )

@router.post("", response_model=ApplicationFormResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_application_form(
    job_id: str,
    form_in: ApplicationFormCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = get_job(db, job_id, current_user.organization_id)

    # Single form per job constraint
    existing_form = db.query(ApplicationForm).filter(
        ApplicationForm.job_id == job.id,
        ApplicationForm.organization_id == current_user.organization_id
    ).first()

    questions_dict = [q.model_dump() for q in form_in.questions]

    # Generate provider URLs
    clean_code = job.job_code.replace("-", "_")
    creation_status = "Created"
    provider_form_id = form_in.provider_form_id or f"form_{clean_code}"
    
    if form_in.provider == "GoogleForms":
        adapter = GoogleFormsAdapter()
        res = adapter.create_external_form(form_in.title, form_in.description or "", form_in.questions)
        creation_status = res["creation_status"]
        provider_form_id = form_in.provider_form_id or res.get("provider_form_id") or f"1FAIpQLS_{clean_code}"
        respondent_url = form_in.respondent_url or f"https://docs.google.com/forms/d/e/1FAIpQLS_{clean_code}/viewform"
        editor_url = form_in.editor_url or f"https://docs.google.com/forms/d/1FAIpQLS_{clean_code}/edit"
    elif form_in.provider == "MicrosoftForms":
        respondent_url = form_in.respondent_url or f"https://forms.office.com/r/{clean_code}"
        editor_url = form_in.editor_url or f"https://forms.office.com/Pages/DesignPage.aspx#id={clean_code}"
    else:
        respondent_url = form_in.respondent_url or f"http://localhost:3000/application-forms/{job.job_code}"
        editor_url = form_in.editor_url or None

    if existing_form:
        existing_form.title = form_in.title
        existing_form.description = form_in.description
        existing_form.questions_schema = questions_dict
        existing_form.provider = form_in.provider
        existing_form.provider_form_id = provider_form_id
        existing_form.respondent_url = respondent_url
        existing_form.editor_url = editor_url
        existing_form.creation_status = creation_status
        existing_form.publication_state = form_in.publication_state
        existing_form.source_job_revision = job.revision

        audit = AuditLog(
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action="FORM_UPDATE",
            resource_type="ApplicationForm",
            resource_id=existing_form.id,
            details={"job_id": job.id, "provider": form_in.provider}
        )
        db.add(audit)
        db.commit()
        db.refresh(existing_form)
        return existing_form
    else:
        app_form = ApplicationForm(
            job_id=job.id,
            organization_id=current_user.organization_id,
            created_by_id=current_user.id,
            form_version=1,
            source_job_revision=job.revision,
            title=form_in.title,
            description=form_in.description,
            questions_schema=questions_dict,
            provider=form_in.provider,
            provider_form_id=provider_form_id,
            respondent_url=respondent_url,
            editor_url=editor_url,
            creation_status=creation_status,
            publication_state=form_in.publication_state
        )

        db.add(app_form)
        db.flush()

        audit = AuditLog(
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action="FORM_GENERATE",
            resource_type="ApplicationForm",
            resource_id=app_form.id,
            details={"job_id": job.id, "provider": form_in.provider}
        )
        db.add(audit)
        db.commit()
        db.refresh(app_form)
        return app_form

@router.get("", response_model=List[ApplicationFormResponse])
def list_application_forms(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = get_job(db, job_id, current_user.organization_id)
    forms = db.query(ApplicationForm).filter(
        ApplicationForm.job_id == job.id,
        ApplicationForm.organization_id == current_user.organization_id
    ).all()

    # Ensure website forms have public tokens and respondent URLs
    for f in forms:
        if f.provider == "Native" or f.is_primary_website_form:
            if not f.public_token:
                f.public_token = secrets.token_urlsafe(32)
                f.token_generated_at = datetime.now(timezone.utc)
            if not f.respondent_url or "http" in f.respondent_url:
                f.respondent_url = f"/apply/{job.job_code}/{f.public_token}"
            db.commit()

    return forms

@router.get("/{form_id}", response_model=ApplicationFormResponse)
def get_application_form(
    job_id: str,
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = get_job(db, job_id, current_user.organization_id)
    form = db.query(ApplicationForm).filter(
        ApplicationForm.id == form_id,
        ApplicationForm.job_id == job.id,
        ApplicationForm.organization_id == current_user.organization_id
    ).first()

    if not form:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application Form '{form_id}' not found for this job."
        )

    if (form.provider == "Native" or form.is_primary_website_form) and not form.public_token:
        form.public_token = secrets.token_urlsafe(32)
        form.token_generated_at = datetime.now(timezone.utc)
        form.respondent_url = f"/apply/{job.job_code}/{form.public_token}"
        db.commit()

    return form

@router.post("/{form_id}/publish", response_model=ApplicationFormResponse)
def publish_application_form(
    job_id: str,
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = get_application_form(job_id, form_id, db, current_user)
    if form.provider == "GoogleForms" and form.resume_setup_status != "Verified":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish Google Form before resume setup is verified. Please add the required File Upload question in the Google Forms editor and verify setup."
        )

    form.publication_state = "Active"

    audit = AuditLog(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="FORM_PUBLISH",
        resource_type="ApplicationForm",
        resource_id=form.id,
        details={"published_id": form.id, "state": "Active"}
    )
    db.add(audit)
    db.commit()
    db.refresh(form)
    return form

@router.post("/{form_id}/state", response_model=ApplicationFormResponse)
def update_application_form_state(
    job_id: str,
    form_id: str,
    state_in: FormStateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_states = ["Draft", "Active", "Paused", "Closed"]
    target_state = state_in.state.strip()
    if target_state not in allowed_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid publication state '{target_state}'. Allowed states: {allowed_states}"
        )

    form = get_application_form(job_id, form_id, db, current_user)

    if target_state == "Active" and form.provider == "GoogleForms" and form.resume_setup_status != "Verified":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot activate Google Form before resume setup is verified."
        )

    form.publication_state = target_state

    audit = AuditLog(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="FORM_STATE_CHANGE",
        resource_type="ApplicationForm",
        resource_id=form.id,
        details={"new_state": target_state}
    )
    db.add(audit)
    db.commit()
    db.refresh(form)
    return form

@router.post("/{form_id}/regenerate-token", response_model=ApplicationFormResponse)
def regenerate_application_form_token(
    job_id: str,
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = get_job(db, job_id, current_user.organization_id)
    form = get_application_form(job_id, form_id, db, current_user)

    new_token = secrets.token_urlsafe(32)
    form.public_token = new_token
    form.token_generated_at = datetime.now(timezone.utc)
    form.respondent_url = f"/apply/{job.job_code}/{new_token}"

    audit = AuditLog(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="FORM_TOKEN_REGENERATE",
        resource_type="ApplicationForm",
        resource_id=form.id,
        details={"job_code": job.job_code, "new_token": new_token}
    )
    db.add(audit)
    db.commit()
    db.refresh(form)
    return form

@router.post("/{form_id}/toggle-submissions", response_model=ApplicationFormResponse)
def toggle_public_submissions(
    job_id: str,
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = get_application_form(job_id, form_id, db, current_user)
    form.allow_public_submissions = not form.allow_public_submissions

    audit = AuditLog(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="FORM_TOGGLE_SUBMISSIONS",
        resource_type="ApplicationForm",
        resource_id=form.id,
        details={"allow_public_submissions": form.allow_public_submissions}
    )
    db.add(audit)
    db.commit()
    db.refresh(form)
    return form
