import { useDialogFocus } from '../../hooks/useDialogFocus';
import React, { useState } from 'react';
import {
  X,
  Rocket,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Phone
} from 'lucide-react';
import { JobEligibilityResponse } from '../../types/aiCalling';

interface BatchConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: {
    max_concurrent_calls: number;
    call_delay_seconds: number;
    max_attempts_per_candidate: number;
  }) => void;
  eligibilityData: JobEligibilityResponse | null;
  loading: boolean;
}

export const BatchConfirmationModal: React.FC<BatchConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  eligibilityData,
  loading
}) => {
  const dialogRef = useDialogFocus(isOpen, onClose);
  const [maxConcurrent, setMaxConcurrent] = useState<number>(3);
  const [callDelay, setCallDelay] = useState<number>(10);
  const [maxAttempts, setMaxAttempts] = useState<number>(2);
  const [showIneligible, setShowIneligible] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  if (!isOpen || !eligibilityData) return null;

  const eligibleCount = eligibilityData.eligible_count;
  const estMinutes = Math.ceil((eligibleCount * 3) / maxConcurrent);

  const handleStart = () => {
    onConfirm({
      max_concurrent_calls: maxConcurrent,
      call_delay_seconds: callDelay,
      max_attempts_per_candidate: maxAttempts
    });
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Confirm AI calling" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-menu shadow-drawer border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-workspace text-text-primary">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl backdrop-blur-md">
              <Rocket className="w-6 h-6 text-text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-text-primary flex items-center gap-2">
                Start Automatic AI Calling
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Target Role: <span className="font-semibold text-text-primary">{eligibilityData.job_title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Summary Banner */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-center">
              <div className="text-xs text-slate-500 font-medium">Eligible Candidates</div>
              <div className="text-2xl font-bold text-blue-600 mt-0.5">{eligibleCount}</div>
            </div>
            <div className="text-center border-x border-slate-200">
              <div className="text-xs text-slate-500 font-medium">Shortlisted Total</div>
              <div className="text-2xl font-bold text-slate-800 mt-0.5">{eligibilityData.shortlisted_count}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 font-medium">Estimated Time</div>
              <div className="text-2xl font-bold text-indigo-600 mt-0.5">~{estMinutes} min</div>
            </div>
          </div>

          {/* Compliance & Safeguards Guarantee */}
          <div className="flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold">Automated Guardrails Enforced</span>
              <p className="text-blue-700 leading-relaxed">
                Only candidates meeting active SHORTLISTED status with verified international numbers will be dialed.
                One-active-call-per-candidate is atomically guarded.
              </p>
            </div>
          </div>

          {/* Eligible Candidates Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Candidates to be called ({eligibleCount})
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Ordered by screening match score</span>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {eligibilityData.eligible_candidates.map((cand) => (
                <div key={cand.candidate_id} className="flex items-center justify-between p-3 hover:bg-slate-50/80 transition-colors text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">
                      {cand.candidate_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{cand.candidate_name}</div>
                      <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {cand.phone}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {cand.screening_score !== null && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[11px] border border-emerald-200">
                        {cand.screening_score}% Match
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500 capitalize">{cand.stage}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Excluded Candidates Collapsible */}
          {eligibilityData.ineligible_candidates.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setShowIneligible(!showIneligible)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-medium"
              >
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  Excluded Applications ({eligibilityData.ineligible_count})
                </span>
                {showIneligible ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showIneligible && (
                <div className="p-3 divide-y divide-slate-100 max-h-36 overflow-y-auto bg-white">
                  {eligibilityData.ineligible_candidates.map((cand) => (
                    <div key={cand.candidate_id} className="py-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-700 font-medium">{cand.candidate_name}</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-mono text-[10px]">
                        {cand.reason.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Queue Settings Collapsible */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-medium"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                Queue & Pacing Configuration
              </span>
              {showSettings ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showSettings && (
              <div className="p-4 grid grid-cols-3 gap-4 bg-white">
                <div>
                  <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                    Max Concurrent Calls
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxConcurrent}
                    onChange={(e) => setMaxConcurrent(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400">Default: 3</span>
                </div>
                <div>
                  <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                    Delay Between Calls (s)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={callDelay}
                    onChange={(e) => setCallDelay(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400">Default: 10s</span>
                </div>
                <div>
                  <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                    Max Attempts / Candidate
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400">Default: 2</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={loading || eligibleCount === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-interactive-blue hover:bg-nav-activeText text-surface rounded-xl text-xs font-bold  transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Rocket className="w-4 h-4" />
            <span>{loading ? 'Starting Batch...' : `Start Calling (${eligibleCount} Candidates)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
