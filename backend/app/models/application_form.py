import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from backend.app.database import Base

class ApplicationForm(Base):
    __tablename__ = "application_forms"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    google_connection_id = Column(String(36), ForeignKey("google_connections.id"), nullable=True, index=True)

    form_version = Column(Integer, nullable=False, default=1)
    source_job_revision = Column(Integer, nullable=False, default=1)

    title = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)

    # Question Schema (JSON array of question objects)
    questions_schema = Column(JSON, nullable=False, default=list)

    # Public Website Form Token and URL
    public_token = Column(String(64), unique=True, nullable=True, index=True)
    token_generated_at = Column(DateTime(timezone=True), nullable=True)
    allow_public_submissions = Column(Boolean, default=True, nullable=False)
    is_primary_website_form = Column(Boolean, default=False, nullable=False)

    # Provider details
    provider = Column(String(50), nullable=False, default="Native")  # Native, GoogleForms, MicrosoftForms
    provider_form_id = Column(String(255), nullable=True)
    respondent_url = Column(String(500), nullable=True)
    editor_url = Column(String(500), nullable=True)

    creation_status = Column(String(50), nullable=False, default="Created")  # Created, NeedsSetup, Failed, OutcomeUnknown
    publication_state = Column(String(50), nullable=False, default="Draft")  # Draft, Active, Paused, Closed
    resume_collection_mode = Column(String(50), nullable=False, default="NativeUpload")  # NativeUpload, CareerOrbitUpload, ManualSetupNeeded
    resume_setup_status = Column(String(50), nullable=False, default="SetupRequired")  # SetupRequired, Verified, Failed
    google_resume_question_id = Column(String(255), nullable=True)
    mapping_version = Column(Integer, nullable=False, default=1)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)

    sync_status = Column(String(50), nullable=False, default="Idle")  # Idle, Syncing, Failed, Paused
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_checkpoint = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    job = relationship("Job", back_populates="application_forms")
    google_connection = relationship("GoogleConnection")
    question_mappings = relationship("ApplicationFormQuestion", back_populates="application_form", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("job_id", "form_version", name="uq_job_form_version"),
    )
