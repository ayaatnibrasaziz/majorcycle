import type { NextConfig } from "next";

// ── Security headers (F0.5 finding F) ────────────────────────────────────────
// Vercel already sends HSTS. We add clickjacking / MIME / referrer / permissions
// protections plus a Content-Security-Policy.
//
// The CSP is shipped as **Report-Only** first: it does NOT block anything yet, it
// only reports what WOULD be blocked. This is deliberate — it lets us confirm the
// Google Identity Services popup, the Supabase auth calls, and Next.js's own
// inline hydration scripts all still work before we switch it to enforcing in a
// later change. Flip `Content-Security-Policy-Report-Only` → `Content-Security-Policy`
// only after verifying the browser console shows no blocking violations (and,
// for scripts, after adding a nonce or `'unsafe-inline'` as needed).
const supabaseOrigin = (() => {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  try {
    return url ? new URL(url).origin : 'https://*.supabase.co';
  } catch {
    return 'https://*.supabase.co';
  }
})();

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://www.majorcycle.com",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin} https://accounts.google.com`,
  "frame-src https://accounts.google.com",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy-Report-Only', value: csp },
];

// ── Build output directory (live-check Session 2, finding C) ─────────────────
// `pnpm build` and the dev server used to share ONE `web/.next`, so a production
// build left behind would make `next dev` serve HTML 404s for routes that exist.
// That cost time twice, and the second time it made a PAYWALLED route (the report
// download) look like a broken gate — a false security signal produced during the
// very checks meant to find real ones. A note in the anti-pattern table wasn't
// enough; the directories are now simply separate.
//
// `next dev` sets NODE_ENV=development, `next build` sets production, so the split
// is automatic — nothing to remember and nothing to pass. `pnpm e2e` spawns its own
// `next dev`, so it lands in `.next-dev` too and can no longer be poisoned by a build.
// Vercel runs `next build` and reads `.next`, so deployment is unaffected.
// Both paths are gitignored (`.next*` — see .gitignore).
const distDir = process.env.NODE_ENV === 'development' ? '.next-dev' : '.next';

// ── Retired routes ───────────────────────────────────────────────────────────
// `/methodology` was a public page of its own until Layer G; its content is now
// the `#how-it-works` section of the landing page. It is in the sitemap Google
// has already fetched, and it was linked from the header, the footer and the
// landing hero, so it cannot simply 404.
//
// 308 rather than 307: permanent, and it tells a search engine to transfer the
// page's accumulated credit to the new address instead of holding both.
//
// ⚠️ The destination is a LITERAL. Never derive a redirect target from the
// request (a query parameter, a header) — that is an open redirect.
//
// ⚠️ Ordering is the thing to prove, not assume. This has to fire BEFORE
// `proxy.ts`, or a signed-out reader gets 307 → /login (the middleware bounces
// anything not in PUBLIC_PATHS, and /methodology has just been removed from that
// list). Measured on the wire by e2e/how-it-works.spec.ts, which asserts the
// status is 308 and that the fragment survives into the Location header — the
// fragment is the whole point, since without it the reader lands at the top of a
// long page with no idea what they were sent to see.
const retiredRoutes = [
  { source: '/methodology', destination: '/#how-it-works', permanent: true },
];

const nextConfig: NextConfig = {
  distDir,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    return retiredRoutes;
  },
};

export default nextConfig;
