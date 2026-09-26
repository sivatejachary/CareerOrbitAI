import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  XCircle,
  UserCheck,
  Loader2
} from 'lucide-react';
import { workflowApi } from '../../api/workflowApi';
import { NodeExecutionDetail, HumanTaskDetail } from '../../types/workflow';

export const WorkflowExecutionDetail: React.FC = () => {
  const { executionId } = useParams<{ executionId: string }>();
  const navigate = useNavigate();

  const [execution, setExecution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!executionId) return;
    try {
      const data = await workflowApi.getExecutionDetail(executionId);
      setExecution(data);
    } catch (err) {
      console.error('Failed to load execution detail', err);
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Polling for live status
    return () => clearInterval(interval);
  }, [loadData]);

  const handlePause = async () => {
    if (!executionId) return;
    setActionLoading(true);
    try {
      await workflowApi.pauseExecution(executionId);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!executionId) return;
    setActionLoading(true);
    try {
      await workflowApi.resumeExecution(executionId);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!executionId) return;
    if (!confirm('Are you sure you want to cancel this workflow execution?')) return;
    setActionLoading(true);
    try {
      await workflowApi.cancelExecution(executionId);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string, outcome: string) => {
    setActionLoading(true);
    try {
      await workflowApi.completeHumanTask(taskId, outcome);
      await loadData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2.5 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Loading execution progress...</span>
        </div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="p-8 text-center text-slate-500">
        Execution record not found.
      </div>
    );
  }

  const pendingTask: HumanTaskDetail | undefined = execution.human_tasks?.find(
    (t: HumanTaskDetail) => t.status === 'Pending'
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/workflow')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">
                Execution: {execution.candidate?.full_name || 'Candidate'}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  execution.status === 'Running'
                    ? 'bg-blue-100 text-blue-700'
                    : execution.status === 'WaitingForHuman'
                    ? 'bg-amber-100 text-amber-800 animate-pulse'
                    : execution.status === 'Succeeded'
                    ? 'bg-emerald-100 text-emerald-800'
                    : execution.status === 'Blocked' || execution.status === 'Failed'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {execution.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Role: <span className="font-medium text-slate-700">{execution.job?.title}</span> • Workflow:{' '}
              <span className="font-medium text-slate-700">{execution.workflow_name}</span> (v{execution.workflow_version_number})
            </p>
          </div>
        </div>

        {/* Execution Control Actions */}
        <div className="flex items-center gap-2">
          {execution.status === 'Running' && (
            <button
              type="button"
              onClick={handlePause}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          )}

          {execution.status === 'Paused' && (
            <button
              type="button"
              onClick={handleResume}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
          )}

          {['Running', 'Paused', 'WaitingForHuman', 'WaitingForEvent', 'WaitingUntilTime'].includes(execution.status) && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg shadow-xs"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Human Task Action Card (if waiting for human decision) */}
      {pendingTask && (
        <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/70 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800 mt-0.5">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Human Action Required
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{pendingTask.title}</h3>
                {pendingTask.instructions && (
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                    {pendingTask.instructions}
                  </p>
                )}
              </div>
            </div>

            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase">
              Action Pending
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-amber-200/60">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleCompleteTask(pendingTask.id, 'reject')}
              className="px-4 py-1.5 text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
            >
              Reject / Do Not Advance
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleCompleteTask(pendingTask.id, 'pass')}
              className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors"
            >
              Approve / Proceed to Next Step
            </button>
          </div>
        </div>
      )}

      {/* Step Progression Timeline */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 space-y-5">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Node Execution Timeline
        </h2>

        <div className="space-y-4">
          {execution.nodes?.length === 0 ? (
            <p className="text-xs text-slate-400">Execution has not started any nodes yet.</p>
          ) : (
            execution.nodes.map((node: NodeExecutionDetail, idx: number) => {
              const isCurrent = execution.current_node_id === node.node_id;

              return (
                <div
                  key={node.id}
                  className={`p-4 rounded-xl border transition-all ${
                    node.status === 'Completed'
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : node.status === 'Running'
                      ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/20'
                      : node.status === 'Failed'
                      ? 'border-rose-200 bg-rose-50/20'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center font-mono">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-xs">
                            {node.node_type.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            ({node.node_id})
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700 uppercase">
                              Current
                            </span>
                          )}
                        </div>
                        {node.selected_outcome && (
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            Outcome: <span className="font-semibold text-slate-800">{node.selected_outcome}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          node.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : node.status === 'Running'
                            ? 'bg-blue-100 text-blue-700 animate-pulse'
                            : node.status === 'Failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {node.status}
                      </span>
                      {node.completed_at && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(node.completed_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Output Snapshot details */}
                  {node.output_snapshot && Object.keys(node.output_snapshot).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-[11px]">
                      <span className="font-medium text-slate-500">Output Data:</span>
                      <pre className="mt-1 p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-700 font-mono overflow-x-auto text-[10px]">
                        {JSON.stringify(node.output_snapshot, null, 2)}
                      </pre>
                    </div>
                  )}

                  {node.error_details && (
                    <div className="mt-2 text-[11px] text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                      Error: {node.error_details}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
