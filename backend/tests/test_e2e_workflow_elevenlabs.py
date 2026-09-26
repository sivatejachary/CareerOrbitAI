import pytest
import uuid
from sqlalchemy.orm import Session
from backend.app.models.job_application import JobApplication
from backend.app.models.workflow_version import WorkflowVersion
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.node_execution import NodeExecution
from backend.app.schemas.workflow import WorkflowCreate
from backend.app.services import workflow_service
from backend.app.services.ingestion_service import ingest_job_application

def test_full_e2e_workflow_and_elevenlabs_flow(db_session: Session, test_user, test_job):
    # 1. Create a workflow
    wf_create = WorkflowCreate(
        name="Engineering Full-Cycle Flow",
        description="Intake -> AI Resume -> AI Call -> HR Decision",
        is_company_default=True
    )
    wf_summary = workflow_service.create_workflow(db_session, wf_create, test_user)
    assert wf_summary.name == "Engineering Full-Cycle Flow"
    assert wf_summary.status == "Active"

    # Fetch draft version
    draft_ver = db_session.query(WorkflowVersion).filter(
        WorkflowVersion.workflow_id == wf_summary.id,
        WorkflowVersion.publication_state == "Draft"
    ).first()
    assert draft_ver is not None

    # 2. Publish the workflow
    published = workflow_service.publish_workflow_version(db_session, wf_summary.id, draft_ver.id, test_user)
    assert published.publication_state == "Published"
    assert published.definition_checksum is not None
    assert len(published.definition_checksum) == 64  # SHA-256

    # 3. Ingest an application via ingestion service
    # This automatically finds the published workflow and enrolls the application!
    candidate_data = {
        "full_name": "Samantha Ray",
        "email": "samantha.ray@example.com",
        "phone": "+14155552671",
        "total_experience": 5.0,
        "skills": ["Python", "FastAPI", "ElevenLabs"]
    }

    app = ingest_job_application(
        db=db_session,
        job_id=test_job.id,
        source="CareerPortal",
        candidate_data=candidate_data
    )
    db_session.commit()

    # 4. Verify Workflow Execution was created automatically
    execution = db_session.query(WorkflowExecution).filter(
        WorkflowExecution.job_application_id == app.id
    ).first()
    assert execution is not None
    assert execution.workflow_id == wf_summary.id
    assert execution.workflow_version_id == published.id

    # 5. Verify node executions were recorded
    node_execs = db_session.query(NodeExecution).filter(
        NodeExecution.workflow_execution_id == execution.id
    ).all()
    assert len(node_execs) >= 1
    # First node was APPLICATION_RECEIVED
    assert node_execs[0].node_type == "APPLICATION_RECEIVED"
    assert node_execs[0].status == "Succeeded"

    # 6. Check that execution progressed to a subsequent node
    assert execution.current_node_id is not None
    assert execution.status in ["Running", "WaitingForHuman", "WaitingUntilTime", "WaitingForEvent", "Blocked", "Succeeded"]
