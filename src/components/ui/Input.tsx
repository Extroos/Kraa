import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-neutral-800 mb-1.5 leading-none">{label}</label>}
      <input
        className={`flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-400 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${
          error ? 'border-danger-500 focus-visible:ring-danger-500' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs font-semibold text-danger-600">{error}</p>}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  className?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-neutral-800 mb-1.5 leading-none">{label}</label>}
      <textarea
        className={`pro-input w-full min-h-[100px] text-sm font-medium text-neutral-900 placeholder:text-neutral-400 placeholder:font-normal ${
          error ? 'border-danger-500 focus:ring-danger-500/20' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs font-semibold text-danger-600">{error}</p>}
    </div>
  );
};
