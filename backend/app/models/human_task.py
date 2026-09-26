import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class HumanTask(Base):
    __tablename__ = "human_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    workflow_execution_id = Column(String(36), ForeignKey("workflow_executions.id"), nullable=False, index=True)
    node_execution_id = Column(String(36), ForeignKey("node_executions.id"), nullable=False, index=True)

    task_type = Column(String(100), nullable=False)  # HR_REVIEW, INTERVIEW_SCHEDULING, MANUAL_TASK, HR_FINAL_DECISION
    title = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=True)

    assigned_to_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="Pending", nullable=False, index=True)  # Pending, Completed, Canceled
    due_date = Column(DateTime(timezone=True), nullable=True)

    outcome = Column(String(100), nullable=True)  # SHORTLIST, REJECT, SCHEDULED, OFFER_EXTENDED, APPROVED
    outcome_data = Column(JSON, nullable=True)

    completed_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    completed_by = relationship("User", foreign_keys=[completed_by_id])
    node_execution = relationship("NodeExecution", back_populates="human_tasks")
    workflow_execution = relationship("WorkflowExecution")
