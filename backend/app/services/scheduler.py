import asyncio
import logging
from datetime import datetime, timezone
from backend.app.database import SessionLocal
from backend.app.config import settings
from backend.app.models.application_form import ApplicationForm
from backend.app.services.google_service import sync_google_form_responses

logger = logging.getLogger("careerorbit.scheduler")

_poller_task = None

async def poll_google_forms_loop():
    logger.info("Starting Google Forms synchronization loop...")
    while True:
        try:
            db = SessionLocal()
            try:
                published_forms = db.query(ApplicationForm).filter(
                    ApplicationForm.provider == "GoogleForms",
                    ApplicationForm.publication_state == "Published",
                    ApplicationForm.google_connection_id.isnot(None)
                ).all()

                for form in published_forms:
                    try:
                        sync_google_form_responses(db, form.id)
                    except Exception as e:
                        logger.error(f"Error syncing Google Form '{form.id}': {str(e)}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in poll_google_forms_loop: {str(e)}")

        await asyncio.sleep(max(10, settings.GOOGLE_FORMS_SYNC_INTERVAL_SECONDS))

async def poll_workflow_executions_loop():
    logger.info("Starting Workflow Execution polling loop...")
    while True:
        try:
            db = SessionLocal()
            try:
                from backend.app.models.workflow_execution import WorkflowExecution
                from backend.app.services.workflow_engine import advance_execution

                active_execs = db.query(WorkflowExecution).filter(
                    WorkflowExecution.status == "Running"
                ).all()

                for exc in active_execs:
                    try:
                        advance_execution(db, exc.id)
                    except Exception as e:
                        logger.error(f"Error advancing workflow execution '{exc.id}': {str(e)}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in poll_workflow_executions_loop: {str(e)}")

        await asyncio.sleep(max(5, settings.WORKFLOW_ENGINE_POLL_INTERVAL_SECONDS))

def start_poller():
    global _poller_task
    if _poller_task is None:
        try:
            loop = asyncio.get_running_loop()
            _poller_task = loop.create_task(poll_google_forms_loop())
            loop.create_task(poll_workflow_executions_loop())
        except RuntimeError:
            pass
