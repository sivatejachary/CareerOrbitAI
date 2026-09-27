import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react';

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return <button type="button" className={`ui-button ui-button-${variant} ${className}`} {...props} />;
}
export function PageHeading({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><Inbox size={24} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{action}</div>;
}
export function ErrorState({ title = 'Unable to load this page', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return <div className="error-state" role="alert"><h2>{title}</h2>{message && <p>{message}</p>}{onRetry && <Button onClick={onRetry}><RefreshCw size={15} aria-hidden="true" />Try again</Button>}</div>;
}
export function LoadingState({ label = 'Loading workspace' }: { label?: string }) {
  return <div className="ui-panel p-6 space-y-4" role="status" aria-label={label}><span className="sr-only">{label}</span>{[64, 100, 100, 80].map((w, i) => <div key={i} className="skeleton" style={{ width: `${w}%` }} />)}</div>;
}
export function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav className="pagination" aria-label="Pagination"><span aria-live="polite">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : '0 results'}</span><div><Button aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></Button><span>Page {page} of {pages}</span><Button aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></Button></div></nav>;
}
export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase().replace(/[_ ]/g, '');
  const tone = /^(open|active|shortlisted|shortlist|succeeded|completed|conversationcompleted|hired|offered|booked)$/.test(normalized) ? 'success' : /^(failed|rejected|notmatched|expired)$/.test(normalized) ? 'error' : /^(pending|underreview|review|paused|blocked|needsreview)$/.test(normalized) ? 'warning' : 'neutral';
  const label = value.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return <span className={`status-badge status-${tone}`}>{label}</span>;
}
