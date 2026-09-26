import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.models import (
    User, Organization, Job, Candidate, CandidateJob,
    CallAttempt, CandidateContactPreference, AICallBatch
)
from backend.app.services.batch_calling_service import (
    check_candidate_eligibility,
    get_eligible_candidates,
    build_dynamic_variables,
    create_batch,
    pause_batch,
    resume_batch,
    cancel_batch,
    REASON_NOT_SHORTLISTED,
    REASON_NO_PHONE,
    REASON_INVALID_PHONE,
    REASON_DO_NOT_CALL,
    REASON_ALREADY_ACTIVE,
    REASON_MAX_ATTEMPTS,
    REASON_CALL_COMPLETED
)

# Test in-memory DB setup for unit tests
@pytest.fixture
def unit_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()

    org = Organization(id="test-org", name="Test Corp", slug="test-corp")
    user = User(
        id="test-user",
        organization_id="test-org",
        email="recruiter@testcorp.com",
        full_name="Recruiter Jane",
        hashed_password="hashed"
    )
    job = Job(
        id="test-job",
        organization_id="test-org",
        created_by_id="test-user",
        updated_by_id="test-user",
        job_code="JOB-TEST-01",
        title="AI Engineer",
        department="Engineering",
        job_type="Full Time",
        work_mode="Remote",
        description="Build LLM agents",
        skills=[{"name": "Python"}, {"name": "PyTorch"}]
    )
    session.add_all([org, user, job])
    session.commit()

    yield session
    session.close()


def test_eligibility_all_criteria(unit_db):
    # Candidate 1: Shortlisted, valid phone -> ELIGIBLE
    cand1 = Candidate(
        id="c1",
        organization_id="test-org",
        candidate_code="CAND-01",
        full_name="Alice Smith",
        email="alice@test.com",
        phone="+14155552671",
        skills=["Python"]
    )
    cj1 = CandidateJob(
        id="cj1",
        organization_id="test-org",
        candidate_id="c1",
        job_id="test-job",
        recommendation="SHORTLISTED",
        screening_score=92.0,
        stage="SHORTLISTED"
    )

    # Candidate 2: Not shortlisted -> INELIGIBLE
    cand2 = Candidate(
        id="c2",
        organization_id="test-org",
        candidate_code="CAND-02",
        full_name="Bob Jones",
        email="bob@test.com",
        phone="+14155552672"
    )
    cj2 = CandidateJob(
        id="cj2",
        organization_id="test-org",
        candidate_id="c2",
        job_id="test-job",
        recommendation="NOT_MATCHED",
        screening_score=45.0,
        stage="SCREENING"
    )

    # Candidate 3: Shortlisted but NO PHONE -> INELIGIBLE
    cand3 = Candidate(
        id="c3",
        organization_id="test-org",
        candidate_code="CAND-03",
        full_name="Charlie Brown",
        email="charlie@test.com",
        phone=None
    )
    cj3 = CandidateJob(
        id="cj3",
        organization_id="test-org",
        candidate_id="c3",
        job_id="test-job",
        recommendation="SHORTLISTED",
        screening_score=88.0,
        stage="SHORTLISTED"
    )

    # Candidate 4: Shortlisted but INVALID PHONE format (not E.164)
    cand4 = Candidate(
        id="c4",
        organization_id="test-org",
        candidate_code="CAND-04",
        full_name="Dana Scully",
        email="dana@test.com",
        phone="4155552674"
    )
    cj4 = CandidateJob(
        id="cj4",
        organization_id="test-org",
        candidate_id="c4",
        job_id="test-job",
        recommendation="SHORTLISTED",
        screening_score=90.0,
        stage="SHORTLISTED"
    )

    # Candidate 5: Shortlisted but DO NOT CALL preference active
    cand5 = Candidate(
        id="c5",
        organization_id="test-org",
        candidate_code="CAND-05",
        full_name="Eve Adams",
        email="eve@test.com",
        phone="+14155552675"
    )
    cj5 = CandidateJob(
        id="cj5",
        organization_id="test-org",
        candidate_id="c5",
        job_id="test-job",
        recommendation="SHORTLISTED",
        screening_score=95.0,
        stage="SHORTLISTED"
    )
    pref5 = CandidateContactPreference(
        organization_id="test-org",
        candidate_id="c5",
        phone_number="+14155552675",
        do_not_call=True
    )

    unit_db.add_all([cand1, cj1, cand2, cj2, cand3, cj3, cand4, cj4, cand5, cj5, pref5])
    unit_db.commit()

    ok1, reason1 = check_candidate_eligibility(unit_db, "test-org", cj1)
    assert ok1 is True
    assert reason1 == "ELIGIBLE"

    ok2, reason2 = check_candidate_eligibility(unit_db, "test-org", cj2)
    assert ok2 is False
    assert reason2 == REASON_NOT_SHORTLISTED

    ok3, reason3 = check_candidate_eligibility(unit_db, "test-org", cj3)
    assert ok3 is False
    assert reason3 == REASON_NO_PHONE

    ok4, reason4 = check_candidate_eligibility(unit_db, "test-org", cj4)
    assert ok4 is False
    assert reason4 == REASON_INVALID_PHONE

    ok5, reason5 = check_candidate_eligibility(unit_db, "test-org", cj5)
    assert ok5 is False
    assert reason5 == REASON_DO_NOT_CALL


def test_eligibility_completed_and_max_attempts(unit_db):
    cand = Candidate(
        id="c6",
        organization_id="test-org",
        candidate_code="CAND-06",
        full_name="Frank Miller",
        email="frank@test.com",
        phone="+14155552676"
    )
    cj = CandidateJob(
        id="cj6",
        organization_id="test-org",
        candidate_id="c6",
        job_id="test-job",
        recommendation="SHORTLISTED",
        screening_score=85.0
    )
    unit_db.add_all([cand, cj])
    unit_db.commit()

    # Eligible initially
    ok, _ = check_candidate_eligibility(unit_db, "test-org", cj, max_attempts=2)
    assert ok is True

    # After 1 failed attempt, still eligible (attempts < 2)
    attempt1 = CallAttempt(
        id="att1",
        organization_id="test-org",
        candidate_id="c6",
        job_id="test-job",
        phone_number="+14155552676",
        attempt_number=1,
        idempotency_key="key1",
        operation_state="Failed",
        connection_state="Ended",
        disposition="TechnicalFailure"
    )
    unit_db.add(attempt1)
    unit_db.commit()

    ok, reason = check_candidate_eligibility(unit_db, "test-org", cj, max_attempts=2)
    assert ok is True

    # After 2nd attempt, max reached
    attempt2 = CallAttempt(
        id="att2",
        organization_id="test-org",
        candidate_id="c6",
        job_id="test-job",
        phone_number="+14155552676",
        attempt_number=2,
        idempotency_key="key2",
        operation_state="Failed",
        connection_state="Ended",
        disposition="NoAnswer"
    )
    unit_db.add(attempt2)
    unit_db.commit()

    ok, reason = check_candidate_eligibility(unit_db, "test-org", cj, max_attempts=2)
    assert ok is False
    assert reason == REASON_MAX_ATTEMPTS


def test_eligibility_active_call_in_progress(unit_db):
    cand = Candidate(
        id="c7",
        organization_id="test-org",
        candidate_code="CAND-07",
        full_name="Grace Hopper",
        email="grace@test.com",
        phone="+14155552677"
    )
    cj = CandidateJob(
        id="cj7",
        organization_id="test-org",
        candidate_id="c7",
        job_id="test-job",
        recommendation="SHORTLISTED"
    )
    active_attempt = CallAttempt(
        id="att-active",
        organization_id="test-org",
        candidate_id="c7",
        job_id="test-job",
        phone_number="+14155552677",
        attempt_number=1,
        idempotency_key="key-active",
        operation_state="Accepted",
        connection_state="Connected"
    )
    unit_db.add_all([cand, cj, active_attempt])
    unit_db.commit()

    ok, reason = check_candidate_eligibility(unit_db, "test-org", cj)
    assert ok is False
    assert reason == REASON_ALREADY_ACTIVE


def test_build_dynamic_variables(unit_db):
    cand = Candidate(
        id="c8",
        organization_id="test-org",
        candidate_code="CAND-08",
        full_name="Hank Pym",
        email="hank@test.com",
        phone="+14155552678",
        total_experience=5.5,
        skills=["Python", "FastAPI"],
        current_company="Pym Tech",
        notice_period="30 days",
        current_location="San Francisco"
    )
    job = unit_db.query(Job).filter(Job.id == "test-job").first()
    cj = CandidateJob(
        id="cj8",
        organization_id="test-org",
        candidate_id="c8",
        job_id="test-job",
        recommendation="SHORTLISTED",
        screening_score=89.5,
        extracted_profile={
            "summary": "Experienced Python engineer with focus on AI.",
            "total_experience": 5.5,
            "skills": ["Python", "FastAPI", "PyTorch"]
        }
    )

    vars_dict = build_dynamic_variables(cand, job, cj)
    assert vars_dict["candidate_name"] == "Hank Pym"
    assert vars_dict["job_title"] == "AI Engineer"
    assert "Python" in vars_dict["candidate_skills"]
    assert vars_dict["screening_score"] == "89.5"
    assert "Pym Tech" in vars_dict["current_company"]
    assert "30 days" in vars_dict["notice_period"]


def test_batch_lifecycle_pause_resume_cancel(unit_db):
    batch = AICallBatch(
        id="batch-01",
        organization_id="test-org",
        job_id="test-job",
        started_by_id="test-user",
        status="RUNNING",
        total_candidates=5
    )
    unit_db.add(batch)
    unit_db.commit()

    # Pause
    paused = pause_batch(unit_db, batch)
    assert paused.status == "PAUSED"
    assert paused.paused_at is not None

    # Resume
    resumed = resume_batch(unit_db, paused)
    assert resumed.status == "RUNNING"
    assert resumed.paused_at is None

    # Cancel
    cancelled = cancel_batch(unit_db, resumed)
    assert cancelled.status == "CANCELLED"
    assert cancelled.cancelled_at is not None


def test_get_eligible_candidates_summary(unit_db):
    cand = Candidate(
        id="c9",
        organization_id="test-org",
        candidate_code="CAND-09",
        full_name="Iris West",
        email="iris@test.com",
        phone="+14155552679"
    )
    cj = CandidateJob(
        id="cj9",
        organization_id="test-org",
        candidate_id="c9",
        job_id="test-job",
        recommendation="SHORTLISTED",
        screening_score=94.0,
        stage="SHORTLISTED"
    )
    unit_db.add_all([cand, cj])
    unit_db.commit()

    res = get_eligible_candidates(unit_db, "test-org", "test-job")
    assert res["job_id"] == "test-job"
    assert res["total_applications"] >= 1
    assert res["shortlisted_count"] >= 1
    assert res["eligible_count"] >= 1
    assert len(res["eligible_candidates"]) >= 1
    assert res["eligible_candidates"][0]["candidate_name"] == "Iris West"


def test_api_eligible_candidates_and_batch_flow(client, db_session, test_user, test_job):
    # Eagerly access test_user attributes to prevent cross-thread SQLite lazy loading
    org_id = str(test_user.organization_id)
    user_id = str(test_user.id)
    job_id = str(test_job.id)
    db_session.commit()

    # Setup candidate & candidate_job in the test database
    cand = Candidate(
        id="cand-api-1",
        organization_id=org_id,
        candidate_code="CAND-API-01",
        full_name="Deepa Patel",
        email="deepa@example.com",
        phone="+919876543211",
        skills=["Python", "FastAPI"]
    )
    cj = CandidateJob(
        id="cj-api-1",
        organization_id=org_id,
        candidate_id=cand.id,
        job_id=job_id,
        recommendation="SHORTLISTED",
        screening_score=91.0,
        stage="SHORTLISTED"
    )
    db_session.add_all([cand, cj])
    db_session.commit()

    # 1. GET /api/ai-calling/eligible-candidates/{job_id}
    res = client.get(f"/api/ai-calling/eligible-candidates/{test_job.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["job_id"] == test_job.id
    assert data["eligible_count"] == 1
    assert data["eligible_candidates"][0]["candidate_name"] == "Deepa Patel"

    # 2. POST /api/ai-calling/start
    start_res = client.post("/api/ai-calling/start", json={
        "job_id": test_job.id,
        "max_concurrent_calls": 2,
        "call_delay_seconds": 1,
        "max_attempts_per_candidate": 2
    })
    assert start_res.status_code == 201
    batch_data = start_res.json()
    assert batch_data["job_id"] == test_job.id
    assert batch_data["status"] in ["QUEUED", "RUNNING", "COMPLETED", "FAILED"]
    batch_id = batch_data["id"]

    # 3. GET /api/ai-calling/batches/{batch_id}
    b_res = client.get(f"/api/ai-calling/batches/{batch_id}")
    assert b_res.status_code == 200
    assert b_res.json()["id"] == batch_id

    # 4. GET /api/ai-calling/batches
    list_res = client.get(f"/api/ai-calling/batches?job_id={test_job.id}")
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 5. GET /api/ai-calling/candidates/{candidate_id}
    cand_calls_res = client.get(f"/api/ai-calling/candidates/{cand.id}")
    assert cand_calls_res.status_code == 200
    assert "items" in cand_calls_res.json()

