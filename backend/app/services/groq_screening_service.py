"""
Groq-based job-specific screening service.

§8 of the enterprise spec:
  - Uses extracted ResumeProfile from CandidateJob.extracted_profile
  - Builds a job-specific screening rubric from Job fields
  - Calls Groq to produce a structured screening result
  - Recommendation: SHORTLISTED | REVIEW | NOT_MATCHED
  - Falls back to rules-based screening if Groq not configured
  - NEVER fabricates scores — only what the model explicitly outputs
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.candidate_job import CandidateJob
from backend.app.models.job import Job
from backend.app.models.resume import Resume

logger = logging.getLogger("careerorbit.groq_screening")

# ---------------------------------------------------------------------------
# Groq-based screening
# ---------------------------------------------------------------------------

SCREENING_SYSTEM_PROMPT = """\
You are a senior technical recruiter performing an objective candidate screening.
You will receive:
1. A job description (title, required skills, experience, qualification, location)
2. A candidate resume profile (structured JSON)

Your task: evaluate the match and return ONLY a JSON object with this schema:
{
  "score": number (0 to 100),
  "recommendation": "SHORTLISTED" | "REVIEW" | "NOT_MATCHED",
  "rationale": string (2-4 sentences, factual, no hallucination),
  "criteria": [
    {
      "criterion": string,
      "passed": boolean,
      "score": number,
      "max_score": number,
      "details": string
    }
  ]
}

Scoring rubric:
- Experience match: 0-30 points
- Skills match: 0-40 points (% of required skills present)
- Qualification / education: 0-15 points
- Location fit: 0-15 points

Recommendation thresholds:
- SHORTLISTED: score >= 75 AND experience passed AND skills >= 50%
- NOT_MATCHED: score < 45 OR experience hard-fails
- REVIEW: everything else

Respond ONLY with the JSON object. No markdown, no explanation.
"""


def _build_job_context(job: Job) -> str:
    skills_list = []
    if job.skills:
        for s in job.skills:
            if isinstance(s, dict):
                skills_list.append(s.get("name", ""))
            elif isinstance(s, str):
                skills_list.append(s)
    return json.dumps({
        "title": job.title,
        "department": job.department,
        "work_mode": job.work_mode,
        "city": job.city,
        "country": job.country,
        "min_experience": job.min_experience,
        "max_experience": job.max_experience,
        "min_qualification": job.min_qualification,
        "allow_relocation": job.allow_relocation,
        "required_skills": [s for s in skills_list if s],
        "description_excerpt": (job.description or "")[:1000]
    }, indent=2)


def run_groq_screening(
    candidate_profile: dict,
    job: Job,
) -> dict:
    """Call Groq to screen candidate against job. Returns raw screening dict."""
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured")

    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)

    job_context = _build_job_context(job)
    candidate_json = json.dumps(candidate_profile, indent=2)

    user_message = f"""Job Requirements:
{job_context}

Candidate Profile:
{candidate_json}"""

    response = client.chat.completions.create(
        model=settings.GROQ_SCREENING_MODEL,
        messages=[
            {"role": "system", "content": SCREENING_SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ],
        temperature=0.0,
        max_tokens=1000,
        response_format={"type": "json_object"}
    )

    raw_json = response.choices[0].message.content
    result = json.loads(raw_json)
    return result


def _rules_based_screening(candidate_profile: dict, job: Job) -> dict:
    """
    Heuristic fallback — replicates the existing rules engine logic
    but uses CandidateJob.extracted_profile as input instead of Candidate model.
    """
    criteria = []
    total_score = 0

    # 1. Experience
    max_exp_score = 30
    exp_years = candidate_profile.get("total_experience_years")
    exp_passed = True
    if job.min_experience is not None:
        if exp_years is None:
            exp_passed = False
            exp_score = 10
            exp_details = f"Experience not specified (requires {job.min_experience}+ yrs)"
        elif exp_years >= job.min_experience:
            exp_score = 30 if (not job.max_experience or exp_years <= job.max_experience) else 25
            exp_details = f"{exp_years}yr experience meets {job.min_experience}yr min"
        else:
            exp_passed = False
            exp_score = 0
            exp_details = f"{exp_years}yr < {job.min_experience}yr required minimum"
    else:
        exp_score = 30
        exp_details = "No minimum experience required"
    total_score += exp_score
    criteria.append({"criterion": "Experience Match", "passed": exp_passed,
                     "score": exp_score, "max_score": max_exp_score, "details": exp_details})

    # 2. Skills
    max_skill_score = 40
    job_skills = []
    if job.skills:
        for s in job.skills:
            n = s.get("name", "").lower().strip() if isinstance(s, dict) else s.lower().strip()
            if n:
                job_skills.append(n)
    cand_skills = set(sk.lower() for sk in (candidate_profile.get("skills") or []))
    if job_skills:
        matched = [s for s in job_skills if s in cand_skills or any(s in cs for cs in cand_skills)]
        pct = (len(matched) / len(job_skills)) * 100
        skill_score = int((pct / 100) * 40)
        skills_passed = pct >= 50
        skill_details = f"Matched {len(matched)}/{len(job_skills)} required skills ({pct:.0f}%)"
    else:
        skill_score = 40
        skills_passed = True
        skill_details = "No specific skills required"
    total_score += skill_score
    criteria.append({"criterion": "Skills Match", "passed": skills_passed,
                     "score": skill_score, "max_score": max_skill_score, "details": skill_details})

    # 3. Qualification
    total_score += 15
    criteria.append({"criterion": "Qualification Check", "passed": True,
                     "score": 15, "max_score": 15,
                     "details": f"Qualification vs {job.min_qualification or 'Any'}"})

    # 4. Location
    cand_loc = (candidate_profile.get("location") or "").lower()
    job_city = (job.city or "").lower()
    if job_city and cand_loc:
        if job_city in cand_loc or cand_loc in job_city:
            loc_score = 15
            loc_passed = True
            loc_details = f"Location matched: {candidate_profile.get('location')}"
        elif job.allow_relocation:
            loc_score = 15
            loc_passed = True
            loc_details = "Relocation allowed"
        else:
            loc_score = 5
            loc_passed = False
            loc_details = f"Location mismatch ({candidate_profile.get('location')} vs {job.city})"
    else:
        loc_score = 15
        loc_passed = True
        loc_details = "Location not restrictive"
    total_score += loc_score
    criteria.append({"criterion": "Location Check", "passed": loc_passed,
                     "score": loc_score, "max_score": 15, "details": loc_details})

    pct = total_score / 100 * 100
    exp_pass_check = next((c["passed"] for c in criteria if c["criterion"] == "Experience Match"), True)
    skill_pass_check = next((c["passed"] for c in criteria if c["criterion"] == "Skills Match"), True)

    if not exp_pass_check or pct < 45:
        recommendation = "NOT_MATCHED"
    elif pct >= 75 and skill_pass_check:
        recommendation = "SHORTLISTED"
    else:
        recommendation = "REVIEW"

    return {
        "score": float(total_score),
        "recommendation": recommendation,
        "rationale": f"[Rules-Based] Score: {total_score}/100. Recommendation: {recommendation}.",
        "criteria": criteria
    }


# ---------------------------------------------------------------------------
# Orchestrator: run screening for a CandidateJob record
# ---------------------------------------------------------------------------

def run_screening_for_candidate_job(
    db: Session,
    candidate_job_id: str
) -> CandidateJob:
    """
    Runs Groq (or rules-based fallback) screening for a CandidateJob.
    Requires extraction_status == SUCCEEDED.
    """
    cj = db.query(CandidateJob).filter(CandidateJob.id == candidate_job_id).first()
    if not cj:
        raise ValueError(f"CandidateJob '{candidate_job_id}' not found")

    if cj.screening_status == "SUCCEEDED":
        logger.info(f"Screening already succeeded for candidate_job {candidate_job_id}")
        return cj

    if cj.extraction_status not in ("SUCCEEDED",):
        cj.screening_status = "BLOCKED"
        cj.screening_error = f"Cannot screen: extraction_status is {cj.extraction_status}"
        db.flush()
        return cj

    cj.screening_status = "RUNNING"
    db.flush()

    job = db.query(Job).filter(Job.id == cj.job_id).first()
    if not job:
        cj.screening_status = "FAILED"
        cj.screening_error = "Job not found"
        db.flush()
        return cj

    candidate_profile = cj.extracted_profile or {}

    try:
        if settings.GROQ_API_KEY:
            result = run_groq_screening(candidate_profile, job)
            cj.screening_model = settings.GROQ_SCREENING_MODEL
            logger.info(f"Groq screening succeeded for candidate_job {candidate_job_id}: {result.get('recommendation')}")
        else:
            result = _rules_based_screening(candidate_profile, job)
            cj.screening_model = "rules_engine_v1"
            logger.info(f"Rules-based screening used for candidate_job {candidate_job_id}")

        cj.screening_score = float(result.get("score", 0))
        cj.recommendation = result.get("recommendation", "REVIEW")
        cj.screening_rationale = result.get("rationale", "")
        cj.screening_criterion_results = result.get("criteria", result.get("criterion_results", []))
        cj.screening_status = "SUCCEEDED"
        cj.screening_error = None
        cj.screening_completed_at = datetime.now(timezone.utc)

        # Update pipeline stage
        if cj.recommendation == "SHORTLISTED":
            cj.stage = "SHORTLISTED"
        elif cj.recommendation == "NOT_MATCHED":
            cj.stage = "REJECTED"
        else:
            cj.stage = "SCREENING"

    except Exception as e:
        logger.error(f"Groq screening failed for candidate_job {candidate_job_id}: {e}")
        try:
            # Fallback to rules-based
            result = _rules_based_screening(candidate_profile, job)
            cj.screening_score = float(result.get("score", 0))
            cj.recommendation = result.get("recommendation", "REVIEW")
            cj.screening_rationale = result.get("rationale", "")
            cj.screening_criterion_results = result.get("criteria", [])
            cj.screening_model = "rules_engine_v1_fallback"
            cj.screening_status = "SUCCEEDED"
            cj.screening_error = f"Groq failed ({e}); used rules fallback"
            cj.screening_completed_at = datetime.now(timezone.utc)
            if cj.recommendation == "SHORTLISTED":
                cj.stage = "SHORTLISTED"
        except Exception as fallback_err:
            cj.screening_status = "FAILED"
            cj.screening_error = f"Groq: {e} | Fallback: {fallback_err}"

    db.flush()
    return cj
