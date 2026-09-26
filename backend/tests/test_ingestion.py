import pytest
from backend.app.services.ingestion_service import ingest_job_application
from backend.app.models.job_application import JobApplication
from backend.app.models.resume import Resume

def test_ingest_job_application(db_session, test_user, test_job):
    # Activate test job
    test_job.status = "Active"
    db_session.commit()

    candidate_data = {
        "full_name": "Bob Applicant",
        "email": "bob@example.com",
        "phone": "+919999888877",
        "current_location": "Mumbai",
        "total_experience": 3.5,
        "skills": ["Python", "SQL"]
    }
    answers = {"Why join?": "Excited about CareerOrbitAI"}

    app1 = ingest_job_application(
        db=db_session,
        job_id=test_job.id,
        source="CareerPage",
        candidate_data=candidate_data,
        answers_payload=answers
    )

    assert app1.id is not None
    assert app1.source == "CareerPage"
    assert app1.status == "Submitted"
    assert app1.candidate_id is not None

    # Test Idempotency (same candidate submitting second time on same day)
    app2 = ingest_job_application(
        db=db_session,
        job_id=test_job.id,
        source="CareerPage",
        candidate_data=candidate_data,
        answers_payload=answers
    )

    assert app1.id == app2.id

def test_resume_text_extraction(db_session, test_user):
    from backend.app.services.resume_service import store_and_process_resume
    from backend.app.services.identity_service import find_or_create_candidate

    cand = find_or_create_candidate(
        db=db_session,
        organization_id=test_user.organization_id,
        email="resume_tester@example.com",
        full_name="Resume Tester"
    )
    db_session.commit()

    # Plain text file buffer
    sample_text = "Experienced Senior Developer with 5 years experience in Python, FastAPI, Docker, and PostgreSQL."
    resume_bytes = sample_text.encode("utf-8")

    resume = store_and_process_resume(
        db=db_session,
        organization_id=test_user.organization_id,
        candidate_id=cand.id,
        file_bytes=resume_bytes,
        original_filename="resume.txt",
        mime_type="text/plain"
    )
    db_session.commit()

    assert resume.id is not None
    assert resume.processing_status == "Completed"
    assert "python" in resume.parsed_data["skills"]
    assert "fastapi" in resume.parsed_data["skills"]
