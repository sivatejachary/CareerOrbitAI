import pytest
from backend.app.services.ingestion_service import ingest_job_application
from backend.app.services.screening_service import run_job_screening
from backend.app.models.screening_run import ScreeningRun

def test_job_screening_rules(db_session, test_user, test_job):
    test_job.status = "Active"
    test_job.min_experience = 2.0
    test_job.skills = [{"name": "Python", "category": "required"}, {"name": "FastAPI", "category": "required"}]
    db_session.commit()

    candidate_data = {
        "full_name": "Qualified Dev",
        "email": "qualified@example.com",
        "total_experience": 4.0,
        "skills": ["Python", "FastAPI", "Docker"]
    }

    app = ingest_job_application(
        db=db_session,
        job_id=test_job.id,
        source="Direct",
        candidate_data=candidate_data
    )

    screening = run_job_screening(db_session, app.id)
    db_session.commit()

    assert screening.recommendation == "SHORTLIST"
    assert "Rules-Based Assessment — Not AI" in screening.rationale
    assert len(screening.criterion_results) >= 3

def test_job_screening_not_matched(db_session, test_user, test_job):
    test_job.status = "Active"
    test_job.min_experience = 5.0
    db_session.commit()

    candidate_data = {
        "full_name": "Junior Dev",
        "email": "junior@example.com",
        "total_experience": 1.0,
        "skills": ["HTML"]
    }

    app = ingest_job_application(
        db=db_session,
        job_id=test_job.id,
        source="Direct",
        candidate_data=candidate_data
    )

    screening = run_job_screening(db_session, app.id)
    db_session.commit()

    assert screening.recommendation == "NOT_MATCHED"
    assert screening.criterion_results[0]["passed"] is False
