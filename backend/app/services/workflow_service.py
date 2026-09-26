import hashlib
import json
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from backend.app.models.workflow import Workflow
from backend.app.models.workflow_version import WorkflowVersion
from backend.app.models.job_workflow_binding import JobWorkflowBinding
from backend.app.models.job import Job
from backend.app.models.user import User
from backend.app.schemas.workflow import WorkflowCreate, WorkflowUpdate, WorkflowGraphData
from backend.app.services.workflow_validator import validate_workflow_graph

def get_default_workflow_graph() -> Dict[str, Any]:
    """Returns a production-grade default recruitment workflow graph."""
    nodes = [
        {
            "id": "node_start",
            "type": "APPLICATION_RECEIVED",
            "title": "Application Received",
            "description": "Initial intake of candidate application from Google Forms, Career Page, or Portal",
            "position": {"x": 250, "y": 50},
            "config": {}
        },
        {
            "id": "node_screening",
            "type": "AI_RESUME_SCREENING",
            "title": "AI Resume Screening",
            "description": "Objective, rules-based evaluation against job requirements and skills rubric",
            "position": {"x": 250, "y": 180},
            "config": {
                "min_score_shortlist": 75,
                "min_score_review": 50,
                "require_experience_match": True
            }
        },
        {
            "id": "node_screening_branch",
            "type": "CONDITION",
            "title": "Evaluate Screening Outcome",
            "description": "Route candidate based on screening score and recommendation",
            "position": {"x": 250, "y": 320},
            "config": {
                "branches": [
                    {
                        "branch_name": "SHORTLIST",
                        "condition_logic": "AND",
                        "rules": [
                            {"field_path": "screening.recommendation", "operator": "equals", "value": "SHORTLIST"}
                        ],
                        "is_default": False
                    },
                    {
                        "branch_name": "DEFAULT",
                        "condition_logic": "AND",
                        "rules": [],
                        "is_default": True
                    }
                ]
            }
        },
        {
            "id": "node_ai_call",
            "type": "AI_CALLING",
            "title": "ElevenLabs Screening Call",
            "description": "Autonomous AI telephone interview verifying availability, interest, and role fit",
            "position": {"x": 100, "y": 480},
            "config": {
                "step_name": "First-Round AI Phone Screen",
                "call_purpose": "Screen role interest, notice period, and interview availability",
                "provider_connection": "ElevenLabs",
                "language": "en",
                "max_duration_seconds": 600,
                "allowed_calling_windows": {"start": "09:00", "end": "19:00"},
                "timezone": "Asia/Kolkata",
                "recording_policy": "with_consent",
                "questions": [
                    {
                        "key": "role_interest",
                        "text": "Are you still actively interested in this opportunity and exploring new roles?",
                        "purpose": "Verify current candidate interest",
                        "required": True,
                        "answer_type": "text"
                    },
                    {
                        "key": "notice_period",
                        "text": "What is your current official notice period and earliest possible joining date?",
                        "purpose": "Verify notice period and join date",
                        "required": True,
                        "answer_type": "text"
                    },
                    {
                        "key": "interview_availability",
                        "text": "What are your preferred days and times for technical interview rounds this week?",
                        "purpose": "Capture concrete interview availability",
                        "required": True,
                        "answer_type": "availability"
                    }
                ],
                "retry_policy": {
                    "max_attempts": 3,
                    "retry_interval_minutes": 60,
                    "retryable_outcomes": ["NoAnswer", "Busy", "TechnicalFailure"]
                }
            }
        },
        {
            "id": "node_hr_review",
            "type": "HR_REVIEW",
            "title": "Recruiter Human Review",
            "description": "Manual recruiter review task for borderline scores or no-answer calls",
            "position": {"x": 420, "y": 480},
            "config": {
                "title": "Recruiter Review Application",
                "instructions": "Review candidate application profile, resume match, and call outcome",
                "due_in_hours": 24,
                "allowed_outcomes": ["SHORTLIST", "REJECT", "HOLD"]
            }
        },
        {
            "id": "node_final_decision",
            "type": "HR_FINAL_DECISION",
            "title": "HR Final Hiring Decision",
            "description": "Authorized human decision to extend offer, advance, or reject candidate",
            "position": {"x": 250, "y": 640},
            "config": {
                "title": "Final Hiring Decision",
                "allowed_outcomes": ["OFFER", "REJECT", "HOLD"]
            }
        },
        {
            "id": "node_end",
            "type": "END",
            "title": "Workflow Completed",
            "description": "Terminal state of workflow execution",
            "position": {"x": 250, "y": 780},
            "config": {}
        }
    ]

    edges = [
        {"id": "e_start_screening", "source": "node_start", "target": "node_screening", "label": "Proceed"},
        {"id": "e_screening_branch", "source": "node_screening", "target": "node_screening_branch", "label": "Screened"},
        {"id": "e_branch_call", "source": "node_screening_branch", "target": "node_ai_call", "source_handle": "SHORTLIST", "label": "Shortlisted (Score >= 75%)"},
        {"id": "e_branch_hr", "source": "node_screening_branch", "target": "node_hr_review", "source_handle": "DEFAULT", "label": "Needs Review / Borderline"},
        {"id": "e_call_decision", "source": "node_ai_call", "target": "node_final_decision", "source_handle": "COMPLETED", "label": "Call Completed"},
        {"id": "e_call_hr", "source": "node_ai_call", "target": "node_hr_review", "source_handle": "NO_ANSWER", "label": "Call Unanswered"},
        {"id": "e_hr_decision", "source": "node_hr_review", "target": "node_final_decision", "label": "Reviewed"},
        {"id": "e_decision_end", "source": "node_final_decision", "target": "node_end", "label": "Final Decision Logged"}
    ]

    return {"nodes": nodes, "edges": edges}

def list_workflows(db: Session, organization_id: str) -> List[Dict[str, Any]]:
    workflows = db.query(Workflow).filter(
        Workflow.organization_id == organization_id,
        Workflow.status != "Archived"
    ).order_by(Workflow.created_at.desc()).all()

    # If no workflow exists for org, initialize default company workflow
    if not workflows:
        default_wf = create_default_company_workflow(db, organization_id)
        workflows = [default_wf]

    results = []
    for wf in workflows:
        # Calculate job usage
        job_count = db.query(func.count(JobWorkflowBinding.id)).filter(
            JobWorkflowBinding.workflow_id == wf.id,
            JobWorkflowBinding.is_active == True
        ).scalar() or 0

        latest_v = db.query(WorkflowVersion).filter(
            WorkflowVersion.workflow_id == wf.id
        ).order_by(WorkflowVersion.version_number.desc()).first()

        published_v = db.query(WorkflowVersion).filter(
            WorkflowVersion.workflow_id == wf.id,
            WorkflowVersion.publication_state == "Published"
        ).order_by(WorkflowVersion.version_number.desc()).first()

        results.append({
            "id": wf.id,
            "organization_id": wf.organization_id,
            "name": wf.name,
            "description": wf.description,
            "is_company_default": wf.is_company_default,
            "status": wf.status,
            "job_usage_count": job_count,
            "latest_version_number": latest_v.version_number if latest_v else 1,
            "published_version_number": published_v.version_number if published_v else None,
            "created_at": wf.created_at,
            "updated_at": wf.updated_at
        })

    return results

def create_default_company_workflow(db: Session, organization_id: str, user_id: Optional[str] = None) -> Workflow:
    if not user_id:
        u = db.query(User).filter(User.organization_id == organization_id).first()
        user_id = u.id if u else "system"

    wf = Workflow(
        organization_id=organization_id,
        created_by_id=user_id,
        name="Standard Recruitment Workflow",
        description="Default enterprise hiring process with automated screening and ElevenLabs conversational calling",
        is_company_default=True,
        status="Active"
    )
    db.add(wf)
    db.flush()

    graph = get_default_workflow_graph()
    checksum = hashlib.sha256(json.dumps(graph, sort_keys=True).encode("utf-8")).hexdigest()

    version = WorkflowVersion(
        workflow_id=wf.id,
        organization_id=organization_id,
        version_number=1,
        publication_state="Published",
        definition_checksum=checksum,
        graph_data=graph,
        published_by_id=user_id,
        published_at=datetime.now(timezone.utc)
    )
    db.add(version)
    db.commit()
    db.refresh(wf)
    return wf

def get_workflow(db: Session, workflow_id: str, organization_id: str) -> Workflow:
    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.organization_id == organization_id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf

def create_workflow(db: Session, workflow_in: WorkflowCreate, user: User) -> Workflow:
    if workflow_in.is_company_default:
        # Clear existing default
        db.query(Workflow).filter(
            Workflow.organization_id == user.organization_id,
            Workflow.is_company_default == True
        ).update({"is_company_default": False})

    wf = Workflow(
        organization_id=user.organization_id,
        created_by_id=user.id,
        name=workflow_in.name,
        description=workflow_in.description,
        is_company_default=workflow_in.is_company_default,
        status="Active"
    )
    db.add(wf)
    db.flush()

    # Create initial draft Version 1 with default graph template
    graph = get_default_workflow_graph()
    v1 = WorkflowVersion(
        workflow_id=wf.id,
        organization_id=user.organization_id,
        version_number=1,
        publication_state="Draft",
        graph_data=graph
    )
    db.add(v1)
    db.commit()
    db.refresh(wf)
    return wf

def update_workflow(db: Session, workflow_id: str, workflow_in: WorkflowUpdate, user: User) -> Workflow:
    wf = get_workflow(db, workflow_id, user.organization_id)
    if workflow_in.name is not None:
        wf.name = workflow_in.name
    if workflow_in.description is not None:
        wf.description = workflow_in.description
    if workflow_in.is_company_default is not None:
        if workflow_in.is_company_default:
            db.query(Workflow).filter(
                Workflow.organization_id == user.organization_id,
                Workflow.is_company_default == True
            ).update({"is_company_default": False})
        wf.is_company_default = workflow_in.is_company_default
    if workflow_in.status is not None:
        wf.status = workflow_in.status

    wf.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(wf)
    return wf

def save_workflow_draft(db: Session, workflow_id: str, version_id: str, graph_data: WorkflowGraphData, user: User) -> WorkflowVersion:
    wv = db.query(WorkflowVersion).filter(
        WorkflowVersion.id == version_id,
        WorkflowVersion.workflow_id == workflow_id,
        WorkflowVersion.organization_id == user.organization_id
    ).first()
    if not wv:
        raise HTTPException(status_code=404, detail="Workflow version not found")

    if wv.publication_state == "Published":
        # Published versions are strictly IMMUTABLE. Create a new draft version!
        latest_v = db.query(func.max(WorkflowVersion.version_number)).filter(
            WorkflowVersion.workflow_id == workflow_id
        ).scalar() or 1

        new_version_number = latest_v + 1
        wv = WorkflowVersion(
            workflow_id=workflow_id,
            organization_id=user.organization_id,
            version_number=new_version_number,
            publication_state="Draft",
            graph_data=graph_data.model_dump()
        )
        db.add(wv)
    else:
        # Edit existing draft
        wv.graph_data = graph_data.model_dump()
        wv.updated_at = datetime.now(timezone.utc)

    # Perform graph validation
    val_res = validate_workflow_graph(wv.graph_data)
    wv.validation_errors = val_res.errors

    db.commit()
    db.refresh(wv)
    return wv

def publish_workflow_version(db: Session, workflow_id: str, version_id: str, user: User) -> WorkflowVersion:
    wv = db.query(WorkflowVersion).filter(
        WorkflowVersion.id == version_id,
        WorkflowVersion.workflow_id == workflow_id,
        WorkflowVersion.organization_id == user.organization_id
    ).first()
    if not wv:
        raise HTTPException(status_code=404, detail="Workflow version not found")

    val_res = validate_workflow_graph(wv.graph_data)
    if not val_res.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish workflow version due to validation errors: {'; '.join(val_res.errors)}"
        )

    # Calculate definition checksum
    checksum = hashlib.sha256(json.dumps(wv.graph_data, sort_keys=True).encode("utf-8")).hexdigest()

    wv.publication_state = "Published"
    wv.definition_checksum = checksum
    wv.published_by_id = user.id
    wv.published_at = datetime.now(timezone.utc)
    wv.validation_errors = []
    wv.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(wv)
    return wv

def get_job_workflow(db: Session, job_id: str, organization_id: str) -> Optional[WorkflowVersion]:
    """Resolves the pinned published workflow version for a job or the company default."""
    binding = db.query(JobWorkflowBinding).filter(
        JobWorkflowBinding.job_id == job_id,
        JobWorkflowBinding.is_active == True
    ).first()

    if binding and binding.workflow_version_id:
        wv = db.query(WorkflowVersion).filter(
            WorkflowVersion.id == binding.workflow_version_id,
            WorkflowVersion.publication_state == "Published"
        ).first()
        if wv:
            return wv

    if binding and binding.workflow_id:
        wv = db.query(WorkflowVersion).filter(
            WorkflowVersion.workflow_id == binding.workflow_id,
            WorkflowVersion.publication_state == "Published"
        ).order_by(WorkflowVersion.version_number.desc()).first()
        if wv:
            return wv

    # Fallback to company default workflow
    default_wf = db.query(Workflow).filter(
        Workflow.organization_id == organization_id,
        Workflow.is_company_default == True,
        Workflow.status == "Active"
    ).first()

    if default_wf:
        wv = db.query(WorkflowVersion).filter(
            WorkflowVersion.workflow_id == default_wf.id,
            WorkflowVersion.publication_state == "Published"
        ).order_by(WorkflowVersion.version_number.desc()).first()
        if wv:
            return wv

    # If still not found, create and return standard company default
    default_wf = create_default_company_workflow(db, organization_id)
    return default_wf.versions[0]
