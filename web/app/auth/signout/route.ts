import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PW_RECOVERY_COOKIE } from '@/lib/authRecovery';

/**
 * Signs the user out and returns them to the login page. POST-only (invoked from
 * the SignOutButton's native form) so it can't be fired by a link/prefetch. Uses
 * a 303 redirect so the browser follows up with a GET to /login rather than
 * re-POSTing. Also clears any lingering password-recovery marker.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const res = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  res.cookies.set(PW_RECOVERY_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
