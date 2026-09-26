export type WorkflowNodeType =
  | 'APPLICATION_RECEIVED'
  | 'AI_RESUME_SCREENING'
  | 'HR_REVIEW'
  | 'INTERVIEW'
  | 'ASSESSMENT'
  | 'AI_CALLING'
  | 'SCHEDULE_INTERVIEW'
  | 'CANDIDATE_AVAILABILITY'
  | 'SEND_MESSAGE'
  | 'WAIT_DELAY'
  | 'CONDITION'
  | 'MANUAL_TASK'
  | 'HR_FINAL_DECISION'
  | 'END';

export interface ConditionRuleItem {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'contains' | 'is_present' | 'is_missing';
  value: any;
}

export interface ConditionBranchItem {
  id: string;
  name: string; // e.g. "Meets shortlist policy", "Needs recruiter review", "Otherwise"
  is_default: boolean; // true for Otherwise fallback
  condition_logic: 'AND' | 'OR';
  rules: ConditionRuleItem[];
  missing_data_action: 'PAUSE_FOR_RECRUITER' | 'ROUTE_OTHERWISE' | 'END_PATH';
  rejoin_type: 'REJOIN_MAIN' | 'END_PATH';
  sub_steps: WorkflowStepItem[];
}

export interface WorkflowStepItem {
  id: string;
  type: WorkflowNodeType;
  title: string;
  purpose: string;
  description?: string;
  config: Record<string, any>;
  branches?: ConditionBranchItem[]; // when type === 'CONDITION'
}

export type SaveStatus = 'SAVED' | 'SAVING' | 'SAVE_FAILED' | 'OFFLINE';

export interface StepValidationIssue {
  stepId: string;
  stepTitle: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface WorkflowNodeData {
  id: string;
  type: WorkflowNodeType;
  title: string;
  description?: string;
  position: { x: number; y: number };
  config: Record<string, any>;
}

export interface WorkflowEdgeData {
  id: string;
  source: string;
  target: string;
  source_handle?: string;
  target_handle?: string;
  label?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNodeData[];
  edges: WorkflowEdgeData[];
}

export interface WorkflowSummary {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_company_default: boolean;
  status: string;
  job_usage_count: number;
  latest_version_number: number;
  published_version_number?: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowVersionDetail {
  id: string;
  workflow_id: string;
  version_number: number;
  publication_state: 'Draft' | 'Published' | 'Archived';
  definition_checksum?: string;
  graph_data: WorkflowGraph;
  validation_errors: string[];
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecutionItem {
  id: string;
  workflow_id: string;
  workflow_name: string;
  workflow_version_number: number;
  job_application_id: string;
  job_id: string;
  job_title: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  status: 'Pending' | 'Running' | 'WaitingForEvent' | 'WaitingForHuman' | 'WaitingUntilTime' | 'Succeeded' | 'Blocked' | 'Failed' | 'Canceled' | 'Paused';
  current_node_id?: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  created_at: string;
}

export interface NodeExecutionDetail {
  id: string;
  node_id: string;
  node_type: WorkflowNodeType;
  status: string;
  attempt_number: number;
  selected_outcome?: string;
  output_snapshot?: Record<string, any>;
  error_details?: string;
  started_at?: string;
  completed_at?: string;
}

export interface HumanTaskDetail {
  id: string;
  task_type: string;
  title: string;
  instructions?: string;
  status: 'Pending' | 'Completed' | 'Canceled';
  outcome?: string;
  due_date?: string;
  created_at: string;
  completed_at?: string;
}

export interface WorkflowExecutionDetail {
  id: string;
  workflow_id: string;
  workflow_name: string;
  workflow_version_number: number;
  graph_data: WorkflowGraph;
  status: string;
  current_node_id?: string;
  context_data: Record<string, any>;
  job?: { id: string; title: string; job_code: string };
  candidate?: { id: string; full_name: string; email: string; phone?: string };
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  nodes: NodeExecutionDetail[];
  human_tasks: HumanTaskDetail[];
}

export interface WorkflowValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}
