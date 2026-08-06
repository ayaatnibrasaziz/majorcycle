/**
 * THE canonical origin. One constant, imported everywhere — never re-typed.
 *
 * ⚠️ `www` is load-bearing, not cosmetic. The LIVE Stripe webhook is registered at
 * `https://www.majorcycle.com/api/stripe/webhook`, and Stripe counts a 3xx as a
 * FAILED delivery — so the apex, which 307s to `www`, would silently break billing
 * events. Do not "tidy" this to the shorter form.
 *
 * This value was spread across THREE files until Layer G G1, and one of them
 * disagreed: `lib/url.ts` said the apex while `app/layout.tsx` (metadataBase) and
 * `lib/email/format.ts` said `www`. Nothing was broken — `NEXT_PUBLIC_SITE_URL` is
 * set in production, so the fallback never fired — which is exactly the problem:
 * the disagreement was invisible precisely because it was unreachable, and it would
 * have surfaced the first time the env var went missing, in whichever of the three
 * happened to be asked. Rule 11c: one rule, one place.
 */
export const SITE_ORIGIN = 'https://www.majorcycle.com';

/**
 * Canonical site origin for building auth redirect and email-link URLs.
 *
 * Prefers the explicit `NEXT_PUBLIC_SITE_URL` so links never bake in a preview
 * (`*.vercel.app`) or `localhost` origin. Falls back to the live browser origin,
 * then to SITE_ORIGIN for any server-side caller without the env set.
 */
export function getSiteURL(): string {
  const configured = process.env['NEXT_PUBLIC_SITE_URL'];
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return SITE_ORIGIN;
}

/**
 * Where a signed-in user lands when no specific destination is requested.
 *
 * THE CHOKE POINT for post-auth navigation. Every Supabase auth email (signup
 * confirmation, magic link, Google OAuth) points at `/auth/callback`, which resolves
 * its destination through `safeNextPath` — so this constant, not the mail templates,
 * decides where those links end up. Changing it here moves all of them at once and
 * cannot leave a broken link behind.
 *
 * Browse rather than Results (F3 Step 10): Results is the OUTPUT of a screener run,
 * so a new or free user landed on an empty table with nothing to do and no hint of
 * what to do first. Browse works for everyone on day one.
 */
export const POST_AUTH_HOME = '/stocks';

/**
 * Sanitise a user-supplied `next` redirect target (open-redirect guard).
 *
 * The `next` param flows from `/login?next=…` into `router.push()` and into
 * server `redirect(`${origin}${next}`)` calls. Without validation an attacker
 * could craft `?next=https://evil.com` or `?next=//evil.com` and bounce a freshly
 * authenticated user off-site. We only ever redirect within our own app, so we
 * accept `next` only when it is a single-slash-rooted relative path
 * (`/stocks`, `/stocks/us/AAPL`); everything else — absolute URLs, protocol
 * -relative `//host`, backslash tricks, or a missing value — falls back to
 * `POST_AUTH_HOME`.
 */
export function safeNextPath(next?: string | null): string {
  if (!next) return POST_AUTH_HOME;
  // Must start with exactly one '/', and not '//' or '/\' (protocol-relative).
  if (next[0] !== '/' || next[1] === '/' || next[1] === '\\') return POST_AUTH_HOME;
  return next;
}
