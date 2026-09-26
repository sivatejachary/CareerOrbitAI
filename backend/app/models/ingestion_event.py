import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class IngestionEvent(Base):
    __tablename__ = "ingestion_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=True, index=True)

    event_type = Column(String(100), nullable=False)  # e.g., APPLICATION_RECEIVED, RESUME_PARSED, SCREENED
    status = Column(String(50), nullable=False, default="Pending", index=True)  # Pending, Dispatched, Completed, Failed
    payload = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime(timezone=True), nullable=True)

    application = relationship("JobApplication")
