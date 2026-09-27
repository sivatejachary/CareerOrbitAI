import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus, RefreshCw } from 'lucide-react';
import { workspaceFetch, formatDate, type Overview } from '../api/workspaceApi';
import { Button, EmptyState, ErrorState, LoadingState, PageHeading, StatusBadge } from './ui/Workspace';

const metrics = [
  ['active_jobs', 'Active jobs', '/jobs'], ['candidates', 'Candidate profiles', '/candidates'],
  ['shortlisted', 'Shortlisted applications', '/candidates?status=Shortlisted'],
  ['interviews', 'Upcoming interviews', '/interviews'], ['calls', 'AI call attempts', '/ai-calling'],
  ['pending_actions', 'Pending actions', '#pending-actions'],
] as const;
const stages = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'AI_CALL_SCHEDULED', 'AI_CALL_DONE', 'HR_REVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN'];
export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { setData(await workspaceFetch<Overview>('/workspace/overview')); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="workspace-page">
    <PageHeading title="Hiring overview" description={data ? `Your recruitment workspace · ${data.organization}` : 'A clear view of your hiring progress and next actions.'} actions={<><Button onClick={load} aria-label="Refresh dashboard"><RefreshCw size={15} /></Button><Link to="/jobs/create" className="ui-button ui-button-primary"><Plus size={16} />Create job</Link></>} />
    {error ? <ErrorState message={error} onRetry={load} /> : !data ? <LoadingState /> : <>
      <div className="ui-panel metric-grid">{metrics.map(([key, title, to]) => <Link key={key} to={to}><dl><dt className="flex justify-between gap-2">{title}<ArrowUpRight size={14} aria-hidden="true" /></dt><dd>{data.metrics[key].toLocaleString()}</dd></dl></Link>)}</div>
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <section className="ui-panel"><div className="section-heading"><div><h2>Hiring pipeline</h2><p className="text-xs text-text-secondary mt-1">Current stage per application</p></div><Link className="text-sm text-interactive-blue" to="/candidates">View candidates</Link></div>
          {data.pipeline.length === 0 ? <EmptyState title="Your pipeline starts here" description="Publish a job to receive applications and track their progress." action={<Link className="ui-button ui-button-secondary" to="/jobs">Manage jobs</Link>} /> : <ol className="p-5 space-y-4">{[...stages, ...data.pipeline.map(p => p.stage).filter(s => !stages.includes(s))].map(stage => {
            const count = data.pipeline.find(p => p.stage === stage)?.count || 0;
            const max = Math.max(1, ...data.pipeline.map(p => p.count));
            return <li key={stage} className="grid grid-cols-[140px_1fr_32px] items-center gap-3 text-xs"><StatusBadge value={stage} /><div className="h-1.5 bg-workspace rounded overflow-hidden" aria-hidden="true"><div className="h-full bg-interactive-blue" style={{ width: `${count / max * 100}%` }} /></div><span className="text-right tabular-nums font-semibold">{count}</span></li>;
          })}</ol>}
        </section>
        <section className="ui-panel" id="pending-actions"><div className="section-heading"><h2>Needs your attention</h2><span className="status-badge status-neutral">{data.metrics.pending_actions}</span></div>{data.tasks.length ? <ul className="divide-y divide-border-subtle">{data.tasks.map(task => <li key={task.id}><Link to={`/workflow/executions/${task.execution_id}`} className="p-5 flex justify-between gap-3 hover:bg-workspace"><span>{task.title}</span><ArrowUpRight size={16} className="shrink-0 text-text-secondary" /></Link></li>)}</ul> : <EmptyState title="No pending actions" description="Recruiter reviews and workflow tasks will appear here when they need your input." />}</section>
      </div>
      <section className="ui-panel"><div className="section-heading"><h2>Recent activity</h2><span className="text-xs text-text-secondary">Latest recorded workspace events</span></div>{data.activity.length ? <ul className="divide-y divide-border-subtle">{data.activity.map(event => <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"><div><p className="font-medium">{event.action}</p><p className="text-xs text-text-secondary mt-1">{event.resource_type}</p></div><time className="text-xs text-text-secondary" dateTime={event.created_at}>{formatDate(event.created_at, true)}</time></li>)}</ul> : <EmptyState title="No activity yet" description="Job changes and hiring events will appear as your team starts working." />}</section>
    </>}
  </div>;
}
