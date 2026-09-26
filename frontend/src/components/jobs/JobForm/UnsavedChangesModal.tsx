import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    cancelBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/30 backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-label="Discard unsaved changes"
    >
      <div className="bg-surface border border-border-subtle rounded-menu shadow-dropdown max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Discard unsaved changes?</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              You have unsaved modifications in this job form. Leaving now will discard all unsaved edits.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-workspace border border-border-subtle hover:bg-nav-hover text-text-primary text-sm font-medium rounded-item transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-blue"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-surface text-sm font-medium rounded-item transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
};
