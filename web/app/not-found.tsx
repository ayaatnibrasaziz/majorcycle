import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * The 404 — SESSION-UNAWARE, and that is what makes the public site fast.
 *
 * This used to be an async server component calling `supabase.auth.getUser()` so
 * it could offer "Back to Browse" to a signed-in reader and "Back to sign in" to
 * everyone else. It worked, and it cost more than it was worth: the root
 * not-found boundary sits in **every route's tree**, so one session read here
 * made the ENTIRE site render on demand. Proven by experiment 2026-08-18 —
 * swapping in a session-unaware version turns `/`, `/contact`, `/disclaimer`,
 * `/learn`, `/privacy` and `/terms` from `ƒ` into `○` prerendered.
 *
 * That matters because of how Next prefetches: *"Static Route: the full route is
 * prefetched. Dynamic Route: prefetching is skipped."* Measured on our own pages,
 * the prefetch payload for `/learn` is **210 bytes dynamic against 667 static**,
 * and the click that follows costs **674ms against 109ms** on Fast 3G.
 *
 * ⚠️ **No feature was lost, because the destination already knows.** `/` is in
 * `SIGNED_OUT_ONLY_PATHS` (proxy.ts), so a signed-in reader who lands there is
 * redirected to `/stocks` — exactly where "Back to Browse" sent them. The rule
 * lives in ONE place (the middleware) instead of being asked again here, which is
 * CLAUDE.md 11c: a second copy of "is this reader signed in?" is a second copy
 * that can drift. A signed-out reader gets the landing page, which carries "Sign
 * in" and "Create free account" in its header.
 *
 * ⚠️ **Do not reintroduce a session read here to personalise a label.** It is not
 * a local change: it silently un-statics every public page on the site, and
 * nothing goes red when it happens.
 */
export default function NotFound() {
  // One destination, correct for both readers — resolved by the middleware, not
  // by a second session lookup. See the note above before changing it.
  const href = '/';
  const label = 'Back to MajorCycle';

  return (
    // Standalone chrome on purpose. This is the ROOT not-found, so it also catches
    // unmatched paths inside the signed-in app — where a "Sign in / Create free
    // account" header would be nonsense. It borrows the public pages' card
    // language (same radius, border, surface and lift) without their nav.
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-6">
      <div className="w-full max-w-[var(--measure-narrow)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-lift)] px-7 py-10 sm:px-9 text-center">
        <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-[var(--bg-stripe)] border border-[var(--border)] flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35M11 8v3M11 14h.01" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-[-0.4px] leading-[1.2]">
          Page not found
        </h1>
        {/* --text-secondary, not --text-muted: muted is 2.9:1 on this surface and
            this is the only sentence explaining what happened. */}
        <p className="mt-2 mb-7 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        {/* href and label are asserted by e2e/auth.spec.ts, for BOTH readers — a
            signed-out one lands on the landing page, a signed-in one is bounced
            on to /stocks by the middleware. Changing either without that test is
            how the redirect silently stops being checked. */}
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href={href}>{label}</Link>
        </Button>
      </div>
    </div>
  );
}
