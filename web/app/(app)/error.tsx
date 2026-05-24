'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center max-w-sm">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[rgba(178,34,34,.10)] border border-[rgba(178,34,34,.20)] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--c-tier-5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1.5">
          Something went wrong
        </h2>
        <p className="text-[12px] text-[var(--text-muted)] mb-4 leading-relaxed">
          An error occurred loading this page. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-secondary)] text-[12px] font-medium px-3.5 py-2 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)] transition-all cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
