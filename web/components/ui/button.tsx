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
        // Matches reference `.btn-run` — primary CTA gradient + lift on hover.
        //
        // ⚠️ `[background-color:...]` is NOT decoration and NOT a fallback nobody
        // sees: the gradient paints via `background-image`, which leaves the
        // computed `background-color` transparent. Any tool that asks the DOM what
        // is behind this white label — including e2e/contrast.spec.ts — then reads
        // straight through to the page and scores white-on-near-white at ~1:1.
        // Declaring the gradient's LIGHTER stop as the background colour makes the
        // element report its own worst case (white on --brand-mid = 6.7:1), which
        // is the honest answer. Visually a no-op: both stops are opaque, so the
        // gradient covers it entirely. Written as an arbitrary PROPERTY rather
        // than `bg-[var(--brand-mid)]` so tailwind-merge cannot treat it as a
        // conflict with `bg-gradient-to-br` and drop one of the two.
        primary:
          'bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] [background-color:var(--brand-mid)] text-white shadow-[0_2px_8px_rgba(30,92,179,0.25)] hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(30,92,179,0.40)]',
        // Matches reference `.btn-export` — white bordered, color shift on hover
        secondary:
          'bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)]',
        ghost:
          'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
        // Same lift-on-hover interaction as `primary` (shadow grows + 1px rise),
        // red-tinted to stay destructive.
        destructive:
          'bg-[var(--c-tier-5)] text-white shadow-[0_2px_8px_rgba(178,34,34,0.25)] hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(178,34,34,0.40)]',
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
