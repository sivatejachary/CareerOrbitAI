import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  Search, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Globe, 
  FileSpreadsheet, 
  UserCheck
} from 'lucide-react';
import { fetchApplications, fetchCandidates, submitHRDecision } from '../../api/candidatesApi';
import { Candidate, JobApplicationItem } from '../../types/candidate';
import CandidateDetailModal from './CandidateDetailModal';

export const CandidatesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'applications' | 'candidates'>('applications');
  
  // Applications state
  const [applications, setApplications] = useState<JobApplicationItem[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsTotal, setAppsTotal] = useState(0);
  const [appsPage] = useState(1);
  const [appsSearch, setAppsSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // Candidates state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candsLoading, setCandsLoading] = useState(true);
  const [candsTotal, setCandsTotal] = useState(0);
  const [candsPage] = useState(1);
  const [candsSearch, setCandsSearch] = useState('');

  // Detail Modal / Drawer state
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const loadApplications = async () => {
    setAppsLoading(true);
    try {
      const data = await fetchApplications({
        search: appsSearch,
        status: statusFilter,
        source: sourceFilter,
        page: appsPage,
        page_size: 15
      });
      setApplications(data.items);
      setAppsTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setAppsLoading(false);
    }
  };

  const loadCandidates = async () => {
    setCandsLoading(true);
    try {
      const data = await fetchCandidates({
        search: candsSearch,
        page: candsPage,
        page_size: 15
      });
      setCandidates(data.items);
      setCandsTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setCandsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'applications') {
      loadApplications();
    } else {
      loadCandidates();
    }
  }, [activeTab, appsPage, appsSearch, statusFilter, sourceFilter, candsPage, candsSearch]);

  const handleQuickDecision = async (e: React.MouseEvent, appId: string, decision: 'Shortlisted' | 'Rejected') => {
    e.stopPropagation();
    try {
      await submitHRDecision(appId, decision);
      loadApplications();
    } catch (err) {
      alert('Failed to update decision');
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Shortlisted':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Shortlisted</span>;
      case 'Rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>;
      case 'UnderReview':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Under Review</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">Submitted</span>;
    }
  };

  const renderRecommendationBadge = (rec?: string | null) => {
    if (!rec) return <span className="text-slate-500 text-xs">—</span>;
    switch (rec) {
      case 'SHORTLIST':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40" title="Rules-Based Assessment (Not AI)"><ShieldCheck className="w-3 h-3 mr-1 text-emerald-400" /> Match: Shortlist</span>;
      case 'REVIEW':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40" title="Rules-Based Assessment (Not AI)"><AlertCircle className="w-3 h-3 mr-1 text-amber-400" /> Match: Review</span>;
      case 'NOT_MATCHED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/40" title="Rules-Based Assessment (Not AI)"><XCircle className="w-3 h-3 mr-1 text-rose-400" /> Not Matched</span>;
      default:
        return <span className="text-slate-400 text-xs">{rec}</span>;
    }
  };

  const renderSourceBadge = (source: string) => {
    switch (source) {
      case 'GoogleForms':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><FileSpreadsheet className="w-3 h-3 mr-1" /> Google Form</span>;
      case 'CareerPage':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Globe className="w-3 h-3 mr-1" /> Career Page</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-700/50 text-slate-300"><Users className="w-3 h-3 mr-1" /> Direct</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-400" /> Candidates & Applications
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Centralized candidate database, multi-channel application intake, and rules-based screening runs.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setActiveTab('applications')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'applications'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" /> Applications ({appsTotal})
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'candidates'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Candidate Profiles ({candsTotal})
          </button>
        </div>
      </div>

      {/* Tab: Applications */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate name, email, or candidate code..."
                value={appsSearch}
                onChange={(e) => setAppsSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="UnderReview">Under Review</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Rejected">Rejected</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Sources</option>
                <option value="GoogleForms">Google Forms</option>
                <option value="CareerPage">Career Page</option>
                <option value="Direct">Direct</option>
              </select>
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {appsLoading ? (
              <div className="p-8 text-center text-slate-400">Loading applications...</div>
            ) : applications.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <FileText className="w-10 h-10 mx-auto text-slate-600" />
                <p className="font-medium text-slate-300">No job applications found</p>
                <p className="text-xs text-slate-500">Applications received from Google Forms or Career Page will appear here automatically.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">Candidate</th>
                      <th className="px-5 py-3">Job Applied</th>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3">Rules Screening</th>
                      <th className="px-5 py-3">HR Status</th>
                      <th className="px-5 py-3">Received</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {applications.map((app) => (
                      <tr 
                        key={app.id} 
                        onClick={() => setSelectedAppId(app.id)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-white">{app.candidate_name}</div>
                          <div className="text-xs text-slate-400">{app.candidate_email}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{app.candidate_code}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-200">{app.job_title}</div>
                          <div className="text-xs text-slate-500 font-mono">{app.job_code}</div>
                        </td>
                        <td className="px-5 py-4">
                          {renderSourceBadge(app.source)}
                        </td>
                        <td className="px-5 py-4">
                          {renderRecommendationBadge(app.screening_recommendation)}
                        </td>
                        <td className="px-5 py-4">
                          {renderStatusBadge(app.status)}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {new Date(app.received_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleQuickDecision(e, app.id, 'Shortlisted')}
                              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-md transition-colors"
                              title="Quick Shortlist"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleQuickDecision(e, app.id, 'Rejected')}
                              className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-md transition-colors"
                              title="Quick Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSelectedAppId(app.id)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition-colors"
                              title="View Details"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Candidates */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate by name, email, or candidate code..."
                value={candsSearch}
                onChange={(e) => setCandsSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {candsLoading ? (
              <div className="p-8 text-center text-slate-400">Loading candidate profiles...</div>
            ) : candidates.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Users className="w-10 h-10 mx-auto text-slate-600" />
                <p className="font-medium text-slate-300">No canonical candidates found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">Candidate</th>
                      <th className="px-5 py-3">Location & Experience</th>
                      <th className="px-5 py-3">Skills</th>
                      <th className="px-5 py-3">First Source</th>
                      <th className="px-5 py-3">Applications</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {candidates.map((cand) => (
                      <tr key={cand.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-medium text-white">{cand.full_name}</div>
                          <div className="text-xs text-slate-400">{cand.email}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{cand.candidate_code}</div>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <div className="text-slate-200">{cand.current_location || 'Not specified'}</div>
                          <div className="text-slate-400">{cand.total_experience != null ? `${cand.total_experience} yrs exp` : 'Exp not specified'}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(cand.skills || []).slice(0, 4).map((s, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded text-[11px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                {s}
                              </span>
                            ))}
                            {(cand.skills || []).length > 4 && (
                              <span className="text-[11px] text-slate-500 self-center">+{cand.skills.length - 4} more</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {renderSourceBadge(cand.first_source || 'Direct')}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span className="px-2 py-1 rounded bg-slate-800 text-slate-200 font-medium">
                            {cand.total_applications || 1} app(s)
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => setSelectedCandidateId(cand.id)}
                            className="px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors border border-indigo-500/20"
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Candidate Application Detail Modal */}
      {(selectedAppId || selectedCandidateId) && (
        <CandidateDetailModal
          applicationId={selectedAppId}
          candidateId={selectedCandidateId}
          onClose={() => {
            setSelectedAppId(null);
            setSelectedCandidateId(null);
            loadApplications();
            loadCandidates();
          }}
        />
      )}
    </div>
  );
};
