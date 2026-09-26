import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class CallTranscript(Base):
    __tablename__ = "call_transcripts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    call_attempt_id = Column(String(36), ForeignKey("call_attempts.id"), nullable=False, unique=True, index=True)

    full_transcript_text = Column(Text, nullable=False, default="")
    # Turn-by-turn records: [{"speaker": "agent"|"user", "text": "...", "timestamp_secs": 1.2, "duration_secs": 3.4}]
    turns = Column(JSON, nullable=False, default=list)
    raw_provider_payload = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    call_attempt = relationship("CallAttempt", back_populates="transcript")
