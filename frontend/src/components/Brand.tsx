import { Link } from 'react-router-dom';
export function Brand({ collapsed = false, className = '', onClick }: { collapsed?: boolean; className?: string; onClick?: () => void }) {
  return <Link to="/dashboard" onClick={onClick} className={`brand ${className}`} aria-label="CareerOrbitAI home">
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><rect width="34" height="34" rx="11" fill="#BBE5CB"/><ellipse cx="17" cy="17" rx="11" ry="6.5" transform="rotate(-42 17 17)" stroke="#183D32" strokeWidth="1.7"/><circle cx="17" cy="17" r="3.3" fill="#183D32"/><circle cx="24.6" cy="9.2" r="2.5" fill="#183D32" stroke="#BBE5CB" strokeWidth="1.5"/></svg>
    {!collapsed && <span>CareerOrbit<span className="brand-ai">AI</span></span>}
  </Link>;
}
