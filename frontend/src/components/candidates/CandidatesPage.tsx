import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { fetchApplications, fetchCandidates, submitHRDecision } from '../../api/candidatesApi';
import type { Candidate, JobApplicationItem } from '../../types/candidate';
import CandidateDetailModal from './CandidateDetailModal';
import { Button, EmptyState, ErrorState, LoadingState, PageHeading, Pagination, StatusBadge } from '../ui/Workspace';
import { formatDate } from '../../api/workspaceApi';

export const CandidatesPage = () => {
  const navigate = useNavigate();
  const { candidateId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'profiles' ? 'profiles' : 'applications';
  const search = params.get('search') || '';
  const status = params.get('status') || '';
  const source = params.get('source') || '';
  const sort = params.get('sort') === 'name' ? 'name' : 'newest';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [applications, setApplications] = useState<JobApplicationItem[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params); next.delete('page');
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    setSelected(new Set()); setNotice(''); setParams(next, { replace: true });
  };
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        if (tab === 'applications') {
          const res = await fetchApplications({ search, status, source, page, page_size: 15, sort });
          if (!cancelled) { setApplications(res.items); setTotal(res.total); }
        } else {
          const res = await fetchCandidates({ search, page, page_size: 15, sort });
          if (!cancelled) { setCandidates(res.items); setTotal(res.total); }
        }
      } catch { if (!cancelled) setError('Unable to load candidates. Please try again.'); }
      finally { if (!cancelled) setLoading(false); }
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tab, search, status, source, page, sort, reload]);
  const decide = async (decision: 'Shortlisted' | 'UnderReview') => {
    setBusy(true); setNotice('');
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map(id => submitHRDecision(id, decision)));
    const failed = ids.filter((_, i) => results[i].status === 'rejected');
    setSelected(new Set(failed));
    setNotice(`${ids.length - failed.length} application(s) updated.${failed.length ? ` ${failed.length} could not be updated; they remain selected for retry.` : ''}`);
    setBusy(false); setReload(value => value + 1);
  };
  const selectOne = (id: string) => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <div className="workspace-page"><PageHeading title="Candidates" description="Review applications, compare qualifications and move hiring decisions forward." actions={<Link className="ui-button ui-button-secondary" to="/ai-calling">AI calling</Link>} />
    <div className="flex gap-6 border-b border-border-subtle" role="group" aria-label="Candidate views">{[['applications', 'Applications'], ['profiles', 'Candidate profiles']].map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} disabled={busy} onClick={() => update({ tab: key, search: '', status: '', source: '' })} className={`pb-3 text-sm font-medium border-b-2 ${tab === key ? 'border-interactive-blue text-interactive-blue' : 'border-transparent text-text-secondary'}`}>{label}</button>)}</div>
    <div className="filter-bar"><div className="filter-search"><Search size={16} aria-hidden="true" /><input className="ui-input" aria-label="Search candidates" placeholder="Search by name, email or candidate code" value={search} disabled={busy} onChange={e => update({ search: e.target.value })} /></div>
      {tab === 'applications' && <><select className="ui-input" aria-label="Application status" disabled={busy} value={status} onChange={e => update({ status: e.target.value })}><option value="">All statuses</option>{['Submitted', 'UnderReview', 'Shortlisted', 'Rejected', 'Withdrawn'].map(value => <option key={value} value={value}>{value === 'UnderReview' ? 'Under review' : value}</option>)}</select><select className="ui-input" aria-label="Application source" disabled={busy} value={source} onChange={e => update({ source: e.target.value })}><option value="">All sources</option><option value="CareerPage">Career page</option><option value="GoogleForms">Google Forms</option><option value="Manual">Manual</option></select></>}
      <select className="ui-input" aria-label="Sort candidates" disabled={busy} value={sort} onChange={e => update({ sort: e.target.value })}><option value="newest">Newest first</option><option value="name">Name A–Z</option></select>
    </div>
    {notice && <div role="status" className="ui-panel p-4 text-sm">{notice}</div>}
    {selected.size > 0 && tab === 'applications' && <div className="ui-panel p-3 flex flex-wrap items-center gap-3"><span className="text-sm font-medium mr-auto">{selected.size} selected</span><Button disabled={busy} onClick={() => decide('UnderReview')}>Move to review</Button><Button variant="primary" disabled={busy} onClick={() => decide('Shortlisted')}>{busy ? 'Updating…' : 'Shortlist selected'}</Button><Button disabled={busy} onClick={() => setSelected(new Set())}>Clear</Button></div>}
    {error ? <ErrorState message={error} onRetry={() => setReload(v => v + 1)} /> : loading ? <LoadingState label="Loading candidates" /> : <section className="ui-panel">
      {total === 0 ? <EmptyState title={search || status || source ? 'No matching candidates' : 'No candidates yet'} description={search || status || source ? 'Try another search or clear your filters.' : 'Publish a job to start receiving candidates.'} action={search || status || source ? <Button onClick={() => update({ search: '', status: '', source: '' })}>Clear filters</Button> : <Link to="/jobs" className="ui-button ui-button-primary">View jobs</Link>} /> : <>
      <div className="overflow-x-auto"><table className="ui-table"><caption className="sr-only">{tab === 'applications' ? 'Job applications' : 'Candidate profiles'}</caption>
        {tab === 'applications' ? <><thead><tr><th scope="col"><input type="checkbox" aria-label="Select all applications on this page" disabled={busy} checked={applications.length > 0 && applications.every(a => selected.has(a.id))} onChange={e => setSelected(e.target.checked ? new Set(applications.map(a => a.id)) : new Set())} /></th>{['Candidate', 'Applied job', 'Status', 'Screening', 'Received'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{applications.map(app => <tr key={app.id}><td><input type="checkbox" disabled={busy} aria-label={`Select ${app.candidate_name}`} checked={selected.has(app.id)} onChange={() => selectOne(app.id)} /></td><td><button className="text-interactive-blue font-semibold text-left" onClick={() => setSelectedAppId(app.id)}>{app.candidate_name}</button><p className="text-xs text-text-secondary mt-1">{app.candidate_email}</p></td><td><Link to={`/jobs/${app.job_id}`}>{app.job_title}</Link><p className="text-xs text-text-secondary mt-1">{app.source === 'CareerPage' ? 'Career page' : app.source}</p></td><td><StatusBadge value={app.status} /></td><td>{app.screening_recommendation ? <StatusBadge value={app.screening_recommendation} /> : <span className="text-xs text-text-secondary">Not screened</span>}</td><td className="whitespace-nowrap text-xs text-text-secondary">{formatDate(app.received_at)}</td></tr>)}</tbody></> : <><thead><tr>{['Candidate', 'Experience', 'Skills', 'Applications', 'Profile'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{candidates.map(candidate => <tr key={candidate.id}><td><Link to={`/candidates/${candidate.id}?${params}`}>{candidate.full_name}</Link><p className="text-xs text-text-secondary mt-1">{candidate.email}</p></td><td><p>{candidate.total_experience != null ? `${candidate.total_experience} years` : 'Not provided'}</p><p className="text-xs text-text-secondary mt-1">{candidate.current_location}</p></td><td><div className="flex flex-wrap gap-1 max-w-xs">{candidate.skills.slice(0, 3).map(skill => <span className="status-badge status-neutral" key={skill}>{skill}</span>)}{candidate.skills.length > 3 && <span className="text-xs text-text-secondary">+{candidate.skills.length - 3}</span>}</div></td><td>{candidate.total_applications ?? 0}</td><td><Link className="ui-button ui-button-secondary" to={`/candidates/${candidate.id}?${params}`}>View profile</Link></td></tr>)}</tbody></>}
      </table></div><Pagination page={page} total={total} pageSize={15} onChange={next => update({ page: String(next) })} /></>}
    </section>}
    {(selectedAppId || candidateId) && <CandidateDetailModal applicationId={selectedAppId} candidateId={candidateId} onClose={() => { setSelectedAppId(null); if (candidateId) navigate(`/candidates?${params}`); setReload(v => v + 1); }} />}
  </div>;
};
