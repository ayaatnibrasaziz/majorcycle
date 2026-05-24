'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] font-semibold font-[var(--font-sans)] transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-bright)] active:translate-y-0',
  {
    variants: {
      variant: {
        // Matches reference `.btn-run` — primary CTA gradient + lift on hover
        primary:
          'bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] text-white shadow-[0_2px_8px_rgba(30,92,179,0.25)] hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(30,92,179,0.40)]',
        // Matches reference `.btn-export` — white bordered, color shift on hover
        secondary:
          'bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)]',
        ghost:
          'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
        destructive:
          'bg-[var(--c-tier-5)] text-white hover:opacity-90',
      },
      size: {
        default: 'h-11 px-4 text-[13px]',
        sm: 'h-8 px-3 text-[11px]',
        lg: 'h-12 px-5 text-[14px]',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
