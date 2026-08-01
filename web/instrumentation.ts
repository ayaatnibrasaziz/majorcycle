/**
 * Next.js instrumentation — runs once at server startup (Node runtime).
 *
 * DEV ONLY: force IPv4-only DNS resolution so local machines whose IPv6 (AAAA)
 * lookups stall ~12s don't trip undici's 10s connect timeout on Supabase/Stripe
 * calls (which surfaced as a checkout 401 "Not signed in"). Gated to development
 * + the Node runtime, so production (Vercel) and the Edge runtime are untouched.
 * See web/scripts/prefer-ipv4.mjs for the full rationale.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'production') {
    const { preferIPv4 } = await import('./scripts/prefer-ipv4.mjs');
    preferIPv4();
  }
}
