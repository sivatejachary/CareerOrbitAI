import pytest
from unittest.mock import patch, MagicMock
from backend.app.services.elevenlabs_service import (
    check_elevenlabs_readiness,
    verify_pre_call_authorization,
    initiate_elevenlabs_outbound_call,
    extract_evaluation_from_transcript,
    record_call_completion
)
from backend.app.models.candidate import Candidate
from backend.app.models.candidate_contact_preference import CandidateContactPreference
from backend.app.models.call_attempt import CallAttempt

def test_elevenlabs_readiness_unconfigured(monkeypatch):
    monkeypatch.setattr("backend.app.config.settings.ELEVENLABS_API_KEY", "")
    res = check_elevenlabs_readiness()
    assert res["ready"] is False
    assert "BLOCKED" in res["status"]

def test_pre_call_auth_blocks_stop_contact(db_session, test_user, test_job):
    cand = Candidate(
        organization_id=test_user.organization_id,
        candidate_code="CAND-TEST-001",
        full_name="Stop Contact Candidate",
        email="stop@example.com",
        phone="+919876543210"
    )
    db_session.add(cand)
    db_session.flush()

    pref = CandidateContactPreference(
        organization_id=test_user.organization_id,
        candidate_id=cand.id,
        phone_number=cand.phone,
        stop_contact=True,
        do_not_call=True
    )
    db_session.add(pref)
    db_session.commit()

    authorized, reason = verify_pre_call_authorization(db_session, test_user.organization_id, cand, test_job)
    assert authorized is False
    assert "Stop Contact" in reason

def test_pre_call_auth_blocks_invalid_phone(db_session, test_user, test_job):
    cand = Candidate(
        organization_id=test_user.organization_id,
        candidate_code="CAND-TEST-002",
        full_name="Invalid Phone Person",
        email="phone@example.com",
        phone="9876543210"  # Missing E.164 + prefix
    )
    db_session.add(cand)
    db_session.commit()

    authorized, reason = verify_pre_call_authorization(db_session, test_user.organization_id, cand, test_job)
    assert authorized is False
    assert "E.164" in reason

def test_pre_call_auth_concurrency_lock(db_session, test_user, test_job):
    cand = Candidate(
        organization_id=test_user.organization_id,
        candidate_code="CAND-TEST-003",
        full_name="Active Call Person",
        email="active@example.com",
        phone="+919999988888"
    )
    db_session.add(cand)
    db_session.flush()

    # Existing active call in progress
    active_call = CallAttempt(
        organization_id=test_user.organization_id,
        candidate_id=cand.id,
        job_id=test_job.id,
        phone_number=cand.phone,
        idempotency_key="active_call_key_1",
        operation_state="Accepted",
        connection_state="Connected"
    )
    db_session.add(active_call)
    db_session.commit()

    authorized, reason = verify_pre_call_authorization(db_session, test_user.organization_id, cand, test_job)
    assert authorized is False
    assert "active call attempt" in reason.lower()

def test_extract_evaluation_shortlist():
    transcript = (
        "Agent: Hi John, are you still interested in the Python Engineer role? "
        "Candidate: Yes I am definitely interested and actively looking. "
        "Agent: Great, what is your official notice period? "
        "Candidate: I have a 30 days notice period at my current firm. "
        "Agent: When are you available for interviews? "
        "Candidate: I am free on Thursday afternoon."
    )
    turns = [
        {"speaker": "agent", "text": "Hi John..."},
        {"speaker": "user", "text": "Yes I am definitely interested..."},
        {"speaker": "agent", "text": "Great, what is your notice period?"},
        {"speaker": "user", "text": "I have a 30 days notice period"},
        {"speaker": "agent", "text": "When are you available?"},
        {"speaker": "user", "text": "I am free on Thursday afternoon."}
    ]
    res = extract_evaluation_from_transcript(transcript, turns)
    assert res["candidate_statements"]["interest"] == "EXPLICIT_YES"
    assert "30 days" in res["candidate_statements"]["notice_period"].lower()
    assert "Thursday" in res["candidate_statements"]["availability"]
    assert res["recommendation"] == "SHORTLIST"
    assert len(res["extracted_facts"]) >= 2

def test_extract_evaluation_stop_contact_trigger():
    transcript = (
        "Agent: Hi, calling about the Software Engineer position. "
        "Candidate: Please stop calling me and remove my number from your database."
    )
    turns = [
        {"speaker": "agent", "text": "Hi, calling..."},
        {"speaker": "user", "text": "Please stop calling me and remove my number"}
    ]
    res = extract_evaluation_from_transcript(transcript, turns)
    assert res["candidate_statements"]["stop_contact_requested"] is True
    assert res["recommendation"] == "NOT_MATCHED"
