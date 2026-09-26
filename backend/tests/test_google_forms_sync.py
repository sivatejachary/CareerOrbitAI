import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from backend.app.models.google_connection import GoogleConnection
from backend.app.models.application_form import ApplicationForm
from backend.app.models.application_form_question import ApplicationFormQuestion
from backend.app.services.google_service import sync_google_form_responses
from backend.app.models.source_response import SourceResponse
from backend.app.models.job_application import JobApplication

@patch("backend.app.services.google_service.build")
def test_sync_google_form_responses_mocked(mock_build, db_session, test_user, test_job):
    conn = GoogleConnection(
        organization_id=test_user.organization_id,
        user_id=test_user.id,
        google_account_id="google_sub_12345",
        display_email="hr@company.com",
        encrypted_credentials="mock_encrypted_creds",
        granted_scopes=["https://www.googleapis.com/auth/forms.responses.readonly"],
        status="Connected"
    )
    db_session.add(conn)
    db_session.flush()

    form = ApplicationForm(
        job_id=test_job.id,
        organization_id=test_user.organization_id,
        created_by_id=test_user.id,
        google_connection_id=conn.id,
        title=f"Application Form - {test_job.title}",
        provider="GoogleForms",
        provider_form_id="form_123_abc",
        publication_state="Published"
    )
    db_session.add(form)
    db_session.flush()

    afq1 = ApplicationFormQuestion(
        application_form_id=form.id,
        question_key="full_name",
        label="Full Name",
        question_type="TEXT",
        provider_question_id="q_name_1"
    )
    afq2 = ApplicationFormQuestion(
        application_form_id=form.id,
        question_key="email",
        label="Email Address",
        question_type="TEXT",
        provider_question_id="q_email_2"
    )
    db_session.add(afq1)
    db_session.add(afq2)
    db_session.commit()

    # Mock Forms API responses list
    mock_service = MagicMock()
    mock_build.return_value = mock_service

    mock_resp_list = MagicMock()
    mock_resp_list.execute.return_value = {
        "responses": [
            {
                "responseId": "resp_001",
                "createTime": "2026-09-25T12:00:00Z",
                "lastSubmittedTime": "2026-09-25T12:00:00Z",
                "answers": {
                    "q_name_1": {"textAnswers": {"answers": [{"value": "Alice Green"}]}},
                    "q_email_2": {"textAnswers": {"answers": [{"value": "alice.green@example.com"}]}}
                }
            }
        ]
    }
    mock_service.forms().responses().list.return_value = mock_resp_list

    with patch("backend.app.services.google_service.get_valid_google_credentials") as mock_get_creds:
        mock_get_creds.return_value = MagicMock()
        res = sync_google_form_responses(db_session, form.id)

    assert res["status"] == "Success"
    assert res["imported_count"] == 1
    assert res["new_count"] == 1

    # Verify source response record created
    sr = db_session.query(SourceResponse).filter(SourceResponse.provider_response_id == "resp_001").first()
    assert sr is not None
    assert sr.processing_status == "Processed"

    # Verify candidate job application created in central ingestion
    app = db_session.query(JobApplication).filter(JobApplication.id == sr.job_application_id).first()
    assert app is not None
    assert app.candidate.email == "alice.green@example.com"
    assert app.candidate.full_name == "Alice Green"
