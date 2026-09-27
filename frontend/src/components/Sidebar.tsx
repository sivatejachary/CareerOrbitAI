import { useLocation } from 'react-router-dom';
import { Brand } from './Brand';
import { SidebarItem } from './SidebarItem';
import { MAIN_NAVIGATION_ITEMS, ADMIN_NAVIGATION_ITEMS } from '../config/navigation';

interface SidebarProps { collapsed?: boolean; className?: string; onNavigate?: () => void; }
const groups = [
  { label: 'Workspace', ids: ['dashboard'] },
  { label: 'Hiring', ids: ['jobs', 'candidates', 'interviews'] },
  { label: 'Automation', ids: ['workflow', 'ai-calling', 'ai-interviews'] },
];
export function Sidebar({ collapsed = false, className = '', onNavigate }: SidebarProps) {
  const { pathname } = useLocation();
  return <aside className={`bg-sidebar border-r border-border-subtle flex flex-col h-full ${collapsed ? 'w-[80px] px-2' : 'w-[240px] px-3'} py-5 ${className}`} aria-label="Sidebar navigation">
    <div className={`flex items-center mb-8 ${collapsed ? 'justify-center' : 'px-2'}`}><Brand collapsed={collapsed} onClick={onNavigate} /></div>
    <nav aria-label="Main navigation" className="flex-1 overflow-y-auto space-y-6 custom-scrollbar">{groups.map(group => <div key={group.label}>{!collapsed && <h2 className="px-3 mb-2 text-[11px] font-semibold text-text-secondary tracking-wider uppercase">{group.label}</h2>}<ul className="space-y-1">{group.ids.map(id => MAIN_NAVIGATION_ITEMS.find(item => item.id === id)!).map(item => <li key={item.id}><SidebarItem item={item} isActive={pathname === item.path || pathname.startsWith(`${item.path}/`)} collapsed={collapsed} onClick={onNavigate} /></li>)}</ul></div>)}</nav>
    <nav aria-label="Workspace settings" className="border-t border-border-subtle mt-6 pt-4"><ul>{ADMIN_NAVIGATION_ITEMS.map(item => <li key={item.id}><SidebarItem item={item} isActive={pathname.startsWith(item.path)} collapsed={collapsed} onClick={onNavigate} /></li>)}</ul></nav>
  </aside>;
}
