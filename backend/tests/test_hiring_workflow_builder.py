import uuid
import pytest
from datetime import datetime, timezone
from backend.app.services.workflow_validator import validate_workflow_graph
from backend.app.services.workflow_service import (
    create_workflow,
    save_workflow_draft,
    publish_workflow_version,
    get_default_workflow_graph
)
from backend.app.schemas.workflow import (
    WorkflowCreate,
    WorkflowGraphData,
    WorkflowNode,
    WorkflowEdge
)
from backend.app.models.workflow import Workflow
from backend.app.models.workflow_version import WorkflowVersion
from backend.app.models.candidate import Candidate
from backend.app.models.job_application import JobApplication
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.node_execution import NodeExecution
from backend.app.models.human_task import HumanTask
from backend.app.services.workflow_engine import advance_execution

def test_multi_interview_rounds_workflow(db_session, test_user):
    """Verifies an HR user can configure different numbers of interview rounds (Round 1, Round 2, Round 3)."""
    wf_in = WorkflowCreate(name="Engineering Multi-Round Workflow", description="3-round interview process")
    wf = create_workflow(db_session, wf_in, test_user)

    nodes = [
        {"id": "step_1", "type": "APPLICATION_RECEIVED", "title": "Candidate applies", "config": {}},
        {"id": "step_2", "type": "AI_RESUME_SCREENING", "title": "Screen resume", "config": {"min_score_shortlist": 75}},
        {"id": "step_3", "type": "INTERVIEW", "title": "Round 1: Technical Coding", "config": {"duration_minutes": 60, "interviewer_role": "Senior Engineer"}},
        {"id": "step_4", "type": "INTERVIEW", "title": "Round 2: System Architecture", "config": {"duration_minutes": 60, "interviewer_role": "Staff Architect"}},
        {"id": "step_5", "type": "INTERVIEW", "title": "Round 3: Hiring Manager Culture Fit", "config": {"duration_minutes": 45, "interviewer_role": "VP Engineering"}},
        {"id": "step_6", "type": "HR_FINAL_DECISION", "title": "Final hiring decision", "config": {}},
        {"id": "step_7", "type": "END", "title": "End process", "config": {}}
    ]

    edges = [
        {"id": "e_1_2", "source": "step_1", "target": "step_2"},
        {"id": "e_2_3", "source": "step_2", "target": "step_3"},
        {"id": "e_3_4", "source": "step_3", "target": "step_4"},
        {"id": "e_4_5", "source": "step_4", "target": "step_5"},
        {"id": "e_5_6", "source": "step_5", "target": "step_6"},
        {"id": "e_6_7", "source": "step_6", "target": "step_7"}
    ]

    graph_data = WorkflowGraphData(
        nodes=[WorkflowNode(**n) for n in nodes],
        edges=[WorkflowEdge(**e) for e in edges]
    )

    val = validate_workflow_graph(graph_data)
    assert val.is_valid is True
    assert len(val.errors) == 0

    draft_v1 = db_session.query(WorkflowVersion).filter_by(workflow_id=wf.id, version_number=1).first()
    saved = save_workflow_draft(db_session, wf.id, draft_v1.id, graph_data, test_user)
    assert saved.publication_state == "Draft"
    assert len(saved.graph_data["nodes"]) == 7

    published = publish_workflow_version(db_session, wf.id, draft_v1.id, test_user)
    assert published.publication_state == "Published"
    assert published.version_number == 1
    assert published.definition_checksum is not None

def test_workflow_with_three_ai_calls_different_purposes(db_session, test_user):
    """Verifies adding three AI calls with distinct purposes in one hiring workflow."""
    nodes = [
        {"id": "start", "type": "APPLICATION_RECEIVED", "title": "Candidate applies", "config": {}},
        {"id": "screening", "type": "AI_RESUME_SCREENING", "title": "Screen resume", "config": {}},
        {
            "id": "call_1_screening",
            "type": "AI_CALLING",
            "title": "Call 1: Qualification & Availability",
            "config": {
                "purpose": "INITIAL_SCREENING",
                "first_message_template": "Hi {{candidate_name}}, calling from {{company_name}} regarding {{job_title}}."
            }
        },
        {"id": "interview_1", "type": "INTERVIEW", "title": "Technical Round", "config": {}},
        {
            "id": "call_2_scheduling",
            "type": "AI_CALLING",
            "title": "Call 2: Schedule Manager Round",
            "config": {
                "purpose": "SCHEDULE_INTERVIEW",
                "first_message_template": "Hi {{candidate_name}}, we'd love to schedule your manager interview for {{job_title}}."
            }
        },
        {"id": "interview_2", "type": "INTERVIEW", "title": "Manager Round", "config": {}},
        {
            "id": "call_3_result",
            "type": "AI_CALLING",
            "title": "Call 3: Approved Offer Update",
            "config": {
                "purpose": "RESULT_AND_SCHEDULING",
                "required_approval": True,
                "first_message_template": "Hi {{candidate_name}}, the team at {{company_name}} has approved your progression!"
            }
        },
        {"id": "final_decision", "type": "HR_FINAL_DECISION", "title": "Final Decision", "config": {}},
        {"id": "end", "type": "END", "title": "End Process", "config": {}}
    ]

    edges = [
        {"id": "e1", "source": "start", "target": "screening"},
        {"id": "e2", "source": "screening", "target": "call_1_screening"},
        {"id": "e3", "source": "call_1_screening", "target": "interview_1"},
        {"id": "e4", "source": "interview_1", "target": "call_2_scheduling"},
        {"id": "e5", "source": "call_2_scheduling", "target": "interview_2"},
        {"id": "e6", "source": "interview_2", "target": "call_3_result"},
        {"id": "e7", "source": "call_3_result", "target": "final_decision"},
        {"id": "e8", "source": "final_decision", "target": "end"}
    ]

    graph_data = WorkflowGraphData(
        nodes=[WorkflowNode(**n) for n in nodes],
        edges=[WorkflowEdge(**e) for e in edges]
    )

    val = validate_workflow_graph(graph_data)
    assert val.is_valid is True
    assert len(val.errors) == 0

def test_result_announcement_call_without_approval_triggers_warning():
    """Verifies that an AI call announcing results without required human approval triggers a warning."""
    nodes = [
        {"id": "start", "type": "APPLICATION_RECEIVED", "title": "Start", "config": {}},
        {
            "id": "unsafe_call",
            "type": "AI_CALLING",
            "title": "Unsafe Result Announcement",
            "config": {
                "purpose": "RESULT_NOTIFICATION",
                "required_approval": False,  # Missing approval
                "first_message_template": "Hi {{candidate_name}}, congratulations on passing {{job_title}}."
            }
        },
        {"id": "end", "type": "END", "title": "End", "config": {}}
    ]
    edges = [
        {"id": "e1", "source": "start", "target": "unsafe_call"},
        {"id": "e2", "source": "unsafe_call", "target": "end"}
    ]

    graph_data = WorkflowGraphData(
        nodes=[WorkflowNode(**n) for n in nodes],
        edges=[WorkflowEdge(**e) for e in edges]
    )

    val = validate_workflow_graph(graph_data)
    assert any("approval" in w.lower() for w in val.warnings)

def test_malformed_template_brackets_triggers_error():
    """Verifies that mismatched opening brackets in first message template produce validation errors."""
    nodes = [
        {"id": "start", "type": "APPLICATION_RECEIVED", "title": "Start", "config": {}},
        {
            "id": "broken_call",
            "type": "AI_CALLING",
            "title": "Broken Template Call",
            "config": {
                "purpose": "INITIAL_SCREENING",
                "first_message_template": "Hi {{candidate_name, calling regarding {{job_title}}."
            }
        },
        {"id": "end", "type": "END", "title": "End", "config": {}}
    ]
    edges = [
        {"id": "e1", "source": "start", "target": "broken_call"},
        {"id": "e2", "source": "broken_call", "target": "end"}
    ]

    graph_data = WorkflowGraphData(
        nodes=[WorkflowNode(**n) for n in nodes],
        edges=[WorkflowEdge(**e) for e in edges]
    )

    val = validate_workflow_graph(graph_data)
    assert val.is_valid is False
    assert any("bracket" in err.lower() for err in val.errors)

def test_pinned_versioning_draft_does_not_alter_active_executions(db_session, test_user, test_job):
    """Verifies editing a draft creates a new version without altering active candidates enrolled on v1."""
    # 1. Create and publish Version 1
    wf = create_workflow(db_session, WorkflowCreate(name="Engineering Workflow"), test_user)
    v1 = db_session.query(WorkflowVersion).filter_by(workflow_id=wf.id, version_number=1).first()
    publish_workflow_version(db_session, wf.id, v1.id, test_user)

    # 2. Enroll a candidate on published Version 1
    cand = Candidate(
        id=str(uuid.uuid4()), organization_id=test_user.organization_id,
        candidate_code="CAND-TEST-123", full_name="Alex Rivera",
        email="alex@example.com", revision=1
    )
    db_session.add(cand)
    db_session.flush()

    app = JobApplication(
        id=str(uuid.uuid4()),
        job_id=test_job.id,
        candidate_id=cand.id,
        status="UnderReview",
        idempotency_key=f"app-test-{uuid.uuid4()}",
        source="Direct"
    )
    db_session.add(app)
    db_session.flush()

    execution = WorkflowExecution(
        organization_id=test_user.organization_id,
        workflow_id=wf.id,
        workflow_version_id=v1.id,
        job_application_id=app.id,
        status="Running"
    )
    db_session.add(execution)
    db_session.commit()

    # 3. Recruiter saves a new draft (Version 2)
    modified_graph = get_default_workflow_graph()
    modified_graph["nodes"][1]["title"] = "Updated Screening v2"
    graph_obj = WorkflowGraphData(
        nodes=[WorkflowNode(**n) for n in modified_graph["nodes"]],
        edges=[WorkflowEdge(**e) for e in modified_graph["edges"]]
    )

    v2 = save_workflow_draft(db_session, wf.id, v1.id, graph_obj, test_user)
    assert v2.version_number == 2
    assert v2.publication_state == "Draft"

    # 4. Verify candidate's execution is still strictly pinned to Version 1
    db_session.refresh(execution)
    assert execution.workflow_version_id == v1.id
    assert execution.workflow_version.version_number == 1
    assert execution.workflow_version.publication_state == "Published"

def test_workflow_engine_executes_interview_human_task(db_session, test_user, test_job):
    """Verifies workflow engine generates an INTERVIEW human task and pauses execution until human completion."""
    cand = Candidate(
        id=str(uuid.uuid4()), organization_id=test_user.organization_id,
        candidate_code="CAND-INT-456", full_name="Sarah Chen",
        email="sarah@example.com", revision=1
    )
    db_session.add(cand)
    db_session.flush()

    app = JobApplication(
        id=str(uuid.uuid4()),
        job_id=test_job.id,
        candidate_id=cand.id,
        status="UnderReview",
        idempotency_key=f"app-int-{uuid.uuid4()}",
        source="Direct"
    )
    db_session.add(app)
    db_session.flush()

    nodes = [
        {"id": "node_interview", "type": "INTERVIEW", "title": "System Design Round", "config": {"due_in_hours": 48}},
        {"id": "node_end", "type": "END", "title": "End", "config": {}}
    ]
    edges = [{"id": "e_int_end", "source": "node_interview", "target": "node_end"}]

    wf = Workflow(
        organization_id=test_user.organization_id,
        created_by_id=test_user.id,
        name="Interview WF",
        status="Active"
    )
    db_session.add(wf)
    db_session.flush()

    v = WorkflowVersion(
        workflow_id=wf.id,
        organization_id=test_user.organization_id,
        version_number=1,
        publication_state="Published",
        graph_data={"nodes": nodes, "edges": edges}
    )
    db_session.add(v)
    db_session.flush()

    exec_rec = WorkflowExecution(
        organization_id=test_user.organization_id,
        workflow_id=wf.id,
        workflow_version_id=v.id,
        job_application_id=app.id,
        status="Running",
        current_node_id="node_interview"
    )
    db_session.add(exec_rec)
    db_session.flush()

    node_exec = NodeExecution(
        workflow_execution_id=exec_rec.id,
        node_id="node_interview",
        node_type="INTERVIEW",
        status="Ready"
    )
    db_session.add(node_exec)
    db_session.commit()

    # Step engine
    advance_execution(db_session, exec_rec.id, worker_id="test-worker")
    db_session.refresh(node_exec)
    assert node_exec.status == "WaitingForHuman"

    task = db_session.query(HumanTask).filter_by(node_execution_id=node_exec.id).first()
    assert task is not None
    assert task.task_type == "INTERVIEW"
    assert "System Design" in task.title

    # Simulate recruiter completing interview with 'APPROVED'
    task.status = "Completed"
    task.outcome = "APPROVED"
    db_session.commit()

    advance_execution(db_session, exec_rec.id, worker_id="test-worker")
    db_session.refresh(node_exec)
    assert node_exec.status == "Succeeded"
    assert node_exec.selected_outcome == "APPROVED"
