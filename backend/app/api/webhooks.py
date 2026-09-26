from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.job import Job
from backend.app.models.application_form import ApplicationForm
from backend.app.models.candidate_application import CandidateApplication
from backend.app.schemas.candidate_application import CandidateApplicationResponse
from backend.app.services.ingestion_service import ingest_job_application

router = APIRouter(prefix="/webhooks/google-forms", tags=["Google Forms Webhook"])

def parse_candidate_from_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    answers = payload.get("answers", payload)

    full_name = payload.get("full_name") or payload.get("name")
    email = payload.get("email")
    phone = payload.get("phone")
    location = payload.get("current_location") or payload.get("location")
    experience = payload.get("total_experience") or payload.get("experience")
    resume_url = payload.get("resume_url") or payload.get("resume")
    current_ctc = payload.get("current_ctc")
    expected_ctc = payload.get("expected_ctc")
    notice_period = payload.get("notice_period")

    if isinstance(answers, dict):
        for key, val in answers.items():
            k_lower = str(key).lower()
            val_str = str(val) if val is not None else ""

            if not full_name and ("name" in k_lower or "full name" in k_lower):
                full_name = val_str
            elif not email and ("email" in k_lower or "mail" in k_lower):
                email = val_str
            elif not phone and ("phone" in k_lower or "contact" in k_lower or "mobile" in k_lower):
                phone = val_str
            elif not location and ("location" in k_lower or "city" in k_lower):
                location = val_str
            elif experience is None and ("experience" in k_lower or "years" in k_lower):
                try:
                    cleaned_exp = "".join([c for c in val_str if c.isdigit() or c == "."])
                    experience = float(cleaned_exp) if cleaned_exp else None
                except Exception:
                    experience = None
            elif not resume_url and ("resume" in k_lower or "cv" in k_lower or "drive.google.com" in val_str):
                resume_url = val_str
            elif not notice_period and ("notice" in k_lower or "availability" in k_lower):
                notice_period = val_str
            elif not current_ctc and ("current" in k_lower and ("ctc" in k_lower or "salary" in k_lower)):
                current_ctc = val_str
            elif not expected_ctc and ("expected" in k_lower and ("ctc" in k_lower or "salary" in k_lower)):
                expected_ctc = val_str

    if not full_name:
        full_name = payload.get("respondent_email") or "Google Forms Applicant"
    if not email:
        email = payload.get("respondent_email") or "applicant_gf@example.com"

    return {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "current_location": location,
        "total_experience": experience,
        "current_ctc": str(current_ctc) if current_ctc is not None else None,
        "expected_ctc": str(expected_ctc) if expected_ctc is not None else None,
        "notice_period": notice_period,
        "resume_url": resume_url,
        "answers_payload": answers
    }

@router.post("/{job_id}", response_model=CandidateApplicationResponse, status_code=status.HTTP_201_CREATED)
async def receive_google_form_submission(
    job_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id, Job.archived_at.is_(None)).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job record '{job_id}' not found."
        )

    form = db.query(ApplicationForm).filter(ApplicationForm.job_id == job.id).first()

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    parsed = parse_candidate_from_payload(payload)

    # Ingest through Central Ingestion Engine
    job_app = ingest_job_application(
        db=db,
        job_id=job.id,
        source="GoogleForms",
        candidate_data={
            "full_name": parsed["full_name"],
            "email": parsed["email"],
            "phone": parsed["phone"],
            "current_location": parsed["current_location"],
            "total_experience": parsed["total_experience"],
            "notice_period": parsed["notice_period"]
        },
        answers_payload=parsed["answers_payload"],
        form_id=form.id if form else None
    )

    # Return legacy candidate application representation for response backward compatibility
    legacy_candidate = db.query(CandidateApplication).filter(
        CandidateApplication.job_id == job.id,
        CandidateApplication.candidate_id == job_app.candidate_id
    ).order_by(CandidateApplication.created_at.desc()).first()

    if not legacy_candidate:
        legacy_candidate = CandidateApplication(
            id=job_app.id,
            job_id=job.id,
            organization_id=job.organization_id,
            full_name=parsed["full_name"],
            email=parsed["email"],
            phone=parsed["phone"],
            current_location=parsed["current_location"],
            total_experience=parsed["total_experience"],
            source_channel="GoogleForms",
            status="Submitted",
            answers_payload=parsed["answers_payload"]
        )

    return legacy_candidate
