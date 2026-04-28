import React from 'react';

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  isHeaderWhite?: boolean;
}

export default function DashboardSection({ 
  title, 
  subtitle, 
  children, 
  className = "",
  isHeaderWhite = false
}: DashboardSectionProps) {
  return (
    <section className={`space-y-10 ${className}`}>
      <div className="flex justify-between items-baseline border-b border-zinc-900 pb-6">
        <div className={`text-ui-header ${isHeaderWhite ? 'text-white' : 'text-zinc-400'}`}>
          {title}
        </div>
        {subtitle && (
          <div className="text-ui-caption text-zinc-500">
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
