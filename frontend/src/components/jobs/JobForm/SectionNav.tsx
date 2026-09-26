import React from 'react';

export interface SectionItem {
  id: string;
  label: string;
}

interface SectionNavProps {
  sections: SectionItem[];
  activeSection: string;
  onSelectSection: (id: string) => void;
}

export const SectionNav: React.FC<SectionNavProps> = ({
  sections,
  activeSection,
  onSelectSection,
}) => {
  return (
    <nav aria-label="Job form sections" className="sticky top-24 bg-surface border border-border-subtle rounded-menu p-3 space-y-1 select-none">
      <div className="px-3 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
        Form Sections
      </div>
      {sections.map((section, idx) => {
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelectSection(section.id)}
            className={`
              w-full text-left px-3 py-2 text-xs font-medium rounded-item transition-colors flex items-center gap-2.5
              ${
                isActive
                  ? 'bg-nav-activeBg text-nav-activeText font-semibold'
                  : 'text-text-secondary hover:bg-nav-hover hover:text-text-primary'
              }
            `}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isActive ? 'bg-interactive-blue text-surface font-bold' : 'bg-workspace text-text-secondary'}`}>
              {idx + 1}
            </span>
            <span className="truncate">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
