import pytest
from backend.app.models.job_application import JobApplication
from backend.app.models.candidate import Candidate
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.node_execution import NodeExecution
from backend.app.models.human_task import HumanTask
from backend.app.services.workflow_service import create_default_company_workflow
from backend.app.services.workflow_engine import (
    enroll_application_in_workflow,
    advance_execution
)

def test_workflow_enrollment_and_start_node(db_session, test_user, test_job):
    # Ensure default workflow exists
    wf = create_default_company_workflow(db_session, test_user.organization_id, test_user.id)

    cand = Candidate(
        organization_id=test_user.organization_id,
        candidate_code="CAND-TEST-WF1",
        full_name="Workflow Test Candidate",
        email="wf1@example.com",
        phone="+919876543210",
        total_experience=3.0,
        skills=["python", "fastapi"]
    )
    db_session.add(cand)
    db_session.flush()

    app = JobApplication(
        candidate_id=cand.id,
        job_id=test_job.id,
        source="CareerPage",
        idempotency_key="wf_app_test_1"
    )
    db_session.add(app)
    db_session.commit()

    # Enroll application
    execution = enroll_application_in_workflow(db_session, app.id)
    assert execution is not None
    assert execution.workflow_id == wf.id
    assert execution.status in ["Running", "WaitingForEvent", "WaitingForHuman"]

    # Verify nodes executed
    node_execs = db_session.query(NodeExecution).filter(
        NodeExecution.workflow_execution_id == execution.id
    ).all()
    assert len(node_execs) >= 1
    # Start node should have succeeded
    start_exec = next((n for n in node_execs if n.node_type == "APPLICATION_RECEIVED"), None)
    assert start_exec is not None
    assert start_exec.status == "Succeeded"

def test_human_task_completion_advances_workflow(db_session, test_user, test_job):
    wf = create_default_company_workflow(db_session, test_user.organization_id, test_user.id)

    cand = Candidate(
        organization_id=test_user.organization_id,
        candidate_code="CAND-TEST-WF2",
        full_name="Human Task Candidate",
        email="wf2@example.com",
        phone="+919876543211",
        total_experience=1.0  # Will get REVIEW/borderline screening score
    )
    db_session.add(cand)
    db_session.flush()

    app = JobApplication(
        candidate_id=cand.id,
        job_id=test_job.id,
        source="CareerPage",
        idempotency_key="wf_app_test_2"
    )
    db_session.add(app)
    db_session.commit()

    execution = enroll_application_in_workflow(db_session, app.id)
    advance_execution(db_session, execution.id)

    # Check for HumanTask
    task = db_session.query(HumanTask).filter(
        HumanTask.workflow_execution_id == execution.id
    ).first()

    if task:
        assert task.status == "Pending"
        # Complete task as recruiter
        task.status = "Completed"
        task.outcome = "APPROVED"
        db_session.commit()

        # Advance execution
        advance_execution(db_session, execution.id)
        db_session.refresh(execution)
        assert execution.status in ["Running", "WaitingForHuman", "Succeeded"]
