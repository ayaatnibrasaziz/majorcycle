import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { SignupForm } from './SignupForm';

// Signing up creates a FREE account — the trial starts later, at Checkout (F3
// Step 10). This is the browser-tab title and the search-result headline, so it has
// to make the same promise the page body does.
// noindex (crawlable) — see lib/seo.ts. The description states only what a FREE
// account actually includes (CLAUDE.md, F3 Step 10): browse, the price chart, the
// drawdown overlay with its cycle bands, and every fundamentals section.
export const metadata: Metadata = pageMetadata({
  path: '/signup',
  title: 'Create a Free Account',
  description:
    'Create a free MajorCycle account — no card required. Browse US, Australian and Canadian stocks with price charts, drawdown cycles and full fundamentals.',
});

/**
 * ⚠️ **Rendered per request, and this is load-bearing.**
 *
 * The form calls `useSearchParams()` (for `?next=` and `?error=`). Next refuses
 * to STATICALLY prerender a page that does, and says so plainly:
 * "useSearchParams() should be wrapped in a suspense boundary" —
 * nextjs.org/docs/messages/missing-suspense-with-csr-bailout.
 *
 * Until 2026-08-18 nothing here said so; the root `app/loading.tsx` happened to
 * wrap every route in a Suspense boundary and satisfied the requirement by
 * accident, for the whole site. Deleting that file (to fix a sitewide soft-404,
 * where `notFound()` answered 200) made the build fail here immediately — which
 * is the useful part: the boundary was never a decision, it was a side effect.
 *
 * ⚠️ **Suspense is the documented fix and is the WRONG one here.** A boundary
 * renders its fallback on the server and fills in on the client, so a visitor
 * without JavaScript would get the fallback and never the form — on the two
 * pages that must work for everyone. `force-dynamic` resolves the search params
 * on the server instead, so the real form is in the HTML. Proven with scripting
 * off in `e2e/landing.spec.ts`.
 *
 * No caching concern: this is already a per-viewer response and the proxy sends
 * `private, no-store` (CLAUDE.md 11a).
 */
export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return <SignupForm />;
}
