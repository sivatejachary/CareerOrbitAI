/**
 * Candidates V3 API client — candidate-centered pipeline using (candidateId, jobId) identity.
 */

export interface CandidateJobSummary {
  id: string;
  candidate_id: string;
  job_id: string;
  resume_id?: string | null;
  job_title: string | null;
  organization_id: string;
  source: string;
  stage: string;
  extraction_status: string;
  screening_status: string;
  recommendation: string | null;
  screening_score: number | null;
  received_at: string | null;
  screening_completed_at: string | null;
}

export interface CandidateJobDetail extends CandidateJobSummary {
  extracted_profile: Record<string, unknown> | null;
  extraction_model: string | null;
  extraction_error: string | null;
  extraction_completed_at: string | null;
  screening_rationale: string | null;
  screening_criterion_results: ScreeningCriterion[] | null;
  screening_model: string | null;
  screening_error: string | null;
  workflow_execution_id: string | null;
  updated_at: string | null;
}

export interface ScreeningCriterion {
  criterion: string;
  passed: boolean;
  score: number;
  max_score: number;
  details: string;
}

export interface TimelineEvent {
  timestamp: string;
  event_type: string;
  title: string;
  description: string | null;
  data: Record<string, unknown> | null;
}

export interface CallTurn {
  speaker: string;
  text: string;
  timestamp_secs: number;
}

export interface CallData {
  call_attempt_id: string;
  attempt_number: number;
  operation_state: string;
  disposition: string | null;
  duration_seconds: number | null;
  initiated_at: string | null;
  ended_at: string | null;
  transcript: {
    full_text: string | null;
    turns: CallTurn[];
  } | null;
  evaluation: {
    recommendation: string;
    rationale: string;
    extracted_facts: Array<{ key: string; value: string }>;
    candidate_statements: Record<string, unknown>;
  } | null;
}

export interface TranscriptResponse {
  candidate_id: string;
  job_id: string;
  calls: CallData[];
}

export interface JobCandidateEntry {
  candidate_job_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string | null;
  candidate_phone: string | null;
  stage: string;
  recommendation: string | null;
  screening_score: number | null;
  extraction_status: string;
  screening_status: string;
  source: string;
  received_at: string | null;
}

export interface JobCandidatesResponse {
  job_id: string;
  total: number;
  candidates: JobCandidateEntry[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

const BASE = '/api/v3';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API ${res.status}: ${error}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCandidateJobs(candidateId: string): Promise<CandidateJobSummary[]> {
  return apiFetch<CandidateJobSummary[]>(`/candidates/${candidateId}/jobs`);
}

export async function fetchCandidateJobDetail(
  candidateId: string,
  jobId: string
): Promise<CandidateJobDetail> {
  return apiFetch<CandidateJobDetail>(`/candidates/${candidateId}/jobs/${jobId}`);
}

export async function fetchCandidateJobTimeline(
  candidateId: string,
  jobId: string
): Promise<TimelineEvent[]> {
  return apiFetch<TimelineEvent[]>(`/candidates/${candidateId}/jobs/${jobId}/timeline`);
}

export async function fetchCandidateCallTranscript(
  candidateId: string,
  jobId: string
): Promise<TranscriptResponse> {
  return apiFetch<TranscriptResponse>(`/candidates/${candidateId}/jobs/${jobId}/transcript`);
}

export async function triggerExtraction(
  candidateId: string,
  jobId: string
): Promise<{ extraction_status: string; extracted_profile: unknown; error: string | null }> {
  return apiFetch(`/candidates/${candidateId}/jobs/${jobId}/extract`, { method: 'POST' });
}

export async function triggerScreening(
  candidateId: string,
  jobId: string
): Promise<{
  screening_status: string;
  recommendation: string;
  screening_score: number;
  error: string | null;
}> {
  return apiFetch(`/candidates/${candidateId}/jobs/${jobId}/screen`, { method: 'POST' });
}

export async function fetchResumeDownloadLink(
  candidateId: string,
  jobId: string
): Promise<{ resume_id: string; download_url: string; expires_in_seconds: number }> {
  return apiFetch(`/candidates/${candidateId}/jobs/${jobId}/resume/link`);
}

export async function fetchJobCandidates(
  jobId: string,
  stage?: string,
  recommendation?: string
): Promise<JobCandidatesResponse> {
  const params = new URLSearchParams();
  if (stage) params.set('stage', stage);
  if (recommendation) params.set('recommendation', recommendation);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<JobCandidatesResponse>(`/jobs/${jobId}/candidates${qs}`);
}
