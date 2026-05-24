import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full h-11 px-3.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-[13.5px] font-[var(--font-sans)] outline-none transition-all duration-150 placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--brand-bright)] focus:ring-[3px] focus:ring-[var(--brand-bright)]/15 disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
