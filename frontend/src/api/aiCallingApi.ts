import {
  CallAttemptItem,
  CallAttemptDetail,
  ElevenLabsReadiness,
  JobEligibilityResponse,
  AICallBatch,
  StartBatchRequest
} from '../types/aiCalling';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = `HTTP error! Status: ${res.status}`;
    try {
      const data = await res.json();
      if (data.detail) {
        errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // Ignore
    }
    throw new Error(errorMessage);
  }
  return res.json();
}

export const aiCallingApi = {
  checkReadiness: async (): Promise<ElevenLabsReadiness> => {
    const res = await fetch(`${API_BASE}/ai-calling/readiness`);
    return handleResponse<ElevenLabsReadiness>(res);
  },

  listAttempts: async (params?: {
    job_id?: string;
    candidate_id?: string;
    status_filter?: string;
    batch_id?: string;
    page?: number;
    size?: number;
  }): Promise<{ items: CallAttemptItem[]; total: number; page: number; size: number }> => {
    const query = new URLSearchParams();
    if (params?.job_id) query.append('job_id', params.job_id);
    if (params?.candidate_id) query.append('candidate_id', params.candidate_id);
    if (params?.status_filter) query.append('status_filter', params.status_filter);
    if (params?.batch_id) query.append('batch_id', params.batch_id);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.size) query.append('size', params.size.toString());

    const res = await fetch(`${API_BASE}/ai-calling/attempts?${query.toString()}`);
    return handleResponse<any>(res);
  },

  getAttemptDetail: async (attemptId: string): Promise<CallAttemptDetail> => {
    const res = await fetch(`${API_BASE}/ai-calling/attempts/${attemptId}`);
    return handleResponse<CallAttemptDetail>(res);
  },

  initiateCall: async (data: {
    candidate_id: string;
    job_id: string;
    phone_number: string;
    custom_first_message?: string;
  }): Promise<any> => {
    const res = await fetch(`${API_BASE}/ai-calling/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<any>(res);
  },

  updateStopContact: async (data: {
    candidate_id: string;
    phone_number: string;
    stop_contact?: boolean;
    do_not_call?: boolean;
    reason?: string;
  }): Promise<any> => {
    const res = await fetch(`${API_BASE}/ai-calling/stop-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<any>(res);
  },

  // Batch Calling APIs
  getEligibleCandidates: async (jobId: string, maxAttempts: number = 2): Promise<JobEligibilityResponse> => {
    const res = await fetch(`${API_BASE}/ai-calling/eligible-candidates/${jobId}?max_attempts=${maxAttempts}`);
    return handleResponse<JobEligibilityResponse>(res);
  },

  startBatch: async (data: StartBatchRequest): Promise<AICallBatch> => {
    const res = await fetch(`${API_BASE}/ai-calling/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<AICallBatch>(res);
  },

  listBatches: async (params?: {
    job_id?: string;
    page?: number;
    size?: number;
  }): Promise<{ items: AICallBatch[]; total: number; page: number; size: number }> => {
    const query = new URLSearchParams();
    if (params?.job_id) query.append('job_id', params.job_id);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.size) query.append('size', params.size.toString());

    const res = await fetch(`${API_BASE}/ai-calling/batches?${query.toString()}`);
    return handleResponse<any>(res);
  },

  getBatch: async (batchId: string): Promise<AICallBatch> => {
    const res = await fetch(`${API_BASE}/ai-calling/batches/${batchId}`);
    return handleResponse<AICallBatch>(res);
  },

  pauseBatch: async (batchId: string): Promise<AICallBatch> => {
    const res = await fetch(`${API_BASE}/ai-calling/batches/${batchId}/pause`, {
      method: 'POST'
    });
    return handleResponse<AICallBatch>(res);
  },

  resumeBatch: async (batchId: string): Promise<AICallBatch> => {
    const res = await fetch(`${API_BASE}/ai-calling/batches/${batchId}/resume`, {
      method: 'POST'
    });
    return handleResponse<AICallBatch>(res);
  },

  cancelBatch: async (batchId: string): Promise<AICallBatch> => {
    const res = await fetch(`${API_BASE}/ai-calling/batches/${batchId}/cancel`, {
      method: 'POST'
    });
    return handleResponse<AICallBatch>(res);
  },

  listBatchCalls: async (batchId: string, params?: { page?: number; size?: number }): Promise<{ items: any[]; total: number; page: number; size: number }> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.size) query.append('size', params.size.toString());

    const res = await fetch(`${API_BASE}/ai-calling/batches/${batchId}/calls?${query.toString()}`);
    return handleResponse<any>(res);
  },

  getCandidateCalls: async (candidateId: string, jobId?: string): Promise<{ items: any[]; total: number }> => {
    const query = new URLSearchParams();
    if (jobId) query.append('job_id', jobId);

    const res = await fetch(`${API_BASE}/ai-calling/candidates/${candidateId}?${query.toString()}`);
    return handleResponse<any>(res);
  }
};

