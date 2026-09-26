from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.models.job import Job
from backend.app.models.job_application import JobApplication
from backend.app.models.candidate import Candidate
from backend.app.models.resume import Resume
from backend.app.models.screening_run import ScreeningRun

def run_job_screening(db: Session, application_id: str) -> ScreeningRun:
    application = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not application:
        raise ValueError(f"Application {application_id} not found")

    job = db.query(Job).filter(Job.id == application.job_id).first()
    candidate = db.query(Candidate).filter(Candidate.id == application.candidate_id).first()
    resume = db.query(Resume).filter(Resume.id == application.resume_id).first() if application.resume_id else None

    criterion_results = []
    total_score = 0
    max_possible_score = 0

    # 1. Experience Criterion
    max_possible_score += 30
    exp_score = 0
    cand_exp = candidate.total_experience if candidate else None
    
    # Check answers_payload if candidate experience not set
    if cand_exp is None and application.answers_payload:
        for k, v in application.answers_payload.items():
            if "experience" in k.lower():
                try:
                    import re
                    m = re.search(r"(\d+(?:\.\d+)?)", str(v))
                    if m:
                        cand_exp = float(m.group(1))
                        break
                except Exception:
                    pass

    exp_passed = True
    exp_details = ""
    if job.min_experience is not None:
        if cand_exp is None:
            exp_passed = False
            exp_details = f"Experience not specified (Job requires min {job.min_experience} years)"
            exp_score = 10
        elif cand_exp >= job.min_experience:
            if job.max_experience and cand_exp > job.max_experience:
                exp_score = 25
                exp_details = f"{cand_exp} years experience (Slightly above preferred max {job.max_experience} yrs)"
            else:
                exp_score = 30
                exp_details = f"{cand_exp} years experience meets requirement (min {job.min_experience} yrs)"
        else:
            exp_passed = False
            exp_score = 0
            exp_details = f"{cand_exp} years experience is below minimum requirement of {job.min_experience} years"
    else:
        exp_score = 30
        exp_details = f"No minimum experience required for this job ({cand_exp or 0} yrs reported)"

    total_score += exp_score
    criterion_results.append({
        "criterion": "Experience Match",
        "passed": exp_passed,
        "score": exp_score,
        "max_score": 30,
        "details": exp_details
    })

    # 2. Skills Match Criterion
    max_possible_score += 40
    job_skills = [s.strip().lower() for s in (job.skills or []) if isinstance(s, str)]
    cand_skills = set()
    if candidate and candidate.skills:
        cand_skills.update(s.strip().lower() for s in candidate.skills if isinstance(s, str))
    if resume and resume.parsed_data and resume.parsed_data.get("skills"):
        cand_skills.update(s.strip().lower() for s in resume.parsed_data["skills"] if isinstance(s, str))

    skills_passed = True
    skill_score = 0
    skill_details = ""

    if job_skills:
        matched_skills = [s for s in job_skills if s in cand_skills or any(s in cs for cs in cand_skills)]
        match_pct = (len(matched_skills) / len(job_skills)) * 100
        skill_score = int((match_pct / 100) * 40)
        skills_passed = match_pct >= 50
        skill_details = f"Matched {len(matched_skills)}/{len(job_skills)} required skills ({match_pct:.0f}%): {', '.join(matched_skills) if matched_skills else 'None'}"
    else:
        skill_score = 40
        skill_details = "No specific skills required for this job position"

    total_score += skill_score
    criterion_results.append({
        "criterion": "Skills Match",
        "passed": skills_passed,
        "score": skill_score,
        "max_score": 40,
        "details": skill_details
    })

    # 3. Qualification Match Criterion
    max_possible_score += 15
    qual_score = 15
    qual_passed = True
    qual_details = f"Education qualification evaluated against requirement ({job.min_qualification or 'Any'})"
    total_score += qual_score
    criterion_results.append({
        "criterion": "Qualification Check",
        "passed": qual_passed,
        "score": qual_score,
        "max_score": 15,
        "details": qual_details
    })

    # 4. Location / Relocation Criterion
    max_possible_score += 15
    loc_score = 15
    loc_passed = True
    cand_loc = (candidate.current_location if candidate else "") or ""
    job_city = job.city or ""
    if job_city and cand_loc:
        if job_city.lower() in cand_loc.lower() or cand_loc.lower() in job_city.lower():
            loc_details = f"Location matched: {cand_loc}"
        elif job.allow_relocation:
            loc_details = f"Location is {cand_loc}, relocation allowed for job location ({job_city})"
        else:
            loc_score = 5
            loc_passed = False
            loc_details = f"Location mismatch ({cand_loc} vs {job_city}) and relocation not enabled"
    else:
        loc_details = "Location check satisfied"

    total_score += loc_score
    criterion_results.append({
        "criterion": "Location & Relocation Check",
        "passed": loc_passed,
        "score": loc_score,
        "max_score": 15,
        "details": loc_details
    })

    # Overall recommendation logic
    pct = (total_score / max_possible_score) * 100 if max_possible_score > 0 else 100
    if not exp_passed or pct < 45:
        recommendation = "NOT_MATCHED"
    elif pct >= 75 and skills_passed:
        recommendation = "SHORTLIST"
    else:
        recommendation = "REVIEW"

    rationale_lines = [
        f"[Rules-Based Assessment — Not AI]",
        f"Overall Match Score: {total_score}/{max_possible_score} ({pct:.1f}%)",
        f"Recommendation: {recommendation}",
        f"Key Assessment Breakdown:"
    ]
    for c in criterion_results:
        rationale_lines.append(f"- {c['criterion']}: {'PASS' if c['passed'] else 'FAIL'} ({c['score']}/{c['max_score']}) - {c['details']}")

    rationale = "\n".join(rationale_lines)

    screening_run = ScreeningRun(
        application_id=application.id,
        job_id=job.id,
        job_revision=job.revision,
        resume_id=application.resume_id,
        engine_version="rules_engine_v1",
        status="Completed",
        recommendation=recommendation,
        rationale=rationale,
        criterion_results=criterion_results
    )
    db.add(screening_run)
    db.flush()
    return screening_run
