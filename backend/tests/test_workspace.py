from datetime import datetime, timezone, timedelta
from backend.app.models import Candidate, CandidateJob, JobApplication, CallAttempt, Organization
from backend.app.models.audit_log import AuditLog
from backend.app.models.interview_slot import InterviewSlot


def make_candidate(db, org, key, name):
    row = Candidate(id=key, organization_id=org, candidate_code=key, full_name=name, email=f'{key}@example.com')
    db.add(row)
    db.flush()
    return row


def test_overview_empty_and_tenant_isolation(client, db_session, test_user, test_job):
    other = Organization(id='other-org', name='Other organization', slug='other-org')
    db_session.add(other)
    db_session.flush()
    make_candidate(db_session, other.id, 'private-candidate', 'Private candidate')
    db_session.add(AuditLog(organization_id=other.id, user_id=test_user.id, action='PRIVATE_EVENT', resource_type='Job', resource_id=test_job.id))
    db_session.commit()
    response = client.get('/api/workspace/overview')
    assert response.status_code == 200
    data = response.json()
    assert data['metrics']['active_jobs'] == 1
    assert data['metrics']['candidates'] == 0
    assert data['pipeline'] == []
    assert data['activity'] == []


def test_overview_does_not_double_count_legacy_application(client, db_session, test_user, test_job):
    candidate = make_candidate(db_session, test_user.organization_id, 'candidate-a', 'Candidate A')
    application = JobApplication(id='application-a', candidate_id=candidate.id, job_id=test_job.id, source='Manual', idempotency_key='application-a', status='Shortlisted')
    db_session.add(application)
    db_session.flush()
    db_session.add(CandidateJob(organization_id=test_user.organization_id, candidate_id=candidate.id, job_id=test_job.id, job_application_id=application.id, stage='SHORTLISTED'))
    db_session.commit()
    data = client.get('/api/workspace/overview').json()
    assert data['metrics']['candidates'] == 1
    assert data['metrics']['shortlisted'] == 1
    assert sum(row['count'] for row in data['pipeline']) == 1


def test_candidate_sorting_before_pagination(client, db_session, test_user):
    make_candidate(db_session, test_user.organization_id, 'candidate-z', 'Zoya')
    make_candidate(db_session, test_user.organization_id, 'candidate-a', 'Asha')
    db_session.commit()
    data = client.get('/api/candidates?sort=name&page_size=1&page=2').json()
    assert data['total'] == 2
    assert data['items'][0]['full_name'] == 'Zoya'
    assert client.get('/api/candidates?sort=arbitrary').status_code == 422


def test_completed_calls_exclude_accepted_and_filter_before_pagination(client, db_session, test_user, test_job):
    candidate = make_candidate(db_session, test_user.organization_id, 'caller', 'Caller')
    for key, disposition in [('accepted', None), ('done', 'ConversationCompleted')]:
        db_session.add(CallAttempt(id=key, organization_id=test_user.organization_id, candidate_id=candidate.id, job_id=test_job.id, phone_number='+14155550123', idempotency_key=key, operation_state='Accepted', disposition=disposition))
    db_session.commit()
    response = client.get('/api/ai-calling/attempts?category=Completed&search=Caller&size=1')
    assert response.status_code == 200
    assert response.json()['total'] == 1
    assert response.json()['items'][0]['id'] == 'done'


def test_interviews_show_only_booked_records_for_current_org(client, db_session, test_user, test_job):
    candidate = make_candidate(db_session, test_user.organization_id, 'interviewee', 'Interview candidate')
    for key, booked in [('available', False), ('booked', True)]:
        db_session.add(InterviewSlot(id=key, organization_id=test_user.organization_id, job_id=test_job.id, interviewer_name='Interviewer', interviewer_email='hr@example.com', start_time=datetime.now(timezone.utc) + timedelta(days=1), end_time=datetime.now(timezone.utc) + timedelta(days=1, hours=1), is_booked=booked, booked_candidate_id=candidate.id if booked else None))
    db_session.commit()
    data = client.get('/api/workspace/interviews').json()
    assert data['total'] == 1
    assert data['items'][0]['candidate_name'] == 'Interview candidate'
    assert client.get('/api/workspace/overview').json()['metrics']['interviews'] == 1
