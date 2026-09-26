export interface Candidate {
  id: string;
  candidate_code: string;
  full_name: string;
  email: string;
  phone?: string | null;
  current_location?: string | null;
  total_experience?: number | null;
  skills: string[];
  current_company?: string | null;
  notice_period?: string | null;
  first_source?: string | null;
  total_applications?: number;
  latest_application_status?: string | null;
  created_at: string;
}

export interface Resume {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  processing_status: string;
  extracted_text?: string | null;
  extracted_text_preview?: string | null;
  parsed_data?: {
    skills?: string[];
    detected_experience_years?: number | null;
  } | null;
  created_at: string;
}

export interface CriterionResult {
  criterion: string;
  passed: boolean;
  score: number;
  max_score: number;
  details: string;
}

export interface ScreeningRun {
  id: string;
  engine_version: string;
  status: string;
  recommendation: 'SHORTLIST' | 'REVIEW' | 'NOT_MATCHED';
  rationale: string;
  criterion_results: CriterionResult[];
  created_at: string;
}

export interface HRDecision {
  id: string;
  decision: 'Shortlisted' | 'UnderReview' | 'Rejected';
  reason?: string | null;
  decided_by: string;
  created_at: string;
}

export interface HRNote {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface JobApplicationItem {
  id: string;
  candidate_id: string;
  candidate_code: string;
  candidate_name: string;
  candidate_email: string;
  job_id: string;
  job_title: string;
  job_code: string;
  source: string;
  status: 'Submitted' | 'UnderReview' | 'Shortlisted' | 'Rejected' | 'Withdrawn';
  received_at: string;
  screening_recommendation?: 'SHORTLIST' | 'REVIEW' | 'NOT_MATCHED' | null;
  screening_score?: number | null;
}

export interface JobApplicationDetail {
  id: string;
  candidate: Candidate;
  job?: {
    id: string;
    title: string;
    job_code: string;
    department: string;
  } | null;
  source: string;
  status: string;
  answers_payload: Record<string, any>;
  profile_snapshot: Record<string, any>;
  received_at: string;
  resume?: Resume | null;
  screening_runs: ScreeningRun[];
  hr_decisions: HRDecision[];
  notes: HRNote[];
}
