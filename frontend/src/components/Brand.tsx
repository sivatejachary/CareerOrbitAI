import React from 'react';
import { Link } from 'react-router-dom';

interface BrandProps {
  collapsed?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Brand: React.FC<BrandProps> = ({ collapsed = false, className = '', onClick }) => {
  return (
    <Link
      to="/dashboard"
      onClick={onClick}
      className={`inline-flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-focusRing rounded-md py-1 px-1 transition-opacity hover:opacity-95 ${className}`}
      aria-label="CareerOrbitAI Home"
    >
      {/* Geometric Orbit-inspired SVG mark */}
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-brand-navy text-surface">
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="w-7 h-7"
        >
          <rect width="28" height="28" rx="7" fill="#142D4E" />
          {/* Subtle outer orbit ring */}
          <circle cx="14" cy="14" r="8" stroke="#EAF1FB" strokeWidth="1.5" strokeDasharray="12 3" opacity="0.6" />
          {/* Inner core circle */}
          <circle cx="14" cy="14" r="4.5" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
          {/* Orbiting planet/node dot */}
          <circle cx="19.5" cy="10.5" r="2" fill="#245DB0" />
        </svg>
      </div>

      {!collapsed && (
        <span className="text-[18px] font-semibold text-brand-navy leading-none tracking-tight select-none whitespace-nowrap">
          CareerOrbitAI
        </span>
      )}
    </Link>
  );
};
