import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:opacity-90 active:opacity-80',
  secondary: 'bg-surface text-ink hover:opacity-80 border border-border',
  destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  ghost: 'text-ink hover:bg-surface',
  outline: 'border border-border text-ink hover:bg-surface',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  xl: 'h-14 px-8 text-lg',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
        'disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button };
