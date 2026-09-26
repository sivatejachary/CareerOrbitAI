import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class HRDecision(Base):
    __tablename__ = "hr_decisions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=False, index=True)
    decided_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    decision = Column(String(50), nullable=False)  # Shortlisted, UnderReview, Rejected, PASS, FAIL
    reason = Column(Text, nullable=True)
    screening_run_id = Column(String(36), ForeignKey("screening_runs.id"), nullable=True)
    stage_id = Column(String(100), nullable=True, index=True)
    stage_name = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    application = relationship("JobApplication", back_populates="decisions")
    decided_by = relationship("User")
    screening_run = relationship("ScreeningRun")
