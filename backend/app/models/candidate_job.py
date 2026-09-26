"""
CandidateJob — canonical per-job candidate record.

Primary identity: (organization_id, candidate_id, job_id)

This table is the single source of truth for:
  - Which candidate applied to which job
  - Current pipeline stage & recommendation
  - Groq extraction output
  - Groq screening result (separate from the legacy ScreeningRun)
  - Workflow execution link

The legacy job_applications table is preserved for backward-compatibility.
New APIs use candidate_id + job_id as the public-facing composite key.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Integer, Text, DateTime,
    ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from backend.app.database import Base


class CandidateJob(Base):
    __tablename__ = "candidate_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Composite business key
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, index=True)

    # Back-reference to the canonical JobApplication (internal artifact ID)
    job_application_id = Column(String(36), ForeignKey("job_applications.id"), nullable=True, index=True)

    # Resume used for this job application
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=True, index=True)

    # Submission metadata
    source = Column(String(50), nullable=False, default="CareerPage")
    received_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # --- Groq Extraction (async, may be null until processed) ---
    # Processing states: QUEUED | RUNNING | SUCCEEDED | BLOCKED | FAILED
    extraction_status = Column(String(20), nullable=False, default="QUEUED", index=True)
    extracted_profile = Column(JSON, nullable=True)  # Validated Pydantic ResumeProfile dict
    extraction_model = Column(String(100), nullable=True)
    extraction_error = Column(Text, nullable=True)
    extraction_completed_at = Column(DateTime(timezone=True), nullable=True)

    # --- Groq Screening ---
    # Screening statuses: QUEUED | RUNNING | SUCCEEDED | BLOCKED | FAILED
    screening_status = Column(String(20), nullable=False, default="QUEUED", index=True)
    # Recommendations: SHORTLISTED | REVIEW | NOT_MATCHED  (null until screened)
    recommendation = Column(String(20), nullable=True, index=True)
    screening_score = Column(Float, nullable=True)            # 0–100
    screening_rationale = Column(Text, nullable=True)
    screening_criterion_results = Column(JSON, nullable=True)
    screening_model = Column(String(100), nullable=True)
    screening_error = Column(Text, nullable=True)
    screening_completed_at = Column(DateTime(timezone=True), nullable=True)

    # --- Pipeline Stage ---
    # Stages: APPLIED | SCREENING | SHORTLISTED | AI_CALL_SCHEDULED | AI_CALL_DONE
    #         HR_REVIEW | OFFERED | REJECTED | WITHDRAWN
    stage = Column(String(30), nullable=False, default="APPLIED", index=True)

    # Workflow execution link
    workflow_execution_id = Column(String(36), ForeignKey("workflow_executions.id"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    organization = relationship("Organization")
    candidate = relationship("Candidate", foreign_keys=[candidate_id])
    job = relationship("Job")
    job_application = relationship("JobApplication", foreign_keys=[job_application_id])
    resume = relationship("Resume", foreign_keys=[resume_id])
    workflow_execution = relationship("WorkflowExecution", foreign_keys=[workflow_execution_id])

    __table_args__ = (
        UniqueConstraint("organization_id", "candidate_id", "job_id", name="uq_candidate_job"),
    )
