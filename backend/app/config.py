import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ensure .env is located and loaded regardless of current working directory
BASE_DIR = Path(__file__).resolve().parent.parent  # backend directory
ROOT_DIR = BASE_DIR.parent  # repository root

# Explicitly load backend/.env if present, otherwise root .env
if (BASE_DIR / ".env").exists():
    load_dotenv(BASE_DIR / ".env", override=True)
elif (ROOT_DIR / ".env").exists():
    load_dotenv(ROOT_DIR / ".env", override=True)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[
            str(BASE_DIR / ".env"),
            str(ROOT_DIR / ".env"),
            ".env",
            "backend/.env"
        ],
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "CareerOrbitAI"
    VERSION: str = "2.0.0"
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = "sqlite:///./careerorbitai.db"

    # Security
    JWT_SECRET: str = "super-secret-key-change-in-production-2026-careerorbit"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Timezone default
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"

    # OAuth Settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/integrations/google/callback"
    TOKEN_ENCRYPTION_KEY: str = ""
    PUBLIC_APP_URL: str = "http://localhost:3000"
    GOOGLE_FORMS_SYNC_INTERVAL_SECONDS: int = 30

    MS_CLIENT_ID: str = ""
    MS_CLIENT_SECRET: str = ""

    # ElevenLabs AI Calling & Telephony
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_AGENT_ID: str = ""
    ELEVENLABS_PHONE_NUMBER_ID: str = ""
    ELEVENLABS_WEBHOOK_SECRET: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Workflow Engine Polling Interval (Seconds)
    WORKFLOW_ENGINE_POLL_INTERVAL_SECONDS: int = 5

    # Groq AI — Resume Extraction & Screening
    GROQ_API_KEY: str = ""
    GROQ_EXTRACTION_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_SCREENING_MODEL: str = "llama-3.3-70b-versatile"

    # File Storage
    STORAGE_BASE_DIR: str = ""  # If empty, defaults to <cwd>/storage/resumes

    # Webhook replay protection window (seconds)
    WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: int = 300

settings = Settings()
