import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Sparkles,
  UserCheck,
  CalendarCheck,
  PhoneCall,
  Mail,
  Clock,
  GitBranch,
  ShieldCheck,
  ClipboardList,
  Code2,
  AlertCircle,
  Star
} from 'lucide-react';
import { WorkflowNodeType } from '../../../types/workflow';

export type StepCategory =
  | 'Screening'
  | 'Human review'
  | 'Interviews'
  | 'Communication'
  | 'Timing'
  | 'Decisions'
  | 'Other';

export interface StepMenuItem {
  type: WorkflowNodeType;
  title: string;
  category: StepCategory;
  description: string;
  icon: React.ElementType;
  isCommon?: boolean;
  setupRequiredMessage?: string;
  defaultConfig: Record<string, any>;
}

export const MENU_STEP_ITEMS: StepMenuItem[] = [
  // 1. Screening
  {
    type: 'AI_RESUME_SCREENING',
    title: 'Screen resume',
    category: 'Screening',
    description: 'Compare skills, verified experience, and qualifications with this job.',
    icon: Sparkles,
    isCommon: true,
    defaultConfig: {
      min_score_shortlist: 75,
      min_score_review: 50,
      require_experience_match: true,
      weight_skills: 0.5,
      weight_experience: 0.5
    }
  },
  {
    type: 'ASSESSMENT',
    title: 'Skills assessment',
    category: 'Screening',
    description: 'Administer an online coding challenge or standardized skill evaluation.',
    icon: Code2,
    setupRequiredMessage: 'Setup required: Connect HackerRank or Codility API in Settings',
    defaultConfig: {
      title: 'Skills Assessment',
      provider: 'External Provider',
      duration_minutes: 60,
      pass_threshold: 70
    }
  },

  // 2. Human review
  {
    type: 'HR_REVIEW',
    title: 'Recruiter review',
    category: 'Human review',
    description: 'Recruiter evaluates candidate qualifications and decides next step.',
    icon: UserCheck,
    isCommon: true,
    defaultConfig: {
      title: 'Recruiter Review',
      instructions: 'Review candidate profile, resume highlights, and screening notes.',
      due_in_hours: 24,
      allowed_outcomes: ['APPROVED', 'REJECTED', 'HOLD']
    }
  },
  {
    type: 'HR_REVIEW',
    title: 'Hiring manager review',
    category: 'Human review',
    description: 'Assign department lead to inspect portfolio and authorize interview rounds.',
    icon: UserCheck,
    defaultConfig: {
      title: 'Hiring Manager Review',
      instructions: 'Review candidate background and confirm technical evaluation suitability.',
      due_in_hours: 48,
      allowed_outcomes: ['APPROVED', 'REJECTED', 'HOLD']
    }
  },

  // 3. Interviews
  {
    type: 'INTERVIEW',
    title: 'Technical interview',
    category: 'Interviews',
    description: 'Conduct structured technical or coding round with engineering interviewer.',
    icon: CalendarCheck,
    isCommon: true,
    defaultConfig: {
      title: 'Technical Interview',
      round_name: 'Technical Round',
      interview_format: 'Video Call (Google Meet)',
      interviewer_role: 'Lead Engineer',
      duration_minutes: 45,
      due_in_hours: 48,
      allowed_outcomes: ['STRONG_HIRE', 'HIRE', 'LEAN_HIRE', 'NO_HIRE']
    }
  },
  {
    type: 'INTERVIEW',
    title: 'Video screening interview',
    category: 'Interviews',
    description: 'Recruiter video or phone conversation exploring role motivation and career trajectory.',
    icon: CalendarCheck,
    defaultConfig: {
      title: 'Recruiter Video Screen',
      round_name: 'Screening Round',
      interview_format: 'Video Call (Google Meet)',
      interviewer_role: 'Senior Recruiter',
      duration_minutes: 30,
      due_in_hours: 48,
      allowed_outcomes: ['APPROVED', 'REJECTED']
    }
  },
  {
    type: 'INTERVIEW',
    title: 'Culture & leadership interview',
    category: 'Interviews',
    description: 'Evaluate cross-functional collaboration, communication, and team alignment.',
    icon: CalendarCheck,
    defaultConfig: {
      title: 'Culture & Leadership Round',
      round_name: 'Executive Round',
      interview_format: 'Video Call (Google Meet)',
      interviewer_role: 'Department Director',
      duration_minutes: 45,
      due_in_hours: 72,
      allowed_outcomes: ['STRONG_HIRE', 'HIRE', 'LEAN_HIRE', 'NO_HIRE']
    }
  },

  // 4. Communication
  {
    type: 'AI_CALLING',
    title: 'Initial screening call',
    category: 'Communication',
    description: 'Conversational voice call to verify role interest, availability, and notice period.',
    icon: PhoneCall,
    isCommon: true,
    defaultConfig: {
      title: 'Initial Screening Call',
      purpose: 'INITIAL_SCREENING',
      max_attempts: 3,
      retry_interval_minutes: 240,
      required_approval: false,
      allowed_actions: ['record_answers', 'request_callback'],
      first_message_template: 'Hi {{candidate_name}}, calling from {{company_name}} regarding your application for {{job_title}}. Do you have a couple of minutes to confirm your availability?'
    }
  },
  {
    type: 'AI_CALLING',
    title: 'Result & scheduling call',
    category: 'Communication',
    description: 'Tell candidate approved interview result and offer calendar slots for next round.',
    icon: PhoneCall,
    defaultConfig: {
      title: 'Result & Next Round Offer',
      purpose: 'RESULT_AND_SCHEDULING',
      max_attempts: 2,
      retry_interval_minutes: 180,
      required_approval: true,
      allowed_actions: ['book_interview_slot', 'record_answers', 'request_callback'],
      first_message_template: 'Hi {{candidate_name}}, great news from {{company_name}}! The team was impressed with your recent interview for {{job_title}} and would like to invite you to the next round. Can we look at some times?'
    }
  },
  {
    type: 'AI_CALLING',
    title: 'Interview reminder call',
    category: 'Communication',
    description: 'Pre-interview automated check-in 24 hours prior to scheduled meeting.',
    icon: PhoneCall,
    defaultConfig: {
      title: 'Interview Reminder',
      purpose: 'INTERVIEW_REMINDER',
      max_attempts: 2,
      retry_interval_minutes: 120,
      required_approval: false,
      allowed_actions: ['request_callback'],
      first_message_template: 'Hi {{candidate_name}}, this is a quick reminder about your upcoming interview with {{company_name}} tomorrow for {{job_title}}. Looking forward to speaking with you!'
    }
  },
  {
    type: 'AI_CALLING',
    title: 'Final selection call',
    category: 'Communication',
    description: 'Communicate approved hiring decision with mandatory recruiter authorization.',
    icon: PhoneCall,
    defaultConfig: {
      title: 'Final Selection Notification',
      purpose: 'FINAL_SELECTION_NOTIFICATION',
      max_attempts: 2,
      retry_interval_minutes: 240,
      required_approval: true,
      allowed_actions: ['request_callback'],
      first_message_template: 'Hi {{candidate_name}}, calling with an update on your candidacy for {{job_title}} at {{company_name}}.'
    }
  },
  {
    type: 'SEND_MESSAGE',
    title: 'Send message (Email/SMS)',
    category: 'Communication',
    description: 'Automated email or SMS notification dispatched at specific hiring milestones.',
    icon: Mail,
    isCommon: true,
    defaultConfig: {
      title: 'Automated Email Notification',
      channel: 'EMAIL',
      subject: 'Update on your application for {{job_title}}',
      template_body: 'Dear {{candidate_name}},\n\nThank you for taking the time to speak with our team. We are pleased to share an update on your candidacy...'
    }
  },

  // 5. Timing
  {
    type: 'WAIT_DELAY',
    title: 'Wait delay',
    category: 'Timing',
    description: 'Pause progression for a set window (e.g. 24h) before the next automated action.',
    icon: Clock,
    defaultConfig: {
      title: 'Wait 24 Hours',
      delay_hours: 24,
      business_days_only: false
    }
  },

  // 6. Decisions
  {
    type: 'CONDITION',
    title: 'Condition branch',
    category: 'Decisions',
    description: 'Route candidates down different paths based on resume score or interview rubric.',
    icon: GitBranch,
    defaultConfig: {
      title: 'Shortlist Policy Decision',
      branches: [
        {
          id: 'branch_1',
          name: 'Meets shortlist policy',
          is_default: false,
          condition_logic: 'AND',
          rules: [{ id: 'r_1', field: 'screening.score', operator: 'greater_than_or_equal', value: 75 }],
          missing_data_action: 'PAUSE_FOR_RECRUITER',
          rejoin_type: 'REJOIN_MAIN',
          sub_steps: []
        },
        {
          id: 'branch_2',
          name: 'Otherwise (Recruiter review)',
          is_default: true,
          condition_logic: 'AND',
          rules: [],
          missing_data_action: 'PAUSE_FOR_RECRUITER',
          rejoin_type: 'REJOIN_MAIN',
          sub_steps: []
        }
      ]
    }
  },
  {
    type: 'HR_FINAL_DECISION',
    title: 'Final hiring decision',
    category: 'Decisions',
    description: 'Enforces human recruiter authorization before generating offer letter or rejection.',
    icon: ShieldCheck,
    isCommon: true,
    defaultConfig: {
      title: 'Final Hiring Decision',
      signoff_authority: 'Lead Recruiter',
      allowed_outcomes: ['OFFER', 'REJECT', 'HOLD']
    }
  },

  // 7. Other
  {
    type: 'MANUAL_TASK',
    title: 'Manual task',
    category: 'Other',
    description: 'Assign operational checklist item such as reference check or credential check.',
    icon: ClipboardList,
    defaultConfig: {
      title: 'Reference Verification',
      instructions: 'Verify professional references and past employment history.',
      due_in_hours: 48,
      priority: 'Medium'
    }
  },
  {
    type: 'CANDIDATE_AVAILABILITY',
    title: 'Candidate availability',
    category: 'Other',
    description: 'Request available interview timeslots from candidate.',
    icon: CalendarCheck,
    defaultConfig: {
      title: 'Collect Availability',
      window_days: 5,
      slot_duration_minutes: 45
    }
  }
];

const CATEGORIES: StepCategory[] = [
  'Screening',
  'Human review',
  'Interviews',
  'Communication',
  'Timing',
  'Decisions',
  'Other'
];

interface AddStepMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStep: (item: StepMenuItem) => void;
  insertPosition: number;
}

export const AddStepMenu: React.FC<AddStepMenuProps> = ({
  isOpen,
  onClose,
  onSelectStep,
  insertPosition
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<StepCategory | 'All'>('All');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
      setSelectedCategory('All');
    }
  }, [isOpen]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let items = MENU_STEP_ITEMS;
    if (selectedCategory !== 'All') {
      items = items.filter(i => i.category === selectedCategory);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        i =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [searchTerm, selectedCategory]);

  const commonItems = useMemo(() => {
    return MENU_STEP_ITEMS.filter(i => i.isCommon);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-step-dialog-title"
      className="fixed inset-0 z-50 bg-brand-navy/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-drawer border border-border-subtle max-w-xl w-full flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header with Search */}
        <div className="p-4 border-b border-border-subtle bg-workspace space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="add-step-dialog-title" className="text-sm font-bold text-text-primary">
              Add Step at Position {insertPosition}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-border-subtle transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search steps (e.g., screening, interview, call, review)..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-border-subtle rounded-lg text-text-primary placeholder-[#5B6C7D] focus:outline-none focus:ring-2 focus:ring-interactive-blue/30 focus:border-interactive-blue"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`px-2.5 py-1 rounded-full font-medium shrink-0 transition-colors ${
                selectedCategory === 'All'
                  ? 'bg-interactive-blue text-white'
                  : 'bg-white text-text-secondary border border-border-subtle hover:bg-workspace'
              }`}
            >
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full font-medium shrink-0 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-interactive-blue text-white'
                    : 'bg-white text-text-secondary border border-border-subtle hover:bg-workspace'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Common Steps First (Only when no search and on 'All') */}
          {!searchTerm && selectedCategory === 'All' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Common Steps</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {commonItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.title + item.category}
                      type="button"
                      onClick={() => {
                        onSelectStep(item);
                        onClose();
                      }}
                      className="p-2.5 rounded-lg border border-border-subtle hover:border-interactive-blue hover:bg-blue-50/20 text-left transition-all flex items-start gap-2.5 group"
                    >
                      <div className="p-1.5 rounded-md bg-workspace border border-border-subtle text-interactive-blue group-hover:bg-interactive-blue group-hover:text-white transition-colors shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text-primary group-hover:text-interactive-blue">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grouped or Filtered Results */}
          {selectedCategory === 'All' && !searchTerm ? (
            CATEGORIES.map(category => {
              const catItems = MENU_STEP_ITEMS.filter(i => i.category === category);
              if (catItems.length === 0) return null;
              return (
                <div key={category} className="space-y-2">
                  <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                    {category}
                  </div>
                  <div className="space-y-1.5">
                    {catItems.map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.title + item.category}
                          type="button"
                          onClick={() => {
                            onSelectStep(item);
                            onClose();
                          }}
                          className="w-full p-2.5 rounded-lg border border-border-subtle hover:border-interactive-blue hover:bg-workspace text-left transition-all flex items-start justify-between gap-3 group"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-md bg-workspace border border-border-subtle text-interactive-blue group-hover:bg-white transition-colors shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-text-primary group-hover:text-interactive-blue">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">
                                {item.description}
                              </div>
                            </div>
                          </div>

                          {item.setupRequiredMessage && (
                            <span
                              title={item.setupRequiredMessage}
                              className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded-md shrink-0 flex items-center gap-1"
                            >
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>Setup required</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="space-y-1.5">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-secondary">
                  No steps found matching "{searchTerm}".
                </div>
              ) : (
                filteredItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.title + item.category}
                      type="button"
                      onClick={() => {
                        onSelectStep(item);
                        onClose();
                      }}
                      className="w-full p-2.5 rounded-lg border border-border-subtle hover:border-interactive-blue hover:bg-workspace text-left transition-all flex items-start justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-workspace border border-border-subtle text-interactive-blue group-hover:bg-white transition-colors shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-text-primary group-hover:text-interactive-blue">
                              {item.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-workspace border border-border-subtle text-text-secondary">
                              {item.category}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">
                            {item.description}
                          </div>
                        </div>
                      </div>

                      {item.setupRequiredMessage && (
                        <span
                          title={item.setupRequiredMessage}
                          className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded-md shrink-0 flex items-center gap-1"
                        >
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>Setup required</span>
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
