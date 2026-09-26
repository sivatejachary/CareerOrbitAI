import { useState, useEffect, useCallback } from 'react';
import {
  fetchCandidateJobDetail,
  fetchCandidateJobTimeline,
  fetchCandidateCallTranscript,
  triggerExtraction,
  triggerScreening,
  fetchResumeDownloadLink,
  type CandidateJobDetail,
  type TimelineEvent,
  type TranscriptResponse,
} from '../../api/candidatesV3Api';

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    SUCCEEDED: 'bg-green-100 text-green-800',
    QUEUED: 'bg-yellow-100 text-yellow-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
    BLOCKED: 'bg-gray-100 text-gray-600',
    SHORTLISTED: 'bg-emerald-100 text-emerald-800',
    REVIEW: 'bg-amber-100 text-amber-800',
    NOT_MATCHED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
};

const stageBadge = (stage: string) => {
  const colors: Record<string, string> = {
    APPLIED: 'bg-blue-100 text-blue-700',
    SCREENING: 'bg-yellow-100 text-yellow-700',
    SHORTLISTED: 'bg-green-100 text-green-700',
    AI_CALL_SCHEDULED: 'bg-purple-100 text-purple-700',
    AI_CALL_DONE: 'bg-indigo-100 text-indigo-700',
    HR_REVIEW: 'bg-orange-100 text-orange-700',
    OFFERED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
    WITHDRAWN: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${colors[stage] || 'bg-gray-100 text-gray-700'}`}>
      {stage.replace(/_/g, ' ')}
    </span>
  );
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// ---------------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------------
const ScoreBar = ({ score }: { score: number | null }) => {
  if (score === null || score === undefined) return <span className="text-gray-400 text-sm">No score</span>;
  const pct = Math.round(score);
  const color = pct >= 75 ? 'bg-green-500' : pct >= 45 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-700 w-10 text-right">{pct}/100</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  candidateId: string;
  jobId: string;
  candidateName?: string;
  onClose?: () => void;
}

type Tab = 'overview' | 'profile' | 'timeline' | 'calls';

export default function CandidatePipelinePanel({ candidateId, jobId, candidateName, onClose }: Props) {
  const [detail, setDetail] = useState<CandidateJobDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [transcript, setTranscript] = useState<TranscriptResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchCandidateJobDetail(candidateId, jobId);
      setDetail(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [candidateId, jobId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  useEffect(() => {
    if (activeTab === 'timeline') {
      fetchCandidateJobTimeline(candidateId, jobId).then(setTimeline).catch(() => {});
    }
    if (activeTab === 'calls') {
      fetchCandidateCallTranscript(candidateId, jobId).then(setTranscript).catch(() => {});
    }
  }, [activeTab, candidateId, jobId]);

  const handleExtract = async () => {
    setActionLoading('extract');
    try {
      await triggerExtraction(candidateId, jobId);
      showToast('Extraction triggered — reloading…');
      await loadDetail();
    } catch (e: unknown) {
      showToast(`Extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleScreen = async () => {
    setActionLoading('screen');
    try {
      await triggerScreening(candidateId, jobId);
      showToast('Screening triggered — reloading…');
      await loadDetail();
    } catch (e: unknown) {
      showToast(`Screening failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadResume = async () => {
    setActionLoading('download');
    try {
      const { download_url } = await fetchResumeDownloadLink(candidateId, jobId);
      window.open(download_url, '_blank');
    } catch (e: unknown) {
      showToast(`Resume download failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
      <p className="font-semibold">Error loading pipeline data</p>
      <p className="text-sm">{error}</p>
    </div>
  );

  if (!detail) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'profile', label: 'Extracted Profile' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'calls', label: 'AI Calls' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-start justify-between">
        <div>
          <h2 className="text-white text-lg font-bold">{candidateName || 'Candidate Pipeline'}</h2>
          <p className="text-blue-200 text-sm mt-0.5">{detail.job_title || jobId}</p>
          <div className="mt-2">{stageBadge(detail.stage)}</div>
        </div>
        <div className="flex items-center gap-2">
          {detail.resume_id && (
            <button
              onClick={handleDownloadResume}
              disabled={actionLoading === 'download'}
              className="bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-1.5 rounded-lg transition"
            >
              {actionLoading === 'download' ? '…' : '⬇ Resume'}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl ml-2">✕</button>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 divide-x border-b border-gray-100">
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Extraction</p>
          {statusBadge(detail.extraction_status)}
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Screening</p>
          {statusBadge(detail.screening_status)}
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Recommendation</p>
          {detail.recommendation ? statusBadge(detail.recommendation) : <span className="text-gray-400 text-sm">—</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="mx-4 mt-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2 rounded-lg">
          {toast}
        </div>
      )}

      {/* Tab content */}
      <div className="p-6">
        {/* ---- OVERVIEW ---- */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Screening score */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Screening Score</h3>
              <ScoreBar score={detail.screening_score} />
              {detail.screening_rationale && (
                <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-3">
                  {detail.screening_rationale}
                </p>
              )}
              {detail.screening_model && (
                <p className="text-xs text-gray-400 mt-1">Model: {detail.screening_model}</p>
              )}
            </div>

            {/* Criteria breakdown */}
            {detail.screening_criterion_results && detail.screening_criterion_results.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Criteria Breakdown</h3>
                <div className="space-y-2">
                  {detail.screening_criterion_results.map((c, i) => (
                    <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                      <span className={`mt-0.5 text-sm ${c.passed ? 'text-green-600' : 'text-red-500'}`}>
                        {c.passed ? '✓' : '✗'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-800">{c.criterion}</span>
                          <span className="text-xs text-gray-500">{c.score}/{c.max_score}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{c.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleExtract}
                disabled={!!actionLoading}
                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-sm px-4 py-2.5 rounded-lg border border-blue-200 transition"
              >
                {actionLoading === 'extract' ? 'Extracting…' : '🔍 Re-Extract Resume'}
              </button>
              <button
                onClick={handleScreen}
                disabled={!!actionLoading}
                className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-sm px-4 py-2.5 rounded-lg border border-indigo-200 transition"
              >
                {actionLoading === 'screen' ? 'Screening…' : '⚡ Re-Screen'}
              </button>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
              <div>
                <p className="text-xs text-gray-500">Applied via</p>
                <p className="font-medium text-gray-800">{detail.source}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Received</p>
                <p className="font-medium text-gray-800">{formatDate(detail.received_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Extraction model</p>
                <p className="font-medium text-gray-800">{detail.extraction_model || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Screening model</p>
                <p className="font-medium text-gray-800">{detail.screening_model || '—'}</p>
              </div>
            </div>

            {/* Errors if any */}
            {detail.extraction_error && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-600">
                <strong>Extraction error:</strong> {detail.extraction_error}
              </div>
            )}
            {detail.screening_error && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
                <strong>Screening note:</strong> {detail.screening_error}
              </div>
            )}
          </div>
        )}

        {/* ---- EXTRACTED PROFILE ---- */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {!detail.extracted_profile ? (
              <div className="text-center text-gray-400 py-8">
                <p className="text-4xl mb-2">📄</p>
                <p className="text-sm">No extracted profile yet.</p>
                <button onClick={handleExtract} disabled={!!actionLoading}
                  className="mt-3 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg">
                  {actionLoading === 'extract' ? 'Extracting…' : 'Extract Now'}
                </button>
              </div>
            ) : (
              <>
                {/* Key info */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Name', key: 'full_name' },
                    { label: 'Email', key: 'email' },
                    { label: 'Phone', key: 'phone' },
                    { label: 'Location', key: 'location' },
                    { label: 'Experience', key: 'total_experience_years', suffix: ' years' },
                    { label: 'Current Company', key: 'current_company' },
                    { label: 'Current Title', key: 'current_title' },
                    { label: 'Notice Period', key: 'notice_period' },
                  ].map(({ label, key, suffix }) => {
                    const val = detail.extracted_profile?.[key];
                    if (!val) return null;
                    return (
                      <div key={key} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-medium text-gray-800">{String(val)}{suffix || ''}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Skills */}
                {Array.isArray(detail.extracted_profile.skills) && detail.extracted_profile.skills.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {(detail.extracted_profile.skills as string[]).map((s, i) => (
                        <span key={i} className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {detail.extracted_profile.summary && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Summary</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{String(detail.extracted_profile.summary)}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ---- TIMELINE ---- */}
        {activeTab === 'timeline' && (
          <div>
            {timeline.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No timeline events yet.</p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-6">
                  {timeline.map((ev, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-4 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-semibold text-gray-800">{ev.title}</p>
                          <p className="text-xs text-gray-400 ml-4 whitespace-nowrap">{formatDate(ev.timestamp)}</p>
                        </div>
                        {ev.description && (
                          <p className="text-xs text-gray-600 mt-1">{ev.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- CALLS ---- */}
        {activeTab === 'calls' && (
          <div className="space-y-4">
            {!transcript || transcript.calls.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No AI calls recorded for this candidate+job.</p>
            ) : (
              transcript.calls.map((call) => (
                <div key={call.call_attempt_id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex justify-between items-center">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Call #{call.attempt_number}</span>
                      <span className="text-xs text-gray-500 ml-3">{formatDate(call.initiated_at)}</span>
                    </div>
                    <div className="flex gap-2">
                      {statusBadge(call.operation_state)}
                      {call.disposition && statusBadge(call.disposition)}
                    </div>
                  </div>

                  {call.duration_seconds && (
                    <div className="px-4 py-2 text-xs text-gray-500 border-b">
                      Duration: {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                    </div>
                  )}

                  {call.evaluation && (
                    <div className="px-4 py-3 border-b bg-white">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Evaluation</p>
                      <div className="flex items-center gap-3 mb-2">
                        {statusBadge(call.evaluation.recommendation)}
                        <span className="text-xs text-gray-600">{call.evaluation.rationale}</span>
                      </div>
                      {call.evaluation.extracted_facts && call.evaluation.extracted_facts.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {call.evaluation.extracted_facts.map((f, i) => (
                            <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                              {f.key}: {f.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {call.transcript && (
                    <div className="px-4 py-3 max-h-60 overflow-y-auto">
                      {call.transcript.turns.length > 0 ? (
                        <div className="space-y-2">
                          {call.transcript.turns.map((turn, ti) => (
                            <div key={ti} className={`flex gap-2 ${turn.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                                turn.speaker === 'agent'
                                  ? 'bg-blue-50 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                <p className="text-xs font-semibold mb-0.5 capitalize">{turn.speaker}</p>
                                {turn.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : call.transcript.full_text ? (
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap">{call.transcript.full_text}</pre>
                      ) : (
                        <p className="text-xs text-gray-400">No transcript available</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
