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
      // --text-secondary, not --text-muted. Muted measures 2.97:1 on --bg-surface
      // and every single use of this component is a FORM FIELD LABEL — the words a
      // person needs to read in order to type the right thing into the box below.
      // design-system.md §14 lists "all form inputs have a visible label" as a
      // Phase 1 requirement, and 2.97:1 is only nominally visible. Colour only: no
      // size, weight or spacing changed, so nothing moves.
      'text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--text-secondary)] leading-none cursor-pointer',
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
