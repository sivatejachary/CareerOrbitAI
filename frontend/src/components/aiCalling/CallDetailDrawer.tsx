import React, { useState } from 'react';
import {
  X,
  PhoneCall,
  ShieldAlert,
  Ban
} from 'lucide-react';
import { CallAttemptDetail, TranscriptTurn } from '../../types/aiCalling';
import { aiCallingApi } from '../../api/aiCallingApi';

interface CallDetailDrawerProps {
  call: CallAttemptDetail | null;
  onClose: () => void;
  onUpdateCall?: () => void;
}

export const CallDetailDrawer: React.FC<CallDetailDrawerProps> = ({
  call,
  onClose,
  onUpdateCall
}) => {
  if (!call) return null;

  const [dncUpdating, setDncUpdating] = useState(false);
  const [dncSuccess, setDncSuccess] = useState(false);

  const evaluation = call.evaluation;
  const transcript = call.transcript;
  const statements = evaluation?.candidate_statements || {};
  const extractedFacts = evaluation?.extracted_facts || [];

  const handleStopContact = async () => {
    if (!call.candidate?.id) return;
    if (!confirm(`Mark ${call.phone_number} as DO NOT CALL / STOP CONTACT? Future workflow calls will be blocked.`)) {
      return;
    }

    setDncUpdating(true);
    try {
      await aiCallingApi.updateStopContact({
        candidate_id: call.candidate.id,
        phone_number: call.phone_number,
        stop_contact: true,
        do_not_call: true,
        reason: 'Requested by recruiter or candidate in AI Calling drawer.'
      });
      setDncSuccess(true);
      if (onUpdateCall) onUpdateCall();
    } catch (err: any) {
      alert(`Failed to set stop-contact: ${err.message}`);
    } finally {
      setDncUpdating(false);
    }
  };

  const formatSeconds = (sec?: number) => {
    if (!sec) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Call Record #{call.id.slice(-6)}
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {call.candidate?.full_name || 'Candidate Call'}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-slate-700">
        {/* Call Summary Banner */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Disposition</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">{call.disposition || 'Pending'}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Duration</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">{formatSeconds(call.duration_seconds)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Attempt</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">Attempt {call.attempt_number}</div>
          </div>
        </div>

        {/* Candidate & Role Info */}
        <div className="space-y-2 p-3.5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">Target Role:</span>
            <span className="text-slate-900 font-medium">{call.job?.title || 'Unknown Job'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">Dialed Number:</span>
            <span className="font-mono text-slate-800 font-semibold">{call.phone_number}</span>
          </div>
          {call.provider_call_id && (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">ElevenLabs Call ID:</span>
              <span className="font-mono text-[10px] text-slate-500">{call.provider_call_id}</span>
            </div>
          )}
        </div>

        {/* Stop Contact Notice if requested */}
        {statements.stop_contact_requested && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800">
            <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-rose-900">Stop-Contact Requested by Candidate</div>
              <p className="text-[11px] mt-0.5">
                The candidate explicitly indicated they do not wish to be contacted further.
              </p>
            </div>
          </div>
        )}

        {/* Extracted Facts Card */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Extracted Facts & Candidate Statements
            </h3>
            <span className="text-[10px] text-slate-400">Non-biased fact verification</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="text-[10px] text-slate-500 font-medium uppercase">Interest Level</div>
              <div className="text-xs font-bold text-slate-900 mt-1">
                {statements.interest || 'Not recorded'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="text-[10px] text-slate-500 font-medium uppercase">Notice Period</div>
              <div className="text-xs font-bold text-slate-900 mt-1">
                {statements.notice_period || 'Not recorded'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="text-[10px] text-slate-500 font-medium uppercase">Current Compensation</div>
              <div className="text-xs font-bold text-slate-900 mt-1">
                {statements.current_ctc || 'Not recorded'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="text-[10px] text-slate-500 font-medium uppercase">Expected CTC</div>
              <div className="text-xs font-bold text-slate-900 mt-1">
                {statements.ctc_expectation || 'Not recorded'}
              </div>
            </div>
          </div>

          {/* Additional Extracted Facts */}
          {extractedFacts.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <span className="font-semibold text-slate-700 text-[11px]">Verbatim Excerpts:</span>
              {extractedFacts.map((fact, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-blue-700">{fact.key}</span>
                    <span className="font-bold text-slate-800">{fact.value}</span>
                  </div>
                  {fact.excerpt && (
                    <p className="text-[10px] text-slate-500 italic">"{fact.excerpt}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full Transcript Turns */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Call Transcript
            </h3>
            {transcript?.turns && (
              <span className="text-[10px] text-slate-500">{transcript.turns.length} turns recorded</span>
            )}
          </div>

          {!transcript || !transcript.turns || transcript.turns.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
              {call.operation_state === 'Scheduled'
                ? 'Call is scheduled. Transcript will populate once call completes.'
                : 'No audio transcript captured for this call attempt.'}
            </div>
          ) : (
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200 max-h-96 overflow-y-auto custom-scrollbar">
              {transcript.turns.map((turn: TranscriptTurn, idx: number) => {
                const isAgent = turn.speaker === 'agent';
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {isAgent ? 'ElevenLabs AI Agent' : call.candidate?.full_name || 'Candidate'}
                      </span>
                      {turn.timestamp_secs !== undefined && (
                        <span className="text-[9px] text-slate-400">
                          {Math.floor(turn.timestamp_secs)}s
                        </span>
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                        isAgent
                          ? 'bg-blue-600 text-white rounded-tl-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tr-xs shadow-xs'
                      }`}
                    >
                      {turn.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={handleStopContact}
          disabled={dncUpdating || dncSuccess}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-colors"
        >
          <Ban className="w-3.5 h-3.5 text-rose-600" />
          <span>{dncSuccess ? 'Contact Blocked' : 'Stop Contact (DNC)'}</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
