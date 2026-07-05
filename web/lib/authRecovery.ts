/**
 * Password-recovery session confinement — shared constants.
 *
 * A Supabase recovery link (`/auth/confirm?type=recovery`) mints a FULL session.
 * To stop that session being used to roam the app before a new password is set,
 * `auth/confirm` drops an httpOnly marker cookie and the proxy (middleware)
 * restricts a marked session to `PW_RECOVERY_ALLOWED_PATHS` only. The marker is
 * cleared by `/auth/recovery-done` once the password is actually changed (and by
 * `/auth/signout`). See `web/proxy.ts` and `web/app/auth/confirm/route.ts`.
 */
export const PW_RECOVERY_COOKIE = 'mc_pw_recovery';

/** The only paths a recovery-confined session may reach. */
export const PW_RECOVERY_ALLOWED_PATHS = [
  '/account/update-password',
  '/auth/recovery-done',
  '/auth/signout',
];
