import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, CheckCheck, Clock3, Plus, RefreshCw, Users, Phone, Workflow } from 'lucide-react';
import { workspaceFetch, formatDate, type Overview } from '../api/workspaceApi';
import { Button, EmptyState, ErrorState, LoadingState } from './ui/Workspace';

const metrics = [
  { key: 'active_jobs', label: 'Open roles', description: 'Positions accepting applications', to: '/jobs', icon: BriefcaseBusiness, tone: 'sage' },
  { key: 'candidates', label: 'Talent pool', description: 'People in your workspace', to: '/candidates?tab=profiles', icon: Users, tone: 'blue' },
  { key: 'shortlisted', label: 'Shortlisted', description: 'Ready for the next conversation', to: '/candidates?status=Shortlisted', icon: CheckCheck, tone: 'sand' },
  { key: 'interviews', label: 'Upcoming interviews', description: 'Your next candidate conversations', to: '/interviews', icon: CalendarDays, tone: 'lilac' },
] as const;
const stages = [
  { label: 'Applied', keys: ['APPLIED'], color: '#C9D8D2' },
  { label: 'Screening', keys: ['SCREENING'], color: '#9DBCAF' },
  { label: 'Shortlisted', keys: ['SHORTLISTED'], color: '#679B82' },
  { label: 'AI conversation', keys: ['AI_CALL_SCHEDULED', 'AI_CALL_DONE'], color: '#427B62' },
  { label: 'HR review', keys: ['HR_REVIEW'], color: '#2B604A' },
  { label: 'Offered', keys: ['OFFERED'], color: '#193E30' },
];
interface ScheduledInterview { id: string; candidate_id: string; candidate_name: string | null; job_title: string | null; start_time: string; format: string; }
const parseTime = (value: string) => new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [interviews, setInterviews] = useState<ScheduledInterview[]>([]);
  const [agendaError, setAgendaError] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setError(''); setRefreshing(true); setAgendaError(false);
    const [overview, agenda] = await Promise.allSettled([
      workspaceFetch<Overview>('/workspace/overview'),
      workspaceFetch<{items: ScheduledInterview[]}>('/workspace/interviews?upcoming=true&size=3'),
    ]);
    if (overview.status === 'fulfilled') setData(overview.value); else setError(overview.reason instanceof Error ? overview.reason.message : 'Unable to load the workspace.');
    if (agenda.status === 'fulfilled') setInterviews(agenda.value.items); else setAgendaError(true);
    setRefreshing(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const total = data?.pipeline.reduce((sum, row) => sum + row.count, 0) || 0;
  const countFor = (keys: string[]) => data?.pipeline.filter(row => keys.includes(row.stage)).reduce((sum, row) => sum + row.count, 0) || 0;
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());
  return <div className="workspace-page dashboard-page">
    <div className="dashboard-heading"><div><div className="eyebrow"><span />YOUR HIRING WORKSPACE</div><h1>Good people. Great possibilities.</h1><p>Here’s where your hiring stands{data ? ` at ${data.organization}` : ''}.</p></div><div className="dashboard-heading-actions"><span className="today-label"><CalendarDays size={14} />{today}</span><div className="page-actions"><Button onClick={load} disabled={refreshing} aria-label="Refresh dashboard"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></Button><Link to="/jobs/create" className="ui-button ui-button-primary"><Plus size={16} />Create a role</Link></div></div></div>
    {error ? <ErrorState message={error} onRetry={load} /> : !data ? <LoadingState /> : <>
      <div className="overview-metrics">{metrics.map(({ key, label, description, to, icon: Icon, tone }) => <Link key={key} to={to} className="overview-metric"><div className="metric-top"><span className={`metric-icon tone-${tone}`}><Icon size={18} strokeWidth={1.65} /></span><ArrowUpRight size={16} className="metric-arrow" /></div><span className="metric-label">{label}</span><strong>{data.metrics[key].toLocaleString()}</strong><span className="metric-description">{description}</span></Link>)}</div>
      <div className="dashboard-columns">
        <section className="ui-panel pipeline-panel"><div className="section-heading"><div><h2>Talent, in motion</h2><p>Every application. A clear next step.</p></div><Link to="/candidates" className="quiet-link">View pipeline <ArrowUpRight size={15} /></Link></div>
          {total === 0 ? <EmptyState title="Your next chapter starts here" description="Create an open role and your first applications will appear in this pipeline." action={<Link className="ui-button ui-button-secondary" to="/jobs/create">Create a role <ArrowRight size={15} /></Link>} /> : <div className="pipeline-body"><div className="pipeline-summary"><div><strong>{total}</strong><span>Total applications</span></div><span className="subtle-label">Current distribution</span></div><div className="pipeline-spectrum" aria-hidden="true">{[...data.pipeline].sort((a, b) => { const order = stages.flatMap(stage => stage.keys); return (order.indexOf(a.stage) === -1 ? 99 : order.indexOf(a.stage)) - (order.indexOf(b.stage) === -1 ? 99 : order.indexOf(b.stage)); }).map(row => <div key={row.stage} style={{flex: row.count, background: stages.find(s => s.keys.includes(row.stage))?.color || '#D9DEDD'}} />)}</div><ol className="pipeline-stages">{stages.map((stage, i) => { const count = countFor(stage.keys); return <li key={stage.label}><span className="stage-number">0{i + 1}</span><span className="stage-label">{stage.label}</span><div className="stage-track"><div style={{width: `${count / total * 100}%`, background: stage.color}} /></div><strong>{count}</strong><span className="stage-percentage">{Math.round(count / total * 100)}%</span></li>; })}</ol><div className="pipeline-footnote"><span><i className="legend-dot" />Each application is counted once</span><span>{countFor(['REJECTED', 'WITHDRAWN'])} closed or withdrawn</span></div></div>}
        </section>
        <section className="ui-panel agenda-panel"><div className="section-heading"><div><h2>On the calendar</h2><p>Your upcoming conversations</p></div><span className="count-pill">{data.metrics.interviews}</span></div>
          {agendaError ? <div className="p-6 text-sm text-text-secondary">Unable to load interviews. <button className="quiet-link" onClick={load}>Try again</button></div> : interviews.length ? <div className="agenda-list">{interviews.map((row, index) => <Link to={`/candidates/${row.candidate_id}`} key={row.id} className="agenda-item"><div className={`agenda-date ${index === 0 ? 'is-next' : ''}`}><span>{parseTime(row.start_time).toLocaleDateString(undefined, { month: 'short' })}</span><strong>{parseTime(row.start_time).getDate()}</strong></div><div className="agenda-detail">{index === 0 && <span className="next-label">UP NEXT</span>}<h3>{row.candidate_name || 'Candidate interview'}</h3><p>{row.job_title || 'Interview'}</p><span className="agenda-time"><Clock3 size={12} />{parseTime(row.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {row.format}</span></div><ArrowUpRight size={15} /></Link>)}</div> : <EmptyState title="A little breathing room" description="Scheduled interviews will appear here, with the details you need." />}
          <Link className="panel-footer-link" to="/interviews">View all interviews <ArrowRight size={15} /></Link>
        </section>
      </div>
      <div className="dashboard-lower">
        <section className="ui-panel activity-panel"><div className="section-heading"><div><h2>Across your workspace</h2><p>The latest from your hiring team</p></div><span className="subtle-label">Recent activity</span></div>{data.activity.length ? <ul className="activity-list">{data.activity.slice(0, 5).map(event => <li key={event.id}><span className="activity-icon"><BriefcaseBusiness size={15} /></span><div><p>{event.action}</p><span>{event.resource_type}</span></div><time dateTime={event.created_at}>{formatDate(event.created_at, true)}</time></li>)}</ul> : <EmptyState title="A fresh start" description="Your team’s hiring activity will appear here." />}</section>
        <div className="dashboard-side-stack"><section className="attention-card" id="pending-actions"><div className="attention-heading"><span className="attention-icon"><Check size={18} /></span><span>YOUR NEXT STEPS</span><span className="count-pill">{data.metrics.pending_actions}</span></div>{data.tasks.length ? <><h2>A few things need you.</h2><ul>{data.tasks.map(task => <li key={task.id}><Link to={`/workflow/executions/${task.execution_id}`}>{task.title}<ArrowUpRight size={15} /></Link></li>)}</ul></> : <><h2>You’re all caught up.</h2><p>No pending reviews or workflow tasks.<br />A little more space to focus on people.</p><Link to="/candidates" className="quiet-link">Explore your talent pool <ArrowRight size={15} /></Link></>}</section><div className="automation-links"><Link to="/ai-calling"><span className="automation-icon"><Phone size={17} /></span><span><strong>AI Calling</strong><small>{data.metrics.calls} call attempts</small></span><ArrowUpRight size={16} /></Link><Link to="/workflow"><span className="automation-icon"><Workflow size={17} /></span><span><strong>Hiring workflows</strong><small>Make every step count</small></span><ArrowUpRight size={16} /></Link></div></div>
      </div>
      <footer className="workspace-footer"><span>Thoughtful hiring starts with a clear picture.</span><span>CareerOrbitAI</span></footer>
    </>}
  </div>;
}
