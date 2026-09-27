import { Link } from 'react-router-dom';
import type { NavigationItem } from '../types/navigation';
import { Tooltip } from './Tooltip';
export function SidebarItem({ item, isActive, collapsed = false, onClick }: { item: NavigationItem; isActive: boolean; collapsed?: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  const content = <Link to={item.path} onClick={onClick} aria-current={isActive ? 'page' : undefined} aria-label={collapsed ? item.label : undefined} className={`sidebar-link ${isActive ? 'is-active' : ''} ${collapsed ? 'is-collapsed' : ''}`}><Icon className="w-[18px] h-[18px] stroke-[1.65]" aria-hidden="true" />{!collapsed && <span>{item.label}</span>}{isActive && !collapsed && <span className="nav-active-dot" />}</Link>;
  return collapsed ? <Tooltip content={item.label}>{content}</Tooltip> : content;
}
