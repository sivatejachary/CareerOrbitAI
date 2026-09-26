import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { fetchPublicJob, submitPublicApplication } from '../../api/candidatesApi';

export const CareerPage: React.FC = () => {
  const { jobCode } = useParams<{ jobCode: string }>();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Application Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [experience, setExperience] = useState<string>('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<any>(null);

  useEffect(() => {
    if (!jobCode) return;
    setLoading(true);
    fetchPublicJob(jobCode)
      .then((data) => setJob(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [jobCode]);

  const handleCustomAnswerChange = (fieldLabel: string, value: any) => {
    setCustomAnswers((prev) => ({ ...prev, [fieldLabel]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobCode) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('full_name', fullName);
      formData.append('email', email);
      if (phone) formData.append('phone', phone);
      if (location) formData.append('current_location', location);
      if (experience) formData.append('total_experience', experience);
      if (currentCompany) formData.append('current_company', currentCompany);
      if (noticePeriod) formData.append('notice_period', noticePeriod);

      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      if (Object.keys(customAnswers).length > 0) {
        formData.append('answers_json', JSON.stringify(customAnswers));
      }

      const res = await submitPublicApplication(jobCode, formData);
      setSubmitSuccess(res);
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading job posting...</span>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500" />
          <h2 className="text-xl font-bold text-white">Job Posting Not Found</h2>
          <p className="text-slate-400 text-sm">{error || 'This career page is no longer active or the URL is invalid.'}</p>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Application Submitted!</h2>
            <p className="text-slate-400 text-sm">
              Thank you for applying to <span className="text-white font-medium">{job.title}</span>.
            </p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
            <span>Reference Application ID</span>
            <p className="font-mono text-indigo-400 font-semibold text-sm">{submitSuccess.application_id}</p>
          </div>
          <p className="text-xs text-slate-500">Our hiring team will review your application and be in touch if your qualifications match the role requirements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Public Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30">
              C
            </div>
            <span className="font-bold text-lg text-white tracking-tight">CareerOrbit<span className="text-indigo-400">AI</span> Careers</span>
          </div>

          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            {job.job_code}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Job Banner Hero */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-0"></div>

          <div className="space-y-3 relative z-10">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full font-medium">
                {job.department}
              </span>
              <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full font-medium">
                {job.job_type}
              </span>
              <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full font-medium">
                {job.work_mode}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{job.title}</h1>

            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300 pt-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span>{[job.city, job.state, job.country].filter(Boolean).join(', ') || 'Remote'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <span>
                  {job.min_experience != null ? `${job.min_experience}${job.max_experience ? ` - ${job.max_experience}` : '+'} yrs exp` : 'Freshers Allowed'}
                </span>
              </div>
              {job.salary_info && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">
                    {job.salary_info.currency} {job.salary_info.min_salary} - {job.salary_info.max_salary} ({job.salary_info.salary_type})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Job Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Job Overview */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">About the Role</h2>
              <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: job.description }} />
            </div>

            {job.responsibilities && job.responsibilities.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Key Responsibilities</h2>
                <ul className="space-y-2 text-sm text-slate-300">
                  {job.responsibilities.map((resp: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.skills && job.skills.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Required & Preferred Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((s: any, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {typeof s === 'string' ? s : s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Application Form */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 sticky top-24 shadow-xl">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" /> Apply for Position
                </h2>
                <p className="text-xs text-slate-400 mt-1">Submit your profile directly to our hiring team.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Current City</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Bengaluru"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Total Exp (Years)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="3.5"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Current Company</label>
                  <input
                    type="text"
                    value={currentCompany}
                    onChange={(e) => setCurrentCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Notice Period</label>
                  <select
                    value={noticePeriod}
                    onChange={(e) => setNoticePeriod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select notice period</option>
                    <option value="Immediate">Immediate</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="60 Days">60 Days</option>
                    <option value="90 Days">90 Days</option>
                  </select>
                </div>

                {/* Resume Upload */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Resume / CV (PDF, DOCX)</label>
                  <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-950">
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-6 h-6 mx-auto text-indigo-400 mb-1" />
                    <p className="text-xs text-slate-300 font-medium">
                      {resumeFile ? resumeFile.name : 'Click or drop your resume here'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">PDF or DOCX up to 10MB</p>
                  </div>
                </div>

                {/* Dynamic Form Schema Questions */}
                {job.form_schema?.sections?.map((section: any, sIdx: number) => (
                  <div key={sIdx} className="space-y-3 pt-2 border-t border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 uppercase">{section.title}</h3>
                    {section.fields?.map((field: any, fIdx: number) => (
                      <div key={fIdx}>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          {field.label} {field.required && '*'}
                        </label>
                        <input
                          type="text"
                          required={field.required}
                          onChange={(e) => handleCustomAnswerChange(field.label, e.target.value)}
                          placeholder={field.placeholder || ''}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Submitting Application...' : 'Submit Application'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CareerPage;
