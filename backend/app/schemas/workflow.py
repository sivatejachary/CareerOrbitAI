from typing import List, Dict, Any, Optional, Union, Literal
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, model_validator

# ==========================================
# Step Registry & Node Configurations
# ==========================================

class RetryPolicy(BaseModel):
    max_attempts: int = Field(default=3, ge=1, le=10)
    retry_interval_minutes: int = Field(default=30, ge=1, le=1440)
    retryable_outcomes: List[str] = Field(default_factory=lambda: ["NoAnswer", "Busy", "TechnicalFailure"])

class TimeoutPolicy(BaseModel):
    timeout_minutes: int = Field(default=60, ge=1, le=10080)
    timeout_action: str = Field(default="ESCALATE_TO_HR", pattern="^(ESCALATE_TO_HR|RETRY|FAIL)$")

class CallingQuestionItem(BaseModel):
    key: str
    text: str
    purpose: str
    required: bool = True
    answer_type: Literal["text", "number", "choice", "date", "availability"] = "text"
    choices: Optional[List[str]] = None
    follow_up_guidance: Optional[str] = None
    max_follow_ups: int = 1
    evaluation_criterion: Optional[str] = None
    sensitivity: Literal["standard", "confidential"] = "standard"

CommunicationPurpose = Literal[
    "INITIAL_SCREENING",
    "SCHEDULE_INTERVIEW",
    "RESULT_NOTIFICATION",
    "RESULT_AND_SCHEDULING",
    "INTERVIEW_REMINDER",
    "REQUEST_CLARIFICATION",
    "FINAL_SELECTION_NOTIFICATION"
]

StageType = Literal[
    "RESUME_SCREENING",
    "AI_SCREENING",
    "ASSESSMENT",
    "INTERVIEW",
    "HUMAN_REVIEW",
    "FINAL_DECISION",
    "COMMUNICATION",
    "END"
]

class WorkflowStageDefinition(BaseModel):
    stage_id: str
    stage_name: str
    stage_type: StageType
    round_number: Optional[int] = None
    instructions: Optional[str] = None
    completion_criteria: Dict[str, Any] = Field(default_factory=dict)
    responsible_group: Optional[str] = "Hiring Team"
    decision_authority: Optional[str] = "RECRUITER"  # RECRUITER, HIRING_MANAGER, PANEL_LEAD, HR_DIRECTOR
    allowed_outcomes: List[str] = Field(default_factory=lambda: ["PASS", "FAIL", "REVIEW"])
    scheduling_config: Optional[Dict[str, Any]] = None  # duration_minutes, format, interviewer_group

class AICallingNodeConfig(BaseModel):
    step_name: str = "Candidate Screening Call"
    call_purpose: str = "Initial qualification & availability verification"
    # Reusable communication purpose per spec Section 3
    purpose: CommunicationPurpose = "INITIAL_SCREENING"
    source_stage_id: Optional[str] = None
    source_stage_name: Optional[str] = None
    target_stage_id: Optional[str] = None
    target_stage_name: Optional[str] = None
    required_approval: bool = False
    required_approval_stage_id: Optional[str] = None

    permitted_context_fields: List[str] = Field(default_factory=lambda: [
        "candidate_name", "company_name", "job_title", "language"
    ])
    allowed_actions: List[str] = Field(default_factory=lambda: [
        "record_answers", "request_clarification", "record_callback"
    ])
    completion_criteria: Dict[str, Any] = Field(default_factory=dict)
    template_version: int = 1
    template_override: Optional[str] = None
    dry_run: bool = False

    provider_connection: str = "ElevenLabs"
    agent_id: Optional[str] = None
    voice_id: Optional[str] = None
    outbound_phone_id: Optional[str] = None
    language: str = "en"
    first_message_template: str = (
        "Hi {{candidate_name}}, I'm an AI recruitment assistant calling on behalf of "
        "{{company_name}} regarding your application for the {{job_title}} role. Is this a convenient time to speak?"
    )
    max_duration_seconds: int = Field(default=600, ge=60, le=1800)
    allowed_calling_windows: Dict[str, str] = Field(default_factory=lambda: {"start": "09:00", "end": "19:00"})
    timezone: str = "Asia/Kolkata"
    recording_policy: Literal["always", "with_consent", "never"] = "with_consent"
    questions: List[CallingQuestionItem] = Field(default_factory=list)
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)

class ConditionRule(BaseModel):
    field_path: str  # e.g., 'screening.recommendation', 'call.interest', 'candidate.total_experience'
    operator: Literal["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "contains", "is_present", "is_missing"]
    value: Optional[Any] = None

class ConditionBranch(BaseModel):
    branch_name: str
    condition_logic: Literal["AND", "OR"] = "AND"
    rules: List[ConditionRule] = Field(default_factory=list)
    is_default: bool = False

class ConditionNodeConfig(BaseModel):
    branches: List[ConditionBranch] = Field(default_factory=list)

class ScreeningNodeConfig(BaseModel):
    min_score_shortlist: int = Field(default=75, ge=0, le=100)
    min_score_review: int = Field(default=50, ge=0, le=100)
    require_experience_match: bool = True
    rubric_notes: Optional[str] = None

class HumanTaskNodeConfig(BaseModel):
    title: str = "Recruiter Review"
    instructions: Optional[str] = None
    due_in_hours: int = Field(default=24, ge=1, le=720)
    allowed_outcomes: List[str] = Field(default_factory=lambda: ["APPROVED", "REJECTED", "HOLD"])

class DelayNodeConfig(BaseModel):
    delay_hours: int = Field(default=1, ge=0, le=720)
    delay_minutes: int = Field(default=0, ge=0, le=1440)

# ==========================================
# Graph Definition (Nodes & Edges)
# ==========================================

class WorkflowNode(BaseModel):
    id: str
    type: Literal[
        "APPLICATION_RECEIVED",
        "AI_RESUME_SCREENING",
        "HR_REVIEW",
        "INTERVIEW",
        "ASSESSMENT",
        "SEND_MESSAGE",
        "CONDITION",
        "AI_CALLING",
        "WAIT_DELAY",
        "CANDIDATE_AVAILABILITY",
        "MANUAL_TASK",
        "HR_FINAL_DECISION",
        "END"
    ]
    title: str
    description: Optional[str] = None
    position: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    config: Dict[str, Any] = Field(default_factory=dict)

class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    source_handle: Optional[str] = None  # e.g. "SHORTLIST", "REVIEW", "NOT_MATCHED", "TRUE", "DEFAULT"
    target_handle: Optional[str] = None
    label: Optional[str] = None

class WorkflowGraphData(BaseModel):
    nodes: List[WorkflowNode] = Field(default_factory=list)
    edges: List[WorkflowEdge] = Field(default_factory=list)

# ==========================================
# Workflow CRUD & Publication Schemas
# ==========================================

class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    is_company_default: bool = False

class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    is_company_default: Optional[bool] = None
    status: Optional[str] = None

class WorkflowVersionDraftSave(BaseModel):
    graph_data: WorkflowGraphData

class WorkflowValidationResult(BaseModel):
    is_valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    node_count: int = 0
    edge_count: int = 0

class WorkflowResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    is_company_default: bool
    status: str
    job_usage_count: int = 0
    latest_version_number: int = 1
    published_version_number: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowVersionResponse(BaseModel):
    id: str
    workflow_id: str
    organization_id: str
    version_number: int
    publication_state: str
    definition_checksum: Optional[str] = None
    graph_data: Dict[str, Any]
    validation_errors: Optional[List[str]] = None
    published_by_id: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# Execution & Human Task Schemas
# ==========================================

class CompleteHumanTaskRequest(BaseModel):
    outcome: str = Field(..., min_length=1)  # e.g., "SHORTLIST", "APPROVED", "REJECTED"
    outcome_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class WorkflowExecutionSummary(BaseModel):
    id: str
    workflow_id: str
    workflow_name: str
    workflow_version_number: int
    job_application_id: str
    job_id: str
    job_title: str
    candidate_id: str
    candidate_name: str
    candidate_email: str
    status: str
    current_node_id: Optional[str] = None
    current_node_title: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    created_at: datetime

class CallAttemptResponse(BaseModel):
    id: str
    workflow_execution_id: Optional[str] = None
    candidate_id: str
    candidate_name: Optional[str] = None
    job_id: str
    job_title: Optional[str] = None
    phone_number: str
    attempt_number: int
    operation_state: str
    connection_state: str
    disposition: Optional[str] = None
    processing_state: str
    provider: str
    provider_call_id: Optional[str] = None
    duration_seconds: Optional[int] = None
    scheduled_at: Optional[datetime] = None
    initiated_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    has_transcript: bool = False
    has_evaluation: bool = False

    class Config:
        from_attributes = True

# ==========================================
# Communication System & Scheduling Schemas
# ==========================================

class CompanyCommunicationSettingBase(BaseModel):
    company_intro: str = "We are an innovative team hiring top talent."
    tone: str = "Professional"
    supported_languages: List[str] = Field(default_factory=lambda: ["en", "hi"])
    calling_hours_start: str = "09:00"
    calling_hours_end: str = "19:00"
    timezone: str = "Asia/Kolkata"
    max_retry_attempts: int = 3
    min_hours_between_calls: int = 4
    contact_policy: Dict[str, Any] = Field(default_factory=lambda: {
        "require_consent": True,
        "allow_recording": True,
        "respect_do_not_call": True,
        "disclosure_text": "This call is recorded for quality and recruitment evaluation purposes."
    })
    allowed_agent_actions: List[str] = Field(default_factory=lambda: [
        "record_answers", "request_clarification", "retrieve_slots",
        "reserve_booking", "confirm_booking", "deliver_result",
        "confirm_attendance", "record_callback", "record_withdrawal"
    ])
    default_templates: Dict[str, Any] = Field(default_factory=dict)

class CompanyCommunicationSettingCreate(CompanyCommunicationSettingBase):
    pass

class CompanyCommunicationSettingResponse(CompanyCommunicationSettingBase):
    id: str
    organization_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CommunicationPlanResponse(BaseModel):
    id: str
    organization_id: str
    candidate_id: str
    job_id: str
    workflow_execution_id: str
    node_execution_id: str
    purpose: str
    source_stage_id: Optional[str] = None
    source_stage_name: Optional[str] = None
    target_stage_id: Optional[str] = None
    target_stage_name: Optional[str] = None
    required_approval: bool = False
    approved_decision_id: Optional[str] = None
    approved_result: Optional[str] = None
    facts_to_mention: List[str] = Field(default_factory=list)
    questions_to_ask: List[Any] = Field(default_factory=list)
    allowed_actions: List[str] = Field(default_factory=list)
    forbidden_disclosures: List[str] = Field(default_factory=list)
    rendered_opening: Optional[str] = None
    rendered_message: Optional[str] = None
    dynamic_variables: Dict[str, Any] = Field(default_factory=dict)
    completion_requirements: Dict[str, Any] = Field(default_factory=dict)
    retry_policy: Dict[str, Any] = Field(default_factory=dict)
    status: str
    block_reason: Optional[str] = None
    is_dry_run: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CommunicationPreviewRequest(BaseModel):
    node_config: Dict[str, Any] = Field(default_factory=dict)
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    sample_context: Optional[Dict[str, Any]] = None

class CommunicationPreviewResponse(BaseModel):
    purpose: str
    why_call_happens: str
    facts_used: List[str]
    what_agent_will_say: str
    opening_statement: str
    questions_to_ask: List[Any]
    actions_permitted: List[str]
    forbidden_disclosures: List[str]
    what_completes_step: str
    unanswered_fallback: str
    prerequisites: Dict[str, Any]
    is_blocked: bool = False
    block_reason: Optional[str] = None

class InterviewSlotCreate(BaseModel):
    job_id: Optional[str] = None
    stage_id: Optional[str] = None
    interviewer_name: str
    interviewer_email: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int = 45
    format: str = "Video"
    meeting_link: Optional[str] = None
    timezone: str = "Asia/Kolkata"

class InterviewSlotResponse(BaseModel):
    id: str
    organization_id: str
    job_id: Optional[str] = None
    stage_id: Optional[str] = None
    interviewer_name: str
    interviewer_email: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    format: str
    meeting_link: Optional[str] = None
    timezone: str
    is_booked: bool
    booked_candidate_id: Optional[str] = None
    booking_reference: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BookSlotRequest(BaseModel):
    candidate_id: str
    job_id: str
    stage_id: Optional[str] = None
    notes: Optional[str] = None
