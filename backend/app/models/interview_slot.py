"""
InterviewSlot model.

Tracks interviewer availability, eligible slots, and bookings for
job-specific interview stages per Section 10 of the spec.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base


class InterviewSlot(Base):
    __tablename__ = "interview_slots"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=True, index=True)
    stage_id = Column(String(100), nullable=True, index=True)

    interviewer_name = Column(String(255), nullable=False)
    interviewer_email = Column(String(255), nullable=False)

    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=45)
    timezone = Column(String(50), nullable=False, default="Asia/Kolkata")

    format = Column(String(50), nullable=False, default="Video")  # Video, Phone, In-Person
    meeting_link = Column(String(500), nullable=True)

    # Booking status
    is_booked = Column(Boolean, nullable=False, default=False, index=True)
    booked_candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True, index=True)
    booked_at = Column(DateTime(timezone=True), nullable=True)
    booking_reference = Column(String(100), nullable=True, unique=True, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    organization = relationship("Organization")
    job = relationship("Job")
    booked_candidate = relationship("Candidate")
