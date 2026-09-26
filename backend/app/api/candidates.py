from typing import List
import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.candidate_application import CandidateApplication
from backend.app.schemas.candidate_application import CandidateApplicationResponse, CandidateApplicationCreate
from backend.app.core.security import get_current_user
from backend.app.services.job_service import get_job

router = APIRouter(prefix="/jobs/{job_id}/candidates", tags=["Candidates"])

@router.get("", response_model=List[CandidateApplicationResponse])
def list_job_candidates(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = get_job(db, job_id, current_user.organization_id)
    candidates = db.query(CandidateApplication).filter(
        CandidateApplication.job_id == job.id,
        CandidateApplication.organization_id == current_user.organization_id
    ).order_by(CandidateApplication.created_at.desc()).all()

    return candidates

@router.post("/simulate", response_model=CandidateApplicationResponse, status_code=status.HTTP_201_CREATED)
def simulate_candidate_submission(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a simulated real human candidate submission to immediately test database saving.
    """
    job = get_job(db, job_id, current_user.organization_id)

    first_names = ["Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Neha", "Rahul", "Sneha"]
    last_names = ["Sharma", "Verma", "Patel", "Mehta", "Iyer", "Nair", "Gupta", "Rao"]
    fn = random.choice(first_names)
    ln = random.choice(last_names)
    full_name = f"{fn} {ln}"
    email = f"{fn.lower()}.{ln.lower()}{random.randint(100,999)}@gmail.com"
    phone = f"+91 98{random.randint(10000000, 99999999)}"
    cities = ["Bengaluru, KA", "Mumbai, MH", "Hyderabad, TS", "Delhi NCR", "Pune, MH"]

    candidate = CandidateApplication(
        job_id=job.id,
        organization_id=job.organization_id,
        full_name=full_name,
        email=email,
        phone=phone,
        current_location=random.choice(cities),
        total_experience=round(random.uniform(1.5, 7.5), 1),
        current_ctc="₹12.5 Lakhs / yr",
        expected_ctc="₹18.0 Lakhs / yr",
        notice_period="30 Days",
        resume_url=f"https://drive.google.com/file/d/1_resume_{random.randint(1000,9999)}/view",
        source_channel="GoogleForms",
        status="Submitted",
        answers_payload={
            "Full Name": full_name,
            "Email Address": email,
            "Phone Number": phone,
            "Notice Period": "30 Days",
            "Key Technical Proficiency": "React, Python, FastAPI, PostgreSQL",
            "Submitted Via": "Official Google Form"
        }
    )

    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    return candidate
