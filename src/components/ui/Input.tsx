import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, type = 'text', ...props }, ref) => (
    <div className="relative w-full">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          {icon}
        </div>
      )}
      <input
        type={type}
        className={cn(
          'w-full px-4 py-3 rounded-[20px] border border-border bg-white text-ink placeholder:text-muted',
          'focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          icon && 'pl-12',
          error && 'border-red-500 focus:ring-red-500/20',
          className
        )}
        ref={ref}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs font-medium text-red-500">{error}</p>
      )}
    </div>
  )
);
Input.displayName = 'Input';

export { Input };
