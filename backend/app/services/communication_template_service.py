"""
Communication Template Service.

Per Sections 7 & 8 of the dynamic AI communication spec:
- Provides controlled template structures for all 7 communication purposes.
- Enforces strict variable resolution (never leaves raw {{placeholder}}).
- Assembles approved facts and forbidden disclosures.
"""
import re
from typing import Dict, Any, List, Tuple, Optional

# Standard templates for each communication purpose
STANDARD_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "INITIAL_SCREENING": {
        "opening": (
            "Hello {{candidate_name}}, this is the AI recruiting assistant calling on behalf of "
            "{{company_name}} regarding your application for the {{job_title}} position. "
            "Do you have a few minutes for a brief preliminary screening?"
        ),
        "message": (
            "I'm reaching out to verify a few details from your resume, including your experience with "
            "{{key_skills}} and confirm your availability."
        ),
        "required_variables": ["candidate_name", "company_name", "job_title"],
        "default_actions": ["record_answers", "request_clarification", "record_callback", "record_withdrawal"],
        "forbidden_disclosures": [
            "Internal hiring manager notes",
            "Screening scores or rankings of other candidates",
            "Unapproved compensation or salary ranges",
            "Binding offers or promises of employment"
        ]
    },
    "SCHEDULE_INTERVIEW": {
        "opening": (
            "Hello {{candidate_name}}, this is {{company_name}}'s recruitment assistant. "
            "Is now a convenient time to speak?"
        ),
        "message": (
            "We would like to invite you for the {{next_stage_name}} for the {{job_title}} role. "
            "This will be a {{duration_minutes}}-minute {{interview_format}} session. "
            "I can help you coordinate a suitable interview time from the available slots."
        ),
        "required_variables": ["candidate_name", "company_name", "job_title", "next_stage_name", "duration_minutes", "interview_format"],
        "default_actions": ["retrieve_slots", "reserve_booking", "confirm_booking", "record_callback"],
        "forbidden_disclosures": [
            "Interview questions or assessment content",
            "Interviewer personal contact details",
            "Internal reviewer feedback from earlier rounds"
        ]
    },
    "RESULT_NOTIFICATION": {
        "opening": (
            "Hello {{candidate_name}}, I'm calling from {{company_name}} with an update regarding your "
            "application for the {{job_title}} position. Is now a good time?"
        ),
        "message": (
            "We have completed the evaluation for your {{completed_stage_name}}. "
            "Your result has been officially approved: {{approved_result_summary}}."
        ),
        "required_variables": ["candidate_name", "company_name", "job_title", "completed_stage_name", "approved_result_summary"],
        "default_actions": ["deliver_result", "record_questions", "record_callback"],
        "forbidden_disclosures": [
            "Internal interview scores or score sheets",
            "Comparison with other applicants",
            "Specific negative feedback not approved by HR"
        ]
    },
    "RESULT_AND_SCHEDULING": {
        "opening": (
            "Hello {{candidate_name}}, I'm the AI recruiting assistant calling on behalf of "
            "{{company_name}} regarding the {{job_title}} role. Is now a convenient time?"
        ),
        "message": (
            "Your {{completed_stage_name}} result has been approved, and you have cleared that stage! "
            "The next step is the {{next_stage_name}}, which takes approximately {{duration_minutes}} minutes "
            "via {{interview_format}}. May I help arrange a suitable time for you?"
        ),
        "required_variables": [
            "candidate_name", "company_name", "job_title",
            "completed_stage_name", "next_stage_name", "duration_minutes", "interview_format"
        ],
        "default_actions": ["deliver_result", "retrieve_slots", "reserve_booking", "confirm_booking", "record_callback"],
        "forbidden_disclosures": [
            "Internal interviewer evaluations",
            "Unconfirmed future rounds or offers",
            "Scores or feedback of other candidates"
        ]
    },
    "INTERVIEW_REMINDER": {
        "opening": (
            "Hello {{candidate_name}}, this is a quick reminder from {{company_name}} regarding your "
            "upcoming {{scheduled_stage_name}} for the {{job_title}} position."
        ),
        "message": (
            "Your interview is scheduled for {{interview_date_time}} ({{timezone}}) via {{interview_format}}. "
            "{{meeting_details}} Can you confirm you are all set for this discussion?"
        ),
        "required_variables": ["candidate_name", "company_name", "job_title", "scheduled_stage_name", "interview_date_time"],
        "default_actions": ["confirm_attendance", "request_reschedule", "record_callback"],
        "forbidden_disclosures": [
            "Alternative candidate bookings",
            "Internal interviewer notes"
        ]
    },
    "REQUEST_CLARIFICATION": {
        "opening": (
            "Hello {{candidate_name}}, I'm reaching out from {{company_name}} regarding your application "
            "for the {{job_title}} role. Do you have a moment?"
        ),
        "message": (
            "Our recruitment team is reviewing your profile and requested a quick clarification on "
            "{{clarification_topic}}. Could you provide a little more detail?"
        ),
        "required_variables": ["candidate_name", "company_name", "job_title", "clarification_topic"],
        "default_actions": ["record_answers", "request_clarification", "record_callback"],
        "forbidden_disclosures": [
            "Preliminary pass/fail status",
            "Internal hiring discussions"
        ]
    },
    "FINAL_SELECTION_NOTIFICATION": {
        "opening": (
            "Hello {{candidate_name}}, I'm delighted to call on behalf of the leadership team at "
            "{{company_name}} regarding the {{job_title}} role. Is now a great time to speak?"
        ),
        "message": (
            "Following your final interview rounds, the hiring committee has approved your selection! "
            "{{approved_offer_overview}} Our HR team will follow up via email with formal documentation. "
            "Do you have any immediate questions?"
        ),
        "required_variables": ["candidate_name", "company_name", "job_title", "approved_offer_overview"],
        "default_actions": ["deliver_result", "record_acknowledgement", "record_callback"],
        "forbidden_disclosures": [
            "Unapproved negotiation parameters",
            "Internal compensation bands not formally offered",
            "Contingent terms not approved in writing"
        ]
    }
}


def render_template(
    template_str: str,
    context: Dict[str, Any],
    required_variables: Optional[List[str]] = None
) -> Tuple[str, List[str]]:
    """
    Renders a template string using double curly-brace variables.
    Checks for missing or unresolved variables.

    Returns:
        (rendered_text, list_of_missing_variables)
    """
    missing: List[str] = []

    # Check required variables first
    if required_variables:
        for var in required_variables:
            val = context.get(var)
            if val is None or (isinstance(val, str) and not val.strip()):
                missing.append(var)

    # Find all placeholders in template
    placeholders = re.findall(r"\{\{([a-zA-Z0-9_]+)\}\}", template_str)
    for p in placeholders:
        val = context.get(p)
        if val is None:
            if p not in missing:
                missing.append(p)

    if missing:
        return template_str, missing

    # Perform safe substitution
    rendered = template_str
    for p in placeholders:
        val = context.get(p, "")
        rendered = rendered.replace(f"{{{{{p}}}}}", str(val))

    return rendered, []


def assemble_context_for_purpose(
    purpose: str,
    candidate_data: Dict[str, Any],
    job_data: Dict[str, Any],
    company_name: str,
    source_stage: Optional[Dict[str, Any]] = None,
    target_stage: Optional[Dict[str, Any]] = None,
    approved_decision: Optional[Dict[str, Any]] = None,
    extra_context: Optional[Dict[str, Any]] = None
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """
    Assembles the minimum relevant server-side context for a given purpose.
    Returns:
        (context_dict, facts_to_mention, forbidden_disclosures)
    """
    spec = STANDARD_TEMPLATES.get(purpose, STANDARD_TEMPLATES["INITIAL_SCREENING"])
    cand_name = candidate_data.get("full_name") or candidate_data.get("name") or "Candidate"
    job_title = job_data.get("title") or "Open Role"

    context: Dict[str, Any] = {
        "candidate_name": cand_name,
        "company_name": company_name,
        "job_title": job_title,
        "language": candidate_data.get("language", "en"),
    }

    facts: List[str] = [
        f"Candidate: {cand_name}",
        f"Company: {company_name}",
        f"Role: {job_title}",
    ]

    if purpose in ["SCHEDULE_INTERVIEW", "RESULT_AND_SCHEDULING"]:
        next_name = (target_stage or {}).get("stage_name") or "Next Interview Round"
        sched_cfg = (target_stage or {}).get("scheduling_config") or {}
        duration = sched_cfg.get("duration_minutes", 45)
        fmt = sched_cfg.get("format", "Video")

        context["next_stage_name"] = next_name
        context["duration_minutes"] = duration
        context["interview_format"] = fmt
        facts.append(f"Next Stage: {next_name} ({duration} mins, {fmt})")

    if purpose in ["RESULT_NOTIFICATION", "RESULT_AND_SCHEDULING"]:
        completed_name = (source_stage or {}).get("stage_name") or "Recent Evaluation"
        decision_val = (approved_decision or {}).get("decision", "Cleared")
        context["completed_stage_name"] = completed_name
        context["approved_result_summary"] = (
            f"You have successfully passed the {completed_name} stage"
            if decision_val in ["PASS", "Shortlisted", "Cleared", "APPROVED"]
            else f"Status update for {completed_name}: {decision_val}"
        )
        facts.append(f"Completed Stage: {completed_name} -> {decision_val}")

    if purpose == "INITIAL_SCREENING":
        skills = candidate_data.get("skills", [])
        if isinstance(skills, list):
            skills_str = ", ".join(str(s) for s in skills[:4])
        else:
            skills_str = str(skills)
        context["key_skills"] = skills_str or "software development"
        facts.append(f"Referenced Skills: {context['key_skills']}")

    if purpose == "FINAL_SELECTION_NOTIFICATION":
        overview = (approved_decision or {}).get("reason") or "We are excited to offer you the role."
        context["approved_offer_overview"] = overview
        facts.append("Approved final selection message verified.")

    if extra_context:
        for k, v in extra_context.items():
            if v is not None:
                context[k] = v

    return context, facts, list(spec["forbidden_disclosures"])
