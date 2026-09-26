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
  Search,
  Plus,
  AlertCircle
} from 'lucide-react';
import { WorkflowNodeType } from '../../../types/workflow';

export interface StepLibraryItem {
  type: WorkflowNodeType;
  title: string;
  category: 'Screening & Assessment' | 'Interviews & Review' | 'Communication & Scheduling' | 'Logic & Flow';
  purpose: string;
  icon: React.ElementType;
  isAvailable: boolean;
  setupRequiredMessage?: string;
  defaultConfig: Record<string, any>;
}

export const STEP_LIBRARY_ITEMS: StepLibraryItem[] = [
  {
    type: 'AI_RESUME_SCREENING',
    title: 'Screen resume',
    category: 'Screening & Assessment',
    purpose: 'Evaluates resume skills, verified experience, and qualifications against job requirements.',
    icon: Sparkles,
    isAvailable: true,
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
    title: 'Assessment',
    category: 'Screening & Assessment',
    purpose: 'Administers an online skill evaluation or coding challenge.',
    icon: Code2,
    isAvailable: true,
    setupRequiredMessage: 'Setup required: Add challenge link or connect assessment platform',
    defaultConfig: {
      title: 'Technical Assessment',
      provider: 'External',
      duration_minutes: 60,
      pass_threshold: 70
    }
  },
  {
    type: 'HR_REVIEW',
    title: 'Recruiter review',
    category: 'Interviews & Review',
    purpose: 'Assigns an HR recruiter to inspect candidate qualifications and record a decision.',
    icon: UserCheck,
    isAvailable: true,
    defaultConfig: {
      title: 'Recruiter Review',
      instructions: 'Review candidate application profile, resume match, and screening notes.',
      due_in_hours: 24,
      allowed_outcomes: ['APPROVED', 'REJECTED', 'HOLD']
    }
  },
  {
    type: 'INTERVIEW',
    title: 'Interview',
    category: 'Interviews & Review',
    purpose: 'Coordinates an interview round (technical, hiring manager, or panel).',
    icon: CalendarCheck,
    isAvailable: true,
    defaultConfig: {
      title: 'Technical Interview - Round 1',
      round_name: 'Technical Round',
      interview_format: 'Video Call (Google Meet)',
      interviewer_role: 'Lead Engineer',
      duration_minutes: 45,
      due_in_hours: 48,
      allowed_outcomes: ['STRONG_HIRE', 'HIRE', 'LEAN_HIRE', 'NO_HIRE']
    }
  },
  {
    type: 'MANUAL_TASK',
    title: 'Manual task',
    category: 'Interviews & Review',
    purpose: 'Assigns operational checklists such as background checks or reference verification.',
    icon: ClipboardList,
    isAvailable: true,
    defaultConfig: {
      title: 'Background Verification',
      instructions: 'Verify prior employment history and professional references.',
      priority: 'Medium',
      due_in_hours: 48
    }
  },
  {
    type: 'HR_FINAL_DECISION',
    title: 'Final hiring decision',
    category: 'Interviews & Review',
    purpose: 'Enforces authorized human recruiter sign-off before offer extension or rejection.',
    icon: ShieldCheck,
    isAvailable: true,
    defaultConfig: {
      title: 'Final Hiring Decision',
      signoff_authority: 'Lead Recruiter',
      allowed_outcomes: ['OFFER', 'REJECT', 'HOLD']
    }
  },
  {
    type: 'AI_CALLING',
    title: 'AI phone call',
    category: 'Communication & Scheduling',
    purpose: 'Conducts an automated voice call with an explicit candidate communication purpose.',
    icon: PhoneCall,
    isAvailable: true,
    defaultConfig: {
      purpose: 'INITIAL_SCREENING',
      step_name: 'Candidate Qualification Call',
      call_purpose: 'Initial qualification & availability verification',
      required_approval: false,
      first_message_template: "Hi {{candidate_name}}, I'm calling from {{company_name}} regarding your application for the {{job_title}} role. Is this a good time to speak?",
      max_attempts: 3,
      retry_interval_minutes: 240,
      allowed_actions: ['record_answers', 'request_callback', 'book_interview_slot']
    }
  },
  {
    type: 'CANDIDATE_AVAILABILITY',
    title: 'Schedule interview',
    category: 'Communication & Scheduling',
    purpose: 'Coordinates calendar availability and books interview slots without double-booking.',
    icon: CalendarCheck,
    isAvailable: true,
    defaultConfig: {
      title: 'Coordinate Interview Slot',
      slot_duration_minutes: 45,
      window_days: 5,
      fallback_to_recruiter: true
    }
  },
  {
    type: 'SEND_MESSAGE',
    title: 'Send message',
    category: 'Communication & Scheduling',
    purpose: 'Dispatches automated email or SMS notifications regarding application milestones.',
    icon: Mail,
    isAvailable: true,
    setupRequiredMessage: 'Setup required: Connect email or SMS delivery provider in Settings',
    defaultConfig: {
      channel: 'EMAIL',
      subject: 'Update on your application with {{company_name}}',
      template_content: 'Hi {{candidate_name}}, thank you for your patience while our team reviews your application.'
    }
  },
  {
    type: 'CONDITION',
    title: 'Condition',
    category: 'Logic & Flow',
    purpose: 'Routes candidates down different paths based on transparent, objective rules.',
    icon: GitBranch,
    isAvailable: true,
    defaultConfig: {
      branches: [
        {
          branch_name: 'Meets shortlist policy',
          condition_logic: 'AND',
          rules: [{ field_path: 'screening.score', operator: 'greater_than_or_equal', value: 75 }],
          is_default: false,
          missing_data_action: 'PAUSE_FOR_RECRUITER'
        },
        {
          branch_name: 'Needs recruiter review',
          condition_logic: 'AND',
          rules: [{ field_path: 'screening.score', operator: 'greater_than_or_equal', value: 50 }],
          is_default: false,
          missing_data_action: 'PAUSE_FOR_RECRUITER'
        },
        {
          branch_name: 'Otherwise',
          condition_logic: 'AND',
          rules: [],
          is_default: true,
          missing_data_action: 'PAUSE_FOR_RECRUITER'
        }
      ]
    }
  },
  {
    type: 'WAIT_DELAY',
    title: 'Wait',
    category: 'Logic & Flow',
    purpose: 'Pauses hiring progression for a designated duration (e.g. 24 hours).',
    icon: Clock,
    isAvailable: true,
    defaultConfig: {
      delay_hours: 24,
      delay_minutes: 0
    }
  },
  {
    type: 'END',
    title: 'End process',
    category: 'Logic & Flow',
    purpose: 'Concludes the hiring workflow execution for a candidate.',
    icon: CheckCircle2,
    isAvailable: true,
    defaultConfig: {}
  }
];

interface StepLibraryProps {
  onAddStep: (item: StepLibraryItem) => void;
  className?: string;
}

export const StepLibrary: React.FC<StepLibraryProps> = ({ onAddStep, className = '' }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = STEP_LIBRARY_ITEMS.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories: StepLibraryItem['category'][] = [
    'Screening & Assessment',
    'Interviews & Review',
    'Communication & Scheduling',
    'Logic & Flow'
  ];

  return (
    <aside
      aria-label="Step Library"
      className={`w-[240px] shrink-0 bg-white border-r border-[#DDE4EB] flex flex-col h-full select-none ${className}`}
    >
      {/* Search Header */}
      <div className="p-3 border-b border-[#DDE4EB]">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-bold text-[#192D42] uppercase tracking-wider">
            Step Library
          </h2>
          <span className="text-[11px] text-[#5B6C7D]">
            {filteredItems.length} steps
          </span>
        </div>
        <p className="text-[11px] text-[#5B6C7D] mb-2 leading-tight">
          Select or add an action to your hiring workflow sequence
        </p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#5B6C7D] absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search steps..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-[#F6F8FB] border border-[#DDE4EB] rounded-lg text-[#192D42] placeholder-[#5B6C7D] focus:outline-none focus:ring-1 focus:ring-[#245FAD]"
          />
        </div>
      </div>

      {/* Pinned Start Step Reminder */}
      <div className="px-3 pt-2.5 pb-2 border-b border-[#DDE4EB] bg-[#F6F8FB]/60">
        <div className="flex items-center gap-2 text-[11px] text-[#5B6C7D]">
          <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">
            Pinned: <strong className="text-[#192D42]">Candidate applies</strong>
          </span>
        </div>
      </div>

      {/* Categorized Steps */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {categories.map(category => {
          const items = filteredItems.filter(i => i.category === category);
          if (items.length === 0) return null;

          return (
            <div key={category} className="space-y-1.5">
              <div className="text-[10px] font-bold text-[#5B6C7D] uppercase tracking-wider px-1">
                {category}
              </div>
              <div className="space-y-1">
                {items.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type + item.title}
                      type="button"
                      onClick={() => onAddStep(item)}
                      className="w-full text-left p-2 rounded-lg border border-transparent hover:border-[#DDE4EB] hover:bg-[#F6F8FB] transition-all group flex flex-col gap-1 focus:outline-none focus:ring-2 focus:ring-[#245FAD]"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1 rounded-md bg-[#F6F8FB] text-[#245FAD] group-hover:bg-[#245FAD] group-hover:text-white transition-colors shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-semibold text-[#192D42] group-hover:text-[#245FAD] truncate">
                            {item.title}
                          </span>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-[#5B6C7D] group-hover:text-[#245FAD] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      <p className="text-[11px] text-[#5B6C7D] line-clamp-2 leading-snug pl-0.5">
                        {item.purpose}
                      </p>
                      {item.setupRequiredMessage && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span className="truncate">Setup required</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
