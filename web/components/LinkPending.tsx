'use client';

import { useLinkStatus } from 'next/link';

/**
 * A small pulsing dot that appears inside the link a reader just clicked, while
 * the next page is still being fetched.
 *
 * **Why this exists.** Public routes are dynamic (`ƒ`) and have no `loading.tsx`,
 * and Next's own documentation names that exact combination: *"When navigating to
 * a dynamic route, the client must wait for the server response before showing the
 * result. This can give the users the impression that the app is not responding."*
 * Measured on the production build under Chrome's Slow 3G, a click on `Learn` then
 * `Pricing` left the page visibly unchanged for **2.3s and 4.3s** — no spinner, no
 * URL change, nothing. That is the state a reader reads as "broken", and leaves.
 *
 * ⚠️ **The obvious fix is the one we just removed.** A route-level `loading.tsx`
 * would give instant feedback, and it is what the framework recommends first. It is
 * wrong here, and not by a small margin — see `architecture.md` §7.2. It made every
 * `notFound()` answer **200** (a soft-404, on the layer whose whole purpose is SEO),
 * it left four public pages showing only "Loading…" without JavaScript, and it made
 * a first load on a slow connection reach real content **~3× slower** (6.2s vs
 * 2.2s), because the real page then arrives in a second chunk that needs the
 * JavaScript downloaded and executed first. `useLinkStatus` costs none of that: it
 * is client-only progressive enhancement and creates no Suspense boundary, so
 * neither defect can come back through it.
 *
 * ⚠️ **It must be a DESCENDANT of the `<Link>`** — the hook reads context the Link
 * provides, so calling it in the header component itself would silently return
 * `{ pending: false }` forever. There is no error for getting this wrong, which is
 * why every call site passes it as a child.
 *
 * ⚠️ **`pending` is skipped when the destination was already prefetched**, which is
 * correct: an instant navigation needs no indicator. Today that almost never
 * happens on this site — a dynamic route's prefetch is *skipped*, measured at 210
 * bytes against 667 for the same route built static — so the dot does its job. If
 * the public pages are ever made static (a real speed win: the same click fell from
 * 674ms to **109ms** on Fast 3G), this component quietly stops appearing rather
 * than needing removal.
 *
 * Accessibility: `aria-hidden`, because it is decoration. A screen reader is told
 * about the new page by Next's own route announcer, and a second, competing
 * announcement on every click would be worse than none.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`link-hint${pending ? ' is-pending' : ''}`} />;
}
