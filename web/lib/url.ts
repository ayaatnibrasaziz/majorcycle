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
 * Sanitise a user-supplied `next` redirect target (open-redirect guard).
 *
 * The `next` param flows from `/login?next=…` into `router.push()` and into
 * server `redirect(`${origin}${next}`)` calls. Without validation an attacker
 * could craft `?next=https://evil.com` or `?next=//evil.com` and bounce a freshly
 * authenticated user off-site. We only ever redirect within our own app, so we
 * accept `next` only when it is a single-slash-rooted relative path
 * (`/results`, `/stocks/us/AAPL`); everything else — absolute URLs, protocol
 * -relative `//host`, backslash tricks, or a missing value — falls back to
 * `/results`.
 */
export function safeNextPath(next?: string | null): string {
  if (!next) return '/results';
  // Must start with exactly one '/', and not '//' or '/\' (protocol-relative).
  if (next[0] !== '/' || next[1] === '/' || next[1] === '\\') return '/results';
  return next;
}
