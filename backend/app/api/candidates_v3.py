"""
Candidates V3 API — candidate-centered endpoints using (candidate_id, job_id) as public identity.

Endpoints:
  GET /api/v3/candidates/{candidate_id}/jobs
      → All jobs this candidate applied to (CandidateJob records)

  GET /api/v3/candidates/{candidate_id}/jobs/{job_id}
      → Full pipeline state for this candidate+job pair

  GET /api/v3/candidates/{candidate_id}/jobs/{job_id}/timeline
      → Ordered timeline of events for this candidate+job

  GET /api/v3/candidates/{candidate_id}/jobs/{job_id}/transcript
      → Call transcript(s) for this candidate+job

  POST /api/v3/candidates/{candidate_id}/jobs/{job_id}/screen
      → Trigger re-screening (Groq or rules)

  POST /api/v3/candidates/{candidate_id}/jobs/{job_id}/extract
      → Trigger re-extraction (Groq or heuristic)

  GET /api/v3/candidates/{candidate_id}/jobs/{job_id}/resume/download
      → Signed (time-limited) resume file download

  GET /api/v3/jobs/{job_id}/candidates
      → All candidates for a job with pipeline summary
"""
import os
import time
import hmac
import hashlib
import logging
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.candidate_job import CandidateJob
from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.job_application import JobApplication
from backend.app.models.resume import Resume
from backend.app.models.call_attempt import CallAttempt
from backend.app.models.call_transcript import CallTranscript
from backend.app.models.call_evaluation import CallEvaluation
from backend.app.models.hr_decision import HRDecision
from backend.app.models.hr_note import HRNote
from backend.app.models.screening_run import ScreeningRun
from backend.app.config import settings

logger = logging.getLogger("careerorbit.candidates_v3")

router = APIRouter(prefix="/api/v3", tags=["Candidates V3"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class CandidateJobSummary(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    resume_id: Optional[str] = None
    job_title: Optional[str]
    organization_id: str
    source: str
    stage: str
    extraction_status: str
    screening_status: str
    recommendation: Optional[str]
    screening_score: Optional[float]
    received_at: Optional[datetime]
    screening_completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class TimelineEvent(BaseModel):
    timestamp: datetime
    event_type: str
    title: str
    description: Optional[str]
    data: Optional[Dict[str, Any]]


class CandidateJobDetail(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    resume_id: Optional[str] = None
    job_title: Optional[str]
    organization_id: str
    source: str
    stage: str

    # Extraction
    extraction_status: str
    extracted_profile: Optional[Dict[str, Any]]
    extraction_model: Optional[str]
    extraction_error: Optional[str]
    extraction_completed_at: Optional[datetime]

    # Screening
    screening_status: str
    recommendation: Optional[str]
    screening_score: Optional[float]
    screening_rationale: Optional[str]
    screening_criterion_results: Optional[List[Any]]
    screening_model: Optional[str]
    screening_error: Optional[str]
    screening_completed_at: Optional[datetime]

    # Workflow
    workflow_execution_id: Optional[str]

    received_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helper: resolve and authorize CandidateJob
# ---------------------------------------------------------------------------

def _get_candidate_job(
    db: Session,
    current_user: User,
    candidate_id: str,
    job_id: str
) -> CandidateJob:
    cj = db.query(CandidateJob).filter(
        CandidateJob.candidate_id == candidate_id,
        CandidateJob.job_id == job_id,
        CandidateJob.organization_id == current_user.organization_id
    ).first()
    if not cj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No application found for candidate {candidate_id} → job {job_id}"
        )
    return cj


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/candidates/{candidate_id}/jobs", response_model=List[CandidateJobSummary])
def list_candidate_jobs(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """All jobs this candidate applied to within the organization."""
    cjs = db.query(CandidateJob).filter(
        CandidateJob.candidate_id == candidate_id,
        CandidateJob.organization_id == current_user.organization_id
    ).order_by(CandidateJob.received_at.desc()).all()

    result = []
    for cj in cjs:
        job = db.query(Job).filter(Job.id == cj.job_id).first()
        result.append(CandidateJobSummary(
            id=cj.id,
            candidate_id=cj.candidate_id,
            job_id=cj.job_id,
            resume_id=cj.resume_id,
            job_title=job.title if job else None,
            organization_id=cj.organization_id,
            source=cj.source,
            stage=cj.stage,
            extraction_status=cj.extraction_status,
            screening_status=cj.screening_status,
            recommendation=cj.recommendation,
            screening_score=cj.screening_score,
            received_at=cj.received_at,
            screening_completed_at=cj.screening_completed_at
        ))
    return result


@router.get("/candidates/{candidate_id}/jobs/{job_id}", response_model=CandidateJobDetail)
def get_candidate_job_detail(
    candidate_id: str,
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Full pipeline state for this candidate+job pair."""
    cj = _get_candidate_job(db, current_user, candidate_id, job_id)
    job = db.query(Job).filter(Job.id == cj.job_id).first()

    return CandidateJobDetail(
        id=cj.id,
        candidate_id=cj.candidate_id,
        job_id=cj.job_id,
        resume_id=cj.resume_id,
        job_title=job.title if job else None,
        organization_id=cj.organization_id,
        source=cj.source,
        stage=cj.stage,
        extraction_status=cj.extraction_status,
        extracted_profile=cj.extracted_profile,
        extraction_model=cj.extraction_model,
        extraction_error=cj.extraction_error,
        extraction_completed_at=cj.extraction_completed_at,
        screening_status=cj.screening_status,
        recommendation=cj.recommendation,
        screening_score=cj.screening_score,
        screening_rationale=cj.screening_rationale,
        screening_criterion_results=cj.screening_criterion_results,
        screening_model=cj.screening_model,
        screening_error=cj.screening_error,
        screening_completed_at=cj.screening_completed_at,
        workflow_execution_id=cj.workflow_execution_id,
        received_at=cj.received_at,
        updated_at=cj.updated_at
    )


@router.get("/candidates/{candidate_id}/jobs/{job_id}/timeline", response_model=List[TimelineEvent])
def get_candidate_job_timeline(
    candidate_id: str,
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ordered timeline of events for this candidate+job pair."""
    cj = _get_candidate_job(db, current_user, candidate_id, job_id)
    events: List[TimelineEvent] = []

    # 1. Application received
    if cj.received_at:
        events.append(TimelineEvent(
            timestamp=cj.received_at,
            event_type="APPLICATION_SUBMITTED",
            title="Application Submitted",
            description=f"Received via {cj.source}",
            data=None
        ))

    # 2. Extraction completed
    if cj.extraction_completed_at:
        events.append(TimelineEvent(
            timestamp=cj.extraction_completed_at,
            event_type="EXTRACTION_COMPLETED",
            title=f"Resume Extraction — {cj.extraction_status}",
            description=f"Model: {cj.extraction_model or 'N/A'}",
            data={"extraction_status": cj.extraction_status}
        ))

    # 3. Screening completed
    if cj.screening_completed_at:
        events.append(TimelineEvent(
            timestamp=cj.screening_completed_at,
            event_type="SCREENING_COMPLETED",
            title=f"Screening — {cj.recommendation or cj.screening_status}",
            description=cj.screening_rationale,
            data={"score": cj.screening_score, "recommendation": cj.recommendation}
        ))

    # 4. Legacy ScreeningRun entries (if any)
    if cj.job_application_id:
        screening_runs = db.query(ScreeningRun).filter(
            ScreeningRun.application_id == cj.job_application_id
        ).order_by(ScreeningRun.created_at).all()
        for sr in screening_runs:
            events.append(TimelineEvent(
                timestamp=sr.created_at,
                event_type="LEGACY_SCREENING_RUN",
                title=f"Rules Screening — {sr.recommendation}",
                description=sr.rationale[:200] if sr.rationale else None,
                data={"recommendation": sr.recommendation}
            ))

    # 5. Call attempts
    if cj.candidate_id and cj.job_id:
        call_attempts = db.query(CallAttempt).filter(
            CallAttempt.candidate_id == cj.candidate_id,
            CallAttempt.job_id == cj.job_id
        ).order_by(CallAttempt.created_at).all()
        for ca in call_attempts:
            ts = ca.initiated_at or ca.created_at
            events.append(TimelineEvent(
                timestamp=ts,
                event_type="CALL_ATTEMPT",
                title=f"AI Call — {ca.operation_state} / {ca.disposition or 'Pending'}",
                description=ca.error_details,
                data={
                    "attempt_number": ca.attempt_number,
                    "disposition": ca.disposition,
                    "duration_seconds": ca.duration_seconds
                }
            ))

    # 6. HR Decisions
    if cj.job_application_id:
        decisions = db.query(HRDecision).filter(
            HRDecision.application_id == cj.job_application_id
        ).order_by(HRDecision.decided_at).all()
        for d in decisions:
            events.append(TimelineEvent(
                timestamp=d.decided_at,
                event_type="HR_DECISION",
                title=f"HR Decision — {d.decision}",
                description=d.notes,
                data={"decision": d.decision}
            ))

    # Sort chronologically
    events.sort(key=lambda e: e.timestamp)
    return events


@router.get("/candidates/{candidate_id}/jobs/{job_id}/transcript")
def get_call_transcript(
    candidate_id: str,
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return call transcript(s) for this candidate+job pair."""
    _get_candidate_job(db, current_user, candidate_id, job_id)

    call_attempts = db.query(CallAttempt).filter(
        CallAttempt.candidate_id == candidate_id,
        CallAttempt.job_id == job_id,
        CallAttempt.organization_id == current_user.organization_id
    ).order_by(CallAttempt.created_at.desc()).all()

    results = []
    for ca in call_attempts:
        transcript = db.query(CallTranscript).filter(
            CallTranscript.call_attempt_id == ca.id
        ).first()
        evaluation = db.query(CallEvaluation).filter(
            CallEvaluation.call_attempt_id == ca.id
        ).first()

        results.append({
            "call_attempt_id": ca.id,
            "attempt_number": ca.attempt_number,
            "operation_state": ca.operation_state,
            "disposition": ca.disposition,
            "duration_seconds": ca.duration_seconds,
            "initiated_at": ca.initiated_at.isoformat() if ca.initiated_at else None,
            "ended_at": ca.ended_at.isoformat() if ca.ended_at else None,
            "transcript": {
                "full_text": transcript.full_transcript_text if transcript else None,
                "turns": transcript.turns if transcript else []
            } if transcript else None,
            "evaluation": {
                "recommendation": evaluation.recommendation,
                "rationale": evaluation.rationale,
                "extracted_facts": evaluation.extracted_facts,
                "candidate_statements": evaluation.candidate_statements
            } if evaluation else None
        })

    return {"candidate_id": candidate_id, "job_id": job_id, "calls": results}


@router.post("/candidates/{candidate_id}/jobs/{job_id}/extract")
def trigger_extraction(
    candidate_id: str,
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger or re-trigger Groq extraction for this candidate+job."""
    cj = _get_candidate_job(db, current_user, candidate_id, job_id)

    # Reset so it runs again
    cj.extraction_status = "QUEUED"
    cj.extracted_profile = None
    db.flush()

    from backend.app.services.groq_extraction_service import run_extraction_for_candidate_job
    cj = run_extraction_for_candidate_job(db, cj.id)
    db.commit()

    return {
        "candidate_job_id": cj.id,
        "extraction_status": cj.extraction_status,
        "extraction_model": cj.extraction_model,
        "extracted_profile": cj.extracted_profile,
        "error": cj.extraction_error
    }


@router.post("/candidates/{candidate_id}/jobs/{job_id}/screen")
def trigger_screening(
    candidate_id: str,
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger or re-trigger Groq screening for this candidate+job."""
    cj = _get_candidate_job(db, current_user, candidate_id, job_id)

    if cj.extraction_status != "SUCCEEDED":
        # Try extraction first
        from backend.app.services.groq_extraction_service import run_extraction_for_candidate_job
        cj = run_extraction_for_candidate_job(db, cj.id)

    cj.screening_status = "QUEUED"
    cj.recommendation = None
    db.flush()

    from backend.app.services.groq_screening_service import run_screening_for_candidate_job
    cj = run_screening_for_candidate_job(db, cj.id)
    db.commit()

    return {
        "candidate_job_id": cj.id,
        "screening_status": cj.screening_status,
        "recommendation": cj.recommendation,
        "screening_score": cj.screening_score,
        "screening_model": cj.screening_model,
        "rationale": cj.screening_rationale,
        "error": cj.screening_error
    }


# ---------------------------------------------------------------------------
# Resume download — HMAC-signed time-limited URL
# ---------------------------------------------------------------------------

DOWNLOAD_LINK_EXPIRY_SECONDS = 900  # 15 minutes
DOWNLOAD_SECRET = settings.JWT_SECRET  # Reuse JWT secret for signed URLs


def _make_download_token(resume_id: str) -> str:
    expires_at = int(time.time()) + DOWNLOAD_LINK_EXPIRY_SECONDS
    payload = f"{resume_id}:{expires_at}"
    sig = hmac.new(DOWNLOAD_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{expires_at}:{sig}"


def _verify_download_token(resume_id: str, token: str) -> bool:
    try:
        expires_at_str, sig = token.split(":", 1)
        expires_at = int(expires_at_str)
        if time.time() > expires_at:
            return False
        payload = f"{resume_id}:{expires_at}"
        expected = hmac.new(DOWNLOAD_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected)
    except Exception:
        return False


@router.get("/candidates/{candidate_id}/jobs/{job_id}/resume/link")
def get_resume_download_link(
    candidate_id: str,
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a time-limited (15-min) signed URL for resume download."""
    cj = _get_candidate_job(db, current_user, candidate_id, job_id)

    if not cj.resume_id:
        raise HTTPException(status_code=404, detail="No resume attached to this application")

    token = _make_download_token(cj.resume_id)
    url = f"{settings.PUBLIC_APP_URL}/api/v3/resumes/{cj.resume_id}/download?token={token}"

    return {
        "resume_id": cj.resume_id,
        "download_url": url,
        "expires_in_seconds": DOWNLOAD_LINK_EXPIRY_SECONDS
    }


@router.get("/resumes/{resume_id}/download")
def download_resume(
    resume_id: str,
    token: str,
    db: Session = Depends(get_db)
):
    """
    Serve the resume file for authenticated download.
    Token must be valid (HMAC-signed, not expired).
    Does NOT require JWT auth — the token is the auth mechanism.
    """
    if not _verify_download_token(resume_id, token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Download link is invalid or expired"
        )

    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if not os.path.exists(resume.file_path):
        raise HTTPException(status_code=404, detail="Resume file not found on server")

    return FileResponse(
        path=resume.file_path,
        filename=resume.original_filename,
        media_type=resume.mime_type or "application/octet-stream"
    )


# ---------------------------------------------------------------------------
# Job pipeline view: all candidates for a job
# ---------------------------------------------------------------------------

@router.get("/jobs/{job_id}/candidates")
def list_job_candidates(
    job_id: str,
    stage: Optional[str] = None,
    recommendation: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    All candidates who applied to a job, with pipeline state.
    Filterable by stage or recommendation.
    """
    query = db.query(CandidateJob).filter(
        CandidateJob.job_id == job_id,
        CandidateJob.organization_id == current_user.organization_id
    )
    if stage:
        query = query.filter(CandidateJob.stage == stage)
    if recommendation:
        query = query.filter(CandidateJob.recommendation == recommendation)

    cjs = query.order_by(CandidateJob.received_at.desc()).all()

    result = []
    for cj in cjs:
        candidate = db.query(Candidate).filter(Candidate.id == cj.candidate_id).first()
        result.append({
            "candidate_job_id": cj.id,
            "candidate_id": cj.candidate_id,
            "candidate_name": candidate.full_name if candidate else "Unknown",
            "candidate_email": candidate.email if candidate else None,
            "candidate_phone": candidate.phone if candidate else None,
            "stage": cj.stage,
            "recommendation": cj.recommendation,
            "screening_score": cj.screening_score,
            "extraction_status": cj.extraction_status,
            "screening_status": cj.screening_status,
            "source": cj.source,
            "received_at": cj.received_at.isoformat() if cj.received_at else None
        })

    return {
        "job_id": job_id,
        "total": len(result),
        "candidates": result
    }
