import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.database import Base, get_db
import backend.app.models
from backend.app.models.user import User, Organization
from backend.app.models.job import Job
from backend.app.core.security import get_current_user, create_access_token

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_careerorbit.db"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="function")
def test_user(db_session):
    org = Organization(id="org-test-123", name="Test Org", slug="test-org")
    user = User(
        id="user-test-123",
        organization_id=org.id,
        email="recruiter@example.com",
        full_name="Test Recruiter",
        hashed_password="mock_password_hash"
    )
    db_session.add(org)
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture(scope="function")
def client(db_session, test_user):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def auth_headers(test_user):
    token = create_access_token(data={"sub": test_user.id})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="function")
def test_job(db_session, test_user):
    job = Job(
        id="job-test-123",
        organization_id=test_user.organization_id,
        created_by_id=test_user.id,
        updated_by_id=test_user.id,
        job_code="CAR-JOB-2026-0001",
        title="Senior Software Engineer",
        department="Engineering",
        job_type="Full Time",
        work_mode="Remote",
        min_experience=3.0,
        max_experience=7.0,
        description="Exciting engineering role",
        skills=[{"name": "Python", "category": "required"}, {"name": "FastAPI", "category": "required"}],
        status="Active",
        career_page_published=True
    )
    db_session.add(job)
    db_session.commit()
    return job
