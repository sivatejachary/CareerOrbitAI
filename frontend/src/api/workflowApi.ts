import {
  WorkflowSummary,
  WorkflowVersionDetail,
  WorkflowExecutionItem,
  WorkflowGraph,
  WorkflowValidationResult
} from '../types/workflow';

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

export const workflowApi = {
  listWorkflows: async (): Promise<WorkflowSummary[]> => {
    const res = await fetch(`${API_BASE}/workflows`);
    return handleResponse<WorkflowSummary[]>(res);
  },

  getWorkflow: async (workflowId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/workflows/${workflowId}`);
    return handleResponse<any>(res);
  },

  createWorkflow: async (data: { name: string; description?: string; is_company_default?: boolean }): Promise<WorkflowSummary> => {
    const res = await fetch(`${API_BASE}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<WorkflowSummary>(res);
  },

  updateWorkflow: async (workflowId: string, data: { name?: string; description?: string; is_company_default?: boolean; status?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<any>(res);
  },

  getWorkflowVersion: async (workflowId: string, versionId: string): Promise<WorkflowVersionDetail> => {
    const res = await fetch(`${API_BASE}/workflows/${workflowId}/versions/${versionId}`);
    return handleResponse<WorkflowVersionDetail>(res);
  },

  saveWorkflowDraft: async (workflowId: string, versionId: string, graphData: WorkflowGraph): Promise<WorkflowVersionDetail> => {
    const res = await fetch(`${API_BASE}/workflows/${workflowId}/versions/${versionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph_data: graphData })
    });
    return handleResponse<WorkflowVersionDetail>(res);
  },

  validateWorkflowGraph: async (workflowId: string, versionId: string, graphData: WorkflowGraph): Promise<WorkflowValidationResult> => {
    const res = await fetch(`${API_BASE}/workflows/${workflowId}/versions/${versionId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph_data: graphData })
    });
    return handleResponse<WorkflowValidationResult>(res);
  },

  publishWorkflowVersion: async (workflowId: string, versionId: string): Promise<{ id: string; version_number: number; publication_state: string; published_at: string; definition_checksum: string }> => {
    const res = await fetch(`${API_BASE}/workflows/${workflowId}/versions/${versionId}/publish`, {
      method: 'POST'
    });
    return handleResponse<any>(res);
  },

  listExecutions: async (params?: { job_id?: string; status_filter?: string; page?: number; size?: number }): Promise<{ items: WorkflowExecutionItem[]; total: number; page: number; size: number }> => {
    const query = new URLSearchParams();
    if (params?.job_id) query.append('job_id', params.job_id);
    if (params?.status_filter) query.append('status_filter', params.status_filter);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.size) query.append('size', params.size.toString());

    const res = await fetch(`${API_BASE}/workflows/executions/list?${query.toString()}`);
    return handleResponse<any>(res);
  },

  getExecutionDetail: async (executionId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/workflows/executions/${executionId}`);
    return handleResponse<any>(res);
  },

  pauseExecution: async (executionId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/workflows/executions/${executionId}/pause`, { method: 'POST' });
    return handleResponse<any>(res);
  },

  resumeExecution: async (executionId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/workflows/executions/${executionId}/resume`, { method: 'POST' });
    return handleResponse<any>(res);
  },

  cancelExecution: async (executionId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/workflows/executions/${executionId}/cancel`, { method: 'POST' });
    return handleResponse<any>(res);
  },

  completeHumanTask: async (taskId: string, outcome: string, outcomeData?: Record<string, any>): Promise<any> => {
    const res = await fetch(`${API_BASE}/workflows/human-tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, outcome_data: outcomeData || {} })
    });
    return handleResponse<any>(res);
  }
};
