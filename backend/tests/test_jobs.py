from fastapi import status

def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "healthy"

def test_create_and_get_job(client):
    job_payload = {
        "title": "Senior AI Backend Engineer",
        "department": "Engineering",
        "job_type": "Full Time",
        "employment_type": "Permanent",
        "work_mode": "Hybrid",
        "openings": 2,
        "priority": "Urgent",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "office_location": "Indiranagar Tech Park",
        "pin_code": "560038",
        "allow_relocation": True,
        "min_experience": 3.0,
        "max_experience": 6.0,
        "allow_freshers": False,
        "min_qualification": "Bachelor's",
        "degree": "B.Tech / B.E.",
        "specialization": "Computer Science",
        "salary_type": "Annual CTC",
        "min_salary": 18.0,
        "max_salary": 25.0,
        "currency": "INR",
        "show_salary": True,
        "benefits": ["Health Insurance", "Performance Bonus"],
        "skills": [
            {"name": "Python", "category": "required", "position": 1},
            {"name": "FastAPI", "category": "required", "position": 2},
            {"name": "Docker", "category": "preferred", "position": 3}
        ],
        "description": "<p>We are seeking a senior AI backend engineer to lead enterprise microservices.</p>",
        "responsibilities": ["Design and build scalable APIs", "Optimize PostgreSQL queries"],
        "timezone": "Asia/Kolkata",
        "notice_periods": ["30 Days", "60 Days"],
        "languages": ["English", "Hindi"]
    }

    # 1. Create Job
    res = client.post("/api/jobs", json=job_payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["title"] == "Senior AI Backend Engineer"
    assert data["job_code"].startswith("CAR-JOB-")
    assert data["status"] == "Draft"
    assert data["revision"] == 1
    job_id = data["id"]

    # 2. Get Job
    get_res = client.get(f"/api/jobs/{job_id}")
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.json()["id"] == job_id

    # 3. List Jobs
    list_res = client.get("/api/jobs?search=Senior")
    assert list_res.status_code == status.HTTP_200_OK
    list_data = list_res.json()
    assert list_data["total"] == 1
    assert list_data["items"][0]["id"] == job_id

def test_job_validation_errors(client):
    # Allow freshers vs min_experience conflict
    bad_exp_payload = {
        "title": "Junior Developer",
        "department": "Engineering",
        "job_type": "Full Time",
        "work_mode": "Remote",
        "openings": 1,
        "min_experience": 2.0,
        "allow_freshers": True,
        "description": "<p>Test desc</p>",
        "responsibilities": ["Code"]
    }
    res = client.post("/api/jobs", json=bad_exp_payload)
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

def test_optimistic_concurrency(client):
    job_payload = {
        "title": "DevOps Specialist",
        "department": "Engineering",
        "job_type": "Full Time",
        "work_mode": "Remote",
        "openings": 1,
        "description": "<p>DevOps Lead</p>",
        "responsibilities": ["Manage CI/CD"]
    }
    create_res = client.post("/api/jobs", json=job_payload)
    data = create_res.json()
    job_id = data["id"]

    # Update with correct revision=1
    update_payload = dict(data)
    update_payload["title"] = "Senior DevOps Lead"
    update_res = client.patch(f"/api/jobs/{job_id}", json=update_payload)
    assert update_res.status_code == status.HTTP_200_OK
    assert update_res.json()["revision"] == 2

    # Attempt update with old revision=1 (Conflict)
    conflict_res = client.patch(f"/api/jobs/{job_id}", json=update_payload)
    assert conflict_res.status_code == status.HTTP_409_CONFLICT

def test_form_generation_and_versioning(client):
    job_payload = {
        "title": "Data Scientist",
        "department": "Data Science",
        "job_type": "Full Time",
        "work_mode": "Remote",
        "openings": 1,
        "description": "<p>ML Pipeline Lead</p>",
        "responsibilities": ["Build PyTorch models"]
    }
    create_res = client.post("/api/jobs", json=job_payload)
    job_id = create_res.json()["id"]

    # Preview Questions
    preview_res = client.post(f"/api/jobs/{job_id}/application-forms/preview")
    assert preview_res.status_code == status.HTTP_200_OK
    preview_data = preview_res.json()
    assert len(preview_data["questions"]) > 0

    # Save Form Version 1
    form_payload = {
        "title": preview_data["suggested_title"],
        "description": "Standard screening form",
        "questions": preview_data["questions"],
        "provider": "Native"
    }
    form_res = client.post(f"/api/jobs/{job_id}/application-forms", json=form_payload)
    assert form_res.status_code == status.HTTP_201_CREATED
    form_data = form_res.json()
    assert form_data["form_version"] == 1
    assert form_data["provider"] == "Native"

    # List Form Versions
    list_forms = client.get(f"/api/jobs/{job_id}/application-forms")
    assert list_forms.status_code == status.HTTP_200_OK
    assert len(list_forms.json()) == 1
