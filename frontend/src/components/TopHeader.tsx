import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Menu, ChevronRight } from 'lucide-react';
import { UserMenu } from './UserMenu';

interface TopHeaderProps {
  title: string;
  onOpenMobileNav: () => void;
  mobileMenuTriggerRef: React.RefObject<HTMLButtonElement | null>;
  isMobileNavOpen: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  onOpenMobileNav,
  mobileMenuTriggerRef,
  isMobileNavOpen,
}) => {
  const location = useLocation();
  const isWorkflowEditor = location.pathname.startsWith('/workflow/') && !location.pathname.includes('/executions/');

  return (
    <header className="h-[60px] bg-surface border-b border-border-subtle px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left side: Hamburger Trigger (Mobile) & Breadcrumbs or H1 Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-navigation-drawer"
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-nav-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-blue"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>

        {isWorkflowEditor ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs md:text-sm text-text-secondary">
            <Link
              to="/dashboard"
              className="hover:text-text-primary transition-colors hover:underline"
            >
              Workspace
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <Link
              to="/workflow"
              className="hover:text-text-primary transition-colors hover:underline"
            >
              Hiring Workflows
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="font-semibold text-text-primary truncate max-w-[200px] md:max-w-[360px]">
              {title}
            </span>
          </nav>
        ) : (
          <div className="text-sm font-semibold text-text-primary tracking-tight leading-tight">
            {title}
          </div>
        )}
      </div>

      {/* Right side: Notifications & User Menu */}
      <div className="flex items-center gap-1 md:gap-2">
        <UserMenu />
      </div>
    </header>
  );
};
