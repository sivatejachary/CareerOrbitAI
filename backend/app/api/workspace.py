"""Organization-scoped workspace read models. No provider calls or sample data."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.job import Job
from backend.app.models.candidate import Candidate
from backend.app.models.candidate_job import CandidateJob
from backend.app.models.job_application import JobApplication
from backend.app.models.audit_log import AuditLog
from backend.app.models.call_attempt import CallAttempt
from backend.app.models.human_task import HumanTask
from backend.app.models.interview_slot import InterviewSlot

router = APIRouter(prefix="/workspace", tags=["Workspace"])


@router.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org = user.organization_id
    jobs = db.query(Job).filter(Job.organization_id == org, Job.archived_at.is_(None))
    candidates = db.query(Candidate).filter(Candidate.organization_id == org, Candidate.archived_at.is_(None))
    pipeline = dict(db.query(CandidateJob.stage, func.count(CandidateJob.id)).join(Candidate, Candidate.id == CandidateJob.candidate_id).join(Job, Job.id == CandidateJob.job_id).filter(
        CandidateJob.organization_id == org, Candidate.archived_at.is_(None), Job.archived_at.is_(None)
    ).group_by(CandidateJob.stage).all())
    # Include legacy applications only where no canonical record represents them.
    represented = db.query(CandidateJob.id).filter(CandidateJob.candidate_id == JobApplication.candidate_id, CandidateJob.job_id == JobApplication.job_id, CandidateJob.organization_id == org).exists()
    legacy = db.query(JobApplication.status, func.count(JobApplication.id)).join(Job).join(Candidate, Candidate.id == JobApplication.candidate_id).filter(
        Job.organization_id == org, Candidate.organization_id == org, Job.archived_at.is_(None), Candidate.archived_at.is_(None), ~represented
    ).group_by(JobApplication.status).all()
    mapping = {'Submitted': 'APPLIED', 'UnderReview': 'HR_REVIEW', 'Shortlisted': 'SHORTLISTED', 'Rejected': 'REJECTED', 'Withdrawn': 'WITHDRAWN'}
    for status, count in legacy:
        stage = mapping.get(status, status)
        pipeline[stage] = pipeline.get(stage, 0) + count
    task_query = db.query(HumanTask).filter(HumanTask.organization_id == org, HumanTask.status == 'Pending')
    tasks = task_query.order_by(HumanTask.created_at.desc()).limit(5).all()
    activity = db.query(AuditLog).filter(AuditLog.organization_id == org).order_by(AuditLog.created_at.desc()).limit(8).all()
    return {
        'organization': user.organization.name,
        'metrics': {
            'active_jobs': jobs.filter(Job.status.in_(['Open', 'Active', 'Published'])).count(),
            'candidates': candidates.count(),
            'shortlisted': pipeline.get('SHORTLISTED', 0),
            'interviews': db.query(InterviewSlot).filter(InterviewSlot.organization_id == org, InterviewSlot.is_booked.is_(True), InterviewSlot.start_time >= datetime.now(timezone.utc)).count(),
            'calls': db.query(CallAttempt).filter(CallAttempt.organization_id == org).count(),
            'pending_actions': task_query.count(),
        },
        'pipeline': [{'stage': stage, 'count': count} for stage, count in pipeline.items()],
        'tasks': [{'id': t.id, 'title': t.title, 'execution_id': t.workflow_execution_id} for t in tasks],
        'activity': [{'id': a.id, 'action': a.action.replace('_', ' ').capitalize(), 'resource_type': a.resource_type, 'resource_id': a.resource_id, 'created_at': a.created_at} for a in activity],
    }


@router.get("/interviews")
def interviews(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(InterviewSlot).filter(InterviewSlot.organization_id == user.organization_id, InterviewSlot.is_booked.is_(True))
    total = query.count()
    rows = query.order_by(InterviewSlot.start_time.desc()).offset((page - 1) * size).limit(size).all()
    return {'total': total, 'items': [{
        'id': s.id, 'candidate_id': s.booked_candidate_id,
        'candidate_name': s.booked_candidate.full_name if s.booked_candidate else None,
        'job_title': s.job.title if s.job else None, 'stage': s.stage_id,
        'start_time': s.start_time, 'end_time': s.end_time, 'timezone': s.timezone,
        'interviewer': s.interviewer_name, 'format': s.format, 'meeting_link': s.meeting_link,
        'booking_reference': s.booking_reference,
    } for s in rows]}
