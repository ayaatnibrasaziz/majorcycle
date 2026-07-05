import { NextResponse } from 'next/server';
import { PW_RECOVERY_COOKIE, recoveryCookieClearOptions } from '@/lib/authRecovery';

/**
 * Clears the password-recovery confinement marker. Called (a) from
 * UpdatePasswordForm after a new password is set, and (b) from every fresh
 * interactive login (email + Google) so a stale marker can never confine a normal
 * sign-in. Once cleared, the proxy stops restricting the session to the
 * password-set page. No-op (still 200) for a session without the marker. POST-only
 * so it can't be triggered by a stray navigation/prefetch.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PW_RECOVERY_COOKIE, '', recoveryCookieClearOptions());
  return res;
}
