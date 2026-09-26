from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, model_validator

class SkillItem(BaseModel):
    name: str
    category: str # 'required' or 'preferred'
    position: int = 0

class JobBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    department: str
    job_type: str
    employment_type: Optional[str] = None
    work_mode: str
    openings: int = Field(1, ge=1)
    priority: str = "Normal"

    country: str = "India"
    state: Optional[str] = None
    city: Optional[str] = None
    office_location: Optional[str] = None
    pin_code: Optional[str] = None
    allow_relocation: bool = False

    min_experience: Optional[float] = None
    max_experience: Optional[float] = None
    allow_freshers: bool = False
    min_qualification: Optional[str] = None
    degree: Optional[str] = None
    specialization: Optional[str] = None

    salary_type: Optional[str] = None
    min_salary: Optional[float] = None
    max_salary: Optional[float] = None
    currency: str = "INR"
    show_salary: bool = True
    benefits: List[str] = Field(default_factory=list)

    skills: List[SkillItem] = Field(default_factory=list)
    description: str
    responsibilities: List[str] = Field(default_factory=list)

    required_qualifications: Optional[str] = None
    preferred_qualifications: Optional[str] = None
    tech_requirements: Optional[str] = None
    soft_skills: Optional[str] = None
    certifications: Optional[str] = None
    other_requirements: Optional[str] = None

    application_deadline: Optional[datetime] = None
    timezone: str = "Asia/Kolkata"
    notice_periods: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    inclusion_info: Optional[Dict[str, Any]] = Field(default_factory=dict)
    career_page_published: bool = False

    @field_validator("title")
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError("Job title cannot be blank")
        return v.strip()

    @field_validator("pin_code")
    def validate_pin_code(cls, v):
        if v and v.strip():
            clean_pin = v.strip()
            if not clean_pin.isdigit() or len(clean_pin) != 6:
                raise ValueError("PIN code must be a 6-digit number")
            return clean_pin
        return None

    @model_validator(mode="after")
    def validate_job_rules(self):
        # 1. Location rules: Office / Hybrid require state & city
        if self.work_mode in ["Work From Office", "Hybrid"]:
            if not self.state or not self.state.strip():
                raise ValueError(f"State is required for {self.work_mode} roles")
            if not self.city or not self.city.strip():
                raise ValueError(f"City is required for {self.work_mode} roles")

        # 2. Experience validation: max >= min, nonnegative
        if self.min_experience is not None and self.min_experience < 0:
            raise ValueError("Minimum experience cannot be negative")
        if self.max_experience is not None and self.max_experience < 0:
            raise ValueError("Maximum experience cannot be negative")
        if self.min_experience is not None and self.max_experience is not None:
            if self.max_experience < self.min_experience:
                raise ValueError("Maximum experience cannot be less than minimum experience")

        # 3. Allow Freshers vs min_experience conflict
        if self.allow_freshers and self.min_experience is not None and self.min_experience > 0:
            raise ValueError("Allow Freshers cannot coexist with a positive minimum experience requirement")

        # 4. Salary & Unpaid Internship
        if self.salary_type == "Unpaid Internship":
            if self.job_type != "Internship":
                raise ValueError("Unpaid Internship is valid only for Internship job type")
            self.min_salary = None
            self.max_salary = None
        else:
            if self.min_salary is not None and self.min_salary < 0:
                raise ValueError("Minimum salary cannot be negative")
            if self.max_salary is not None and self.max_salary < 0:
                raise ValueError("Maximum salary cannot be negative")
            if self.min_salary is not None and self.max_salary is not None:
                if self.max_salary < self.min_salary:
                    raise ValueError("Maximum salary cannot be less than minimum salary")

        # 5. Skills validation: deduplicate skills case-insensitively across required & preferred
        seen_skills = set()
        deduped_skills = []
        for s in self.skills:
            clean_name = s.name.strip().lower()
            if clean_name not in seen_skills:
                seen_skills.add(clean_name)
                deduped_skills.append(s)
        self.skills = deduped_skills

        return self

class JobCreate(JobBase):
    pass

class JobUpdate(JobBase):
    revision: int # Required for optimistic concurrency check

class JobStatusUpdate(BaseModel):
    status: str # Draft, Open, Paused, Closed, Expired

class JobResponse(JobBase):
    id: str
    organization_id: str
    job_code: str
    status: str
    revision: int
    created_by_id: str
    updated_by_id: str
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class JobListResponse(BaseModel):
    items: List[JobResponse]
    total: int
    page: int
    size: int
    pages: int
