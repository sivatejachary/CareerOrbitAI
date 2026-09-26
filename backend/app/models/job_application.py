import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, index=True)
    job_revision_at_submission = Column(Integer, nullable=False, default=1)

    source = Column(String(50), nullable=False)  # GoogleForms, CareerPage, Manual
    idempotency_key = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="Submitted", index=True)  # Submitted, UnderReview, Shortlisted, Rejected, Withdrawn

    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=True)
    form_id = Column(String(36), ForeignKey("application_forms.id"), nullable=True)

    answers_payload = Column(JSON, nullable=True)
    profile_snapshot = Column(JSON, nullable=True)

    received_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    submitted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    candidate = relationship("Candidate", back_populates="applications")
    job = relationship("Job")
    resume = relationship("Resume")
    form = relationship("ApplicationForm")
    screening_runs = relationship("ScreeningRun", back_populates="application", cascade="all, delete-orphan")
    decisions = relationship("HRDecision", back_populates="application", cascade="all, delete-orphan")
    notes = relationship("HRNote", back_populates="application", cascade="all, delete-orphan")
