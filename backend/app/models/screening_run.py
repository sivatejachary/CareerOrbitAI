import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class ScreeningRun(Base):
    __tablename__ = "screening_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, index=True)
    job_revision = Column(Integer, nullable=False)
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=True)

    engine_version = Column(String(50), nullable=False, default="rules_engine_v1")
    status = Column(String(50), nullable=False, default="Completed")
    recommendation = Column(String(50), nullable=False)  # SHORTLIST, REVIEW, NOT_MATCHED
    rationale = Column(Text, nullable=False)
    criterion_results = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    application = relationship("JobApplication", back_populates="screening_runs")
    job = relationship("Job")
    resume = relationship("Resume")
