from datetime import datetime
import zoneinfo
from sqlalchemy.orm import Session
from backend.app.models.job_code_sequence import JobCodeSequence

def generate_job_code(db: Session, tz_name: str = "Asia/Kolkata") -> str:
    try:
        current_tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        current_tz = zoneinfo.ZoneInfo("UTC")

    now = datetime.now(current_tz)
    current_year = now.year

    # Atomic increment or insert of JobCodeSequence
    seq = db.query(JobCodeSequence).filter(JobCodeSequence.year == current_year).with_for_update().first()
    if not seq:
        seq = JobCodeSequence(year=current_year, current_val=1)
        db.add(seq)
    else:
        seq.current_val += 1

    db.flush()
    val_str = f"{seq.current_val:04d}"
    job_code = f"CAR-JOB-{current_year}-{val_str}"
    return job_code
