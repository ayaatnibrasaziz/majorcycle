import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/url';
import { PW_RECOVERY_COOKIE, recoveryCookieSetOptions } from '@/lib/authRecovery';

/**
 * Branded email-verification endpoint (confirm signup, recovery, magic link,
 * email change). Paired with the token-hash email templates, the link the user
 * clicks lives on `majorcycle.com` — never `*.supabase.co`. Mirrors the PKCE
 * handler in `auth/callback/route.ts`, but verifies a `token_hash` via
 * `verifyOtp` instead of exchanging an OAuth `code`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeNextPath(searchParams.get('next'));

  if (tokenHash && type) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // A password-recovery link mints a FULL session. Left unconfined, the user
      // (or anyone who intercepts/forwards the link) is effectively logged in and
      // can roam the app WITHOUT ever setting a new password. Confine it: force
      // the redirect to the password-set page and drop an httpOnly marker cookie
      // — keyed to THIS user's id — that the proxy uses to block every other route
      // until the password is actually changed (cleared by /auth/recovery-done on
      // success, and by any fresh login).
      const isRecovery = type === 'recovery';
      const dest = isRecovery ? '/account/update-password' : next;
      // `origin` is prepended, so a relative dest can only ever be same-origin.
      const res = NextResponse.redirect(`${origin}${dest}`);
      if (isRecovery && data.user) {
        res.cookies.set(PW_RECOVERY_COOKIE, data.user.id, recoveryCookieSetOptions());
      }
      return res;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_confirm_failed`);
}
