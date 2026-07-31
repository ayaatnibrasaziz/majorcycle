import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PW_RECOVERY_COOKIE, PW_RECOVERY_ALLOWED_PATHS } from '@/lib/authRecovery';
import { accessDenialReason, hasAccess } from '@/lib/entitlement';
import { INTERNAL_HEADER, hasInternalSecret } from '@/lib/internalAuth';

/** Internal-only analysis endpoint — secret-gated, never session-gated. */
const CYCLE_PATH = '/api/cycle';

/**
 * Cache headers for the two refusals this middleware issues itself.
 *
 * Both depend on WHO is asking — the 401 on whether the caller holds the internal
 * secret, the 402 on the caller's own billing columns (its body names their denial
 * reason). Rule 11a: a viewer-dependent response must never carry a shared-cache
 * directive, because Vercel's edge keys on the URL alone and would hand one caller's
 * answer to the next.
 *
 * `NextResponse.json` otherwise defaults these to `public, max-age=0, must-revalidate`.
 * That is not exploitable on its own — `max-age=0` plus `must-revalidate` stop any
 * reuse — but it is the same directive that made B1 an authorisation bypass, and it
 * leaves the safety resting on a modifier someone could later remove without knowing
 * it was load-bearing. Stated explicitly instead.
 */
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/**
 * Endpoints that require a live subscription. The screener is fully premium — the
 * highest-value feature and the only one with a meaningful per-use cost — so there
 * is no free form of it to fall back to. `/api/analyze-dev` is the local shim that
 * stands in for the Python function under `next dev`; gating it too keeps dev
 * behaviour honest instead of quietly permissive.
 */
const PREMIUM_API_PATHS = ['/api/analyze', '/api/analyze-dev'];

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
  // Post-deletion confirmation — the user has just been signed out, so it must be
  // reachable without a session (the reactivation page /reactivate stays gated).
  '/deletion-requested',
  // Well-known URIs (RFC 8615) — e.g. /.well-known/security.txt. Must be publicly
  // reachable by security scanners/researchers without an auth redirect.
  '/.well-known',
  // NOTE: /api/cycle is deliberately NOT listed here. It used to be, which made the
  // entire analysis engine a free, unauthenticated, unthrottled public API. It is now
  // handled by its own branch below — exempt from the auth *redirect* (the internal
  // fetch carries no cookies, so a redirect would blank every Stock Detail page) but
  // requiring the internal shared secret instead. See CYCLE_PATH below.
  // Cron endpoints run without a user session (Vercel Cron sends a Bearer secret,
  // not cookies). They must bypass the auth redirect; each route enforces its own
  // CRON_SECRET check, so opening them at the middleware is safe.
  '/api/cron',
  // Stripe posts webhook events server-to-server (no cookies). The route verifies
  // every request with the Stripe signature secret, so opening it at the middleware
  // is safe — an unsigned/forged POST is rejected 400 inside the handler.
  '/api/stripe/webhook',
];

export async function proxy(request: NextRequest) {
  // Dev-only bypass: skip auth so the local preview server can render pages
  // without a Supabase session. NODE_ENV guard ensures this never fires in prod.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
    return NextResponse.next({ request });
  }

  // /api/cycle — internal only. Checked FIRST, before the Supabase client is even
  // built, so an unauthorised probe costs one header comparison at the edge rather
  // than a JWT verification and a Python function invocation.
  //
  // 401, never a redirect: this is an API, and a 302 to /login would be parsed as
  // JSON by our own server-side fetch. Requests that DO carry the secret fall
  // straight through — they have no cookies, so the auth check below would bounce
  // them and blank every Stock Detail page.
  //
  // This is the edge half of the gate; api/cycle.py re-checks the same header and is
  // the authority. (F3 Step 10 audit, finding B2.)
  if (request.nextUrl.pathname === CYCLE_PATH) {
    if (hasInternalSecret(request.headers.get(INTERNAL_HEADER))) {
      return NextResponse.next({ request });
    }
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401, headers: NO_STORE },
    );
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
    // Same rule as the 401/402 below, and for the same reason: whether this bounce
    // happens at all depends on the caller's session, so it is a per-viewer answer.
    // Found while closing live-check Session 3's finding A — the two billing routes
    // were the reported gap, but their signed-out bounce came from here and was
    // equally silent. Harmless today (a cached bounce would deny a signed-in user,
    // not leak to them) and still worth stating rather than assuming.
    return NextResponse.redirect(loginUrl, { headers: NO_STORE });
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
    return NextResponse.redirect(new URL('/account/update-password', request.url), {
      headers: NO_STORE,
    });
  }

  // ── Premium API gate ────────────────────────────────────────────────────────
  // The screener has no free form, so /api/analyze is refused outright for an
  // unentitled caller. This is where the check must live: analyze.py is a Vercel
  // Python function with no way to read a Supabase session cookie, so the proxy —
  // which has already verified the JWT locally — is the session authority.
  //
  // On success the internal secret is INJECTED into the forwarded request, and
  // analyze.py requires it. That way the function can't be reached at all except
  // through this gate, even if the platform's routing ever changed underneath us.
  //
  // Scoped to this one path so ordinary page requests never pay for the profile
  // read. The read is a PK lookup on the same region, scoped by RLS to the caller's
  // own row. (F3 Step 10.)
  if (userId && PREMIUM_API_PATHS.some((p) => pathname === p)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, grace_until, billing_blocked')
      .eq('id', userId)
      .single();

    if (!hasAccess(profile)) {
      return NextResponse.json(
        { error: 'Payment Required', reason: accessDenialReason(profile) },
        { status: 402, headers: NO_STORE },
      );
    }

    const headers = new Headers(request.headers);
    headers.set(INTERNAL_HEADER, process.env.CYCLE_INTERNAL_SECRET ?? '');
    return NextResponse.next({ request: { headers } });
  }

  if (userId && (pathname === '/login' || pathname === '/signup')) {
    // Per-viewer for the same reason: /login answers a signed-in caller with a bounce
    // and a signed-out one with the page. A shared cache keyed on the URL alone could
    // not tell them apart.
    return NextResponse.redirect(new URL('/stocks', request.url), { headers: NO_STORE });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
