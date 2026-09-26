"""
AI Call Batch Service — implements one-click automated outbound calling.

Responsibilities:
  1. Eligibility queries: which candidates qualify for AI calling?
  2. Batch creation with idempotency
  3. Controlled queue execution (configurable concurrency, per-candidate idempotency)
  4. Dynamic candidate context assembly for ElevenLabs dynamic_variables
  5. Batch state management (pause, resume, cancel)
  6. Post-batch status reconciliation

NOTE: Uses threading.Thread for the batch worker (no Celery/Redis required).
      SQLite+threading is safe here because each worker gets its own Session.
"""
import json
import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session

from backend.app.database import SessionLocal
from backend.app.models.ai_call_batch import AICallBatch
from backend.app.models.call_attempt import CallAttempt
from backend.app.models.candidate import Candidate
from backend.app.models.candidate_contact_preference import CandidateContactPreference
from backend.app.models.candidate_job import CandidateJob
from backend.app.models.job import Job
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.services.elevenlabs_service import initiate_elevenlabs_outbound_call

logger = logging.getLogger("careerorbit.batch_calling")

# ─────────────────────────────────────────────────────────────────────────────
# Ineligibility reason codes
# ─────────────────────────────────────────────────────────────────────────────
REASON_NOT_SHORTLISTED = "NOT_SHORTLISTED"
REASON_NO_PHONE = "NO_PHONE"
REASON_INVALID_PHONE = "INVALID_PHONE"
REASON_DO_NOT_CALL = "DO_NOT_CALL"
REASON_ALREADY_ACTIVE = "ALREADY_IN_ACTIVE_CALL"
REASON_MAX_ATTEMPTS = "MAX_ATTEMPTS_REACHED"
REASON_CALL_COMPLETED = "CALL_COMPLETED"


# ─────────────────────────────────────────────────────────────────────────────
# Eligibility check
# ─────────────────────────────────────────────────────────────────────────────

def _count_successful_calls(db: Session, candidate_id: str, job_id: str) -> int:
    """Count completed (non-failed) calls for a candidate+job."""
    return db.query(CallAttempt).filter(
        CallAttempt.candidate_id == candidate_id,
        CallAttempt.job_id == job_id,
        CallAttempt.disposition == "ConversationCompleted",
    ).count()


def _count_total_call_attempts(db: Session, candidate_id: str, job_id: str) -> int:
    """Count ALL call attempts (including failures) for a candidate+job."""
    return db.query(CallAttempt).filter(
        CallAttempt.candidate_id == candidate_id,
        CallAttempt.job_id == job_id,
    ).count()


def _has_active_call(db: Session, organization_id: str, phone_number: str) -> bool:
    """Check if an active (Ringing/Connected) call exists for this phone."""
    return db.query(CallAttempt).filter(
        CallAttempt.organization_id == organization_id,
        CallAttempt.phone_number == phone_number,
        CallAttempt.operation_state.in_(["Initiating", "Accepted"]),
        CallAttempt.connection_state.in_(["Ringing", "Connected"]),
    ).first() is not None


def check_candidate_eligibility(
    db: Session,
    organization_id: str,
    cj: CandidateJob,
    max_attempts: int = 2,
) -> Tuple[bool, str]:
    """
    Returns (eligible: bool, reason: str).
    Eligible means: can be called right now.
    """
    candidate = cj.candidate
    if not candidate:
        return False, REASON_NO_PHONE

    # 1. Must be SHORTLISTED by AI screening
    if cj.recommendation != "SHORTLISTED":
        return False, REASON_NOT_SHORTLISTED

    # 2. Must have a phone number
    if not candidate.phone or not candidate.phone.strip():
        return False, REASON_NO_PHONE

    # 3. Must be E.164 format
    if not candidate.phone.startswith("+"):
        return False, REASON_INVALID_PHONE

    # 4. Contact preferences
    pref = db.query(CandidateContactPreference).filter(
        CandidateContactPreference.organization_id == organization_id,
        CandidateContactPreference.phone_number == candidate.phone,
    ).first()
    if pref and (pref.do_not_call or pref.stop_contact):
        return False, REASON_DO_NOT_CALL

    # 5. Already has a completed call
    if _count_successful_calls(db, candidate.id, cj.job_id) > 0:
        return False, REASON_CALL_COMPLETED

    # 6. Exceeded max attempts
    if _count_total_call_attempts(db, candidate.id, cj.job_id) >= max_attempts:
        return False, REASON_MAX_ATTEMPTS

    # 7. Already in active call
    if _has_active_call(db, organization_id, candidate.phone):
        return False, REASON_ALREADY_ACTIVE

    return True, "ELIGIBLE"


def get_eligible_candidates(
    db: Session,
    organization_id: str,
    job_id: str,
    max_attempts: int = 2,
) -> Dict[str, Any]:
    """
    Returns a dict with eligible/ineligible candidate details plus aggregate stats.
    Used by GET /api/ai-calling/eligible-candidates/{job_id}
    """
    # All candidate_jobs for this org+job
    cjs = db.query(CandidateJob).filter(
        CandidateJob.organization_id == organization_id,
        CandidateJob.job_id == job_id,
    ).all()

    eligible = []
    ineligible = []

    for cj in cjs:
        ok, reason = check_candidate_eligibility(db, organization_id, cj, max_attempts)
        candidate = cj.candidate
        row = {
            "candidate_id": cj.candidate_id,
            "candidate_name": candidate.full_name if candidate else "Unknown",
            "phone": candidate.phone if candidate else None,
            "recommendation": cj.recommendation,
            "screening_score": cj.screening_score,
            "stage": cj.stage,
            "total_attempts": _count_total_call_attempts(db, cj.candidate_id, job_id),
            "reason": reason,
        }
        if ok:
            eligible.append(row)
        else:
            ineligible.append(row)

    job = db.query(Job).filter(Job.id == job_id).first()
    total_applications = len(cjs)
    shortlisted_count = sum(1 for cj in cjs if cj.recommendation == "SHORTLISTED")

    return {
        "job_id": job_id,
        "job_title": job.title if job else None,
        "total_applications": total_applications,
        "shortlisted_count": shortlisted_count,
        "eligible_count": len(eligible),
        "ineligible_count": len(ineligible),
        "eligible_candidates": eligible,
        "ineligible_candidates": ineligible,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Dynamic variable assembly
# ─────────────────────────────────────────────────────────────────────────────

def build_dynamic_variables(
    candidate: Candidate,
    job: Job,
    cj: CandidateJob,
) -> Dict[str, Any]:
    """Assembles all candidate+job context for ElevenLabs dynamic_variables."""
    # Extracted profile from Groq (structured JSON)
    profile = cj.extracted_profile or {}
    skills_list = profile.get("skills", candidate.skills or [])
    if isinstance(skills_list, list):
        skills_str = ", ".join(
            s if isinstance(s, str) else s.get("name", "") for s in skills_list
        )
    else:
        skills_str = str(skills_list)

    # Job skills
    job_skills = job.skills or []
    required_skills_str = ", ".join(
        s if isinstance(s, str) else s.get("name", "") for s in job_skills
    )

    # Screening criterion results
    criterion_results = cj.screening_criterion_results or {}
    matched_skills = []
    missing_skills = []
    if isinstance(criterion_results, dict):
        for k, v in criterion_results.items():
            if isinstance(v, dict):
                if v.get("result") in ["PASS", "PARTIAL"]:
                    matched_skills.append(k)
                elif v.get("result") == "FAIL":
                    missing_skills.append(k)

    company_name = "the company"
    if hasattr(job, "organization") and job.organization:
        company_name = job.organization.name

    return {
        "candidate_name": candidate.full_name,
        "candidate_phone": candidate.phone or "",
        "company_name": company_name,
        "job_title": job.title,
        "job_description": (job.description or "")[:800],
        "required_skills": required_skills_str,
        "candidate_skills": skills_str,
        "candidate_experience": str(
            profile.get("total_experience", candidate.total_experience or "Not stated")
        ),
        "screening_score": str(round(cj.screening_score or 0, 1)),
        "matched_skills": ", ".join(matched_skills) if matched_skills else "Refer to resume",
        "missing_skills": ", ".join(missing_skills) if missing_skills else "None noted",
        "resume_summary": (profile.get("summary", "") or "")[:500],
        "current_company": profile.get("current_company", candidate.current_company or "Not stated"),
        "notice_period": profile.get("notice_period", candidate.notice_period or "Not stated"),
        "location": profile.get("location", candidate.current_location or "Not stated"),
        "approved_job_details": (
            f"{job.title} ({job.department}, {job.work_mode}) — "
            f"Exp: {job.min_experience or 0}–{job.max_experience or 0} yrs — "
            f"Skills: {required_skills_str}"
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Batch creation
# ─────────────────────────────────────────────────────────────────────────────

def create_batch(
    db: Session,
    organization_id: str,
    job_id: str,
    started_by_id: str,
    workflow_id: Optional[str] = None,
    workflow_version_id: Optional[str] = None,
    max_concurrent_calls: int = 3,
    call_delay_seconds: int = 10,
    max_attempts_per_candidate: int = 2,
) -> AICallBatch:
    """
    Creates a new QUEUED batch and immediately starts the background worker.
    Raises ValueError if no eligible candidates found.
    """
    info = get_eligible_candidates(db, organization_id, job_id, max_attempts_per_candidate)
    if info["eligible_count"] == 0:
        raise ValueError(
            f"No eligible candidates found for job {job_id}. "
            f"All {info['shortlisted_count']} shortlisted candidates are either "
            "already called, have no valid phone, or are excluded."
        )

    batch = AICallBatch(
        organization_id=organization_id,
        job_id=job_id,
        workflow_id=workflow_id,
        workflow_version_id=workflow_version_id,
        started_by_id=started_by_id,
        status="QUEUED",
        total_candidates=info["eligible_count"],
        max_concurrent_calls=max_concurrent_calls,
        call_delay_seconds=call_delay_seconds,
        max_attempts_per_candidate=max_attempts_per_candidate,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    # Fire background worker
    thread = threading.Thread(
        target=_run_batch_worker,
        args=(batch.id,),
        name=f"batch-{batch.id[:8]}",
        daemon=True,
    )
    thread.start()
    logger.info(f"Batch {batch.id} created with {info['eligible_count']} candidates — worker started")
    return batch


# ─────────────────────────────────────────────────────────────────────────────
# Background worker
# ─────────────────────────────────────────────────────────────────────────────

def _run_batch_worker(batch_id: str) -> None:
    """
    Background thread: iterates eligible candidates and initiates calls with
    controlled concurrency and delay.  Uses its own SQLAlchemy session.
    """
    db = SessionLocal()
    try:
        batch = db.query(AICallBatch).filter(AICallBatch.id == batch_id).first()
        if not batch:
            logger.error(f"Batch worker: batch {batch_id} not found")
            return

        # Mark RUNNING
        batch.status = "RUNNING"
        batch.started_at = datetime.now(timezone.utc)
        db.commit()

        org_id = batch.organization_id
        job_id = batch.job_id
        max_concurrent = batch.max_concurrent_calls
        delay = batch.call_delay_seconds
        max_attempts = batch.max_attempts_per_candidate

        # Build eligible list at worker start (fresh query)
        cjs = db.query(CandidateJob).filter(
            CandidateJob.organization_id == org_id,
            CandidateJob.job_id == job_id,
        ).all()

        eligible_cjs = []
        for cj in cjs:
            ok, _ = check_candidate_eligibility(db, org_id, cj, max_attempts)
            if ok:
                eligible_cjs.append(cj)

        logger.info(f"Batch {batch_id}: {len(eligible_cjs)} eligible candidates to call")

        for idx, cj in enumerate(eligible_cjs):
            # Re-read batch status (may have been paused/cancelled externally)
            db.refresh(batch)
            if batch.status == "CANCELLED":
                logger.info(f"Batch {batch_id} cancelled at candidate {idx}")
                break

            # Wait for pause to be lifted
            while batch.status == "PAUSED":
                time.sleep(3)
                db.refresh(batch)
                if batch.status == "CANCELLED":
                    break

            if batch.status == "CANCELLED":
                break

            # Re-check eligibility at call time (phone may have been blocked)
            ok, reason = check_candidate_eligibility(db, org_id, cj, max_attempts)
            if not ok:
                logger.info(f"Batch {batch_id}: candidate {cj.candidate_id} skipped at call time: {reason}")
                batch.skipped_count = (batch.skipped_count or 0) + 1
                db.commit()
                continue

            # Wait for concurrency slot
            _wait_for_concurrency_slot(db, org_id, max_concurrent, batch_id)

            candidate = cj.candidate
            job = db.query(Job).filter(Job.id == job_id).first()
            dynamic_vars = build_dynamic_variables(candidate, job, cj)

            logger.info(
                f"Batch {batch_id}: initiating call to {candidate.full_name} "
                f"({candidate.phone}) — {idx + 1}/{len(eligible_cjs)}"
            )

            try:
                attempt = initiate_elevenlabs_outbound_call(
                    db=db,
                    organization_id=org_id,
                    candidate_id=candidate.id,
                    job_id=job_id,
                    phone_number=candidate.phone,
                    dynamic_variables=dynamic_vars,
                )
                # Tag the attempt with this batch
                attempt.batch_id = batch_id
                db.commit()

                if attempt.operation_state in ("Accepted", "Initiating"):
                    batch.initiated_count = (batch.initiated_count or 0) + 1
                else:
                    batch.failed_count = (batch.failed_count or 0) + 1

                db.commit()
            except Exception as e:
                logger.error(f"Batch {batch_id}: error initiating call for {cj.candidate_id}: {e}")
                batch.failed_count = (batch.failed_count or 0) + 1
                db.commit()

            # Inter-call delay
            if idx < len(eligible_cjs) - 1:
                time.sleep(delay)

        # Final batch status
        db.refresh(batch)
        if batch.status not in ("CANCELLED",):
            total = batch.initiated_count + batch.failed_count + batch.skipped_count
            if batch.failed_count > 0 and batch.initiated_count > 0:
                batch.status = "PARTIALLY_COMPLETED"
            elif batch.failed_count > 0 and batch.initiated_count == 0:
                batch.status = "FAILED"
            else:
                batch.status = "COMPLETED"
            batch.completed_at = datetime.now(timezone.utc)
            db.commit()

        logger.info(f"Batch {batch_id} finished: status={batch.status}")

    except Exception as e:
        logger.error(f"Batch worker {batch_id} crashed: {e}", exc_info=True)
        try:
            batch = db.query(AICallBatch).filter(AICallBatch.id == batch_id).first()
            if batch:
                batch.status = "FAILED"
                batch.notes = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _wait_for_concurrency_slot(
    db: Session,
    organization_id: str,
    max_concurrent: int,
    batch_id: str,
    poll_interval: float = 3.0,
    max_wait_seconds: int = 300,
) -> None:
    """Blocks until active call count falls below max_concurrent."""
    waited = 0
    while waited < max_wait_seconds:
        active = db.query(CallAttempt).filter(
            CallAttempt.organization_id == organization_id,
            CallAttempt.batch_id == batch_id,
            CallAttempt.operation_state.in_(["Initiating", "Accepted"]),
            CallAttempt.connection_state.in_(["Ringing", "Connected", "Unknown"]),
            CallAttempt.ended_at.is_(None),
        ).count()
        if active < max_concurrent:
            return
        time.sleep(poll_interval)
        waited += poll_interval
    logger.warning(f"Batch {batch_id}: concurrency wait timed out after {max_wait_seconds}s")


# ─────────────────────────────────────────────────────────────────────────────
# Batch state management
# ─────────────────────────────────────────────────────────────────────────────

def pause_batch(db: Session, batch: AICallBatch) -> AICallBatch:
    if batch.status != "RUNNING":
        raise ValueError(f"Cannot pause batch in status '{batch.status}'")
    batch.status = "PAUSED"
    batch.paused_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(batch)
    return batch


def resume_batch(db: Session, batch: AICallBatch) -> AICallBatch:
    if batch.status != "PAUSED":
        raise ValueError(f"Cannot resume batch in status '{batch.status}'")
    batch.status = "RUNNING"
    batch.paused_at = None
    db.commit()
    db.refresh(batch)
    return batch


def cancel_batch(db: Session, batch: AICallBatch) -> AICallBatch:
    if batch.status in ("COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED"):
        raise ValueError(f"Cannot cancel batch in terminal status '{batch.status}'")
    batch.status = "CANCELLED"
    batch.cancelled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(batch)
    return batch
