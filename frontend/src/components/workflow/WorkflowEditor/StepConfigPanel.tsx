import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  PhoneCall,
  Clock,
  Eye,
  CalendarCheck,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import {
  WorkflowStepItem,
  ConditionBranchItem
} from '../../../types/workflow';
import { CommunicationPreviewModal } from './CommunicationPreviewModal';

interface StepConfigPanelProps {
  step: WorkflowStepItem | null;
  allSteps: WorkflowStepItem[];
  onUpdateStep: (updated: WorkflowStepItem) => void;
  onDeleteStep: (stepId: string) => void;
  onClose: () => void;
}

export const StepConfigPanel: React.FC<StepConfigPanelProps> = ({
  step,
  allSteps: _allSteps,
  onUpdateStep,
  onDeleteStep,
  onClose
}) => {

  const [title, setTitle] = useState(step?.title || '');
  const [purpose, setPurpose] = useState(step?.purpose || '');
  const [description, setDescription] = useState(step?.description || '');
  const [config, setConfig] = useState<Record<string, any>>(step?.config || {});
  const [branches, setBranches] = useState<ConditionBranchItem[]>(step?.branches || []);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!step) return;
    setTitle(step.title);
    setPurpose(step.purpose || '');
    setDescription(step.description || '');
    setConfig(step?.config || {});
    setBranches(step?.branches || []);
  }, [step]);

  if (!step) return null;

  const commitChanges = (
    newConfig: Record<string, any> = config,
    newTitle: string = title,
    newPurpose: string = purpose,
    newDesc: string = description,
    newBranches: ConditionBranchItem[] = branches
  ) => {
    onUpdateStep({
      ...step,
      title: newTitle,
      purpose: newPurpose,
      description: newDesc,
      config: newConfig,
      branches: step.type === 'CONDITION' ? newBranches : undefined
    });
  };

  const updateConfigKey = (key: string, value: any) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    commitChanges(next, title, purpose, description, branches);
  };

  const isStart = step.type === 'APPLICATION_RECEIVED';
  const isEnd = step.type === 'END';

  return (
    <aside
      aria-label="Step Configuration Inspector"
      className="w-full sm:w-[380px] xl:w-[400px] shrink-0 bg-white border-l border-border-subtle flex flex-col h-full shadow-lg z-20 select-none animate-in slide-in-from-right-4 duration-150"
    >
      {/* Inspector Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-workspace">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Step Configuration
          </div>
          <div className="text-sm font-bold text-text-primary truncate mt-0.5">
            {title}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-border-subtle transition-colors"
          title="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Inspector Body (Four short sections focused on HR decisions) */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-text-primary custom-scrollbar">
        {/* ================= SECTION 1: PURPOSE (What this step does) ================= */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border-subtle">
            <span className="w-5 h-5 rounded bg-workspace border border-border-subtle text-[11px] font-bold flex items-center justify-center text-interactive-blue">
              1
            </span>
            <h3 className="font-bold text-xs text-text-primary">Purpose — What this step does</h3>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-text-primary">Step Name</label>
            <input
              type="text"
              disabled={isStart || isEnd}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                commitChanges(config, e.target.value, purpose, description, branches);
              }}
              className="w-full px-3 py-1.5 border border-border-subtle rounded-lg text-xs bg-white text-text-primary focus:ring-1 focus:ring-interactive-blue focus:outline-none disabled:bg-workspace"
              placeholder="e.g. Technical Interview - System Design"
            />
          </div>

          {/* Responsible Role / Owner */}
          {!isStart && !isEnd && (
            <div className="space-y-1">
              <label className="font-semibold text-text-primary">Responsible Owner / Role</label>
              <select
                value={config.owner_role || (step.type === 'AI_CALLING' ? 'AI Voice Agent' : 'Recruiter')}
                onChange={(e) => updateConfigKey('owner_role', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border-subtle rounded-lg text-xs bg-white text-text-primary focus:ring-1 focus:ring-interactive-blue"
              >
                <option value="Recruiter">Recruiter (Talent Acquisition)</option>
                <option value="Hiring Manager">Hiring Manager</option>
                <option value="Engineering Lead">Engineering Lead</option>
                <option value="Peer Interviewer">Peer / Panel Interviewer</option>
                <option value="AI Voice Agent">CareerOrbitAI Voice Agent</option>
              </select>
            </div>
          )}

          {/* Interview Details */}
          {step.type === 'INTERVIEW' && (
            <div className="space-y-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="flex items-center gap-1.5 font-bold text-text-primary">
                <CalendarCheck className="w-3.5 h-3.5 text-interactive-blue" />
                <span>Interview Round Format</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-text-secondary">Round Format</label>
                  <select
                    value={config.interview_format || 'Video Call (Google Meet)'}
                    onChange={(e) => updateConfigKey('interview_format', e.target.value)}
                    className="w-full px-2 py-1 border border-border-subtle rounded text-xs bg-white mt-0.5"
                  >
                    <option value="Video Call (Google Meet)">Video Call (Google Meet)</option>
                    <option value="Phone Call">Direct Phone Call</option>
                    <option value="In-Person Onsite">In-Person Onsite</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-text-secondary">Duration</label>
                  <select
                    value={config.duration_minutes || 45}
                    onChange={(e) => updateConfigKey('duration_minutes', parseInt(e.target.value, 10))}
                    className="w-full px-2 py-1 border border-border-subtle rounded text-xs bg-white mt-0.5"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* AI Calling: Purpose Selector */}
          {step.type === 'AI_CALLING' && (
            <div className="space-y-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="flex items-center gap-1.5 font-bold text-text-primary">
                <PhoneCall className="w-3.5 h-3.5 text-interactive-blue" />
                <span>Conversation Purpose</span>
              </div>
              <select
                value={config.purpose || 'INITIAL_SCREENING'}
                onChange={(e) => updateConfigKey('purpose', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border-subtle rounded-lg text-xs bg-white text-text-primary focus:ring-1 focus:ring-interactive-blue"
              >
                <option value="INITIAL_SCREENING">Initial screening call (Interest & Availability)</option>
                <option value="RESULT_AND_SCHEDULING">Tell candidate approved interview result & offer next round</option>
                <option value="INTERVIEW_REMINDER">Interview reminder (Pre-interview logistics check)</option>
                <option value="FINAL_SELECTION_NOTIFICATION">Communicate approved final decision</option>
                <option value="SCHEDULE_INTERVIEW">Coordinate interview scheduling</option>
                <option value="REQUEST_CLARIFICATION">Request application clarification</option>
              </select>
              <p className="text-[11px] text-text-secondary">
                The agent's spoken conversation is strictly constrained to this approved hiring goal.
              </p>
            </div>
          )}

          {/* Recruiter Instructions */}
          {!isStart && !isEnd && (
            <div className="space-y-1">
              <label className="font-semibold text-text-primary">Recruiter Guidelines & Notes</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  commitChanges(config, title, purpose, e.target.value, branches);
                }}
                className="w-full px-3 py-1.5 border border-border-subtle rounded-lg text-xs bg-white text-text-primary focus:ring-1 focus:ring-interactive-blue resize-none"
                placeholder="Specific instructions for recruiter or interviewer at this stage"
              />
            </div>
          )}
        </section>

        {/* ================= SECTION 2: TRIGGER (When it runs) ================= */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border-subtle">
            <span className="w-5 h-5 rounded bg-workspace border border-border-subtle text-[11px] font-bold flex items-center justify-center text-interactive-blue">
              2
            </span>
            <h3 className="font-bold text-xs text-text-primary">Trigger — When it runs</h3>
          </div>

          <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-text-secondary">
            Runs sequentially once the preceding step concludes with an advancing outcome.
          </div>

          {/* Mandatory Human Approval Gate */}
          {step.type === 'AI_CALLING' && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-text-primary">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Require Recruiter Approval</span>
                </div>
                <input
                  type="checkbox"
                  id="req_approval"
                  checked={config.required_approval ?? ['RESULT_NOTIFICATION', 'RESULT_AND_SCHEDULING', 'FINAL_SELECTION_NOTIFICATION'].includes(config.purpose)}
                  onChange={(e) => updateConfigKey('required_approval', e.target.checked)}
                  className="h-4 w-4 text-interactive-blue rounded border-border-subtle"
                />
              </div>
              <label htmlFor="req_approval" className="text-[11px] text-amber-900 block cursor-pointer">
                Requires recorded HR sign-off before dialing candidate. (Mandatory for result announcements and offers).
              </label>
            </div>
          )}

          {/* Permitted Calling Window (09:00 - 18:00) */}
          {step.type === 'AI_CALLING' && (
            <div className="space-y-2 p-3 rounded-lg bg-white border border-border-subtle">
              <div className="flex items-center gap-1.5 font-bold text-xs text-text-primary">
                <Clock className="w-3.5 h-3.5 text-interactive-blue" />
                <span>Permitted Calling Window</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-text-secondary">Earliest Time</label>
                  <input
                    type="time"
                    value={config.allowed_calling_windows?.start || '09:00'}
                    onChange={(e) => updateConfigKey('allowed_calling_windows', { ...config.allowed_calling_windows, start: e.target.value })}
                    className="w-full px-2 py-1 border border-border-subtle rounded bg-white text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-secondary">Latest Time</label>
                  <input
                    type="time"
                    value={config.allowed_calling_windows?.end || '18:00'}
                    onChange={(e) => updateConfigKey('allowed_calling_windows', { ...config.allowed_calling_windows, end: e.target.value })}
                    className="w-full px-2 py-1 border border-border-subtle rounded bg-white text-xs mt-0.5"
                  />
                </div>
              </div>
              <p className="text-[10px] text-text-secondary">
                Automatically respects candidate's local time zone and National DNC list.
              </p>
            </div>
          )}

          {/* Human Review SLA */}
          {(step.type === 'HR_REVIEW' || step.type === 'INTERVIEW' || step.type === 'MANUAL_TASK') && (
            <div className="space-y-1.5 p-3 rounded-lg bg-white border border-border-subtle">
              <label className="font-semibold text-xs text-text-primary">Target Completion SLA</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={config.due_in_hours || 24}
                  onChange={(e) => updateConfigKey('due_in_hours', parseInt(e.target.value, 10) || 24)}
                  className="w-20 px-2.5 py-1 border border-border-subtle rounded-lg text-xs"
                />
                <span className="text-xs text-text-secondary">hours from task creation</span>
              </div>
            </div>
          )}
        </section>

        {/* ================= SECTION 3: COMPLETION (What moves candidate forward) ================= */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border-subtle">
            <span className="w-5 h-5 rounded bg-workspace border border-border-subtle text-[11px] font-bold flex items-center justify-center text-interactive-blue">
              3
            </span>
            <h3 className="font-bold text-xs text-text-primary">Completion — What result moves candidate forward</h3>
          </div>

          {/* AI Resume Screening Rules & Evidence */}
          {step.type === 'AI_RESUME_SCREENING' && (
            <div className="space-y-3">
              <div className="space-y-2 p-3 rounded-lg bg-white border border-border-subtle">
                <div className="font-bold text-xs text-text-primary">Screening Scoring Policy</div>
                <div className="space-y-1">
                  <label className="text-[11px] text-text-secondary">Shortlist Threshold (% Match)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={config.min_score_shortlist || 75}
                    onChange={(e) => updateConfigKey('min_score_shortlist', parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 border border-border-subtle rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-text-secondary">Recruiter Review Threshold (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={config.min_score_review || 50}
                    onChange={(e) => updateConfigKey('min_score_review', parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 border border-border-subtle rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Specific Evidence Evaluated (NO unsupported Buzzwords) */}
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                <div className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-interactive-blue" />
                  <span>Objective Evidence Evaluated</span>
                </div>
                <ul className="text-[11px] text-text-secondary space-y-1 list-disc pl-4">
                  <li>Direct alignment of technical & domain skills in resume against job specs.</li>
                  <li>Years of verified professional experience in related roles.</li>
                  <li>Required educational credentials and industry certifications.</li>
                  <li>Protected demographic attributes are excluded from scoring.</li>
                </ul>
              </div>
            </div>
          )}

          {/* AI Calling: Script Preview & Permitted Actions */}
          {step.type === 'AI_CALLING' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-xs text-text-primary">Opening Spoken Script</label>
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="text-[11px] font-bold text-interactive-blue hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview Voice</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={config.first_message_template || ''}
                  onChange={(e) => updateConfigKey('first_message_template', e.target.value)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-xs font-mono bg-white text-text-primary focus:ring-1 focus:ring-interactive-blue resize-none"
                  placeholder="Hi {{candidate_name}}, calling from {{company_name}} regarding {{job_title}}..."
                />
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <span className="text-text-secondary">Placeholders:</span>
                  {['candidate_name', 'company_name', 'job_title'].map(ph => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => {
                        const current = config.first_message_template || '';
                        updateConfigKey('first_message_template', `${current} {{${ph}}}`);
                      }}
                      className="px-1.5 py-0.5 rounded bg-workspace hover:bg-blue-50 border border-border-subtle font-mono text-interactive-blue"
                    >
                      {`{{${ph}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permitted Caller Actions */}
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="font-bold text-xs text-text-primary">Permitted Follow-up Actions</div>
                <div className="space-y-1.5">
                  {[
                    { key: 'book_interview_slot', label: 'Book calendar interview slot (Confirms actual calendar availability)' },
                    { key: 'record_answers', label: 'Capture answers to structured screening questions' },
                    { key: 'request_callback', label: 'Allow candidate to request recruiter callback' }
                  ].map(act => (
                    <label key={act.key} className="flex items-start gap-2 text-[11px] text-text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(config.allowed_actions || ['record_answers', 'request_callback']).includes(act.key)}
                        onChange={(e) => {
                          const current = config.allowed_actions || ['record_answers', 'request_callback'];
                          const next = e.target.checked
                            ? [...current, act.key]
                            : current.filter((k: string) => k !== act.key);
                          updateConfigKey('allowed_actions', next);
                        }}
                        className="h-3.5 w-3.5 rounded border-border-subtle text-interactive-blue mt-0.5"
                      />
                      <span>{act.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Interview: Completion Rubric */}
          {step.type === 'INTERVIEW' && (
            <div className="space-y-2 p-3 rounded-lg bg-white border border-border-subtle">
              <div className="font-bold text-xs text-text-primary">Completion Result Criteria</div>
              <p className="text-[11px] text-text-secondary">
                Interviewer submits structured evaluation scorecard with standard outcome choices: Strong Hire, Hire, Lean Hire, No Hire.
              </p>
              <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                <span className="text-[11px] text-text-primary font-medium">Send interview confirmation email</span>
                <input
                  type="checkbox"
                  checked={config.send_confirmation_email ?? true}
                  onChange={(e) => updateConfigKey('send_confirmation_email', e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border-subtle text-interactive-blue"
                />
              </div>
            </div>
          )}
        </section>

        {/* ================= SECTION 4: EXCEPTIONS (If it fails or data is missing) ================= */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 pb-1 border-b border-border-subtle">
            <span className="w-5 h-5 rounded bg-workspace border border-border-subtle text-[11px] font-bold flex items-center justify-center text-interactive-blue">
              4
            </span>
            <h3 className="font-bold text-xs text-text-primary">Exceptions — What happens if it fails</h3>
          </div>

          <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 text-xs text-brand-navy space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-interactive-blue" />
              <span>Recruiter Fallback Task</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              If candidate is unreachable, information is missing, or an exception occurs, the system automatically creates a task in <strong>"Waiting for recruiter"</strong> status to ensure no candidate is dropped.
            </p>
          </div>
        </section>

        {/* ================= ADVANCED SETTINGS (Collapsible Accordion) ================= */}
        <div className="pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="flex items-center justify-between w-full py-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
          >
            <span>Advanced Settings (Retries & Providers)</span>
            {isAdvancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {isAdvancedOpen && (
            <div className="pt-2 space-y-3 animate-in fade-in duration-100">
              {step.type === 'AI_CALLING' && (
                <div className="space-y-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="space-y-1">
                    <label className="text-[11px] text-text-secondary">Maximum Dial Attempts</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={config.max_attempts || 3}
                      onChange={(e) => updateConfigKey('max_attempts', parseInt(e.target.value, 10))}
                      className="w-full px-2.5 py-1 border border-border-subtle rounded bg-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-text-secondary">Minimum Cooldown Between Calls (Hours)</label>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={Math.round((config.retry_interval_minutes || 240) / 60)}
                      onChange={(e) => updateConfigKey('retry_interval_minutes', parseInt(e.target.value, 10) * 60)}
                      className="w-full px-2.5 py-1 border border-border-subtle rounded bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-text-secondary">
                <span>Technical Step ID: </span>
                <span className="font-mono text-text-primary">{step.id}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inspector Footer Actions */}
      <div className="p-3.5 border-t border-border-subtle bg-workspace flex items-center justify-between">
        {!isStart && !isEnd ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete step "${title}"?`)) {
                onDeleteStep(step.id);
                onClose();
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete step</span>
          </button>
        ) : (
          <span className="text-[11px] text-text-secondary">System step</span>
        )}

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 bg-interactive-blue hover:bg-brand-navy text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          Done
        </button>
      </div>

      {/* Voice Preview Modal */}
      {showPreviewModal && (
        <CommunicationPreviewModal
          nodeConfig={config}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </aside>
  );
};
