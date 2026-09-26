from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.google_connection import GoogleConnection
from backend.app.core.security import get_current_user
from backend.app.config import settings
from backend.app.services.google_service import (
    generate_google_auth_url,
    process_oauth_callback
)

router = APIRouter(prefix="/integrations/google", tags=["Google Integration"])

@router.get("/connect")
def connect_google_account(
    current_user: User = Depends(get_current_user)
):
    return generate_google_auth_url(current_user)

@router.get("/callback")
def google_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    if error:
        html_content = f"""
        <html>
            <body style="font-family: sans-serif; background: #0f172a; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                <div style="background: #1e293b; padding: 32px; border-radius: 12px; border: 1px solid #334155; text-align: center; max-width: 400px;">
                    <h2 style="color: #f43f5e; margin-top: 0;">OAuth Connection Error</h2>
                    <p style="color: #94a3b8; font-size: 14px;">Google returned an authorization error: {error}</p>
                    <button onclick="window.close()" style="background: #334155; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 16px;">Close Window</button>
                </div>
            </body>
        </html>
        """
        return HTMLResponse(content=html_content, status_code=400)

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter in callback")

    try:
        conn = process_oauth_callback(db, code, state)
        html_success = f"""
        <html>
            <body style="font-family: sans-serif; background: #0f172a; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                <div style="background: #1e293b; padding: 32px; border-radius: 12px; border: 1px solid #334155; text-align: center; max-width: 400px;">
                    <div style="width: 48px; height: 48px; background: rgba(16, 185, 129, 0.2); color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;">✓</div>
                    <h2 style="color: white; margin-top: 0;">Google Account Connected!</h2>
                    <p style="color: #94a3b8; font-size: 14px;">Connected as <strong style="color: #38bdf8;">{conn.display_email}</strong></p>
                    <p style="color: #64748b; font-size: 12px;">You can close this window now and return to CareerOrbitAI.</p>
                    <script>
                        setTimeout(function() {{
                            if (window.opener) {{
                                window.opener.postMessage("GOOGLE_AUTH_SUCCESS", "*");
                            }}
                            window.close();
                        }}, 2000);
                    </script>
                </div>
            </body>
        </html>
        """
        return HTMLResponse(content=html_success)
    except Exception as e:
        html_fail = f"""
        <html>
            <body style="font-family: sans-serif; background: #0f172a; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                <div style="background: #1e293b; padding: 32px; border-radius: 12px; border: 1px solid #334155; text-align: center; max-width: 400px;">
                    <h2 style="color: #f43f5e; margin-top: 0;">Connection Failed</h2>
                    <p style="color: #94a3b8; font-size: 14px;">{str(e)}</p>
                    <button onclick="window.close()" style="background: #334155; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 16px;">Close</button>
                </div>
            </body>
        </html>
        """
        return HTMLResponse(content=html_fail, status_code=400)

@router.get("/status")
def get_google_connection_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conn = db.query(GoogleConnection).filter(
        GoogleConnection.organization_id == current_user.organization_id,
        GoogleConnection.user_id == current_user.id
    ).first()

    configured = bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

    if not configured:
        return {
            "configured": False,
            "connected": False,
            "message": "Google Forms integration is not configured."
        }

    if not conn:
        return {
            "configured": True,
            "connected": False,
            "message": "No Google account connected."
        }

    return {
        "configured": True,
        "connected": conn.status == "Connected",
        "connection_id": conn.id,
        "display_email": conn.display_email,
        "google_account_id": conn.google_account_id,
        "status": conn.status,
        "granted_scopes": conn.granted_scopes,
        "created_at": conn.created_at
    }

@router.delete("/{connection_id}", status_code=status.HTTP_200_OK)
def disconnect_google_account(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conn = db.query(GoogleConnection).filter(
        GoogleConnection.id == connection_id,
        GoogleConnection.organization_id == current_user.organization_id
    ).first()

    if not conn:
        raise HTTPException(status_code=404, detail="Google Connection not found")

    conn.status = "Revoked"
    db.delete(conn)
    db.commit()

    return {"message": "Google account disconnected successfully."}
