import uuid
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class ApplicationFormQuestion(Base):
    __tablename__ = "application_form_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_form_id = Column(String(36), ForeignKey("application_forms.id"), nullable=False, index=True)

    question_key = Column(String(100), nullable=False)  # e.g., "full_name", "email", "total_experience", "resume"
    label = Column(String(500), nullable=False)
    question_type = Column(String(50), nullable=False)  # TEXT, PARAGRAPH_TEXT, CHOICE, CHECKBOX, FILE_UPLOAD
    required = Column(Boolean, nullable=False, default=False)
    order_index = Column(Integer, nullable=False, default=0)

    source_job_field = Column(String(100), nullable=True)  # Mapped job field
    provider_item_id = Column(String(255), nullable=True)  # Google Forms item ID
    provider_question_id = Column(String(255), nullable=True)  # Google Forms question ID (response key)
    mapping_metadata = Column(JSON, nullable=True)

    application_form = relationship("ApplicationForm", back_populates="question_mappings")
