"""
Groq-based structured resume extraction service.

§6-7 of the enterprise spec:
  - Extract text from PDF/DOCX (existing resume_service utility)
  - Call Groq to produce a validated ResumeProfile (Pydantic model)
  - Return structured JSON written to CandidateJob.extracted_profile
  - On failure, mark extraction_status = FAILED with error message
  - Fall back to heuristic parse if Groq is not configured
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.candidate_job import CandidateJob
from backend.app.models.resume import Resume

logger = logging.getLogger("careerorbit.groq_extraction")

# ---------------------------------------------------------------------------
# Pydantic schema for validated Groq output
# ---------------------------------------------------------------------------

class EducationEntry(BaseModel):
    degree: Optional[str] = None
    institution: Optional[str] = None
    field_of_study: Optional[str] = None
    graduation_year: Optional[int] = None

class ExperienceEntry(BaseModel):
    company: Optional[str] = None
    title: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None      # None means current
    description: Optional[str] = None

class ResumeProfile(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    total_experience_years: Optional[float] = None
    current_company: Optional[str] = None
    current_title: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    notice_period: Optional[str] = None
    summary: Optional[str] = None

    @field_validator("skills", mode="before")
    @classmethod
    def coerce_skills(cls, v):
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        if isinstance(v, list):
            return [str(s).strip() for s in v if s]
        return []

    @field_validator("total_experience_years", mode="before")
    @classmethod
    def coerce_experience(cls, v):
        if v is None:
            return None
        try:
            return float(str(v).replace("+", "").strip())
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Heuristic fallback (existing parse_extracted_text logic, extended)
# ---------------------------------------------------------------------------

def _heuristic_profile(text: str, existing_parsed: Optional[dict] = None) -> dict:
    """Returns a ResumeProfile-compatible dict from keyword heuristics."""
    import re
    lower = text.lower()

    existing = existing_parsed or {}
    skills = existing.get("skills", [])
    exp = existing.get("detected_experience_years", None)

    # Extend skills list with common AI/data keywords
    extra_skills = [
        "pytorch", "tensorflow", "scikit-learn", "keras", "langchain",
        "openai", "llm", "transformers", "huggingface", "spark", "hadoop",
        "redis", "kafka", "celery", "nginx", "linux", "bash", "shell",
        "terraform", "ansible", "ci/cd", "github actions", "jira"
    ]
    for s in extra_skills:
        if s in lower and s not in skills:
            skills.append(s)

    # Email
    email_match = re.search(r"[\w.+-]+@[\w-]+\.\w+", text)
    email = email_match.group(0) if email_match else None

    # Phone (E.164 or local)
    phone_match = re.search(r"(?:\+?\d[\d\s\-().]{7,15}\d)", text)
    phone = phone_match.group(0).strip() if phone_match else None

    # Notice period
    notice_match = re.search(r"(\d+)\s*(?:days?|weeks?|months?)\s*notice", lower)
    notice = notice_match.group(0) if notice_match else None

    profile = ResumeProfile(
        skills=skills,
        total_experience_years=exp,
        email=email,
        phone=phone,
        notice_period=notice
    )
    return profile.model_dump()


# ---------------------------------------------------------------------------
# Main Groq extraction call
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a structured resume parser. Given raw resume text, extract information as JSON.
Respond ONLY with a JSON object matching this schema (no markdown, no explanation):
{
  "full_name": string or null,
  "email": string or null,
  "phone": string or null,
  "location": string or null,
  "total_experience_years": number or null,
  "current_company": string or null,
  "current_title": string or null,
  "skills": [string, ...],
  "notice_period": string or null,
  "summary": string or null,
  "education": [
    {"degree": string, "institution": string, "field_of_study": string or null, "graduation_year": int or null}
  ],
  "experience": [
    {"company": string, "title": string, "start_year": int or null, "end_year": int or null, "description": string or null}
  ]
}
Rules:
- total_experience_years must be a number (years), null if not determinable.
- skills must be a flat list of strings — technology names only, no prose.
- Return null for any field you cannot determine. Do not hallucinate.
- Keep summary under 150 words.
"""

def extract_resume_with_groq(resume_text: str) -> ResumeProfile:
    """Call Groq API to extract a structured ResumeProfile from raw text."""
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured")

    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)

    # Truncate to avoid token limits (~8000 chars is safe for most resumes)
    truncated_text = resume_text[:8000] if resume_text else ""

    response = client.chat.completions.create(
        model=settings.GROQ_EXTRACTION_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Resume text:\n\n{truncated_text}"}
        ],
        temperature=0.0,
        max_tokens=1500,
        response_format={"type": "json_object"}
    )

    raw_json = response.choices[0].message.content
    data = json.loads(raw_json)
    profile = ResumeProfile(**data)
    return profile


# ---------------------------------------------------------------------------
# Orchestrator: run extraction for a CandidateJob record
# ---------------------------------------------------------------------------

def run_extraction_for_candidate_job(
    db: Session,
    candidate_job_id: str
) -> CandidateJob:
    """
    Runs Groq (or heuristic fallback) extraction for a CandidateJob.
    Updates extraction_status, extracted_profile, and related fields.
    """
    cj = db.query(CandidateJob).filter(CandidateJob.id == candidate_job_id).first()
    if not cj:
        raise ValueError(f"CandidateJob '{candidate_job_id}' not found")

    if cj.extraction_status == "SUCCEEDED":
        logger.info(f"Extraction already succeeded for candidate_job {candidate_job_id}")
        return cj

    cj.extraction_status = "RUNNING"
    db.flush()

    # Load resume text
    resume = db.query(Resume).filter(Resume.id == cj.resume_id).first() if cj.resume_id else None
    resume_text = (resume.extracted_text or "") if resume else ""
    existing_parsed = (resume.parsed_data or {}) if resume else {}

    try:
        if settings.GROQ_API_KEY and resume_text:
            profile = extract_resume_with_groq(resume_text)
            cj.extracted_profile = profile.model_dump()
            cj.extraction_model = settings.GROQ_EXTRACTION_MODEL
            logger.info(f"Groq extraction succeeded for candidate_job {candidate_job_id}")
        else:
            # Heuristic fallback
            cj.extracted_profile = _heuristic_profile(resume_text, existing_parsed)
            cj.extraction_model = "heuristic_v1"
            logger.info(f"Heuristic extraction used for candidate_job {candidate_job_id} (Groq not configured or no text)")

        cj.extraction_status = "SUCCEEDED"
        cj.extraction_error = None
        cj.extraction_completed_at = datetime.now(timezone.utc)

        # Update candidate record with extracted data if fields are empty
        if cj.extracted_profile and cj.candidate_id:
            from backend.app.models.candidate import Candidate
            candidate = db.query(Candidate).filter(Candidate.id == cj.candidate_id).first()
            if candidate:
                ep = cj.extracted_profile
                if not candidate.current_company and ep.get("current_company"):
                    candidate.current_company = ep["current_company"]
                if candidate.total_experience is None and ep.get("total_experience_years"):
                    candidate.total_experience = ep["total_experience_years"]
                if not candidate.notice_period and ep.get("notice_period"):
                    candidate.notice_period = ep["notice_period"]
                if ep.get("skills"):
                    merged = list(set((candidate.skills or []) + ep["skills"]))
                    candidate.skills = merged
                db.flush()

    except Exception as e:
        logger.error(f"Extraction failed for candidate_job {candidate_job_id}: {e}")
        cj.extraction_status = "FAILED"
        cj.extraction_error = str(e)
        # Still try heuristic fallback
        try:
            cj.extracted_profile = _heuristic_profile(resume_text, existing_parsed)
            cj.extraction_model = "heuristic_v1_fallback"
            cj.extraction_status = "SUCCEEDED"  # Fallback counts as success
            cj.extraction_completed_at = datetime.now(timezone.utc)
        except Exception as fallback_err:
            cj.extraction_error = f"Groq: {e} | Fallback: {fallback_err}"
            cj.extraction_status = "FAILED"

    db.flush()
    return cj
