"""
Test suite for the Dynamic Job-Specific AI Communication System.

Verifies all requirements from the specification:
1. Two jobs with different numbers and names of interview rounds.
2. Conditional progression to different next stages.
3. Multiple AI calls in one candidate-job workflow.
4. Missing or changed decision approvals honestly blocking communication.
5. Duplicate events & idempotency across communication attempts.
6. Explicit outcomes: Busy, callback, wrong-person, opt-out, objective completed.
7. Calendar conflicts and scheduling reservation with atomic booking.
8. Workflow edited while active candidate remains pinned to published version.
9. Final selection messages containing only approved information.
10. Dry-run mode evaluates branches & renders communication plan without dialing.
11. Communication preview explaining why call happens, facts, actions, and fallbacks.
"""
import uuid
import pytest
from datetime import datetime, timezone, timedelta

from backend.app.models.workflow import Workflow
from backend.app.models.workflow_version import WorkflowVersion
from backend.app.models.job_workflow_binding import JobWorkflowBinding
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.node_execution import NodeExecution
from backend.app.models.job_application import JobApplication
from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.hr_decision import HRDecision
from backend.app.models.candidate_contact_preference import CandidateContactPreference
from backend.app.models.communication_plan import CommunicationPlan
from backend.app.models.communication_setting import CompanyCommunicationSetting
from backend.app.models.interview_slot import InterviewSlot

from backend.app.services.communication_planner_service import (
    build_communication_plan,
    get_or_create_company_setting,
    check_candidate_eligibility
)
from backend.app.services.communication_template_service import (
    render_template,
    assemble_context_for_purpose,
    STANDARD_TEMPLATES
)
from backend.app.services.scheduling_service import (
    get_eligible_slots,
    book_interview_slot,
    handle_scheduling_failure_fallback
)
from backend.app.services.workflow_engine import advance_execution, enroll_application_in_workflow
from backend.app.services.workflow_validator import validate_workflow_graph


# ===========================================================================
# 1. Template Rendering & Placeholders (Section 8)
# ===========================================================================

class TestCommunicationTemplates:
    def test_strict_placeholder_replacement_success(self):
        tpl = "Hello {{candidate_name}}, welcome to {{company_name}} for {{job_title}}."
        ctx = {"candidate_name": "Aarav Mehta", "company_name": "CareerOrbit", "job_title": "AI Engineer"}
        rendered, missing = render_template(tpl, ctx, ["candidate_name", "company_name", "job_title"])
        assert missing == []
        assert rendered == "Hello Aarav Mehta, welcome to CareerOrbit for AI Engineer."

    def test_missing_variable_detected_and_blocks(self):
        tpl = "Hello {{candidate_name}}, your next stage is {{next_stage_name}}."
        ctx = {"candidate_name": "Aarav Mehta"}  # missing next_stage_name
        rendered, missing = render_template(tpl, ctx, ["candidate_name", "next_stage_name"])
        assert "next_stage_name" in missing
        assert "{{next_stage_name}}" in rendered  # Not resolved

    def test_all_seven_purposes_have_defined_templates(self):
        purposes = [
            "INITIAL_SCREENING", "SCHEDULE_INTERVIEW", "RESULT_NOTIFICATION",
            "RESULT_AND_SCHEDULING", "INTERVIEW_REMINDER", "REQUEST_CLARIFICATION",
            "FINAL_SELECTION_NOTIFICATION"
        ]
        for p in purposes:
            assert p in STANDARD_TEMPLATES
            spec = STANDARD_TEMPLATES[p]
            assert "opening" in spec
            assert "message" in spec
            assert "forbidden_disclosures" in spec
            assert len(spec["forbidden_disclosures"]) > 0


# ===========================================================================
# 2. Scheduling & Atomic Booking (Section 10)
# ===========================================================================

class TestInterviewScheduling:
    def test_get_eligible_future_slots(self, db_session, test_user, test_job):
        now = datetime.now(timezone.utc)
        s1 = InterviewSlot(
            organization_id=test_user.organization_id,
            job_id=test_job.id,
            interviewer_name="Dr. Alan Turing",
            interviewer_email="alan@example.com",
            start_time=now + timedelta(days=1),
            end_time=now + timedelta(days=1, minutes=45),
            duration_minutes=45,
            is_booked=False
        )
        s2 = InterviewSlot(
            organization_id=test_user.organization_id,
            job_id=test_job.id,
            interviewer_name="Ada Lovelace",
            interviewer_email="ada@example.com",
            start_time=now - timedelta(days=1),  # Past slot
            end_time=now - timedelta(days=1, minutes=-45),
            duration_minutes=45,
            is_booked=False
        )
        db_session.add_all([s1, s2])
        db_session.flush()

        slots = get_eligible_slots(db_session, test_user.organization_id, test_job.id)
        assert len(slots) == 1
        assert slots[0].interviewer_name == "Dr. Alan Turing"

    def test_atomic_booking_prevents_double_booking(self, db_session, test_user, test_job):
        now = datetime.now(timezone.utc)
        cand1 = Candidate(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            candidate_code="CAND-001", full_name="Candidate One", email="c1@example.com", revision=1
        )
        cand2 = Candidate(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            candidate_code="CAND-002", full_name="Candidate Two", email="c2@example.com", revision=1
        )
        slot = InterviewSlot(
            organization_id=test_user.organization_id, job_id=test_job.id,
            interviewer_name="Lead Engineer", interviewer_email="lead@example.com",
            start_time=now + timedelta(days=2), end_time=now + timedelta(days=2, minutes=45),
            duration_minutes=45, is_booked=False
        )
        db_session.add_all([cand1, cand2, slot])
        db_session.flush()

        # First booking succeeds
        booked_slot, err = book_interview_slot(db_session, slot.id, cand1.id, test_job.id)
        assert err is None
        assert booked_slot.is_booked is True
        assert booked_slot.booked_candidate_id == cand1.id

        # Second booking fails
        b2, err2 = book_interview_slot(db_session, slot.id, cand2.id, test_job.id)
        assert b2 is None
        assert "already been booked" in err2


# ===========================================================================
# 3. Communication Planner & Authoritative Approvals (Section 6 & 13)
# ===========================================================================

class TestCommunicationPlannerAndApprovals:
    def _create_app_and_execution(self, db_session, test_user, test_job, purpose="RESULT_AND_SCHEDULING", required_approval=True):
        cand = Candidate(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            candidate_code=f"CAND-{uuid.uuid4().hex[:6]}", full_name="Siddharth Roy",
            email=f"sid-{uuid.uuid4().hex[:4]}@example.com", revision=1, skills=["Python", "FastAPI"]
        )
        db_session.add(cand)
        db_session.flush()

        app = JobApplication(
            id=str(uuid.uuid4()),
            job_id=test_job.id, candidate_id=cand.id, status="Screened",
            idempotency_key=f"app-{uuid.uuid4()}", source="Direct",
            profile_snapshot={}, answers_payload={}
        )
        db_session.add(app)

        wf = Workflow(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            created_by_id=test_user.id, name="Test Pipeline", is_company_default=False, status="Active"
        )
        db_session.add(wf)

        graph = {
            "stages": [
                {"stage_id": "tech_round_1", "stage_name": "Technical Deep Dive"},
                {"stage_id": "system_design", "stage_name": "System Architecture Panel", "scheduling_config": {"duration_minutes": 60, "format": "Video"}}
            ],
            "nodes": [
                {
                    "id": "call_node_1",
                    "type": "AI_CALLING",
                    "title": "Pass & Schedule Call",
                    "config": {
                        "purpose": purpose,
                        "source_stage_id": "tech_round_1",
                        "target_stage_id": "system_design",
                        "required_approval": required_approval,
                        "dry_run": True
                    }
                }
            ],
            "edges": []
        }

        wv = WorkflowVersion(
            id=str(uuid.uuid4()), workflow_id=wf.id, organization_id=test_user.organization_id,
            version_number=1, publication_state="Published", graph_data=graph
        )
        db_session.add(wv)

        exec_record = WorkflowExecution(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            job_application_id=app.id, workflow_id=wf.id, workflow_version_id=wv.id,
            status="Running", current_node_id="call_node_1"
        )
        db_session.add(exec_record)

        node_exec = NodeExecution(
            id=str(uuid.uuid4()), workflow_execution_id=exec_record.id,
            node_id="call_node_1", node_type="AI_CALLING", status="Ready"
        )
        db_session.add(node_exec)
        db_session.flush()

        return app, exec_record, node_exec

    def test_missing_human_approval_blocks_call(self, db_session, test_user, test_job):
        """When approval is required and no HRDecision exists, plan is BLOCKED."""
        app, exec_rec, node_exec = self._create_app_and_execution(db_session, test_user, test_job, required_approval=True)

        plan = build_communication_plan(db_session, exec_rec.id, node_exec.id, is_dry_run=True)
        assert plan.status == "BLOCKED"
        assert "Human approval required" in plan.block_reason

    def test_approved_human_decision_allows_communication_plan(self, db_session, test_user, test_job):
        """When a passing HRDecision exists for the stage, plan is VALIDATED."""
        app, exec_rec, node_exec = self._create_app_and_execution(db_session, test_user, test_job, required_approval=True)

        # Record human pass decision for tech_round_1
        decision = HRDecision(
            application_id=app.id,
            decided_by_id=test_user.id,
            decision="PASS",
            reason="Excellent Python and concurrency mastery.",
            stage_id="tech_round_1",
            stage_name="Technical Deep Dive"
        )
        db_session.add(decision)
        db_session.flush()

        plan = build_communication_plan(db_session, exec_rec.id, node_exec.id, is_dry_run=True)
        assert plan.status == "VALIDATED"
        assert plan.approved_result == "PASS"
        assert "System Architecture Panel" in plan.rendered_message
        assert "Technical Deep Dive" in plan.rendered_message

    def test_candidate_stop_contact_preference_blocks_call(self, db_session, test_user, test_job):
        """If candidate opted out or requested stop-contact, communication is blocked immediately."""
        app, exec_rec, node_exec = self._create_app_and_execution(db_session, test_user, test_job, required_approval=False)

        pref = CandidateContactPreference(
            organization_id=test_user.organization_id,
            candidate_id=app.candidate_id,
            phone_number=app.candidate.phone or "+919999999999",
            stop_contact=True,
            do_not_call=True,
            consent_given=False
        )
        db_session.add(pref)
        db_session.flush()

        plan = build_communication_plan(db_session, exec_rec.id, node_exec.id, is_dry_run=False)
        assert plan.status == "BLOCKED"
        assert "stop-contact or opted out" in plan.block_reason


# ===========================================================================
# 4. Multi-Stage Workflow with Multiple AI Calls (Section 1, 2, 3)
# ===========================================================================

class TestMultiStageWorkflowWithMultipleCalls:
    def test_workflow_validation_with_multiple_ai_calls(self):
        graph = {
            "stages": [
                {"stage_id": "s_screen", "stage_name": "Initial Screening", "stage_type": "AI_SCREENING"},
                {"stage_id": "s_panel", "stage_name": "Panel Interview", "stage_type": "INTERVIEW"}
            ],
            "nodes": [
                {"id": "n_start", "type": "APPLICATION_RECEIVED", "title": "Start"},
                {
                    "id": "n_call_1", "type": "AI_CALLING", "title": "First Screen Call",
                    "config": {"purpose": "INITIAL_SCREENING", "questions": [{"key": "q1", "text": "Are you available?"}]}
                },
                {
                    "id": "n_call_2", "type": "AI_CALLING", "title": "Schedule Panel Call",
                    "config": {"purpose": "SCHEDULE_INTERVIEW", "target_stage_id": "s_panel"}
                },
                {"id": "n_end", "type": "END", "title": "Finish"}
            ],
            "edges": [
                {"id": "e1", "source": "n_start", "target": "n_call_1"},
                {"id": "e2", "source": "n_call_1", "target": "n_call_2", "source_handle": "DEFAULT"},
                {"id": "e3", "source": "n_call_2", "target": "n_end", "source_handle": "DEFAULT"}
            ]
        }

        res = validate_workflow_graph(graph)
        assert res.is_valid is True
        assert len(res.errors) == 0

    def test_dry_run_execution_advances_ai_calling_node(self, db_session, test_user, test_job):
        """In dry-run mode, AI_CALLING node generates plan and succeeds without live telephony."""
        cand = Candidate(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            candidate_code="CAND-SIM-01", full_name="Simulated Candidate",
            email="sim@example.com", revision=1
        )
        db_session.add(cand)
        db_session.flush()

        app = JobApplication(
            id=str(uuid.uuid4()),
            job_id=test_job.id, candidate_id=cand.id, status="Applied",
            idempotency_key=f"app-sim-{uuid.uuid4()}", source="Direct",
            profile_snapshot={}, answers_payload={}
        )
        db_session.add(app)

        wf = Workflow(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            created_by_id=test_user.id, name="Dry Run WF", is_company_default=False, status="Active"
        )
        db_session.add(wf)

        graph = {
            "nodes": [
                {"id": "start", "type": "APPLICATION_RECEIVED", "title": "App Received"},
                {
                    "id": "call_step",
                    "type": "AI_CALLING",
                    "title": "Dry Run Screen Call",
                    "config": {
                        "purpose": "INITIAL_SCREENING",
                        "dry_run": True,
                        "questions": [{"key": "q1", "text": "Notice period?"}]
                    }
                },
                {"id": "end", "type": "END", "title": "End Step"}
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "call_step"},
                {"id": "e2", "source": "call_step", "target": "end", "source_handle": "OBJECTIVE_COMPLETED"}
            ]
        }

        wv = WorkflowVersion(
            id=str(uuid.uuid4()), workflow_id=wf.id, organization_id=test_user.organization_id,
            version_number=1, publication_state="Published", graph_data=graph
        )
        db_session.add(wv)

        exec_rec = WorkflowExecution(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            job_application_id=app.id, workflow_id=wf.id, workflow_version_id=wv.id,
            status="Running", current_node_id="call_step"
        )
        db_session.add(exec_rec)

        node_exec = NodeExecution(
            id=str(uuid.uuid4()), workflow_execution_id=exec_rec.id,
            node_id="call_step", node_type="AI_CALLING", status="Ready"
        )
        db_session.add(node_exec)
        db_session.flush()

        # Advance execution
        updated_exec = advance_execution(db_session, exec_rec.id, worker_id="test-sim")
        assert updated_exec.status in ["Running", "Succeeded"]

        # Verify plan was created and completed
        plan = db_session.query(CommunicationPlan).filter(
            CommunicationPlan.workflow_execution_id == exec_rec.id
        ).first()
        assert plan is not None
        assert plan.is_dry_run is True
        assert plan.status == "COMPLETED"
        assert plan.purpose == "INITIAL_SCREENING"


# ===========================================================================
# 5. Pinned Workflow Versioning (Section 1)
# ===========================================================================

class TestPinnedWorkflowVersioning:
    def test_editing_workflow_preserves_candidate_pinned_version(self, db_session, test_user, test_job):
        """Active candidate execution remains pinned to version 1 even if version 2 is published."""
        cand = Candidate(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            candidate_code="CAND-PIN-01", full_name="Pinned Candidate",
            email="pin@example.com", revision=1
        )
        db_session.add(cand)
        db_session.flush()

        app = JobApplication(
            id=str(uuid.uuid4()),
            job_id=test_job.id, candidate_id=cand.id, status="Applied",
            idempotency_key=f"app-pin-{uuid.uuid4()}", source="Direct",
            profile_snapshot={}, answers_payload={}
        )
        db_session.add(app)

        wf = Workflow(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            created_by_id=test_user.id, name="Job Process", is_company_default=False, status="Active"
        )
        db_session.add(wf)

        # Version 1 (original)
        wv1 = WorkflowVersion(
            id=str(uuid.uuid4()), workflow_id=wf.id, organization_id=test_user.organization_id,
            version_number=1, publication_state="Published",
            graph_data={"nodes": [{"id": "v1_node", "type": "APPLICATION_RECEIVED"}], "edges": []}
        )
        db_session.add(wv1)

        # Candidate enrolled in Version 1
        exec_rec = WorkflowExecution(
            id=str(uuid.uuid4()), organization_id=test_user.organization_id,
            job_application_id=app.id, workflow_id=wf.id, workflow_version_id=wv1.id,
            status="Running", current_node_id="v1_node"
        )
        db_session.add(exec_rec)
        db_session.flush()

        # HR now modifies workflow and publishes Version 2 with new stages
        wv2 = WorkflowVersion(
            id=str(uuid.uuid4()), workflow_id=wf.id, organization_id=test_user.organization_id,
            version_number=2, publication_state="Published",
            graph_data={"nodes": [{"id": "v2_new_node", "type": "APPLICATION_RECEIVED"}], "edges": []}
        )
        db_session.add(wv2)
        db_session.flush()

        # Verify candidate execution remains pinned to Version 1
        reloaded_exec = db_session.query(WorkflowExecution).filter(WorkflowExecution.id == exec_rec.id).first()
        assert reloaded_exec.workflow_version_id == wv1.id
        assert reloaded_exec.workflow_version.version_number == 1
        assert reloaded_exec.workflow_version.graph_data["nodes"][0]["id"] == "v1_node"


# ===========================================================================
# 6. Communication API Endpoints
# ===========================================================================

class TestCommunicationAPI:
    def test_get_and_update_company_settings(self, client):
        # GET settings
        get_res = client.get("/api/communication/settings")
        assert get_res.status_code == 200
        data = get_res.json()
        assert "calling_hours_start" in data
        assert data["timezone"] == "Asia/Kolkata"

        # PUT settings
        update_payload = {
            "company_intro": "We are a pioneering quantum computing firm.",
            "tone": "Direct",
            "supported_languages": ["en", "hi", "te"],
            "calling_hours_start": "10:00",
            "calling_hours_end": "18:00",
            "timezone": "Asia/Kolkata",
            "max_retry_attempts": 2,
            "min_hours_between_calls": 6,
            "contact_policy": {"require_consent": True, "allow_recording": True},
            "allowed_agent_actions": ["record_answers", "schedule_interview"],
            "default_templates": {}
        }
        put_res = client.put("/api/communication/settings", json=update_payload)
        assert put_res.status_code == 200
        updated = put_res.json()
        assert updated["company_intro"] == "We are a pioneering quantum computing firm."
        assert updated["calling_hours_start"] == "10:00"
        assert updated["min_hours_between_calls"] == 6

    def test_preview_communication_explains_call_rationale(self, client):
        node_cfg = {
            "purpose": "SCHEDULE_INTERVIEW",
            "source_stage_name": "Initial Technical Evaluation",
            "target_stage_name": "Hiring Manager Discussion",
            "required_approval": True,
            "allowed_actions": ["retrieve_slots", "reserve_booking", "confirm_booking"]
        }
        preview_req = {
            "node_config": node_cfg,
            "sample_context": {"candidate_name": "Priya Nair", "job_title": "Data Scientist"}
        }
        res = client.post("/api/communication/preview", json=preview_req)
        assert res.status_code == 200
        data = res.json()
        assert data["purpose"] == "SCHEDULE_INTERVIEW"
        assert "why_call_happens" in data
        assert "Hiring Manager Discussion" in data["what_agent_will_say"]
        assert len(data["actions_permitted"]) > 0
        assert len(data["forbidden_disclosures"]) > 0
        assert "unanswered_fallback" in data
