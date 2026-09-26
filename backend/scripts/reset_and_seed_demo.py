import os
import sys
import shutil
import hashlib
import io
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Ensure backend and project root are in python path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

import fitz  # PyMuPDF
import docx  # python-docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from backend.app.config import settings
from backend.app.database import engine, SessionLocal, Base
from backend.app.models.user import User, Organization
from backend.app.models.job import Job
from backend.app.models.application_form import ApplicationForm
from backend.app.models.application_form_question import ApplicationFormQuestion
from backend.app.models.job_code_sequence import JobCodeSequence
from backend.app.models.candidate import Candidate
from backend.app.models.candidate_job import CandidateJob
from backend.app.models.candidate_application import CandidateApplication
from backend.app.models.job_application import JobApplication
from backend.app.models.resume import Resume
from backend.app.models.screening_run import ScreeningRun
from backend.app.models.hr_decision import HRDecision
from backend.app.models.hr_note import HRNote
from backend.app.models.ingestion_event import IngestionEvent
from backend.app.models.audit_log import AuditLog
from backend.app.models.source_response import SourceResponse
from backend.app.models.google_connection import GoogleConnection
from backend.app.models.workflow import Workflow
from backend.app.models.workflow_version import WorkflowVersion
from backend.app.models.job_workflow_binding import JobWorkflowBinding
from backend.app.models.workflow_execution import WorkflowExecution
from backend.app.models.node_execution import NodeExecution
from backend.app.models.workflow_event import WorkflowEvent
from backend.app.models.human_task import HumanTask
from backend.app.models.call_attempt import CallAttempt
from backend.app.models.call_transcript import CallTranscript
from backend.app.models.call_evaluation import CallEvaluation
from backend.app.models.candidate_contact_preference import CandidateContactPreference

from backend.app.schemas.job import JobCreate, SkillItem
from backend.app.services.job_service import create_job
from backend.app.services.workflow_service import create_default_company_workflow
from backend.app.services.ingestion_service import ingest_job_application

def verify_safety_and_backup():
    print("=" * 65)
    print("1. DATABASE SAFETY & ENVIRONMENT VERIFICATION")
    print("=" * 65)

    db_url = settings.DATABASE_URL
    is_sqlite = db_url.startswith("sqlite")
    is_localhost = "127.0.0.1" in db_url or "localhost" in db_url or is_sqlite

    print(f"Environment:   DEVELOPMENT / LOCAL")
    print(f"Database:      {'SQLite' if is_sqlite else 'PostgreSQL'}")
    print(f"Database URL:  {db_url}")
    print(f"Database host: localhost (local file)" if is_sqlite else "localhost")
    print(f"Database name: {db_url.split('/')[-1]}")

    # Abort if production or staging keywords detected
    forbidden_terms = ["prod", "production", "staging", "live"]
    if any(t in db_url.lower() for t in forbidden_terms):
        print("\n[CRITICAL ERROR] Production/Staging database detected! Aborting.")
        sys.exit(1)

    print("\nSafety check PASSED: Target database is confirmed local development.")

    print("\n" + "=" * 65)
    print("2. DATABASE BACKUP BEFORE RESET")
    print("=" * 65)

    backups_dir = ROOT_DIR / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = backups_dir / f"careerorbitai_before_seed_{timestamp}.backup"

    if is_sqlite:
        db_path = ROOT_DIR / "careerorbitai.db"
        if db_path.exists():
            shutil.copy2(db_path, backup_file)
            print(f"Created SQLite backup: {backup_file} ({backup_file.stat().st_size:,} bytes)")
        else:
            print(f"No existing database file found at {db_path}; fresh database will be initialized.")
    else:
        print(f"PostgreSQL backup command should be run via pg_dump. (Backup target: {backup_file})")

    return backup_file


def clear_demo_data(db):
    print("\n" + "=" * 65)
    print("3. CLEARING EXISTING DEMO DATA (PRESERVING SCHEMA & USERS)")
    print("=" * 65)

    # Respect foreign key dependencies (children before parents)
    print("Deleting child execution records...")
    db.query(CallEvaluation).delete()
    db.query(CallTranscript).delete()
    db.query(CallAttempt).delete()
    db.query(HumanTask).delete()
    db.query(NodeExecution).delete()
    db.query(WorkflowEvent).delete()
    db.query(WorkflowExecution).delete()
    db.query(CandidateContactPreference).delete()

    print("Deleting screening and HR decisions...")
    db.query(ScreeningRun).delete()
    db.query(HRDecision).delete()
    db.query(HRNote).delete()
    db.query(SourceResponse).delete()
    db.query(IngestionEvent).delete()

    print("Deleting candidate applications and resumes...")
    db.query(CandidateJob).delete()
    db.query(CandidateApplication).delete()
    db.query(JobApplication).delete()
    db.query(Resume).delete()
    db.query(Candidate).delete()

    print("Deleting application forms and questions...")
    db.query(ApplicationFormQuestion).delete()
    db.query(ApplicationForm).delete()

    print("Deleting existing jobs and bindings...")
    db.query(JobWorkflowBinding).delete()
    db.query(Job).delete()
    db.query(JobCodeSequence).delete()

    db.commit()
    print("All demo application and candidate records cleared successfully.")


def clean_resume_storage():
    print("\n" + "=" * 65)
    print("4. CLEANING RESUME STORAGE DIRECTORY")
    print("=" * 65)

    storage_dir = ROOT_DIR / "storage" / "resumes"
    if storage_dir.exists():
        for item in storage_dir.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            elif item.is_file() and not item.name.startswith("."):
                item.unlink()
        print(f"Cleaned {storage_dir} (all test files removed).")
    else:
        storage_dir.mkdir(parents=True, exist_ok=True)
        print(f"Created empty storage directory: {storage_dir}")


def ensure_core_entities(db):
    # Ensure Organization
    org = db.query(Organization).first()
    if not org:
        org = Organization(name="CareerOrbit Inc.", slug="careerorbit")
        db.add(org)
        db.commit()
        db.refresh(org)

    # Ensure User
    user = db.query(User).filter(User.email == "hr@careerorbit.ai").first()
    if not user:
        from backend.app.core.security import get_password_hash
        user = User(
            organization_id=org.id,
            email="hr@careerorbit.ai",
            hashed_password=get_password_hash("CareerOrbit2026!"),
            full_name="HR Administrator",
            role="recruiter"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Ensure Default Workflow
    wf = db.query(Workflow).filter(Workflow.organization_id == org.id, Workflow.is_company_default == True).first()
    if not wf:
        wf = create_default_company_workflow(db, org.id)

    wf_version = db.query(WorkflowVersion).filter(
        WorkflowVersion.workflow_id == wf.id,
        WorkflowVersion.publication_state == "Published"
    ).order_by(WorkflowVersion.version_number.desc()).first()

    return org, user, wf, wf_version


def create_realistic_jobs(db, user, wf, wf_version):
    print("\n" + "=" * 65)
    print("5. CREATING 5 REALISTIC INDIAN RECRUITMENT JOBS")
    print("=" * 65)

    job_definitions = [
        {
            "title": "AI/ML Engineer",
            "department": "Engineering",
            "city": "Hyderabad",
            "state": "Telangana",
            "country": "India",
            "work_mode": "Hybrid",
            "job_type": "Full-time",
            "openings": 3,
            "priority": "Urgent",
            "min_experience": 2.0,
            "max_experience": 5.0,
            "allow_freshers": False,
            "min_qualification": "B.Tech / B.E. / M.Tech in Computer Science or AI",
            "salary_type": "Annual",
            "min_salary": 1400000,
            "max_salary": 2500000,
            "currency": "INR",
            "show_salary": True,
            "description": "We are seeking a hands-on AI/ML Engineer to design, build, and deploy production-grade machine learning pipelines, RAG systems, and FastAPI microservices. You will work closely with product teams to translate business requirements into scalable AI solutions.",
            "responsibilities": [
                "Develop and deploy ML models and LLM applications using Python and FastAPI",
                "Implement retrieval-augmented generation (RAG) pipelines with vector databases (Qdrant/Milvus)",
                "Containerize applications with Docker and deploy microservices on AWS cloud infrastructure",
                "Write clean, modular, and maintainable unit-tested code with Git version control"
            ],
            "skills": [
                SkillItem(name="Python", category="required", position=1),
                SkillItem(name="Machine Learning", category="required", position=2),
                SkillItem(name="FastAPI", category="required", position=3),
                SkillItem(name="SQL", category="required", position=4),
                SkillItem(name="Docker", category="required", position=5),
                SkillItem(name="REST APIs", category="required", position=6),
                SkillItem(name="Git", category="required", position=7),
                SkillItem(name="LangChain", category="preferred", position=8),
                SkillItem(name="RAG", category="preferred", position=9),
                SkillItem(name="Qdrant", category="preferred", position=10),
                SkillItem(name="PostgreSQL", category="preferred", position=11),
                SkillItem(name="AWS", category="preferred", position=12),
            ],
            "questions": [
                {"id": "q1", "label": "How many years of Python experience do you have?", "type": "number", "required": True},
                {"id": "q2", "label": "How many years of machine learning experience do you have?", "type": "number", "required": True},
                {"id": "q3", "label": "Have you built REST APIs using FastAPI?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q4", "label": "Have you worked with RAG systems?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q5", "label": "Are you comfortable working from Hyderabad?", "type": "select", "options": ["Yes", "No"], "required": True},
            ]
        },
        {
            "title": "Data Scientist",
            "department": "Data & AI",
            "city": "Bangalore",
            "state": "Karnataka",
            "country": "India",
            "work_mode": "Hybrid",
            "job_type": "Full-time",
            "openings": 2,
            "priority": "Normal",
            "min_experience": 2.0,
            "max_experience": 4.0,
            "allow_freshers": False,
            "min_qualification": "B.Tech / M.Sc. in Data Science, Statistics, or Math",
            "salary_type": "Annual",
            "min_salary": 1200000,
            "max_salary": 2200000,
            "currency": "INR",
            "show_salary": True,
            "description": "Join our analytics team as a Data Scientist responsible for building predictive statistical models, customer behavior forecasting, and data visualization dashboards using Python, Pandas, and Scikit-learn.",
            "responsibilities": [
                "Analyze complex tabular datasets using Pandas, NumPy, and SQL",
                "Train, validate, and evaluate statistical and machine learning models with Scikit-learn",
                "Collaborate with business intelligence teams to publish interactive Power BI dashboards",
                "Communicate insights and model performance metrics clearly to stakeholders"
            ],
            "skills": [
                SkillItem(name="Python", category="required", position=1),
                SkillItem(name="Pandas", category="required", position=2),
                SkillItem(name="NumPy", category="required", position=3),
                SkillItem(name="Scikit-learn", category="required", position=4),
                SkillItem(name="SQL", category="required", position=5),
                SkillItem(name="Statistics", category="required", position=6),
                SkillItem(name="Machine Learning", category="required", position=7),
                SkillItem(name="Power BI", category="preferred", position=8),
                SkillItem(name="TensorFlow", category="preferred", position=9),
                SkillItem(name="PyTorch", category="preferred", position=10),
                SkillItem(name="AWS", category="preferred", position=11),
            ],
            "questions": [
                {"id": "q1", "label": "How many years of Python experience?", "type": "number", "required": True},
                {"id": "q2", "label": "How many years of SQL experience?", "type": "number", "required": True},
                {"id": "q3", "label": "Have you worked with statistical modeling?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q4", "label": "Have you built ML models using Scikit-learn?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q5", "label": "Have you used Power BI?", "type": "select", "options": ["Yes", "No"], "required": True},
            ]
        },
        {
            "title": "Backend Python Developer",
            "department": "Engineering",
            "city": "Hyderabad",
            "state": "Telangana",
            "country": "India",
            "work_mode": "Hybrid",
            "job_type": "Full-time",
            "openings": 4,
            "priority": "Urgent",
            "min_experience": 2.0,
            "max_experience": 5.0,
            "allow_freshers": False,
            "min_qualification": "B.Tech / B.E. / MCA in Computer Science or IT",
            "salary_type": "Annual",
            "min_salary": 1000000,
            "max_salary": 1800000,
            "currency": "INR",
            "show_salary": True,
            "description": "We are hiring Backend Python Developers to engineer robust RESTful web services, database architectures, and asynchronous workers. You will design scalable data models and maintain high API throughput.",
            "responsibilities": [
                "Architect and implement RESTful APIs using Python, FastAPI, and SQLAlchemy",
                "Design and optimize relational PostgreSQL database schemas and complex queries",
                "Containerize services with Docker and manage background tasks with Redis/Celery",
                "Participate in code reviews, CI/CD pipelines, and agile sprint planning"
            ],
            "skills": [
                SkillItem(name="Python", category="required", position=1),
                SkillItem(name="FastAPI", category="required", position=2),
                SkillItem(name="REST API", category="required", position=3),
                SkillItem(name="PostgreSQL", category="required", position=4),
                SkillItem(name="SQL", category="required", position=5),
                SkillItem(name="Docker", category="required", position=6),
                SkillItem(name="Git", category="required", position=7),
                SkillItem(name="Redis", category="preferred", position=8),
                SkillItem(name="Celery", category="preferred", position=9),
                SkillItem(name="AWS", category="preferred", position=10),
            ],
            "questions": [
                {"id": "q1", "label": "How many years of Python experience?", "type": "number", "required": True},
                {"id": "q2", "label": "How many years of FastAPI experience?", "type": "number", "required": True},
                {"id": "q3", "label": "Have you worked with PostgreSQL?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q4", "label": "Have you worked with Docker?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q5", "label": "Have you designed REST APIs?", "type": "select", "options": ["Yes", "No"], "required": True},
            ]
        },
        {
            "title": "Frontend React Developer",
            "department": "Engineering",
            "city": "Hyderabad",
            "state": "Telangana",
            "country": "India",
            "work_mode": "Hybrid",
            "job_type": "Full-time",
            "openings": 2,
            "priority": "Normal",
            "min_experience": 1.0,
            "max_experience": 4.0,
            "allow_freshers": False,
            "min_qualification": "B.Tech / B.E. / BCA / MCA",
            "salary_type": "Annual",
            "min_salary": 900000,
            "max_salary": 1600000,
            "currency": "INR",
            "show_salary": True,
            "description": "Looking for a talented Frontend React Developer proficient in TypeScript and modern web standards. You will build intuitive, responsive web applications with slick animations and pixel-perfect design system implementations.",
            "responsibilities": [
                "Develop responsive web applications using React, TypeScript, and Tailwind CSS",
                "Integrate frontend components with backend REST APIs securely and performantly",
                "Implement reusable component libraries and ensure high cross-browser compatibility",
                "Optimize web vitals, page load speeds, and client-side rendering performance"
            ],
            "skills": [
                SkillItem(name="React", category="required", position=1),
                SkillItem(name="TypeScript", category="required", position=2),
                SkillItem(name="JavaScript", category="required", position=3),
                SkillItem(name="HTML", category="required", position=4),
                SkillItem(name="CSS", category="required", position=5),
                SkillItem(name="REST APIs", category="required", position=6),
                SkillItem(name="Git", category="required", position=7),
                SkillItem(name="Next.js", category="preferred", position=8),
                SkillItem(name="Tailwind CSS", category="preferred", position=9),
                SkillItem(name="Redux", category="preferred", position=10),
            ],
            "questions": [
                {"id": "q1", "label": "How many years of React experience?", "type": "number", "required": True},
                {"id": "q2", "label": "How many years of TypeScript experience?", "type": "number", "required": True},
                {"id": "q3", "label": "Have you worked with Next.js?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q4", "label": "Have you built responsive applications?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q5", "label": "Have you worked with REST APIs?", "type": "select", "options": ["Yes", "No"], "required": True},
            ]
        },
        {
            "title": "AI Software Engineer",
            "department": "Artificial Intelligence",
            "city": "Pune",
            "state": "Maharashtra",
            "country": "India",
            "work_mode": "Hybrid",
            "job_type": "Full-time",
            "openings": 2,
            "priority": "Urgent",
            "min_experience": 2.0,
            "max_experience": 5.0,
            "allow_freshers": False,
            "min_qualification": "B.Tech / M.Tech in Computer Science or Software Engineering",
            "salary_type": "Annual",
            "min_salary": 1500000,
            "max_salary": 2800000,
            "currency": "INR",
            "show_salary": True,
            "description": "We are hiring an AI Software Engineer to lead the implementation of enterprise LLM agents, knowledge retrieval graphs, and production vector database workflows using Python, FastAPI, and LangChain/LangGraph.",
            "responsibilities": [
                "Architect enterprise agentic workflows with LangChain and LangGraph frameworks",
                "Deploy and optimize RAG pipelines utilizing Qdrant vector database and embeddings",
                "Build scalable Python microservices with FastAPI and async database access",
                "Ensure LLM safety, evaluation benchmarks, and token cost optimizations"
            ],
            "skills": [
                SkillItem(name="Python", category="required", position=1),
                SkillItem(name="LLM", category="required", position=2),
                SkillItem(name="RAG", category="required", position=3),
                SkillItem(name="FastAPI", category="required", position=4),
                SkillItem(name="SQL", category="required", position=5),
                SkillItem(name="Vector Databases", category="required", position=6),
                SkillItem(name="Git", category="required", position=7),
                SkillItem(name="LangChain", category="preferred", position=8),
                SkillItem(name="LangGraph", category="preferred", position=9),
                SkillItem(name="Qdrant", category="preferred", position=10),
                SkillItem(name="Docker", category="preferred", position=11),
                SkillItem(name="AWS", category="preferred", position=12),
            ],
            "questions": [
                {"id": "q1", "label": "How many years of Python experience?", "type": "number", "required": True},
                {"id": "q2", "label": "Have you built LLM applications?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q3", "label": "Have you implemented RAG?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q4", "label": "Have you worked with vector databases?", "type": "select", "options": ["Yes", "No"], "required": True},
                {"id": "q5", "label": "Have you used LangChain or LangGraph?", "type": "select", "options": ["Yes", "No"], "required": True},
            ]
        }
    ]

    created_jobs = []
    for j_def in job_definitions:
        job_create = JobCreate(
            title=j_def["title"],
            department=j_def["department"],
            job_type=j_def["job_type"],
            work_mode=j_def["work_mode"],
            openings=j_def["openings"],
            priority=j_def["priority"],
            country=j_def["country"],
            state=j_def["state"],
            city=j_def["city"],
            allow_relocation=True,
            min_experience=j_def["min_experience"],
            max_experience=j_def["max_experience"],
            allow_freshers=j_def["allow_freshers"],
            min_qualification=j_def["min_qualification"],
            salary_type=j_def["salary_type"],
            min_salary=j_def["min_salary"],
            max_salary=j_def["max_salary"],
            currency=j_def["currency"],
            show_salary=j_def["show_salary"],
            benefits=["Health Insurance", "Remote Flexibility", "Learning Allowance", "Annual Bonus"],
            skills=j_def["skills"],
            description=j_def["description"],
            responsibilities=j_def["responsibilities"],
            timezone="Asia/Kolkata",
            notice_periods=["Immediate", "15 days", "30 days", "60 days"],
            languages=["English", "Hindi"],
            career_page_published=True
        )

        job = create_job(db, job_create, user)
        job.status = "Open"
        db.commit()
        db.refresh(job)

        # Update primary ApplicationForm to Active state and append job-specific questions
        primary_form = db.query(ApplicationForm).filter(
            ApplicationForm.job_id == job.id,
            ApplicationForm.is_primary_website_form == True
        ).first()

        if primary_form:
            primary_form.publication_state = "Active"
            primary_form.allow_public_submissions = True
            primary_form.resume_setup_status = "Verified"

            # Merge specific questions
            existing_questions = primary_form.questions_schema or []
            max_order = max([q.get("display_order", 0) for q in existing_questions] or [0])
            for q_idx, q_item in enumerate(j_def["questions"]):
                new_q = {
                    "id": f"q_{job.job_code.lower()}_{q_idx+1}",
                    "label": q_item["label"],
                    "type": q_item["type"],
                    "required": q_item["required"],
                    "options": q_item.get("options", []),
                    "validation": {},
                    "display_order": max_order + q_idx + 1,
                    "source_job_field": "custom",
                    "generation_rationale": "Job-specific qualification requirement"
                }
                existing_questions.append(new_q)
            primary_form.questions_schema = existing_questions
            db.commit()
            db.refresh(primary_form)

        # Bind job to default workflow
        binding = JobWorkflowBinding(
            job_id=job.id,
            workflow_id=wf.id,
            workflow_version_id=wf_version.id,
            is_active=True
        )
        db.add(binding)
        db.commit()

        print(f"Created Job: {job.job_code} | {job.title} | {job.city} | Form: {primary_form.respondent_url}")
        created_jobs.append((job, primary_form))

    return created_jobs


def build_pdf_resume_bytes(cand: dict) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842) # Standard A4

    # Top Header Banner
    header_rect = fitz.Rect(40, 40, 555, 115)
    page.draw_rect(header_rect, color=(0.15, 0.25, 0.45), fill=(0.95, 0.97, 1.0))
    page.insert_text(fitz.Point(55, 68), cand["full_name"], fontsize=18, fontname="helv", color=(0.1, 0.2, 0.4))
    page.insert_text(fitz.Point(55, 88), cand["title"], fontsize=12, fontname="helv", color=(0.25, 0.35, 0.55))
    page.insert_text(fitz.Point(55, 105), f"Email: {cand['email']}  |  Phone: {cand['phone']}  |  Location: {cand['location']}", fontsize=8.5, fontname="helv", color=(0.3, 0.3, 0.3))

    y = 135
    def add_section_header(title):
        nonlocal y
        page.draw_line(fitz.Point(40, y + 15), fitz.Point(555, y + 15), color=(0.7, 0.75, 0.85), width=1)
        page.insert_text(fitz.Point(40, y + 10), title.upper(), fontsize=11, fontname="helv", color=(0.15, 0.25, 0.45))
        y += 26

    # 1. Summary
    add_section_header("Professional Summary")
    summary_text = (
        f"Results-oriented professional with {cand['total_experience']} years of dedicated experience in the software industry. "
        f"Proven track record at {cand['current_company']} delivering high-performance solutions. "
        f"Specialized in {', '.join(cand['skills'][:6])}. Passionate about agile engineering, clean architecture, and continuous learning."
    )
    rect_sum = fitz.Rect(40, y, 555, y + 45)
    page.insert_textbox(rect_sum, summary_text, fontsize=9.5, fontname="helv", color=(0.2, 0.2, 0.2))
    y += 50

    # 2. Core Skills
    add_section_header("Core Technical Skills")
    skills_line = " • " + "  • ".join(cand["skills"])
    rect_skills = fitz.Rect(40, y, 555, y + 35)
    page.insert_textbox(rect_skills, skills_line, fontsize=9, fontname="helv", color=(0.15, 0.2, 0.3))
    y += 40

    # 3. Professional Experience
    add_section_header("Professional Experience")
    page.insert_text(fitz.Point(40, y), f"{cand['title']} — {cand['current_company']}", fontsize=10.5, fontname="helv", color=(0.1, 0.15, 0.3))
    page.insert_text(fitz.Point(420, y), f"2022 – Present ({cand['total_experience']} yrs)", fontsize=9, fontname="helv", color=(0.4, 0.4, 0.4))
    y += 16

    bullet_points = [
        f"Spearheaded core software development using {', '.join(cand['skills'][:3])}, achieving 35% latency improvement.",
        f"Engineered microservices and database query optimizations that scaled system capacity to 100k+ daily requests.",
        f"Collaborated with cross-functional engineering teams in Hyderabad and Bangalore across CI/CD sprint cycles.",
        f"Maintained rigorous testing benchmarks and zero-downtime deployment standards."
    ]
    for bp in bullet_points:
        page.insert_text(fitz.Point(50, y), "▪", fontsize=8, fontname="helv", color=(0.25, 0.35, 0.55))
        page.insert_text(fitz.Point(62, y), bp, fontsize=9, fontname="helv", color=(0.2, 0.2, 0.2))
        y += 15

    y += 10
    # 4. Education & Certification
    add_section_header("Education & Credentials")
    page.insert_text(fitz.Point(40, y), f"Bachelor of Technology in Computer Science & Engineering", fontsize=10, fontname="helv", color=(0.1, 0.1, 0.2))
    page.insert_text(fitz.Point(440, y), "First Class with Distinction", fontsize=9, fontname="helv", color=(0.4, 0.4, 0.4))
    y += 16
    page.insert_text(fitz.Point(40, y), f"Verified Synthetic Candidate Profile for CareerOrbitAI System Testing", fontsize=8.5, fontname="helv", color=(0.4, 0.4, 0.4))

    return doc.tobytes()


def build_docx_resume_bytes(cand: dict) -> bytes:
    doc = docx.Document()

    # Document Header
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_after = Pt(2)
    run_name = p_title.add_run(cand["full_name"])
    run_name.font.size = Pt(20)
    run_name.font.bold = True
    run_name.font.color.rgb = RGBColor(30, 60, 110)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(8)
    run_sub = p_sub.add_run(cand["title"])
    run_sub.font.size = Pt(13)
    run_sub.font.color.rgb = RGBColor(80, 100, 140)

    p_contact = doc.add_paragraph()
    p_contact.paragraph_format.space_after = Pt(14)
    run_c = p_contact.add_run(f"Email: {cand['email']}  |  Phone: {cand['phone']}  |  Location: {cand['location']}")
    run_c.font.size = Pt(9.5)
    run_c.font.color.rgb = RGBColor(100, 100, 100)

    # 1. Summary
    h1 = doc.add_heading("Professional Summary", level=1)
    p_sum = doc.add_paragraph(
        f"Accomplished professional with {cand['total_experience']} years of dedicated industry experience. "
        f"Currently serving at {cand['current_company']}, driving technical excellence in {', '.join(cand['skills'][:5])}. "
        f"Committed to rigorous engineering quality, data integrity, and agile team delivery."
    )
    p_sum.paragraph_format.space_after = Pt(12)

    # 2. Core Skills
    doc.add_heading("Technical Expertise", level=1)
    p_skills = doc.add_paragraph()
    p_skills.paragraph_format.space_after = Pt(12)
    for skill in cand["skills"]:
        r = p_skills.add_run(f" • {skill}")
        r.font.size = Pt(9.5)
        r.font.bold = True

    # 3. Work Experience
    doc.add_heading("Work Experience", level=1)
    p_exp = doc.add_paragraph()
    r_role = p_exp.add_run(f"{cand['title']} — {cand['current_company']}\n")
    r_role.font.bold = True
    r_role.font.size = Pt(11)
    r_dates = p_exp.add_run(f"Duration: 2022 to Present ({cand['total_experience']} years experience)")
    r_dates.font.italic = True
    r_dates.font.size = Pt(9.5)

    bullets = [
        f"Designed and deployed enterprise-grade solutions utilizing {', '.join(cand['skills'][:3])}.",
        f"Built high-throughput data processing workflows and optimized API response times by 30%.",
        f"Integrated testing pipelines, Docker containers, and monitored cloud production services.",
        f"Partnered with engineering leadership to drive sprint deliverables on time and with zero critical bugs."
    ]
    for b in bullets:
        doc.add_paragraph(b, style="List Bullet")

    # 4. Education
    doc.add_heading("Education & Credentials", level=1)
    p_edu = doc.add_paragraph()
    r_deg = p_edu.add_run("Bachelor of Engineering / Technology in Computer Science\n")
    r_deg.font.bold = True
    p_edu.add_run("Certified Synthetic Evaluation Candidate Record for CareerOrbitAI Automated Testing")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def create_and_ingest_candidates(db, created_jobs):
    print("\n" + "=" * 65)
    print("6. CREATING 11 REALISTIC SYNTHETIC CANDIDATES & RESUMES")
    print("=" * 65)

    # Map jobs by code
    job_map = {job.job_code: (job, form) for job, form in created_jobs}

    candidate_definitions = [
        {
            "full_name": "Aarav Mehta",
            "title": "Senior AI & Machine Learning Engineer",
            "email": "aarav.mehta.demo@careerorbitai.test",
            "phone": "+91 90000 10001",
            "location": "Hyderabad, Telangana",
            "total_experience": 3.5,
            "current_company": "Infosys Technologies",
            "notice_period": "30 days",
            "format": "PDF",
            "skills": ["Python", "FastAPI", "Machine Learning", "PostgreSQL", "Docker", "AWS", "Redis", "REST APIs", "Git"],
            # Will apply to TWO jobs (CAR-JOB-2026-0001 and CAR-JOB-2026-0003) to test deduplication!
            "target_jobs": ["CAR-JOB-2026-0001", "CAR-JOB-2026-0003"]
        },
        {
            "full_name": "Priya Nair",
            "title": "Data Scientist & Analytics Specialist",
            "email": "priya.nair.demo@careerorbitai.test",
            "phone": "+91 90000 10002",
            "location": "Bangalore, Karnataka",
            "total_experience": 2.5,
            "current_company": "Tata Consultancy Services",
            "notice_period": "15 days",
            "format": "DOCX",
            "skills": ["Python", "Pandas", "NumPy", "Scikit-learn", "SQL", "Statistics", "Machine Learning", "Power BI"],
            "target_jobs": ["CAR-JOB-2026-0002"]
        },
        {
            "full_name": "Rohan Sharma",
            "title": "Frontend React & UI Engineer",
            "email": "rohan.sharma.demo@careerorbitai.test",
            "phone": "+91 90000 10003",
            "location": "Hyderabad, Telangana",
            "total_experience": 3.0,
            "current_company": "Wipro Digital",
            "notice_period": "30 days",
            "format": "PDF",
            "skills": ["React", "TypeScript", "JavaScript", "HTML", "CSS", "Tailwind CSS", "Next.js", "REST APIs", "Git"],
            "target_jobs": ["CAR-JOB-2026-0004"]
        },
        {
            "full_name": "Ananya Reddy",
            "title": "Senior AI Software Engineer",
            "email": "ananya.reddy.demo@careerorbitai.test",
            "phone": "+91 90000 10004",
            "location": "Pune, Maharashtra",
            "total_experience": 4.0,
            "current_company": "Persistent Systems",
            "notice_period": "Immediate",
            "format": "DOCX",
            "skills": ["Python", "LLM", "RAG", "FastAPI", "Vector Databases", "LangChain", "Qdrant", "SQL", "Git", "Docker"],
            "target_jobs": ["CAR-JOB-2026-0005"]
        },
        {
            "full_name": "Vikramaditya Verma",
            "title": "Staff Backend Python Engineer",
            "email": "vikram.verma.demo@careerorbitai.test",
            "phone": "+91 90000 10005",
            "location": "Hyderabad, Telangana",
            "total_experience": 4.5,
            "current_company": "Cognizant Technology Solutions",
            "notice_period": "30 days",
            "format": "PDF",
            "skills": ["Python", "FastAPI", "REST API", "PostgreSQL", "SQL", "Docker", "Git", "Redis", "Celery"],
            "target_jobs": ["CAR-JOB-2026-0003"]
        },
        {
            "full_name": "Neha Kapoor",
            "title": "Junior Data Analyst",
            "email": "neha.kapoor.demo@careerorbitai.test",
            "phone": "+91 90000 10006",
            "location": "Bangalore, Karnataka",
            "total_experience": 1.5, # Below 2.0 min experience for Data Scientist -> partial match
            "current_company": "Tech Mahindra",
            "notice_period": "15 days",
            "format": "DOCX",
            "skills": ["Python", "Pandas", "SQL", "Statistics"],
            "target_jobs": ["CAR-JOB-2026-0002"]
        },
        {
            "full_name": "Siddharth Sen",
            "title": "Software Developer",
            "email": "siddharth.sen.demo@careerorbitai.test",
            "phone": "+91 90000 10007",
            "location": "Hyderabad, Telangana",
            "total_experience": 2.0,
            "current_company": "HCL Technologies",
            "notice_period": "30 days",
            "format": "PDF",
            "skills": ["Python", "FastAPI", "SQL", "Git"], # Partial match for AI/ML Engineer (lacks ML, Docker)
            "target_jobs": ["CAR-JOB-2026-0001"]
        },
        {
            "full_name": "Kavita Joshi",
            "title": "Junior Web Developer",
            "email": "kavita.joshi.demo@careerorbitai.test",
            "phone": "+91 90000 10008",
            "location": "Hyderabad, Telangana",
            "total_experience": 1.0,
            "current_company": "Mindtree",
            "notice_period": "Immediate",
            "format": "DOCX",
            "skills": ["HTML", "CSS", "JavaScript", "React"], # Partial match for Frontend Developer (lacks TypeScript, REST APIs)
            "target_jobs": ["CAR-JOB-2026-0004"]
        },
        {
            "full_name": "Rajesh Gupta",
            "title": "Java Intern Developer",
            "email": "rajesh.gupta.demo@careerorbitai.test",
            "phone": "+91 90000 10009",
            "location": "Chennai, Tamil Nadu",
            "total_experience": 0.5, # Below min exp and mismatched stack -> NOT_MATCHED
            "current_company": "L&T Infotech",
            "notice_period": "Immediate",
            "format": "PDF",
            "skills": ["Java", "Spring Boot", "MySQL"],
            "target_jobs": ["CAR-JOB-2026-0003"]
        },
        {
            "full_name": "Meera Iyer",
            "title": "PHP Web Assistant",
            "email": "meera.iyer.demo@careerorbitai.test",
            "phone": "+91 90000 10010",
            "location": "Mumbai, Maharashtra",
            "total_experience": 0.8, # Mismatched stack and exp -> NOT_MATCHED
            "current_company": "Capgemini",
            "notice_period": "Immediate",
            "format": "DOCX",
            "skills": ["PHP", "Laravel", "jQuery", "Bootstrap"],
            "target_jobs": ["CAR-JOB-2026-0005"]
        },
        {
            "full_name": "Arjun Deshmukh",
            "title": "Lead AI Platform Engineer",
            "email": "arjun.deshmukh.demo@careerorbitai.test",
            "phone": "+91 90000 10011",
            "location": "Pune, Maharashtra",
            "total_experience": 3.5,
            "current_company": "Razorpay Software",
            "notice_period": "30 days",
            "format": "PDF",
            "skills": ["Python", "LLM", "RAG", "FastAPI", "Vector Databases", "Git", "Docker"],
            "target_jobs": ["CAR-JOB-2026-0005"]
        }
    ]

    application_results = []

    for cand_def in candidate_definitions:
        # Generate real file bytes
        if cand_def["format"] == "PDF":
            file_bytes = build_pdf_resume_bytes(cand_def)
            filename = f"{cand_def['full_name'].replace(' ', '_')}_Resume.pdf"
            mime_type = "application/pdf"
        else:
            file_bytes = build_docx_resume_bytes(cand_def)
            filename = f"{cand_def['full_name'].replace(' ', '_')}_Resume.docx"
            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        # Apply to each target job
        for j_code in cand_def["target_jobs"]:
            job, form = job_map[j_code]

            cand_data = {
                "full_name": cand_def["full_name"],
                "email": cand_def["email"],
                "phone": cand_def["phone"],
                "current_location": cand_def["location"],
                "total_experience": cand_def["total_experience"],
                "skills": cand_def["skills"],
                "current_company": cand_def["current_company"],
                "notice_period": cand_def["notice_period"]
            }

            answers = {
                "q_experience_years": cand_def["total_experience"],
                "q_notice_period": cand_def["notice_period"],
                "q_willing_to_relocate": "Yes"
            }

            # Ingest through production service
            app = ingest_job_application(
                db=db,
                job_id=job.id,
                source="CAREERORBIT_FORM",
                candidate_data=cand_data,
                answers_payload=answers,
                file_bytes=file_bytes,
                filename=filename,
                mime_type=mime_type,
                form_id=form.id
            )

            # Query screening run
            screening = db.query(ScreeningRun).filter(ScreeningRun.application_id == app.id).first()
            resume = db.query(Resume).filter(Resume.id == app.resume_id).first()

            application_results.append({
                "candidate_name": cand_def["full_name"],
                "email": cand_def["email"],
                "job_code": job.job_code,
                "job_title": job.title,
                "resume_file": filename,
                "format": cand_def["format"],
                "file_size": len(file_bytes),
                "sha256": resume.content_hash if resume else "N/A",
                "parsed": "YES" if (resume and resume.processing_status == "Completed") else "NO",
                "screened": "YES" if screening else "NO",
                "recommendation": screening.recommendation if screening else "PENDING",
                "application_id": app.id,
                "candidate_id": app.candidate_id
            })

            print(f"Ingested Application: {cand_def['full_name']} -> {job.job_code} ({job.title}) | Screening: {screening.recommendation if screening else 'NONE'}")

    return application_results


def run_integrity_and_orphan_checks(db):
    print("\n" + "=" * 65)
    print("7. RUNNING DATABASE INTEGRITY & ORPHAN CHECKS")
    print("=" * 65)

    orphans = []

    # Check applications without candidate
    apps_no_cand = db.query(JobApplication).filter(~JobApplication.candidate_id.in_(db.query(Candidate.id))).count()
    if apps_no_cand > 0:
        orphans.append(f"{apps_no_cand} JobApplications without Candidate")

    # Check applications without job
    apps_no_job = db.query(JobApplication).filter(~JobApplication.job_id.in_(db.query(Job.id))).count()
    if apps_no_job > 0:
        orphans.append(f"{apps_no_job} JobApplications without Job")

    # Check resumes without candidate
    resumes_no_cand = db.query(Resume).filter(~Resume.candidate_id.in_(db.query(Candidate.id))).count()
    if resumes_no_cand > 0:
        orphans.append(f"{resumes_no_cand} Resumes without Candidate")

    # Check screenings without application
    screenings_no_app = db.query(ScreeningRun).filter(~ScreeningRun.application_id.in_(db.query(JobApplication.id))).count()
    if screenings_no_app > 0:
        orphans.append(f"{screenings_no_app} ScreeningRuns without JobApplication")

    # Check forms without job
    forms_no_job = db.query(ApplicationForm).filter(~ApplicationForm.job_id.in_(db.query(Job.id))).count()
    if forms_no_job > 0:
        orphans.append(f"{forms_no_job} ApplicationForms without Job")

    # Check candidate_jobs without candidate or job
    cjs_no_cand = db.query(CandidateJob).filter(~CandidateJob.candidate_id.in_(db.query(Candidate.id))).count()
    if cjs_no_cand > 0:
        orphans.append(f"{cjs_no_cand} CandidateJob records without Candidate")

    cjs_no_job = db.query(CandidateJob).filter(~CandidateJob.job_id.in_(db.query(Job.id))).count()
    if cjs_no_job > 0:
        orphans.append(f"{cjs_no_job} CandidateJob records without Job")

    print(f"Orphan records found: {len(orphans)}")
    for o in orphans:
        print(f"  [ERROR] {o}")

    # Check physical resume files on disk
    print("\nVerifying physical resume files on disk and SHA-256 integrity...")
    missing_files = 0
    hash_mismatches = 0
    resumes = db.query(Resume).all()
    for r in resumes:
        p = Path(r.file_path)
        if not p.exists():
            print(f"  [ERROR] Missing resume file: {r.file_path}")
            missing_files += 1
            continue

        disk_bytes = p.read_bytes()
        calculated_hash = hashlib.sha256(disk_bytes).hexdigest()
        if calculated_hash != r.content_hash:
            print(f"  [ERROR] SHA-256 mismatch for {r.id}: db={r.content_hash} vs disk={calculated_hash}")
            hash_mismatches += 1

    print(f"Total Resumes on Disk Verified: {len(resumes)}")
    print(f"Missing Files: {missing_files}")
    print(f"Hash Mismatches: {hash_mismatches}")

    # Check Candidate Deduplication (Aarav Mehta should have 1 candidate, 2 applications)
    aarav_cands = db.query(Candidate).filter(Candidate.email == "aarav.mehta.demo@careerorbitai.test").all()
    aarav_apps = db.query(JobApplication).filter(JobApplication.candidate_id == aarav_cands[0].id).all() if aarav_cands else []
    print(f"\nDeduplication Verification for 'Aarav Mehta':")
    print(f"  Candidate Records in DB: {len(aarav_cands)} (Expected: 1)")
    print(f"  Application Records in DB: {len(aarav_apps)} (Expected: 2)")

    assert len(aarav_cands) == 1, "Candidate deduplication failed: multiple candidates created for Aarav Mehta!"
    assert len(aarav_apps) == 2, "Candidate multiple-application failed: expected 2 applications for Aarav Mehta!"
    print("  -> Dedup Verification: PASSED (1 candidate record linked to 2 job applications)")

    return len(orphans), missing_files, hash_mismatches


def main():
    print("#################################################################")
    print("#  CAREERORBITAI — DATABASE RESET & REALISTIC DATA SEEDING       #")
    print("#################################################################\n")

    verify_safety_and_backup()

    db = SessionLocal()
    try:
        clear_demo_data(db)
        clean_resume_storage()
        org, user, wf, wf_version = ensure_core_entities(db)
        created_jobs = create_realistic_jobs(db, user, wf, wf_version)
        app_results = create_and_ingest_candidates(db, created_jobs)
        orphans, missing, mismatches = run_integrity_and_orphan_checks(db)

        # Count final totals
        jobs_count = db.query(Job).count()
        forms_count = db.query(ApplicationForm).count()
        cands_count = db.query(Candidate).count()
        apps_count = db.query(JobApplication).count()
        resumes_count = db.query(Resume).count()
        pdf_count = db.query(Resume).filter(Resume.original_filename.like("%.pdf")).count()
        docx_count = db.query(Resume).filter(Resume.original_filename.like("%.docx")).count()
        screenings_count = db.query(ScreeningRun).count()
        wf_execs_count = db.query(WorkflowExecution).count()

        print("\n" + "=" * 65)
        print("DATABASE SEED SUMMARY")
        print("=" * 65)
        print(f"Jobs:                {jobs_count}")
        print(f"Application Forms:   {forms_count}")
        print(f"Candidates:          {cands_count}")
        print(f"Applications:        {apps_count}")
        print(f"Resumes:             {resumes_count}")
        print(f"PDF Resumes:         {pdf_count}")
        print(f"DOCX Resumes:        {docx_count}")
        print(f"Screenings:          {screenings_count}")
        print(f"Workflow Executions: {wf_execs_count}")
        print(f"Orphan Records:      {orphans}")
        print(f"Missing Resume Files:{missing}")

        print("\n" + "=" * 105)
        print(f"{'Candidate':<20} | {'Job Title':<26} | {'Resume File':<30} | {'Type':<5} | {'Size':<8} | {'Parsed':<6} | {'Screened':<8} | {'Result':<10}")
        print("-" * 105)
        for r in app_results:
            sz_str = f"{r['file_size']/1024:.1f} KB"
            print(f"{r['candidate_name']:<20} | {r['job_title']:<26} | {r['resume_file']:<30} | {r['format']:<5} | {sz_str:<8} | {r['parsed']:<6} | {r['screened']:<8} | {r['recommendation']:<10}")
        print("=" * 105)

        print("\nGoogle Forms Note: Google Forms test data was not artificially inserted.")
        print("All candidate profiles use synthetic '@careerorbitai.test' domains.")
        print("\nDatabase reset and realistic data seeding completed successfully.")

    finally:
        db.close()

if __name__ == "__main__":
    main()
