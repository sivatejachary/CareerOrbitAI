export type JobStatus = 'Draft' | 'Open' | 'Paused' | 'Closed' | 'Expired';

export interface SkillItem {
  name: string;
  category: 'required' | 'preferred';
  position: number;
}

export interface Job {
  id: string;
  organization_id: string;
  job_code: string;
  title: string;
  department: string;
  job_type: string;
  employment_type?: string;
  work_mode: string;
  openings: number;
  priority: 'Normal' | 'Urgent';

  country: string;
  state?: string;
  city?: string;
  office_location?: string;
  pin_code?: string;
  allow_relocation: boolean;

  min_experience?: number;
  max_experience?: number;
  allow_freshers: boolean;
  min_qualification?: string;
  degree?: string;
  specialization?: string;

  salary_type?: string;
  min_salary?: number;
  max_salary?: number;
  currency: string;
  show_salary: boolean;
  benefits: string[];

  skills: SkillItem[];
  description: string;
  responsibilities: string[];

  required_qualifications?: string;
  preferred_qualifications?: string;
  tech_requirements?: string;
  soft_skills?: string;
  certifications?: string;
  other_requirements?: string;

  application_deadline?: string;
  timezone: string;
  notice_periods: string[];
  languages: string[];
  inclusion_info?: Record<string, any>;

  status: JobStatus;
  revision: number;
  created_by_id: string;
  updated_by_id: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export interface JobListResponse {
  items: Job[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface QuestionSchema {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  validation?: Record<string, any>;
  display_order: number;
  source_job_field?: string;
  generation_rationale?: string;
}

export interface ApplicationForm {
  id: string;
  job_id: string;
  organization_id: string;
  google_connection_id?: string;
  form_version: number;
  source_job_revision: number;
  title: string;
  description?: string;
  questions_schema: QuestionSchema[];
  provider: 'Native' | 'GoogleForms' | 'MicrosoftForms';
  provider_form_id?: string;
  respondent_url?: string;
  editor_url?: string;
  creation_status: string;
  publication_state: string;
  public_token?: string;
  token_generated_at?: string;
  allow_public_submissions?: boolean;
  is_primary_website_form?: boolean;
  resume_collection_mode?: string;
  resume_setup_status?: string;
  google_resume_question_id?: string;
  last_verified_at?: string;
  sync_status?: string;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionPreviewResponse {
  job_id: string;
  job_revision: number;
  suggested_title: string;
  questions: QuestionSchema[];
}

export interface CandidateApplication {
  id: string;
  job_id: string;
  organization_id: string;
  application_form_id?: string;
  full_name: string;
  email: string;
  phone?: string;
  current_location?: string;
  total_experience?: number;
  current_ctc?: string;
  expected_ctc?: string;
  notice_period?: string;
  resume_url?: string;
  source_channel: string;
  status: string;
  answers_payload: Record<string, any>;
  created_at: string;
}
