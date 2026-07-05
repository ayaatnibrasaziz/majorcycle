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

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
