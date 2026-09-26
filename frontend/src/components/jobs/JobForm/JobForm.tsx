import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { jobsApi } from '../../../api/jobsApi';
import { Job } from '../../../types/job';
import { INDIAN_STATES_AND_UTS } from '../../../data/indianStates';
import { RichTextEditor } from './RichTextEditor';
import { SkillsTagInput } from './SkillsTagInput';
import { ResponsibilitiesEditor } from './ResponsibilitiesEditor';
import { SectionNav, SectionItem } from './SectionNav';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { FormGeneratorModal } from '../FormGenerator/FormGeneratorModal';

interface JobFormProps {
  mode: 'create' | 'edit';
}

const SECTIONS: SectionItem[] = [
  { id: 'sec-basic', label: 'Basic Details' },
  { id: 'sec-location', label: 'Location' },
  { id: 'sec-experience', label: 'Experience & Education' },
  { id: 'sec-compensation', label: 'Compensation & Benefits' },
  { id: 'sec-skills', label: 'Skills' },
  { id: 'sec-description', label: 'Job Description' },
  { id: 'sec-responsibilities', label: 'Responsibilities' },
  { id: 'sec-additional', label: 'Additional Requirements' },
  { id: 'sec-settings', label: 'Application Settings' },
];

export const JobForm: React.FC<JobFormProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();

  const [activeSection, setActiveSection] = useState('sec-basic');
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorSummary, setErrorSummary] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  // Form Generator Modal state
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [savedJobForGenerator, setSavedJobForGenerator] = useState<Job | null>(null);

  // Initial Form Data State
  const [formData, setFormData] = useState<Partial<Job>>({
    title: '',
    department: 'Engineering',
    job_type: 'Full Time',
    employment_type: 'Permanent',
    work_mode: 'Work From Office',
    openings: 1,
    priority: 'Normal',

    country: 'India',
    state: '',
    city: '',
    office_location: '',
    pin_code: '',
    allow_relocation: false,

    min_experience: undefined,
    max_experience: undefined,
    allow_freshers: false,
    min_qualification: "Bachelor's",
    degree: '',
    specialization: '',

    salary_type: 'Annual CTC',
    min_salary: undefined,
    max_salary: undefined,
    currency: 'INR',
    show_salary: true,
    benefits: ['Health Insurance', 'Performance Bonus'],

    skills: [
      { name: 'Python', category: 'required', position: 1 },
      { name: 'FastAPI', category: 'required', position: 2 }
    ],
    description: '<p>We are looking for a skilled backend engineer to join our engineering team.</p>',
    responsibilities: [
      'Design, develop, and maintain clean scalable microservices.',
      'Collaborate with cross-functional product teams to deliver core features.'
    ],

    required_qualifications: '',
    preferred_qualifications: '',
    tech_requirements: '',
    soft_skills: '',
    certifications: '',
    other_requirements: '',

    application_deadline: '',
    timezone: 'Asia/Kolkata',
    notice_periods: ['30 Days'],
    languages: ['English'],
    inclusion_info: {}
  });

  const [revision, setRevision] = useState<number>(1);
  const [isLoadingJob, setIsLoadingJob] = useState(mode === 'edit');

  // Load existing job if in edit mode
  useEffect(() => {
    if (mode === 'edit' && jobId) {
      setIsLoadingJob(true);
      jobsApi.getJob(jobId)
        .then((job) => {
          setFormData(job);
          setRevision(job.revision);
        })
        .catch((err) => {
          setServerError(err.message || 'Failed to load job details.');
        })
        .finally(() => {
          setIsLoadingJob(false);
        });
    }
  }, [mode, jobId]);

  const updateField = (field: keyof Job, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  // Frontend Validation
  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData.title || !formData.title.trim()) {
      errors.push('Job Title is required.');
    }
    if (!formData.department) errors.push('Department is required.');
    if (!formData.job_type) errors.push('Job Type is required.');
    if (!formData.work_mode) errors.push('Work Mode is required.');
    if (!formData.openings || formData.openings < 1) errors.push('Number of Openings must be at least 1.');

    // Location validation
    if (formData.work_mode === 'Work From Office' || formData.work_mode === 'Hybrid') {
      if (!formData.state || !formData.state.trim()) errors.push('State is required for office/hybrid roles.');
      if (!formData.city || !formData.city.trim()) errors.push('City is required for office/hybrid roles.');
    }
    if (formData.pin_code && formData.pin_code.trim()) {
      if (!/^\d{6}$/.test(formData.pin_code.trim())) {
        errors.push('PIN code must be a 6-digit number.');
      }
    }

    // Experience validation
    if (formData.min_experience !== undefined && formData.min_experience < 0) {
      errors.push('Minimum Experience cannot be negative.');
    }
    if (formData.max_experience !== undefined && formData.max_experience < 0) {
      errors.push('Maximum Experience cannot be negative.');
    }
    if (formData.min_experience !== undefined && formData.max_experience !== undefined) {
      if (formData.max_experience < formData.min_experience) {
        errors.push('Maximum Experience cannot be less than Minimum Experience.');
      }
    }
    if (formData.allow_freshers && formData.min_experience !== undefined && formData.min_experience > 0) {
      errors.push('Allow Freshers cannot coexist with positive minimum experience requirement.');
    }

    // Salary validation
    if (formData.salary_type === 'Unpaid Internship') {
      if (formData.job_type !== 'Internship') {
        errors.push('Unpaid Internship is valid only for Internship job type.');
      }
    } else {
      if (formData.min_salary !== undefined && formData.min_salary < 0) {
        errors.push('Minimum Salary cannot be negative.');
      }
      if (formData.max_salary !== undefined && formData.max_salary < 0) {
        errors.push('Maximum Salary cannot be negative.');
      }
      if (formData.min_salary !== undefined && formData.max_salary !== undefined) {
        if (formData.max_salary < formData.min_salary) {
          errors.push('Maximum Salary cannot be less than Minimum Salary.');
        }
      }
    }

    // Skills validation
    const reqSkills = (formData.skills || []).filter((s) => s.category === 'required');
    if (reqSkills.length === 0) {
      errors.push('At least one Required Skill must be added.');
    }

    // Description validation
    if (!formData.description || !formData.description.replace(/<[^>]*>/g, '').trim()) {
      errors.push('Job Description is required.');
    }

    // Responsibilities validation
    if (!formData.responsibilities || formData.responsibilities.length === 0 || !formData.responsibilities.some(r => r.trim())) {
      errors.push('At least one Key Responsibility bullet point is required.');
    }

    return errors;
  };

  const handleSave = async (generateFormAfterSave = false) => {
    setErrorSummary([]);
    setServerError(null);

    const errors = validateForm();
    if (errors.length > 0) {
      setErrorSummary(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    try {
      let savedJob: Job;
      if (mode === 'create') {
        savedJob = await jobsApi.createJob(formData);
      } else {
        savedJob = await jobsApi.updateJob(jobId!, {
          ...formData,
          revision,
        });
      }

      setIsDirty(false);

      if (generateFormAfterSave) {
        setSavedJobForGenerator(savedJob);
        setShowGeneratorModal(true);
      } else {
        navigate(`/jobs/${savedJob.id}`);
      }
    } catch (err: any) {
      setServerError(err.message || 'Failed to save job. Please review inputs and try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      navigate('/jobs');
    }
  };

  if (isLoadingJob) {
    return (
      <div className="max-w-[960px] mx-auto p-12 bg-surface border border-border-subtle rounded-menu text-center space-y-4">
        <Loader2 className="w-8 h-8 text-interactive-blue animate-spin mx-auto" aria-hidden="true" />
        <p className="text-sm font-medium text-text-secondary">Loading job details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto pb-24 space-y-6">
      {/* Header Back & Context */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleCancelClick}
          className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-blue"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Jobs</span>
        </button>

        <span className="text-xs text-text-secondary">
          <span className="text-rose-500 font-bold">*</span> Indicates required field
        </span>
      </div>

      {/* Accessible Error Summary Banner */}
      {errorSummary.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-menu p-4 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>Please resolve the following validation errors ({errorSummary.length}):</span>
          </div>
          <ul className="list-disc list-inside text-xs text-rose-700 space-y-1 pl-1">
            {errorSummary.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Server Error Alert */}
      {serverError && (
        <div className="bg-rose-50 border border-rose-200 rounded-menu p-4 text-sm text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Main Grid: Form Sections & Wide-screen Sidebar Nav */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Wide-screen Compact Section Sidebar */}
        <div className="hidden lg:block lg:col-span-1">
          <SectionNav
            sections={SECTIONS}
            activeSection={activeSection}
            onSelectSection={(id) => {
              setActiveSection(id);
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>

        {/* Structured Form Container */}
        <div className="lg:col-span-3 space-y-8">
          {/* SECTION A: BASIC DETAILS */}
          <section id="sec-basic" className="bg-surface border border-border-subtle rounded-menu p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <h2 className="text-base font-semibold text-text-primary">Section A: Basic Details</h2>
              <p className="text-xs text-text-secondary mt-0.5">Core role identification and headcount specifications.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Job Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="e.g. Senior AI Backend Engineer"
                  className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:border-interactive-blue focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.department || 'Engineering'}
                    onChange={(e) => updateField('department', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item text-text-primary focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  >
                    {['Engineering', 'Data Science', 'AI/ML', 'Sales', 'HR', 'Finance', 'Marketing', 'Operations', 'Other'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Job Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.job_type || 'Full Time'}
                    onChange={(e) => updateField('job_type', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item text-text-primary focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  >
                    {['Full Time', 'Part Time', 'Contract', 'Internship', 'Freelance'].map((jt) => (
                      <option key={jt} value={jt}>{jt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Employment Type
                  </label>
                  <select
                    value={formData.employment_type || 'Permanent'}
                    onChange={(e) => updateField('employment_type', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item text-text-primary focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  >
                    {['Permanent', 'Contract', 'Internship'].map((et) => (
                      <option key={et} value={et}>{et}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Work Mode <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.work_mode || 'Work From Office'}
                    onChange={(e) => updateField('work_mode', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item text-text-primary focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  >
                    {['Work From Office', 'Hybrid', 'Remote'].map((wm) => (
                      <option key={wm} value={wm}>{wm}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Number of Openings <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.openings || 1}
                    onChange={(e) => updateField('openings', parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Hiring Priority
                  </label>
                  <select
                    value={formData.priority || 'Normal'}
                    onChange={(e) => updateField('priority', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item text-text-primary focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION B: LOCATION */}
          <section id="sec-location" className="bg-surface border border-border-subtle rounded-menu p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <h2 className="text-base font-semibold text-text-primary">Section B: Location Details</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {formData.work_mode === 'Remote'
                  ? 'Remote role: Office details optional.'
                  : 'Work From Office / Hybrid role: State and City are required.'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Country</label>
                  <input
                    type="text"
                    disabled
                    value="India"
                    className="w-full px-3.5 py-2 text-sm bg-workspace border border-border-subtle rounded-item text-text-secondary cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    State / UT {formData.work_mode !== 'Remote' && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    value={formData.state || ''}
                    onChange={(e) => updateField('state', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item text-text-primary focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  >
                    <option value="">Select State / UT...</option>
                    {INDIAN_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    City {formData.work_mode !== 'Remote' && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="e.g. Bengaluru, Mumbai..."
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Office Location <span className="text-xs font-normal text-text-secondary">(Optional)</span></label>
                  <input
                    type="text"
                    value={formData.office_location || ''}
                    onChange={(e) => updateField('office_location', e.target.value)}
                    placeholder="e.g. Tech Park, Block C..."
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">PIN Code <span className="text-xs font-normal text-text-secondary">(6 Digits, Optional)</span></label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pin_code || ''}
                    onChange={(e) => updateField('pin_code', e.target.value)}
                    placeholder="e.g. 560038"
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allow_relocation"
                  checked={formData.allow_relocation || false}
                  onChange={(e) => updateField('allow_relocation', e.target.checked)}
                  className="w-4 h-4 text-interactive-blue rounded border-border-subtle focus:ring-interactive-blue"
                />
                <label htmlFor="allow_relocation" className="text-sm font-medium text-text-primary select-none cursor-pointer">
                  Allow candidates from other cities / open to relocation
                </label>
              </div>
            </div>
          </section>

          {/* SECTION C: EXPERIENCE & EDUCATION */}
          <section id="sec-experience" className="bg-surface border border-border-subtle rounded-menu p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <h2 className="text-base font-semibold text-text-primary">Section C: Experience & Education</h2>
              <p className="text-xs text-text-secondary mt-0.5">Specify candidate qualification thresholds and experience criteria.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Minimum Experience (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    disabled={formData.allow_freshers}
                    value={formData.min_experience !== undefined ? formData.min_experience : ''}
                    onChange={(e) => updateField('min_experience', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g. 2"
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue disabled:bg-workspace disabled:opacity-50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Maximum Experience (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.max_experience !== undefined ? formData.max_experience : ''}
                    onChange={(e) => updateField('max_experience', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g. 5"
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue transition-colors"
                  />
                </div>

                <div className="pt-6 sm:pt-0">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.allow_freshers || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        updateField('allow_freshers', checked);
                        if (checked) updateField('min_experience', 0);
                      }}
                      className="w-4 h-4 text-interactive-blue rounded border-border-subtle"
                    />
                    <span className="text-sm font-medium text-text-primary">Allow Freshers</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Minimum Qualification</label>
                  <select
                    value={formData.min_qualification || "Bachelor's"}
                    onChange={(e) => updateField('min_qualification', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item text-text-primary focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  >
                    {['10th', '12th', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Other'].map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Degree <span className="text-xs font-normal text-text-secondary">(Optional)</span></label>
                  <input
                    type="text"
                    value={formData.degree || ''}
                    onChange={(e) => updateField('degree', e.target.value)}
                    placeholder="e.g. B.Tech / B.E. / B.Sc"
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Specialization <span className="text-xs font-normal text-text-secondary">(Optional)</span></label>
                  <input
                    type="text"
                    value={formData.specialization || ''}
                    onChange={(e) => updateField('specialization', e.target.value)}
                    placeholder="e.g. Computer Science, AI"
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION D: COMPENSATION & BENEFITS */}
          <section id="sec-compensation" className="bg-surface border border-border-subtle rounded-menu p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <h2 className="text-base font-semibold text-text-primary">Section D: Compensation & Benefits</h2>
              <p className="text-xs text-text-secondary mt-0.5">Define salary ranges in Indian currency (INR) and candidate benefit perks.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Salary Type</label>
                  <select
                    value={formData.salary_type || 'Annual CTC'}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateField('salary_type', val);
                      if (val === 'Unpaid Internship') {
                        updateField('min_salary', undefined);
                        updateField('max_salary', undefined);
                      }
                    }}
                    className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item text-text-primary focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                  >
                    {['Annual CTC', 'Monthly', 'Hourly', 'Unpaid Internship'].map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {formData.salary_type !== 'Unpaid Internship' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Minimum Salary <span className="text-xs font-normal text-text-secondary">(INR Lakhs / per year)</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.min_salary !== undefined ? formData.min_salary : ''}
                        onChange={(e) => updateField('min_salary', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                        placeholder="e.g. 6.0 (₹6 Lakhs)"
                        className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Maximum Salary <span className="text-xs font-normal text-text-secondary">(INR Lakhs / per year)</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.max_salary !== undefined ? formData.max_salary : ''}
                        onChange={(e) => updateField('max_salary', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                        placeholder="e.g. 12.0 (₹12 Lakhs)"
                        className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2 pt-6 text-xs text-text-secondary italic">
                    Unpaid Internship selected. Salary range inputs are disabled and stored as null.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="show_salary"
                  checked={formData.show_salary || false}
                  onChange={(e) => updateField('show_salary', e.target.checked)}
                  className="w-4 h-4 text-interactive-blue rounded border-border-subtle"
                />
                <label htmlFor="show_salary" className="text-sm font-medium text-text-primary select-none cursor-pointer">
                  Show salary range to job applicants
                </label>
              </div>

              {/* Benefits Checklist */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-text-primary mb-2">Additional Benefits</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Health Insurance', 'PF', 'ESI', 'Performance Bonus',
                    'Joining Bonus', 'Food', 'Transportation', 'Work From Home', 'Paid Leave'
                  ].map((benefit) => {
                    const isChecked = (formData.benefits || []).includes(benefit);
                    return (
                      <label key={benefit} className="flex items-center gap-2 p-2 bg-workspace border border-border-subtle rounded-item text-xs text-text-primary cursor-pointer hover:bg-nav-hover transition-colors">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = formData.benefits || [];
                            if (e.target.checked) {
                              updateField('benefits', [...current, benefit]);
                            } else {
                              updateField('benefits', current.filter((b) => b !== benefit));
                            }
                          }}
                          className="w-3.5 h-3.5 text-interactive-blue rounded border-border-subtle"
                        />
                        <span>{benefit}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION E: SKILLS */}
          <section id="sec-skills" className="bg-surface border border-border-subtle rounded-menu p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <h2 className="text-base font-semibold text-text-primary">Section E: Skills</h2>
              <p className="text-xs text-text-secondary mt-0.5">Manage required and preferred technical/domain skills.</p>
            </div>

            <SkillsTagInput
              skills={formData.skills || []}
              onChange={(updatedSkills) => updateField('skills', updatedSkills)}
            />
          </section>

          {/* SECTION F: JOB DESCRIPTION */}
          <section id="sec-description" className="bg-surface border border-border-subtle rounded-menu p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <h2 className="text-base font-semibold text-text-primary">Section F: Job Description</h2>
              <p className="text-xs text-text-secondary mt-0.5">Provide a detailed role description (HTML sanitized on server).</p>
            </div>

            <RichTextEditor
              value={formData.description || ''}
              onChange={(val) => updateField('description', val)}
              id="job-desc-editor"
            />
          </section>

          {/* SECTION G: RESPONSIBILITIES */}
          <section id="sec-responsibilities" className="bg-surface border border-border-subtle rounded-menu p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <h2 className="text-base font-semibold text-text-primary">Section G: Responsibilities</h2>
              <p className="text-xs text-text-secondary mt-0.5">Add core bullet points defining key position responsibilities.</p>
            </div>

            <ResponsibilitiesEditor
              items={formData.responsibilities || []}
              onChange={(items) => updateField('responsibilities', items)}
            />
          </section>

          {/* SECTION H: ADDITIONAL REQUIREMENTS */}
          <section id="sec-additional" className="bg-surface border border-border-subtle rounded-menu p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <h2 className="text-base font-semibold text-text-primary">Section H: Additional Requirements</h2>
              <p className="text-xs text-text-secondary mt-0.5">Optional specifications for technical, soft skill, or certification criteria.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Technical Requirements <span className="text-xs font-normal text-text-secondary">(Optional)</span></label>
                <textarea
                  value={formData.tech_requirements || ''}
                  onChange={(e) => updateField('tech_requirements', e.target.value)}
                  rows={3}
                  placeholder="e.g. Experience with microservices, Redis, PyTest..."
                  className="w-full p-3 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Certifications <span className="text-xs font-normal text-text-secondary">(Optional)</span></label>
                <textarea
                  value={formData.certifications || ''}
                  onChange={(e) => updateField('certifications', e.target.value)}
                  rows={3}
                  placeholder="e.g. AWS Certified Solutions Architect..."
                  className="w-full p-3 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                />
              </div>
            </div>
          </section>

          {/* SECTION I: APPLICATION SETTINGS */}
          <section id="sec-settings" className="bg-surface border border-border-subtle rounded-menu p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3">
              <h2 className="text-base font-semibold text-text-primary">Section I: Application Settings</h2>
              <p className="text-xs text-text-secondary mt-0.5">Recruitment timezone, deadline, notice periods, and languages.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Application Deadline <span className="text-xs font-normal text-text-secondary">(Asia/Kolkata Timezone)</span></label>
                <input
                  type="date"
                  value={formData.application_deadline ? formData.application_deadline.split('T')[0] : ''}
                  onChange={(e) => updateField('application_deadline', e.target.value ? `${e.target.value}T23:59:59Z` : '')}
                  className="w-full px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Default Timezone</label>
                <input
                  type="text"
                  disabled
                  value="Asia/Kolkata (IST)"
                  className="w-full px-3.5 py-2 text-sm bg-workspace border border-border-subtle rounded-item text-text-secondary cursor-not-allowed"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-border-subtle py-3 px-4 md:px-8 shadow-dropdown">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isSubmitting}
            className="px-4 py-2 bg-workspace border border-border-subtle hover:bg-nav-hover text-text-primary font-medium text-sm rounded-item transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-interactive-blue hover:bg-nav-activeText text-surface font-medium text-sm rounded-item transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{mode === 'create' ? 'Save Job' : 'Save Changes'}</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-navy hover:bg-slate-800 text-surface font-medium text-sm rounded-item transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Save & Generate Form</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <UnsavedChangesModal
        isOpen={showDiscardModal}
        onConfirm={() => {
          setShowDiscardModal(false);
          navigate('/jobs');
        }}
        onCancel={() => setShowDiscardModal(false)}
      />

      {showGeneratorModal && savedJobForGenerator && (
        <FormGeneratorModal
          job={savedJobForGenerator}
          onClose={() => {
            setShowGeneratorModal(false);
            navigate(`/jobs/${savedJobForGenerator.id}`);
          }}
        />
      )}
    </div>
  );
};
