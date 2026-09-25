/**
 * Refuse Tor exit nodes — the one door the fake sign-ups used (2026-09-25).
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * After Turnstile went live (lib/turnstile.ts), fake accounts kept arriving about
 * once a day with the same signature: sign up with a stranger's address, ask for a
 * password reset 9–18 seconds later, never confirm. That is somebody using our
 * forms to send genuine-looking email to a third party (inbox flooding). Every one
 * that got through after Turnstile — 24 Sep 08:22, 25 Sep 07:45 and 09:45 UTC —
 * came over TOR, in a real browser, which Cloudflare's Managed challenge lets pass.
 * Supabase's edge logs label them `cf_ipcountry: T1`.
 *
 * ── Why the WHOLE site, not the four form pages ──────────────────────────────
 * A Turnstile token is bound to our HOSTNAME, not to a page. Whoever drives their
 * own browser can run script on ANY majorcycle.com page — the article index, say —
 * load Cloudflare's widget there with our public site key, get a token, and call
 * Supabase's API directly. Refusing only /signup and /reset-password would move the
 * attack one page over. So no page is served to a Tor exit at all.
 *
 * ── What this does NOT stop, said plainly ───────────────────────────────────
 * Someone who switches to an ordinary home or phone connection looks exactly like a
 * customer, and nothing free tells the two apart. This closes the door they are
 * actually using; the human check still stands behind it.
 *
 * ── Where the list comes from ───────────────────────────────────────────────
 * The Tor Project's own published exit list. `scripts/build-tor-exits.mjs`
 * refreshes `tor-exits.json` on every Vercel build — which is daily, because the
 * nightly job commits two data files — and keeps the committed copy if the
 * download fails, so a network hiccup never leaves the site unprotected. It is
 * read at BUILD time rather than per request: fetching it took 3 seconds.
 */
import list from './tor-exits.json';

const EXITS: ReadonlySet<string> = new Set(list.addresses);

/** How many exits the check knows — a guard asserts this is a real list. */
export const TOR_EXIT_COUNT = EXITS.size;

/**
 * The visitor's address. On Vercel `x-forwarded-for` is set by the platform, which
 * DISCARDS any value the visitor sent (Vercel docs, "Request headers"), so it cannot
 * be forged in either direction. The first entry is the client.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || headers.get('x-real-ip')?.trim() || null;
  // An IPv4 address can arrive in its IPv6-mapped form.
  return ip ? ip.replace(/^::ffff:/i, '') : null;
}

export function isTorExit(ip: string | null): boolean {
  return ip !== null && EXITS.has(ip);
}
