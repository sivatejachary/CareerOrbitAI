import io
import zipfile
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models.job import Job
from backend.app.models.application_form import ApplicationForm
from backend.app.models.google_connection import GoogleConnection
from backend.app.services.job_service import create_job, backfill_job_application_forms
from backend.app.schemas.job import JobCreate, SkillItem
from backend.app.services.file_validation_service import validate_resume_file
import uuid
from backend.app.services.google_service import (
    verify_google_resume_upload_setup,
    publish_google_form
)

def create_sample_docx_bytes() -> bytes:
    """Creates in-memory valid minimal DOCX zip package."""
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types></Types>')
        zf.writestr("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>John Doe Resume</w:t></w:r></w:p></w:body></w:document>')
    return bio.getvalue()

def create_sample_pdf_bytes() -> bytes:
    """Creates in-memory minimal valid PDF header."""
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n160\n%%EOF"

# 1. Test Resume File Validator
def test_validate_resume_file_success_pdf():
    pdf_bytes = create_sample_pdf_bytes()
    filename, mime = validate_resume_file(pdf_bytes, "candidate_cv.pdf")
    assert filename == "candidate_cv.pdf"
    assert mime == "application/pdf"

def test_validate_resume_file_success_docx():
    docx_bytes = create_sample_docx_bytes()
    filename, mime = validate_resume_file(docx_bytes, "candidate_resume.docx")
    assert filename == "candidate_resume.docx"
    assert "openxmlformats" in mime

def test_validate_resume_file_rejects_empty():
    with pytest.raises(HTTPException) as exc:
        validate_resume_file(b"", "resume.pdf")
    assert exc.value.status_code == 400
    assert "empty" in exc.value.detail

def test_validate_resume_file_rejects_disallowed_extensions():
    for bad_name in ["resume.doc", "resume.txt", "resume.zip", "resume.exe", "resume.png", "resume.sh"]:
        with pytest.raises(HTTPException) as exc:
            validate_resume_file(b"dummy data", bad_name)
        assert exc.value.status_code == 400
        assert "Unsupported file format" in exc.value.detail

def test_validate_resume_file_rejects_oversized():
    huge_bytes = b"%PDF-" + b"0" * (10 * 1024 * 1024 + 10)
    with pytest.raises(HTTPException) as exc:
        validate_resume_file(huge_bytes, "huge.pdf")
    assert exc.value.status_code == 400
    assert "exceeds the maximum allowed size" in exc.value.detail

def test_validate_resume_file_rejects_fake_pdf_header():
    fake_pdf = b"Plain text disguised as PDF"
    with pytest.raises(HTTPException) as exc:
        validate_resume_file(fake_pdf, "fake.pdf")
    assert exc.value.status_code == 400
    assert "magic bytes" in exc.value.detail

def test_validate_resume_file_rejects_corrupt_docx():
    bad_docx = b"PK\x03\x04not a real docx"
    with pytest.raises(HTTPException) as exc:
        validate_resume_file(bad_docx, "corrupt.docx")
    assert exc.value.status_code == 400
    assert "Invalid DOCX" in exc.value.detail or "Corrupted" in exc.value.detail

# 2. Test Job Creation automatically creates Primary Website Form
def test_create_job_auto_generates_primary_form(db_session, test_user):
    job_in = JobCreate(
        title="Senior Python Engineer",
        department="Engineering",
        job_type="Full-time",
        employment_type="Regular",
        work_mode="Remote",
        openings=2,
        priority="High",
        country="India",
        state="Karnataka",
        city="Bengaluru",
        allow_relocation=False,
        min_experience=4.0,
        max_experience=8.0,
        allow_freshers=False,
        min_qualification="Bachelor's",
        salary_type="Annual CTC",
        min_salary=2000000,
        max_salary=3500000,
        currency="INR",
        show_salary=True,
        skills=[SkillItem(name="Python", category="required", position=1)],
        description="<p>Senior Python backend developer role.</p>"
    )

    job = create_job(db_session, job_in, test_user)
    assert job.id is not None
    assert job.job_code is not None

    # Check primary website application form was created
    form = db_session.query(ApplicationForm).filter(
        ApplicationForm.job_id == job.id,
        ApplicationForm.is_primary_website_form == True
    ).first()

    assert form is not None
    assert form.provider == "Native"
    assert form.publication_state == "Draft"
    assert form.resume_setup_status == "Verified"
    assert form.public_token is not None
    assert len(form.public_token) >= 32
    assert f"/apply/{job.job_code}/{form.public_token}" == form.respondent_url
    assert len(form.questions_schema) > 0

# 3. Test Backfill Job Application Forms
def test_backfill_job_application_forms(db_session, test_user):
    # Create a raw Job without form
    job_without_form = Job(
        organization_id=test_user.organization_id,
        created_by_id=test_user.id,
        updated_by_id=test_user.id,
        job_code=f"ORB-BF-{uuid.uuid4().hex[:6]}",
        title="Legacy Role",
        department="Operations",
        job_type="Full-time",
        employment_type="Regular",
        work_mode="On-site",
        status="Open",
        description="<p>Legacy job description</p>",
        revision=1
    )
    db_session.add(job_without_form)
    db_session.commit()

    backfilled_count = backfill_job_application_forms(db_session)
    assert backfilled_count >= 1

    form = db_session.query(ApplicationForm).filter(
        ApplicationForm.job_id == job_without_form.id,
        ApplicationForm.is_primary_website_form == True
    ).first()

    assert form is not None
    assert form.public_token is not None
    assert form.publication_state == "Draft"

# 4. Test Public Form Details API
def test_public_form_details_api(client, db_session, test_user):
    job_in = JobCreate(
        title="Frontend Specialist",
        department="Product Design",
        job_type="Full-time",
        employment_type="Regular",
        work_mode="Remote",
        openings=1,
        priority="Medium",
        country="India",
        state="Karnataka",
        city="Bengaluru",
        allow_relocation=False,
        min_experience=2.0,
        max_experience=5.0,
        allow_freshers=False,
        min_qualification="Bachelor's",
        salary_type="Annual CTC",
        min_salary=1200000,
        max_salary=1800000,
        currency="INR",
        show_salary=True,
        skills=[SkillItem(name="React", category="required", position=1)],
        description="<p>Frontend role description.</p>"
    )
    job = create_job(db_session, job_in, test_user)

    form = db_session.query(ApplicationForm).filter(
        ApplicationForm.job_id == job.id,
        ApplicationForm.is_primary_website_form == True
    ).first()

    # While in Draft state
    res = client.get(f"/api/public/application-forms/{job.job_code}/{form.public_token}")
    assert res.status_code == 200
    data = res.json()
    assert data["job"]["title"] == "Frontend Specialist"
    assert data["form"]["is_open_for_submissions"] is False
    assert "Draft mode" in data["form"]["state_message"]

    # Now activate form and job
    form.publication_state = "Active"
    job.status = "Open"
    db_session.commit()

    res = client.get(f"/api/public/application-forms/{job.job_code}/{form.public_token}")
    assert res.status_code == 200
    data = res.json()
    assert data["form"]["is_open_for_submissions"] is True
    assert data["form"]["state_message"] is None

# 5. Test Public Form Submission with Resume File
def test_public_form_submission_success(client, db_session, test_user):
    job_in = JobCreate(
        title="Full Stack Developer",
        department="Engineering",
        job_type="Full-time",
        employment_type="Regular",
        work_mode="Remote",
        openings=1,
        priority="High",
        country="India",
        state="Karnataka",
        city="Bengaluru",
        allow_relocation=False,
        min_experience=3.0,
        max_experience=6.0,
        allow_freshers=False,
        min_qualification="Bachelor's",
        salary_type="Annual CTC",
        currency="INR",
        show_salary=False,
        skills=[SkillItem(name="Python", category="required", position=1)],
        description="<p>Full stack role.</p>"
    )
    job = create_job(db_session, job_in, test_user)
    job.status = "Open"

    form = db_session.query(ApplicationForm).filter(
        ApplicationForm.job_id == job.id,
        ApplicationForm.is_primary_website_form == True
    ).first()
    form.publication_state = "Active"
    db_session.commit()

    pdf_bytes = create_sample_pdf_bytes()
    form_data = {
        "full_name": "Alice Candidate",
        "email": "alice.candidate@example.com",
        "phone": "+919876543210",
        "current_location": "Bengaluru",
        "total_experience": "4.5",
        "notice_period": "30 Days"
    }
    files = {
        "resume": ("alice_resume.pdf", pdf_bytes, "application/pdf")
    }

    res = client.post(
        f"/api/public/application-forms/{job.job_code}/{form.public_token}/submit",
        data=form_data,
        files=files
    )

    if res.status_code != 200:
        print("SUBMISSION FAILED:", res.status_code, res.text)
    assert res.status_code == 200
    receipt = res.json()
    assert receipt["success"] is True
    assert receipt["application_id"] is not None
    assert receipt["candidate_id"] is not None
    assert receipt["status"] == "Submitted"

# 6. Test Google Form Resume Setup Verification
@patch("backend.app.services.google_service.build")
def test_verify_google_resume_upload_setup(mock_build, db_session, test_user, test_job):
    conn = GoogleConnection(
        organization_id=test_user.organization_id,
        user_id=test_user.id,
        google_account_id="google_acc_789",
        display_email="hr_verified@company.com",
        encrypted_credentials="mock_encrypted",
        granted_scopes=["https://www.googleapis.com/auth/forms.body"],
        status="Connected"
    )
    db_session.add(conn)
    db_session.commit()

    form = ApplicationForm(
        job_id=test_job.id,
        organization_id=test_user.organization_id,
        created_by_id=test_user.id,
        google_connection_id=conn.id,
        form_version=2,
        title="Google Form Test",
        provider="GoogleForms",
        provider_form_id="mock_gf_123",
        respondent_url="https://docs.google.com/forms/d/e/mock_gf_123/viewform",
        editor_url="https://docs.google.com/forms/d/mock_gf_123/edit",
        publication_state="Draft",
        resume_setup_status="SetupRequired"
    )
    db_session.add(form)
    db_session.commit()

    mock_forms = MagicMock()
    mock_build.return_value = mock_forms

    with patch("backend.app.services.google_service.get_valid_google_credentials") as mock_creds:
        mock_creds.return_value = MagicMock()

        # Case 1: Google Form without file upload question
        mock_forms.forms().get().execute.return_value = {
            "items": [
                {"itemId": "item_1", "title": "Full Name", "questionItem": {"question": {"questionId": "q1"}}}
            ]
        }
        res_unverified = verify_google_resume_upload_setup(db_session, form.id, test_user)
        assert res_unverified["verified"] is False
        assert res_unverified["resume_setup_status"] == "SetupRequired"
        assert res_unverified["can_publish"] is False
        assert len(res_unverified["instructions"]) > 0

        # Cannot publish unverified Google Form
        with pytest.raises(HTTPException) as exc:
            publish_google_form(db_session, form.id, test_user)
        assert exc.value.status_code == 400

        # Case 2: HR added File upload question in Google Editor
        mock_forms.forms().get().execute.return_value = {
            "items": [
                {"itemId": "item_1", "title": "Full Name", "questionItem": {"question": {"questionId": "q1"}}},
                {"itemId": "item_resume", "title": "Resume / CV", "questionItem": {"question": {"questionId": "q_resume_drive", "fileUploadQuestion": {"folderId": "folder_1"}}}}
            ]
        }
        res_verified = verify_google_resume_upload_setup(db_session, form.id, test_user)
        assert res_verified["verified"] is True
        assert res_verified["resume_setup_status"] == "Verified"
        assert res_verified["can_publish"] is True

        # Now publishing succeeds
        pub = publish_google_form(db_session, form.id, test_user)
        assert pub.publication_state == "Active"
