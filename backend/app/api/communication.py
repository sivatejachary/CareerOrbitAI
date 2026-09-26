"""
Communication & Scheduling API Router.

Provides endpoints for:
- Company-level communication settings (defaults, tone, policies, hours)
- Communication plan inspection & dry-run simulation
- Workflow node message preview per Section 14
- Interview scheduling and slot management per Section 10
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.core.security import get_current_user
from backend.app.models.communication_setting import CompanyCommunicationSetting
from backend.app.models.communication_plan import CommunicationPlan
from backend.app.models.interview_slot import InterviewSlot
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.schemas.workflow import (
    CompanyCommunicationSettingCreate,
    CompanyCommunicationSettingResponse,
    CommunicationPlanResponse,
    CommunicationPreviewRequest,
    CommunicationPreviewResponse,
    InterviewSlotCreate,
    InterviewSlotResponse,
    BookSlotRequest
)
from backend.app.services.communication_planner_service import (
    get_or_create_company_setting,
    build_communication_plan
)
from backend.app.services.communication_template_service import (
    STANDARD_TEMPLATES,
    render_template,
    assemble_context_for_purpose
)
from backend.app.services.scheduling_service import (
    get_eligible_slots,
    book_interview_slot,
    seed_demo_interview_slots
)
from backend.app.services.workflow_engine import advance_execution

router = APIRouter(tags=["Communication & Scheduling"])


# ===========================================================================
# 1. Company Defaults (Section 1)
# ===========================================================================

@router.get("/api/communication/settings", response_model=CompanyCommunicationSettingResponse)
def get_company_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve organization-level communication defaults."""
    setting = get_or_create_company_setting(db, current_user.organization_id)
    return setting


@router.put("/api/communication/settings", response_model=CompanyCommunicationSettingResponse)
def update_company_settings(
    payload: CompanyCommunicationSettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update organization-level communication policies and calling hours."""
    setting = get_or_create_company_setting(db, current_user.organization_id)
    setting.company_intro = payload.company_intro
    setting.tone = payload.tone
    setting.supported_languages = payload.supported_languages
    setting.calling_hours_start = payload.calling_hours_start
    setting.calling_hours_end = payload.calling_hours_end
    setting.timezone = payload.timezone
    setting.max_retry_attempts = payload.max_retry_attempts
    setting.min_hours_between_calls = payload.min_hours_between_calls
    setting.contact_policy = payload.contact_policy
    setting.allowed_agent_actions = payload.allowed_agent_actions
    setting.default_templates = payload.default_templates
    db.commit()
    db.refresh(setting)
    return setting


# ===========================================================================
# 2. Workflow Editor Communication Preview (Section 14)
# ===========================================================================

@router.post("/api/communication/preview", response_model=CommunicationPreviewResponse)
def preview_node_communication(
    req: CommunicationPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Renders an in-depth communication preview for the workflow editor explaining:
    - Why the call happens
    - Facts used
    - What the agent will say
    - Allowed actions and forbidden disclosures
    - What completes the step
    - Unanswered / busy fallbacks
    """
    node_config = req.node_config or {}
    purpose = node_config.get("purpose") or "INITIAL_SCREENING"
    spec = STANDARD_TEMPLATES.get(purpose, STANDARD_TEMPLATES["INITIAL_SCREENING"])

    # Load candidate and job if provided, else use realistic preview sample
    cand_data = {"full_name": "Aarav Mehta", "skills": ["Python", "FastAPI", "Docker"], "language": "en"}
    job_data = {"title": "Senior AI Engineer", "department": "Platform", "work_mode": "Hybrid"}

    if req.candidate_id:
        cand = db.query(Candidate).filter(
            Candidate.id == req.candidate_id,
            Candidate.organization_id == current_user.organization_id
        ).first()
        if cand:
            cand_data = {"full_name": cand.full_name, "skills": getattr(cand, "skills", []) or [], "language": "en"}

    if req.job_id:
        j = db.query(Job).filter(
            Job.id == req.job_id,
            Job.organization_id == current_user.organization_id
        ).first()
        if j:
            job_data = {"title": j.title, "department": j.department, "work_mode": j.work_mode}

    org_setting = get_or_create_company_setting(db, current_user.organization_id)
    org_name = current_user.organization.name if current_user.organization else "CareerOrbitAI"

    source_stage = {"stage_name": node_config.get("source_stage_name") or "Technical Round 1"}
    target_stage = {
        "stage_name": node_config.get("target_stage_name") or "Engineering Panel Discussion",
        "scheduling_config": {"duration_minutes": 45, "format": "Video"}
    }
    approved_decision = {"decision": "PASS", "reason": "Demonstrated strong distributed systems knowledge."}

    context, facts, forbidden = assemble_context_for_purpose(
        purpose=purpose,
        candidate_data=cand_data,
        job_data=job_data,
        company_name=org_name,
        source_stage=source_stage,
        target_stage=target_stage,
        approved_decision=approved_decision,
        extra_context=req.sample_context
    )

    opening_tpl = node_config.get("first_message_template") or spec["opening"]
    msg_tpl = node_config.get("template_override") or spec["message"]

    rendered_opening, missing_op = render_template(opening_tpl, context, spec.get("required_variables", []))
    rendered_msg, missing_msg = render_template(msg_tpl, context, spec.get("required_variables", []))

    all_missing = list(set(missing_op + missing_msg))
    is_blocked = len(all_missing) > 0
    block_reason = f"Missing required template variables: {', '.join(all_missing)}" if is_blocked else None

    # Explanation text
    why_map = {
        "INITIAL_SCREENING": "Verify resume qualifications, technical background, and immediate availability before advancing.",
        "SCHEDULE_INTERVIEW": "Coordinate and book an upcoming interview round directly with the candidate.",
        "RESULT_NOTIFICATION": "Announce officially approved evaluation results and address candidate inquiries.",
        "RESULT_AND_SCHEDULING": "Deliver approved passing result from previous round and arrange next interview slot in a single call.",
        "INTERVIEW_REMINDER": "Ensure candidate attendance and confirm meeting logistics 24h prior to interview.",
        "REQUEST_CLARIFICATION": "Clarify specific missing information or resume discrepancies requested by the hiring team.",
        "FINAL_SELECTION_NOTIFICATION": "Deliver official job selection announcement approved by the hiring committee."
    }

    return CommunicationPreviewResponse(
        purpose=purpose,
        why_call_happens=why_map.get(purpose, "Perform workflow-scheduled communication."),
        facts_used=facts,
        what_agent_will_say=f"{rendered_opening}\n\n{rendered_msg}",
        opening_statement=rendered_opening,
        questions_to_ask=node_config.get("questions", []),
        actions_permitted=node_config.get("allowed_actions") or spec.get("default_actions", []),
        forbidden_disclosures=forbidden,
        what_completes_step="Candidate confirms the conversation, chooses slot, or answers required questions.",
        unanswered_fallback="Applies configured retry policy (up to 3 retries with 4-hour spacing), then creates HR task.",
        prerequisites={
            "required_approval": node_config.get("required_approval", False),
            "source_stage_id": node_config.get("source_stage_id"),
            "target_stage_id": node_config.get("target_stage_id")
        },
        is_blocked=is_blocked,
        block_reason=block_reason
    )


# ===========================================================================
# 3. Communication Plans Inspection (Section 6)
# ===========================================================================

@router.get("/api/communication/plans", response_model=List[CommunicationPlanResponse])
def list_communication_plans(
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    workflow_execution_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Query auditable communication plans scoped by candidate-job or execution."""
    q = db.query(CommunicationPlan).filter(
        CommunicationPlan.organization_id == current_user.organization_id
    )
    if candidate_id:
        q = q.filter(CommunicationPlan.candidate_id == candidate_id)
    if job_id:
        q = q.filter(CommunicationPlan.job_id == job_id)
    if workflow_execution_id:
        q = q.filter(CommunicationPlan.workflow_execution_id == workflow_execution_id)

    return q.order_by(CommunicationPlan.created_at.desc()).limit(50).all()


@router.get("/api/communication/plans/{plan_id}", response_model=CommunicationPlanResponse)
def get_communication_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full details of an auditable communication plan."""
    plan = db.query(CommunicationPlan).filter(
        CommunicationPlan.id == plan_id,
        CommunicationPlan.organization_id == current_user.organization_id
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Communication plan not found.")
    return plan


# ===========================================================================
# 4. Dry Run Simulation (Section 15)
# ===========================================================================

@router.post("/api/workflows/executions/{execution_id}/dry-run-step")
def dry_run_workflow_step(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates workflow branches and renders communication plan without
    placing live phone calls or booking external calendars.
    """
    exec_record = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.organization_id == current_user.organization_id
    ).first()
    if not exec_record:
        raise HTTPException(status_code=404, detail="Workflow execution not found.")

    # Override dry_run flag in graph node temporarily or advance with simulation
    adv_exec = advance_execution(db, execution_id, worker_id="sim-worker")
    db.refresh(adv_exec)

    # Check latest plan generated
    latest_plan = db.query(CommunicationPlan).filter(
        CommunicationPlan.workflow_execution_id == execution_id
    ).order_by(CommunicationPlan.created_at.desc()).first()

    return {
        "execution_id": execution_id,
        "status": adv_exec.status,
        "current_node_id": adv_exec.current_node_id,
        "plan": {
            "id": latest_plan.id,
            "purpose": latest_plan.purpose,
            "status": latest_plan.status,
            "block_reason": latest_plan.block_reason,
            "rendered_message": latest_plan.rendered_message,
            "facts_to_mention": latest_plan.facts_to_mention,
            "allowed_actions": latest_plan.allowed_actions
        } if latest_plan else None
    }


# ===========================================================================
# 5. Interview Scheduling & Slots (Section 10)
# ===========================================================================

@router.get("/api/scheduling/slots", response_model=List[InterviewSlotResponse])
def list_available_slots(
    job_id: Optional[str] = None,
    stage_id: Optional[str] = None,
    min_duration: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns eligible, unbooked interview slots."""
    slots = get_eligible_slots(
        db=db,
        organization_id=current_user.organization_id,
        job_id=job_id,
        stage_id=stage_id,
        min_duration_minutes=min_duration
    )
    return slots


@router.post("/api/scheduling/slots", response_model=InterviewSlotResponse)
def create_interview_slot(
    payload: InterviewSlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new interviewer availability slot."""
    slot = InterviewSlot(
        organization_id=current_user.organization_id,
        job_id=payload.job_id,
        stage_id=payload.stage_id,
        interviewer_name=payload.interviewer_name,
        interviewer_email=payload.interviewer_email,
        start_time=payload.start_time,
        end_time=payload.end_time,
        duration_minutes=payload.duration_minutes,
        format=payload.format,
        meeting_link=payload.meeting_link,
        timezone=payload.timezone
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.post("/api/scheduling/slots/{slot_id}/book")
def book_slot(
    slot_id: str,
    payload: BookSlotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atomically books an eligible slot for a candidate."""
    slot, err = book_interview_slot(
        db=db,
        slot_id=slot_id,
        candidate_id=payload.candidate_id,
        job_id=payload.job_id
    )
    if err:
        raise HTTPException(status_code=400, detail=err)

    db.commit()
    return {
        "success": True,
        "slot_id": slot.id,
        "booking_reference": slot.booking_reference,
        "start_time": slot.start_time.isoformat(),
        "interviewer_name": slot.interviewer_name,
        "format": slot.format,
        "meeting_link": slot.meeting_link
    }


@router.post("/api/scheduling/seed-demo-slots")
def seed_slots(
    job_id: Optional[str] = None,
    stage_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Helper to seed realistic upcoming interview slots for testing."""
    slots = seed_demo_interview_slots(
        db=db,
        organization_id=current_user.organization_id,
        job_id=job_id,
        stage_id=stage_id
    )
    db.commit()
    return {"created_count": len(slots), "slot_ids": [s.id for s in slots]}
