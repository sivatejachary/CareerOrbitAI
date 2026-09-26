"""
Tests for the enterprise recruitment pipeline.

Uses conftest.py fixtures:
  - db_session: test SQLite session (tables rebuilt per test)
  - test_user: Organization + User with id="user-test-123", org="org-test-123"
  - test_job: Job with skills=[Python, FastAPI], min_experience=3.0
  - client: FastAPI TestClient with auth override pointing to test_user
  - auth_headers: Bearer token for test_user

Tests:
  1. Heuristic extraction (ResumeProfile Pydantic model)
  2. Rules-based screening fallback
  3. CandidateJob model: create, unique constraint, status fields
  4. Candidates V3 API: get 200/404, download token expiry
  5. ElevenLabs webhook: HMAC sig, replay attack, invalid JSON
"""
import json
import time
import hmac
import hashlib
import pytest

from backend.app.models.candidate_job import CandidateJob
from backend.app.services.groq_extraction_service import _heuristic_profile, ResumeProfile
from backend.app.services.groq_screening_service import _rules_based_screening
from backend.app.config import settings


# ===========================================================================
# 1. Heuristic Extraction — unit tests, no fixtures required
# ===========================================================================

class TestHeuristicExtraction:
    def test_skills_from_parsed_data(self):
        profile = _heuristic_profile("some resume text", {"skills": ["python", "fastapi"], "detected_experience_years": 5.0})
        assert "python" in profile["skills"]
        assert profile["total_experience_years"] == 5.0

    def test_email_extraction(self):
        profile = _heuristic_profile("Contact: john.doe@example.com", {})
        assert profile["email"] == "john.doe@example.com"

    def test_notice_period_extraction(self):
        text = "I have a 30 days notice period."
        profile = _heuristic_profile(text, {})
        assert profile["notice_period"] is not None
        assert "30" in profile["notice_period"]

    def test_empty_text_returns_empty(self):
        profile = _heuristic_profile("", {})
        assert profile["skills"] == []
        assert profile["email"] is None

    def test_resume_profile_skills_coercion_from_string(self):
        p = ResumeProfile(skills="Python, FastAPI, Docker", total_experience_years="5+")
        assert "python" in [s.lower() for s in p.skills]
        assert p.total_experience_years == 5.0

    def test_resume_profile_defaults(self):
        p = ResumeProfile()
        assert p.skills == []
        assert p.education == []
        assert p.experience == []
        assert p.total_experience_years is None


# ===========================================================================
# 2. Rules-Based Screening — uses test_job and test_user fixtures
# ===========================================================================

class TestRulesBasedScreening:
    def test_shortlist_qualified_candidate(self, test_job):
        """test_job has min_experience=3.0 and skills=[Python, FastAPI]."""
        profile = {"total_experience_years": 5.0, "skills": ["python", "fastapi"], "location": None}
        result = _rules_based_screening(profile, test_job)
        assert result["score"] >= 75
        assert result["recommendation"] == "SHORTLISTED"
        assert len(result["criteria"]) == 4

    def test_not_matched_insufficient_experience(self, test_job):
        """test_job requires min 3yr; 1yr should NOT_MATCHED."""
        profile = {"total_experience_years": 1.0, "skills": ["python"], "location": None}
        result = _rules_based_screening(profile, test_job)
        assert result["recommendation"] == "NOT_MATCHED"

    def test_review_partial_skills(self, test_job):
        """test_job has skills=[Python, FastAPI]; provide only 1 of 2 → 50% match → borderline."""
        # test_job skills: [{name: Python}, {name: FastAPI}]
        # Provide only python → 1/2 = 50% → exactly at threshold → REVIEW or SHORTLISTED
        profile = {"total_experience_years": 5.0, "skills": ["python"], "location": None}
        result = _rules_based_screening(profile, test_job)
        # 50% match with 5yr exp → possible REVIEW (skills boundary case)
        assert result["recommendation"] in ("SHORTLISTED", "REVIEW")
        assert isinstance(result["score"], float)

    def test_no_required_skills_shortlists(self, db_session, test_user):
        """A job with no required skills should SHORTLIST even with no candidate skills."""
        from backend.app.models.job import Job
        import uuid
        job = Job(
            id=str(uuid.uuid4()),
            organization_id=test_user.organization_id,
            created_by_id=test_user.id,
            updated_by_id=test_user.id,
            job_code=f"CAR-{uuid.uuid4().hex[:8]}",
            title="Generalist",
            department="Ops",
            job_type="Full Time",
            work_mode="Remote",
            description="Open generalist role",
            status="Active"
        )
        db_session.add(job)
        db_session.flush()
        profile = {"total_experience_years": 2.0, "skills": [], "location": None}
        result = _rules_based_screening(profile, job)
        # No skills required → skill_score=40; no min_exp → exp_score=30 → ≥ 75
        assert result["score"] >= 75
        assert result["recommendation"] == "SHORTLISTED"


# ===========================================================================
# 3. CandidateJob Model — uses test_user and test_job
# ===========================================================================

class TestCandidateJobModel:
    def test_create_candidate_job(self, db_session, test_user, test_job):
        from backend.app.models.candidate import Candidate
        import uuid
        candidate = Candidate(
            id=str(uuid.uuid4()),
            organization_id=test_user.organization_id,
            candidate_code=f"CAND-{uuid.uuid4().hex[:8]}",
            full_name="Jane Smith",
            email=f"jane-{uuid.uuid4().hex[:6]}@example.com",
            revision=1
        )
        db_session.add(candidate)
        db_session.flush()

        cj = CandidateJob(
            organization_id=test_user.organization_id,
            candidate_id=candidate.id,
            job_id=test_job.id,
            source="CareerPage",
            extraction_status="QUEUED",
            screening_status="QUEUED",
            stage="APPLIED"
        )
        db_session.add(cj)
        db_session.flush()

        loaded = db_session.query(CandidateJob).filter(CandidateJob.id == cj.id).first()
        assert loaded is not None
        assert loaded.stage == "APPLIED"
        assert loaded.recommendation is None

    def test_unique_constraint_org_candidate_job(self, db_session, test_user, test_job):
        from backend.app.models.candidate import Candidate
        from sqlalchemy.exc import IntegrityError
        import uuid
        candidate = Candidate(
            id=str(uuid.uuid4()),
            organization_id=test_user.organization_id,
            candidate_code=f"CAND-{uuid.uuid4().hex[:8]}",
            full_name="Dup Candidate",
            email=f"dup-{uuid.uuid4().hex[:6]}@example.com",
            revision=1
        )
        db_session.add(candidate)
        db_session.flush()

        cj1 = CandidateJob(organization_id=test_user.organization_id,
                           candidate_id=candidate.id, job_id=test_job.id,
                           source="CareerPage", stage="APPLIED")
        db_session.add(cj1)
        db_session.flush()

        cj2 = CandidateJob(organization_id=test_user.organization_id,
                           candidate_id=candidate.id, job_id=test_job.id,
                           source="GoogleForms", stage="APPLIED")
        db_session.add(cj2)

        with pytest.raises(IntegrityError):
            db_session.flush()
        db_session.rollback()

    def test_full_status_fields(self, db_session, test_user, test_job):
        from backend.app.models.candidate import Candidate
        from datetime import datetime, timezone
        import uuid
        candidate = Candidate(
            id=str(uuid.uuid4()),
            organization_id=test_user.organization_id,
            candidate_code=f"CAND-{uuid.uuid4().hex[:8]}",
            full_name="Status Tester",
            email=f"status-{uuid.uuid4().hex[:6]}@example.com",
            revision=1
        )
        db_session.add(candidate)
        db_session.flush()

        cj = CandidateJob(
            organization_id=test_user.organization_id,
            candidate_id=candidate.id,
            job_id=test_job.id,
            source="CareerPage",
            extraction_status="SUCCEEDED",
            extracted_profile={"skills": ["python"], "total_experience_years": 4.0},
            extraction_model="heuristic_v1",
            extraction_completed_at=datetime.now(timezone.utc),
            screening_status="SUCCEEDED",
            recommendation="SHORTLISTED",
            screening_score=82.0,
            screening_rationale="Strong match",
            screening_criterion_results=[{"criterion": "Experience", "passed": True}],
            screening_model="rules_engine_v1",
            stage="SHORTLISTED"
        )
        db_session.add(cj)
        db_session.flush()

        loaded = db_session.query(CandidateJob).filter(CandidateJob.id == cj.id).first()
        assert loaded.extraction_status == "SUCCEEDED"
        assert loaded.recommendation == "SHORTLISTED"
        assert loaded.screening_score == 82.0
        assert loaded.extracted_profile["skills"] == ["python"]


# ===========================================================================
# 4. Candidates V3 API
# ===========================================================================

class TestCandidatesV3API:
    def test_list_candidate_jobs_empty(self, client):
        import uuid
        resp = client.get(f"/api/v3/candidates/{uuid.uuid4()}/jobs")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_candidate_job_404(self, client):
        import uuid
        resp = client.get(f"/api/v3/candidates/{uuid.uuid4()}/jobs/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_trigger_extract_404(self, client):
        import uuid
        resp = client.post(f"/api/v3/candidates/{uuid.uuid4()}/jobs/{uuid.uuid4()}/extract")
        assert resp.status_code == 404

    def test_trigger_screen_404(self, client):
        import uuid
        resp = client.post(f"/api/v3/candidates/{uuid.uuid4()}/jobs/{uuid.uuid4()}/screen")
        assert resp.status_code == 404

    def test_timeline_404(self, client):
        import uuid
        resp = client.get(f"/api/v3/candidates/{uuid.uuid4()}/jobs/{uuid.uuid4()}/timeline")
        assert resp.status_code == 404

    def test_job_candidates_empty(self, client):
        import uuid
        resp = client.get(f"/api/v3/jobs/{uuid.uuid4()}/candidates")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0

    def test_resume_download_invalid_token(self, client):
        import uuid
        resp = client.get(f"/api/v3/resumes/{uuid.uuid4()}/download?token=invalid")
        assert resp.status_code == 401

    def test_resume_download_expired_token(self, client):
        import uuid
        resume_id = str(uuid.uuid4())
        secret = settings.JWT_SECRET
        expired_ts = int(time.time()) - 1000
        payload = f"{resume_id}:{expired_ts}"
        sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        token = f"{expired_ts}:{sig}"
        resp = client.get(f"/api/v3/resumes/{resume_id}/download?token={token}")
        assert resp.status_code == 401


# ===========================================================================
# 5. ElevenLabs Webhook Security
# ===========================================================================

class TestElevenLabsWebhookSecurity:
    def _post(self, client, payload_dict, signature=None):
        raw = json.dumps(payload_dict).encode()
        headers = {"Content-Type": "application/json"}
        if signature:
            headers["xi-signature"] = signature
        return client.post("/api/webhooks/elevenlabs", content=raw, headers=headers)

    def test_no_secret_accepts_any(self, client):
        orig = settings.ELEVENLABS_WEBHOOK_SECRET
        settings.ELEVENLABS_WEBHOOK_SECRET = ""
        resp = self._post(client, {"type": "call_completed", "call_id": "test-xyz"})
        assert resp.status_code == 200
        settings.ELEVENLABS_WEBHOOK_SECRET = orig

    def test_missing_sig_when_secret_set(self, client):
        orig = settings.ELEVENLABS_WEBHOOK_SECRET
        settings.ELEVENLABS_WEBHOOK_SECRET = "test-secret"
        resp = self._post(client, {"type": "call_completed", "call_id": "t", "timestamp": int(time.time())})
        assert resp.status_code == 401
        settings.ELEVENLABS_WEBHOOK_SECRET = orig

    def test_invalid_sig_rejected(self, client):
        orig = settings.ELEVENLABS_WEBHOOK_SECRET
        settings.ELEVENLABS_WEBHOOK_SECRET = "test-secret"
        resp = self._post(client, {"type": "call_completed", "timestamp": int(time.time())}, "sha256=badhash")
        assert resp.status_code == 401
        settings.ELEVENLABS_WEBHOOK_SECRET = orig

    def test_valid_sig_accepted(self, client):
        secret = "test-secret"
        orig = settings.ELEVENLABS_WEBHOOK_SECRET
        settings.ELEVENLABS_WEBHOOK_SECRET = secret
        now = int(time.time())
        payload = {"type": "call_completed", "call_id": "valid", "timestamp": now}
        raw = json.dumps(payload).encode()
        sig = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        resp = client.post("/api/webhooks/elevenlabs", content=raw,
                           headers={"Content-Type": "application/json", "xi-signature": f"sha256={sig}"})
        assert resp.status_code == 200
        settings.ELEVENLABS_WEBHOOK_SECRET = orig

    def test_replay_attack_rejected(self, client):
        secret = "test-secret"
        orig_sec = settings.ELEVENLABS_WEBHOOK_SECRET
        orig_tol = settings.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
        settings.ELEVENLABS_WEBHOOK_SECRET = secret
        settings.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 60

        old_ts = int(time.time()) - 200  # 200s ago > 60s tolerance
        payload = {"type": "call_completed", "call_id": "replay", "timestamp": old_ts}
        raw = json.dumps(payload).encode()
        sig = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        resp = client.post("/api/webhooks/elevenlabs", content=raw,
                           headers={"Content-Type": "application/json", "xi-signature": f"sha256={sig}"})
        assert resp.status_code == 401

        settings.ELEVENLABS_WEBHOOK_SECRET = orig_sec
        settings.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = orig_tol

    def test_invalid_json_rejected(self, client):
        orig = settings.ELEVENLABS_WEBHOOK_SECRET
        settings.ELEVENLABS_WEBHOOK_SECRET = ""
        resp = client.post("/api/webhooks/elevenlabs", content=b"not json!",
                           headers={"Content-Type": "application/json"})
        assert resp.status_code == 400
        settings.ELEVENLABS_WEBHOOK_SECRET = orig
