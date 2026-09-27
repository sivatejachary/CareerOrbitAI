import { useState, useEffect } from 'react';
import {
  fetchJobCandidates,
  type JobCandidateEntry,
} from '../../api/candidatesV3Api';
import CandidatePipelinePanel from '../candidates/CandidatePipelinePanel';

interface Props {
  jobId: string;
  jobTitle?: string;
}

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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[stage] || 'bg-gray-100 text-gray-700'}`}>
      {stage.replace(/_/g, ' ')}
    </span>
  );
};

const recoBadge = (rec: string | null) => {
  if (!rec) return <span className="text-gray-300 text-xs">—</span>;
  const colors: Record<string, string> = {
    SHORTLISTED: 'text-green-700 bg-green-50',
    REVIEW: 'text-amber-700 bg-amber-50',
    NOT_MATCHED: 'text-red-600 bg-red-50',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors[rec] || ''}`}>
      {rec}
    </span>
  );
};

const STAGE_FILTERS = ['All', 'APPLIED', 'SCREENING', 'SHORTLISTED', 'HR_REVIEW', 'REJECTED'];
const RECO_FILTERS = ['All', 'SHORTLISTED', 'REVIEW', 'NOT_MATCHED'];

export default function JobPipelineView({ jobId, jobTitle }: Props) {
  const [candidates, setCandidates] = useState<JobCandidateEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('All');
  const [recoFilter, setRecoFilter] = useState('All');
  const [selectedCandidate, setSelectedCandidate] = useState<JobCandidateEntry | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchJobCandidates(
      jobId,
      stageFilter !== 'All' ? stageFilter : undefined,
      recoFilter !== 'All' ? recoFilter : undefined
    )
      .then((data) => {
        setCandidates(data.candidates);
        setTotal(data.total);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [jobId, stageFilter, recoFilter]);

  const filtered = candidates.filter(c =>
    !search ||
    c.candidate_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.candidate_email || '').toLowerCase().includes(search.toLowerCase())
  );

  const ScoreBar = ({ score }: { score: number | null }) => {
    if (!score) return <span className="text-gray-300 text-xs">—</span>;
    const pct = Math.round(score);
    const color = pct >= 75 ? 'bg-green-500' : pct >= 45 ? 'bg-amber-500' : 'bg-red-400';
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 bg-gray-200 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-600 font-medium">{pct}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{jobTitle || 'Job Pipeline'}</h2>
          <p className="text-sm text-gray-500">{total} candidate{total !== 1 ? 's' : ''} applied</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
        />

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Stage:</span>
          {STAGE_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                stageFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'All' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Screening:</span>
          {RECO_FILTERS.map(r => (
            <button
              key={r}
              onClick={() => setRecoFilter(r)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                recoFilter === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">👥</p>
          <p className="text-sm">No candidates match this filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Candidate', 'Stage', 'Recommendation', 'Score', 'Source', 'Applied'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {filtered.map(c => (
                <tr
                  key={c.candidate_id}
                  onClick={() => setSelectedCandidate(c)}
                  className="hover:bg-blue-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.candidate_name}</p>
                      <p className="text-xs text-gray-400">{c.candidate_email || '—'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{stageBadge(c.stage)}</td>
                  <td className="px-4 py-3">{recoBadge(c.recommendation)}</td>
                  <td className="px-4 py-3">
                    <ScoreBar score={c.screening_score} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{c.source}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {c.received_at ? new Date(c.received_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over panel */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelectedCandidate(null)}
          />
          <div className="w-full max-w-2xl bg-white shadow-drawer overflow-y-auto">
            <CandidatePipelinePanel
              candidateId={selectedCandidate.candidate_id}
              jobId={jobId}
              candidateName={selectedCandidate.candidate_name}
              onClose={() => setSelectedCandidate(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
