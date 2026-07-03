import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
  const next = searchParams.get('next') ?? '/results';

  if (tokenHash && type) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // `origin` is prepended, so a relative `next` can only ever be same-origin.
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_confirm_failed`);
}
