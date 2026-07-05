/**
 * Password-recovery session confinement — shared constants + helpers.
 *
 * A Supabase recovery link (`/auth/confirm?type=recovery`) mints a FULL session.
 * To stop that session being used to roam the app before a new password is set,
 * `auth/confirm` drops an httpOnly marker cookie whose VALUE is the recovering
 * user's id, and the proxy (middleware) restricts a *matching* marked session to
 * `PW_RECOVERY_ALLOWED_PATHS` only. The marker is cleared by `/auth/recovery-done`
 * (called after the password is changed AND on every fresh interactive login) and
 * by `/auth/signout`. See `web/proxy.ts` and `web/app/auth/confirm/route.ts`.
 *
 * Binding the value to the user id (rather than a bare "1") means a stale marker
 * left over from another session/user can never confine a different login, and a
 * fresh login always self-heals (the login forms POST /auth/recovery-done). The
 * password-set page also carries an explicit "Cancel and return to sign in" escape
 * hatch, so a confined session can never become an inescapable loop.
 */
export const PW_RECOVERY_COOKIE = 'mc_pw_recovery';

/**
 * The only paths a recovery-confined session may reach. Includes the auth
 * exchange routes so an in-flight OAuth/token exchange can complete instead of
 * being bounced mid-flight.
 */
export const PW_RECOVERY_ALLOWED_PATHS = [
  '/account/update-password',
  '/auth/recovery-done',
  '/auth/signout',
  '/auth/callback',
  '/auth/confirm',
];

/** Cookie options used when SETTING the marker (30-min ceiling). */
export function recoveryCookieSetOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 1800, // 30 min — long enough to set a password, short-lived otherwise
  };
}

/**
 * Cookie options used when CLEARING the marker. Mirrors the set attributes and
 * adds an epoch `expires` so deletion is reliable across browsers (a mismatched
 * Set-Cookie can otherwise be ignored).
 */
export function recoveryCookieClearOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}
