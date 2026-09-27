import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Clock,
  IndianRupee,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { jobsApi } from '../../api/jobsApi';
import { Job, QuestionSchema } from '../../types/job';

export const PublicApplicationPage: React.FC = () => {
  const { jobCode, token } = useParams<{ jobCode: string; token: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [formConfig, setFormConfig] = useState<any>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);

  // Form Fields State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [totalExperience, setTotalExperience] = useState<string>('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('30 Days');
  const [skills, setSkills] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});

  // Resume File State
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionReceipt, setSubmissionReceipt] = useState<any>(null);

  useEffect(() => {
    if (!jobCode || !token) {
      setError('Invalid application link parameters.');
      setIsLoading(false);
      return;
    }

    const loadForm = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await jobsApi.getPublicApplicationForm(jobCode, token);
        setJob(data.job);
        setFormConfig(data.form);
      } catch (err: any) {
        setError(err.message || 'Failed to load application form.');
      } finally {
        setIsLoading(false);
      }
    };

    loadForm();
  }, [jobCode, token]);

  // Strict Client-Side File Validation
  const validateAndSetFile = (file: File) => {
    setFileError(null);

    // Max 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileError('File size exceeds the 10MB limit. Please choose a smaller file.');
      return;
    }

    // Only .pdf and .docx
    const filename = file.name.toLowerCase();
    const isPdf = filename.endsWith('.pdf');
    const isDocx = filename.endsWith('.docx');

    if (!isPdf && !isDocx) {
      setFileError('Unsupported file format. Please upload a real PDF (.pdf) or Word document (.docx). Formats like .doc, .txt, and images are not accepted.');
      return;
    }

    setResumeFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleCustomAnswerChange = (qId: string, value: any) => {
    setCustomAnswers(prev => ({
      ...prev,
      [qId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!fullName.trim()) {
      setSubmitError('Full name is required.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setSubmitError('A valid email address is required.');
      return;
    }

    if (!resumeFile) {
      setSubmitError('Please attach your resume file (PDF or DOCX).');
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('email', email.trim());
      if (phone.trim()) formData.append('phone', phone.trim());
      if (location.trim()) formData.append('current_location', location.trim());
      if (totalExperience) formData.append('total_experience', totalExperience);
      if (currentCompany.trim()) formData.append('current_company', currentCompany.trim());
      if (noticePeriod) formData.append('notice_period', noticePeriod);
      if (skills.trim()) formData.append('skills_raw', skills.trim());
      formData.append('answers_json', JSON.stringify(customAnswers));
      formData.append('resume', resumeFile);

      const receipt = await jobsApi.submitPublicApplicationForm(jobCode!, token!, formData);
      setSubmissionReceipt(receipt);
    } catch (err: any) {
      setSubmitError(err.message || 'Application submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Loading application form...</p>
        </div>
      </div>
    );
  }

  if (error || !job || !formConfig) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Application Form Unavailable</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {error || 'This application link may have expired or is invalid.'}
          </p>
          <div className="pt-2">
            <Link
              to="/careers"
              className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Browse Open Positions &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Submission Receipt Screen
  if (submissionReceipt) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto bg-white rounded-menu shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 p-8 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Application Received!</h1>
            <p className="text-emerald-100 text-sm mt-1">
              Thank you for applying to CareerOrbitAI.
            </p>
          </div>

          <div className="p-8 space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Position</span>
                <span className="text-slate-900 font-bold">{submissionReceipt.job_title}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Job Code</span>
                <span className="font-mono text-slate-700">{submissionReceipt.job_code}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Application ID</span>
                <span className="font-mono text-xs text-blue-600 select-all">{submissionReceipt.application_id}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Candidate Email</span>
                <span className="text-slate-800">{email}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Submitted On</span>
                <span className="text-slate-700">
                  {new Date(submissionReceipt.submitted_at).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>What happens next?</span>
              </div>
              <p>
                Your resume and application details have been securely recorded. Our AI screening pipeline and HR team will evaluate your profile against the position requirements.
              </p>
              <p>
                If your qualifications match our criteria, you will receive an invitation for the next stage of the interview process.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-center">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not Open for Submissions (Draft, Paused, Closed)
  if (!formConfig.is_open_for_submissions) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Application Form Inactive</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {formConfig.state_message || 'This application form is not currently accepting submissions.'}
          </p>
          <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-500 space-y-1">
            <p><span className="font-semibold text-slate-700">Role:</span> {job.title} ({job.job_code})</p>
            <p><span className="font-semibold text-slate-700">Status:</span> {formConfig.publication_state}</p>
          </div>
        </div>
      </div>
    );
  }

  // Filter custom questions beyond basic identity and resume
  const extraQuestions: QuestionSchema[] = (formConfig.questions || []).filter((q: QuestionSchema) => {
    const id = q.id?.toLowerCase() || '';
    return (
      !id.includes('name') &&
      !id.includes('email') &&
      !id.includes('phone') &&
      !id.includes('location') &&
      !id.includes('experience') &&
      !id.includes('company') &&
      !id.includes('notice') &&
      !id.includes('resume') &&
      q.type !== 'file_upload'
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Job Header Card */}
        <div className="bg-white rounded-menu shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
              <Briefcase className="w-4 h-4" />
              <span>{job.department} &bull; {job.job_type}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {job.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{job.city ? `${job.city}, ${job.country}` : job.country} ({job.work_mode})</span>
              </div>
              {job.min_experience !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{job.min_experience} - {job.max_experience || '+'} Years Experience</span>
                </div>
              )}
              {job.show_salary && (job.min_salary || job.max_salary) && (
                <div className="flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {job.currency || 'USD'} {job.min_salary?.toLocaleString()} - {job.max_salary?.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Job Overview */}
          <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Job Requirements & Overview</span>
            <button
              type="button"
              onClick={() => setShowJobDetails(!showJobDetails)}
              className="text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1"
            >
              <span>{showJobDetails ? 'Hide details' : 'View details'}</span>
              {showJobDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showJobDetails && (
            <div className="p-6 border-t border-slate-100 space-y-4 text-xs text-slate-700 leading-relaxed bg-white">
              {job.description && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">About the Role</h3>
                  <div
                    className="prose prose-xs max-w-none text-slate-600"
                    dangerouslySetInnerHTML={{ __html: job.description }}
                  />
                </div>
              )}

              {job.responsibilities && job.responsibilities.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Key Responsibilities</h3>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    {job.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {job.skills && job.skills.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-1.5">Desired Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills.map((s: any, i: number) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-[11px] font-medium"
                      >
                        {typeof s === 'string' ? s : s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Application Form Card */}
        <div className="bg-white rounded-menu shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="border-b border-slate-100 pb-5 mb-6">
            <h2 className="text-xl font-bold text-slate-900">Application Form</h2>
            <p className="text-xs text-slate-500 mt-1">
              Please provide accurate information and upload your latest resume. All fields marked with * are required.
            </p>
          </div>

          {submitError && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Submission Error</p>
                <p className="mt-0.5 leading-relaxed">{submitError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Contact Information */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                1. Personal Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. john.doe@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Location (City, State)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Bengaluru, Karnataka"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Professional Background */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                2. Professional Experience
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Experience (Years)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={totalExperience}
                    onChange={(e) => setTotalExperience(e.target.value)}
                    placeholder="e.g. 4.5"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Company / Employer
                  </label>
                  <input
                    type="text"
                    value={currentCompany}
                    onChange={(e) => setCurrentCompany(e.target.value)}
                    placeholder="e.g. Acme Technologies"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notice Period / Availability
                  </label>
                  <select
                    value={noticePeriod}
                    onChange={(e) => setNoticePeriod(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="60 Days">60 Days</option>
                    <option value="90 Days">90 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Skills & Technologies
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. Python, FastAPI, React, PostgreSQL, Docker"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>

            {/* Section 3: Resume File Upload (Mandatory) */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center justify-between">
                <span>3. Resume / CV Attachment</span>
                <span className="text-rose-500 font-normal normal-case">Required (PDF or DOCX)</span>
              </h3>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-menu p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                    : resumeFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {resumeFile ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs uppercase">
                      {resumeFile.name.endsWith('.pdf') ? 'PDF' : 'DOCX'}
                    </div>
                    <div className="text-left space-y-0.5">
                      <div className="font-semibold text-slate-900 text-sm">{resumeFile.name}</div>
                      <div className="text-slate-500 text-xs">
                        {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Magic bytes verified
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setResumeFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors ml-auto"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      Drag and drop your resume here, or <span className="text-blue-600 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Supports PDF (.pdf) and DOCX (.docx) documents up to 10MB.
                    </p>
                    <div className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Encrypted & privately stored in CareerOrbitAI</span>
                    </div>
                  </div>
                )}
              </div>

              {fileError && (
                <p className="text-xs text-rose-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fileError}</span>
                </p>
              )}
            </div>

            {/* Section 4: Dynamic Custom Questions */}
            {extraQuestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                  4. Additional Position Questions
                </h3>

                <div className="space-y-4">
                  {extraQuestions.map((q) => {
                    const qId = q.id || `q_${q.display_order}`;
                    return (
                      <div key={qId}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {q.label} {q.required && <span className="text-rose-500">*</span>}
                        </label>

                        {q.type === 'select' ? (
                          <select
                            required={q.required}
                            value={customAnswers[qId] || ''}
                            onChange={(e) => handleCustomAnswerChange(qId, e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          >
                            <option value="">Select an option</option>
                            {(q.options || []).map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : q.type === 'textarea' ? (
                          <textarea
                            required={q.required}
                            rows={3}
                            value={customAnswers[qId] || ''}
                            onChange={(e) => handleCustomAnswerChange(qId, e.target.value)}
                            placeholder="Enter your response..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        ) : (
                          <input
                            type={q.type === 'number' ? 'number' : 'text'}
                            required={q.required}
                            value={customAnswers[qId] || ''}
                            onChange={(e) => handleCustomAnswerChange(qId, e.target.value)}
                            placeholder="Enter your response..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submit Action Button */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Protected by CareerOrbitAI Recruitment Privacy Shield
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-7 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Submission...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Application</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
