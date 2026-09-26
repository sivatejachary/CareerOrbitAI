import pytest
from unittest.mock import patch, MagicMock
from backend.app.config import settings
from backend.app.services.google_service import (
    generate_google_auth_url,
    process_oauth_callback
)
from backend.app.models.google_connection import GoogleConnection

def test_google_auth_url_unconfigured(test_user, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "")

    with pytest.raises(Exception) as exc_info:
        generate_google_auth_url(test_user)

    assert "Google Forms integration is not configured" in str(exc_info.value)

def test_google_auth_url_configured(test_user, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock_client_id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "mock_client_secret")

    res = generate_google_auth_url(test_user)
    assert res["configured"] is True
    assert "https://accounts.google.com/o/oauth2/v2/auth" in res["auth_url"]
    assert "client_id=mock_client_id" in res["auth_url"]

def test_google_oauth_status_api(client, auth_headers, test_user, db_session):
    res = client.get("/api/integrations/google/status", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "configured" in data
