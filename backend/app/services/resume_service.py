import os
import uuid
import hashlib
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.models.resume import Resume
from backend.app.models.candidate import Candidate

STORAGE_BASE_DIR = os.path.join(os.getcwd(), "storage", "resumes")

def extract_text_from_file(file_path: str, mime_type: str) -> str:
    extracted_text = ""
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == ".pdf" or "pdf" in mime_type:
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            for page in doc:
                extracted_text += page.get_text() + "\n"
            doc.close()

        elif ext in [".docx", ".doc"] or "word" in mime_type:
            import docx
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                extracted_text += para.text + "\n"

        elif ext in [".txt"] or "text" in mime_type:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                extracted_text = f.read()

    except Exception as e:
        extracted_text = f"[Text Extraction Error: {str(e)}]"

    return extracted_text.strip()

def parse_extracted_text(text: str) -> dict:
    """Rule-based heuristic parsing for skills, experience, education, etc."""
    parsed = {
        "skills": [],
        "detected_experience_years": None,
        "email": None,
        "phone": None
    }
    if not text:
        return parsed

    lower_text = text.lower()

    # Skill keyword matching
    common_skills = [
        "python", "javascript", "typescript", "react", "node.js", "express", "fastapi",
        "sql", "postgresql", "mysql", "mongodb", "docker", "kubernetes", "aws", "azure",
        "gcp", "git", "rest api", "graphql", "html", "css", "tailwind", "java", "c++",
        "c#", "go", "ruby", "django", "flask", "figma", "machine learning", "ai", "pandas"
    ]
    detected_skills = [skill for skill in common_skills if skill in lower_text]
    parsed["skills"] = detected_skills

    # Experience heuristic
    import re
    exp_matches = re.findall(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\b", lower_text)
    if exp_matches:
        try:
            years = [float(x) for x in exp_matches if float(x) <= 40]
            if years:
                parsed["detected_experience_years"] = max(years)
        except Exception:
            pass

    return parsed

def store_and_process_resume(
    db: Session,
    organization_id: str,
    candidate_id: str,
    file_bytes: bytes,
    original_filename: str,
    mime_type: str
) -> Resume:
    # Ensure directory exists
    dir_path = os.path.join(STORAGE_BASE_DIR, organization_id, candidate_id)
    os.makedirs(dir_path, exist_ok=True)

    file_id = str(uuid.uuid4())
    ext = os.path.splitext(original_filename)[1] or ".bin"
    file_name = f"{file_id}{ext}"
    full_path = os.path.join(dir_path, file_name)

    # Save to disk
    with open(full_path, "wb") as f:
        f.write(file_bytes)

    # Calculate content hash and size
    content_hash = hashlib.sha256(file_bytes).hexdigest()
    file_size = len(file_bytes)

    # Extract text & parse
    extracted_text = extract_text_from_file(full_path, mime_type)
    parsed_data = parse_extracted_text(extracted_text)

    status = "Completed" if extracted_text and not extracted_text.startswith("[Text Extraction Error") else "Failed"

    resume = Resume(
        id=file_id,
        candidate_id=candidate_id,
        organization_id=organization_id,
        file_path=full_path,
        original_filename=original_filename,
        file_size=file_size,
        mime_type=mime_type,
        content_hash=content_hash,
        extracted_text=extracted_text,
        parsed_data=parsed_data,
        parser_version="1.0",
        processing_status=status
    )
    db.add(resume)
    db.flush()

    # Update candidate's latest resume_id and merged skills
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if candidate:
        candidate.resume_id = resume.id
        if parsed_data.get("skills"):
            merged_skills = list(set((candidate.skills or []) + parsed_data["skills"]))
            candidate.skills = merged_skills
        if parsed_data.get("detected_experience_years") and candidate.total_experience is None:
            candidate.total_experience = parsed_data["detected_experience_years"]
        db.flush()

    return resume
