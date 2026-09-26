import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    job_application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=False, unique=True, index=True)
    workflow_id = Column(String(36), ForeignKey("workflows.id"), nullable=False, index=True)
    workflow_version_id = Column(String(36), ForeignKey("workflow_versions.id"), nullable=False, index=True)

    # Execution status: Pending, Running, WaitingForEvent, WaitingForHuman, WaitingUntilTime, Succeeded, Blocked, Failed, Canceled, Paused
    status = Column(String(50), default="Pending", nullable=False, index=True)
    current_node_id = Column(String(100), nullable=True)

    # Runtime state: stores outputs of completed nodes, screening data, call outputs, variables
    context_data = Column(JSON, nullable=False, default=dict)

    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Operational controls: pause and cancel
    paused_at = Column(DateTime(timezone=True), nullable=True)
    pause_reason = Column(String(255), nullable=True)
    canceled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(String(255), nullable=True)

    # Worker leases for durable fenced execution
    worker_lease_id = Column(String(100), nullable=True)
    worker_lease_expires_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    workflow = relationship("Workflow")
    workflow_version = relationship("WorkflowVersion", back_populates="executions")
    job_application = relationship("JobApplication")
    node_executions = relationship("NodeExecution", back_populates="workflow_execution", cascade="all, delete-orphan", order_by="NodeExecution.created_at")
