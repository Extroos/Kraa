import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', padding = true, onClick }) => {
  const hasBackground = className.includes('bg-');
  return (
    <div 
      onClick={onClick}
      className={`${!hasBackground ? 'bg-white' : ''} rounded-xl border border-neutral-200 shadow-sm overflow-hidden ${onClick ? 'cursor-pointer hover:border-neutral-900 transition-all' : ''} ${className}`}
    >
      {padding ? <div className="p-4 sm:p-5">{children}</div> : children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return <div className={`px-5 py-4 sm:px-6 border-b border-neutral-100 bg-neutral-50/30 ${className}`}>{children}</div>;
};

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return <div className={`px-5 py-3 sm:px-6 border-t border-neutral-100 bg-neutral-50/30 ${className}`}>{children}</div>;
};
