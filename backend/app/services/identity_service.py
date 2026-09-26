import re
from datetime import datetime, timezone
import phonenumbers
from sqlalchemy.orm import Session
from backend.app.models.candidate import Candidate
from backend.app.models.job_code_sequence import JobCodeSequence

def normalize_email(email: str) -> str:
    if not email:
        return ""
    return email.strip().lower()

def normalize_phone(phone: str, default_region: str = "IN") -> str:
    if not phone:
        return ""
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    try:
        parsed = phonenumbers.parse(cleaned, default_region)
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    return cleaned

def generate_candidate_code(db: Session, organization_id: str) -> str:
    year_int = int(datetime.now(timezone.utc).strftime("%Y"))
    prefix = f"CAND-{year_int}"
    seq = db.query(JobCodeSequence).filter(
        JobCodeSequence.year == year_int
    ).with_for_update().first()

    if not seq:
        seq = JobCodeSequence(
            year=year_int,
            current_val=1
        )
        db.add(seq)
        current_val = 1
    else:
        seq.current_val += 1
        current_val = seq.current_val

    db.flush()
    return f"{prefix}-{current_val:04d}"

def find_or_create_candidate(
    db: Session,
    organization_id: str,
    email: str,
    full_name: str,
    phone: str = None,
    current_location: str = None,
    total_experience: float = None,
    skills: list = None,
    current_company: str = None,
    notice_period: str = None,
    source: str = "Direct"
) -> Candidate:
    norm_email = normalize_email(email)
    norm_phone = normalize_phone(phone) if phone else None

    # Search existing candidate by email first within organization
    candidate = None
    if norm_email:
        candidate = db.query(Candidate).filter(
            Candidate.organization_id == organization_id,
            Candidate.email == norm_email
        ).first()

    # Search by phone if not found by email
    if not candidate and norm_phone:
        candidate = db.query(Candidate).filter(
            Candidate.organization_id == organization_id,
            Candidate.phone == norm_phone
        ).first()

    if candidate:
        # Update existing profile with non-null incoming fields
        if full_name and candidate.full_name != full_name:
            candidate.full_name = full_name
        if norm_phone and not candidate.phone:
            candidate.phone = norm_phone
        if current_location and not candidate.current_location:
            candidate.current_location = current_location
        if total_experience is not None and (candidate.total_experience is None or total_experience > candidate.total_experience):
            candidate.total_experience = total_experience
        if skills:
            existing_skills = set(candidate.skills or [])
            existing_skills.update(skills)
            candidate.skills = list(existing_skills)
        if current_company and not candidate.current_company:
            candidate.current_company = current_company
        if notice_period and not candidate.notice_period:
            candidate.notice_period = notice_period
        
        candidate.revision += 1
        candidate.updated_at = datetime.now(timezone.utc)
        db.flush()
        return candidate

    # Create new candidate
    cand_code = generate_candidate_code(db, organization_id)
    candidate = Candidate(
        organization_id=organization_id,
        candidate_code=cand_code,
        full_name=full_name or "Unknown Candidate",
        email=norm_email,
        phone=norm_phone,
        current_location=current_location,
        total_experience=total_experience,
        skills=skills or [],
        current_company=current_company,
        notice_period=notice_period,
        first_source=source,
        revision=1
    )
    db.add(candidate)
    db.flush()
    return candidate
