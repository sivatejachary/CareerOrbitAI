import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, disabled = false }) => {
  const [isVisible, setIsVisible] = useState(false);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className="absolute left-full ml-3 px-2.5 py-1.5 bg-brand-navy text-surface text-xs font-medium rounded-md shadow-tooltip whitespace-nowrap z-50 pointer-events-none transition-opacity duration-150"
        >
          {content}
          <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-brand-navy" />
        </div>
      )}
    </div>
  );
};
