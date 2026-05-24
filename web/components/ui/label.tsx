'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--text-muted)] leading-none cursor-pointer',
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
