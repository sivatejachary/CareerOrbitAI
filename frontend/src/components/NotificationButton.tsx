import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';

export const NotificationButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const togglePopover = () => setIsOpen((prev) => !prev);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={togglePopover}
        aria-label="Notifications"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="w-10 h-10 flex items-center justify-center rounded-item text-text-secondary hover:text-text-primary hover:bg-nav-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-blue"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Notification details"
          className="absolute right-0 mt-2 w-64 bg-surface border border-border-subtle rounded-menu shadow-dropdown p-4 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <p className="text-sm font-medium text-text-primary mb-1">Notifications</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            Notifications coming soon.
          </p>
        </div>
      )}
    </div>
  );
};
