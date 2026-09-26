/**
 * Communication & Scheduling API Client.
 */

export interface CommunicationPreviewRequest {
  node_config: Record<string, any>;
  candidate_id?: string | null;
  job_id?: string | null;
  sample_context?: Record<string, any> | null;
}

export interface CommunicationPreviewResponse {
  purpose: string;
  why_call_happens: string;
  facts_used: string[];
  what_agent_will_say: string;
  opening_statement: string;
  questions_to_ask: any[];
  actions_permitted: string[];
  forbidden_disclosures: string[];
  what_completes_step: string;
  unanswered_fallback: string;
  prerequisites: {
    required_approval?: boolean;
    source_stage_id?: string | null;
    target_stage_id?: string | null;
  };
  is_blocked: boolean;
  block_reason: string | null;
}

export interface CompanyCommunicationSettings {
  id: string;
  organization_id: string;
  company_intro: string;
  tone: string;
  supported_languages: string[];
  calling_hours_start: string;
  calling_hours_end: string;
  timezone: string;
  max_retry_attempts: number;
  min_hours_between_calls: number;
  contact_policy: Record<string, any>;
  allowed_agent_actions: string[];
  default_templates: Record<string, any>;
}

export interface InterviewSlot {
  id: string;
  organization_id: string;
  job_id: string | null;
  stage_id: string | null;
  interviewer_name: string;
  interviewer_email: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  format: string;
  meeting_link: string | null;
  timezone: string;
  is_booked: boolean;
  booked_candidate_id: string | null;
  booking_reference: string | null;
}

export interface CommunicationPlan {
  id: string;
  organization_id: string;
  candidate_id: string;
  job_id: string;
  workflow_execution_id: string;
  node_execution_id: string;
  purpose: string;
  source_stage_name: string | null;
  target_stage_name: string | null;
  required_approval: boolean;
  approved_result: string | null;
  facts_to_mention: string[];
  allowed_actions: string[];
  forbidden_disclosures: string[];
  rendered_opening: string | null;
  rendered_message: string | null;
  status: string;
  block_reason: string | null;
  is_dry_run: boolean;
  created_at: string;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const communicationApi = {
  getCompanySettings: async (): Promise<CompanyCommunicationSettings> => {
    const res = await fetch('/api/communication/settings', {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch communication settings');
    return res.json();
  },

  updateCompanySettings: async (settings: Partial<CompanyCommunicationSettings>): Promise<CompanyCommunicationSettings> => {
    const res = await fetch('/api/communication/settings', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to update communication settings');
    return res.json();
  },

  previewCommunication: async (req: CommunicationPreviewRequest): Promise<CommunicationPreviewResponse> => {
    const res = await fetch('/api/communication/preview', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(req)
    });
    if (!res.ok) throw new Error('Failed to render communication preview');
    return res.json();
  },

  listCommunicationPlans: async (candidateId?: string, jobId?: string): Promise<CommunicationPlan[]> => {
    const params = new URLSearchParams();
    if (candidateId) params.append('candidate_id', candidateId);
    if (jobId) params.append('job_id', jobId);
    const res = await fetch(`/api/communication/plans?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to list communication plans');
    return res.json();
  },

  listAvailableSlots: async (jobId?: string, stageId?: string): Promise<InterviewSlot[]> => {
    const params = new URLSearchParams();
    if (jobId) params.append('job_id', jobId);
    if (stageId) params.append('stage_id', stageId);
    const res = await fetch(`/api/scheduling/slots?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch interview slots');
    return res.json();
  },

  dryRunWorkflowStep: async (executionId: string): Promise<any> => {
    const res = await fetch(`/api/workflows/executions/${executionId}/dry-run-step`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to execute dry run step');
    return res.json();
  }
};
