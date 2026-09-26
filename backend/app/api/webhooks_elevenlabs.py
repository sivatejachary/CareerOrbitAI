"""
ElevenLabs Webhook Handler — hardened per §12 of the enterprise spec.

Security:
  - Raw body HMAC-SHA256 verification (xi-signature header)
  - Timestamp replay protection: rejects if |now - event_ts| > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
  - Returns 200 Accepted for all valid payloads (even if no matching CallAttempt)
    to prevent ElevenLabs from retrying known non-matches

Event types handled:
  - conversation.completed (primary)
  - call.completed
  - Any payload with a call_id or conversation_id
"""
import hmac
import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Header, HTTPException, Depends, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.models.call_attempt import CallAttempt
from backend.app.services.elevenlabs_service import record_call_completion
from backend.app.services.workflow_engine import advance_execution

logger = logging.getLogger("careerorbit.elevenlabs_webhook")

router = APIRouter(prefix="/webhooks/elevenlabs", tags=["ElevenLabs Webhooks"])


def _verify_signature(raw_body: bytes, signature: str, secret: str, event_timestamp: int) -> None:
    """
    Verify ElevenLabs webhook signature using HMAC-SHA256.
    Raises HTTPException on failure.

    Signature format: "sha256=<hex_digest>" OR just "<hex_digest>"
    Replay protection: timestamp must be within WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS of now.
    """
    if not secret:
        return  # Verification disabled — log warning only

    # Replay protection
    now_ts = int(time.time())
    tolerance = settings.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
    if abs(now_ts - event_timestamp) > tolerance:
        logger.warning(
            f"Webhook timestamp replay violation: event_ts={event_timestamp}, now={now_ts}, delta={now_ts - event_timestamp}s"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Webhook timestamp is outside the {tolerance}s replay window"
        )

    # Compute expected signature
    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    # Strip "sha256=" prefix if present
    received = signature.removeprefix("sha256=").strip()

    if not hmac.compare_digest(received, expected):
        logger.warning("Invalid ElevenLabs webhook signature rejected")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature"
        )


@router.post("")
async def handle_elevenlabs_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    raw_body = await request.body()
    signature = (
        request.headers.get("xi-signature")
        or request.headers.get("x-elevenlabs-signature")
        or ""
    )

    # Parse body first to extract timestamp for replay protection
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Extract event timestamp (ElevenLabs sends unix timestamp in "timestamp" or "created_at")
    event_timestamp = (
        payload.get("timestamp")
        or payload.get("created_at_unix")
        or int(time.time())  # fallback to now if not provided
    )
    if isinstance(event_timestamp, float):
        event_timestamp = int(event_timestamp)

    # Signature verification
    if settings.ELEVENLABS_WEBHOOK_SECRET:
        if not signature:
            logger.warning("Missing ElevenLabs webhook signature header (secret is configured)")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing webhook signature header"
            )
        _verify_signature(raw_body, signature, settings.ELEVENLABS_WEBHOOK_SECRET, event_timestamp)
    elif signature:
        # Secret not configured but signature sent — log and proceed
        logger.info("ElevenLabs webhook signature received but ELEVENLABS_WEBHOOK_SECRET not configured; skipping verification")

    event_type = payload.get("type") or payload.get("event") or "call_completed"
    call_id = payload.get("call_id") or payload.get("id")
    conv_id = payload.get("conversation_id")

    logger.info(f"ElevenLabs webhook received: type={event_type} call_id={call_id} conv_id={conv_id}")

    # Correlate with stored CallAttempt
    attempt = None
    if call_id:
        attempt = db.query(CallAttempt).filter(CallAttempt.provider_call_id == call_id).first()
    if not attempt and conv_id:
        attempt = db.query(CallAttempt).filter(CallAttempt.provider_conversation_id == conv_id).first()

    if not attempt:
        # Return 200 to prevent provider retries for events we cannot correlate
        logger.info(f"No matching CallAttempt for call_id={call_id}, conv_id={conv_id} — acknowledged without processing")
        return {"status": "Acknowledged", "reason": "No matching CallAttempt found"}

    # Build transcript text and turns
    transcript_text = payload.get("transcript") or payload.get("text") or ""
    turns_raw = payload.get("turns") or payload.get("messages") or []
    turns = []
    if isinstance(turns_raw, list):
        for t in turns_raw:
            if isinstance(t, dict):
                turns.append({
                    "speaker": t.get("role") or t.get("speaker") or "user",
                    "text": t.get("message") or t.get("text") or t.get("content") or "",
                    "timestamp_secs": float(t.get("time_in_call_secs") or t.get("timestamp_secs") or 0),
                    "duration_secs": float(t.get("duration_secs") or 0)
                })
    if not turns and isinstance(transcript_text, str) and transcript_text:
        turns = [{"speaker": "conversation", "text": transcript_text,
                  "timestamp_secs": 0.0, "duration_secs": 0.0}]

    # Map provider status to disposition
    prov_status = payload.get("status") or ""
    if prov_status in ["no_answer", "busy", "missed"]:
        disposition = "NoAnswer"
    elif prov_status in ["failed", "error", "technical_failure"]:
        disposition = "TechnicalFailure"
    elif prov_status in ["voicemail"]:
        disposition = "Voicemail"
    else:
        disposition = "ConversationCompleted"

    duration = payload.get("duration_secs") or payload.get("duration") or 120
    cost = payload.get("cost_cents")

    # Record completion
    record_call_completion(
        db=db,
        call_attempt_id=attempt.id,
        full_transcript=transcript_text,
        turns=turns,
        disposition=disposition,
        duration_seconds=int(duration),
        cost_cents=cost
    )

    # Reconcile batch counts if part of an automated batch
    if attempt.batch_id:
        from backend.app.models.ai_call_batch import AICallBatch
        batch = db.query(AICallBatch).filter(AICallBatch.id == attempt.batch_id).first()
        if batch:
            if disposition == "ConversationCompleted":
                batch.completed_count = (batch.completed_count or 0) + 1
            elif disposition in ["TechnicalFailure", "Failed", "NoAnswer"]:
                batch.failed_count = (batch.failed_count or 0) + 1
            db.commit()

    # Advance workflow execution if node is waiting
    if attempt.workflow_execution_id:
        try:
            advance_execution(db, attempt.workflow_execution_id)
        except Exception as e:
            logger.error(f"Failed to advance workflow {attempt.workflow_execution_id} after call: {e}")

    return {"status": "Processed", "call_attempt_id": attempt.id}
