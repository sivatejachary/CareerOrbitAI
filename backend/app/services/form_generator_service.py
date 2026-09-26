from typing import List
from backend.app.models.job import Job
from backend.app.schemas.application_form import QuestionSchema

def generate_questions_from_job(job: Job) -> List[QuestionSchema]:
    questions: List[QuestionSchema] = []
    order = 1

    # Base Questions
    questions.append(QuestionSchema(
        id="q_full_name",
        label="Full Name",
        type="text",
        required=True,
        display_order=order,
        source_job_field="base",
        generation_rationale="Core applicant contact identification"
    ))
    order += 1

    questions.append(QuestionSchema(
        id="q_email",
        label="Email Address",
        type="email",
        required=True,
        display_order=order,
        source_job_field="base",
        generation_rationale="Primary communication channel"
    ))
    order += 1

    questions.append(QuestionSchema(
        id="q_phone",
        label="Phone Number",
        type="phone",
        required=True,
        display_order=order,
        source_job_field="base",
        generation_rationale="Contact number for interviews"
    ))
    order += 1

    questions.append(QuestionSchema(
        id="q_current_location",
        label="Current Location (City, State)",
        type="text",
        required=True,
        display_order=order,
        source_job_field="location",
        generation_rationale="Assess location proximity and relocation requirements"
    ))
    order += 1

    questions.append(QuestionSchema(
        id="q_resume",
        label="Resume / CV",
        type="file_upload",
        required=True,
        display_order=order,
        source_job_field="base",
        generation_rationale="Applicant background resume submission"
    ))
    order += 1

    # Experience question
    exp_label = "Total Work Experience (in Years)"
    exp_rationale = "General experience assessment"
    if job.min_experience is not None:
        exp_rationale = f"Role requires minimum {job.min_experience} years of experience"

    questions.append(QuestionSchema(
        id="q_total_experience",
        label=exp_label,
        type="number",
        required=not job.allow_freshers,
        validation={"min": 0},
        display_order=order,
        source_job_field="min_experience",
        generation_rationale=exp_rationale
    ))
    order += 1

    # Current CTC (Omitted if role is for freshers only or unpaid internship)
    if not job.allow_freshers and job.salary_type != "Unpaid Internship":
        questions.append(QuestionSchema(
            id="q_current_ctc",
            label="Current Salary / CTC (in INR)",
            type="number",
            required=False,
            display_order=order,
            source_job_field="salary_type",
            generation_rationale="Compensation history evaluation"
        ))
        order += 1

    # Expected Compensation
    if job.salary_type != "Unpaid Internship":
        questions.append(QuestionSchema(
            id="q_expected_ctc",
            label="Expected Salary / CTC (in INR)",
            type="number",
            required=False,
            display_order=order,
            source_job_field="salary_type",
            generation_rationale="Compensation alignment evaluation"
        ))
        order += 1

    # Notice Period
    notice_opts = ["Immediate", "15 Days", "30 Days", "60 Days", "90 Days"]
    if job.notice_periods and len(job.notice_periods) > 0:
        notice_opts = job.notice_periods

    questions.append(QuestionSchema(
        id="q_notice_period",
        label="Notice Period / Availability",
        type="select",
        required=True,
        options=notice_opts,
        display_order=order,
        source_job_field="notice_periods",
        generation_rationale="Evaluate joining availability against role urgency"
    ))
    order += 1

    # Qualification / Education
    if job.min_qualification:
        questions.append(QuestionSchema(
            id="q_highest_qualification",
            label="Highest Educational Qualification",
            type="select",
            required=True,
            options=["10th", "12th", "Diploma", "Bachelor's", "Master's", "PhD", "Other"],
            display_order=order,
            source_job_field="min_qualification",
            generation_rationale=f"Role specifies minimum qualification: {job.min_qualification}"
        ))
        order += 1

    # Required Skills Assessment
    required_skills = [s for s in (job.skills or []) if isinstance(s, dict) and s.get("category") == "required"]
    if required_skills:
        skill_names = [s["name"] for s in required_skills]
        questions.append(QuestionSchema(
            id="q_required_skills",
            label="Key Technical & Domain Proficiency",
            type="multiselect",
            required=True,
            options=skill_names,
            display_order=order,
            source_job_field="skills",
            generation_rationale=f"Self-assessment for required skills: {', '.join(skill_names[:3])}"
        ))
        order += 1

    # Specific Question derived from Key Responsibilities / Technical Requirements
    if job.tech_requirements and len(job.tech_requirements.strip()) > 0:
        questions.append(QuestionSchema(
            id="q_tech_experience_summary",
            label="Summary of Relevant Technical Projects & Stack Experience",
            type="textarea",
            required=False,
            display_order=order,
            source_job_field="tech_requirements",
            generation_rationale="Evaluate specific technical proficiency based on job technical requirements"
        ))
        order += 1

    return questions
