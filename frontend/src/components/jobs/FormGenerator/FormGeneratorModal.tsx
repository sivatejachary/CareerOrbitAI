import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, ArrowUp, ArrowDown, Trash2, CheckCircle2, AlertCircle, ExternalLink, Loader2, Link2 } from 'lucide-react';
import { jobsApi } from '../../../api/jobsApi';
import { Job, QuestionSchema, ApplicationForm } from '../../../types/job';

interface FormGeneratorModalProps {
  job: Job;
  existingForm?: ApplicationForm | null;
  onClose: () => void;
}

export const FormGeneratorModal: React.FC<FormGeneratorModalProps> = ({ job, existingForm, onClose }) => {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<QuestionSchema[]>([]);
  const [formTitle, setFormTitle] = useState(existingForm?.title || `Application Form - ${job.title} (${job.job_code})`);
  const [formDesc, setFormDesc] = useState(existingForm?.description || 'Please fill out the details below to complete your candidate application.');
  const [provider, setProvider] = useState<'GoogleForms' | 'Native' | 'MicrosoftForms'>(existingForm?.provider || 'GoogleForms');
  
  // Real Google Form URL input
  const [realGoogleFormUrl, setRealGoogleFormUrl] = useState(existingForm?.respondent_url || '');

  const [isLoading, setIsLoading] = useState(!existingForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Created Form Success Result state
  const [createdFormResult, setCreatedFormResult] = useState<ApplicationForm | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (existingForm) {
      setQuestions(existingForm.questions_schema || []);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      jobsApi.previewFormQuestions(job.id)
        .then((res) => {
          setQuestions(res.questions);
          if (res.suggested_title) setFormTitle(res.suggested_title);
        })
        .catch((err) => {
          setError(err.message || 'Failed to generate question preview.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [job.id, existingForm]);

  const handleToggleRequired = (index: number) => {
    const updated = [...questions];
    updated[index].required = !updated[index].required;
    setQuestions(updated);
  };

  const handleLabelChange = (index: number, val: string) => {
    const updated = [...questions];
    updated[index].label = val;
    setQuestions(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    updated.forEach((q, idx) => {
      q.display_order = idx + 1;
    });
    setQuestions(updated);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleGenerateAndSave = async () => {
    setIsSaving(true);
    setError(null);

    // Validate real Google Form URL if entered
    let finalRespondentUrl = realGoogleFormUrl.trim();
    if (provider === 'GoogleForms' && finalRespondentUrl) {
      if (!finalRespondentUrl.startsWith('http://') && !finalRespondentUrl.startsWith('https://')) {
        finalRespondentUrl = `https://${finalRespondentUrl}`;
      }
    }

    try {
      const res = await jobsApi.createApplicationForm(job.id, {
        title: formTitle,
        description: formDesc,
        questions,
        provider,
        respondent_url: finalRespondentUrl || undefined,
        publication_state: 'Published',
      });

      setCreatedFormResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to save application form.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinish = () => {
    onClose();
    navigate(`/jobs/${job.id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/40 backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-label="Generate Application Form"
    >
      <div className="bg-surface border border-border-subtle rounded-menu shadow-dropdown max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-workspace">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-nav-activeBg text-nav-activeText flex items-center justify-center">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                {existingForm ? 'Edit Single Application Form' : 'Generate Application Form'}
              </h2>
              <p className="text-xs text-text-secondary">Single application form per job post.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-nav-hover rounded-item transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {createdFormResult ? (
            /* Success Form Created / Updated Display View */
            <div className="p-6 bg-surface space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-text-primary">
                  {createdFormResult.provider === 'GoogleForms' ? 'Real Google Form Connected!' : 'Application Form Saved!'}
                </h3>
                <p className="text-sm text-text-secondary">
                  Form bound to job post <span className="font-semibold text-text-primary">{job.job_code}</span>. Strictly 1 form per job.
                </p>
              </div>

              {/* Display Real Form URL Banner */}
              {createdFormResult.respondent_url ? (
                <div className="p-4 bg-nav-activeBg/50 border border-blue-200 rounded-menu space-y-3 text-left">
                  <div className="text-xs font-semibold text-nav-activeText uppercase tracking-wider">
                    {createdFormResult.provider === 'GoogleForms' ? 'Real Google Form URL' : 'Form Link'}
                  </div>
                  <div className="flex items-center gap-2 bg-surface p-2.5 rounded-item border border-border-subtle">
                    <span className="text-xs text-text-primary font-mono flex-1 truncate select-all">
                      {createdFormResult.respondent_url}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(createdFormResult.respondent_url!)}
                      className="px-3 py-1 bg-workspace hover:bg-nav-hover border border-border-subtle text-xs font-medium rounded-item transition-colors"
                    >
                      {copiedLink ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <a
                      href={createdFormResult.respondent_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-interactive-blue hover:bg-nav-activeText text-surface text-sm font-semibold rounded-item transition-colors"
                    >
                      <span>Open Real Google Form</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {createdFormResult.editor_url && (
                      <a
                        href={createdFormResult.editor_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-workspace border border-border-subtle hover:bg-nav-hover text-text-primary text-sm font-medium rounded-item transition-colors"
                      >
                        <span>Edit Form in Google Drive</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-workspace border border-border-subtle rounded-menu text-xs text-text-secondary">
                  Questions schema recorded ({createdFormResult.questions_schema.length} questions).
                </div>
              )}

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="px-6 py-2 bg-brand-navy hover:bg-slate-800 text-surface text-sm font-medium rounded-item transition-colors"
                >
                  Done & View Job Details
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-interactive-blue animate-spin mx-auto" />
              <p className="text-sm font-medium text-text-secondary">Generating baseline question schema...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-item text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">Form Provider Integration</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'GoogleForms', title: 'Google Forms', desc: 'Connect or generate a real Google Form link' },
                    { id: 'Native', title: 'Native Portal', desc: 'Direct CareerOrbitAI application form' },
                    { id: 'MicrosoftForms', title: 'Microsoft Forms', desc: 'Manual outline & link attachment' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id as any)}
                      className={`
                        text-left p-3 border rounded-menu transition-colors flex flex-col justify-between
                        ${provider === p.id ? 'border-interactive-blue bg-nav-activeBg/50 text-text-primary' : 'border-border-subtle bg-surface hover:bg-nav-hover text-text-secondary'}
                      `}
                    >
                      <div className="font-semibold text-sm text-text-primary">{p.title}</div>
                      <div className="text-xs text-text-secondary mt-1">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Real Google Form URL Input */}
              {provider === 'GoogleForms' && (
                <div className="p-4 bg-nav-activeBg/40 border border-blue-200 rounded-menu space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-interactive-blue" />
                      <span>Real Google Form URL</span>
                    </label>
                    <a
                      href="https://forms.new"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-interactive-blue font-medium hover:underline bg-surface px-2.5 py-1 border border-border-subtle rounded-item"
                    >
                      <span>Create New Form on Google Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Paste your exact real Google Form share link (e.g. <span className="font-mono text-text-primary">https://forms.gle/xyz123</span> or <span className="font-mono text-text-primary">https://docs.google.com/forms/d/e/.../viewform</span>). This link will be permanently bound to job post <span className="font-semibold text-text-primary">{job.job_code}</span>.
                  </p>
                  <input
                    type="url"
                    value={realGoogleFormUrl}
                    onChange={(e) => setRealGoogleFormUrl(e.target.value)}
                    placeholder="https://forms.gle/your-real-google-form-id"
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none font-mono text-text-primary"
                  />
                </div>
              )}

              {/* Form Title & Description */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Form Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Form Instructions</label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none"
                  />
                </div>
              </div>

              {/* Generated Questions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Questions Schema ({questions.length} Questions)
                  </h3>
                  <span className="text-xs text-text-secondary">Reorder or customize questions</span>
                </div>

                <div className="space-y-2.5">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="bg-surface border border-border-subtle rounded-item p-3.5 flex items-center justify-between gap-3 hover:border-border-subtle/80 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={q.label}
                            onChange={(e) => handleLabelChange(idx, e.target.value)}
                            className="font-medium text-sm text-text-primary bg-transparent border-b border-transparent hover:border-border-subtle focus:border-interactive-blue focus:outline-none px-1 py-0.5"
                          />
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-workspace border border-border-subtle rounded text-text-secondary">
                            {q.type}
                          </span>
                        </div>
                        {q.generation_rationale && (
                          <div className="text-[11px] text-text-secondary pl-1 italic">
                            Rationale: {q.generation_rationale}
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-text-secondary select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={() => handleToggleRequired(idx)}
                            className="w-3.5 h-3.5 text-interactive-blue rounded"
                          />
                          <span>Required</span>
                        </label>

                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveQuestion(idx, 'up')}
                          className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === questions.length - 1}
                          onClick={() => handleMoveQuestion(idx, 'down')}
                          className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!createdFormResult && (
          <div className="px-6 py-4 border-t border-border-subtle bg-workspace flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface border border-border-subtle hover:bg-nav-hover text-text-primary font-medium text-sm rounded-item"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSaving || questions.length === 0}
              onClick={handleGenerateAndSave}
              className="inline-flex items-center gap-2 px-5 py-2 bg-interactive-blue hover:bg-nav-activeText text-surface font-medium text-sm rounded-item transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{provider === 'GoogleForms' ? 'Save Real Google Form Link' : 'Save Application Form'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
