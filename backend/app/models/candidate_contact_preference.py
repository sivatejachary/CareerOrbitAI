import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.database import Base

class CandidateContactPreference(Base):
    __tablename__ = "candidate_contact_preferences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False, index=True)
    phone_number = Column(String(50), nullable=False, index=True)

    stop_contact = Column(Boolean, default=False, nullable=False)
    do_not_call = Column(Boolean, default=False, nullable=False)
    consent_given = Column(Boolean, default=True, nullable=False)
    consent_timestamp = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization")
    candidate = relationship("Candidate")

    __table_args__ = (
        UniqueConstraint("organization_id", "phone_number", name="uq_org_phone_contact_pref"),
    )
