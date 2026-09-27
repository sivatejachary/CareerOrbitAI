import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { workspaceFetch, formatDate, safeMeetingUrl } from '../api/workspaceApi';
import { EmptyState, ErrorState, LoadingState, PageHeading, Pagination, StatusBadge, PersonAvatar } from './ui/Workspace';
interface Interview { id: string; candidate_id: string; candidate_name: string | null; job_title: string | null; start_time: string; timezone: string; interviewer: string; format: string; meeting_link: string | null; booking_reference: string; }
export function InterviewsPage() {
  const [data, setData] = useState<{ items: Interview[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setError(''); setData(null); try { setData(await workspaceFetch(`/workspace/interviews?page=${page}`)); } catch (e) { setError((e as Error).message); } }, [page]);
  useEffect(() => { void load(); }, [load]);
  return <div className="workspace-page"><PageHeading title="Interviews" description="Booked interviews, interviewer details and saved meeting links. Times below use your local timezone." />
    {error ? <ErrorState message={error} onRetry={load} /> : !data ? <LoadingState label="Loading interviews" /> : <section className="ui-panel">{data.items.length ? <><div className="overflow-x-auto"><table className="ui-table"><caption className="sr-only">Booked interviews</caption><thead><tr>{['Candidate', 'Date and time', 'Interviewer', 'Format', 'Meeting'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td><div className="candidate-identity"><PersonAvatar name={row.candidate_name || "Candidate"} /><div><Link to={`/candidates/${row.candidate_id}`}>{row.candidate_name || 'View candidate'}</Link><div className="text-xs text-text-secondary mt-1">{row.job_title || 'Interview'}</div></div></div></td><td className="whitespace-nowrap">{formatDate(row.start_time, true)}</td><td>{row.interviewer}</td><td><StatusBadge value={row.format} /></td><td>{safeMeetingUrl(row.meeting_link) ? <a href={safeMeetingUrl(row.meeting_link)} target="_blank" rel="noopener noreferrer" className="ui-button ui-button-secondary">Join interview</a> : <span className="text-text-secondary text-xs">No meeting link saved</span>}</td></tr>)}</tbody></table></div><Pagination page={page} total={data.total} pageSize={20} onChange={setPage} /></> : <EmptyState title="No booked interviews" description="Interviews booked through your hiring workflow will appear here." action={<Link to="/workflow" className="ui-button ui-button-secondary">View hiring workflows</Link>} />}</section>}
  </div>;
}
