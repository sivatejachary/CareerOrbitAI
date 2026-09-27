import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Sparkles,
  Archive,
  MapPin,
  Briefcase,
  Users,
  IndianRupee,
  AlertCircle,
  Share2,
  Loader2,
  ExternalLink,
  Copy,
  CheckCircle2,
  Check,
  UserCheck,
  PlusCircle,
  RefreshCw,
  Unplug,
  ShieldCheck,
  FileSpreadsheet,
  Globe
} from 'lucide-react';
import { jobsApi } from '../../../api/jobsApi';
import { Job, JobStatus, ApplicationForm, CandidateApplication } from '../../../types/job';
import { FormGeneratorModal } from '../FormGenerator/FormGeneratorModal';
import JobPipelineView from '../JobPipelineView';

export const JobDetails: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [appForm, setAppForm] = useState<ApplicationForm | null>(null);
  const [websiteForm, setWebsiteForm] = useState<ApplicationForm | null>(null);
  const [googleForm, setGoogleForm] = useState<ApplicationForm | null>(null);
  const [candidates, setCandidates] = useState<CandidateApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Google Connection State
  const [googleConnStatus, setGoogleConnStatus] = useState<any>(null);
  const [loadingGoogleStatus, setLoadingGoogleStatus] = useState(false);

  // Form Operations State
  const [isGeneratingGoogleForm, setIsGeneratingGoogleForm] = useState(false);
  const [isVerifyingForm, setIsVerifyingForm] = useState(false);
  const [isPublishingForm, setIsPublishingForm] = useState(false);
  const [isSyncingResponses, setIsSyncingResponses] = useState(false);
  const [sourceResponses, setSourceResponses] = useState<any[]>([]);
  const [showResponsesTable, setShowResponsesTable] = useState(false);

  // Website Form Controls State
  const [isUpdatingWebsiteState, setIsUpdatingWebsiteState] = useState(false);
  const [isRegeneratingToken, setIsRegeneratingToken] = useState(false);
  const [copiedWebsiteLink, setCopiedWebsiteLink] = useState(false);
  const [verifyInstructions, setVerifyInstructions] = useState<string[] | null>(null);

  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<'details' | 'pipeline'>('details');

  const fetchGoogleStatus = async () => {
    setLoadingGoogleStatus(true);
    try {
      const statusRes = await jobsApi.getGoogleConnectionStatus();
      setGoogleConnStatus(statusRes);
    } catch (e) {
      setGoogleConnStatus({ configured: false, connected: false, message: 'Failed to fetch Google status' });
    } finally {
      setLoadingGoogleStatus(false);
    }
  };

  const fetchJobData = async () => {
    if (!jobId) return;
    setIsLoading(true);
    setError(null);
    try {
      const jobRes = await jobsApi.getJob(jobId);
      setJob(jobRes);

      const formsRes = await jobsApi.listApplicationForms(jobId);
      const webForm = (formsRes || []).find(f => f.is_primary_website_form || f.provider === 'Native') || null;
      const gForm = (formsRes || []).find(f => f.provider === 'GoogleForms') || null;
      setWebsiteForm(webForm);
      setGoogleForm(gForm);
      setAppForm(gForm || webForm || (formsRes && formsRes.length > 0 ? formsRes[0] : null));

      if (gForm) {
        try {
          const respData = await jobsApi.getFormSourceResponses(gForm.id);
          setSourceResponses(respData.items || []);
        } catch (e) {
          // silent
        }
      }

      const candRes = await jobsApi.listJobCandidates(jobId);
      setCandidates(candRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load job details.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCandidates = async () => {
    if (!jobId) return;
    try {
      const candRes = await jobsApi.listJobCandidates(jobId);
      setCandidates(candRes || []);
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    fetchJobData();
    fetchGoogleStatus();

    // Listen for OAuth success popup callback
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data === 'GOOGLE_AUTH_SUCCESS') {
        fetchGoogleStatus();
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [jobId]);

  const handleConnectGoogle = async () => {
    try {
      const res = await jobsApi.getGoogleAuthUrl();
      if (!res.configured || !res.auth_url) {
        alert('Google Forms integration is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server environment.');
        return;
      }
      // Open OAuth popup window
      window.open(res.auth_url, 'Google OAuth Connect', 'width=550,height=650');
    } catch (err: any) {
      alert(err.message || 'Google Forms integration is not configured on the server.');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!googleConnStatus?.connection_id) return;
    if (!confirm('Disconnecting CareerOrbitAI from Google will stop automatic response syncing. Previously imported candidates will be preserved. Proceed?')) return;
    try {
      await jobsApi.disconnectGoogleAccount(googleConnStatus.connection_id);
      await fetchGoogleStatus();
    } catch (err: any) {
      alert(err.message || 'Failed to disconnect Google account.');
    }
  };

  const handleGenerateRealGoogleForm = async () => {
    if (!jobId) return;
    setIsGeneratingGoogleForm(true);
    try {
      const newForm = await jobsApi.createRealGoogleForm(jobId);
      setAppForm(newForm);
      alert('Real Google Form created successfully in your Google account!');
      await fetchJobData();
    } catch (err: any) {
      alert(err.message || 'Failed to create Google Form');
    } finally {
      setIsGeneratingGoogleForm(false);
    }
  };

  const handlePublishForm = async () => {
    const target = googleForm || appForm;
    if (!target) return;
    setIsPublishingForm(true);
    try {
      const res = await jobsApi.publishForm(target.id);
      alert(res.message || 'Form published successfully!');
      await fetchJobData();
    } catch (err: any) {
      alert(err.message || 'Form publication failed');
    } finally {
      setIsPublishingForm(false);
    }
  };

  const handleSyncResponses = async () => {
    const targetForm = googleForm || appForm;
    if (!targetForm) return;
    setIsSyncingResponses(true);
    try {
      const res = await jobsApi.syncFormResponses(targetForm.id);
      if (res.status === 'Success') {
        alert(`Sync completed! Imported ${res.imported_count} response(s) (${res.new_count} new).`);
      } else {
        alert(`Sync failed: ${res.error}`);
      }
      await fetchJobData();
    } catch (err: any) {
      alert(err.message || 'Sync failed');
    } finally {
      setIsSyncingResponses(false);
    }
  };

  const handleCopyWebsiteLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedWebsiteLink(true);
    setTimeout(() => setCopiedWebsiteLink(false), 2500);
  };

  const handleUpdateWebsiteFormState = async (newState: string) => {
    if (!jobId || !websiteForm) return;
    setIsUpdatingWebsiteState(true);
    try {
      const updated = await jobsApi.updateFormState(jobId, websiteForm.id, newState);
      setWebsiteForm(updated);
      alert(`Website application form state changed to ${newState}!`);
      await fetchJobData();
    } catch (err: any) {
      alert(err.message || 'Failed to update website form state');
    } finally {
      setIsUpdatingWebsiteState(false);
    }
  };

  const handleRegenerateWebsiteToken = async () => {
    if (!jobId || !websiteForm) return;
    if (!confirm('Regenerating this public token will immediately invalidate the existing link. Candidates with the old link will no longer be able to submit. Do you want to proceed?')) return;
    setIsRegeneratingToken(true);
    try {
      const updated = await jobsApi.regenerateFormToken(jobId, websiteForm.id);
      setWebsiteForm(updated);
      alert('A new secure public application link has been generated!');
      await fetchJobData();
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate token');
    } finally {
      setIsRegeneratingToken(false);
    }
  };

  const handleToggleSubmissions = async () => {
    if (!jobId || !websiteForm) return;
    try {
      const updated = await jobsApi.toggleFormSubmissions(jobId, websiteForm.id);
      setWebsiteForm(updated);
      await fetchJobData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle submissions');
    }
  };

  const handleVerifyGoogleResumeSetup = async () => {
    if (!googleForm) return;
    setIsVerifyingForm(true);
    setVerifyInstructions(null);
    try {
      const res = await jobsApi.verifyGoogleResumeSetup(googleForm.id);
      if (res.verified) {
        alert(res.message || 'Resume upload question verified in Google Form!');
      } else {
        setVerifyInstructions(res.instructions || []);
        alert(res.message || 'Resume file upload question not detected yet.');
      }
      await fetchJobData();
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    } finally {
      setIsVerifyingForm(false);
    }
  };

  const handleSimulateCandidate = async () => {
    if (!jobId) return;
    setIsSimulating(true);
    try {
      await jobsApi.simulateCandidateSubmission(jobId);
      await refreshCandidates();
    } catch (err: any) {
      alert(err.message || 'Failed to generate test candidate submission.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;
    setIsChangingStatus(true);
    setStatusError(null);
    try {
      const updated = await jobsApi.updateJobStatus(job.id, newStatus);
      setJob(updated);
    } catch (err: any) {
      setStatusError(err.message || 'Failed to update job status.');
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleArchive = async () => {
    if (!job) return;
    try {
      await jobsApi.archiveJob(job.id);
      navigate('/jobs');
    } catch (err: any) {
      setStatusError(err.message || 'Failed to archive job.');
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const getStatusBadgeClass = (status: JobStatus) => {
    switch (status) {
      case 'Open': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Draft': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Paused': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Closed': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Expired': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatSalary = (j: Job) => {
    if (j.salary_type === 'Unpaid Internship') return 'Unpaid Internship';
    if (j.min_salary === undefined && j.max_salary === undefined) return 'Not specified';
    if (j.min_salary !== undefined && j.max_salary !== undefined) {
      return `₹${j.min_salary} - ₹${j.max_salary} Lakhs / year`;
    }
    return `₹${j.min_salary || j.max_salary} Lakhs / year`;
  };

  if (isLoading) {
    return (
      <div className="max-w-[1280px] mx-auto p-12 bg-surface border border-border-subtle rounded-menu text-center space-y-3">
        <Loader2 className="w-8 h-8 text-interactive-blue animate-spin mx-auto" />
        <p className="text-sm text-text-secondary">Loading job information...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-[1280px] mx-auto p-8 bg-surface border border-rose-200 rounded-menu text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="text-base font-semibold text-text-primary">Job not found</h3>
        <p className="text-sm text-text-secondary">{error || 'The requested job record does not exist or was archived.'}</p>
        <Link to="/jobs" className="inline-flex items-center gap-2 px-4 py-2 bg-interactive-blue text-surface text-sm font-medium rounded-item">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Jobs</span>
        </Link>
      </div>
    );
  }

  const websiteFormUrl = (websiteForm?.public_token && job)
    ? `${window.location.origin}/apply/${job.job_code}/${websiteForm.public_token}`
    : null;
  const googleFormUrl = googleForm?.respondent_url;
  const googleEditorUrl = googleForm?.editor_url;

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      {/* Top Nav & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Jobs List</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={job.status}
              disabled={isChangingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              aria-label="Change job status"
              className={`px-3 py-2 text-xs font-semibold rounded-item border cursor-pointer focus:outline-none ${getStatusBadgeClass(job.status)}`}
            >
              <option value="Draft" disabled={job.status !== 'Draft'}>Draft</option>
              <option value="Open">Open</option>
              <option value="Paused">Paused</option>
              <option value="Closed">Closed</option>
              <option value="Expired" disabled>Expired</option>
            </select>
          </div>

          <Link
            to={`/jobs/${job.id}/edit`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-border-subtle hover:bg-nav-hover text-text-primary text-sm font-medium rounded-item transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Job</span>
          </Link>

          {!appForm ? (
            <button
              type="button"
              onClick={handleGenerateRealGoogleForm}
              disabled={isGeneratingGoogleForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-navy hover:bg-slate-800 text-surface text-sm font-medium rounded-item transition-colors disabled:opacity-50"
            >
              {isGeneratingGoogleForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Generate Real Google Form</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowGeneratorModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-workspace border border-border-subtle hover:bg-nav-hover text-text-primary text-sm font-medium rounded-item transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Form Schema</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowArchiveConfirm(true)}
            aria-label="Archive job"
            className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-item transition-colors"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </div>

      {statusError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-item text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex border-b border-border-subtle gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveDetailsTab('details')}
          className={`pb-3 border-b-2 transition-colors ${
            activeDetailsTab === 'details'
              ? 'border-interactive-blue text-interactive-blue font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Job Overview & Application Channels
        </button>
        <button
          type="button"
          onClick={() => setActiveDetailsTab('pipeline')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeDetailsTab === 'pipeline'
              ? 'border-interactive-blue text-interactive-blue font-semibold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <span>Candidate Pipeline (AI Screening)</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-bold">
            {candidates.length}
          </span>
        </button>
      </div>

      {activeDetailsTab === 'pipeline' ? (
        <div className="bg-surface border border-border-subtle rounded-menu p-6">
          <JobPipelineView jobId={job.id} jobTitle={job.title} />
        </div>
      ) : (
        /* Main Grid: Job Details & Sidebar Integration Cards */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Job Details & Candidate Applications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Title Card */}
          <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-text-secondary uppercase">{job.job_code}</span>
                <h1 className="text-xl font-semibold text-text-primary mt-0.5">{job.title}</h1>
                <div className="text-sm text-text-secondary mt-1">{job.department}</div>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(job.status)}`}>
                {job.status}
              </span>
            </div>

            {/* Overview Metric Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-workspace p-3 rounded-item border border-border-subtle">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Work Mode</span>
                </div>
                <div className="font-semibold text-sm text-text-primary">{job.work_mode}</div>
              </div>

              <div className="bg-workspace p-3 rounded-item border border-border-subtle">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>Openings</span>
                </div>
                <div className="font-semibold text-sm text-text-primary">{job.openings}</div>
              </div>

              <div className="bg-workspace p-3 rounded-item border border-border-subtle">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Experience</span>
                </div>
                <div className="font-semibold text-sm text-text-primary">
                  {job.allow_freshers ? 'Freshers Allowed' : `${job.min_experience || 0} - ${job.max_experience || 0} yrs`}
                </div>
              </div>

              <div className="bg-workspace p-3 rounded-item border border-border-subtle">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-1">
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span>Salary</span>
                </div>
                <div className="font-semibold text-xs text-text-primary truncate">{formatSalary(job)}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Job Description</h3>
            <div
              className="text-sm text-text-primary leading-relaxed space-y-2 select-text"
              dangerouslySetInnerHTML={{ __html: job.description }}
            />
          </div>

          {/* Responsibilities */}
          {job.responsibilities && job.responsibilities.length > 0 && (
            <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Key Responsibilities</h3>
              <ul className="list-disc list-inside text-sm text-text-primary space-y-1.5">
                {job.responsibilities.map((resp, idx) => (
                  <li key={idx} className="leading-relaxed">{resp}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Required Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Skills & Competencies</h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((s) => (
                  <span
                    key={s.name}
                    className={`px-3 py-1 rounded-item text-xs font-medium border ${
                      s.category === 'required'
                        ? 'bg-nav-activeBg text-nav-activeText border-blue-200'
                        : 'bg-workspace text-text-secondary border-border-subtle'
                    }`}
                  >
                    {s.name} {s.category === 'required' && <span className="text-[10px] font-bold ml-1">*Required</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Submitted Candidate Applications Card */}
          <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-interactive-blue" />
                <h3 className="text-base font-semibold text-text-primary">
                  Form submissions ({candidates.length})
                </h3>
              </div>
              {import.meta.env.DEV && <button
                type="button"
                disabled={isSimulating}
                onClick={handleSimulateCandidate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-interactive-blue hover:bg-nav-activeText text-surface text-xs font-semibold rounded-item transition-colors disabled:opacity-50"
              >
                {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                <span>Add test submission (development)</span>
              </button>}
            </div>

            {candidates.length === 0 ? (
              <div className="text-center py-8 bg-workspace border border-dashed border-border-subtle rounded-item space-y-2">
                <Users className="w-8 h-8 text-text-secondary mx-auto opacity-50" />
                <p className="text-sm font-medium text-text-primary">No candidate submissions recorded yet.</p>
                <p className="text-xs text-text-secondary max-w-md mx-auto">
                  When candidates fill out your Google Form, their applications will automatically be ingested into this database.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-border-subtle rounded-item">
                <table className="w-full text-left text-xs">
                  <thead className="bg-workspace text-text-secondary font-semibold uppercase border-b border-border-subtle">
                    <tr>
                      <th className="p-3">Candidate</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Exp / Location</th>
                      <th className="p-3">Channel</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Resume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-text-primary">
                    {candidates.map((cand) => (
                      <tr key={cand.id} className="hover:bg-workspace/50 transition-colors">
                        <td className="p-3 font-semibold text-text-primary">
                          {cand.full_name}
                          <div className="text-[10px] text-emerald-700 font-normal">{cand.status}</div>
                        </td>
                        <td className="p-3">
                          <div>{cand.email}</div>
                          <div className="text-text-secondary">{cand.phone || '—'}</div>
                        </td>
                        <td className="p-3">
                          <div>{cand.total_experience !== undefined ? `${cand.total_experience} yrs` : '—'}</div>
                          <div className="text-text-secondary">{cand.current_location || '—'}</div>
                        </td>
                        <td className="p-3 font-medium text-nav-activeText">
                          <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px]">
                            {cand.source_channel}
                          </span>
                        </td>
                        <td className="p-3 text-text-secondary whitespace-nowrap">
                          {new Date(cand.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          {cand.resume_url ? (
                            <a
                              href={cand.resume_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-interactive-blue hover:underline font-medium inline-flex items-center gap-1"
                            >
                              <span>View Resume</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-text-secondary">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Google Connection, Form Creation & Response Sync Cards */}
        <div className="space-y-6">
          {/* Card 1: Google Account Connection Card */}
          <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-text-primary">Google Account Connection</h3>
              </div>

              {googleConnStatus?.connected ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                  Not Connected
                </span>
              )}
            </div>

            {loadingGoogleStatus ? (
              <div className="py-4 text-center text-xs text-text-secondary flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-interactive-blue" />
                <span>Checking Google account status...</span>
              </div>
            ) : !googleConnStatus?.configured ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-item text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Google Forms integration is not configured.</p>
                <p className="text-[11px]">
                  Server environment requires <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code>.
                </p>
              </div>
            ) : googleConnStatus?.connected ? (
              <div className="space-y-3">
                <div className="p-3 bg-workspace border border-border-subtle rounded-item space-y-1 text-xs">
                  <div className="text-text-secondary">Connected Google Account:</div>
                  <div className="font-bold text-text-primary text-sm flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{googleConnStatus.display_email}</span>
                  </div>
                  <div className="text-[10px] text-text-secondary font-mono">
                    ID: {googleConnStatus.google_account_id}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  className="w-full py-2 bg-workspace border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-item transition-colors flex items-center justify-center gap-1.5"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  <span>Disconnect Google Account</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-text-secondary leading-relaxed">
                  Connect your Google account to automatically create Google Forms in your Drive and sync candidate submissions into CareerOrbitAI.
                </p>

                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-item transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Connect Google Account</span>
                </button>
              </div>
            )}
          </div>

          {/* Card: CareerOrbitAI Website Application Form (Primary Channel) */}
          <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-interactive-blue" />
                <h3 className="text-sm font-bold text-text-primary">CareerOrbitAI Website Form</h3>
              </div>

              {websiteForm && (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  websiteForm.publication_state === 'Active' || websiteForm.publication_state === 'Published'
                    ? 'bg-emerald-100 text-emerald-800'
                    : websiteForm.publication_state === 'Paused'
                    ? 'bg-amber-100 text-amber-800'
                    : websiteForm.publication_state === 'Closed'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  {websiteForm.publication_state}
                </span>
              )}
            </div>

            {websiteForm ? (
              <div className="space-y-4">
                <div className="p-3 bg-workspace border border-border-subtle rounded-item space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">{websiteForm.title}</span>
                    <span className="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Primary Channel
                    </span>
                  </div>
                  <div className="text-[11px] text-text-secondary flex items-center justify-between">
                    <span>Resume Upload: <strong className="text-text-primary">PDF / DOCX (Max 10MB)</strong></span>
                    <span className="font-mono text-[10px] text-text-secondary">{websiteForm.questions_schema?.length || 0} questions</span>
                  </div>
                </div>

                {/* Public Application Link */}
                {websiteFormUrl && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-secondary uppercase">Candidate Application Link</span>
                      <span className="text-[10px] text-slate-400">Cryptographic 32-byte token</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-workspace p-2 rounded border border-border-subtle">
                      <span className="text-xs text-text-primary font-mono truncate flex-1 select-all">{websiteFormUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyWebsiteLink(websiteFormUrl)}
                        className="p-1 text-text-secondary hover:text-text-primary"
                        title="Copy Application Link"
                      >
                        {copiedWebsiteLink ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={websiteFormUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-interactive-blue text-surface text-xs font-bold rounded-item hover:bg-nav-activeText transition-colors shadow-sm"
                      >
                        <span>Open Application Form</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={handleRegenerateWebsiteToken}
                        disabled={isRegeneratingToken}
                        className="px-3 py-2 bg-workspace border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-medium rounded-item transition-colors"
                        title="Regenerate Token"
                      >
                        {isRegeneratingToken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Website Form Lifecycle Controls */}
                <div className="pt-2 border-t border-border-subtle space-y-2">
                  <div className="text-[11px] font-semibold text-text-secondary uppercase">Form Lifecycle State</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={isUpdatingWebsiteState || websiteForm.publication_state === 'Active'}
                      onClick={() => handleUpdateWebsiteFormState('Active')}
                      className={`py-1.5 text-xs font-semibold rounded-item transition-colors ${
                        websiteForm.publication_state === 'Active'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-workspace border border-border-subtle hover:bg-emerald-50 hover:text-emerald-700 text-text-primary'
                      }`}
                    >
                      Active
                    </button>

                    <button
                      type="button"
                      disabled={isUpdatingWebsiteState || websiteForm.publication_state === 'Paused'}
                      onClick={() => handleUpdateWebsiteFormState('Paused')}
                      className={`py-1.5 text-xs font-semibold rounded-item transition-colors ${
                        websiteForm.publication_state === 'Paused'
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-workspace border border-border-subtle hover:bg-amber-50 hover:text-amber-700 text-text-primary'
                      }`}
                    >
                      Pause
                    </button>

                    <button
                      type="button"
                      disabled={isUpdatingWebsiteState || websiteForm.publication_state === 'Closed'}
                      onClick={() => handleUpdateWebsiteFormState('Closed')}
                      className={`py-1.5 text-xs font-semibold rounded-item transition-colors ${
                        websiteForm.publication_state === 'Closed'
                          ? 'bg-rose-600 text-white font-bold'
                          : 'bg-workspace border border-border-subtle hover:bg-rose-50 hover:text-rose-700 text-text-primary'
                      }`}
                    >
                      Close
                    </button>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Submissions Intake:</span>
                    <button
                      type="button"
                      onClick={handleToggleSubmissions}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-item border transition-colors ${
                        websiteForm.allow_public_submissions
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                      }`}
                    >
                      {websiteForm.allow_public_submissions ? 'Accepting Submissions' : 'Submissions Paused'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-text-secondary">
                Loading website form...
              </div>
            )}
          </div>

          {/* Card: Google Form Details & Resume Setup Verification */}
          <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-text-primary">Google Form Channel</h3>
              </div>

              {googleForm && (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  googleForm.publication_state === 'Active' || googleForm.publication_state === 'Published'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {googleForm.publication_state}
                </span>
              )}
            </div>

            {!googleForm ? (
              <div className="text-center py-6 space-y-3 bg-workspace border border-dashed border-border-subtle rounded-item">
                <p className="text-xs text-text-secondary">Optionally connect or create a job-specific Google Form.</p>
                <button
                  type="button"
                  onClick={handleGenerateRealGoogleForm}
                  disabled={isGeneratingGoogleForm || !googleConnStatus?.connected}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-item transition-colors disabled:opacity-50"
                >
                  {isGeneratingGoogleForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Generate Real Google Form</span>
                </button>
                {!googleConnStatus?.connected && (
                  <p className="text-[11px] text-amber-700 font-medium">Please connect your Google account above first.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-workspace border border-border-subtle rounded-item space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">{googleForm.title}</span>
                    <span className="text-[10px] font-mono text-text-secondary">v{googleForm.form_version}</span>
                  </div>
                  <div className="text-[11px] flex items-center justify-between">
                    <span className="text-text-secondary">Resume Upload:</span>
                    <span className={`font-semibold ${googleForm.resume_setup_status === 'Verified' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {googleForm.resume_setup_status === 'Verified' ? 'Verified in Google Form' : 'Setup Required'}
                    </span>
                  </div>
                  {googleForm.last_verified_at && (
                    <div className="text-[10px] text-emerald-700 font-mono">
                      Verified: {new Date(googleForm.last_verified_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Honest Resume Setup Alert Banner */}
                {googleForm.resume_setup_status !== 'Verified' && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-item text-xs text-amber-900 space-y-2">
                    <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Resume Upload Setup Required (Honest Flow)</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Google Forms API does not allow third-party apps to add File upload questions automatically. Please add it in Google Forms editor:
                    </p>
                    {verifyInstructions && verifyInstructions.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800">
                        {verifyInstructions.map((instruction, idx) => (
                          <li key={idx}>{instruction}</li>
                        ))}
                      </ul>
                    ) : (
                      <ol className="list-decimal pl-4 space-y-1 text-[11px] text-amber-800">
                        <li>Open the Google Form in Google Editor below.</li>
                        <li>Click <strong>+</strong> and select question type <strong>File upload</strong>.</li>
                        <li>Name the question <strong>Resume / CV</strong> and toggle <strong>Required</strong> to ON.</li>
                        <li>Return here and click <strong>Verify Resume Setup</strong> below.</li>
                      </ol>
                    )}

                    <button
                      type="button"
                      onClick={handleVerifyGoogleResumeSetup}
                      disabled={isVerifyingForm}
                      className="w-full mt-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-item transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isVerifyingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>Verify Resume Setup in Google Form</span>
                    </button>
                  </div>
                )}

                {/* Form URLs */}
                {googleFormUrl && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-text-secondary uppercase">Google Form Respondent URL</div>
                    <div className="flex items-center gap-1.5 bg-workspace p-2 rounded border border-border-subtle">
                      <span className="text-xs text-text-primary font-mono truncate flex-1 select-all">{googleFormUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(googleFormUrl)}
                        className="p-1 text-text-secondary hover:text-text-primary"
                      >
                        {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <a
                        href={googleFormUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-item hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <span>Open Form</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {googleEditorUrl && (
                        <a
                          href={googleEditorUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-surface border border-border-subtle text-text-primary text-xs font-medium rounded-item hover:bg-nav-hover transition-colors"
                        >
                          <span>Google Editor</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Publication Controls */}
                {googleForm.resume_setup_status === 'Verified' && (
                  <div className="pt-2 border-t border-border-subtle">
                    <button
                      type="button"
                      onClick={handlePublishForm}
                      disabled={isPublishingForm || googleForm.publication_state === 'Active' || googleForm.publication_state === 'Published'}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-item transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isPublishingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>{googleForm.publication_state === 'Active' || googleForm.publication_state === 'Published' ? 'Google Form Published' : 'Publish Google Form'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Response Synchronization & Audit Card */}
          {appForm && (
            <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-interactive-blue" />
                  <h3 className="text-sm font-bold text-text-primary">Response Synchronization</h3>
                </div>

                <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                  {appForm.sync_status || 'Idle'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="text-xs text-text-secondary space-y-1">
                  <div>Last Sync: <span className="font-mono text-text-primary">{appForm.last_sync_at ? new Date(appForm.last_sync_at).toLocaleString() : 'Never'}</span></div>
                  <div>Imported Raw Responses: <span className="font-bold text-text-primary">{sourceResponses.length}</span></div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncResponses}
                    disabled={isSyncingResponses}
                    className="flex-1 py-2 bg-interactive-blue hover:bg-nav-activeText text-surface text-xs font-bold rounded-item transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isSyncingResponses ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Sync Responses Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResponsesTable(!showResponsesTable)}
                    className="px-3 py-2 bg-workspace border border-border-subtle text-text-primary text-xs font-medium rounded-item hover:bg-nav-hover"
                  >
                    {showResponsesTable ? 'Hide Audit' : 'View Audit'}
                  </button>
                </div>

                {showResponsesTable && (
                  <div className="mt-3 p-3 bg-workspace border border-border-subtle rounded-item space-y-2 text-xs">
                    <div className="font-bold text-text-primary text-[11px] uppercase">Imported Response Log</div>
                    {sourceResponses.length === 0 ? (
                      <p className="text-text-secondary text-[11px]">No external responses stored yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {sourceResponses.map((r) => (
                          <div key={r.id} className="p-2 bg-surface rounded border border-border-subtle space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono text-text-primary">{r.provider_response_id}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.processing_status === 'Processed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {r.processing_status}
                              </span>
                            </div>
                            <div className="text-[10px] text-text-secondary">
                              Submitted: {new Date(r.latest_submitted_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compact Job Distribution Channels */}
          <div className="bg-surface border border-border-subtle rounded-menu p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <Share2 className="w-4 h-4 text-interactive-blue" />
              <h3 className="text-sm font-semibold text-text-primary">Job Distribution</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                'LinkedIn', 'Naukri', 'Indeed', 'Foundit',
                'Instahyre', 'Wellfound', 'Company Career Page', 'Telegram'
              ].map((channel) => (
                <div key={channel} className="p-2 bg-workspace border border-border-subtle rounded-item text-xs flex items-center justify-between">
                  <span className="text-text-primary font-medium">{channel}</span>
                  <span className="text-[10px] text-text-secondary bg-slate-200 px-1.5 py-0.5 rounded">
                    Coming soon
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Confirmation Modal for Archiving */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/40">
          <div className="bg-surface border border-border-subtle rounded-menu shadow-dropdown p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-semibold text-text-primary">Archive Job Record?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Archiving will remove "{job.title}" ({job.job_code}) from active job listings. Form history and audit trails will be preserved.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 bg-workspace border border-border-subtle text-text-primary text-sm font-medium rounded-item"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchive}
                className="px-4 py-2 bg-rose-600 text-surface text-sm font-medium rounded-item hover:bg-rose-700"
              >
                Archive Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Generator Modal */}
      {showGeneratorModal && (
        <FormGeneratorModal
          job={job}
          existingForm={appForm}
          onClose={() => {
            setShowGeneratorModal(false);
            fetchJobData();
          }}
        />
      )}
    </div>
  );
};
