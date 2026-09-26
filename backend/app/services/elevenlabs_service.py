import os
import re
import json
import logging
from datetime import datetime, time, timezone
from typing import Dict, Any, Optional, List, Tuple
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.config import settings
from backend.app.models.call_attempt import CallAttempt
from backend.app.models.call_transcript import CallTranscript
from backend.app.models.call_evaluation import CallEvaluation
from backend.app.models.candidate_contact_preference import CandidateContactPreference
from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.node_execution import NodeExecution

logger = logging.getLogger("careerorbit.elevenlabs")

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

def check_elevenlabs_readiness() -> Dict[str, Any]:
    """Inspects whether official ElevenLabs API credentials and phone routes are configured."""
    has_key = bool(settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_API_KEY.strip())
    has_agent = bool(settings.ELEVENLABS_AGENT_ID and settings.ELEVENLABS_AGENT_ID.strip())
    has_phone = bool(settings.ELEVENLABS_PHONE_NUMBER_ID and settings.ELEVENLABS_PHONE_NUMBER_ID.strip())

    if not has_key:
        return {
            "ready": False,
            "status": "BLOCKED — credentials/configuration missing",
            "message": "ELEVENLABS_API_KEY is not configured in backend environment."
        }
    if not has_agent:
        return {
            "ready": False,
            "status": "BLOCKED — agent missing",
            "message": "ELEVENLABS_AGENT_ID is not configured in backend environment."
        }
    return {
        "ready": True,
        "status": "Configured",
        "has_phone_number": has_phone,
        "agent_id": settings.ELEVENLABS_AGENT_ID
    }

def verify_pre_call_authorization(
    db: Session,
    organization_id: str,
    candidate: Candidate,
    job: Job,
    workflow_execution: Optional[WorkflowExecution] = None
) -> Tuple[bool, Optional[str]]:
    """Strict pre-call verification per Section 19."""
    # 1. Contact preference check
    pref = db.query(CandidateContactPreference).filter(
        CandidateContactPreference.organization_id == organization_id,
        CandidateContactPreference.phone_number == candidate.phone
    ).first()

    if pref:
        if pref.stop_contact:
            return False, "Candidate has explicitly requested Stop Contact. Automated calls are blocked."
        if pref.do_not_call:
            return False, "Candidate has Do-Not-Call preference active."
        if not pref.consent_given:
            return False, "Candidate contact consent is revoked or missing."

    # 2. Execution status check
    if workflow_execution:
        if workflow_execution.status in ["Paused", "Canceled", "Blocked", "Failed"]:
            return False, f"Workflow execution is {workflow_execution.status}. New outbound calls are inhibited."

    # 3. Valid E.164 phone check
    if not candidate.phone or not candidate.phone.startswith("+"):
        return False, f"Candidate phone number '{candidate.phone}' is not a valid E.164 international format."

    # 4. Enforce One Active Outbound Attempt per Organization & Phone Number
    active_attempt = db.query(CallAttempt).filter(
        CallAttempt.organization_id == organization_id,
        CallAttempt.phone_number == candidate.phone,
        CallAttempt.operation_state.in_(["Initiating", "Accepted"]),
        CallAttempt.connection_state.in_(["Ringing", "Connected"])
    ).first()

    if active_attempt:
        return False, f"An active call attempt ({active_attempt.id}) is currently in progress for this phone number."

    return True, None

def initiate_elevenlabs_outbound_call(
    db: Session,
    organization_id: str,
    candidate_id: str,
    job_id: str,
    phone_number: str,
    node_execution_id: Optional[str] = None,
    workflow_execution_id: Optional[str] = None,
    custom_first_message: Optional[str] = None,
    dynamic_variables: Optional[Dict[str, Any]] = None,
    communication_plan_id: Optional[str] = None
) -> CallAttempt:
    """Initiates an outbound ElevenLabs call attempt or records blocked/failed attempt honestly."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    job = db.query(Job).filter(Job.id == job_id).first()
    wf_exec = db.query(WorkflowExecution).filter(WorkflowExecution.id == workflow_execution_id).first() if workflow_execution_id else None

    # Pre-call verification
    authorized, block_reason = verify_pre_call_authorization(db, organization_id, candidate, job, wf_exec)
    if not authorized:
        idempotency_key = f"call_blocked_{candidate_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        attempt = CallAttempt(
            organization_id=organization_id,
            workflow_execution_id=workflow_execution_id,
            node_execution_id=node_execution_id,
            candidate_id=candidate_id,
            job_id=job_id,
            phone_number=candidate.phone or phone_number,
            idempotency_key=idempotency_key,
            operation_state="Failed",
            connection_state="Unknown",
            disposition="TechnicalFailure",
            processing_state="Failed",
            communication_plan_id=communication_plan_id,
            error_details=f"Pre-call authorization failed: {block_reason}"
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    # Attempt count
    prior_attempts = db.query(CallAttempt).filter(
        CallAttempt.workflow_execution_id == workflow_execution_id,
        CallAttempt.candidate_id == candidate_id
    ).count()
    attempt_number = prior_attempts + 1

    idempotency_key = f"call_{workflow_execution_id or 'manual'}_{candidate_id}_{attempt_number}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"

    # Build dynamic variables
    company_name = job.organization.name if job and job.organization else "CareerOrbitAI"
    job_title = job.title if job else "Open Position"
    candidate_name = candidate.full_name if candidate else "Applicant"

    variables = {
        "candidate_name": candidate_name,
        "company_name": company_name,
        "job_title": job_title,
        "approved_job_details": f"{job_title} ({job.department}, {job.work_mode}) - Skills: {', '.join([s.get('name', '') for s in (job.skills or []) if isinstance(s, dict)])}"
    }
    if dynamic_variables:
        variables.update(dynamic_variables)

    readiness = check_elevenlabs_readiness()
    if not readiness["ready"]:
        # Record honest blocked state
        attempt = CallAttempt(
            organization_id=organization_id,
            workflow_execution_id=workflow_execution_id,
            node_execution_id=node_execution_id,
            candidate_id=candidate_id,
            job_id=job_id,
            phone_number=candidate.phone,
            attempt_number=attempt_number,
            idempotency_key=idempotency_key,
            operation_state="Failed",
            connection_state="Unknown",
            disposition="TechnicalFailure",
            processing_state="Failed",
            communication_plan_id=communication_plan_id,
            error_details=f"ElevenLabs Integration is {readiness['status']}: {readiness['message']}"
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    # Live Call Initiation via ElevenLabs Outbound API
    headers = {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }

    # Request payload per ElevenLabs Conversational AI Outbound Calling API
    payload = {
        "agent_id": settings.ELEVENLABS_AGENT_ID,
        "to_number": candidate.phone,
        "from_phone_number_id": settings.ELEVENLABS_PHONE_NUMBER_ID or None,
        "dynamic_variables": variables
    }

    attempt = CallAttempt(
        organization_id=organization_id,
        workflow_execution_id=workflow_execution_id,
        node_execution_id=node_execution_id,
        candidate_id=candidate_id,
        job_id=job_id,
        phone_number=candidate.phone,
        attempt_number=attempt_number,
        idempotency_key=idempotency_key,
        operation_state="Initiating",
        connection_state="Unknown",
        processing_state="AwaitingTranscript",
        communication_plan_id=communication_plan_id,
        scheduled_at=datetime.now(timezone.utc),
        initiated_at=datetime.now(timezone.utc)
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    try:
        # ElevenLabs Conversational AI outbound calling endpoint
        url = f"{ELEVENLABS_BASE_URL}/convai/conversations/outbound-call"
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, headers=headers, json=payload)

        if resp.status_code in [200, 201]:
            data = resp.json()
            attempt.provider_call_id = data.get("call_id") or data.get("id")
            attempt.provider_conversation_id = data.get("conversation_id")
            attempt.operation_state = "Accepted"
            attempt.connection_state = "Ringing"
        else:
            attempt.operation_state = "Failed"
            attempt.disposition = "TechnicalFailure"
            attempt.error_details = f"ElevenLabs API Error ({resp.status_code}): {resp.text}"

    except Exception as e:
        logger.error(f"Error calling ElevenLabs API: {str(e)}")
        attempt.operation_state = "InitiationUnknown"
        attempt.error_details = f"Network/Provider exception during initiation: {str(e)}"

    db.commit()
    db.refresh(attempt)
    return attempt

def extract_evaluation_from_transcript(transcript_text: str, turns: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyzes real conversation transcript turns and extracts factual statements per Section 23."""
    lower_text = transcript_text.lower()

    # 1. Candidate Interest
    interest = "UNCLEAR"
    if any(phrase in lower_text for phrase in ["yes i am interested", "definitely interested", "actively looking", "still interested", "sounds good", "would love to"]):
        interest = "EXPLICIT_YES"
    elif any(phrase in lower_text for phrase in ["not interested", "already got an offer", "no longer looking", "don't call"]):
        interest = "NO"

    # 2. Stop contact request
    stop_contact_requested = any(phrase in lower_text for phrase in ["stop calling", "remove my number", "do not call again", "stop contact"])

    # 3. Notice Period
    notice_period = "Not stated"
    m_notice = re.search(r"(\d+)\s*(?:days?|weeks?|months?)\s*notice", lower_text)
    if m_notice:
        notice_period = m_notice.group(0)
    elif "immediate" in lower_text or "available immediately" in lower_text:
        notice_period = "Immediate"

    # 4. Availability
    availability = "Not stated"
    m_avail = re.search(r"(?:available|free|prefer)\s*(?:on|at)?\s*([a-zA-Z]+day|\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+|\d{1,2}\s*(?:am|pm))", lower_text)
    if m_avail:
        availability = m_avail.group(1).title()

    # 5. Compensation Expectation
    ctc = "Not stated"
    m_ctc = re.search(r"(\d+(?:\.\d+)?)\s*(?:lakhs?|lpa|k|thousand|inr)", lower_text)
    if m_ctc:
        ctc = m_ctc.group(0).upper()

    facts = []
    if notice_period != "Not stated":
        facts.append({"key": "notice_period", "value": notice_period, "unit": "time", "excerpt": notice_period, "confidence": 0.90})
    if availability != "Not stated":
        facts.append({"key": "interview_availability", "value": availability, "unit": "date/time", "excerpt": availability, "confidence": 0.85})
    if ctc != "Not stated":
        facts.append({"key": "ctc_expectation", "value": ctc, "unit": "currency", "excerpt": ctc, "confidence": 0.85})

    # Coverage mapping
    coverage = {
        "role_interest": "ANSWERED" if interest != "UNCLEAR" else "UNCLEAR",
        "notice_period": "ANSWERED" if notice_period != "Not stated" else "NOT_ASKED",
        "interview_availability": "ANSWERED" if availability != "Not stated" else "NOT_ASKED"
    }

    # Recommendation
    if stop_contact_requested or interest == "NO":
        recommendation = "NOT_MATCHED"
        rationale = "Candidate explicitly expressed no interest or requested stop contact."
    elif interest == "EXPLICIT_YES" and notice_period != "Not stated":
        recommendation = "SHORTLIST"
        rationale = f"Candidate confirmed role interest and verified notice period ({notice_period})."
    else:
        recommendation = "REVIEW"
        rationale = "Conversation completed with partial or unclear availability facts. Requires recruiter review."

    return {
        "candidate_statements": {
            "interest": interest,
            "notice_period": notice_period,
            "ctc_expectation": ctc,
            "availability": availability,
            "stop_contact_requested": stop_contact_requested
        },
        "extracted_facts": facts,
        "question_coverage": coverage,
        "recommendation": recommendation,
        "rationale": rationale
    }

def record_call_completion(
    db: Session,
    call_attempt_id: str,
    full_transcript: str,
    turns: List[Dict[str, Any]],
    disposition: str = "ConversationCompleted",
    duration_seconds: int = 180,
    cost_cents: Optional[int] = None
) -> CallAttempt:
    """Saves transcript, turns, structured facts, and updates call attempt."""
    attempt = db.query(CallAttempt).filter(CallAttempt.id == call_attempt_id).first()
    if not attempt:
        raise ValueError(f"Call attempt '{call_attempt_id}' not found")

    attempt.connection_state = "Ended"
    attempt.disposition = disposition
    attempt.duration_seconds = duration_seconds
    attempt.cost_cents = cost_cents
    attempt.ended_at = datetime.now(timezone.utc)

    # 1. Transcript
    transcript = db.query(CallTranscript).filter(CallTranscript.call_attempt_id == call_attempt_id).first()
    if not transcript:
        transcript = CallTranscript(
            call_attempt_id=call_attempt_id,
            full_transcript_text=full_transcript,
            turns=turns
        )
        db.add(transcript)
    else:
        transcript.full_transcript_text = full_transcript
        transcript.turns = turns

    # 2. Fact Extraction & Objective Evaluation
    eval_data = extract_evaluation_from_transcript(full_transcript, turns)
    evaluation = db.query(CallEvaluation).filter(CallEvaluation.call_attempt_id == call_attempt_id).first()
    if not evaluation:
        evaluation = CallEvaluation(
            call_attempt_id=call_attempt_id,
            candidate_statements=eval_data["candidate_statements"],
            extracted_facts=eval_data["extracted_facts"],
            question_coverage=eval_data["question_coverage"],
            recommendation=eval_data["recommendation"],
            rationale=eval_data["rationale"]
        )
        db.add(evaluation)
    else:
        evaluation.candidate_statements = eval_data["candidate_statements"]
        evaluation.extracted_facts = eval_data["extracted_facts"]
        evaluation.question_coverage = eval_data["question_coverage"]
        evaluation.recommendation = eval_data["recommendation"]
        evaluation.rationale = eval_data["rationale"]

    attempt.processing_state = "Ready"

    # If candidate requested stop contact, update contact preference table immediately
    if eval_data["candidate_statements"].get("stop_contact_requested"):
        pref = db.query(CandidateContactPreference).filter(
            CandidateContactPreference.organization_id == attempt.organization_id,
            CandidateContactPreference.phone_number == attempt.phone_number
        ).first()
        if not pref:
            pref = CandidateContactPreference(
                organization_id=attempt.organization_id,
                candidate_id=attempt.candidate_id,
                phone_number=attempt.phone_number,
                stop_contact=True,
                do_not_call=True,
                notes="Candidate requested stop contact during automated phone screen."
            )
            db.add(pref)
        else:
            pref.stop_contact = True
            pref.do_not_call = True

    db.commit()
    db.refresh(attempt)
    return attempt
