import { PageHeading } from '../ui/Workspace';
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  RotateCw,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { jobsApi } from '../../api/jobsApi';
import { Job, JobStatus } from '../../types/job';

export const JobsList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const searchParam = searchParams.get('search') || '';
  const statusParam = searchParams.get('status') || 'All';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [statusFilter, setStatusFilter] = useState(statusParam);
  const [page, setPage] = useState(pageParam);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await jobsApi.listJobs({
        search: searchQuery,
        status: statusFilter,
        page,
        size: 10,
      });
      setJobs(res.items);
      setTotal(res.total);
      setTotalPages(res.pages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Sync state with URL params
  const updateUrlParams = (newSearch: string, newStatus: string, newPage: number) => {
    const params = new URLSearchParams();
    if (newSearch) params.set('search', newSearch);
    if (newStatus && newStatus !== 'All') params.set('status', newStatus);
    if (newPage > 1) params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setPage(1);
    updateUrlParams(val, statusFilter, 1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setStatusFilter(val);
    setPage(1);
    updateUrlParams(searchQuery, val, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      updateUrlParams(searchQuery, statusFilter, newPage);
    }
  };

  const getStatusBadgeClass = (status: JobStatus) => {
    switch (status) {
      case 'Open':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Draft':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Paused':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Closed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Expired':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="workspace-page">
      <PageHeading title="Find your next great hire." description="Create opportunities, connect with talent and build your team." />
      {/* Content Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Search jobs"
              placeholder="Search by title, job code, or department..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:border-interactive-blue focus:outline-none transition-colors"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="w-full sm:w-44">
            <select
              value={statusFilter}
              onChange={handleStatusChange}
              aria-label="Filter by job status"
              className="w-full px-3 py-2 text-sm bg-surface border border-border-subtle rounded-item text-text-primary focus:ring-2 focus:ring-interactive-blue focus:border-interactive-blue focus:outline-none transition-colors"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Open">Open</option>
              <option value="Paused">Paused</option>
              <option value="Closed">Closed</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Primary Action Button */}
        <Link
          to="/jobs/create"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-interactive-blue hover:bg-nav-activeText text-surface font-medium text-sm rounded-item transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-blue"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Job</span>
        </Link>
      </div>

      {/* Main Content View */}
      {isLoading ? (
        <div className="bg-surface border border-border-subtle rounded-menu p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-gray-100 rounded w-1/4 mb-4" />
          <div className="h-10 bg-gray-100 rounded w-full" />
          <div className="h-10 bg-gray-100 rounded w-full" />
          <div className="h-10 bg-gray-100 rounded w-full" />
        </div>
      ) : error ? (
        /* Error Failure State */
        <div className="bg-surface border border-rose-200 rounded-menu p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Unable to load jobs</h3>
            <p className="text-sm text-text-secondary mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchJobs}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border-subtle hover:bg-nav-hover text-text-primary text-sm font-medium rounded-item transition-colors"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" />
            <span>Retry Request</span>
          </button>
        </div>
      ) : jobs.length === 0 ? (
        /* Empty States */
        searchQuery || statusFilter !== 'All' ? (
          /* No Search Results */
          <div className="bg-surface border border-border-subtle rounded-menu p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-workspace text-text-secondary flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">No matching jobs found</h3>
            <p className="text-sm text-text-secondary">Try adjusting your search query or status filter.</p>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setSearchQuery('');
                setStatusFilter('All');
                updateUrlParams('', 'All', 1);
              }}
              className="text-sm text-interactive-blue hover:underline font-medium pt-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* No Jobs Exist */
          <div className="bg-surface border border-border-subtle rounded-menu p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-nav-activeBg text-nav-activeText flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-text-primary">No jobs created yet</h3>
              <p className="text-sm text-text-secondary">Create your first job to start hiring.</p>
            </div>
            <Link
              to="/jobs/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-interactive-blue hover:bg-nav-activeText text-surface text-sm font-medium rounded-item transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Create Job</span>
            </Link>
          </div>
        )
      ) : (
        /* Loaded Jobs Table & Cards */
        <div className="ui-panel">
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr className="bg-workspace border-b border-border-subtle text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="py-3.5 px-4">Job Title & Code</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Location / Work Mode</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Openings</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Last Updated</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-nav-hover/50 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3"><span className="metric-icon tone-sage"><Briefcase size={17} /></span><Link to={`/jobs/${job.id}`} className="font-semibold text-text-primary">{job.title}</Link></div>
                      <div className="text-[10px] text-text-secondary mt-2">
                        {job.job_code}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-text-primary">
                      {job.department}
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary">
                      {job.work_mode === 'Remote' ? (
                        <span className="font-medium text-emerald-700">Remote</span>
                      ) : (
                        `${job.city || ''}${job.city && job.state ? ', ' : ''}${job.state || ''} (${job.work_mode})`
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary">
                      {job.job_type}
                    </td>
                    <td className="py-3.5 px-4 text-text-primary font-medium">
                      {job.openings}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary text-xs">
                      {formatDate(job.updated_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        aria-label={`View details for ${job.title}`}
                        className="p-1 text-text-secondary hover:text-text-primary hover:bg-nav-hover rounded-item transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards (< 768px) */}
          <div className="md:hidden divide-y divide-border-subtle">
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="p-4 hover:bg-nav-hover/40 transition-colors space-y-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-text-primary text-base">
                      <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                    </h4>
                    <span className="text-[10px] text-text-secondary mt-2">
                      {job.job_code}
                    </span>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(job.status)}`}>
                    {job.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary pt-1">
                  <div>
                    <span className="text-text-primary font-medium">Department:</span> {job.department}
                  </div>
                  <div>
                    <span className="text-text-primary font-medium">Mode:</span> {job.work_mode}
                  </div>
                  <div>
                    <span className="text-text-primary font-medium">Openings:</span> {job.openings}
                  </div>
                  <div>
                    <span className="text-text-primary font-medium">Updated:</span> {formatDate(job.updated_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Server Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-workspace border-t border-border-subtle flex items-center justify-between text-xs text-text-secondary">
              <div>
                Showing page <span className="font-medium text-text-primary">{page}</span> of{' '}
                <span className="font-medium text-text-primary">{totalPages}</span> ({total} total jobs)
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  aria-label="Previous Page"
                  className="p-1.5 border border-border-subtle rounded-item hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  aria-label="Next Page"
                  className="p-1.5 border border-border-subtle rounded-item hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
