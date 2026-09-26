import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_company_default = Column(Boolean, default=False, nullable=False)
    status = Column(String(50), default="Active", nullable=False)  # Active, Inactive, Archived

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization")
    created_by = relationship("User")
    versions = relationship("WorkflowVersion", back_populates="workflow", cascade="all, delete-orphan", order_by="desc(WorkflowVersion.version_number)")
    job_bindings = relationship("JobWorkflowBinding", back_populates="workflow", cascade="all, delete-orphan")
