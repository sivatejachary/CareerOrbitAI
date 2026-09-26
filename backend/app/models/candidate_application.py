import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class CandidateApplication(Base):
    __tablename__ = "candidate_applications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=True, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    application_form_id = Column(String(36), ForeignKey("application_forms.id"), nullable=True, index=True)

    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    current_location = Column(String(255), nullable=True)
    
    total_experience = Column(Float, nullable=True)
    current_ctc = Column(String(100), nullable=True)
    expected_ctc = Column(String(100), nullable=True)
    notice_period = Column(String(100), nullable=True)
    resume_url = Column(String(500), nullable=True)

    source_channel = Column(String(50), nullable=False, default="GoogleForms") # GoogleForms, Direct, Manual
    status = Column(String(50), nullable=False, default="Submitted") # Submitted, UnderReview, Shortlisted, Rejected

    # Full raw response dictionary mapping question labels to answers
    answers_payload = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    job = relationship("Job", backref="candidates")
