import React, { useState, useEffect } from 'react';
import { X, Briefcase, MapPin, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { jobsApi } from '../../../api/jobsApi';
import { Job } from '../../../types/job';
import { Link } from 'react-router-dom';

interface AssociatedJobsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowName: string;
  isCompanyDefault: boolean;
  associatedJobTitle?: string;
}

export const AssociatedJobsModal: React.FC<AssociatedJobsModalProps> = ({
  isOpen,
  onClose,
  workflowName,
  isCompanyDefault,
  associatedJobTitle,
}) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);

    jobsApi
      .listJobs({ size: 50 })
      .then((res) => {
        if (isMounted) {
          setJobs(res.items || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load jobs for workflow inspection', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="associated-jobs-modal-title"
      className="fixed inset-0 z-50 bg-brand-navy/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-dropdown border border-border-subtle max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-workspace">
          <div>
            <h2 id="associated-jobs-modal-title" className="text-sm font-bold text-text-primary">
              Jobs Using This Workflow
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {workflowName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-border-subtle transition-colors"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-3 bg-blue-50/70 border-b border-blue-100 text-xs text-brand-navy flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-interactive-blue shrink-0 mt-0.5" />
          <div>
            {isCompanyDefault ? (
              <p>
                <strong>Company Default:</strong> This workflow automatically governs candidate progression for all published positions without custom workflows. New applicants for these jobs will enroll in the published version.
              </p>
            ) : (
              <p>
                <strong>Assigned Position:</strong> This custom workflow is explicitly attached to <strong>{associatedJobTitle || 'this job'}</strong>.
              </p>
            )}
          </div>
        </div>

        {/* Jobs List */}
        <div className="flex-1 overflow-y-auto p-5 divide-y divide-border-subtle">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-text-secondary">
              <Loader2 className="w-5 h-5 animate-spin text-interactive-blue" />
              <span className="text-xs">Loading active job listings...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-secondary">
              No active job listings currently linked.
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-text-primary truncate">
                      {job.title}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        job.status === 'Open'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-secondary mt-1">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {job.department}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.city ? `${job.city}, ${job.country}` : job.work_mode || job.country}
                    </span>
                  </div>
                </div>

                <Link
                  to={`/jobs/${job.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-text-secondary hover:text-interactive-blue hover:bg-workspace rounded transition-colors shrink-0"
                  title="View job details"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-subtle bg-workspace flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-interactive-blue hover:bg-brand-navy text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
