import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.node_execution import NodeExecution
from backend.app.models.workflow_version import WorkflowVersion
from backend.app.models.job_application import JobApplication
from backend.app.models.human_task import HumanTask
from backend.app.models.workflow_event import WorkflowEvent
from backend.app.models.call_attempt import CallAttempt
from backend.app.models.hr_decision import HRDecision
from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.communication_plan import CommunicationPlan
from backend.app.services.workflow_service import get_job_workflow
from backend.app.services.screening_service import run_job_screening
from backend.app.services.elevenlabs_service import initiate_elevenlabs_outbound_call
from backend.app.services.communication_planner_service import build_communication_plan

logger = logging.getLogger("careerorbit.workflow_engine")

LEASE_DURATION_SECONDS = 60

def enroll_application_in_workflow(db: Session, application_id: str) -> Optional[WorkflowExecution]:
    """Resolves published workflow, pins version, and initiates execution."""
    app = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not app:
        logger.error(f"Cannot enroll application: Application '{application_id}' not found.")
        return None

    # Check if execution already exists (idempotent)
    existing_exec = db.query(WorkflowExecution).filter(
        WorkflowExecution.job_application_id == application_id
    ).first()
    if existing_exec:
        return existing_exec

    wv = get_job_workflow(db, app.job_id, app.job.organization_id)
    if not wv:
        logger.error(f"No published workflow found for job '{app.job_id}' or organization.")
        return None

    execution = WorkflowExecution(
        organization_id=app.job.organization_id,
        job_application_id=app.id,
        workflow_id=wv.workflow_id,
        workflow_version_id=wv.id,
        status="Running",
        context_data={
            "application_id": app.id,
            "job_id": app.job_id,
            "candidate_id": app.candidate_id,
            "source": app.source
        },
        started_at=datetime.now(timezone.utc)
    )
    db.add(execution)
    db.flush()

    # Find Start Node (APPLICATION_RECEIVED)
    graph = wv.graph_data or {}
    nodes = graph.get("nodes", [])
    start_node = next((n for n in nodes if n.get("type") == "APPLICATION_RECEIVED"), None)

    if not start_node:
        execution.status = "Failed"
        db.commit()
        return execution

    execution.current_node_id = start_node["id"]

    start_node_exec = NodeExecution(
        workflow_execution_id=execution.id,
        node_id=start_node["id"],
        node_type=start_node["type"],
        status="Ready",
        input_snapshot={"application_id": app.id},
        started_at=datetime.now(timezone.utc)
    )
    db.add(start_node_exec)
    db.commit()
    db.refresh(execution)

    # Immediately advance start node
    advance_execution(db, execution.id)
    return execution

def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def advance_execution(db: Session, execution_id: str, worker_id: Optional[str] = None) -> WorkflowExecution:
    """Executes ready nodes and advances workflow state along graph transitions."""
    worker_lease = worker_id or str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)

    exec_record = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id
    ).first()
    if not exec_record or exec_record.status in ["Paused", "Canceled", "Succeeded", "Failed"]:
        return exec_record

    # Fenced lease check
    lease_expires = ensure_utc(exec_record.worker_lease_expires_at)
    if lease_expires and lease_expires > now_utc:
        if exec_record.worker_lease_id != worker_lease:
            # Another worker holds lease
            return exec_record

    exec_record.worker_lease_id = worker_lease
    exec_record.worker_lease_expires_at = now_utc + timedelta(seconds=LEASE_DURATION_SECONDS)
    db.commit()

    wv = exec_record.workflow_version
    graph = wv.graph_data or {}
    nodes = {n["id"]: n for n in graph.get("nodes", [])}
    edges = graph.get("edges", [])

    # Find currently active node execution
    curr_node_exec = db.query(NodeExecution).filter(
        NodeExecution.workflow_execution_id == exec_record.id,
        NodeExecution.status.in_(["Ready", "Running", "WaitingForEvent", "WaitingUntilTime", "WaitingForHuman"])
    ).order_by(NodeExecution.created_at.desc()).first()

    if not curr_node_exec:
        return exec_record

    node_def = nodes.get(curr_node_exec.node_id)
    if not node_def:
        curr_node_exec.status = "Failed"
        curr_node_exec.error_details = f"Node '{curr_node_exec.node_id}' not found in graph."
        exec_record.status = "Failed"
        db.commit()
        return exec_record

    ntype = node_def.get("type")

    # 1. APPLICATION_RECEIVED
    if ntype == "APPLICATION_RECEIVED":
        curr_node_exec.status = "Succeeded"
        curr_node_exec.selected_outcome = "PROCEED"
        curr_node_exec.completed_at = now_utc
        db.commit()
        transition_to_next_node(db, exec_record, curr_node_exec.node_id, "PROCEED", edges, nodes, worker_id=worker_lease)
        return exec_record

    # 2. AI_RESUME_SCREENING
    elif ntype == "AI_RESUME_SCREENING":
        try:
            curr_node_exec.status = "Running"
            db.commit()

            screening_run = run_job_screening(db, exec_record.job_application_id)
            rec = screening_run.recommendation  # SHORTLIST, REVIEW, NOT_MATCHED

            curr_node_exec.output_snapshot = {
                "screening_run_id": screening_run.id,
                "recommendation": rec,
                "rationale": screening_run.rationale
            }
            curr_node_exec.selected_outcome = rec
            curr_node_exec.status = "Succeeded"
            curr_node_exec.completed_at = now_utc

            # Update context
            context = exec_record.context_data or {}
            context["screening"] = {
                "recommendation": rec,
                "screening_run_id": screening_run.id
            }
            exec_record.context_data = context
            db.commit()

            transition_to_next_node(db, exec_record, curr_node_exec.node_id, rec, edges, nodes, worker_id=worker_lease)
        except Exception as e:
            curr_node_exec.status = "Failed"
            curr_node_exec.error_details = str(e)
            exec_record.status = "Failed"
            db.commit()
        return exec_record

    # 3. CONDITION
    elif ntype == "CONDITION":
        try:
            curr_node_exec.status = "Running"
            outcome = evaluate_condition_node(exec_record.context_data, node_def.get("config", {}))
            curr_node_exec.selected_outcome = outcome
            curr_node_exec.output_snapshot = {"selected_branch": outcome}
            curr_node_exec.status = "Succeeded"
            curr_node_exec.completed_at = now_utc
            db.commit()
            transition_to_next_node(db, exec_record, curr_node_exec.node_id, outcome, edges, nodes, worker_id=worker_lease)
        except Exception as e:
            curr_node_exec.status = "Failed"
            curr_node_exec.error_details = str(e)
            db.commit()
        return exec_record

    # 4. AI_CALLING (Dynamic, Reusable Communication Step per spec Sections 3, 4, 5, 11)
    elif ntype == "AI_CALLING":
        app = exec_record.job_application
        cfg = node_def.get("config", {})
        is_dry_run = bool(cfg.get("dry_run", False))

        # 1. Build or retrieve validated communication plan (Section 6)
        plan = None
        try:
            plan = build_communication_plan(
                db=db,
                workflow_execution_id=exec_record.id,
                node_execution_id=curr_node_exec.id,
                is_dry_run=is_dry_run
            )
        except Exception as plan_err:
            logger.error(f"Failed to generate communication plan: {plan_err}")
            curr_node_exec.status = "Blocked"
            curr_node_exec.error_details = str(plan_err)
            db.commit()
            return exec_record

        # 2. Check if plan is blocked (Section 5, 13)
        if plan and plan.status == "BLOCKED":
            reason = plan.block_reason or "Communication blocked by policy."
            if "Human approval required" in reason:
                # Require human decision before communicating pass/progression
                curr_node_exec.status = "WaitingForHuman"
                curr_node_exec.error_details = reason

                # Check if HumanTask already exists
                open_task = db.query(HumanTask).filter(
                    HumanTask.node_execution_id == curr_node_exec.id,
                    HumanTask.status == "Open"
                ).first()
                if not open_task:
                    task = HumanTask(
                        id=str(uuid.uuid4()),
                        organization_id=exec_record.organization_id,
                        workflow_execution_id=exec_record.id,
                        node_execution_id=curr_node_exec.id,
                        task_type="APPROVAL_REQUIRED",
                        title=f"Approval Required: {plan.purpose} for {app.candidate.full_name}",
                        instructions=reason,
                        due_date=now_utc + timedelta(hours=24),
                        status="Open",
                        allowed_outcomes=["APPROVED", "REJECTED"]
                    )
                    db.add(task)
                db.commit()
                return exec_record

            elif "stop-contact" in reason.lower() or "opted out" in reason.lower():
                curr_node_exec.status = "Succeeded"
                curr_node_exec.selected_outcome = "OPTED_OUT"
                curr_node_exec.completed_at = now_utc
                db.commit()
                transition_to_next_node(db, exec_record, curr_node_exec.node_id, "OPTED_OUT", edges, nodes, worker_id=worker_lease)
                return exec_record

            else:
                curr_node_exec.status = "Blocked"
                curr_node_exec.error_details = reason
                db.commit()
                return exec_record

        # 3. Handle Dry Run mode (Section 15)
        if plan and plan.is_dry_run:
            plan.status = "COMPLETED"
            curr_node_exec.status = "Succeeded"
            curr_node_exec.selected_outcome = "OBJECTIVE_COMPLETED"
            curr_node_exec.output_snapshot = {
                "dry_run": True,
                "plan_id": plan.id,
                "purpose": plan.purpose,
                "rendered_opening": plan.rendered_opening,
                "rendered_message": plan.rendered_message,
                "facts_to_mention": plan.facts_to_mention,
                "allowed_actions": plan.allowed_actions
            }
            curr_node_exec.completed_at = now_utc
            db.commit()
            transition_to_next_node(db, exec_record, curr_node_exec.node_id, "OBJECTIVE_COMPLETED", edges, nodes, worker_id=worker_lease)
            return exec_record

        # 4. Live Call Execution via ElevenLabs
        attempt = db.query(CallAttempt).filter(
            CallAttempt.node_execution_id == curr_node_exec.id
        ).first()

        if not attempt:
            curr_node_exec.status = "Running"
            db.commit()
            attempt = initiate_elevenlabs_outbound_call(
                db=db,
                organization_id=exec_record.organization_id,
                candidate_id=app.candidate_id,
                job_id=app.job_id,
                phone_number=app.candidate.phone,
                node_execution_id=curr_node_exec.id,
                workflow_execution_id=exec_record.id,
                custom_first_message=plan.rendered_opening if plan else None,
                dynamic_variables=plan.dynamic_variables if plan else None,
                communication_plan_id=plan.id if plan else None
            )

        if attempt.operation_state == "Failed":
            curr_node_exec.status = "Succeeded"
            curr_node_exec.selected_outcome = "TECHNICAL_FAILURE"
            curr_node_exec.completed_at = now_utc
            if plan:
                plan.status = "FAILED"
            db.commit()
            transition_to_next_node(db, exec_record, curr_node_exec.node_id, "TECHNICAL_FAILURE", edges, nodes, worker_id=worker_lease)

        elif attempt.processing_state == "Ready":
            # Map to one of the 10 explicit outcomes per Section 11
            statements = (attempt.evaluation.candidate_statements if attempt.evaluation else {}) or {}

            if statements.get("withdrawn"):
                outcome = "WITHDRAWN"
            elif statements.get("stop_contact_requested") or statements.get("opted_out"):
                outcome = "OPTED_OUT"
            elif statements.get("declined"):
                outcome = "DECLINED"
            elif statements.get("wrong_person"):
                outcome = "WRONG_PERSON"
            elif statements.get("callback_requested"):
                outcome = "CALLBACK_REQUESTED"
            elif statements.get("needs_recruiter"):
                outcome = "NEEDS_RECRUITER"
            elif attempt.disposition in ["NoAnswer"]:
                outcome = "NO_ANSWER"
            elif attempt.disposition in ["Busy"]:
                outcome = "BUSY"
            elif attempt.disposition in ["TechnicalFailure", "Failed"]:
                outcome = "TECHNICAL_FAILURE"
            else:
                outcome = "OBJECTIVE_COMPLETED"

            attempt.communication_outcome = outcome
            if plan:
                plan.status = "COMPLETED"

            curr_node_exec.status = "Succeeded"
            curr_node_exec.selected_outcome = outcome
            curr_node_exec.output_snapshot = {
                "call_attempt_id": attempt.id,
                "plan_id": plan.id if plan else None,
                "disposition": attempt.disposition,
                "communication_outcome": outcome,
                "evaluation": attempt.evaluation.recommendation if attempt.evaluation else None
            }
            curr_node_exec.completed_at = now_utc

            # Update context
            context = exec_record.context_data or {}
            context["communication"] = {
                "purpose": plan.purpose if plan else "CALL",
                "call_id": attempt.id,
                "outcome": outcome,
                "disposition": attempt.disposition
            }
            exec_record.context_data = context
            db.commit()
            transition_to_next_node(db, exec_record, curr_node_exec.node_id, outcome, edges, nodes, worker_id=worker_lease)
        else:
            # Call still in progress
            curr_node_exec.status = "WaitingForEvent"
            db.commit()

        return exec_record

    # 5. WAIT_DELAY
    elif ntype == "WAIT_DELAY":
        if not curr_node_exec.scheduled_for:
            cfg = node_def.get("config", {})
            d_hours = cfg.get("delay_hours", 0)
            d_mins = cfg.get("delay_minutes", 0)
            target_time = now_utc + timedelta(hours=d_hours, minutes=d_mins)
            curr_node_exec.scheduled_for = target_time
            curr_node_exec.status = "WaitingUntilTime"
            db.commit()
            return exec_record

        sched_for = ensure_utc(curr_node_exec.scheduled_for)
        if sched_for and now_utc >= sched_for:
            curr_node_exec.status = "Succeeded"
            curr_node_exec.selected_outcome = "CONTINUE"
            curr_node_exec.completed_at = now_utc
            db.commit()
            transition_to_next_node(db, exec_record, curr_node_exec.node_id, "CONTINUE", edges, nodes)
        else:
            curr_node_exec.status = "WaitingUntilTime"
            db.commit()

        return exec_record

    # 6. HR_REVIEW & INTERVIEW
    elif ntype in ["HR_REVIEW", "INTERVIEW"]:
        task = db.query(HumanTask).filter(
            HumanTask.node_execution_id == curr_node_exec.id
        ).first()

        if not task:
            cfg = node_def.get("config", {})
            task = HumanTask(
                organization_id=exec_record.organization_id,
                workflow_execution_id=exec_record.id,
                node_execution_id=curr_node_exec.id,
                task_type="INTERVIEW" if ntype == "INTERVIEW" else "HR_REVIEW",
                title=cfg.get("title") or node_def.get("title") or ("Interview Evaluation" if ntype == "INTERVIEW" else "Recruiter Review Application"),
                instructions=cfg.get("instructions", "Conduct interview round and record candidate feedback.") if ntype == "INTERVIEW" else cfg.get("instructions", "Review candidate application and determine whether to proceed."),
                due_date=now_utc + timedelta(hours=cfg.get("due_in_hours", 48 if ntype == "INTERVIEW" else 24))
            )
            db.add(task)
            curr_node_exec.status = "WaitingForHuman"
            db.commit()
            return exec_record

        if task.status == "Completed":
            outcome = task.outcome or "APPROVED"
            curr_node_exec.status = "Succeeded"
            curr_node_exec.selected_outcome = outcome
            curr_node_exec.output_snapshot = {"task_id": task.id, "outcome": outcome}
            curr_node_exec.completed_at = now_utc
            db.commit()
            transition_to_next_node(db, exec_record, curr_node_exec.node_id, outcome, edges, nodes, worker_id=worker_lease)
        return exec_record

    # 6b. ASSESSMENT, MANUAL_TASK & CANDIDATE_AVAILABILITY
    elif ntype in ["ASSESSMENT", "MANUAL_TASK", "CANDIDATE_AVAILABILITY"]:
        task = db.query(HumanTask).filter(
            HumanTask.node_execution_id == curr_node_exec.id
        ).first()

        if not task:
            cfg = node_def.get("config", {})
            task = HumanTask(
                organization_id=exec_record.organization_id,
                workflow_execution_id=exec_record.id,
                node_execution_id=curr_node_exec.id,
                task_type=ntype,
                title=cfg.get("title") or node_def.get("title") or f"Execute {ntype.replace('_', ' ').title()}",
                instructions=cfg.get("instructions", f"Perform {ntype.replace('_', ' ').lower()} for candidate."),
                due_date=now_utc + timedelta(hours=cfg.get("due_in_hours", 48))
            )
            db.add(task)
            curr_node_exec.status = "WaitingForHuman"
            db.commit()
            return exec_record

        if task.status == "Completed":
            outcome = task.outcome or "COMPLETED"
            curr_node_exec.status = "Succeeded"
            curr_node_exec.selected_outcome = outcome
            curr_node_exec.output_snapshot = {"task_id": task.id, "outcome": outcome}
            curr_node_exec.completed_at = now_utc
            db.commit()
            transition_to_next_node(db, exec_record, curr_node_exec.node_id, outcome, edges, nodes, worker_id=worker_lease)
        return exec_record

    # 6c. SEND_MESSAGE
    elif ntype == "SEND_MESSAGE":
        curr_node_exec.status = "Succeeded"
        curr_node_exec.selected_outcome = "SENT"
        curr_node_exec.output_snapshot = {"status": "SENT", "channel": node_def.get("config", {}).get("channel", "EMAIL")}
        curr_node_exec.completed_at = now_utc
        db.commit()
        transition_to_next_node(db, exec_record, curr_node_exec.node_id, "SENT", edges, nodes, worker_id=worker_lease)
        return exec_record

    # 7. HR_FINAL_DECISION
    elif ntype == "HR_FINAL_DECISION":
        task = db.query(HumanTask).filter(
            HumanTask.node_execution_id == curr_node_exec.id
        ).first()

        if not task:
            cfg = node_def.get("config", {})
            task = HumanTask(
                organization_id=exec_record.organization_id,
                workflow_execution_id=exec_record.id,
                node_execution_id=curr_node_exec.id,
                task_type="HR_FINAL_DECISION",
                title=cfg.get("title", "Final Hiring Decision"),
                instructions="Record recruiter final hiring decision for candidate.",
                due_date=now_utc + timedelta(hours=48)
            )
            db.add(task)
            curr_node_exec.status = "WaitingForHuman"
            db.commit()
            return exec_record

        if task.status == "Completed":
            outcome = task.outcome or "OFFER"
            curr_node_exec.status = "Succeeded"
            curr_node_exec.selected_outcome = outcome
            curr_node_exec.output_snapshot = {"task_id": task.id, "decision": outcome}
            curr_node_exec.completed_at = now_utc

            # Update JobApplication status
            app = exec_record.job_application
            if outcome == "OFFER":
                app.status = "Shortlisted"
            elif outcome == "REJECT":
                app.status = "Rejected"
            elif outcome == "HOLD":
                app.status = "UnderReview"

            # Create HRDecision audit record
            decision_rec = HRDecision(
                application_id=app.id,
                decided_by_id=task.completed_by_id or "system",
                decision=outcome,
                reason=task.instructions or "Completed in hiring workflow final decision step."
            )
            db.add(decision_rec)
            db.commit()
            transition_to_next_node(db, exec_record, curr_node_exec.node_id, outcome, edges, nodes, worker_id=worker_lease)
        return exec_record

    # 8. END
    elif ntype == "END":
        curr_node_exec.status = "Succeeded"
        curr_node_exec.completed_at = now_utc
        exec_record.status = "Succeeded"
        exec_record.completed_at = now_utc
        db.commit()
        return exec_record

    return exec_record

def transition_to_next_node(
    db: Session,
    execution: WorkflowExecution,
    source_node_id: str,
    outcome: str,
    edges: List[Dict[str, Any]],
    nodes: Dict[str, Any],
    worker_id: Optional[str] = None
):
    """Finds outgoing transition matching outcome or default, creates next NodeExecution."""
    outgoing = [e for e in edges if e.get("source") == source_node_id]
    if not outgoing:
        return

    # 1. Match specific outcome
    target_edge = next((e for e in outgoing if e.get("source_handle") == outcome), None)

    # 2. Match DEFAULT fallback
    if not target_edge:
        target_edge = next((e for e in outgoing if e.get("source_handle") in ["DEFAULT", "default"]), None)

    # 3. Match any single outgoing edge
    if not target_edge and len(outgoing) == 1:
        target_edge = outgoing[0]

    if not target_edge:
        logger.warning(f"No valid outgoing edge found from '{source_node_id}' for outcome '{outcome}'.")
        return

    next_node_id = target_edge.get("target")
    next_node_def = nodes.get(next_node_id)
    if not next_node_def:
        logger.error(f"Target node '{next_node_id}' does not exist in graph.")
        return

    execution.current_node_id = next_node_id
    next_node_exec = NodeExecution(
        workflow_execution_id=execution.id,
        node_id=next_node_id,
        node_type=next_node_def.get("type"),
        status="Ready",
        started_at=datetime.now(timezone.utc)
    )
    db.add(next_node_exec)
    db.commit()

    # Emit outbox event
    event = WorkflowEvent(
        organization_id=execution.organization_id,
        workflow_execution_id=execution.id,
        event_type="NODE_TRANSITIONED",
        payload={"from_node": source_node_id, "to_node": next_node_id, "outcome": outcome}
    )
    db.add(event)
    db.commit()

    # Advance immediately if it's an automated node
    if next_node_def.get("type") in ["APPLICATION_RECEIVED", "AI_RESUME_SCREENING", "CONDITION", "END"]:
        advance_execution(db, execution.id, worker_id=worker_id or execution.worker_lease_id)

def evaluate_condition_node(context: Dict[str, Any], config: Dict[str, Any]) -> str:
    """Evaluates declarative rules against context dictionary safely without eval."""
    branches = config.get("branches", [])
    default_branch = "DEFAULT"

    for b in branches:
        if b.get("is_default"):
            default_branch = b.get("branch_name", "DEFAULT")
            continue

        rules = b.get("rules", [])
        if not rules:
            continue

        logic = b.get("condition_logic", "AND")
        rule_evals = []

        for r in rules:
            fpath = r.get("field_path", "")
            op = r.get("operator", "equals")
            expected_val = r.get("value")

            # Extract actual value from dot-notation path
            parts = fpath.split(".")
            curr = context
            for p in parts:
                if isinstance(curr, dict):
                    curr = curr.get(p)
                else:
                    curr = None
                    break
            actual_val = curr

            match = False
            if op == "equals":
                match = (str(actual_val).lower() == str(expected_val).lower())
            elif op == "not_equals":
                match = (str(actual_val).lower() != str(expected_val).lower())
            elif op == "contains":
                match = (expected_val is not None and str(expected_val).lower() in str(actual_val or "").lower())
            elif op == "is_present":
                match = (actual_val is not None and str(actual_val).strip() != "")
            elif op == "is_missing":
                match = (actual_val is None or str(actual_val).strip() == "")
            elif op in ["greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal"]:
                try:
                    f_act = float(actual_val)
                    f_exp = float(expected_val)
                    if op == "greater_than": match = (f_act > f_exp)
                    elif op == "greater_than_or_equal": match = (f_act >= f_exp)
                    elif op == "less_than": match = (f_act < f_exp)
                    elif op == "less_than_or_equal": match = (f_act <= f_exp)
                except Exception:
                    match = False

            rule_evals.append(match)

        if logic == "AND" and all(rule_evals):
            return b.get("branch_name", "TRUE")
        elif logic == "OR" and any(rule_evals):
            return b.get("branch_name", "TRUE")

    return default_branch
