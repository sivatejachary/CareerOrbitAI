import { Candidate, JobApplicationItem, JobApplicationDetail, ScreeningRun, HRDecision, HRNote } from '../types/candidate';

const API_BASE = '/api';

export async function fetchCandidates(params?: {
  search?: string;
  skill?: string;
  min_experience?: number;
  page?: number;
  page_size?: number;
}): Promise<{ items: Candidate[]; total: number; page: number; total_pages: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.skill) query.append('skill', params.skill);
  if (params?.min_experience !== undefined) query.append('min_experience', params.min_experience.toString());
  if (params?.page) query.append('page', params.page.toString());
  if (params?.page_size) query.append('page_size', params.page_size.toString());

  const res = await fetch(`${API_BASE}/candidates?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch candidates');
  return res.json();
}

export async function fetchCandidateDetail(candidateId: string): Promise<Candidate & { resumes: any[]; applications: any[] }> {
  const res = await fetch(`${API_BASE}/candidates/${candidateId}`);
  if (!res.ok) throw new Error('Failed to fetch candidate details');
  return res.json();
}

export async function fetchApplications(params?: {
  job_id?: string;
  status?: string;
  source?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: JobApplicationItem[]; total: number; page: number; total_pages: number }> {
  const query = new URLSearchParams();
  if (params?.job_id) query.append('job_id', params.job_id);
  if (params?.status) query.append('status', params.status);
  if (params?.source) query.append('source', params.source);
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', params.page.toString());
  if (params?.page_size) query.append('page_size', params.page_size.toString());

  const res = await fetch(`${API_BASE}/applications?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch applications');
  return res.json();
}

export async function fetchApplicationDetail(applicationId: string): Promise<JobApplicationDetail> {
  const res = await fetch(`${API_BASE}/applications/${applicationId}`);
  if (!res.ok) throw new Error('Failed to fetch application detail');
  return res.json();
}

export async function triggerScreening(applicationId: string): Promise<ScreeningRun> {
  const res = await fetch(`${API_BASE}/applications/${applicationId}/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to trigger screening');
  return res.json();
}

export async function submitHRDecision(
  applicationId: string,
  decision: 'Shortlisted' | 'UnderReview' | 'Rejected',
  reason?: string
): Promise<HRDecision> {
  const res = await fetch(`${API_BASE}/applications/${applicationId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, reason }),
  });
  if (!res.ok) throw new Error('Failed to submit HR decision');
  return res.json();
}

export async function addHRNote(applicationId: string, content: string): Promise<HRNote> {
  const res = await fetch(`${API_BASE}/applications/${applicationId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to add HR note');
  return res.json();
}

export async function fetchPublicJob(jobCode: string): Promise<any> {
  const res = await fetch(`${API_BASE}/public/jobs/${jobCode}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Job not found');
  }
  return res.json();
}

export async function submitPublicApplication(jobCode: string, formData: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/public/jobs/${jobCode}/apply`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit application');
  }
  return res.json();
}
