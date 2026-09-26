import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class CallAttempt(Base):
    __tablename__ = "call_attempts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    workflow_execution_id = Column(String(36), ForeignKey("workflow_executions.id"), nullable=True, index=True)
    node_execution_id = Column(String(36), ForeignKey("node_executions.id"), nullable=True, index=True)

    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, index=True)
    phone_number = Column(String(50), nullable=False, index=True)

    batch_id = Column(String(36), ForeignKey("ai_call_batches.id"), nullable=True, index=True)

    attempt_number = Column(Integer, default=1, nullable=False)
    idempotency_key = Column(String(255), unique=True, nullable=False, index=True)

    # Independent State Categories:
    # 1. Operation State: Scheduled, Initiating, Accepted, InitiationUnknown, Failed, Canceled
    operation_state = Column(String(50), default="Scheduled", nullable=False, index=True)
    # 2. Connection State: Unknown, Ringing, Connected, Ended
    connection_state = Column(String(50), default="Unknown", nullable=False, index=True)
    # 3. Disposition: NoAnswer, Busy, Voicemail, WrongNumber, ConversationCompleted, CandidateEnded, TechnicalFailure
    disposition = Column(String(50), nullable=True, index=True)
    # 4. Processing State: AwaitingTranscript, Processing, Ready, NeedsReview, Failed
    processing_state = Column(String(50), default="AwaitingTranscript", nullable=False, index=True)
    # 5. Communication outcome (per spec Section 11):
    # OBJECTIVE_COMPLETED, CALLBACK_REQUESTED, NO_ANSWER, BUSY, WRONG_PERSON, DECLINED, WITHDRAWN, OPTED_OUT, NEEDS_RECRUITER, TECHNICAL_FAILURE
    communication_outcome = Column(String(50), nullable=True, index=True)
    communication_plan_id = Column(String(36), ForeignKey("communication_plans.id"), nullable=True, index=True)

    provider = Column(String(50), default="ElevenLabs", nullable=False)
    provider_call_id = Column(String(255), nullable=True, index=True)
    provider_conversation_id = Column(String(255), nullable=True, index=True)
    agent_id = Column(String(255), nullable=True)
    voice_id = Column(String(255), nullable=True)

    duration_seconds = Column(Integer, nullable=True)
    cost_cents = Column(Integer, nullable=True)
    error_details = Column(Text, nullable=True)

    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    initiated_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization")
    candidate = relationship("Candidate")
    job = relationship("Job")
    batch = relationship("AICallBatch", foreign_keys=[batch_id])
    node_execution = relationship("NodeExecution", back_populates="call_attempts")
    transcript = relationship("CallTranscript", uselist=False, back_populates="call_attempt", cascade="all, delete-orphan")
    evaluation = relationship("CallEvaluation", uselist=False, back_populates="call_attempt", cascade="all, delete-orphan")
    communication_plan = relationship("CommunicationPlan", back_populates="call_attempts")
