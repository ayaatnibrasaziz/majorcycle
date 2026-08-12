/** Grace window (days) between requesting account deletion and the permanent purge. */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

/**
 * Marker proving THIS browser just completed the deletion request — the gate on
 * `/deletion-requested`.
 *
 * ## Why it exists
 *
 * `/deletion-requested` says "your account is now scheduled for permanent
 * deletion". That is true of exactly one reader at one moment, and until now the
 * page had no way to tell them from anybody else: it is public, so any stranger
 * typing the URL was told their account was being deleted. It was never gated —
 * `requestAccountDeletion` simply signed the user out and redirected, and the
 * only protection was `SIGNED_OUT_ONLY_PATHS`, which answers a different
 * question ("should a SIGNED-IN reader see this?").
 *
 * ## Why a cookie, and why this shape
 *
 * The page cannot read the session, because the last thing the deletion action
 * does is sign the user out globally — deliberately, so the account is dead on
 * every device during the grace window. So the only thing that can carry "you
 * are the person who just did this" across that redirect is the browser.
 *
 * This is the same mechanism `mc_pw_recovery` already uses for recovery
 * confinement (lib/authRecovery.ts): an httpOnly marker set server-side and
 * enforced in `proxy.ts`. One mechanism, learned once. It also matches the
 * documented pattern for short-lived flow markers (Vercel's own OAuth-state
 * example uses httpOnly + sameSite lax + a ten-minute maxAge).
 *
 * ⚠️ It carries NO user data — not the id, not the email, not the date. It is a
 * flag saying "a deletion request completed in this browser". There is nothing
 * in it to leak, and nothing it grants: the page it unlocks is static prose.
 * Contrast `mc_pw_recovery`, whose value IS the user id — that one has to be
 * bound to a user because it CONFINES a live session, and a stale marker must
 * not cage a different login. This one has no session to confine.
 *
 * ⚠️ Path-scoped to the page itself, so the browser never sends it anywhere
 * else, and 30 minutes so a refresh or a Back still works while nothing lingers.
 * Deliberately NOT consumed on first read: a one-shot marker would bounce a
 * reader who simply refreshed the confirmation page, which is a worse outcome
 * than a marker that expires on its own.
 */
export const DELETION_NOTICE_COOKIE = 'mc_deletion_notice';

/** The page the marker unlocks. Named once; `proxy.ts` and the setter both use it. */
export const DELETION_NOTICE_PATH = '/deletion-requested';

/** Cookie options used when SETTING the marker. Mirrors recoveryCookieSetOptions(). */
export function deletionNoticeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: DELETION_NOTICE_PATH,
    maxAge: 1800, // 30 min — survives a refresh, outlives nothing
  };
}
