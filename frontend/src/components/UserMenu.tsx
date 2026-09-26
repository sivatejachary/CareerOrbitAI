import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Settings } from 'lucide-react';

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const settingsItemRef = useRef<HTMLAnchorElement>(null);

  const toggleMenu = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    if (!isOpen) return;

    // Move focus into menu item when opened via keyboard
    settingsItemRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
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

  const handleLinkClick = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        aria-label="User account menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="w-10 h-10 flex items-center justify-center rounded-item text-text-secondary hover:text-text-primary hover:bg-nav-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-blue"
      >
        <div className="w-8 h-8 rounded-full border border-border-subtle bg-workspace flex items-center justify-center text-text-secondary">
          <User className="w-4 h-4" aria-hidden="true" />
        </div>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          aria-label="User account settings"
          className="absolute right-0 mt-2 w-48 bg-surface border border-border-subtle rounded-menu shadow-dropdown py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <Link
            ref={settingsItemRef}
            to="/settings"
            role="menuitem"
            onClick={handleLinkClick}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-text-primary hover:bg-nav-hover focus-visible:bg-nav-hover focus-visible:outline-none transition-colors"
          >
            <Settings className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            <span>Settings</span>
          </Link>
        </div>
      )}
    </div>
  );
};
