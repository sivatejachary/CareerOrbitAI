import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isOpen,
  onClose,
  triggerRef,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap & body scroll lock logic
  useEffect(() => {
    if (!isOpen) return;

    // Save current active element
    const previousActiveElement = document.activeElement as HTMLElement;

    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    // Focus close button initially
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
        return;
      }

      // Focus trap logic
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Watch viewport size changes - auto close & unlock scroll if switched to desktop (>=768px)
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleViewportChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        onClose();
      }
    };

    mediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      mediaQuery.removeEventListener('change', handleViewportChange);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 md:hidden flex"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-brand-navy/30 backdrop-blur-none transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer */}
      <div
        ref={drawerRef}
        className="relative z-10 w-[min(288px,calc(100vw-32px))] bg-sidebar h-full shadow-drawer flex flex-col justify-between"
      >
        {/* Close Button Header Bar */}
        <div className="absolute top-4 right-3 z-20">
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="w-11 h-11 flex items-center justify-center rounded-item text-text-secondary hover:text-text-primary hover:bg-nav-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-blue transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <Sidebar collapsed={false} className="w-full h-full border-r-0" onNavigate={onClose} />
      </div>
    </div>
  );
};
