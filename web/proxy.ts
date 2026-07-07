import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PW_RECOVERY_COOKIE, PW_RECOVERY_ALLOWED_PATHS } from '@/lib/authRecovery';

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/reset-password',
  '/auth/callback',
  '/auth/confirm',
  '/methodology',
  '/disclaimer',
  '/terms',
  '/privacy',
  '/pricing',
  '/contact',
  // Well-known URIs (RFC 8615) — e.g. /.well-known/security.txt. Must be publicly
  // reachable by security scanners/researchers without an auth redirect.
  '/.well-known',
  // Public stock-analysis endpoint (Vercel Python fn). Stock Detail pages render
  // on the server and fetch their own /api/cycle WITHOUT the viewer's cookies;
  // if this were gated the internal fetch would be redirected to /login and the
  // page would get no cycle data (blank rating/KPI/radar). It returns only
  // ticker→math (no user data), and the pages that surface it stay auth-gated.
  '/api/cycle',
];

export async function proxy(request: NextRequest) {
  // Dev-only bypass: skip auth so the local preview server can render pages
  // without a Supabase session. NODE_ENV guard ensures this never fires in prod.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifies the session JWT LOCALLY (WebCrypto + cached JWKS) because
  // the project uses an asymmetric signing key — no Auth-server round-trip per
  // request, unlike getUser(). It still refreshes an expired token and persists
  // the new cookies via the setAll callback above, so it must run immediately
  // after createServerClient with no code in between (per Supabase's proxy guide).
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;
  const userId = claims?.sub ?? null;

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (!userId && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Recovery-session confinement: a session that arrived via a password-reset
  // link carries the mc_pw_recovery marker (set in auth/confirm), whose value is
  // the recovering user's id. Confine when the marker matches the current
  // session's user — so a stale marker can never cage a *different* login (and a
  // fresh login self-heals by clearing the marker) — until the password is changed
  // (which clears the marker via /auth/recovery-done). A recovery session is a
  // FULL session, so this must fire regardless of whether the account has a
  // password: a Google-only account can still set one here (it converts the
  // account) or leave via the page's "Cancel and return to sign in" escape hatch —
  // letting it roam unconfined would be the very hole this guards against. Placed
  // BEFORE the login/signup redirect so a recovery session can't slip through.
  const recoveryMarker = request.cookies.get(PW_RECOVERY_COOKIE);
  if (
    userId &&
    recoveryMarker?.value === userId &&
    !PW_RECOVERY_ALLOWED_PATHS.includes(pathname)
  ) {
    return NextResponse.redirect(new URL('/account/update-password', request.url));
  }

  if (userId && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/results', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
