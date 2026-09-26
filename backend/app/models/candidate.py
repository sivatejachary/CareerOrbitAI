import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    candidate_code = Column(String(50), nullable=False, index=True)

    full_name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True, index=True)

    current_location = Column(String(255), nullable=True)
    total_experience = Column(Float, nullable=True)
    skills = Column(JSON, nullable=True, default=list)
    current_company = Column(String(255), nullable=True)
    notice_period = Column(String(50), nullable=True)

    resume_id = Column(String(36), nullable=True)  # Primary / latest resume ID
    first_source = Column(String(50), nullable=True)  # e.g., "GoogleForms", "CareerPage"
    revision = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    archived_at = Column(DateTime(timezone=True), nullable=True, index=True)

    organization = relationship("Organization")
    applications = relationship("JobApplication", back_populates="candidate", cascade="all, delete-orphan")
    resumes = relationship("Resume", back_populates="candidate", cascade="all, delete-orphan", foreign_keys="Resume.candidate_id")
