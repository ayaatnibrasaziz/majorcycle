'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[rgba(178,34,34,.10)] border border-[rgba(178,34,34,.20)] flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--c-tier-5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="text-[16px] font-bold text-[var(--text-primary)] mb-2">
          Something went wrong
        </h1>
        <p className="text-[12px] text-[var(--text-muted)] mb-5 leading-relaxed">
          An unexpected error occurred. Please try again — if it persists,{' '}
          <a href="/contact" className="text-[var(--brand-mid)] hover:underline">
            contact support
          </a>
          .
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] text-white text-[12px] font-semibold px-4 py-2 rounded-[var(--radius-sm)] shadow-[0_2px_8px_rgba(30,92,179,.25)] hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(30,92,179,.35)] transition-all cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
