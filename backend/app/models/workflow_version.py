import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.database import Base

class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String(36), ForeignKey("workflows.id"), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)

    version_number = Column(Integer, nullable=False, default=1)
    publication_state = Column(String(50), default="Draft", nullable=False)  # Draft, Published, Archived
    definition_checksum = Column(String(64), nullable=True)  # SHA-256

    # Graph specification: {"nodes": [...], "edges": [...]}
    graph_data = Column(JSON, nullable=False, default=lambda: {"nodes": [], "edges": []})
    validation_errors = Column(JSON, nullable=True, default=list)

    rubric_version = Column(Integer, default=1, nullable=False)
    prompt_policy_version = Column(Integer, default=1, nullable=False)

    published_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    workflow = relationship("Workflow", back_populates="versions")
    published_by = relationship("User")
    executions = relationship("WorkflowExecution", back_populates="workflow_version")

    __table_args__ = (
        UniqueConstraint("workflow_id", "version_number", name="uq_workflow_version_number"),
    )
