import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.database import Base

class JobWorkflowBinding(Base):
    __tablename__ = "job_workflow_bindings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, index=True)
    workflow_id = Column(String(36), ForeignKey("workflows.id"), nullable=False, index=True)
    workflow_version_id = Column(String(36), ForeignKey("workflow_versions.id"), nullable=True)  # Specific pinned version or null for latest published

    is_active = Column(Boolean, default=True, nullable=False)
    bound_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    job = relationship("Job")
    workflow = relationship("Workflow", back_populates="job_bindings")
    workflow_version = relationship("WorkflowVersion")

    __table_args__ = (
        UniqueConstraint("job_id", "workflow_id", name="uq_job_workflow"),
    )
