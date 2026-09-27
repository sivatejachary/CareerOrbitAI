import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Building2, ChevronsUpDown } from 'lucide-react';
import { Brand } from './Brand';
import { SidebarItem } from './SidebarItem';
import { MAIN_NAVIGATION_ITEMS, ADMIN_NAVIGATION_ITEMS } from '../config/navigation';
const groups = [
  { label: 'Workspace', ids: ['dashboard', 'jobs', 'candidates', 'interviews'] },
  { label: 'Automation', ids: ['workflow', 'ai-calling', 'ai-interviews'] },
];
export function Sidebar({ collapsed = false, className = '', onNavigate }: { collapsed?: boolean; className?: string; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return <aside className={`workspace-sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${className}`} aria-label="Sidebar navigation">
    <Brand collapsed={collapsed} onClick={onNavigate} />
    <Link to="/settings" onClick={onNavigate} className="workspace-switch" aria-label="Workspace settings"><span className="workspace-monogram"><Building2 size={17} /></span>{!collapsed && <><span><strong>Recruiting workspace</strong><small>Team workspace</small></span><ChevronsUpDown size={14} /></>}</Link>
    <nav aria-label="Main navigation" className="sidebar-main custom-scrollbar">{groups.map(group => <div className="sidebar-group" key={group.label}>{!collapsed && <h2>{group.label}</h2>}<ul>{group.ids.map(id => MAIN_NAVIGATION_ITEMS.find(item => item.id === id)!).map(item => <li key={item.id}><SidebarItem item={item} isActive={pathname === item.path || pathname.startsWith(`${item.path}/`)} collapsed={collapsed} onClick={onNavigate} /></li>)}</ul></div>)}</nav>
    {!collapsed && <div className="sidebar-note"><span className="sidebar-note-mark" aria-hidden="true">↗</span><p>Make room for<br /><strong>your next great hire.</strong></p><Link to="/jobs/create" onClick={onNavigate}>Create a new role <ArrowUpRight size={14} /></Link></div>}
    <nav className="sidebar-bottom" aria-label="Workspace settings">{ADMIN_NAVIGATION_ITEMS.map(item => <SidebarItem key={item.id} item={item} isActive={pathname.startsWith(item.path)} collapsed={collapsed} onClick={onNavigate} />)}</nav>
    {!collapsed && <div className="sidebar-signature"><span className="signature-dot" />CareerOrbitAI <span>Hiring, thoughtfully.</span></div>}
  </aside>;
}
