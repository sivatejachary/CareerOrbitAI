"""
AI Calling API — extends existing calling endpoints with one-click batch support.

New endpoints:
  GET  /api/ai-calling/eligible-candidates/{job_id}
  POST /api/ai-calling/start
  GET  /api/ai-calling/batches
  GET  /api/ai-calling/batches/{batch_id}
  POST /api/ai-calling/batches/{batch_id}/pause
  POST /api/ai-calling/batches/{batch_id}/resume
  POST /api/ai-calling/batches/{batch_id}/cancel
  GET  /api/ai-calling/batches/{batch_id}/calls
  GET  /api/ai-calling/candidates/{candidate_id}

Existing endpoints (preserved):
  GET  /api/ai-calling/readiness
  GET  /api/ai-calling/attempts
  GET  /api/ai-calling/attempts/{attempt_id}
  POST /api/ai-calling/initiate
  POST /api/ai-calling/stop-contact
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.core.security import get_current_user
from backend.app.models.call_attempt import CallAttempt
from backend.app.models.ai_call_batch import AICallBatch
from backend.app.models.candidate import Candidate
from backend.app.models.candidate_contact_preference import CandidateContactPreference
from backend.app.services.elevenlabs_service import (
    check_elevenlabs_readiness,
    initiate_elevenlabs_outbound_call
)
from backend.app.services.batch_calling_service import (
    get_eligible_candidates,
    create_batch,
    pause_batch,
    resume_batch,
    cancel_batch,
)

router = APIRouter(prefix="/ai-calling", tags=["ElevenLabs AI Calling"])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class InitiateCallRequest(BaseModel):
    candidate_id: str
    job_id: str
    phone_number: str
    custom_first_message: Optional[str] = None


class StopContactRequest(BaseModel):
    candidate_id: str
    phone_number: str
    stop_contact: bool = True
    do_not_call: bool = True
    reason: Optional[str] = None


class StartBatchRequest(BaseModel):
    job_id: str
    workflow_id: Optional[str] = None
    workflow_version_id: Optional[str] = None
    max_concurrent_calls: int = 3
    call_delay_seconds: int = 10
    max_attempts_per_candidate: int = 2


# ─────────────────────────────────────────────────────────────────────────────
# Existing endpoints (preserved exactly)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/readiness")
def get_readiness(
    current_user: User = Depends(get_current_user)
):
    return check_elevenlabs_readiness()


@router.get("/attempts")
def list_call_attempts(
    job_id: Optional[str] = Query(None),
    candidate_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CallAttempt).filter(
        CallAttempt.organization_id == current_user.organization_id
    )
    if job_id:
        query = query.filter(CallAttempt.job_id == job_id)
    if candidate_id:
        query = query.filter(CallAttempt.candidate_id == candidate_id)
    if status_filter:
        query = query.filter(CallAttempt.operation_state == status_filter)
    if batch_id:
        query = query.filter(CallAttempt.batch_id == batch_id)

    total = query.count()
    items = query.order_by(CallAttempt.created_at.desc()).offset((page - 1) * size).limit(size).all()

    results = []
    for att in items:
        cand = att.candidate
        job = att.job
        results.append({
            "id": att.id,
            "batch_id": att.batch_id,
            "workflow_execution_id": att.workflow_execution_id,
            "candidate_id": att.candidate_id,
            "candidate_name": cand.full_name if cand else "Unknown",
            "job_id": att.job_id,
            "job_title": job.title if job else "Unknown",
            "phone_number": att.phone_number,
            "attempt_number": att.attempt_number,
            "operation_state": att.operation_state,
            "connection_state": att.connection_state,
            "disposition": att.disposition,
            "processing_state": att.processing_state,
            "provider": att.provider,
            "provider_call_id": att.provider_call_id,
            "duration_seconds": att.duration_seconds,
            "has_transcript": att.transcript is not None,
            "has_evaluation": att.evaluation is not None,
            "recommendation": att.evaluation.recommendation if att.evaluation else None,
            "scheduled_at": att.scheduled_at,
            "initiated_at": att.initiated_at,
            "ended_at": att.ended_at,
            "created_at": att.created_at
        })

    return {"items": results, "total": total, "page": page, "size": size}


@router.get("/attempts/{attempt_id}")
def get_call_attempt_detail(
    attempt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    att = db.query(CallAttempt).filter(
        CallAttempt.id == attempt_id,
        CallAttempt.organization_id == current_user.organization_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Call attempt not found")

    transcript_data = None
    if att.transcript:
        transcript_data = {
            "full_text": att.transcript.full_transcript_text,
            "turns": att.transcript.turns
        }

    eval_data = None
    if att.evaluation:
        eval_data = {
            "candidate_statements": att.evaluation.candidate_statements,
            "extracted_facts": att.evaluation.extracted_facts,
            "question_coverage": att.evaluation.question_coverage,
            "recommendation": att.evaluation.recommendation,
            "rationale": att.evaluation.rationale,
            "human_override": att.evaluation.human_override
        }

    return {
        "id": att.id,
        "batch_id": att.batch_id,
        "workflow_execution_id": att.workflow_execution_id,
        "candidate": {
            "id": att.candidate.id,
            "full_name": att.candidate.full_name,
            "email": att.candidate.email,
            "phone": att.candidate.phone
        } if att.candidate else None,
        "job": {
            "id": att.job.id,
            "title": att.job.title,
            "job_code": att.job.job_code
        } if att.job else None,
        "phone_number": att.phone_number,
        "attempt_number": att.attempt_number,
        "operation_state": att.operation_state,
        "connection_state": att.connection_state,
        "disposition": att.disposition,
        "processing_state": att.processing_state,
        "provider": att.provider,
        "provider_call_id": att.provider_call_id,
        "duration_seconds": att.duration_seconds,
        "cost_cents": att.cost_cents,
        "error_details": att.error_details,
        "transcript": transcript_data,
        "evaluation": eval_data,
        "scheduled_at": att.scheduled_at,
        "initiated_at": att.initiated_at,
        "ended_at": att.ended_at,
        "created_at": att.created_at
    }


@router.post("/initiate", status_code=status.HTTP_201_CREATED)
def initiate_call(
    call_in: InitiateCallRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    attempt = initiate_elevenlabs_outbound_call(
        db=db,
        organization_id=current_user.organization_id,
        candidate_id=call_in.candidate_id,
        job_id=call_in.job_id,
        phone_number=call_in.phone_number,
        custom_first_message=call_in.custom_first_message
    )
    return {
        "id": attempt.id,
        "operation_state": attempt.operation_state,
        "connection_state": attempt.connection_state,
        "disposition": attempt.disposition,
        "provider_call_id": attempt.provider_call_id,
        "error_details": attempt.error_details
    }


@router.post("/stop-contact")
def update_stop_contact(
    req: StopContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pref = db.query(CandidateContactPreference).filter(
        CandidateContactPreference.organization_id == current_user.organization_id,
        CandidateContactPreference.phone_number == req.phone_number
    ).first()

    if not pref:
        pref = CandidateContactPreference(
            organization_id=current_user.organization_id,
            candidate_id=req.candidate_id,
            phone_number=req.phone_number,
            stop_contact=req.stop_contact,
            do_not_call=req.do_not_call,
            notes=req.reason or "Updated via AI Calling interface."
        )
        db.add(pref)
    else:
        pref.stop_contact = req.stop_contact
        pref.do_not_call = req.do_not_call
        if req.reason:
            pref.notes = req.reason

    db.commit()
    return {"status": "Updated", "stop_contact": req.stop_contact, "do_not_call": req.do_not_call}


# ─────────────────────────────────────────────────────────────────────────────
# NEW: Batch endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/eligible-candidates/{job_id}")
def get_eligible_candidates_for_job(
    job_id: str,
    max_attempts: int = Query(2, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns eligible + ineligible candidates for AI calling, plus aggregate stats.
    Used by the frontend to populate the batch confirmation dialog.
    """
    return get_eligible_candidates(
        db=db,
        organization_id=current_user.organization_id,
        job_id=job_id,
        max_attempts=max_attempts,
    )


@router.post("/start", status_code=status.HTTP_201_CREATED)
def start_batch(
    req: StartBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates and starts a new AI call batch for the given job.
    Returns the batch object immediately (worker runs in background).
    Raises 422 if no eligible candidates found.
    """
    try:
        batch = create_batch(
            db=db,
            organization_id=current_user.organization_id,
            job_id=req.job_id,
            started_by_id=current_user.id,
            workflow_id=req.workflow_id,
            workflow_version_id=req.workflow_version_id,
            max_concurrent_calls=req.max_concurrent_calls,
            call_delay_seconds=req.call_delay_seconds,
            max_attempts_per_candidate=req.max_attempts_per_candidate,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return _batch_to_dict(batch)


@router.get("/batches")
def list_batches(
    job_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(AICallBatch).filter(
        AICallBatch.organization_id == current_user.organization_id
    )
    if job_id:
        query = query.filter(AICallBatch.job_id == job_id)
    total = query.count()
    batches = query.order_by(AICallBatch.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {
        "items": [_batch_to_dict(b) for b in batches],
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/batches/{batch_id}")
def get_batch(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    batch = _get_batch_or_404(db, batch_id, current_user.organization_id)
    return _batch_to_dict(batch)


@router.post("/batches/{batch_id}/pause")
def pause_batch_endpoint(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    batch = _get_batch_or_404(db, batch_id, current_user.organization_id)
    try:
        batch = pause_batch(db, batch)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return _batch_to_dict(batch)


@router.post("/batches/{batch_id}/resume")
def resume_batch_endpoint(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    batch = _get_batch_or_404(db, batch_id, current_user.organization_id)
    try:
        batch = resume_batch(db, batch)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return _batch_to_dict(batch)


@router.post("/batches/{batch_id}/cancel")
def cancel_batch_endpoint(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    batch = _get_batch_or_404(db, batch_id, current_user.organization_id)
    try:
        batch = cancel_batch(db, batch)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return _batch_to_dict(batch)


@router.get("/batches/{batch_id}/calls")
def list_batch_calls(
    batch_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _get_batch_or_404(db, batch_id, current_user.organization_id)
    query = db.query(CallAttempt).filter(CallAttempt.batch_id == batch_id)
    total = query.count()
    items = query.order_by(CallAttempt.created_at.asc()).offset((page - 1) * size).limit(size).all()
    results = []
    for att in items:
        cand = att.candidate
        results.append({
            "id": att.id,
            "candidate_id": att.candidate_id,
            "candidate_name": cand.full_name if cand else "Unknown",
            "phone_number": att.phone_number,
            "attempt_number": att.attempt_number,
            "operation_state": att.operation_state,
            "connection_state": att.connection_state,
            "disposition": att.disposition,
            "processing_state": att.processing_state,
            "recommendation": att.evaluation.recommendation if att.evaluation else None,
            "duration_seconds": att.duration_seconds,
            "error_details": att.error_details,
            "initiated_at": att.initiated_at,
            "ended_at": att.ended_at,
            "created_at": att.created_at,
        })
    return {"items": results, "total": total, "page": page, "size": size}


@router.get("/candidates/{candidate_id}")
def get_candidate_calls(
    candidate_id: str,
    job_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all call history for a candidate (optionally filtered by job)."""
    query = db.query(CallAttempt).filter(
        CallAttempt.organization_id == current_user.organization_id,
        CallAttempt.candidate_id == candidate_id,
    )
    if job_id:
        query = query.filter(CallAttempt.job_id == job_id)
    items = query.order_by(CallAttempt.created_at.desc()).all()
    results = []
    for att in items:
        eval_data = None
        if att.evaluation:
            eval_data = {
                "recommendation": att.evaluation.recommendation,
                "rationale": att.evaluation.rationale,
                "candidate_statements": att.evaluation.candidate_statements,
            }
        transcript_data = None
        if att.transcript:
            transcript_data = {
                "full_text": att.transcript.full_transcript_text,
                "turns": att.transcript.turns,
            }
        results.append({
            "id": att.id,
            "batch_id": att.batch_id,
            "job_id": att.job_id,
            "job_title": att.job.title if att.job else None,
            "phone_number": att.phone_number,
            "attempt_number": att.attempt_number,
            "operation_state": att.operation_state,
            "connection_state": att.connection_state,
            "disposition": att.disposition,
            "processing_state": att.processing_state,
            "duration_seconds": att.duration_seconds,
            "evaluation": eval_data,
            "transcript": transcript_data,
            "initiated_at": att.initiated_at,
            "ended_at": att.ended_at,
            "created_at": att.created_at,
        })
    return {"items": results, "total": len(results)}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_batch_or_404(db: Session, batch_id: str, organization_id: str) -> AICallBatch:
    batch = db.query(AICallBatch).filter(
        AICallBatch.id == batch_id,
        AICallBatch.organization_id == organization_id,
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


def _batch_to_dict(batch: AICallBatch) -> Dict[str, Any]:
    job = batch.job
    return {
        "id": batch.id,
        "job_id": batch.job_id,
        "job_title": job.title if job else None,
        "workflow_id": batch.workflow_id,
        "status": batch.status,
        "total_candidates": batch.total_candidates,
        "initiated_count": batch.initiated_count,
        "completed_count": batch.completed_count,
        "failed_count": batch.failed_count,
        "skipped_count": batch.skipped_count,
        "max_concurrent_calls": batch.max_concurrent_calls,
        "call_delay_seconds": batch.call_delay_seconds,
        "max_attempts_per_candidate": batch.max_attempts_per_candidate,
        "notes": batch.notes,
        "started_at": batch.started_at,
        "paused_at": batch.paused_at,
        "completed_at": batch.completed_at,
        "cancelled_at": batch.cancelled_at,
        "created_at": batch.created_at,
        "updated_at": batch.updated_at,
    }
