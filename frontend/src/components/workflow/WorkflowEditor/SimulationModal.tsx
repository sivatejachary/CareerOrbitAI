import React, { useState } from 'react';
import {
  X,
  Play,
  Info
} from 'lucide-react';
import { WorkflowStepItem } from '../../../types/workflow';

interface SimulationModalProps {
  steps: WorkflowStepItem[];
  workflowName: string;
  onClose: () => void;
}

type SimulationScenario = 'strong' | 'borderline' | 'unresponsive' | 'declined';

export const SimulationModal: React.FC<SimulationModalProps> = ({
  steps,
  workflowName,
  onClose
}) => {
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario>('strong');

  const scenarios: { id: SimulationScenario; label: string; description: string; score: number }[] = [
    {
      id: 'strong',
      label: 'High-Scoring Candidate',
      description: 'Scores 92% on screening, answers AI phone call, confirms interest, and books interview slot.',
      score: 92
    },
    {
      id: 'borderline',
      label: 'Borderline Candidate',
      description: 'Scores 64% on screening, triggers condition branch to Recruiter Human Review ("Waiting for recruiter").',
      score: 64
    },
    {
      id: 'unresponsive',
      label: 'Unreachable Candidate',
      description: 'Passes resume screening, but misses all 3 AI call attempts. Triggers recruiter fallback task.',
      score: 85
    },
    {
      id: 'declined',
      label: 'Withdrawn Candidate',
      description: 'Declines the role during the initial phone call due to salary expectations or notice period.',
      score: 79
    }
  ];

  const getSimulatedSteps = () => {
    return steps.map((step, idx) => {
      let candidateExperience = '';
      let responsibleParty = 'Hiring System';
      let outcome = 'Proceeds to next stage';

      switch (step.type) {
        case 'APPLICATION_RECEIVED':
          responsibleParty = 'Intake Automation';
          candidateExperience = 'Submits application form with resume file. Receives instant submission confirmation.';
          outcome = 'Parsed resume saved to private storage. Candidate profile enrolled.';
          break;

        case 'AI_RESUME_SCREENING':
          responsibleParty = 'Groq AI Screening Engine';
          if (selectedScenario === 'strong') {
            candidateExperience = 'Background evaluation runs without candidate interaction.';
            outcome = 'Match Score: 92% (Pass). Shortlisted for conversational interview round.';
          } else if (selectedScenario === 'borderline') {
            candidateExperience = 'Background evaluation runs without candidate interaction.';
            outcome = 'Match Score: 64% (Review). Routes to recruiter review branch.';
          } else {
            candidateExperience = 'Background evaluation runs without candidate interaction.';
            outcome = 'Match Score: 85% (Pass). Eligible for outreach.';
          }
          break;

        case 'CONDITION':
          responsibleParty = 'Workflow Decision Engine';
          if (selectedScenario === 'borderline') {
            candidateExperience = 'Evaluation routed internally.';
            outcome = 'Branch taken: "Needs recruiter review".';
          } else {
            candidateExperience = 'Evaluation routed internally.';
            outcome = 'Branch taken: "Meets shortlist policy".';
          }
          break;

        case 'AI_CALLING':
          responsibleParty = 'ElevenLabs Conversational Voice AI';
          if (selectedScenario === 'strong') {
            candidateExperience = 'Receives phone call: "Hi Alex, calling from CareerOrbitAI regarding your Senior Engineer application. Is this a good time to speak?"';
            outcome = 'Candidate confirms availability, notice period, and selects an interview slot.';
          } else if (selectedScenario === 'unresponsive') {
            candidateExperience = 'Phone dials 3 times across 2 business days. Call unanswered / busy.';
            outcome = 'All retry attempts exhausted. Recruiter task created: "Waiting for recruiter".';
          } else if (selectedScenario === 'declined') {
            candidateExperience = 'Answers call but states compensation expectations exceed the approved budget.';
            outcome = 'Outcome: WITHDRAWN. System records polite exit note and closes execution.';
          } else {
            candidateExperience = 'Awaits recruiter sign-off before scheduling call.';
            outcome = 'Waiting for recruiter approval.';
          }
          break;

        case 'HR_REVIEW':
          responsibleParty = 'HR Lead Recruiter';
          candidateExperience = 'Candidate awaits hiring team feedback.';
          outcome = selectedScenario === 'borderline'
            ? 'Recruiter inspects resume match score (64%) and marks Approved for second look.'
            : 'Recruiter approves candidate progression.';
          break;

        case 'INTERVIEW':
          responsibleParty = 'Engineering Lead / Panel';
          candidateExperience = 'Candidate attends 45-minute technical video round via Google Meet.';
          outcome = 'Interviewer records STRONG_HIRE recommendation with rubric notes.';
          break;

        case 'HR_FINAL_DECISION':
          responsibleParty = 'Hiring Director & HR Lead';
          candidateExperience = 'Candidate awaits formal hiring decision.';
          outcome = selectedScenario === 'declined'
            ? 'File marked Closed / Withdrawn.'
            : 'Human recruiter approves formal employment offer.';
          break;

        case 'END':
          responsibleParty = 'System';
          candidateExperience = 'Hiring process reaches formal completion.';
          outcome = 'Workflow completed successfully.';
          break;

        default:
          candidateExperience = 'Step executes per configured policy.';
          outcome = 'Proceeds.';
      }

      return {
        step,
        index: idx + 1,
        responsibleParty,
        candidateExperience,
        outcome
      };
    });
  };

  const simulated = getSimulatedSteps();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-xl shadow-drawer border border-border-subtle w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-workspace">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-interactive-blue/10 text-interactive-blue">
              <Play className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                Workflow Path Preview & Simulation
              </h3>
              <p className="text-xs text-text-secondary">
                Verify what happens next, who is responsible, and what the candidate hears in {workflowName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-border-subtle transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prominent Non-destructive Notice */}
        <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-200 text-blue-900 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 text-interactive-blue shrink-0" />
          <span>
            <strong>Simulation Mode:</strong> No real phone calls, messages, or calendar bookings will occur.
          </span>
        </div>

        {/* Candidate Scenario Selector */}
        <div className="px-6 py-3 border-b border-border-subtle bg-white">
          <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wide mb-2">
            Select Test Candidate Scenario
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {scenarios.map(sc => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelectedScenario(sc.id)}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                  selectedScenario === sc.id
                    ? 'border-interactive-blue bg-interactive-blue/5 ring-1 ring-interactive-blue'
                    : 'border-border-subtle hover:border-text-secondary bg-white'
                }`}
              >
                <div className="font-bold text-text-primary">{sc.label}</div>
                <div className="text-[10px] text-text-secondary mt-0.5 line-clamp-2 leading-tight">
                  {sc.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Simulation Walkthrough */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-text-primary bg-workspace/50">
          <div className="space-y-3">
            {simulated.map(({ step, index, responsibleParty, candidateExperience, outcome }) => (
              <div
                key={step.id}
                className="p-4 rounded-xl border border-border-subtle bg-white shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-workspace border border-border-subtle text-[11px] font-mono font-bold flex items-center justify-center text-text-primary">
                      {index}
                    </span>
                    <span className="font-bold text-sm text-text-primary">{step.title}</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-workspace border border-border-subtle font-medium text-text-secondary">
                    Responsible: <strong className="text-text-primary">{responsibleParty}</strong>
                  </span>
                </div>

                {/* Candidate Experience */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">
                    What the Candidate Hears / Sees:
                  </div>
                  <p className="text-xs text-text-primary italic bg-workspace p-2 rounded-lg border border-border-subtle">
                    "{candidateExperience}"
                  </p>
                </div>

                {/* Simulated Outcome */}
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-text-secondary">What happens next:</span>
                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {outcome}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border-subtle bg-white flex items-center justify-between">
          <div className="text-xs text-text-secondary">
            Simulated <strong>{simulated.length} steps</strong> against scenario "{scenarios.find(s => s.id === selectedScenario)?.label}"
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-interactive-blue hover:bg-brand-navy text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
