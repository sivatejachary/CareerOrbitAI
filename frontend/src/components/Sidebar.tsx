import React from 'react';
import { useLocation } from 'react-router-dom';
import { Brand } from './Brand';
import { SidebarItem } from './SidebarItem';
import { MAIN_NAVIGATION_ITEMS, ADMIN_NAVIGATION_ITEMS } from '../config/navigation';

interface SidebarProps {
  collapsed?: boolean; // True for tablet rail (80px)
  className?: string;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  className = '',
  onNavigate,
}) => {
  const location = useLocation();

  return (
    <aside
      className={`
        bg-sidebar border-r border-border-subtle flex flex-col h-full select-none
        ${collapsed ? 'w-[80px] items-center px-2 py-5' : 'w-[256px] px-4 py-5'}
        ${className}
      `}
      aria-label="Sidebar Navigation"
    >
      {/* Brand Header */}
      <div className={`flex items-center mb-6 ${collapsed ? 'justify-center w-full' : 'px-2'}`}>
        <Brand collapsed={collapsed} onClick={onNavigate} />
      </div>

      {/* Nav scroll container ensuring reachable admin section on short viewports */}
      <div className="flex-1 flex flex-col justify-between overflow-y-auto custom-scrollbar w-full">
        {/* Main Navigation Group */}
        <nav aria-label="Main Navigation" className="w-full">
          <ul className="space-y-1 w-full list-none p-0 m-0">
            {MAIN_NAVIGATION_ITEMS.map((item) => {
              const isActive = item.path === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(item.path);

              return (
                <li key={item.id} className={collapsed ? 'flex justify-center my-1' : ''}>
                  <SidebarItem
                    item={item}
                    isActive={isActive}
                    collapsed={collapsed}
                    onClick={onNavigate}
                  />
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Administration Group */}
        <div className="pt-6 mt-6 border-t border-border-subtle w-full">
          {!collapsed ? (
            <h2 className="px-3 text-[12px] font-medium text-text-secondary uppercase tracking-wider mb-2 select-none">
              Administration
            </h2>
          ) : (
            <div className="h-4" aria-hidden="true" />
          )}
          <nav aria-label="Administration Navigation" className="w-full">
            <ul className="space-y-1 w-full list-none p-0 m-0">
              {ADMIN_NAVIGATION_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.id} className={collapsed ? 'flex justify-center my-1' : ''}>
                    <SidebarItem
                      item={item}
                      isActive={isActive}
                      collapsed={collapsed}
                      onClick={onNavigate}
                    />
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </aside>
  );
};
