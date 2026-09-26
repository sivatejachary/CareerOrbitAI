import pytest
from unittest.mock import patch, MagicMock
from backend.app.models.google_connection import GoogleConnection
from backend.app.services.google_service import create_real_google_form, verify_google_form_setup, publish_google_form

def test_create_google_form_no_connection(db_session, test_user, test_job):
    with pytest.raises(Exception) as exc_info:
        create_real_google_form(db_session, test_job.id, test_user)

    assert "No connected Google account found" in str(exc_info.value)

@patch("backend.app.services.google_service.build")
def test_create_real_google_form_mocked(mock_build, db_session, test_user, test_job):
    conn = GoogleConnection(
        organization_id=test_user.organization_id,
        user_id=test_user.id,
        google_account_id="google_sub_12345",
        display_email="hr@company.com",
        encrypted_credentials="mock_encrypted_creds",
        granted_scopes=["https://www.googleapis.com/auth/forms.body"],
        status="Connected"
    )
    db_session.add(conn)
    db_session.commit()

    # Mock Google Forms API response
    mock_forms_service = MagicMock()
    mock_build.return_value = mock_forms_service

    mock_create = MagicMock()
    mock_create.execute.return_value = {
        "formId": "real_google_form_id_999",
        "responderUri": "https://docs.google.com/forms/d/e/real_google_form_id_999/viewform"
    }
    mock_forms_service.forms().create.return_value = mock_create

    mock_batch = MagicMock()
    mock_batch.execute.return_value = {
        "replies": [{"createItem": {"itemId": "item_1", "questionId": "q_1"}}] * 10
    }
    mock_forms_service.forms().batchUpdate.return_value = mock_batch

    with patch("backend.app.services.google_service.get_valid_google_credentials") as mock_get_creds:
        mock_get_creds.return_value = MagicMock()
        form = create_real_google_form(db_session, test_job.id, test_user)

    assert form.provider_form_id == "real_google_form_id_999"
    assert "https://docs.google.com/forms/d/e/real_google_form_id_999/viewform" in form.respondent_url
    assert form.publication_state == "Draft"

    # Test Publish rejected before resume upload verification
    import pytest
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as excinfo:
        publish_google_form(db_session, form.id, test_user)
    assert excinfo.value.status_code == 400
    assert "resume file-upload question is verified" in str(excinfo.value.detail)

    # Now verify resume setup
    form.resume_setup_status = "Verified"
    db_session.commit()

    # Test Publish succeeds after verification
    published = publish_google_form(db_session, form.id, test_user)
    assert published.publication_state == "Active"
