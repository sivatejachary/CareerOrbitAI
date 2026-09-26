import { ComponentType } from 'react';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  section?: 'main' | 'admin';
}

export interface NavigationGroup {
  section: 'main' | 'admin';
  label?: string;
  items: NavigationItem[];
}
