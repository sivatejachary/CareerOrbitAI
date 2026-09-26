import os
import json
import hashlib
from datetime import datetime, timezone, timedelta
import httpx
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from backend.app.config import settings
from backend.app.core.encryption import encrypt_dict, decrypt_dict
from backend.app.models.user import User
from backend.app.models.job import Job
from backend.app.models.google_connection import GoogleConnection
from backend.app.models.application_form import ApplicationForm
from backend.app.models.application_form_question import ApplicationFormQuestion
from backend.app.models.source_response import SourceResponse
from backend.app.models.audit_log import AuditLog
from backend.app.services.ingestion_service import ingest_job_application
from backend.app.services.file_validation_service import validate_resume_file

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/forms.body",
    "https://www.googleapis.com/auth/forms.responses.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]

def check_google_config_or_raise():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Forms integration is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment."
        )

def generate_google_auth_url(user: User, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
    check_google_config_or_raise()
    eff_redirect_uri = redirect_uri or settings.GOOGLE_REDIRECT_URI

    state_data = {
        "user_id": user.id,
        "org_id": user.organization_id,
        "nonce": os.urandom(8).hex(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    state_token = encrypt_dict(state_data)

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": eff_redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state_token
    }

    from urllib.parse import urlencode
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {
        "configured": True,
        "auth_url": auth_url
    }

def process_oauth_callback(db: Session, code: str, state: str, redirect_uri: Optional[str] = None) -> GoogleConnection:
    check_google_config_or_raise()
    eff_redirect_uri = redirect_uri or settings.GOOGLE_REDIRECT_URI

    try:
        state_data = decrypt_dict(state)
        user_id = state_data["user_id"]
        org_id = state_data["org_id"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state parameter")

    # Exchange authorization code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_payload = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": eff_redirect_uri,
        "grant_type": "authorization_code"
    }

    with httpx.Client(timeout=10.0) as http_client:
        res = http_client.post(token_url, data=token_payload)
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to exchange authorization code: {res.text}")

        token_data = res.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        granted_scopes = token_data.get("scope", "").split(" ")

        # Get Google user profile
        userinfo_res = http_client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if userinfo_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to retrieve Google user profile")

        userinfo = userinfo_res.json()
        google_sub = userinfo.get("sub")
        display_email = userinfo.get("email")

    if not google_sub or not display_email:
        raise HTTPException(status_code=400, detail="Incomplete user identification returned by Google")

    # Check existing connection to preserve refresh_token if Google omitted a new one
    existing_conn = db.query(GoogleConnection).filter(
        GoogleConnection.organization_id == org_id,
        GoogleConnection.user_id == user_id,
        GoogleConnection.google_account_id == google_sub
    ).first()

    if existing_conn and not refresh_token:
        try:
            old_creds = decrypt_dict(existing_conn.encrypted_credentials)
            refresh_token = old_creds.get("refresh_token")
        except Exception:
            pass

    token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    creds_dict = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "scopes": granted_scopes
    }
    encrypted_payload = encrypt_dict(creds_dict)

    if existing_conn:
        existing_conn.display_email = display_email
        existing_conn.encrypted_credentials = encrypted_payload
        existing_conn.granted_scopes = granted_scopes
        existing_conn.token_expiry = token_expiry
        existing_conn.status = "Connected"
        existing_conn.updated_at = datetime.now(timezone.utc)
        conn = existing_conn
    else:
        conn = GoogleConnection(
            organization_id=org_id,
            user_id=user_id,
            google_account_id=google_sub,
            display_email=display_email,
            encrypted_credentials=encrypted_payload,
            granted_scopes=granted_scopes,
            token_expiry=token_expiry,
            status="Connected"
        )
        db.add(conn)

    audit = AuditLog(
        organization_id=org_id,
        user_id=user_id,
        action="GOOGLE_OAUTH_CONNECT",
        resource_type="GoogleConnection",
        resource_id=google_sub,
        details={"email": display_email}
    )
    db.add(audit)
    db.commit()
    db.refresh(conn)
    return conn

def get_valid_google_credentials(db: Session, connection: GoogleConnection) -> Credentials:
    if connection.status == "Revoked":
        raise HTTPException(status_code=401, detail="Google account connection has been revoked. Reconnection required.")

    creds_dict = decrypt_dict(connection.encrypted_credentials)
    creds = Credentials(
        token=creds_dict.get("access_token"),
        refresh_token=creds_dict.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=connection.granted_scopes
    )

    if creds.expired or not creds.valid:
        try:
            creds.refresh(Request())
            # Update stored credentials
            creds_dict["access_token"] = creds.token
            connection.encrypted_credentials = encrypt_dict(creds_dict)
            connection.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=3600)
            connection.status = "Connected"
            db.commit()
        except Exception as e:
            connection.status = "ReconnectionRequired"
            db.commit()
            raise HTTPException(status_code=401, detail=f"Google account connection credentials expired. Reconnection required ({str(e)})")

    return creds

def create_real_google_form(
    db: Session,
    job_id: str,
    user: User,
    connection_id: Optional[str] = None
) -> ApplicationForm:
    job = db.query(Job).filter(Job.id == job_id, Job.organization_id == user.organization_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Find Google connection
    if connection_id:
        connection = db.query(GoogleConnection).filter(
            GoogleConnection.id == connection_id,
            GoogleConnection.organization_id == user.organization_id
        ).first()
    else:
        connection = db.query(GoogleConnection).filter(
            GoogleConnection.organization_id == user.organization_id,
            GoogleConnection.user_id == user.id,
            GoogleConnection.status == "Connected"
        ).first()

    if not connection:
        raise HTTPException(
            status_code=400,
            detail="No connected Google account found for this HR user. Please click 'Connect Google' first."
        )

    creds = get_valid_google_credentials(db, connection)

    forms_service = build("forms", "v1", credentials=creds)

    title = f"Application Form - {job.title} ({job.job_code})"
    description = f"Please complete your application for the {job.title} position at CareerOrbitAI."

    # 1. Create empty form via Google Forms API
    form_body = {
        "info": {
            "title": title,
            "documentTitle": f"Job Application - {job.job_code}"
        }
    }
    created_res = forms_service.forms().create(body=form_body).execute()
    provider_form_id = created_res.get("formId")
    responder_url = created_res.get("responderUri")
    editor_url = f"https://docs.google.com/forms/d/{provider_form_id}/edit"

    # 2. Build question items batch update requests
    questions_list = [
        {"id": "q_full_name", "key": "full_name", "label": "Full Name", "type": "TEXT", "required": True},
        {"id": "q_email", "key": "email", "label": "Email Address", "type": "TEXT", "required": True},
        {"id": "q_phone", "key": "phone", "label": "Phone Number", "type": "TEXT", "required": False},
        {"id": "q_current_location", "key": "current_location", "label": "Current Location / City", "type": "TEXT", "required": False},
        {"id": "q_total_experience", "key": "total_experience", "label": "Total Years of Work Experience", "type": "TEXT", "required": False},
        {"id": "q_current_company", "key": "current_company", "label": "Current Company & Designation", "type": "TEXT", "required": False},
        {"id": "q_notice_period", "key": "notice_period", "label": "Notice Period / Availability", "type": "TEXT", "required": False},
        {"id": "q_skills", "key": "skills", "label": "Key Skills & Competencies", "type": "PARAGRAPH_TEXT", "required": False},
        {"id": "q_resume_instructions", "key": "resume_instructions", "label": "Resume Upload Instructions: Please paste your resume link or submit file below.", "type": "PARAGRAPH_TEXT", "required": False}
    ]

    requests = []
    for idx, q in enumerate(questions_list):
        if q["type"] == "PARAGRAPH_TEXT":
            item_body = {
                "title": q["label"],
                "questionItem": {
                    "question": {
                        "required": q["required"],
                        "textQuestion": {"paragraph": True}
                    }
                }
            }
        else:
            item_body = {
                "title": q["label"],
                "questionItem": {
                    "question": {
                        "required": q["required"],
                        "textQuestion": {"paragraph": False}
                    }
                }
            }

        requests.append({
            "createItem": {
                "item": item_body,
                "location": {"index": idx}
            }
        })

    batch_res = forms_service.forms().batchUpdate(
        formId=provider_form_id,
        body={"requests": requests}
    ).execute()

    # Save or update ApplicationForm in database for Google Forms
    existing_form = db.query(ApplicationForm).filter(
        ApplicationForm.job_id == job.id,
        ApplicationForm.organization_id == user.organization_id,
        ApplicationForm.provider == "GoogleForms"
    ).first()

    if not existing_form:
        max_ver = db.query(func.max(ApplicationForm.form_version)).filter(
            ApplicationForm.job_id == job.id
        ).scalar() or 0

        existing_form = ApplicationForm(
            job_id=job.id,
            organization_id=user.organization_id,
            created_by_id=user.id,
            google_connection_id=connection.id,
            form_version=max_ver + 1,
            source_job_revision=job.revision,
            title=title,
            description=description,
            questions_schema=questions_list,
            provider="GoogleForms",
            provider_form_id=provider_form_id,
            respondent_url=responder_url,
            editor_url=editor_url,
            creation_status="Created",
            publication_state="Draft",
            resume_collection_mode="GoogleDriveUpload",
            resume_setup_status="SetupRequired",
            is_primary_website_form=False
        )
        db.add(existing_form)
        db.flush()
    else:
        existing_form.google_connection_id = connection.id
        existing_form.provider_form_id = provider_form_id
        existing_form.respondent_url = responder_url
        existing_form.editor_url = editor_url
        existing_form.creation_status = "Created"
        existing_form.publication_state = "Draft"
        existing_form.resume_collection_mode = "GoogleDriveUpload"
        existing_form.resume_setup_status = "SetupRequired"
        existing_form.questions_schema = questions_list
        existing_form.source_job_revision = job.revision
        db.flush()

    # Store question mappings
    db.query(ApplicationFormQuestion).filter(
        ApplicationFormQuestion.application_form_id == existing_form.id
    ).delete()

    created_items = batch_res.get("replies", [])
    for idx, q in enumerate(questions_list):
        item_id = None
        question_id = None
        if idx < len(created_items) and "createItem" in created_items[idx]:
            create_item_data = created_items[idx]["createItem"]
            item_id = create_item_data.get("itemId")
            q_ids = create_item_data.get("questionId")
            if isinstance(q_ids, list) and len(q_ids) > 0:
                question_id = q_ids[0]
            elif isinstance(q_ids, str):
                question_id = q_ids
            else:
                question_id = item_id

        afq = ApplicationFormQuestion(
            application_form_id=existing_form.id,
            question_key=q["key"],
            label=q["label"],
            question_type=q["type"],
            required=q["required"],
            order_index=idx,
            provider_item_id=item_id,
            provider_question_id=question_id or item_id
        )
        db.add(afq)

    db.commit()
    db.refresh(existing_form)
    return existing_form

def verify_google_form_setup(db: Session, form_id: str, user: User) -> ApplicationForm:
    form = db.query(ApplicationForm).filter(
        ApplicationForm.id == form_id,
        ApplicationForm.organization_id == user.organization_id
    ).first()

    if not form or not form.google_connection:
        raise HTTPException(status_code=404, detail="Application form or associated Google connection not found")

    creds = get_valid_google_credentials(db, form.google_connection)
    forms_service = build("forms", "v1", credentials=creds)

    form_def = forms_service.forms().get(formId=form.provider_form_id).execute()

    items = form_def.get("items", [])
    if len(items) == 0:
        form.publication_state = "NeedsSetup"
        form.resume_setup_status = "SetupRequired"
        db.commit()
        raise HTTPException(status_code=400, detail="Google Form exists but contains no question items.")

    has_file_upload = False
    file_upload_q_id = None
    file_upload_title = None

    # Update question mappings with live Google question IDs
    for item in items:
        item_id = item.get("itemId")
        title = item.get("title", "").strip()
        question_item = item.get("questionItem", {})
        question_obj = question_item.get("question", {})
        q_id = question_obj.get("questionId", item_id)

        # Check for file upload question
        if "fileUploadQuestion" in question_obj or "fileUploadQuestion" in question_item or "fileupload" in str(item).lower():
            has_file_upload = True
            file_upload_q_id = q_id
            file_upload_title = title

        matching_afq = db.query(ApplicationFormQuestion).filter(
            ApplicationFormQuestion.application_form_id == form.id,
            ApplicationFormQuestion.provider_item_id == item_id
        ).first()

        if not matching_afq:
            for afq in db.query(ApplicationFormQuestion).filter(ApplicationFormQuestion.application_form_id == form.id).all():
                if afq.label.lower() in title.lower() or title.lower() in afq.label.lower():
                    matching_afq = afq
                    break

        if matching_afq:
            matching_afq.provider_item_id = item_id
            matching_afq.provider_question_id = q_id

    # If file upload question was found, ensure an ApplicationFormQuestion exists for resume
    if has_file_upload:
        form.resume_setup_status = "Verified"
        form.google_resume_question_id = file_upload_q_id
        form.publication_state = "Active"

        resume_afq = db.query(ApplicationFormQuestion).filter(
            ApplicationFormQuestion.application_form_id == form.id,
            ApplicationFormQuestion.question_key == "resume"
        ).first()

        if not resume_afq:
            resume_afq = ApplicationFormQuestion(
                application_form_id=form.id,
                question_key="resume",
                label=file_upload_title or "Resume / CV",
                question_type="file_upload",
                required=True,
                order_index=99,
                provider_item_id=file_upload_q_id,
                provider_question_id=file_upload_q_id
            )
            db.add(resume_afq)
        else:
            resume_afq.provider_item_id = file_upload_q_id
            resume_afq.provider_question_id = file_upload_q_id
    else:
        form.resume_setup_status = "SetupRequired"

    form.last_verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(form)
    return form

def verify_google_resume_upload_setup(db: Session, form_id: str, user: User) -> Dict[str, Any]:
    form = verify_google_form_setup(db, form_id, user)
    is_verified = (form.resume_setup_status == "Verified")

    if is_verified:
        return {
            "verified": True,
            "resume_setup_status": "Verified",
            "google_resume_question_id": form.google_resume_question_id,
            "publication_state": form.publication_state,
            "can_publish": True,
            "last_verified_at": form.last_verified_at.isoformat() if form.last_verified_at else None,
            "message": "Resume file upload question successfully detected and verified! You can now publish this Google Form."
        }
    else:
        return {
            "verified": False,
            "resume_setup_status": "SetupRequired",
            "google_resume_question_id": None,
            "publication_state": form.publication_state,
            "can_publish": False,
            "editor_url": form.editor_url,
            "instructions": [
                "1. Click 'Open in Google Forms Editor' below.",
                "2. In Google Forms, click '+' to add a new question.",
                "3. Set the question type dropdown to 'File upload'.",
                "4. Name the question 'Resume / CV'.",
                "5. Toggle the 'Required' switch to ON.",
                "6. Return to CareerOrbitAI and click 'Verify Resume Setup'."
            ],
            "message": "No File Upload question was detected in this Google Form. Please add a 'File upload' question named 'Resume / CV' in the Google Forms editor and verify again."
        }

def publish_google_form(db: Session, form_id: str, user: User) -> ApplicationForm:
    form = db.query(ApplicationForm).filter(
        ApplicationForm.id == form_id,
        ApplicationForm.organization_id == user.organization_id
    ).first()

    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if form.provider == "GoogleForms" and form.resume_setup_status != "Verified":
        raise HTTPException(
            status_code=400,
            detail="Cannot publish Google Form before resume file-upload question is verified. Please add a File Upload question in Google Forms editor and click 'Verify Resume Setup'."
        )

    form.publication_state = "Active"
    audit = AuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action="GOOGLE_FORM_PUBLISH",
        resource_type="ApplicationForm",
        resource_id=form.id,
        details={"provider_form_id": form.provider_form_id}
    )
    db.add(audit)
    db.commit()
    db.refresh(form)
    return form

def sync_google_form_responses(db: Session, form_id: str) -> Dict[str, Any]:
    form = db.query(ApplicationForm).filter(ApplicationForm.id == form_id).first()
    if not form or not form.google_connection:
        return {"status": "Failed", "error": "Form or connection not found"}

    try:
        creds = get_valid_google_credentials(db, form.google_connection)
    except Exception as e:
        form.sync_status = "Failed"
        db.commit()
        return {"status": "Failed", "error": str(e)}

    forms_service = build("forms", "v1", credentials=creds)
    drive_service = build("drive", "v3", credentials=creds)

    try:
        res_list = forms_service.forms().responses().list(formId=form.provider_form_id).execute()
        responses = res_list.get("responses", [])
    except Exception as e:
        form.sync_status = "Failed"
        db.commit()
        return {"status": "Failed", "error": f"Google Forms API error: {str(e)}"}

    form.sync_status = "Syncing"
    db.commit()

    imported_count = 0
    new_count = 0

    mappings = db.query(ApplicationFormQuestion).filter(
        ApplicationFormQuestion.application_form_id == form.id
    ).all()
    q_map = {m.provider_question_id: m.question_key for m in mappings if m.provider_question_id}
    label_map = {m.label.lower(): m.question_key for m in mappings}

    for resp in responses:
        resp_id = resp.get("responseId")
        create_time_str = resp.get("createTime")
        last_sub_time_str = resp.get("lastSubmittedTime") or create_time_str
        answers_dict = resp.get("answers", {})

        payload_hash = hashlib.sha256(json.dumps(resp, sort_keys=True).encode("utf-8")).hexdigest()

        # Check existing source response
        existing_sr = db.query(SourceResponse).filter(
            SourceResponse.google_connection_id == form.google_connection_id,
            SourceResponse.application_form_id == form.id,
            SourceResponse.provider_response_id == resp_id
        ).first()

        if existing_sr:
            if existing_sr.payload_hash == payload_hash and existing_sr.processing_status == "Processed":
                continue  # Up-to-date and processed

        try:
            parsed_submitted_at = datetime.fromisoformat(last_sub_time_str.replace("Z", "+00:00"))
        except Exception:
            parsed_submitted_at = datetime.now(timezone.utc)

        if not existing_sr:
            existing_sr = SourceResponse(
                organization_id=form.organization_id,
                google_connection_id=form.google_connection_id,
                application_form_id=form.id,
                provider_response_id=resp_id,
                original_submitted_at=parsed_submitted_at,
                latest_submitted_at=parsed_submitted_at,
                raw_payload=resp,
                payload_hash=payload_hash,
                processing_status="Pending"
            )
            db.add(existing_sr)
            db.flush()
            new_count += 1
        else:
            existing_sr.raw_payload = resp
            existing_sr.payload_hash = payload_hash
            existing_sr.latest_submitted_at = parsed_submitted_at
            db.flush()

        # Extract answer fields
        candidate_data = {
            "full_name": "Applicant",
            "email": "",
            "phone": None,
            "current_location": None,
            "total_experience": None,
            "notice_period": None,
            "skills": []
        }
        answers_payload = {}
        drive_file_id = None
        drive_filename = "resume.pdf"

        for q_id, ans in answers_dict.items():
            text_answers = ans.get("textAnswers", {}).get("answers", [])
            val = text_answers[0].get("value") if text_answers else None

            # File upload answers in Google Forms API return fileId in textAnswers
            file_answers = ans.get("fileUploadAnswers", {}).get("answers", [])
            if file_answers:
                drive_file_id = file_answers[0].get("fileId")
                drive_filename = file_answers[0].get("fileName", "resume.pdf")

            q_key = q_map.get(q_id)
            answers_payload[q_id] = val or (file_answers[0].get("fileName") if file_answers else "")

            if val:
                val_str = str(val).strip()
                if q_key == "full_name" or "name" in q_id.lower():
                    candidate_data["full_name"] = val_str
                elif q_key == "email" or "email" in q_id.lower() or "@" in val_str:
                    if "@" in val_str and not candidate_data["email"]:
                        candidate_data["email"] = val_str
                elif q_key == "phone" or "phone" in q_id.lower() or "mobile" in q_id.lower():
                    candidate_data["phone"] = val_str
                elif q_key == "current_location" or "location" in q_id.lower() or "city" in q_id.lower():
                    candidate_data["current_location"] = val_str
                elif q_key == "total_experience" or "experience" in q_id.lower():
                    try:
                        import re
                        m = re.search(r"(\d+(?:\.\d+)?)", val_str)
                        if m:
                            candidate_data["total_experience"] = float(m.group(1))
                    except Exception:
                        pass
                elif q_key == "notice_period" or "notice" in q_id.lower():
                    candidate_data["notice_period"] = val_str
                elif "drive.google.com" in val_str or "docs.google.com" in val_str:
                    # Check if Google Drive file link in text answer
                    import re
                    m = re.search(r"d/([a-zA-Z0-9_-]{25,})", val_str)
                    if m:
                        drive_file_id = m.group(1)

        # Fallback email check from respondent email if form collected Google account email
        if not candidate_data["email"] and resp.get("respondentEmail"):
            candidate_data["email"] = resp.get("respondentEmail")

        if not candidate_data["email"]:
            candidate_data["email"] = f"gf_applicant_{resp_id[:8]}@example.com"

        # Download resume from Google Drive if file ID extracted
        file_bytes = None
        mime_type = "application/pdf"
        if drive_file_id:
            try:
                file_bytes = drive_service.files().get_media(fileId=drive_file_id).execute()
                meta = drive_service.files().get(fileId=drive_file_id, fields="name,mimeType").execute()
                drive_filename = meta.get("name", drive_filename)
                mime_type = meta.get("mimeType", mime_type)
                try:
                    drive_filename, mime_type = validate_resume_file(file_bytes, drive_filename)
                except Exception as ve:
                    existing_sr.error_details = f"File validation notice: {str(ve)}"
            except Exception as e:
                # Log drive access error without failing submission
                existing_sr.error_details = f"Drive file download failed for ID '{drive_file_id}': {str(e)}"

        try:
            job_app = ingest_job_application(
                db=db,
                job_id=form.job_id,
                source="GoogleForms",
                candidate_data=candidate_data,
                answers_payload=answers_payload,
                file_bytes=file_bytes,
                filename=drive_filename if file_bytes else None,
                mime_type=mime_type if file_bytes else None,
                form_id=form.id,
                custom_idempotency_key=f"gf_resp:{form.id}:{resp_id}"
            )

            existing_sr.processing_status = "Processed"
            existing_sr.job_application_id = job_app.id
            existing_sr.processed_at = datetime.now(timezone.utc)
            imported_count += 1
        except Exception as e:
            existing_sr.processing_status = "Failed"
            existing_sr.error_details = str(e)

    form.sync_status = "Idle"
    form.last_sync_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "status": "Success",
        "imported_count": imported_count,
        "new_count": new_count
    }
