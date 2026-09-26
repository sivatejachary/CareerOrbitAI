import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class GoogleConnection(Base):
    __tablename__ = "google_connections"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    google_account_id = Column(String(255), nullable=False, index=True)  # Google 'sub' ID
    display_email = Column(String(255), nullable=False)

    encrypted_credentials = Column(Text, nullable=False)  # Encrypted JSON token dict
    granted_scopes = Column(JSON, nullable=False, default=list)
    token_expiry = Column(DateTime(timezone=True), nullable=True)

    status = Column(String(50), nullable=False, default="Connected", index=True)  # Connected, ReconnectionRequired, Revoked, Expired

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization")
    user = relationship("User")
