"""
CompanyCommunicationSetting model.

Defines company-level default communication policies, hours, tone,
retry limits, and default templates. Isolated by organization_id.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base


class CompanyCommunicationSetting(Base):
    __tablename__ = "company_communication_settings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), unique=True, nullable=False, index=True)

    company_intro = Column(Text, nullable=False, default="We are an innovative team hiring top talent.")
    tone = Column(String(50), nullable=False, default="Professional")  # Professional, Friendly, Direct
    supported_languages = Column(JSON, nullable=False, default=lambda: ["en", "hi"])

    # Calling hours & timezone
    calling_hours_start = Column(String(10), nullable=False, default="09:00")
    calling_hours_end = Column(String(10), nullable=False, default="19:00")
    timezone = Column(String(50), nullable=False, default="Asia/Kolkata")

    # Retries and limits
    max_retry_attempts = Column(Integer, nullable=False, default=3)
    min_hours_between_calls = Column(Integer, nullable=False, default=4)

    # Contact & recording policy
    contact_policy = Column(JSON, nullable=False, default=lambda: {
        "require_consent": True,
        "allow_recording": True,
        "respect_do_not_call": True,
        "disclosure_text": "This call is recorded for quality and recruitment evaluation purposes."
    })

    # Permitted actions allowlist
    allowed_agent_actions = Column(JSON, nullable=False, default=lambda: [
        "record_answers",
        "request_clarification",
        "retrieve_slots",
        "reserve_booking",
        "confirm_booking",
        "deliver_result",
        "confirm_attendance",
        "record_callback",
        "record_withdrawal"
    ])

    # Default communication templates for all 7 purposes
    default_templates = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    organization = relationship("Organization")
