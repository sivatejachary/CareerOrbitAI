from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.api import (
    auth, jobs, application_forms, webhooks, candidates, public_careers,
    candidates_v2, applications, google_oauth, google_forms,
    workflows, ai_calling, webhooks_elevenlabs, public_application_forms,
    candidates_v3, communication
)
from backend.app.services.scheduler import start_poller
from backend.app.services.job_service import backfill_job_application_forms
from backend.app.database import SessionLocal

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs"
)

# Start background sync poller & backfill jobs
@app.on_event("startup")
def startup_event():
    start_poller()
    db = SessionLocal()
    try:
        backfill_job_application_forms(db)
    except Exception as e:
        print(f"Warning: backfill_job_application_forms encountered error: {e}")
    finally:
        db.close()

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(jobs.router, prefix=settings.API_PREFIX)
app.include_router(application_forms.router, prefix=settings.API_PREFIX)
app.include_router(webhooks.router, prefix=settings.API_PREFIX)
app.include_router(candidates.router, prefix=settings.API_PREFIX)
app.include_router(public_careers.router)  # Public career page & apply (/api/public/jobs/...)
app.include_router(public_application_forms.router)  # Public application forms (/api/public/application-forms/...)
app.include_router(candidates_v2.router, prefix=settings.API_PREFIX)
app.include_router(applications.router, prefix=settings.API_PREFIX)
app.include_router(google_oauth.router, prefix=settings.API_PREFIX)
app.include_router(google_forms.router)
app.include_router(workflows.router, prefix=settings.API_PREFIX)
app.include_router(ai_calling.router, prefix=settings.API_PREFIX)
app.include_router(webhooks_elevenlabs.router, prefix=settings.API_PREFIX)
app.include_router(candidates_v3.router)  # V3 candidate-centered pipeline API
app.include_router(communication.router)  # Dynamic communication & scheduling API

@app.get(f"{settings.API_PREFIX}/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

from backend.app.api import workspace
app.include_router(workspace.router, prefix=settings.API_PREFIX)
