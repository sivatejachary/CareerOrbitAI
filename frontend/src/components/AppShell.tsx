import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { MobileNavigation } from './MobileNavigation';
import { getRouteTitle } from '../config/navigation';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);

  const currentTitle = getRouteTitle(location.pathname);

  // Synchronize document title with active route
  useEffect(() => {
    document.title = `${currentTitle} - CareerOrbitAI`;
  }, [currentTitle]);

  return (
    <div className="min-h-full bg-workspace flex flex-col font-sans">
      {/* Accessible Skip-to-Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3 focus:bg-interactive-blue focus:text-surface focus:font-medium focus:rounded-md focus:shadow-dropdown focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>

      {/* Desktop & Tablet Sidebar (Fixed Position) */}
      <div className="hidden md:block fixed top-0 bottom-0 left-0 z-40">
        {/* Tablet Rail view (80px width) on 768px-1199px */}
        <div className="block xl:hidden h-full">
          <Sidebar collapsed={true} />
        </div>

        {/* Desktop Sidebar view (256px width) on >=1200px */}
        <div className="hidden xl:block h-full">
          <Sidebar collapsed={false} />
        </div>
      </div>

      {/* Mobile Navigation Drawer (<768px) */}
      <MobileNavigation
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        triggerRef={mobileMenuTriggerRef}
      />

      {/* Main Content Area Container */}
      <div className="flex-1 flex flex-col md:pl-[80px] xl:pl-[240px] min-w-0">
        {/* Top Header */}
        <TopHeader
          title={currentTitle}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
          isMobileNavOpen={isMobileNavOpen}
        />

        {/* Main Workspace Region */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 px-4 md:px-6 xl:px-8 py-6 max-w-full focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
