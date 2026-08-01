/**
 * Canonical site origin for building auth redirect and email-link URLs.
 *
 * Prefers the explicit `NEXT_PUBLIC_SITE_URL` (always `https://majorcycle.com`)
 * so links never bake in a preview (`*.vercel.app`) or `localhost` origin.
 * Falls back to the live browser origin, then a hard-coded production default
 * for any server-side caller without the env set.
 */
export function getSiteURL(): string {
  const configured = process.env['NEXT_PUBLIC_SITE_URL'];
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://majorcycle.com';
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
