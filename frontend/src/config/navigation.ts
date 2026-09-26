import {
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  GitBranch,
  Phone,
  Mic,
  Settings,
} from 'lucide-react';
import { NavigationItem } from '../types/navigation';

export const MAIN_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    section: 'main',
  },
  {
    id: 'candidates',
    label: 'Candidates',
    path: '/candidates',
    icon: Users,
    section: 'main',
  },
  {
    id: 'jobs',
    label: 'Jobs',
    path: '/jobs',
    icon: BriefcaseBusiness,
    section: 'main',
  },
  {
    id: 'workflow',
    label: 'Hiring Workflow',
    path: '/workflow',
    icon: GitBranch,
    section: 'main',
  },
  {
    id: 'ai-calling',
    label: 'AI Calling',
    path: '/ai-calling',
    icon: Phone,
    section: 'main',
  },
  {
    id: 'ai-interviews',
    label: 'AI Interviews',
    path: '/ai-interviews',
    icon: Mic,
    section: 'main',
  },
];

export const ADMIN_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    section: 'admin',
  },
];

export const ALL_NAVIGATION_ITEMS = [
  ...MAIN_NAVIGATION_ITEMS,
  ...ADMIN_NAVIGATION_ITEMS,
];

export function getRouteTitle(pathname: string): string {
  if (pathname === '/jobs/create') return 'Create Job';
  if (pathname.startsWith('/jobs/') && pathname.endsWith('/edit')) return 'Edit Job';
  if (pathname.startsWith('/jobs/')) return 'Job Details';
  if (pathname.startsWith('/workflow/') && pathname.includes('/executions/')) return 'Execution Detail';
  if (pathname.startsWith('/workflow/')) return 'Standard Recruitment Workflow';
  if (pathname === '/workflow') return 'Hiring Workflows';
  if (pathname.startsWith('/candidates/')) return 'Candidate Details';
  const item = ALL_NAVIGATION_ITEMS.find((nav) => nav.path === pathname);
  return item ? item.label : 'CareerOrbitAI';
}
