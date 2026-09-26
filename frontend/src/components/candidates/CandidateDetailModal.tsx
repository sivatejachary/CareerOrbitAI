import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  FileText, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  MessageSquare,
  Play
} from 'lucide-react';
import { 
  fetchApplicationDetail, 
  fetchCandidateDetail, 
  triggerScreening, 
  submitHRDecision, 
  addHRNote 
} from '../../api/candidatesApi';
import { JobApplicationDetail } from '../../types/candidate';

interface Props {
  applicationId?: string | null;
  candidateId?: string | null;
  onClose: () => void;
}

export const CandidateDetailModal: React.FC<Props> = ({ applicationId, candidateId, onClose }) => {
  const [detail, setDetail] = useState<JobApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Decision state
  const [decisionReason, setDecisionReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Note state
  const [noteContent, setNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Re-run screening state
  const [screeningLoading, setScreeningLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (applicationId) {
        const data = await fetchApplicationDetail(applicationId);
        setDetail(data);
      } else if (candidateId) {
        const candData = await fetchCandidateDetail(candidateId);
        if (candData.applications && candData.applications.length > 0) {
          const firstApp = await fetchApplicationDetail(candData.applications[0].id);
          setDetail(firstApp);
        } else {
          setDetail({
            id: '',
            candidate: candData,
            job: null,
            source: candData.first_source || 'Direct',
            status: 'Submitted',
            answers_payload: {},
            profile_snapshot: {},
            received_at: candData.created_at,
            resume: candData.resumes?.[0] || null,
            screening_runs: [],
            hr_decisions: [],
            notes: []
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [applicationId, candidateId]);

  const handleDecision = async (decision: 'Shortlisted' | 'UnderReview' | 'Rejected') => {
    if (!detail?.id) return;
    setSubmittingDecision(true);
    try {
      await submitHRDecision(detail.id, decision, decisionReason);
      setDecisionReason('');
      await loadData();
    } catch (err) {
      alert('Failed to submit decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail?.id || !noteContent.trim()) return;
    setSubmittingNote(true);
    try {
      await addHRNote(detail.id, noteContent.trim());
      setNoteContent('');
      await loadData();
    } catch (err) {
      alert('Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRunScreening = async () => {
    if (!detail?.id) return;
    setScreeningLoading(true);
    try {
      await triggerScreening(detail.id);
      await loadData();
    } catch (err) {
      alert('Screening execution failed');
    } finally {
      setScreeningLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-slate-300">
          Loading candidate details...
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-slate-300 max-w-md text-center space-y-4">
          <p className="text-rose-400 font-medium">{error || 'Data not found'}</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const latestScreening = detail.screening_runs?.[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm overflow-hidden animate-fadeIn">
      <div className="w-full max-w-4xl bg-slate-950 border-l border-slate-800 h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/30">
              {detail.candidate.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{detail.candidate.full_name}</h2>
                <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                  {detail.candidate.candidate_code}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Applied for <span className="text-slate-200 font-medium">{detail.job?.title || 'General Pool'}</span> ({detail.job?.job_code}) via {detail.source}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-8 flex-1">
          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</span>
              <p className="text-sm font-medium text-slate-200 truncate">{detail.candidate.email}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone</span>
              <p className="text-sm font-medium text-slate-200">{detail.candidate.phone || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Location</span>
              <p className="text-sm font-medium text-slate-200">{detail.candidate.current_location || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500 flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> Experience</span>
              <p className="text-sm font-medium text-slate-200">{detail.candidate.total_experience != null ? `${detail.candidate.total_experience} yrs` : 'N/A'}</p>
            </div>
          </div>

          {/* Skills */}
          {detail.candidate.skills && detail.candidate.skills.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detected Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {detail.candidate.skills.map((skill, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-md text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section: Rules-Based Screening Assessment */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" /> Job-Specific Screening Run
                </h3>
                <p className="text-xs text-slate-400">
                  Automated rules-based evaluation against job criteria (Rules Engine v1 — Not AI).
                </p>
              </div>

              {detail.id && (
                <button
                  onClick={handleRunScreening}
                  disabled={screeningLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" /> {screeningLoading ? 'Running...' : 'Run Screening'}
                </button>
              )}
            </div>

            {latestScreening ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-xs text-slate-500 uppercase font-semibold">Recommendation</span>
                    <div className="mt-1">
                      {latestScreening.recommendation === 'SHORTLIST' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> SHORTLIST
                        </span>
                      )}
                      {latestScreening.recommendation === 'REVIEW' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> MANUAL REVIEW
                        </span>
                      )}
                      {latestScreening.recommendation === 'NOT_MATCHED' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> NOT MATCHED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-500">Evaluated On</span>
                    <p className="text-xs text-slate-300 font-mono">{new Date(latestScreening.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Criterion breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase">Criterion Results</h4>
                  <div className="space-y-2">
                    {latestScreening.criterion_results.map((item, idx) => (
                      <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start justify-between gap-4 text-xs">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            {item.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            )}
                            {item.criterion}
                          </div>
                          <p className="text-slate-400">{item.details}</p>
                        </div>
                        <div className="font-mono font-medium text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                          {item.score}/{item.max_score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full Rationale */}
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase">Full Rationale</h4>
                  <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap">
                    {latestScreening.rationale}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">
                No screening run recorded yet for this application. Click "Run Screening" above.
              </div>
            )}
          </div>

          {/* Section: HR Decision Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-400" /> Recruiter Decision & Audit Trail
            </h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Optional decision note / rationale..."
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDecision('Shortlisted')}
                  disabled={submittingDecision || !detail.id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-4 h-4" /> Shortlist
                </button>
                <button
                  onClick={() => handleDecision('UnderReview')}
                  disabled={submittingDecision || !detail.id}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Clock className="w-4 h-4" /> Under Review
                </button>
                <button
                  onClick={() => handleDecision('Rejected')}
                  disabled={submittingDecision || !detail.id}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>

            {/* Decision Timeline */}
            {detail.hr_decisions && detail.hr_decisions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-400 uppercase">Decision History</h4>
                <div className="space-y-2">
                  {detail.hr_decisions.map((d) => (
                    <div key={d.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-200">{d.decision}</span> by <span className="text-indigo-400">{d.decided_by}</span>
                        {d.reason && <p className="text-slate-400 mt-0.5">{d.reason}</p>}
                      </div>
                      <span className="text-slate-500 text-[11px] font-mono">{new Date(d.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: Resume & Application Form Payload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Resume Info */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Versioned Resume
              </h3>

              {detail.resume ? (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200 truncate max-w-[200px]">{detail.resume.original_filename}</span>
                    <a
                      href={`/api/candidates/${detail.candidate.id}/resumes/${detail.resume.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Size: {(detail.resume.file_size / 1024).toFixed(1)} KB | Status: {detail.resume.processing_status}
                  </div>
                  {detail.resume.extracted_text && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-indigo-400 text-[11px] font-medium">View Extracted Text</summary>
                      <pre className="mt-2 p-2 bg-slate-900 rounded text-[11px] font-mono text-slate-400 max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {detail.resume.extracted_text}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No resume file attached to this application.</p>
              )}
            </div>

            {/* Application Answers */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" /> Submitted Form Answers
              </h3>

              {detail.answers_payload && Object.keys(detail.answers_payload).length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {Object.entries(detail.answers_payload).map(([q, a], idx) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs space-y-0.5">
                      <span className="font-medium text-slate-400 block">{q}</span>
                      <p className="text-slate-200 font-mono">{String(a)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No custom form answers payload submitted.</p>
              )}
            </div>
          </div>

          {/* Section: HR Notes */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" /> Recruiter Internal Notes
            </h3>

            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                placeholder="Add an internal note about this candidate..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={submittingNote || !noteContent.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs transition-colors disabled:opacity-50"
              >
                Add Note
              </button>
            </form>

            {detail.notes && detail.notes.length > 0 && (
              <div className="space-y-2">
                {detail.notes.map((n) => (
                  <div key={n.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-indigo-300">{n.created_by}</span>
                      <span className="font-mono text-[11px]">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-200">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateDetailModal;
