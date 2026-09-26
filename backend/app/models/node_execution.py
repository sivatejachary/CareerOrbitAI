import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class NodeExecution(Base):
    __tablename__ = "node_executions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_execution_id = Column(String(36), ForeignKey("workflow_executions.id"), nullable=False, index=True)

    node_id = Column(String(100), nullable=False, index=True)
    node_type = Column(String(100), nullable=False)

    # Node status: Pending, Ready, Running, WaitingForEvent, WaitingForHuman, WaitingUntilTime, Succeeded, Blocked, Failed, Canceled, Skipped
    status = Column(String(50), default="Pending", nullable=False, index=True)
    attempt_number = Column(Integer, default=1, nullable=False)

    input_snapshot = Column(JSON, nullable=True)
    output_snapshot = Column(JSON, nullable=True)
    selected_outcome = Column(String(100), nullable=True)
    error_details = Column(Text, nullable=True)

    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    workflow_execution = relationship("WorkflowExecution", back_populates="node_executions")
    human_tasks = relationship("HumanTask", back_populates="node_execution", cascade="all, delete-orphan")
    call_attempts = relationship("CallAttempt", back_populates="node_execution", cascade="all, delete-orphan")
