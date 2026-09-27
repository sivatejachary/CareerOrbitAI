import { useDialogFocus } from '../../hooks/useDialogFocus';
import React, { useState } from 'react';
import {
  X,
  PhoneCall,
  AlertCircle,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { aiCallingApi } from '../../api/aiCallingApi';

interface InitiateCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const InitiateCallModal: React.FC<InitiateCallModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {

  const dialogRef = useDialogFocus(isOpen, onClose);
  const [candidateId, setCandidateId] = useState('');
  const [jobId, setJobId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customGreeting, setCustomGreeting] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !candidateId.trim() || !jobId.trim()) {
      setError('Please fill in candidate ID, job ID, and phone number.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await aiCallingApi.initiateCall({
        candidate_id: candidateId.trim(),
        job_id: jobId.trim(),
        phone_number: phoneNumber.trim(),
        custom_first_message: customGreeting.trim() || undefined
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Call initiation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Start a single AI call" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-xl shadow-dropdown max-w-md w-full p-6 space-y-4 border border-slate-200">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <PhoneCall className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Initiate Outbound AI Call</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Initiation Blocked</div>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs text-slate-700">
          <div className="space-y-1">
            <label className="font-semibold text-slate-800">Candidate ID</label>
            <input
              type="text"
              required
              placeholder="e.g. cand_123456"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-800">Job ID</label>
            <input
              type="text"
              required
              placeholder="e.g. job_123456"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-800">Phone Number (E.164 standard)</label>
            <input
              type="tel"
              required
              placeholder="+1234567890 or +919876543210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
            />
            <p className="text-[10px] text-slate-400">Must include country code starting with +</p>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-800">First Greeting (Optional)</label>
            <textarea
              rows={2}
              placeholder="Hi, this is CareerOrbitAI calling to discuss your application..."
              value={customGreeting}
              onChange={(e) => setCustomGreeting(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Compliance note */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2 text-[10px] text-slate-600">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Pre-call checks will verify that this phone number is not on the Stop Contact (DNC) list and that no concurrent call is currently active.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
              <span>Initiate Call</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
