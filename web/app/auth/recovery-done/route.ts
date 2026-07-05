import { NextResponse } from 'next/server';
import { PW_RECOVERY_COOKIE } from '@/lib/authRecovery';

/**
 * Clears the password-recovery confinement marker after a new password has been
 * set (called from UpdatePasswordForm). Once cleared, the proxy stops restricting
 * the session to the password-set page and the user proceeds into the app as a
 * normal authenticated session. No-op (still 200) for a session without the
 * marker. POST-only so it can't be triggered by a stray navigation/prefetch.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PW_RECOVERY_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
