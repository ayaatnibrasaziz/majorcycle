import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LoginForm } from './LoginForm';

// noindex (crawlable) — a sign-in form is not a search result. See lib/seo.ts.
export const metadata: Metadata = pageMetadata({
  path: '/login',
  title: 'Sign In',
  description: 'Sign in to your MajorCycle account.',
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

export default function LoginPage() {
  return <LoginForm />;
}
