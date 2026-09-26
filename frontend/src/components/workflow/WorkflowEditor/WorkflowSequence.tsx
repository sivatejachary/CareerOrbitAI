import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  UserCheck,
  CalendarCheck,
  GitBranch,
  PhoneCall,
  Clock,
  ClipboardList,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Code2,
  MoreVertical,
  Plus,
  AlertTriangle,
  Settings,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  ArrowRight
} from 'lucide-react';
import {
  WorkflowStepItem,
  WorkflowNodeType,
  StepValidationIssue
} from '../../../types/workflow';
import { AddStepMenu, StepMenuItem } from './AddStepMenu';

interface WorkflowSequenceProps {
  steps: WorkflowStepItem[];
  selectedStepId: string | null;
  validationIssues: StepValidationIssue[];
  onSelectStep: (stepId: string) => void;
  onMoveStep: (fromIndex: number, toIndex: number) => void;
  onDuplicateStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  onAddStepAtIndex: (index: number, item: StepMenuItem) => void;
  onUpdateStepTitle?: (stepId: string, newTitle: string) => void;
}

// Consistent 20px Lucide icons with restrained brand palette
const getNodeIcon = (type: WorkflowNodeType, _purpose?: string) => {
  switch (type) {
    case 'APPLICATION_RECEIVED':
      return <FileText className="w-5 h-5 text-emerald-600" />;
    case 'AI_RESUME_SCREENING':
      return <Sparkles className="w-5 h-5 text-[#245FAD]" />;
    case 'HR_REVIEW':
      return <UserCheck className="w-5 h-5 text-slate-700" />;
    case 'INTERVIEW':
      return <CalendarCheck className="w-5 h-5 text-[#245FAD]" />;
    case 'ASSESSMENT':
      return <Code2 className="w-5 h-5 text-slate-700" />;
    case 'AI_CALLING':
      return <PhoneCall className="w-5 h-5 text-[#245FAD]" />;
    case 'CANDIDATE_AVAILABILITY':
    case 'SCHEDULE_INTERVIEW':
      return <CalendarCheck className="w-5 h-5 text-slate-700" />;
    case 'SEND_MESSAGE':
      return <Mail className="w-5 h-5 text-slate-700" />;
    case 'WAIT_DELAY':
      return <Clock className="w-5 h-5 text-slate-500" />;
    case 'CONDITION':
      return <GitBranch className="w-5 h-5 text-slate-700" />;
    case 'MANUAL_TASK':
      return <ClipboardList className="w-5 h-5 text-slate-700" />;
    case 'HR_FINAL_DECISION':
      return <ShieldCheck className="w-5 h-5 text-slate-800" />;
    case 'END':
      return <CheckCircle2 className="w-5 h-5 text-slate-400" />;
    default:
      return <CheckCircle2 className="w-5 h-5 text-slate-500" />;
  }
};

// Generates one clean, concise line per step summary (strictly no buzzwords like "Bias-free")
const getOneLineSummary = (step: WorkflowStepItem): string => {
  const cfg = step.config || {};
  switch (step.type) {
    case 'APPLICATION_RECEIVED':
      return 'CareerOrbitAI form or connected Google Form';
    case 'AI_RESUME_SCREENING':
      return `Compare skills and experience with this job · Review uncertain matches`;
    case 'AI_CALLING': {
      switch (cfg.purpose) {
        case 'RESULT_AND_SCHEDULING':
          return 'Tell candidate approved interview result · Offer next round';
        case 'RESULT_NOTIFICATION':
          return 'Communicate approved interview feedback · Human sign-off required';
        case 'INTERVIEW_REMINDER':
          return 'Interview reminder · Pre-interview logistics check';
        case 'FINAL_SELECTION_NOTIFICATION':
          return 'Communicate approved final decision · Recruiter authorization required';
        case 'SCHEDULE_INTERVIEW':
          return 'Coordinate availability · Confirm calendar booking';
        case 'REQUEST_CLARIFICATION':
          return 'Follow up on missing application details';
        case 'INITIAL_SCREENING':
        default:
          return 'Initial screening call · Verifies availability & experience';
      }
    }
    case 'HR_REVIEW':
      return `Recruiter review · ${cfg.due_in_hours || 24}h target SLA · Decides next step`;
    case 'INTERVIEW': {
      const format = cfg.interview_format || 'Video call';
      const role = cfg.interviewer_role || 'Engineering Lead';
      const duration = cfg.duration_minutes ? `${cfg.duration_minutes}m` : '45m';
      const resultCriteria = cfg.allowed_outcomes ? 'Rubric score' : 'Structured evaluation';
      return `${role} · ${format} (${duration}) · ${resultCriteria}`;
    }
    case 'CANDIDATE_AVAILABILITY':
    case 'SCHEDULE_INTERVIEW':
      return `Collect candidate timeslots · ${cfg.window_days || 5}-day booking window`;
    case 'CONDITION':
      return 'If candidate meets shortlist policy · Otherwise routes to recruiter review';
    case 'WAIT_DELAY':
      return `Pause workflow progression for ${cfg.delay_hours || 24} hours`;
    case 'ASSESSMENT':
      return `Skills test · Passing score ${cfg.pass_threshold || 70}% · ${cfg.duration_minutes || 60}m limit`;
    case 'SEND_MESSAGE':
      return `Automated ${cfg.channel || 'email'} notification to candidate · Sent automatically`;
    case 'MANUAL_TASK':
      return `Recruiter task · ${cfg.title || 'Verification checklist'} · Due in ${cfg.due_in_hours || 48}h`;
    case 'HR_FINAL_DECISION':
      return `Authorized human sign-off · Confirms job offer or rejection`;
    case 'END':
      return 'Hiring journey concludes for this candidate';
    default:
      return step.purpose || 'Sequential hiring step';
  }
};

export const WorkflowSequence: React.FC<WorkflowSequenceProps> = ({
  steps,
  selectedStepId,
  validationIssues,
  onSelectStep,
  onMoveStep,
  onDuplicateStep,
  onDeleteStep,
  onAddStepAtIndex
}) => {
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const [openMoreMenuId, setOpenMoreMenuId] = useState<string | null>(null);
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState('');

  const announce = (msg: string) => {
    setScreenReaderAnnouncement(msg);
    setTimeout(() => setScreenReaderAnnouncement(''), 3000);
  };

  return (
    <main
      aria-label="Workflow Sequence"
      className="flex-1 bg-[#F6F8FB] overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center custom-scrollbar"
    >
      {/* Screen Reader Live Region */}
      <div className="sr-only" aria-live="polite">
        {screenReaderAnnouncement}
      </div>

      {/* Centered Column: approximately 680-800px wide */}
      <div className="w-full max-w-[760px] pb-16">
        {/* Step Sequence List */}
        <div className="space-y-0">
          {steps.map((step, index) => {
            const isSelected = selectedStepId === step.id;
            const isStart = step.type === 'APPLICATION_RECEIVED';
            const isEnd = step.type === 'END';

            // Find any blocking issues for this step
            const stepIssues = validationIssues.filter(i => i.stepId === step.id);
            const hasError = stepIssues.some(i => i.severity === 'error');

            // Render Card 1 (Pinned intake row) specially
            if (isStart) {
              return (
                <React.Fragment key={step.id}>
                  <div
                    tabIndex={0}
                    role="button"
                    aria-selected={isSelected}
                    onClick={() => onSelectStep(step.id)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border bg-white transition-all shadow-xs cursor-pointer ${
                      isSelected
                        ? 'border-[#245FAD] ring-1 ring-[#245FAD]/25'
                        : 'border-[#DDE4EB] hover:border-[#5B6C7D]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#F6F8FB] border border-[#DDE4EB] text-[#192D42] text-xs font-bold flex items-center justify-center shrink-0">
                          1
                        </div>
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-[#192D42]">
                              Candidate applies
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Intake
                            </span>
                          </div>
                          <p className="text-xs text-[#5B6C7D] mt-0.5 truncate">
                            CareerOrbitAI form or connected Google Form
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Connector Line & "Add step" button */}
                  <div className="flex flex-col items-center py-2.5">
                    <div className="w-0.5 h-3 bg-[#DDE4EB]" />
                    <button
                      type="button"
                      onClick={() => setActiveMenuIndex(index + 1)}
                      className="my-0.5 px-3 py-1 rounded-full bg-white border border-[#DDE4EB] hover:border-[#245FAD] hover:text-[#245FAD] text-[#5B6C7D] text-xs font-medium flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#245FAD]/30"
                      title="Add step"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add step</span>
                    </button>
                    <div className="w-0.5 h-3 bg-[#DDE4EB]" />
                  </div>
                </React.Fragment>
              );
            }

            // Normal Configurable Steps (2, 3, 4...)
            return (
              <React.Fragment key={step.id}>
                {/* Step Card Container */}
                <div
                  tabIndex={0}
                  role="button"
                  aria-selected={isSelected}
                  aria-label={`Step ${index + 1}: ${step.title}`}
                  onClick={() => onSelectStep(step.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectStep(step.id);
                    } else if (e.altKey && e.key === 'ArrowUp' && index > 1) {
                      e.preventDefault();
                      onMoveStep(index, index - 1);
                      announce(`Moved ${step.title} up to step ${index}`);
                    } else if (e.altKey && e.key === 'ArrowDown' && index < steps.length - 2) {
                      e.preventDefault();
                      onMoveStep(index, index + 1);
                      announce(`Moved ${step.title} down to step ${index + 2}`);
                    } else if (e.altKey && e.key === 'd' && !isEnd) {
                      e.preventDefault();
                      onDuplicateStep(step.id);
                      announce(`Duplicated ${step.title}`);
                    }
                  }}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xl border bg-white transition-all shadow-xs cursor-pointer ${
                    isSelected
                      ? 'border-[#245FAD] ring-1 ring-[#245FAD]/25'
                      : 'border-[#DDE4EB] hover:border-[#5B6C7D]/30'
                  } ${hasError ? 'border-amber-300 bg-amber-50/15' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Step Number, Lucide Icon, Name, and One-line Summary */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#F6F8FB] border border-[#DDE4EB] text-[#192D42] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </div>

                      <div className="p-1.5 rounded-lg bg-[#F6F8FB] border border-[#DDE4EB] shrink-0 mt-0.5">
                        {getNodeIcon(step.type, step.config?.purpose)}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-[#192D42] tracking-tight">
                            {step.title}
                          </span>

                          {/* Small status label ONLY when action is needed */}
                          {hasError && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Needs setup</span>
                            </span>
                          )}
                        </div>

                        {/* One concise line configuration summary */}
                        <p className="text-xs text-[#5B6C7D] leading-relaxed">
                          {getOneLineSummary(step)}
                        </p>
                      </div>
                    </div>

                    {/* Right: More Menu for Duplicate, Move, Delete */}
                    <div
                      className="relative shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenMoreMenuId(openMoreMenuId === step.id ? null : step.id)}
                        className="p-1 rounded-md text-[#5B6C7D] hover:text-[#192D42] hover:bg-[#F6F8FB] transition-colors"
                        title="Step options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMoreMenuId === step.id && (
                        <div
                          className="absolute right-0 mt-1 w-44 bg-white border border-[#DDE4EB] rounded-lg shadow-lg py-1 z-30 text-xs text-[#192D42] animate-in fade-in duration-75"
                          onClick={() => setOpenMoreMenuId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectStep(step.id)}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#F6F8FB] flex items-center gap-2"
                          >
                            <Settings className="w-3.5 h-3.5 text-[#5B6C7D]" />
                            <span>Configure step</span>
                          </button>

                          <button
                            type="button"
                            disabled={index <= 1 || isEnd}
                            onClick={() => {
                              onMoveStep(index, index - 1);
                              announce(`Moved ${step.title} earlier`);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#F6F8FB] flex items-center gap-2 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ChevronUp className="w-3.5 h-3.5 text-[#5B6C7D]" />
                            <span>Move earlier</span>
                          </button>

                          <button
                            type="button"
                            disabled={index >= steps.length - 2 || isEnd}
                            onClick={() => {
                              onMoveStep(index, index + 1);
                              announce(`Moved ${step.title} later`);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#F6F8FB] flex items-center gap-2 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-[#5B6C7D]" />
                            <span>Move later</span>
                          </button>

                          {!isEnd && (
                            <button
                              type="button"
                              onClick={() => {
                                onDuplicateStep(step.id);
                                announce(`Duplicated ${step.title}`);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-[#F6F8FB] flex items-center gap-2"
                            >
                              <Copy className="w-3.5 h-3.5 text-[#5B6C7D]" />
                              <span>Duplicate step</span>
                            </button>
                          )}

                          {!isEnd && (
                            <div className="pt-1 mt-1 border-t border-[#DDE4EB]">
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete "${step.title}" from this workflow?`)) {
                                    onDeleteStep(step.id);
                                    announce(`Deleted ${step.title}`);
                                  }
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-700 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Delete step</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ================= READABLE CONDITION SECTION ================= */}
                  {step.type === 'CONDITION' && (
                    <div className="mt-3 pt-3 border-t border-[#DDE4EB] space-y-2">
                      <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0] space-y-2.5 text-xs">
                        {/* Primary Condition Branch */}
                        <div className="space-y-1">
                          <div className="font-semibold text-[#192D42] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#245FAD]" />
                            <span>If candidate meets shortlist policy:</span>
                          </div>
                          <div className="pl-4 text-[#5B6C7D] flex items-center gap-1.5">
                            <ArrowRight className="w-3 h-3 text-[#245FAD]" />
                            <span>Continue with initial AI call</span>
                          </div>
                        </div>

                        {/* Fallback Branch */}
                        <div className="space-y-1 pt-2 border-t border-[#E2E8F0]">
                          <div className="font-semibold text-[#192D42] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span>Otherwise:</span>
                          </div>
                          <div className="pl-4 text-[#5B6C7D] flex items-center gap-1.5">
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span>Send to recruiter review</span>
                          </div>
                        </div>

                        {/* Path Continuity */}
                        <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-[#5B6C7D] italic">
                          ↳ Both paths continue forward to the next evaluation round.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Connector Line & "Add step" button between cards */}
                {index < steps.length - 1 && (
                  <div className="flex flex-col items-center py-2.5">
                    <div className="w-0.5 h-3 bg-[#DDE4EB]" />
                    <button
                      type="button"
                      onClick={() => setActiveMenuIndex(index + 1)}
                      className="my-0.5 px-3 py-1 rounded-full bg-white border border-[#DDE4EB] hover:border-[#245FAD] hover:text-[#245FAD] text-[#5B6C7D] text-xs font-medium flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#245FAD]/30"
                      title={`Add step between step ${index + 1} and ${index + 2}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add step</span>
                    </button>
                    <div className="w-0.5 h-3 bg-[#DDE4EB]" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Searchable Add Step Menu */}
      <AddStepMenu
        isOpen={activeMenuIndex !== null}
        insertPosition={activeMenuIndex ?? 1}
        onClose={() => setActiveMenuIndex(null)}
        onSelectStep={(item) => {
          if (activeMenuIndex !== null) {
            onAddStepAtIndex(activeMenuIndex, item);
            announce(`Added ${item.title}`);
          }
        }}
      />
    </main>
  );
};
