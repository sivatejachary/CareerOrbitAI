import React, { useState, useEffect, useCallback } from 'react';
import {
  PhoneCall,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Eye,
  RefreshCw,
  Rocket,
  Pause,
  Play,
  XCircle,
  Briefcase,
  Sparkles,
  PhoneForwarded,
  Activity
} from 'lucide-react';
import { aiCallingApi } from '../../api/aiCallingApi';
import { jobsApi } from '../../api/jobsApi';
import {
  CallAttemptItem,
  CallAttemptDetail,
  ElevenLabsReadiness,
  JobEligibilityResponse,
  AICallBatch
} from '../../types/aiCalling';
import { Job } from '../../types/job';
import { CallDetailDrawer } from './CallDetailDrawer';
import { InitiateCallModal } from './InitiateCallModal';
import { BatchConfirmationModal } from './BatchConfirmationModal';

export const AICallingWorkspace: React.FC = () => {
  const [readiness, setReadiness] = useState<ElevenLabsReadiness | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [eligibility, setEligibility] = useState<JobEligibilityResponse | null>(null);
  const [activeBatch, setActiveBatch] = useState<AICallBatch | null>(null);

  const [attempts, setAttempts] = useState<CallAttemptItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [startingBatch, setStartingBatch] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'All' | 'Scheduled' | 'Active' | 'Needs Attention' | 'Completed'>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals & Drawers
  const [selectedCallDetail, setSelectedCallDetail] = useState<CallAttemptDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [initiateModalOpen, setInitiateModalOpen] = useState<boolean>(false);
  const [batchModalOpen, setBatchModalOpen] = useState<boolean>(false);

  // 1. Load Jobs and Readiness on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [readinessData, jobsData] = await Promise.all([
          aiCallingApi.checkReadiness(),
          jobsApi.listJobs({ page: 1, size: 50 })
        ]);
        setReadiness(readinessData);
        const jobList = jobsData.items || [];
        setJobs(jobList);
        if (jobList.length > 0) {
          setSelectedJobId(jobList[0].id);
        }
      } catch (err) {
        console.error('Failed to load initial workspace data', err);
      }
    };
    fetchInitialData();
  }, []);

  // 2. Load Job-specific eligibility, batch status, and call logs
  const loadJobData = useCallback(async () => {
    if (!selectedJobId) return;
    try {
      const [eligData, batchesData, attemptsData] = await Promise.all([
        aiCallingApi.getEligibleCandidates(selectedJobId),
        aiCallingApi.listBatches({ job_id: selectedJobId, size: 5 }),
        aiCallingApi.listAttempts({ job_id: selectedJobId, size: 50 })
      ]);
      setEligibility(eligData);
      setAttempts(attemptsData.items || []);

      // Check for active or recently completed batch
      const batches = batchesData.items || [];
      const runningOrRecent = batches.find(
        (b) => b.status === 'RUNNING' || b.status === 'QUEUED' || b.status === 'PAUSED'
      ) || batches[0] || null;
      setActiveBatch(runningOrRecent);
    } catch (err) {
      console.error('Failed to fetch job calling data', err);
    } finally {
      setLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    if (selectedJobId) {
      setLoading(true);
      loadJobData();
      const interval = setInterval(loadJobData, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedJobId, loadJobData]);

  // Handle Start Batch Confirmation
  const handleConfirmBatch = async (config: {
    max_concurrent_calls: number;
    call_delay_seconds: number;
    max_attempts_per_candidate: number;
  }) => {
    if (!selectedJobId) return;
    setStartingBatch(true);
    try {
      const newBatch = await aiCallingApi.startBatch({
        job_id: selectedJobId,
        max_concurrent_calls: config.max_concurrent_calls,
        call_delay_seconds: config.call_delay_seconds,
        max_attempts_per_candidate: config.max_attempts_per_candidate
      });
      setActiveBatch(newBatch);
      setBatchModalOpen(false);
      await loadJobData();
    } catch (err: any) {
      alert(`Could not start batch: ${err.message || 'Unknown error'}`);
    } finally {
      setStartingBatch(false);
    }
  };

  // Batch control actions
  const handlePauseBatch = async () => {
    if (!activeBatch) return;
    try {
      const updated = await aiCallingApi.pauseBatch(activeBatch.id);
      setActiveBatch(updated);
    } catch (err: any) {
      console.error('Error pausing batch:', err);
    }
  };

  const handleResumeBatch = async () => {
    if (!activeBatch) return;
    try {
      const updated = await aiCallingApi.resumeBatch(activeBatch.id);
      setActiveBatch(updated);
    } catch (err: any) {
      console.error('Error resuming batch:', err);
    }
  };

  const handleCancelBatch = async () => {
    if (!activeBatch) return;
    if (!confirm('Are you sure you want to stop the remaining calls in this batch?')) return;
    try {
      const updated = await aiCallingApi.cancelBatch(activeBatch.id);
      setActiveBatch(updated);
    } catch (err: any) {
      console.error('Error cancelling batch:', err);
    }
  };

  const handleOpenDetail = async (attemptId: string) => {
    setDrawerOpen(true);
    try {
      const detail = await aiCallingApi.getAttemptDetail(attemptId);
      setSelectedCallDetail(detail);
    } catch (err) {
      console.error('Failed to load call detail', err);
    }
  };

  // Filter call attempts
  const filteredAttempts = attempts.filter((att) => {
    const matchesSearch =
      (att.candidate_name && att.candidate_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (att.job_title && att.job_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      att.phone_number.includes(searchTerm);

    if (!matchesSearch) return false;

    if (activeTab === 'Scheduled') return att.operation_state === 'Scheduled';
    if (activeTab === 'Active') return att.connection_state === 'Ringing' || att.connection_state === 'Connected';
    if (activeTab === 'Needs Attention') return att.operation_state === 'Failed' || att.processing_state === 'NeedsReview';
    if (activeTab === 'Completed') return att.disposition === 'ConversationCompleted' || att.operation_state === 'Accepted';

    return true;
  });

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const totalApps = eligibility?.total_applications ?? 0;
  const shortlistedCount = eligibility?.shortlisted_count ?? 0;
  const callsPending = eligibility?.eligible_count ?? 0;
  const callsCompleted = attempts.filter((a) => a.disposition === 'ConversationCompleted').length;

  const isBatchRunning = activeBatch && (activeBatch.status === 'RUNNING' || activeBatch.status === 'QUEUED');
  const isBatchPaused = activeBatch && activeBatch.status === 'PAUSED';

  // Calculate Batch Progress
  const batchProgress = activeBatch && activeBatch.total_candidates > 0
    ? Math.min(100, Math.round(((activeBatch.initiated_count + activeBatch.failed_count + activeBatch.skipped_count) / activeBatch.total_candidates) * 100))
    : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Job Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Outbound Recruitment</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <PhoneCall className="w-6 h-6 text-blue-600" />
            <span>AI Voice Calling</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            One-click automated AI screening calls with conversational agent, live transcription, and fact verification.
          </p>
        </div>

        {/* Controls Bar: Job Dropdown + Manual Initiate */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-4"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.department})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={loadJobData}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setInitiateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Single Call</span>
          </button>
        </div>
      </div>

      {/* ElevenLabs Readiness Banner */}
      {readiness && !readiness.ready ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <div className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
              ElevenLabs Integration Notice
            </div>
            <p className="leading-relaxed">
              {readiness.message || 'ElevenLabs API credentials are not configured in the backend environment.'}
            </p>
            <p className="text-[11px] text-amber-800 italic">
              When triggered, calls are recorded honestly in the audit trail without simulating fake phone connections.
            </p>
          </div>
        </div>
      ) : readiness && readiness.ready ? (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">ElevenLabs Conversational AI: Connected & Active</span>
          </div>
          {readiness.agent_id && (
            <span className="font-mono text-[10px] text-emerald-700">Agent: {readiness.agent_id}</span>
          )}
        </div>
      ) : null}

      {/* ONE-CLICK HERO CARD */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl">
            <div>
              <span className="inline-block px-2.5 py-0.5 bg-blue-500/20 border border-blue-400/30 text-blue-300 font-semibold rounded-full text-[10px] uppercase tracking-wider mb-2">
                Job Overview
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {selectedJob?.title || 'Selected Position'}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {selectedJob?.department} · {selectedJob?.work_mode} · {selectedJob?.city ? `${selectedJob.city}, ${selectedJob.country}` : selectedJob?.country}
              </p>
            </div>

            {/* Spec Metrics Row */}
            <div className="grid grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xs">
                <div className="text-[11px] text-slate-300">Applications</div>
                <div className="text-xl font-bold text-white mt-0.5">{totalApps}</div>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xs">
                <div className="text-[11px] text-blue-200">Shortlisted</div>
                <div className="text-xl font-bold text-blue-300 mt-0.5">{shortlistedCount}</div>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xs">
                <div className="text-[11px] text-amber-200">Calls Pending</div>
                <div className="text-xl font-bold text-amber-300 mt-0.5">{callsPending}</div>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xs">
                <div className="text-[11px] text-emerald-200">Completed</div>
                <div className="text-xl font-bold text-emerald-300 mt-0.5">{callsCompleted}</div>
              </div>
            </div>
          </div>

          {/* ONE-CLICK PRIMARY BUTTON */}
          <div className="flex flex-col items-center md:items-end justify-center gap-3">
            {isBatchRunning ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePauseBatch}
                  className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                  <span>⏸ Pause Calling</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelBatch}
                  className="p-3 bg-white/10 hover:bg-white/20 text-rose-300 rounded-xl border border-white/10 transition-colors cursor-pointer"
                  title="Cancel Remaining Calls"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : isBatchPaused ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeBatch}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>▶ Resume Calling</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelBatch}
                  className="p-3 bg-white/10 hover:bg-white/20 text-rose-300 rounded-xl border border-white/10 transition-colors cursor-pointer"
                  title="Cancel Remaining Calls"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : callsPending > 0 ? (
              <button
                type="button"
                onClick={() => setBatchModalOpen(true)}
                disabled={startingBatch}
                className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-base rounded-2xl shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                <Rocket className="w-5 h-5 animate-pulse" />
                <span>🚀 Start AI Calling</span>
              </button>
            ) : shortlistedCount > 0 ? (
              <div className="flex items-center gap-2 px-5 py-3 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>✓ All Shortlisted Candidates Called</span>
              </div>
            ) : (
              <div className="px-4 py-2 bg-white/10 border border-white/10 text-slate-400 rounded-xl text-xs">
                No Shortlisted Candidates for this role
              </div>
            )}

            <div className="text-[11px] text-slate-400 text-center md:text-right">
              {callsPending > 0
                ? `${callsPending} shortlisted candidates ready to dial automatically`
                : 'Zero manual dialing required'}
            </div>
          </div>
        </div>

        {/* Live Batch Progress Bar (if active) */}
        {activeBatch && (activeBatch.status === 'RUNNING' || activeBatch.status === 'PAUSED' || activeBatch.status === 'QUEUED') && (
          <div className="mt-6 pt-5 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-semibold text-blue-200">
                <Activity className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                <span>Batch Calling in Progress ({activeBatch.status})</span>
              </span>
              <span className="font-mono text-slate-300">
                {activeBatch.initiated_count} / {activeBatch.total_candidates} Initiated ({batchProgress}%)
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-500"
                style={{ width: `${batchProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Initiated: {activeBatch.initiated_count}</span>
              <span>Completed: {activeBatch.completed_count}</span>
              <span>Failed: {activeBatch.failed_count}</span>
              <span>Skipped: {activeBatch.skipped_count}</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          {(['All', 'Scheduled', 'Active', 'Needs Attention', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search candidate or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Calls Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">Loading outbound calls...</div>
      ) : filteredAttempts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <PhoneForwarded className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-slate-800">No outbound calls initiated yet</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click <strong className="text-slate-700">🚀 Start AI Calling</strong> above to automatically queue and call all eligible shortlisted candidates for this role.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Attempt</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Disposition</th>
                <th className="py-3 px-4">Evaluation</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredAttempts.map((att) => (
                <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {att.candidate_name || 'Candidate'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{att.phone_number}</td>
                  <td className="py-3 px-4">#{att.attempt_number}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        att.operation_state === 'Scheduled'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : att.operation_state === 'Accepted' || att.connection_state === 'Connected'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : att.operation_state === 'Failed'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {att.operation_state}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-medium">
                    {att.disposition || '—'}
                  </td>
                  <td className="py-3 px-4">
                    {att.recommendation ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          att.recommendation === 'SHORTLIST'
                            ? 'bg-emerald-100 text-emerald-800'
                            : att.recommendation === 'NOT_MATCHED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {att.recommendation}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {att.duration_seconds ? `${Math.floor(att.duration_seconds / 60)}m ${att.duration_seconds % 60}s` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(att.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details & Facts</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Call Detail Drawer */}
      {drawerOpen && (
        <CallDetailDrawer
          call={selectedCallDetail}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedCallDetail(null);
          }}
          onUpdateCall={loadJobData}
        />
      )}

      {/* Manual Single Call Modal */}
      {initiateModalOpen && (
        <InitiateCallModal
          isOpen={initiateModalOpen}
          onClose={() => setInitiateModalOpen(false)}
          onSuccess={loadJobData}
        />
      )}

      {/* One-Click Batch Confirmation Modal */}
      {batchModalOpen && (
        <BatchConfirmationModal
          isOpen={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          onConfirm={handleConfirmBatch}
          eligibilityData={eligibility}
          loading={startingBatch}
        />
      )}
    </div>
  );
};
