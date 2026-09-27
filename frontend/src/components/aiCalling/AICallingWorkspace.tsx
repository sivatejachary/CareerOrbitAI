import { Link } from 'react-router-dom';
import { Button, EmptyState, ErrorState, PageHeading, Pagination } from '../ui/Workspace';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PhoneCall,
  Plus,
  Search,
  AlertTriangle,
  Eye,
  RefreshCw,
  Pause,
  Play,
  XCircle,
  PhoneForwarded,
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
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const requestVersion = useRef(0);
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
        if (!jobList.length) setLoading(false);
        if (jobList.length > 0) {
          setSelectedJobId(jobList[0].id);
        }
      } catch (err) {
        setError('Unable to load calling workspace. Please refresh the page.');
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // 2. Load Job-specific eligibility, batch status, and call logs
  const loadJobData = useCallback(async () => {
    if (!selectedJobId) return;
    const version = ++requestVersion.current;
    try {
      const [eligData, batchesData, attemptsData] = await Promise.all([
        aiCallingApi.getEligibleCandidates(selectedJobId),
        aiCallingApi.listBatches({ job_id: selectedJobId, size: 5 }),
        aiCallingApi.listAttempts({ job_id: selectedJobId, size: 20, page, category: activeTab, search: searchTerm })
      ]);
      if (version !== requestVersion.current) return;
      setError('');
      setTotalCalls(attemptsData.total);
      setEligibility(eligData);
      setAttempts(attemptsData.items || []);

      // Check for active or recently completed batch
      const batches = batchesData.items || [];
      const runningOrRecent = batches.find(
        (b) => b.status === 'RUNNING' || b.status === 'QUEUED' || b.status === 'PAUSED'
      ) || batches[0] || null;
      setActiveBatch(runningOrRecent);
    } catch (err) {
      if (version === requestVersion.current) setError('Unable to refresh calls. Please try again.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [selectedJobId, page, activeTab, searchTerm]);

  useEffect(() => {
    if (selectedJobId) {
      setLoading(true);
      loadJobData();
      const interval = setInterval(loadJobData, 5000);
      return () => { clearInterval(interval); requestVersion.current++; };
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
      setError(`Could not start batch: ${err.message || 'Please try again.'}`);
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
      setError('Unable to update this calling batch. Please try again.');
    }
  };

  const handleResumeBatch = async () => {
    if (!activeBatch) return;
    try {
      const updated = await aiCallingApi.resumeBatch(activeBatch.id);
      setActiveBatch(updated);
    } catch (err: any) {
      setError('Unable to update this calling batch. Please try again.');
    }
  };

  const handleCancelBatch = async () => {
    if (!activeBatch) return;
    if (!confirm('Are you sure you want to stop the remaining calls in this batch?')) return;
    try {
      const updated = await aiCallingApi.cancelBatch(activeBatch.id);
      setActiveBatch(updated);
    } catch (err: any) {
      setError('Unable to update this calling batch. Please try again.');
    }
  };

  const handleOpenDetail = async (attemptId: string) => {
    setSelectedCallDetail(null);
    try {
      const detail = await aiCallingApi.getAttemptDetail(attemptId);
      setSelectedCallDetail(detail);
      setDrawerOpen(true);
    } catch (err) {
      setError('Unable to load call details. Please try again.');
    }
  };

  const filteredAttempts = attempts;

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const totalApps = eligibility?.total_applications ?? 0;
  const shortlistedCount = eligibility?.shortlisted_count ?? 0;
  const callsPending = eligibility?.eligible_count ?? 0;

  const isBatchRunning = activeBatch && (activeBatch.status === 'RUNNING' || activeBatch.status === 'QUEUED');
  const isBatchPaused = activeBatch && activeBatch.status === 'PAUSED';

  // Calculate Batch Progress
  const batchProgress = activeBatch && activeBatch.total_candidates > 0
    ? Math.min(100, Math.round(((activeBatch.initiated_count + activeBatch.failed_count + activeBatch.skipped_count) / activeBatch.total_candidates) * 100))
    : 0;

  return (
    <div className="workspace-page">
      <PageHeading title="AI calling" description="Contact shortlisted candidates and review each conversation in one place." actions={<Button onClick={() => setInitiateModalOpen(true)} disabled={!readiness?.ready}><Plus size={16} />Single call</Button>} />
      {error && <ErrorState message={error} onRetry={() => selectedJobId ? loadJobData() : window.location.reload()} />}
      {readiness && !readiness.ready && <div role="status" className="bg-amber-50 border border-amber-200 rounded-menu p-4 flex gap-3 items-start"><AlertTriangle size={18} className="text-warning shrink-0" /><div><p className="font-medium">AI calling needs setup</p><p className="text-sm text-text-secondary mt-1">Ask your administrator to connect the voice provider and phone number.</p><Link to="/settings" className="text-interactive-blue text-sm inline-block mt-2">View settings</Link></div></div>}
      <div className="filter-bar"><label className="ui-field flex-1">Select a job<select className="ui-input" value={selectedJobId} onChange={e => { setSelectedJobId(e.target.value); setPage(1); setEligibility(null); setActiveBatch(null); setAttempts([]); }}><option value="" disabled>{jobs.length ? 'Choose a job' : 'No jobs available'}</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title} · {job.department}</option>)}</select></label><Button onClick={loadJobData} aria-label="Refresh calls" disabled={!selectedJobId}><RefreshCw size={16} /></Button></div>
      {selectedJobId ? <section className="ui-panel">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h2 className="font-semibold text-lg">{selectedJob?.title}</h2><p className="text-sm text-text-secondary mt-1">{selectedJob?.department} · {selectedJob?.work_mode}</p></div><div className="flex flex-wrap gap-2">
          {isBatchRunning ? <Button onClick={handlePauseBatch}><Pause size={16} />Pause calling</Button> : isBatchPaused ? <Button onClick={handleResumeBatch}><Play size={16} />Resume calling</Button> : <Button variant="primary" disabled={startingBatch || !readiness?.ready || !eligibility || callsPending === 0} onClick={() => setBatchModalOpen(true)}><PhoneCall size={16} />Start AI Calling</Button>}
          {(isBatchRunning || isBatchPaused) && <Button variant="danger" onClick={handleCancelBatch}><XCircle size={16} />Stop remaining calls</Button>}
        </div></div>
        <div className="grid grid-cols-3 border-t border-border-subtle divide-x divide-border-subtle">{[['Applications', totalApps], ['Shortlisted', shortlistedCount], ['Ready to call', callsPending]].map(([label, value]) => <div className="p-4 sm:p-5" key={label}><p className="text-xs text-text-secondary">{label}</p><p className="text-2xl font-semibold mt-1 tabular-nums">{eligibility ? value : '—'}</p></div>)}</div>
        {activeBatch && <div className="border-t border-border-subtle p-5 space-y-3"><div className="flex flex-wrap justify-between gap-2 text-xs text-text-secondary"><span>Latest batch · {activeBatch.status.toLowerCase()}</span><span>{activeBatch.completed_count} completed · {activeBatch.failed_count} failed · {activeBatch.skipped_count} skipped</span></div><progress aria-label="Batch dispatch progress" max={100} value={batchProgress} className="w-full h-2 accent-interactive-blue" /><p className="text-xs text-text-secondary">{activeBatch.initiated_count} of {activeBatch.total_candidates} calls initiated. Dispatch progress does not indicate completed conversations.</p></div>}
      </section> : !loading && <section className="ui-panel"><EmptyState title="Create a job to start calling" description="Shortlist candidates for a job, then start an AI calling batch." action={<Link className="ui-button ui-button-primary" to="/jobs/create">Create job</Link>} /></section>}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Scheduled', 'Active', 'Needs Attention', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
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
            aria-label="Search calls"
            placeholder="Search candidate or phone..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Calls Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">Loading outbound calls...</div>
      ) : filteredAttempts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-menu space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <PhoneForwarded className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-slate-800">{searchTerm || activeTab !== 'All' ? 'No matching calls' : 'No calls yet'}</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click <strong className="text-slate-700">Start AI Calling</strong> above to automatically queue and call all eligible shortlisted candidates for this role.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-menu overflow-x-auto">
          <table className="ui-table text-sm"><caption className="sr-only">AI call history</caption>
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
                      <span>View call</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedJobId && <Pagination page={page} total={totalCalls} pageSize={20} onChange={setPage} />}

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
