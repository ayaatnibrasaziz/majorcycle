import type { NextConfig } from "next";

// ── Security headers (F0.5 finding F) ───────────────────────────────
// Vercel already sends HSTS. These four are flat strings that are the same on
// every response, so they belong here.
//
// ⚠️ **The Content-Security-Policy is NOT here — it lives in `proxy.ts`.** It
// stopped being one string on 2026-08-23: a route rendered per request now carries
// a per-request nonce and a prerendered one carries `'unsafe-inline'`, and only
// middleware knows which request it is looking at. `lib/csp.ts` builds both forms
// and explains why the split is a fact about this site rather than a compromise.
//
// The consequence to know: middleware does not run for `_next/static`, `_next/image`
// or image files (see the matcher at the foot of `proxy.ts`), so those responses
// carry these four headers and no CSP. That is correct rather than tolerated — a
// CSP governs the DOCUMENT that loads a subresource, not the subresource itself,
// and every document on this site goes through the middleware.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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

  // ── Config review, Layer G, 2026-08-22 ─────────────────────────────────────
  // Three settings the roadmap flagged as "never consciously decided". Each is
  // now decided, and the two that stay at their defaults say so, because
  // "nobody chose this" and "we chose the default" look identical from outside
  // and this repo has been bitten four times by the difference (CLAUDE.md 11a).
  //
  // ⚠️ **1. `poweredByHeader: false`.** Next sends `X-Powered-By: Next.js` on
  // every response — verified on the wire, not assumed. It tells an attacker
  // which framework's advisories to read and buys us nothing.
  poweredByHeader: false,
  //
  // ⚠️ **2. No `images` block, deliberately.** Every image on the site is local
  // (`/logo.png`, the three `/learn` illustrations). Leaving `remotePatterns`
  // unset is not an omission — it is the setting that stops our own image
  // optimiser being used as an open proxy for arbitrary URLs. Adding a pattern
  // is a security decision, not a convenience one.
  //
  // ⚠️ **3. The CSP is ENFORCING, and it is built in `proxy.ts`.** It was
  // `Report-Only` until 2026-08-23. The flip was scoped by measuring 22 pages on
  // the production build: 186 violations, every single one `script-src-elem ::
  // inline` — Next's own hydration bootstraps — and zero for every other
  // directive. See `lib/csp.ts` for the two forms and `pnpm check:csp` for the
  // proof, which reads the headers and the rendered HTML off a real server rather
  // than trusting this file.
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    return retiredRoutes;
  },
};

export default nextConfig;
