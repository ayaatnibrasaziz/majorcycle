import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // --border-strong at REST, per the approved system's `.input`. It used
          // to rest on --border and move to --border-strong on hover, i.e. the
          // field announced itself as a control only once you had already found
          // it. A text box is not a surface; its edge is the affordance. The old
          // hover rule is gone rather than kept as a no-op, so nothing here
          // promises a state change that no longer happens.
          'w-full h-11 px-3.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-[14px] font-[var(--font-sans)] outline-none transition-all duration-150 placeholder:text-[var(--text-muted)] focus:border-[var(--brand-bright)] focus:ring-[3px] focus:ring-[var(--brand-bright)]/15 disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
