import { Job, JobListResponse, ApplicationForm, QuestionPreviewResponse, QuestionSchema, CandidateApplication } from '../types/job';

const API_BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! Status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const jobsApi = {
  listJobs: (params: { search?: string; status?: string; page?: number; size?: number }) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status && params.status !== 'All') query.append('status', params.status);
    if (params.page) query.append('page', params.page.toString());
    if (params.size) query.append('size', params.size.toString());

    return request<JobListResponse>(`/jobs?${query.toString()}`);
  },

  getJob: (jobId: string) => {
    return request<Job>(`/jobs/${jobId}`);
  },

  createJob: (jobData: Partial<Job>) => {
    return request<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  },

  updateJob: (jobId: string, jobData: Partial<Job> & { revision: number }) => {
    return request<Job>(`/jobs/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify(jobData),
    });
  },

  updateJobStatus: (jobId: string, status: string) => {
    return request<Job>(`/jobs/${jobId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  archiveJob: (jobId: string) => {
    return request<void>(`/jobs/${jobId}`, {
      method: 'DELETE',
    });
  },

  previewFormQuestions: (jobId: string) => {
    return request<QuestionPreviewResponse>(`/jobs/${jobId}/application-forms/preview`, {
      method: 'POST',
    });
  },

  createApplicationForm: (jobId: string, formData: {
    title: string;
    description?: string;
    questions: QuestionSchema[];
    provider: 'Native' | 'GoogleForms' | 'MicrosoftForms';
    respondent_url?: string;
    editor_url?: string;
    publication_state?: string;
  }) => {
    return request<ApplicationForm>(`/jobs/${jobId}/application-forms`, {
      method: 'POST',
      body: JSON.stringify(formData),
    });
  },

  listApplicationForms: (jobId: string) => {
    return request<ApplicationForm[]>(`/jobs/${jobId}/application-forms`);
  },

  publishApplicationForm: (jobId: string, formId: string) => {
    return request<ApplicationForm>(`/jobs/${jobId}/application-forms/${formId}/publish`, {
      method: 'POST',
    });
  },

  listJobCandidates: (jobId: string) => {
    return request<CandidateApplication[]>(`/jobs/${jobId}/candidates`);
  },

  simulateCandidateSubmission: (jobId: string) => {
    return request<CandidateApplication>(`/jobs/${jobId}/candidates/simulate`, {
      method: 'POST',
    });
  },

  // Google OAuth & Forms Integration Methods
  getGoogleAuthUrl: () => {
    return request<{ configured: boolean; auth_url: string }>('/integrations/google/connect');
  },

  getGoogleConnectionStatus: () => {
    return request<{
      configured: boolean;
      connected: boolean;
      connection_id?: string;
      display_email?: string;
      google_account_id?: string;
      status?: string;
      message?: string;
    }>('/integrations/google/status');
  },

  disconnectGoogleAccount: (connectionId: string) => {
    return request<{ message: string }>(`/integrations/google/${connectionId}`, {
      method: 'DELETE',
    });
  },

  createRealGoogleForm: (jobId: string, connectionId?: string) => {
    const url = connectionId
      ? `/jobs/${jobId}/application-forms/google?connection_id=${connectionId}`
      : `/jobs/${jobId}/application-forms/google`;
    return request<ApplicationForm>(url, {
      method: 'POST',
    });
  },

  verifyFormSetup: (formId: string) => {
    return request<{ id: string; publication_state: string; last_verified_at: string; message: string }>(
      `/application-forms/${formId}/verify`,
      { method: 'POST' }
    );
  },

  publishForm: (formId: string) => {
    return request<{ id: string; publication_state: string; message: string }>(
      `/application-forms/${formId}/publish`,
      { method: 'POST' }
    );
  },

  syncFormResponses: (formId: string) => {
    return request<{ status: string; imported_count: number; new_count: number; error?: string }>(
      `/application-forms/${formId}/sync`,
      { method: 'POST' }
    );
  },

  getFormSourceResponses: (formId: string) => {
    return request<{
      items: Array<{
        id: string;
        provider_response_id: string;
        original_submitted_at: string;
        latest_submitted_at: string;
        processing_status: string;
        job_application_id?: string;
        error_details?: string;
        raw_payload: any;
      }>;
      total: number;
      sync_status: string;
      last_sync_at?: string;
    }>(`/application-forms/${formId}/responses`);
  },

  verifyGoogleResumeSetup: (formId: string) => {
    return request<{
      verified: boolean;
      resume_setup_status: string;
      google_resume_question_id?: string;
      publication_state: string;
      can_publish: boolean;
      editor_url?: string;
      instructions?: string[];
      last_verified_at?: string;
      message: string;
    }>(`/application-forms/${formId}/verify-resume-setup`, {
      method: 'POST',
    });
  },

  updateFormState: (jobId: string, formId: string, state: string) => {
    return request<ApplicationForm>(`/jobs/${jobId}/application-forms/${formId}/state`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    });
  },

  regenerateFormToken: (jobId: string, formId: string) => {
    return request<ApplicationForm>(`/jobs/${jobId}/application-forms/${formId}/regenerate-token`, {
      method: 'POST',
    });
  },

  toggleFormSubmissions: (jobId: string, formId: string) => {
    return request<ApplicationForm>(`/jobs/${jobId}/application-forms/${formId}/toggle-submissions`, {
      method: 'POST',
    });
  },

  getPublicApplicationForm: (jobCode: string, token: string) => {
    return request<{
      job: Job;
      form: {
        id: string;
        title: string;
        description?: string;
        publication_state: string;
        allow_public_submissions: boolean;
        questions: QuestionSchema[];
        is_open_for_submissions: boolean;
        state_message?: string;
      };
    }>(`/public/application-forms/${jobCode}/${token}`);
  },

  submitPublicApplicationForm: (jobCode: string, token: string, formData: FormData) => {
    return request<{
      success: boolean;
      application_id: string;
      candidate_id: string;
      status: string;
      job_title: string;
      job_code: string;
      submitted_at: string;
      message: string;
    }>(`/public/application-forms/${jobCode}/${token}/submit`, {
      method: 'POST',
      body: formData,
    });
  }
};
