import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DELETION_NOTICE_COOKIE, DELETION_NOTICE_PATH } from '@/lib/account';
import { PW_RECOVERY_COOKIE, PW_RECOVERY_ALLOWED_PATHS } from '@/lib/authRecovery';
import { contentSecurityPolicy, createNonce, usesNonce } from '@/lib/csp';
import { accessDenialReason, hasAccess } from '@/lib/entitlement';
import { INTERNAL_HEADER, hasInternalSecret } from '@/lib/internalAuth';
import { PUBLIC_ENDPOINTS, PUBLIC_PAGES } from '@/lib/seo';
import { SITE_ORIGIN } from '@/lib/url';

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

/**
 * Public pages whose content is only true for a reader with NO session. A signed-in
 * caller is redirected to /stocks. See the guard near the end of `proxy` for why this
 * is a list rather than a condition per page.
 */
const SIGNED_OUT_ONLY_PATHS = ['/', '/login', '/signup', '/deletion-requested'];

/**
 * Everything reachable without a session: the public PAGES plus the machine
 * endpoints, both from lib/seo.ts.
 *
 * DERIVED, not re-typed. The page half also drives sitemap.xml, robots.txt and each
 * page's canonical tag, so a second copy here would be a fourth place for the same
 * rule to drift (11c) — and the failure would be silent in the worst direction: a
 * page listed in the sitemap that answers Google with a redirect to /login.
 *
 * ⚠️ Post-deletion confirmation `/deletion-requested` is public because the user has
 * just been signed out — but it is ALSO in SIGNED_OUT_ONLY_PATHS below: reachable
 * without a session, and *only* without one. (The reactivation page stays gated.)
 *
 * ⚠️ /api/cycle is deliberately absent. It used to be listed, which made the entire
 * analysis engine a free, unauthenticated, unthrottled public API. It is now handled
 * by its own branch below — exempt from the auth *redirect* (the internal fetch
 * carries no cookies, so a redirect would blank every Stock Detail page) but
 * requiring the internal shared secret instead. See CYCLE_PATH above.
 */
const PUBLIC_PATHS = [
  ...PUBLIC_PAGES.map((page) => page.path),
  ...PUBLIC_ENDPOINTS,
];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── Content-Security-Policy ─────────────────────────────────────────────────
  // The policy is built HERE rather than in `next.config.ts` because it is no
  // longer one string: a route rendered per request gets a per-request nonce, a
  // prerendered one cannot (lib/csp.ts explains why at length). Only middleware
  // knows which request it is looking at.
  //
  // ⚠️ Every response this function returns must carry it — including the
  // refusals and the redirects. Next attaches NO `Cache-Control` to route
  // handlers and it attaches no CSP either; "I didn't see a missing header" is
  // not the same as "the header is there", and this repo has been bitten four
  // times by exactly that (11a). Hence `send()`, which every `return` goes
  // through, and `check:csp`, which reads them off the wire.
  const nonce = usesNonce(pathname) ? createNonce() : null;
  const policy = contentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV !== 'production',
    supabaseUrl: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    siteOrigin: SITE_ORIGIN,
  });

  // The nonce reaches the renderer on the REQUEST, not the response: Next parses
  // an incoming `Content-Security-Policy` for a `'nonce-…'` source and stamps it
  // onto every script tag it emits (`get-script-nonce-from-header.js`).
  //
  // ⚠️ Built only when there IS a nonce. Handing Next modified request headers is
  // a signal in its own right, and the seven prerendered routes must keep being
  // served from their prebuilt files — that is the 77ms click. Nothing changes
  // for them here at all.
  // ⚠️ Built fresh on every call, never once and reused. `setAll` below writes the
  // refreshed session onto `request.cookies` and then re-derives the response; a
  // header snapshot taken up here would still hold the OLD cookie and hand the
  // renderer a stale session — on precisely the nonce'd routes, which are the
  // signed-in ones. Cloning costs nothing; being wrong here costs a sign-in.
  const nonceHeaders = () => {
    if (!nonce) return null;
    const headers = new Headers(request.headers);
    headers.set('content-security-policy', policy);
    headers.set('x-nonce', nonce);
    return headers;
  };

  const passThrough = (extraHeaders?: Headers) => {
    const headers = extraHeaders ?? nonceHeaders();
    return headers
      ? NextResponse.next({ request: { headers } })
      : NextResponse.next({ request });
  };

  // ⚠️ The SAME string goes on the response as went on the request, and that is a
  // safety property rather than tidiness. Next's Node server copies every
  // middleware response header back onto the request before rendering
  // (`resolve-routes.js` — `resHeaders[key] = value; req.headers[key] = value`),
  // so locally the response wins and the two can never be seen to disagree.
  // Vercel's edge is not obliged to do that. Deriving the response from a second
  // `createNonce()` would therefore pass every local check and ship a page whose
  // header names a nonce its own HTML does not carry — every script refused, the
  // page rendering and then doing nothing, in production only. Measured: that is
  // exactly what a prerendered route with a nonce policy does (14 violations on
  // `/terms`, zero nonce attributes in the document). One string, used twice.
  const send = <T extends NextResponse>(response: T): T => {
    response.headers.set('Content-Security-Policy', policy);
    return response;
  };

  // Dev-only bypass: skip auth so the local preview server can render pages
  // without a Supabase session. NODE_ENV guard ensures this never fires in prod.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
    return send(passThrough());
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
  if (pathname === CYCLE_PATH) {
    if (hasInternalSecret(request.headers.get(INTERNAL_HEADER))) {
      return send(passThrough());
    }
    return send(NextResponse.json(
      { error: 'unauthorized' },
      { status: 401, headers: NO_STORE },
    ));
  }

  let response = passThrough();

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
          response = passThrough();
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
    return send(NextResponse.redirect(loginUrl, { headers: NO_STORE }));
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
    return send(NextResponse.redirect(new URL('/account/update-password', request.url), {
      headers: NO_STORE,
    }));
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
      .select('subscription_status, grace_until, billing_blocked, deletion_scheduled_at')
      .eq('id', userId)
      .single();

    // Deletion outranks billing, exactly as it does for pages (requirePremiumPage
    // redirects to /reactivate before it ever consults entitlement). Until live-check
    // Session 3 this gate asked only about entitlement, so a deletion-scheduled account
    // — signed out globally, and told by every page that it is deactivated — still got
    // the full paid payload from this endpoint. 403, not 402: 402 invites them to pay,
    // which answers the wrong question for someone whose account is being deleted, and
    // they may already have paid. Placed before hasAccess so the reason is never
    // mistaken for a billing problem.
    if (profile?.deletion_scheduled_at) {
      return send(NextResponse.json(
        { error: 'Account scheduled for deletion', reason: 'account_deleting' },
        { status: 403, headers: NO_STORE },
      ));
    }

    if (!hasAccess(profile)) {
      return send(NextResponse.json(
        { error: 'Payment Required', reason: accessDenialReason(profile) },
        { status: 402, headers: NO_STORE },
      ));
    }

    const headers = nonceHeaders() ?? new Headers(request.headers);
    headers.set(INTERNAL_HEADER, process.env.CYCLE_INTERNAL_SECRET ?? '');
    return send(passThrough(headers));
  }

  // Pages that only make sense to a SIGNED-OUT reader. Being in PUBLIC_PATHS only
  // exempts a page from the login bounce; it does not stop a signed-in one seeing it,
  // and each of these asserts something false to a reader who already has a session.
  //
  // /deletion-requested was the one that proved the point: it states "your account is
  // now scheduled for permanent deletion" unconditionally, so a user who deleted, then
  // reactivated, then pressed Back was told their account was still going away. Found
  // on the live site during the Layer F audit (F-A4-c). The rule is enforced HERE, in
  // one list, because it had been spread across this file and pricing/page.tsx — which
  // is exactly how a page comes to opt out of it by omission.
  if (userId && SIGNED_OUT_ONLY_PATHS.includes(pathname)) {
    // Per-viewer for the same reason as the bounce above: /login answers a signed-in
    // caller with a redirect and a signed-out one with the page. A shared cache keyed
    // on the URL alone could not tell them apart.
    return send(NextResponse.redirect(new URL('/stocks', request.url), { headers: NO_STORE }));
  }

  // The deletion confirmation is for ONE reader: the person whose browser just
  // completed the request. Being signed-out-only (above) answers "should a
  // signed-in reader see this?", never "is this signed-out reader the right
  // one?" — so until now any stranger typing the URL was told their account was
  // scheduled for permanent deletion. `requestAccountDeletion` drops the marker
  // (lib/account.ts) immediately before redirecting here.
  //
  // Deliberately placed AFTER the signed-out-only bounce, so a signed-in reader
  // still goes to /stocks exactly as before and this can only ever narrow the
  // signed-out case. /login is the right destination: the deletion flow has just
  // signed them out globally, and it is where the page's own button points.
  if (pathname === DELETION_NOTICE_PATH && !request.cookies.get(DELETION_NOTICE_COOKIE)) {
    return send(NextResponse.redirect(new URL('/login', request.url), { headers: NO_STORE }));
  }

  return send(response);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
