import React from 'react';
import {
  X,
  Send,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Briefcase
} from 'lucide-react';
import { StepValidationIssue, WorkflowStepItem } from '../../../types/workflow';

interface PublishReviewModalProps {
  workflowName: string;
  currentVersionNumber: number;
  steps: WorkflowStepItem[];
  validationIssues: StepValidationIssue[];
  affectedJobsCount: number;
  activeExecutionsCount: number;
  isPublishing: boolean;
  onConfirmPublish: () => void;
  onClose: () => void;
}

export const PublishReviewModal: React.FC<PublishReviewModalProps> = ({
  workflowName,
  currentVersionNumber,
  steps,
  validationIssues,
  affectedJobsCount,
  activeExecutionsCount,
  isPublishing,
  onConfirmPublish,
  onClose
}) => {
  const nextVersionNumber = currentVersionNumber + 1;
  const blockingIssues = validationIssues.filter(i => i.severity === 'error');
  const canPublish = blockingIssues.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10263E]/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-[#DDE4EB] w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE4EB] bg-[#F6F8FB]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#245FAD]/10 text-[#245FAD]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#192D42]">
                Publish Workflow Changes
              </h3>
              <p className="text-xs text-[#5B6C7D]">
                Creates an immutable published version for {workflowName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#5B6C7D] hover:text-[#192D42] hover:bg-[#DDE4EB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-[#192D42] overflow-y-auto max-h-[70vh]">
          {/* Version Info Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[#DDE4EB] bg-[#F6F8FB]">
              <div className="text-[10px] font-bold text-[#5B6C7D] uppercase tracking-wide">
                Current Version
              </div>
              <div className="text-sm font-bold text-[#192D42] mt-0.5">
                Version {currentVersionNumber}
              </div>
              <div className="text-[11px] text-[#5B6C7D] mt-0.5">
                Active in production
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#245FAD]/30 bg-blue-50/50">
              <div className="text-[10px] font-bold text-[#245FAD] uppercase tracking-wide">
                New Target Version
              </div>
              <div className="text-sm font-bold text-[#245FAD] mt-0.5">
                Version {nextVersionNumber} (Immutable)
              </div>
              <div className="text-[11px] text-blue-900 mt-0.5">
                Will enroll all future applicants
              </div>
            </div>
          </div>

          {/* Safe Enrolled Candidates Guarantee */}
          <div className="p-3.5 rounded-lg border border-[#DDE4EB] bg-white space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#192D42]">
              <Users className="w-4 h-4 text-[#245FAD]" />
              <span>Candidate Enrollment & Execution Guarantee</span>
            </div>
            <p className="text-[11px] text-[#5B6C7D] leading-relaxed">
              <strong>{activeExecutionsCount} active candidate(s)</strong> are currently in progress. They will remain <strong>permanently pinned to Version {currentVersionNumber}</strong> to ensure consistency. Only new candidates submitting applications after publication will be enrolled in <strong>Version {nextVersionNumber}</strong>.
            </p>
          </div>

          {/* Affected Jobs */}
          <div className="p-3.5 rounded-lg border border-[#DDE4EB] bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#5B6C7D]" />
              <div>
                <span className="font-bold text-[#192D42]">Affected Jobs:</span>
                <span className="text-[#5B6C7D] ml-1.5">{affectedJobsCount} active job postings</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Auto-bound
            </span>
          </div>

          {/* Validation Checklist */}
          {blockingIssues.length > 0 ? (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Cannot Publish: {blockingIssues.length} Blocking Issue(s)</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800">
                {blockingIssues.map((issue, idx) => (
                  <li key={idx}>
                    <strong>{issue.stepTitle}:</strong> {issue.message}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-900 italic pt-1">
                Please resolve these issues in the workflow editor before publishing.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Workflow Validation Succeeded</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-snug">
                All {steps.length} steps are fully configured. DAG reachability, acyclicity, and authorized human approval policies have been verified.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#DDE4EB] bg-[#F6F8FB] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#DDE4EB] bg-white hover:bg-[#F6F8FB] text-[#192D42] text-xs font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canPublish || isPublishing}
            onClick={onConfirmPublish}
            className="flex items-center gap-2 px-5 py-2 bg-[#245FAD] hover:bg-[#10263E] text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isPublishing ? 'Publishing...' : `Confirm & Publish Version ${nextVersionNumber}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
