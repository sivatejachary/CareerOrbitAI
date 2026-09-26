"""
AICallBatch — tracks a one-click batch of outbound AI calls for a job.

Status lifecycle:
  QUEUED → RUNNING → COMPLETED | PARTIALLY_COMPLETED | FAILED | CANCELLED
  RUNNING → PAUSED → RUNNING (via resume)
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base


class AICallBatch(Base):
    __tablename__ = "ai_call_batches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)

    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, index=True)
    workflow_id = Column(String(36), ForeignKey("workflows.id"), nullable=True, index=True)
    workflow_version_id = Column(String(36), ForeignKey("workflow_versions.id"), nullable=True)

    started_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Status: QUEUED | RUNNING | PAUSED | COMPLETED | PARTIALLY_COMPLETED | FAILED | CANCELLED
    status = Column(String(30), nullable=False, default="QUEUED", index=True)

    # Candidate counts
    total_candidates = Column(Integer, nullable=False, default=0)
    initiated_count = Column(Integer, nullable=False, default=0)
    completed_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    skipped_count = Column(Integer, nullable=False, default=0)

    # Config snapshot at time of batch creation
    max_concurrent_calls = Column(Integer, nullable=False, default=3)
    call_delay_seconds = Column(Integer, nullable=False, default=10)
    max_attempts_per_candidate = Column(Integer, nullable=False, default=2)

    # Result summary / error notes
    notes = Column(Text, nullable=True)
    error_summary = Column(JSON, nullable=True, default=list)

    started_at = Column(DateTime(timezone=True), nullable=True)
    paused_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    organization = relationship("Organization")
    job = relationship("Job")
    started_by = relationship("User", foreign_keys=[started_by_id])
