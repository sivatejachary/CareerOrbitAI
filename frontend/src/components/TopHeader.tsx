import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, ChevronRight, Search } from 'lucide-react';
import { UserMenu } from './UserMenu';
export function TopHeader({ title, onOpenMobileNav, mobileMenuTriggerRef, isMobileNavOpen }: { title: string; onOpenMobileNav: () => void; mobileMenuTriggerRef: RefObject<HTMLButtonElement | null>; isMobileNavOpen: boolean }) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const focus = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && window.innerWidth >= 768) { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);
  return <header className="workspace-header">
    <div className="header-location"><button ref={mobileMenuTriggerRef} type="button" onClick={onOpenMobileNav} aria-label="Open navigation menu" aria-expanded={isMobileNavOpen} aria-controls="mobile-navigation-drawer" className="mobile-nav-trigger"><Menu size={20} /></button><nav aria-label="Breadcrumb"><Link to="/dashboard">Workspace</Link><ChevronRight size={13} /><span>{title}</span></nav></div>
    <div className="header-tools"><form className="header-search" role="search" onSubmit={e => { e.preventDefault(); navigate(`/candidates?tab=profiles&search=${encodeURIComponent(query.trim())}`); input.current?.blur(); }}><Search size={16} /><input ref={input} aria-label="Find a candidate" placeholder="Find a candidate…" value={query} onChange={e => setQuery(e.target.value)} /><kbd>⌘ K</kbd></form><span className="header-divider" /><UserMenu /></div>
  </header>;
}
