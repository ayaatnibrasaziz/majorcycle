'use client';

import { useEffect } from 'react';

import { revealFocused } from '@/lib/revealFocus';

/** Mounts the one site-wide `focusin` listener described in `lib/revealFocus.ts`. */
export function RevealFocus() {
  useEffect(() => {
    const onFocus = (e: FocusEvent) => revealFocused(e.target);
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);
  return null;
}
