"""
Interview Scheduling Service.

Implements reliable interviewer availability and calendar booking
per Section 10 of the dynamic AI communication spec:
1. Retrieve eligible slots for job & stage.
2. Clearly state date, time, timezone, duration, and format.
3. Recheck availability before booking to prevent race conditions.
4. Idempotently create and confirm the booking.
5. Fall back to recruiter task if no slots are available.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from backend.app.models.interview_slot import InterviewSlot
from backend.app.models.candidate import Candidate
from backend.app.models.job import Job
from backend.app.models.human_task import HumanTask


def get_eligible_slots(
    db: Session,
    organization_id: str,
    job_id: Optional[str] = None,
    stage_id: Optional[str] = None,
    min_duration_minutes: int = 30
) -> List[InterviewSlot]:
    """
    Returns unbooked future slots matching the organization, job, and stage.
    """
    now_utc = datetime.now(timezone.utc)

    query = db.query(InterviewSlot).filter(
        InterviewSlot.organization_id == organization_id,
        InterviewSlot.is_booked == False,
        InterviewSlot.start_time > now_utc,
        InterviewSlot.duration_minutes >= min_duration_minutes
    )

    if job_id:
        # Match slots specific to this job OR general organization slots (job_id is NULL)
        query = query.filter(
            (InterviewSlot.job_id == job_id) | (InterviewSlot.job_id.is_(None))
        )

    if stage_id:
        query = query.filter(
            (InterviewSlot.stage_id == stage_id) | (InterviewSlot.stage_id.is_(None))
        )

    return query.order_by(InterviewSlot.start_time.asc()).limit(10).all()


def book_interview_slot(
    db: Session,
    slot_id: str,
    candidate_id: str,
    job_id: str,
    idempotency_key: Optional[str] = None
) -> Tuple[Optional[InterviewSlot], Optional[str]]:
    """
    Atomically books a slot for a candidate with race-condition prevention.
    Returns:
        (booked_slot, error_message)
    """
    slot = db.query(InterviewSlot).filter(InterviewSlot.id == slot_id).with_for_update().first()
    if not slot:
        return None, "Interview slot not found."

    # Idempotent re-confirmation
    if slot.is_booked:
        if slot.booked_candidate_id == candidate_id:
            return slot, None  # Already booked by this candidate
        return None, "This slot has already been booked by another candidate. Please select another slot."

    # Verify candidate exists
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        return None, "Candidate not found."

    booking_ref = idempotency_key or f"BK-{uuid.uuid4().hex[:8].upper()}"

    slot.is_booked = True
    slot.booked_candidate_id = candidate_id
    slot.booked_at = datetime.now(timezone.utc)
    slot.booking_reference = booking_ref

    db.flush()
    return slot, None


def handle_scheduling_failure_fallback(
    db: Session,
    organization_id: str,
    candidate_id: str,
    job_id: str,
    stage_name: str,
    candidate_preference: Optional[str] = None
) -> HumanTask:
    """
    Creates a human task for the recruiter when no suitable slots are available
    or when calendar confirmation cannot be obtained immediately.
    """
    task = HumanTask(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        node_execution_id=None,
        task_type="MANUAL_SCHEDULING",
        title=f"Manual Scheduling Required: {stage_name}",
        instructions=(
            f"No automated slots available for candidate. Candidate preference: "
            f"'{candidate_preference or 'Not specified'}'. Please arrange interview manually."
        ),
        due_date=datetime.now(timezone.utc) + timedelta(hours=24),
        status="Open",
        allowed_outcomes=["SCHEDULED", "RESCHEDULED", "CANCELED"]
    )
    db.add(task)
    db.flush()
    return task


def seed_demo_interview_slots(
    db: Session,
    organization_id: str,
    job_id: Optional[str] = None,
    stage_id: Optional[str] = None
) -> List[InterviewSlot]:
    """
    Generates realistic upcoming interview slots for testing and demonstration.
    """
    base_time = datetime.now(timezone.utc) + timedelta(days=1)
    # Set to 10:00 AM UTC tomorrow
    start_1 = base_time.replace(hour=10, minute=0, second=0, microsecond=0)
    start_2 = base_time.replace(hour=14, minute=30, second=0, microsecond=0)
    start_3 = (base_time + timedelta(days=1)).replace(hour=11, minute=0, second=0, microsecond=0)

    slots = [
        InterviewSlot(
            organization_id=organization_id,
            job_id=job_id,
            stage_id=stage_id,
            interviewer_name="Deepak Sharma (Engineering Lead)",
            interviewer_email="deepak.sharma@example.com",
            start_time=start_1,
            end_time=start_1 + timedelta(minutes=45),
            duration_minutes=45,
            format="Video",
            meeting_link="https://meet.google.com/xyz-demo-car1",
            timezone="Asia/Kolkata"
        ),
        InterviewSlot(
            organization_id=organization_id,
            job_id=job_id,
            stage_id=stage_id,
            interviewer_name="Rohit Verma (Principal Architect)",
            interviewer_email="rohit.verma@example.com",
            start_time=start_2,
            end_time=start_2 + timedelta(minutes=60),
            duration_minutes=60,
            format="Video",
            meeting_link="https://meet.google.com/xyz-demo-car2",
            timezone="Asia/Kolkata"
        ),
        InterviewSlot(
            organization_id=organization_id,
            job_id=job_id,
            stage_id=stage_id,
            interviewer_name="Kavita Rao (Talent Partner)",
            interviewer_email="kavita.rao@example.com",
            start_time=start_3,
            end_time=start_3 + timedelta(minutes=30),
            duration_minutes=30,
            format="Video",
            meeting_link="https://meet.google.com/xyz-demo-car3",
            timezone="Asia/Kolkata"
        )
    ]

    for s in slots:
        db.add(s)
    db.flush()
    return slots
