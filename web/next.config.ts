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

const nextConfig: NextConfig = {
  distDir,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
