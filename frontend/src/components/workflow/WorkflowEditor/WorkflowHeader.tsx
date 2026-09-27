import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  MoreVertical,
  Eye,
  Send,
  Copy,
  History,
  Check,
  ChevronRight
} from 'lucide-react';
import { SaveStatus, StepValidationIssue } from '../../../types/workflow';
import { AssociatedJobsModal } from './AssociatedJobsModal';

interface WorkflowHeaderProps {
  workflowName: string;
  associatedJobTitle?: string;
  isCompanyDefault: boolean;
  versionNumber: number;
  publicationState: 'Draft' | 'Published' | 'Archived';
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  validationIssues: StepValidationIssue[];
  onRenameWorkflow: (newName: string) => void;
  onManualSaveRetry: () => void;
  onOpenPreview: () => void;
  onOpenPublishReview: () => void;
  onDuplicateWorkflow: () => void;
  onOpenVersionHistory: () => void;
}

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
  workflowName,
  associatedJobTitle,
  isCompanyDefault,
  versionNumber,
  publicationState,
  saveStatus,
  lastSavedAt,
  validationIssues,
  onRenameWorkflow,
  onManualSaveRetry,
  onOpenPreview,
  onOpenPublishReview,
  onDuplicateWorkflow,
  onOpenVersionHistory
}) => {
  const navigate = useNavigate();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(workflowName);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showJobsModal, setShowJobsModal] = useState(false);

  const handleFinishRename = () => {
    if (titleInput.trim() && titleInput !== workflowName) {
      onRenameWorkflow(titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const isPublished = publicationState === 'Published';
  const blockingErrors = validationIssues.filter(i => i.severity === 'error');

  // Format timestamp without seconds: e.g. "Saved at 4:35 PM"
  const formattedSavedTime = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <>
      <header className="h-14 bg-white border-b border-border-subtle px-4 flex items-center justify-between z-30 shrink-0 select-none">
        {/* Left: Back | Title & Subtitle Context | Version Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/workflow')}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-workspace rounded-lg transition-colors shrink-0"
            title="Back to workflows"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-5 w-px bg-border-subtle hidden sm:block shrink-0" />

          {/* Workflow Title & Supporting Context */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    autoFocus
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                    className="px-2 py-0.5 text-sm font-bold text-text-primary bg-workspace border border-interactive-blue rounded focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleFinishRename}
                    className="p-1 bg-interactive-blue text-white rounded text-[10px]"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <h1
                  onClick={() => {
                    setTitleInput(workflowName);
                    setIsEditingTitle(true);
                  }}
                  title="Click to rename workflow"
                  className="text-sm font-bold text-text-primary hover:text-interactive-blue transition-colors truncate cursor-pointer"
                >
                  {workflowName || 'Standard Recruitment Workflow'}
                </h1>
              )}

              {/* Version Badge: e.g. "Draft v2" or "v1 Published" */}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                  isPublished
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {isPublished ? `v${versionNumber} Published` : `Draft v${versionNumber}`}
              </span>
            </div>

            {/* Quiet Supporting Context Beneath Title */}
            <div className="flex items-center gap-1 text-[11px] text-text-secondary mt-0.5">
              <span>{isCompanyDefault ? 'Default for all jobs' : associatedJobTitle || 'Custom workflow'}</span>
              <span>·</span>
              <button
                type="button"
                onClick={() => setShowJobsModal(true)}
                className="text-interactive-blue hover:underline inline-flex items-center font-medium gap-0.5"
                title="Inspect jobs using this workflow"
              >
                <span>Inspect linked jobs</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Center: Save status (strictly without seconds: "Saved at 4:35 PM" or "Saving...") */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          {saveStatus === 'SAVING' && (
            <span className="flex items-center gap-1.5 text-text-secondary">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-interactive-blue" />
              <span>Saving...</span>
            </span>
          )}

          {saveStatus === 'SAVED' && (
            <span className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {formattedSavedTime ? `Saved at ${formattedSavedTime}` : 'Saved'}
              </span>
            </span>
          )}

          {saveStatus === 'SAVE_FAILED' && (
            <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Save failed</span>
              <button
                type="button"
                onClick={onManualSaveRetry}
                className="underline text-rose-800 hover:text-rose-950 font-bold ml-1"
              >
                Retry
              </button>
            </span>
          )}

          {saveStatus === 'OFFLINE' && (
            <span className="flex items-center gap-1.5 text-amber-700">
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              <span>Offline</span>
            </span>
          )}
        </div>

        {/* Right: Actions (Publish changes is the ONLY prominent button) */}
        <div className="flex items-center gap-2">
          {/* Small status label only when action is needed */}
          {blockingErrors.length > 0 && (
            <div
              title={`${blockingErrors.length} steps require configuration`}
              className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
              <span>{blockingErrors.length} Needs setup</span>
            </div>
          )}

          {/* Preview Process Button (Subtle / Secondary) */}
          <button
            type="button"
            onClick={onOpenPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border-subtle hover:bg-workspace hover:border-interactive-blue text-text-primary text-xs font-medium rounded-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-interactive-blue" />
            <span>Preview</span>
          </button>

          {/* Primary Action: Publish changes (THE ONLY PROMINENT BUTTON) */}
          <button
            type="button"
            onClick={onOpenPublishReview}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-interactive-blue hover:bg-brand-navy text-white text-xs font-bold rounded-lg shadow-xs transition-colors focus:ring-2 focus:ring-interactive-blue/40"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish changes</span>
          </button>

          {/* Overflow Menu (More) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOverflow(!showOverflow)}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-workspace transition-colors"
              title="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOverflow && (
              <div
                className="absolute right-0 mt-1 w-48 bg-white border border-border-subtle rounded-lg shadow-lg py-1 z-40 text-xs text-text-primary"
                onClick={() => setShowOverflow(false)}
              >
                <button
                  type="button"
                  onClick={onDuplicateWorkflow}
                  className="w-full text-left px-3 py-2 hover:bg-workspace flex items-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Duplicate workflow</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenVersionHistory}
                  className="w-full text-left px-3 py-2 hover:bg-workspace flex items-center gap-2"
                >
                  <History className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Version history</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Associated Jobs Modal */}
      <AssociatedJobsModal
        isOpen={showJobsModal}
        onClose={() => setShowJobsModal(false)}
        workflowName={workflowName}
        isCompanyDefault={isCompanyDefault}
        associatedJobTitle={associatedJobTitle}
      />
    </>
  );
};
