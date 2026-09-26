export interface TranscriptTurn {
  speaker: 'agent' | 'user' | string;
  text: string;
  timestamp_secs: number;
  duration_secs: number;
}

export interface ExtractedFact {
  key: string;
  value: string;
  unit?: string;
  transcript_turn?: number;
  excerpt?: string;
  confidence?: number;
}

export interface CandidateStatements {
  interest?: string;
  notice_period?: string;
  ctc_expectation?: string;
  current_ctc?: string;
  availability?: string;
  stop_contact_requested?: boolean;
}

export interface CallEvaluationDetail {
  candidate_statements: CandidateStatements;
  extracted_facts: ExtractedFact[];
  question_coverage: Record<string, string>;
  recommendation?: 'SHORTLIST' | 'REVIEW' | 'NOT_MATCHED';
  rationale?: string;
  human_override?: Record<string, any>;
}

export interface CallAttemptItem {
  id: string;
  workflow_execution_id?: string;
  candidate_id: string;
  candidate_name?: string;
  job_id: string;
  job_title?: string;
  phone_number: string;
  attempt_number: number;
  operation_state: 'Scheduled' | 'Initiating' | 'Accepted' | 'InitiationUnknown' | 'Failed' | 'Canceled';
  connection_state: 'Unknown' | 'Ringing' | 'Connected' | 'Ended';
  disposition?: 'NoAnswer' | 'Busy' | 'Voicemail' | 'WrongNumber' | 'ConversationCompleted' | 'CandidateEnded' | 'TechnicalFailure';
  processing_state: 'AwaitingTranscript' | 'Processing' | 'Ready' | 'NeedsReview' | 'Failed';
  provider: string;
  provider_call_id?: string;
  duration_seconds?: number;
  has_transcript: boolean;
  has_evaluation: boolean;
  recommendation?: string;
  scheduled_at?: string;
  initiated_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface CallAttemptDetail {
  id: string;
  workflow_execution_id?: string;
  candidate?: { id: string; full_name: string; email: string; phone: string };
  job?: { id: string; title: string; job_code: string };
  phone_number: string;
  attempt_number: number;
  operation_state: string;
  connection_state: string;
  disposition?: string;
  processing_state: string;
  provider: string;
  provider_call_id?: string;
  duration_seconds?: number;
  cost_cents?: number;
  error_details?: string;
  transcript?: { full_text: string; turns: TranscriptTurn[] };
  evaluation?: CallEvaluationDetail;
  scheduled_at?: string;
  initiated_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface ElevenLabsReadiness {
  ready: boolean;
  status: string;
  message?: string;
  has_phone_number?: boolean;
  agent_id?: string;
}

export interface EligibleCandidateItem {
  candidate_id: string;
  candidate_name: string;
  phone: string | null;
  recommendation: string | null;
  screening_score: number | null;
  stage: string;
  total_attempts: number;
  reason: string;
}

export interface JobEligibilityResponse {
  job_id: string;
  job_title: string | null;
  total_applications: number;
  shortlisted_count: number;
  eligible_count: number;
  ineligible_count: number;
  eligible_candidates: EligibleCandidateItem[];
  ineligible_candidates: EligibleCandidateItem[];
}

export interface AICallBatch {
  id: string;
  job_id: string;
  job_title?: string | null;
  workflow_id?: string | null;
  status: 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' | 'CANCELLED';
  total_candidates: number;
  initiated_count: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  max_concurrent_calls: number;
  call_delay_seconds: number;
  max_attempts_per_candidate: number;
  notes?: string | null;
  started_at?: string | null;
  paused_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StartBatchRequest {
  job_id: string;
  workflow_id?: string;
  workflow_version_id?: string;
  max_concurrent_calls?: number;
  call_delay_seconds?: number;
  max_attempts_per_candidate?: number;
}

