'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

import './globals.css';

/**
 * The last boundary — the one that catches an error thrown by the ROOT LAYOUT.
 *
 * ⚠️ Not a duplicate of `app/error.tsx`. That one renders *inside* the root layout,
 * so it needs no `<html>` and inherits the site's chrome. This one REPLACES the root
 * layout, because the root layout is what failed, and React has nothing left to
 * render into — hence the `<html>` and `<body>` tags, which are required here and
 * forbidden anywhere else.
 *
 * ⚠️ **This is why it matters for H2 rather than for design.** The root layout is
 * where the fonts, the metadata and `SpeedInsights` are set up; a failure there is
 * total and silent — the reader gets a bare browser error page and the only trace is
 * a `console.error` in a browser nobody is watching. Without this file the *single
 * worst* failure the product can have is the one we would hear about last.
 *
 * ── The look is deliberately NOT new work ────────────────────────────────────
 * It restates `app/error.tsx` — same icon, same words, same tokens — because a
 * second visual treatment for "something went wrong" would be a design decision
 * nobody asked for, on a screen nobody should ever see. The one difference is that
 * it cannot offer `reset()` usefully (there is no layout to re-render into), so it
 * reloads instead.
 *
 * `globals.css` is imported so the tokens resolve. If the stylesheet is itself what
 * failed the page degrades to unstyled text, which is the correct direction: present
 * and readable beats styled and absent.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error('root layout failed', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[rgba(178,34,34,.10)] border border-[rgba(178,34,34,.20)] flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--status-danger)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
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
            {/*
              ⚠️ A plain `<a>`, and `next/link` would be wrong HERE specifically.
              This boundary renders because the root layout threw, so the React tree
              above it is gone; a client-side `<Link>` navigation asks that same
              broken tree to re-render and can land the reader straight back on this
              page. A full document load is the one thing certain to give them a
              working app. `next/link` is also what dragged Next's client router
              into the offline report and blanked it for four days (11d), which is a
              second reason not to reach for it inside an error path.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex items-center gap-1.5 bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] text-white text-[12px] font-semibold px-4 py-2 rounded-[var(--radius-sm)] shadow-[0_2px_8px_rgba(30,92,179,.25)] hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(30,92,179,.35)] transition-all cursor-pointer"
            >
              Back to MajorCycle
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
