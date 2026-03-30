import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  as?: React.ElementType;
  [key: string]: any; // To support Link props like 'to'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  as: Component = 'button',
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] outline-hidden select-none';
  
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-600/20 border border-white/10 active:bg-primary-800',
    secondary: 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 shadow-sm active:bg-neutral-100',
    danger: 'bg-danger-500 text-white hover:bg-danger-600 shadow-md shadow-danger-500/20 active:bg-danger-700',
    ghost: 'bg-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200',
    outline: 'bg-transparent border-2 border-neutral-200 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100',
  };

  const sizes = {
    sm: 'h-[32px] px-3 text-[11px] uppercase tracking-widest',
    md: 'h-[38px] px-5 text-[12px] uppercase tracking-wider',
    lg: 'h-[48px] px-8 text-sm',
  };

  return (
    <Component
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : null}
      {children}
    </Component>
  );
};
