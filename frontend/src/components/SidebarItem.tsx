import React from 'react';
import { Link } from 'react-router-dom';
import { NavigationItem } from '../types/navigation';
import { Tooltip } from './Tooltip';

interface SidebarItemProps {
  item: NavigationItem;
  isActive: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  item,
  isActive,
  collapsed = false,
  onClick,
}) => {
  const Icon = item.icon;

  const content = (
    <Link
      to={item.path}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`
        relative flex items-center h-[44px] rounded-item transition-colors duration-150 group
        ${collapsed ? 'w-11 justify-center px-0' : 'w-full px-3.5 gap-3'}
        ${
          isActive
            ? 'bg-nav-activeBg text-nav-activeText font-semibold'
            : 'text-text-secondary hover:bg-nav-hover hover:text-text-primary font-medium'
        }
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-blue
      `}
    >
      {/* Restrained Inset Active Indicator */}
      {isActive && (
        <span
          className={`absolute left-0 top-2 bottom-2 w-[3.5px] bg-interactive-blue rounded-r-full ${
            collapsed ? '-left-[1px]' : ''
          }`}
          aria-hidden="true"
        />
      )}

      {/* Navigation Icon */}
      <Icon
        className={`flex-shrink-0 w-5 h-5 transition-colors duration-150 ${
          isActive ? 'text-nav-activeText' : 'text-text-secondary group-hover:text-text-primary'
        }`}
        aria-hidden="true"
      />

      {/* Label (Hidden on collapsed rail) */}
      {!collapsed && (
        <span className="text-sm truncate leading-tight select-none">
          {item.label}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip content={item.label}>
        {content}
      </Tooltip>
    );
  }

  return content;
};
