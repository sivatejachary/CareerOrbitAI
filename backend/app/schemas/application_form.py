from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, model_validator

class QuestionSchema(BaseModel):
    id: Optional[str] = None
    key: Optional[str] = None
    label: str
    type: str # text, email, phone, number, select, multiselect, file_upload, textarea, date
    required: bool = True
    options: Optional[List[str]] = Field(default_factory=list)
    validation: Optional[Dict[str, Any]] = Field(default_factory=dict)
    display_order: int = 0
    source_job_field: Optional[str] = None
    generation_rationale: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def set_id_if_missing(cls, data: Any):
        if isinstance(data, dict):
            if not data.get('id'):
                data['id'] = data.get('key') or f"q_{data.get('label', 'field')[:12].replace(' ', '_').lower()}"
        return data

class ApplicationFormCreate(BaseModel):
    title: str
    description: Optional[str] = None
    questions: List[QuestionSchema]
    provider: str = "Native" # Native, GoogleForms, MicrosoftForms
    provider_form_id: Optional[str] = None
    respondent_url: Optional[str] = None
    editor_url: Optional[str] = None
    publication_state: str = "Draft" # Draft, Published

class ApplicationFormResponse(BaseModel):
    id: str
    job_id: str
    organization_id: str
    form_version: int
    source_job_revision: int
    title: str
    description: Optional[str] = None
    questions_schema: List[QuestionSchema]
    provider: str
    provider_form_id: Optional[str] = None
    respondent_url: Optional[str] = None
    editor_url: Optional[str] = None
    creation_status: str
    publication_state: str
    public_token: Optional[str] = None
    token_generated_at: Optional[datetime] = None
    allow_public_submissions: bool = True
    is_primary_website_form: bool = False
    resume_collection_mode: Optional[str] = "NativeUpload"
    resume_setup_status: Optional[str] = "SetupRequired"
    google_resume_question_id: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    sync_status: Optional[str] = "Idle"
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QuestionPreviewResponse(BaseModel):
    job_id: str
    job_revision: int
    suggested_title: str
    questions: List[QuestionSchema]
