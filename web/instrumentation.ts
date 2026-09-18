import * as Sentry from '@sentry/nextjs';

import { flushBeforeFreeze } from '@/lib/observability';

/**
 * Next.js instrumentation — runs once at server startup, per runtime.
 *
 * Two jobs, and they are unrelated to each other:
 *
 * 1. **Sentry** (H2, 2026-09-16). The SDK has one entry file per runtime and this
 *    is where Next hands control over. `NEXT_RUNTIME` says which one we are in, and
 *    the imports are dynamic so the Edge bundle never pulls the Node build (it
 *    would not run there). With no `NEXT_PUBLIC_SENTRY_DSN` both are no-ops — see
 *    `lib/sentryOptions.ts`.
 *
 * 2. **DEV ONLY: force IPv4-only DNS resolution** so local machines whose IPv6
 *    (AAAA) lookups stall ~12s don't trip undici's 10s connect timeout on
 *    Supabase/Stripe calls (which surfaced as a checkout 401 "Not signed in").
 *    Gated to development + the Node runtime, so production (Vercel) and the Edge
 *    runtime are untouched. See `web/scripts/prefer-ipv4.mjs` for the full
 *    rationale.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    if (process.env.NODE_ENV !== 'production') {
      const { preferIPv4 } = await import('./scripts/prefer-ipv4.mjs');
      preferIPv4();
    }
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Errors thrown by a Server Component, a server action, a route handler or the
 * middleware.
 *
 * ⚠️ **This is the half a `try/catch` cannot reach, and it is most of the product.**
 * `lib/observability.ts` covers the failures we anticipated and handled; this covers
 * the ones nobody wrote a `catch` for — which is, by definition, the set nobody has
 * thought about. Without it, a Server Component that throws shows the reader the
 * error boundary and tells us nothing.
 */
export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  Sentry.captureRequestError(...args);
  // The SDK's own flush here is a no-op on Vercel's Node runtime — see
  // `flushBeforeFreeze` for the measurement. Without this, an unhandled error can
  // sit in a frozen instance and reach Sentry late or never.
  flushBeforeFreeze();
};
