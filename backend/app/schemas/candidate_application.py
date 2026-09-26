from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class CandidateApplicationCreate(BaseModel):
    full_name: str = Field(..., description="Full Name of the candidate")
    email: str = Field(..., description="Email address")
    phone: Optional[str] = None
    current_location: Optional[str] = None
    total_experience: Optional[float] = None
    current_ctc: Optional[str] = None
    expected_ctc: Optional[str] = None
    notice_period: Optional[str] = None
    resume_url: Optional[str] = None
    source_channel: Optional[str] = "GoogleForms"
    answers_payload: Optional[Dict[str, Any]] = None

class CandidateApplicationResponse(BaseModel):
    id: str
    job_id: str
    organization_id: str
    application_form_id: Optional[str] = None
    full_name: str
    email: str
    phone: Optional[str] = None
    current_location: Optional[str] = None
    total_experience: Optional[float] = None
    current_ctc: Optional[str] = None
    expected_ctc: Optional[str] = None
    notice_period: Optional[str] = None
    resume_url: Optional[str] = None
    source_channel: str
    status: str
    answers_payload: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
