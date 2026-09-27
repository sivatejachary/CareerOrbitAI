import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Volume2
} from 'lucide-react';
import { communicationApi, CommunicationPreviewResponse } from '../../../api/communicationApi';

interface Props {
  nodeConfig: Record<string, any>;
  onClose: () => void;
}

export const CommunicationPreviewModal: React.FC<Props> = ({ nodeConfig, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<CommunicationPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await communicationApi.previewCommunication({
          node_config: nodeConfig
        });
        setPreview(data);
      } catch (err: any) {
        setError(err.message || 'Failed to render communication preview');
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [nodeConfig]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-drawer border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">AI Communication Preview</h3>
              <p className="text-xs text-slate-500">
                Job workflow communication plan & verbal instructions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {loading && (
            <div className="py-12 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-500">Evaluating template variables and policy rules...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Unable to Render Preview</div>
                <div>{error}</div>
              </div>
            </div>
          )}

          {preview && (
            <div className="space-y-5">
              {/* Warning/Blocked Alert if missing variables */}
              {preview.is_blocked && (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs">Communication Step Blocked</div>
                    <div className="text-[11px] text-amber-800">{preview.block_reason}</div>
                  </div>
                </div>
              )}

              {/* 1. Why Call Happens */}
              <div className="space-y-1.5 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-900 font-semibold text-xs">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>Why This Call Takes Place</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  {preview.why_call_happens}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                  <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                    Purpose: {preview.purpose}
                  </span>
                  {preview.prerequisites.required_approval && (
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                      Requires Human Decision Approval
                    </span>
                  )}
                </div>
              </div>

              {/* 2. What Agent Will Say */}
              <div className="space-y-1.5 p-4 rounded-lg bg-blue-50/60 border border-blue-200">
                <div className="flex items-center gap-1.5 text-blue-950 font-semibold text-xs">
                  <Volume2 className="w-4 h-4 text-blue-700" />
                  <span>Spoken Script (Controlled Template Structure)</span>
                </div>
                <div className="bg-white p-3.5 rounded border border-blue-100 font-serif italic text-slate-800 text-[12px] leading-relaxed shadow-sm whitespace-pre-wrap">
                  {preview.what_agent_will_say}
                </div>
              </div>

              {/* 3. Facts Used vs Forbidden Disclosures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-semibold text-slate-900 text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Approved Facts Mentioned</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-600">
                    {preview.facts_used.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg bg-rose-50/50 border border-rose-200 space-y-2">
                  <div className="font-semibold text-rose-950 text-[11px] flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Forbidden Disclosures (Strict Guardrail)</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-rose-800">
                    {preview.forbidden_disclosures.map((d, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 4. Permitted Actions */}
              <div className="space-y-2 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-900 text-[11px]">
                  Permitted Backend Actions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {preview.actions_permitted.map((action, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-800 font-mono text-[10px]"
                    >
                      {action}
                    </span>
                  ))}
                </div>
              </div>

              {/* 5. Completion & Fallback Rules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-900">What Completes This Step:</span>
                  <p className="text-slate-600">{preview.what_completes_step}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-900">No Answer / Busy Fallback:</span>
                  <p className="text-slate-600">{preview.unanswered_fallback}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommunicationPreviewModal;
