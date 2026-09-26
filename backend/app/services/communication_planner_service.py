"""
Communication Planner Service.

Implements Sections 5, 6, 7, 8, 9, 12, 13 of the dynamic AI communication spec:
1. Loads candidate's pinned workflow version & node execution.
2. Validates human approvals & stage decisions authoritatively.
3. Checks contact eligibility, stop-contact, calling hours, and candidate-level cooldowns.
4. Assembles the minimum relevant server-side context.
5. Renders controlled templates with strict placeholder resolution.
6. Persists an auditable CommunicationPlan.
7. Supports dry-run simulations.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List, Tuple
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from backend.app.models.communication_plan import CommunicationPlan
from backend.app.models.communication_setting import CompanyCommunicationSetting
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.node_execution import NodeExecution
from backend.app.models.candidate import Candidate
from backend.app.models.candidate_job import CandidateJob
from backend.app.models.job import Job
from backend.app.models.hr_decision import HRDecision
from backend.app.models.candidate_contact_preference import CandidateContactPreference
from backend.app.models.call_attempt import CallAttempt
from backend.app.services.communication_template_service import (
    STANDARD_TEMPLATES,
    render_template,
    assemble_context_for_purpose
)


def get_or_create_company_setting(db: Session, organization_id: str) -> CompanyCommunicationSetting:
    """Retrieves or initializes organization-level communication defaults."""
    setting = db.query(CompanyCommunicationSetting).filter(
        CompanyCommunicationSetting.organization_id == organization_id
    ).first()

    if not setting:
        setting = CompanyCommunicationSetting(
            organization_id=organization_id,
            company_intro="We are CareerOrbitAI, an AI-powered enterprise recruitment platform.",
            tone="Professional",
            supported_languages=["en", "hi"],
            calling_hours_start="09:00",
            calling_hours_end="19:00",
            timezone="Asia/Kolkata",
            max_retry_attempts=3,
            min_hours_between_calls=4,
            contact_policy={
                "require_consent": True,
                "allow_recording": True,
                "respect_do_not_call": True,
                "disclosure_text": "This call is recorded for quality and recruitment evaluation purposes."
            },
            allowed_agent_actions=[
                "record_answers", "request_clarification", "retrieve_slots",
                "reserve_booking", "confirm_booking", "deliver_result",
                "confirm_attendance", "record_callback", "record_withdrawal"
            ],
            default_templates={}
        )
        db.add(setting)
        db.flush()

    return setting


def validate_human_approval(
    db: Session,
    job_application_id: str,
    candidate_id: str,
    job_id: str,
    source_stage_id: Optional[str] = None
) -> Tuple[bool, Optional[HRDecision], Optional[str]]:
    """
    Per Section 13: Verifies that an authoritative, recorded human decision
    approving progression exists before communicating pass/progression.
    """
    query = db.query(HRDecision).filter(
        HRDecision.application_id == job_application_id
    )

    if source_stage_id:
        stage_decision = query.filter(HRDecision.stage_id == source_stage_id).order_by(HRDecision.created_at.desc()).first()
        if stage_decision:
            if stage_decision.decision in ["PASS", "Shortlisted", "APPROVED", "Cleared"]:
                return True, stage_decision, None
            return False, stage_decision, f"Stage decision is '{stage_decision.decision}', not passing."

    # Look for most recent decision
    latest_decision = query.order_by(HRDecision.created_at.desc()).first()
    if not latest_decision:
        return False, None, "No recorded human decision found for this application."

    if latest_decision.decision in ["Shortlisted", "PASS", "APPROVED", "Cleared"]:
        return True, latest_decision, None

    return False, latest_decision, f"Latest human decision is '{latest_decision.decision}', which does not authorize progression."


def check_candidate_eligibility(
    db: Session,
    candidate_id: str,
    organization_id: str,
    company_setting: CompanyCommunicationSetting,
    is_dry_run: bool = False
) -> Tuple[bool, Optional[str]]:
    """
    Validates contact eligibility, stop-contact, calling hours, and candidate-level cooldown.
    """
    # 1. Stop-contact check
    pref = db.query(CandidateContactPreference).filter(
        CandidateContactPreference.candidate_id == candidate_id,
        CandidateContactPreference.organization_id == organization_id
    ).first()

    if pref and (pref.stop_contact or pref.do_not_call or not pref.consent_given):
        return False, "Candidate requested stop-contact or opted out."

    if is_dry_run:
        return True, None

    # 2. Candidate-level cooldown across all jobs in organization (Section 12)
    min_hours = company_setting.min_hours_between_calls or 4
    cutoff = datetime.now(timezone.utc) - timedelta(hours=min_hours)

    recent_call = db.query(CallAttempt).filter(
        CallAttempt.candidate_id == candidate_id,
        CallAttempt.organization_id == organization_id,
        CallAttempt.operation_state.in_(["Initiating", "Accepted", "Completed"]),
        CallAttempt.initiated_at >= cutoff
    ).first()

    if recent_call:
        return False, f"Candidate cooldown active: A call was placed within the last {min_hours} hours."

    # 3. Calling hours check in organization's timezone
    try:
        tz = ZoneInfo(company_setting.timezone or "Asia/Kolkata")
        local_now = datetime.now(tz)
        local_time_str = local_now.strftime("%H:%M")
        start_str = company_setting.calling_hours_start or "09:00"
        end_str = company_setting.calling_hours_end or "19:00"

        if not (start_str <= local_time_str <= end_str):
            return False, f"Current time ({local_time_str} {company_setting.timezone}) is outside calling hours window ({start_str}-{end_str})."
    except Exception:
        pass  # Fallback to allow if timezone parsing fails

    return True, None


def build_communication_plan(
    db: Session,
    workflow_execution_id: str,
    node_execution_id: str,
    is_dry_run: bool = False
) -> CommunicationPlan:
    """
    Creates or updates the validated CommunicationPlan for an AI_CALLING node execution.
    Sole owner of pre-call planning per Sections 4, 5, 6.
    """
    exec_record = db.query(WorkflowExecution).filter(WorkflowExecution.id == workflow_execution_id).first()
    if not exec_record:
        raise ValueError(f"WorkflowExecution '{workflow_execution_id}' not found.")

    node_exec = db.query(NodeExecution).filter(NodeExecution.id == node_execution_id).first()
    if not node_exec:
        raise ValueError(f"NodeExecution '{node_execution_id}' not found.")

    # Idempotency: return existing plan if already generated
    existing_plan = db.query(CommunicationPlan).filter(
        CommunicationPlan.workflow_execution_id == workflow_execution_id,
        CommunicationPlan.node_execution_id == node_execution_id
    ).first()
    if existing_plan and existing_plan.status in ["VALIDATED", "COMPLETED"]:
        return existing_plan

    wv = exec_record.workflow_version
    graph = wv.graph_data or {}
    nodes = {n["id"]: n for n in graph.get("nodes", [])}
    node_def = nodes.get(node_exec.node_id, {})
    config = node_def.get("config", {})

    app = exec_record.job_application
    candidate = app.candidate
    job = app.job
    company_setting = get_or_create_company_setting(db, exec_record.organization_id)

    # Resolve purpose
    purpose = config.get("purpose") or "INITIAL_SCREENING"
    source_stage_id = config.get("source_stage_id")
    target_stage_id = config.get("target_stage_id")
    required_approval = config.get("required_approval", False)

    # Stages lookup from graph
    stages = graph.get("stages", [])
    stages_map = {s["stage_id"]: s for s in stages}
    source_stage = stages_map.get(source_stage_id) if source_stage_id else None
    target_stage = stages_map.get(target_stage_id) if target_stage_id else None

    # Derive names
    source_stage_name = source_stage.get("stage_name") if source_stage else config.get("source_stage_name")
    target_stage_name = target_stage.get("stage_name") if target_stage else config.get("target_stage_name")

    # Authoritative human decision verification (Section 13)
    approved_decision = None
    approval_error = None
    if required_approval:
        is_approved, decision_rec, approval_error = validate_human_approval(
            db=db,
            job_application_id=app.id,
            candidate_id=candidate.id,
            job_id=job.id,
            source_stage_id=source_stage_id
        )
        if not is_approved:
            plan = CommunicationPlan(
                organization_id=exec_record.organization_id,
                candidate_id=candidate.id,
                job_id=job.id,
                workflow_execution_id=workflow_execution_id,
                node_execution_id=node_execution_id,
                purpose=purpose,
                source_stage_id=source_stage_id,
                source_stage_name=source_stage_name,
                target_stage_id=target_stage_id,
                target_stage_name=target_stage_name,
                required_approval=True,
                status="BLOCKED",
                block_reason=f"Human approval required: {approval_error}",
                is_dry_run=is_dry_run
            )
            db.add(plan)
            db.flush()
            return plan

        approved_decision = decision_rec

    # Candidate contact eligibility & policy check
    is_eligible, ineligibility_reason = check_candidate_eligibility(
        db=db,
        candidate_id=candidate.id,
        organization_id=exec_record.organization_id,
        company_setting=company_setting,
        is_dry_run=is_dry_run
    )
    if not is_eligible:
        plan = CommunicationPlan(
            organization_id=exec_record.organization_id,
            candidate_id=candidate.id,
            job_id=job.id,
            workflow_execution_id=workflow_execution_id,
            node_execution_id=node_execution_id,
            purpose=purpose,
            source_stage_id=source_stage_id,
            source_stage_name=source_stage_name,
            target_stage_id=target_stage_id,
            target_stage_name=target_stage_name,
            required_approval=required_approval,
            approved_decision_id=approved_decision.id if approved_decision else None,
            status="BLOCKED",
            block_reason=ineligibility_reason,
            is_dry_run=is_dry_run
        )
        db.add(plan)
        db.flush()
        return plan

    # Organization company name
    from backend.app.models.user import Organization
    org = db.query(Organization).filter(Organization.id == exec_record.organization_id).first()
    org_name = org.name if org else "CareerOrbitAI"

    # Assemble server-side context per Section 7
    cand_dict = {
        "full_name": candidate.full_name,
        "email": candidate.email,
        "skills": getattr(candidate, "skills", []) or [],
        "language": getattr(candidate, "preferred_language", "en")
    }
    job_dict = {
        "title": job.title,
        "department": job.department,
        "work_mode": job.work_mode,
        "job_code": job.job_code
    }
    decision_dict = {
        "decision": approved_decision.decision if approved_decision else None,
        "reason": approved_decision.reason if approved_decision else None
    } if approved_decision else None

    context, facts_to_mention, forbidden_disclosures = assemble_context_for_purpose(
        purpose=purpose,
        candidate_data=cand_dict,
        job_data=job_dict,
        company_name=org_name,
        source_stage=source_stage,
        target_stage=target_stage,
        approved_decision=decision_dict
    )

    # Render template (Section 8)
    spec = STANDARD_TEMPLATES.get(purpose, STANDARD_TEMPLATES["INITIAL_SCREENING"])
    template_opening = config.get("first_message_template") or spec["opening"]
    template_msg = config.get("template_override") or spec["message"]

    rendered_opening, missing_opening = render_template(template_opening, context, spec.get("required_variables", []))
    rendered_msg, missing_msg = render_template(template_msg, context, spec.get("required_variables", []))

    all_missing = list(set(missing_opening + missing_msg))
    if all_missing:
        plan = CommunicationPlan(
            organization_id=exec_record.organization_id,
            candidate_id=candidate.id,
            job_id=job.id,
            workflow_execution_id=workflow_execution_id,
            node_execution_id=node_execution_id,
            purpose=purpose,
            source_stage_id=source_stage_id,
            source_stage_name=source_stage_name,
            target_stage_id=target_stage_id,
            target_stage_name=target_stage_name,
            required_approval=required_approval,
            status="BLOCKED",
            block_reason=f"Unresolved placeholders detected: {', '.join(all_missing)}. Dialing blocked.",
            is_dry_run=is_dry_run
        )
        db.add(plan)
        db.flush()
        return plan

    # Permitted actions allowlist (Section 9)
    allowed_actions = config.get("allowed_actions") or spec.get("default_actions", [])
    # Intersect with company-level permitted actions
    company_allowed = set(company_setting.allowed_agent_actions or [])
    if company_allowed:
        allowed_actions = [a for a in allowed_actions if a in company_allowed]

    # Questions to ask
    questions = config.get("questions", [])

    plan = CommunicationPlan(
        organization_id=exec_record.organization_id,
        candidate_id=candidate.id,
        job_id=job.id,
        workflow_execution_id=workflow_execution_id,
        node_execution_id=node_execution_id,
        purpose=purpose,
        source_stage_id=source_stage_id,
        source_stage_name=source_stage_name,
        target_stage_id=target_stage_id,
        target_stage_name=target_stage_name,
        required_approval=required_approval,
        approved_decision_id=approved_decision.id if approved_decision else None,
        approved_result=approved_decision.decision if approved_decision else None,
        facts_to_mention=facts_to_mention,
        questions_to_ask=questions,
        allowed_actions=allowed_actions,
        forbidden_disclosures=forbidden_disclosures,
        rendered_opening=rendered_opening,
        rendered_message=rendered_msg,
        dynamic_variables=context,
        completion_requirements={
            "require_confirmation": True,
            "min_duration_seconds": 30
        },
        retry_policy=config.get("retry_policy", {
            "max_attempts": 3,
            "retry_interval_minutes": 30
        }),
        status="VALIDATED",
        is_dry_run=is_dry_run
    )

    db.add(plan)
    db.flush()
    return plan
