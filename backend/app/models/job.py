import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    updated_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    job_code = Column(String(50), unique=True, nullable=False, index=True)

    # Section A: Basic Details
    title = Column(String(255), nullable=False, index=True)
    department = Column(String(100), nullable=False)
    job_type = Column(String(50), nullable=False)
    employment_type = Column(String(50), nullable=True)
    work_mode = Column(String(50), nullable=False)
    openings = Column(Integer, nullable=False, default=1)
    priority = Column(String(20), nullable=False, default="Normal")

    # Section B: Location
    country = Column(String(100), nullable=False, default="India")
    state = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    office_location = Column(String(255), nullable=True)
    pin_code = Column(String(20), nullable=True)
    allow_relocation = Column(Boolean, nullable=False, default=False)

    # Section C: Experience & Education
    min_experience = Column(Float, nullable=True)
    max_experience = Column(Float, nullable=True)
    allow_freshers = Column(Boolean, nullable=False, default=False)
    min_qualification = Column(String(100), nullable=True)
    degree = Column(String(255), nullable=True)
    specialization = Column(String(255), nullable=True)

    # Section D: Compensation & Benefits
    salary_type = Column(String(50), nullable=True)
    min_salary = Column(Float, nullable=True)
    max_salary = Column(Float, nullable=True)
    currency = Column(String(10), nullable=False, default="INR")
    show_salary = Column(Boolean, nullable=False, default=True)
    benefits = Column(JSON, nullable=True, default=list)

    # Section E: Skills
    skills = Column(JSON, nullable=True, default=list)

    # Section F: Description
    description = Column(Text, nullable=False)

    # Section G: Responsibilities
    responsibilities = Column(JSON, nullable=False, default=list)

    # Section H: Additional Requirements
    required_qualifications = Column(Text, nullable=True)
    preferred_qualifications = Column(Text, nullable=True)
    tech_requirements = Column(Text, nullable=True)
    soft_skills = Column(Text, nullable=True)
    certifications = Column(Text, nullable=True)
    other_requirements = Column(Text, nullable=True)

    # Section I: Application Settings
    application_deadline = Column(DateTime(timezone=True), nullable=True)
    timezone = Column(String(50), nullable=False, default="Asia/Kolkata")
    notice_periods = Column(JSON, nullable=True, default=list)
    languages = Column(JSON, nullable=True, default=list)
    inclusion_info = Column(JSON, nullable=True, default=dict)

    # Status, Revision & Timestamps
    status = Column(String(20), nullable=False, default="Draft", index=True)
    career_page_published = Column(Boolean, nullable=False, default=False)
    revision = Column(Integer, nullable=False, default=1)
    archived_at = Column(DateTime(timezone=True), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    application_forms = relationship("ApplicationForm", back_populates="job", cascade="all, delete-orphan")
