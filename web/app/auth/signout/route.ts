import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PW_RECOVERY_COOKIE, recoveryCookieClearOptions } from '@/lib/authRecovery';

/**
 * Signs the user out and returns them to the login page. POST-only (invoked from
 * the SignOutButton's native form) so it can't be fired by a link/prefetch. Uses
 * a 303 redirect so the browser follows up with a GET to /login rather than
 * re-POSTing. Also clears any lingering password-recovery marker.
 *
 * scope: 'local' ends ONLY this device's session — signing out on one device must
 * not revoke the user's sessions on their other devices (the default 'global'
 * scope does, which is surprising for a normal Sign-out button). "Sign out
 * everywhere" would be a separate, explicit action. (Account deletion, by
 * contrast, ends every session — see account/actions.ts.)
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: 'local' });

  const res = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  res.cookies.set(PW_RECOVERY_COOKIE, '', recoveryCookieClearOptions());
  return res;
}
