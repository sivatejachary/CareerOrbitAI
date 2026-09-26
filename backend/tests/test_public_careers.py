import pytest

def test_get_public_job_details(client, test_job, db_session):
    test_job.status = "Active"
    test_job.career_page_published = True
    db_session.commit()

    res = client.get(f"/api/public/jobs/{test_job.job_code}")
    assert res.status_code == 200
    data = res.json()
    assert data["job_code"] == test_job.job_code
    assert data["title"] == test_job.title

def test_submit_public_application(client, test_job, db_session):
    test_job.status = "Active"
    test_job.career_page_published = True
    db_session.commit()

    form_data = {
        "full_name": "Public Applicant",
        "email": "public.applicant@example.com",
        "phone": "+919876500000",
        "current_location": "Delhi",
        "total_experience": "3"
    }

    res = client.post(f"/api/public/jobs/{test_job.job_code}/apply", data=form_data)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "application_id" in data
