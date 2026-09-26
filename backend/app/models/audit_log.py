import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from backend.app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    action = Column(String(100), nullable=False) # JOB_CREATE, JOB_UPDATE, JOB_STATUS_CHANGE, JOB_ARCHIVE, FORM_GENERATE, FORM_PUBLISH
    resource_type = Column(String(50), nullable=False) # Job, ApplicationForm
    resource_id = Column(String(36), nullable=False)

    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
