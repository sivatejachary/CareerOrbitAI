import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Plus,
  Layers,
  ArrowRight,
  Eye,
  Activity,
  Search
} from 'lucide-react';
import { workflowApi } from '../../api/workflowApi';
import { WorkflowSummary, WorkflowExecutionItem } from '../../types/workflow';

export const WorkflowList: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'workflows' | 'executions'>('workflows');
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecutionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Workflow Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newWfName, setNewWfName] = useState('');
  const [newWfDesc, setNewWfDesc] = useState('');
  const [isCompanyDefault, setIsCompanyDefault] = useState(false);
  const [creating, setCreating] = useState(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [wfList, execList] = await Promise.all([
        workflowApi.listWorkflows(),
        workflowApi.listExecutions()
      ]);
      setWorkflows(wfList);
      setExecutions(execList.items || []);
    } catch (err) {
      console.error('Failed to load workflow data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWfName.trim()) return;

    setCreating(true);
    try {
      const newWf = await workflowApi.createWorkflow({
        name: newWfName.trim(),
        description: newWfDesc.trim() || undefined,
        is_company_default: isCompanyDefault
      });
      setIsModalOpen(false);
      setNewWfName('');
      setNewWfDesc('');
      setIsCompanyDefault(false);
      navigate(`/workflow/${newWf.id}`);
    } catch (err: any) {
      alert(`Failed to create workflow: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const filteredWorkflows = workflows.filter(w =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.description && w.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredExecutions = executions.filter(e =>
    e.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.workflow_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="workspace-page">
      {/* Top Header */}
      <div className="page-heading">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2.5">
            <GitBranch className="w-6 h-6 text-interactive-blue" />
            <span>Hiring Workflows</span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Design configurable, multi-stage hiring processes with AI screening, ElevenLabs voice interviews, and human checkpoints.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-interactive-blue hover:bg-nav-activeText text-surface text-sm font-semibold rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Workflow</span>
        </button>
      </div>

      {/* Tabs & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-border-subtle">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('workflows')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'workflows'
                ? 'border-blue-600 text-interactive-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Workflows ({workflows.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('executions')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'executions'
                ? 'border-blue-600 text-interactive-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Executions & Progress ({executions.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="pb-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label={`Search ${activeTab}`}
              className="pl-9 pr-3 py-2 text-xs bg-surface border border-border-subtle rounded-item focus:outline-none focus:ring-1 focus:ring-interactive-blue w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex justify-center items-center text-text-secondary text-sm">
          Loading workflow records...
        </div>
      ) : activeTab === 'workflows' ? (
        /* Workflows Grid */
        filteredWorkflows.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-border-subtle rounded-xl space-y-3">
            <GitBranch className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No workflows defined</div>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Create your first workflow to define automated AI screening, voice calls, and recruiter approvals.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-interactive-blue text-surface text-xs font-semibold rounded-lg hover:bg-nav-activeText"
            >
              Create Workflow
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 min-w-0">
            {filteredWorkflows.map(wf => (
              <div
                key={wf.id}
                onClick={() => navigate(`/workflow/${wf.id}`)}
                className="bg-white border border-border-subtle hover:border-blue-400 rounded-xl p-5 shadow-dropdown hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="page-actions">
                        <h3 className="font-bold text-text-primary group-hover:text-interactive-blue transition-colors text-base truncate block">
                          {wf.name}
                        </h3>
                      </div>
                      {wf.is_company_default && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Company Default
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                        wf.status === 'Published'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {wf.status}
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                    {wf.description || 'Configurable recruitment workflow.'}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between text-xs text-text-secondary">
                  <div className="flex items-center gap-3">
                    <span>v{wf.latest_version_number}</span>
                    <span>•</span>
                    <span>{wf.job_usage_count} {wf.job_usage_count === 1 ? 'Job' : 'Jobs'} linked</span>
                  </div>
                  <div className="flex items-center gap-1 text-interactive-blue font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>Editor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Executions Table */
        filteredExecutions.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-border-subtle rounded-xl space-y-2">
            <Activity className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No active workflow executions</div>
            <p className="text-xs text-text-secondary">Executions start automatically when candidate applications are submitted.</p>
          </div>
        ) : (
          <div className="ui-panel overflow-x-auto">
            <table className="ui-table text-sm">
              <thead className="bg-workspace border-b border-border-subtle text-text-secondary font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Job Role</th>
                  <th className="py-3 px-4">Workflow</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Current Node</th>
                  <th className="py-3 px-4">Started</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredExecutions.map(exc => (
                  <tr key={exc.id} className="hover:bg-workspace transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text-primary">{exc.candidate_name}</div>
                      <div className="text-[11px] text-text-secondary">{exc.candidate_email}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-text-primary">{exc.job_title}</td>
                    <td className="py-3 px-4">
                      <span className="text-text-primary">{exc.workflow_name}</span>
                      <span className="ml-1 text-[10px] text-text-secondary font-mono">v{exc.workflow_version_number}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          exc.status === 'Running'
                            ? 'bg-blue-100 text-blue-700'
                            : exc.status === 'WaitingForHuman'
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : exc.status === 'Succeeded'
                            ? 'bg-emerald-100 text-emerald-800'
                            : exc.status === 'Blocked' || exc.status === 'Failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-workspace text-slate-700'
                        }`}
                      >
                        {exc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-text-secondary">
                      {exc.current_node_id || '—'}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {new Date(exc.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/workflow/executions/${exc.id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-interactive-blue hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Timeline</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Create Workflow Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 p-4" role="dialog" aria-modal="true" aria-label="Create hiring workflow">
          <div className="bg-white rounded-xl shadow-dropdown max-w-md w-full p-6 space-y-4 border border-border-subtle">
            <div>
              <h3 className="text-base font-bold text-text-primary">Create Hiring Workflow</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Initializes a complete recruitment flow with intake, AI resume screening, ElevenLabs calling, and recruiter decisions.
              </p>
            </div>

            <form onSubmit={handleCreateWorkflow} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-text-primary">Workflow Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Software Engineer Pipeline"
                  value={newWfName}
                  onChange={(e) => setNewWfName(e.target.value)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-text-primary">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Recruitment process for engineering and technical hires"
                  value={newWfDesc}
                  onChange={(e) => setNewWfDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="defaultWf"
                  checked={isCompanyDefault}
                  onChange={(e) => setIsCompanyDefault(e.target.checked)}
                  className="rounded text-interactive-blue focus:ring-blue-500"
                />
                <label htmlFor="defaultWf" className="text-slate-700 cursor-pointer font-medium">
                  Set as default workflow for new job requisitions
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-border-subtle text-slate-600 hover:bg-workspace font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newWfName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-interactive-blue hover:bg-nav-activeText text-surface font-semibold shadow-dropdown disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Open Editor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
