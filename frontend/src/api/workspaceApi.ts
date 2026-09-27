export async function workspaceFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } });
  if (!res.ok) throw new Error(res.status === 401 ? 'Your session has expired. Please sign in again.' : 'The request could not be completed. Please try again.');
  return res.json();
}
export interface Overview {
  organization: string;
  metrics: Record<'active_jobs' | 'candidates' | 'shortlisted' | 'interviews' | 'calls' | 'pending_actions', number>;
  pipeline: { stage: string; count: number }[];
  tasks: { id: string; title: string; execution_id: string }[];
  activity: { id: string; action: string; resource_type: string; resource_id: string; created_at: string }[];
}
export function formatDate(value: string, withTime = false) {
  // Backend UTC datetimes can be returned without an offset by SQLite.
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' as const } : {}) }).format(date);
}
export function safeMeetingUrl(url: string | null) {
  if (!url) return undefined;
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined; } catch { return undefined; }
}
