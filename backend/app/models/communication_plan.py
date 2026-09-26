"""
CommunicationPlan model.

Represents a validated, auditable plan created before an AI call is initiated.
Per Sections 5 & 6 of the dynamic AI communication spec:
- Contains candidate and job references, workflow version, node execution.
- Captures purpose, authorized results, current & next stages.
- Holds facts the agent may mention, questions to ask, actions allowed.
- Explicitly lists forbidden disclosures.
- Stores rendered opening, message, and completion requirements.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Text, DateTime, ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from backend.app.database import Base


class CommunicationPlan(Base):
    __tablename__ = "communication_plans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Context scope
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, index=True)
    workflow_execution_id = Column(String(36), ForeignKey("workflow_executions.id"), nullable=False, index=True)
    node_execution_id = Column(String(36), ForeignKey("node_executions.id"), nullable=False, index=True)

    # Communication purpose:
    # INITIAL_SCREENING | SCHEDULE_INTERVIEW | RESULT_NOTIFICATION |
    # RESULT_AND_SCHEDULING | INTERVIEW_REMINDER | REQUEST_CLARIFICATION | FINAL_SELECTION_NOTIFICATION
    purpose = Column(String(50), nullable=False, index=True)

    # Stage context
    source_stage_id = Column(String(100), nullable=True)
    source_stage_name = Column(String(255), nullable=True)
    target_stage_id = Column(String(100), nullable=True)
    target_stage_name = Column(String(255), nullable=True)

    # Approved human decision reference (when required)
    required_approval = Column(Boolean, nullable=False, default=False)
    approved_decision_id = Column(String(36), ForeignKey("hr_decisions.id"), nullable=True)
    approved_result = Column(String(50), nullable=True)  # e.g., PASS, SHORTLISTED

    # Structured conversational payload
    facts_to_mention = Column(JSON, nullable=False, default=list)
    questions_to_ask = Column(JSON, nullable=False, default=list)
    allowed_actions = Column(JSON, nullable=False, default=list)
    forbidden_disclosures = Column(JSON, nullable=False, default=list)

    # Rendered copy
    rendered_opening = Column(Text, nullable=True)
    rendered_message = Column(Text, nullable=True)
    dynamic_variables = Column(JSON, nullable=False, default=dict)

    # Operational rules
    completion_requirements = Column(JSON, nullable=False, default=dict)
    retry_policy = Column(JSON, nullable=False, default=dict)

    # Plan lifecycle state: DRAFT | VALIDATED | EXECUTING | COMPLETED | BLOCKED | EXPIRED | CANCELED
    status = Column(String(50), nullable=False, default="VALIDATED", index=True)
    block_reason = Column(Text, nullable=True)
    is_dry_run = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    organization = relationship("Organization")
    candidate = relationship("Candidate")
    job = relationship("Job")
    workflow_execution = relationship("WorkflowExecution")
    node_execution = relationship("NodeExecution")
    approved_decision = relationship("HRDecision", foreign_keys=[approved_decision_id])
    call_attempts = relationship("CallAttempt", back_populates="communication_plan")

    __table_args__ = (
        UniqueConstraint("workflow_execution_id", "node_execution_id", name="uq_comm_plan_exec_node"),
    )
