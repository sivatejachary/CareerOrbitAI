import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.database import Base

class SourceResponse(Base):
    __tablename__ = "source_responses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    google_connection_id = Column(String(36), ForeignKey("google_connections.id"), nullable=True, index=True)
    application_form_id = Column(String(36), ForeignKey("application_forms.id"), nullable=False, index=True)

    provider_response_id = Column(String(255), nullable=False)
    original_submitted_at = Column(DateTime(timezone=True), nullable=False)
    latest_submitted_at = Column(DateTime(timezone=True), nullable=False)

    raw_payload = Column(JSON, nullable=False)
    payload_hash = Column(String(64), nullable=False)
    mapping_version = Column(Integer, nullable=False, default=1)

    processing_status = Column(String(50), nullable=False, default="Pending", index=True)  # Pending, Processed, NeedsMapping, Quarantined, Failed
    job_application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=True)
    error_details = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime(timezone=True), nullable=True)

    organization = relationship("Organization")
    google_connection = relationship("GoogleConnection")
    application_form = relationship("ApplicationForm")
    job_application = relationship("JobApplication")

    __table_args__ = (
        UniqueConstraint("google_connection_id", "application_form_id", "provider_response_id", name="uq_source_response_provider_id"),
    )
