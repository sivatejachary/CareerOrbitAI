from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.core.security import get_current_user
from backend.app.schemas.workflow import (
    WorkflowCreate, WorkflowUpdate, WorkflowVersionDraftSave,
    WorkflowValidationResult, CompleteHumanTaskRequest
)
from backend.app.services import workflow_service
from backend.app.services.workflow_validator import validate_workflow_graph
from backend.app.models.workflow_version import WorkflowVersion
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.job_application import JobApplication
from backend.app.models.node_execution import NodeExecution
from backend.app.models.human_task import HumanTask
from backend.app.services.workflow_engine import advance_execution

router = APIRouter(prefix="/workflows", tags=["Hiring Workflows"])

@router.get("")
def list_workflows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return workflow_service.list_workflows(db, current_user.organization_id)

@router.post("", status_code=status.HTTP_201_CREATED)
def create_workflow(
    workflow_in: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return workflow_service.create_workflow(db, workflow_in, current_user)

@router.get("/{workflow_id}")
def get_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wf = workflow_service.get_workflow(db, workflow_id, current_user.organization_id)
    return {
        "id": wf.id,
        "name": wf.name,
        "description": wf.description,
        "is_company_default": wf.is_company_default,
        "status": wf.status,
        "created_at": wf.created_at,
        "updated_at": wf.updated_at,
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "publication_state": v.publication_state,
                "published_at": v.published_at,
                "created_at": v.created_at
            }
            for v in wf.versions
        ]
    }

@router.patch("/{workflow_id}")
def update_workflow(
    workflow_id: str,
    workflow_in: WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return workflow_service.update_workflow(db, workflow_id, workflow_in, current_user)

@router.get("/{workflow_id}/versions/{version_id}")
def get_workflow_version(
    workflow_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wv = db.query(WorkflowVersion).filter(
        WorkflowVersion.id == version_id,
        WorkflowVersion.workflow_id == workflow_id,
        WorkflowVersion.organization_id == current_user.organization_id
    ).first()
    if not wv:
        raise HTTPException(status_code=404, detail="Workflow version not found")

    return {
        "id": wv.id,
        "workflow_id": wv.workflow_id,
        "version_number": wv.version_number,
        "publication_state": wv.publication_state,
        "definition_checksum": wv.definition_checksum,
        "graph_data": wv.graph_data,
        "validation_errors": wv.validation_errors or [],
        "published_at": wv.published_at,
        "created_at": wv.created_at,
        "updated_at": wv.updated_at
    }

@router.put("/{workflow_id}/versions/{version_id}")
def save_workflow_draft(
    workflow_id: str,
    version_id: str,
    draft_in: WorkflowVersionDraftSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wv = workflow_service.save_workflow_draft(db, workflow_id, version_id, draft_in.graph_data, current_user)
    return {
        "id": wv.id,
        "version_number": wv.version_number,
        "publication_state": wv.publication_state,
        "graph_data": wv.graph_data,
        "validation_errors": wv.validation_errors,
        "updated_at": wv.updated_at
    }

@router.post("/{workflow_id}/versions/{version_id}/validate", response_model=WorkflowValidationResult)
def validate_version_graph(
    workflow_id: str,
    version_id: str,
    draft_in: WorkflowVersionDraftSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return validate_workflow_graph(draft_in.graph_data)

@router.post("/{workflow_id}/versions/{version_id}/publish")
def publish_workflow_version(
    workflow_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wv = workflow_service.publish_workflow_version(db, workflow_id, version_id, current_user)
    return {
        "id": wv.id,
        "version_number": wv.version_number,
        "publication_state": wv.publication_state,
        "published_at": wv.published_at,
        "definition_checksum": wv.definition_checksum
    }

# ==========================================
# Executions API
# ==========================================

@router.get("/executions/list")
def list_executions(
    job_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(WorkflowExecution).filter(
        WorkflowExecution.organization_id == current_user.organization_id
    )
    if job_id:
        query = query.join(WorkflowExecution.job_application).filter(JobApplication.job_id == job_id)
    if status_filter:
        query = query.filter(WorkflowExecution.status == status_filter)

    total = query.count()
    items = query.order_by(WorkflowExecution.created_at.desc()).offset((page - 1) * size).limit(size).all()

    results = []
    for exc in items:
        app = exc.job_application
        cand = app.candidate if app else None
        job = app.job if app else None
        results.append({
            "id": exc.id,
            "workflow_id": exc.workflow_id,
            "workflow_name": exc.workflow.name if exc.workflow else "Workflow",
            "workflow_version_number": exc.workflow_version.version_number if exc.workflow_version else 1,
            "job_application_id": exc.job_application_id,
            "job_id": job.id if job else "",
            "job_title": job.title if job else "",
            "candidate_id": cand.id if cand else "",
            "candidate_name": cand.full_name if cand else "Unknown",
            "candidate_email": cand.email if cand else "",
            "status": exc.status,
            "current_node_id": exc.current_node_id,
            "started_at": exc.started_at,
            "completed_at": exc.completed_at,
            "paused_at": exc.paused_at,
            "created_at": exc.created_at
        })

    return {"items": results, "total": total, "page": page, "size": size}

@router.get("/executions/{execution_id}")
def get_execution_details(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exc = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.organization_id == current_user.organization_id
    ).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Execution not found")

    app = exc.job_application
    cand = app.candidate if app else None
    job = app.job if app else None

    nodes_progress = [
        {
            "id": n.id,
            "node_id": n.node_id,
            "node_type": n.node_type,
            "status": n.status,
            "attempt_number": n.attempt_number,
            "selected_outcome": n.selected_outcome,
            "output_snapshot": n.output_snapshot,
            "error_details": n.error_details,
            "started_at": n.started_at,
            "completed_at": n.completed_at
        }
        for n in exc.node_executions
    ]

    human_tasks = db.query(HumanTask).filter(
        HumanTask.workflow_execution_id == exc.id
    ).all()

    tasks_data = [
        {
            "id": t.id,
            "task_type": t.task_type,
            "title": t.title,
            "instructions": t.instructions,
            "status": t.status,
            "outcome": t.outcome,
            "due_date": t.due_date,
            "created_at": t.created_at,
            "completed_at": t.completed_at
        }
        for t in human_tasks
    ]

    return {
        "id": exc.id,
        "workflow_id": exc.workflow_id,
        "workflow_name": exc.workflow.name if exc.workflow else "",
        "workflow_version_number": exc.workflow_version.version_number if exc.workflow_version else 1,
        "graph_data": exc.workflow_version.graph_data if exc.workflow_version else {},
        "status": exc.status,
        "current_node_id": exc.current_node_id,
        "context_data": exc.context_data,
        "job": {"id": job.id, "title": job.title, "job_code": job.job_code} if job else None,
        "candidate": {"id": cand.id, "full_name": cand.full_name, "email": cand.email, "phone": cand.phone} if cand else None,
        "started_at": exc.started_at,
        "completed_at": exc.completed_at,
        "paused_at": exc.paused_at,
        "nodes": nodes_progress,
        "human_tasks": tasks_data
    }

@router.post("/executions/{execution_id}/pause")
def pause_execution(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exc = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.organization_id == current_user.organization_id
    ).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Execution not found")

    exc.status = "Paused"
    exc.paused_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "Paused", "execution_id": exc.id}

@router.post("/executions/{execution_id}/resume")
def resume_execution(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exc = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.organization_id == current_user.organization_id
    ).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Execution not found")

    exc.status = "Running"
    exc.paused_at = None
    db.commit()
    advance_execution(db, exc.id)
    return {"status": "Running", "execution_id": exc.id}

@router.post("/executions/{execution_id}/cancel")
def cancel_execution(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exc = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.organization_id == current_user.organization_id
    ).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Execution not found")

    exc.status = "Canceled"
    exc.canceled_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "Canceled", "execution_id": exc.id}

@router.post("/human-tasks/{task_id}/complete")
def complete_human_task(
    task_id: str,
    task_in: CompleteHumanTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(HumanTask).filter(
        HumanTask.id == task_id,
        HumanTask.organization_id == current_user.organization_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Human task not found")

    task.status = "Completed"
    task.outcome = task_in.outcome
    task.outcome_data = task_in.outcome_data
    task.completed_by_id = current_user.id
    task.completed_at = datetime.now(timezone.utc)
    db.commit()

    # Advance workflow execution
    advance_execution(db, task.workflow_execution_id)
    return {"status": "Completed", "task_id": task.id, "outcome": task.outcome}
