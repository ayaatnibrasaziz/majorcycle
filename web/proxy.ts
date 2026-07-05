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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (!user && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Recovery-session confinement: a session that arrived via a password-reset
  // link carries the mc_pw_recovery marker (set in auth/confirm). Until the
  // password is actually changed (which clears it via /auth/recovery-done), that
  // session may only reach the password-set page + its two helper routes —
  // everything else bounces back. Placed BEFORE the login/signup redirect so a
  // recovery session can't slip through to the app.
  if (
    user &&
    request.cookies.get(PW_RECOVERY_COOKIE) &&
    !PW_RECOVERY_ALLOWED_PATHS.includes(pathname)
  ) {
    return NextResponse.redirect(new URL('/account/update-password', request.url));
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/results', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
