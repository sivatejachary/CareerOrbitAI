import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class CallEvaluation(Base):
    __tablename__ = "call_evaluations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    call_attempt_id = Column(String(36), ForeignKey("call_attempts.id"), nullable=False, unique=True, index=True)

    # Candidate statements explicitly extracted:
    # {"interest": "EXPLICIT_YES"|"NO"|"UNCLEAR", "notice_period": "30 days", "ctc_expectation": "₹9,00,000", "current_ctc": "₹7,00,000", "availability": "2026-10-01", "stop_contact_requested": false}
    candidate_statements = Column(JSON, nullable=False, default=dict)

    # Extracted facts with confidence & citation:
    # [{"key": "notice_period", "value": "30 days", "unit": "days", "transcript_turn": 3, "excerpt": "I have 30 days notice", "confidence": 0.95}]
    extracted_facts = Column(JSON, nullable=False, default=list)

    # Question coverage: {"role_interest": "ANSWERED", "notice_period": "ANSWERED", "ctc_expectation": "PARTIALLY_ANSWERED"}
    question_coverage = Column(JSON, nullable=False, default=dict)

    recommendation = Column(String(50), nullable=True)  # SHORTLIST, REVIEW, NOT_MATCHED
    rationale = Column(Text, nullable=True)
    human_override = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    call_attempt = relationship("CallAttempt", back_populates="evaluation")
