import pytest
from backend.app.models.candidate import Candidate
from backend.app.services.identity_service import find_or_create_candidate, normalize_email, normalize_phone

def test_normalize_email():
    assert normalize_email("  Test.User@Example.COM ") == "test.user@example.com"
    assert normalize_email("") == ""

def test_find_or_create_candidate_dedup(db_session, test_user):
    # First creation
    c1 = find_or_create_candidate(
        db=db_session,
        organization_id=test_user.organization_id,
        email="john.doe@example.com",
        full_name="John Doe",
        phone="+919876543210",
        current_location="Bengaluru",
        total_experience=4.0,
        skills=["Python", "FastAPI"],
        source="CareerPage"
    )
    db_session.commit()

    assert c1.candidate_code.startswith("CAND-")
    assert c1.email == "john.doe@example.com"
    assert c1.revision == 1

    # Second submission with same email (deduplication check)
    c2 = find_or_create_candidate(
        db=db_session,
        organization_id=test_user.organization_id,
        email="JOHN.DOE@EXAMPLE.COM",
        full_name="Johnathan Doe",
        phone="+919876543210",
        current_location="Bengaluru",
        total_experience=5.0,
        skills=["Python", "Docker"],
        source="GoogleForms"
    )
    db_session.commit()

    assert c1.id == c2.id
    assert c2.full_name == "Johnathan Doe"
    assert c2.revision == 2
    assert "Docker" in c2.skills
    assert "FastAPI" in c2.skills

def test_candidate_api_list(client, test_user, auth_headers, db_session):
    c = find_or_create_candidate(
        db=db_session,
        organization_id=test_user.organization_id,
        email="alice@example.com",
        full_name="Alice Smith"
    )
    db_session.commit()

    res = client.get("/api/candidates", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    emails = [item["email"] for item in data["items"]]
    assert "alice@example.com" in emails
