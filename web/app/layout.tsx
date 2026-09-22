import type { Metadata } from 'next';
import { preload } from 'react-dom';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SITE_ORIGIN } from '@/lib/url';
import './globals.css';

/**
 * The two font files, preloaded as `next/font` did (the faces themselves are in
 * `globals.css` — see the note there for why they are committed files now).
 */
const FONT_FILES = ['/fonts/sora-latin-v1.woff2', '/fonts/jetbrains-mono-latin-v1.woff2'];

/**
 * Google Search Console ownership proof. Renders
 * `<meta name="google-site-verification" content="…">` when set.
 *
 * An env var rather than a committed literal, so the token can be rotated without a
 * code change — and so this file says nothing untrue when it is absent: an empty
 * `verification` block emits no tag at all, rather than an empty one that would read
 * as a failed verification. Verifying this way is why NO Cloudflare DNS record and
 * no HTML file upload is needed.
 */
const googleSiteVerification = process.env['NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION'];

export const metadata: Metadata = {
  title: {
    default: 'MajorCycle — Financial Terminal',
    template: '%s | MajorCycle',
  },
  description:
    'Where US, Australian and Canadian shares sit against their own history of falls, with financial health scores and analyst data. Educational, not advice.',
  // SITE_ORIGIN, not a re-typed literal — it disagreed with lib/url.ts until G1.
  metadataBase: new URL(process.env['NEXT_PUBLIC_SITE_URL'] ?? SITE_ORIGIN),
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  for (const href of FONT_FILES) {
    preload(href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  }
  return (
    <html lang="en">
      <body>
        {children}
        {/*
          Real-user performance, and the ONLY instrument that can answer decision #33.
          Added 2026-09-07 (P9, `5A-006`).

          The audit recorded the ticker page's Lighthouse target as BLOCKED rather than
          unfinished, and this is why: three consecutive preview runs gave 370 / 540 /
          990 ms of blocking time, the same unchanged page has scored 85, 81, 76, 63 and
          62 on one machine, and no external lab tool can reach a page behind sign-in.
          This measures real visitors on real devices, grouped by route, so no single
          unlucky run can dominate and the SIGNED-IN pages are finally in scope.

          It reports nothing until there is traffic (11w) - which is the argument for
          switching it on BEFORE launch rather than after, not evidence that it is
          broken. Do not chase an empty dashboard.

          CSP: the script and its beacon are both same-origin (`/_vercel/speed-insights/*`),
          so `script-src 'self'` and `connect-src 'self'` already cover it and no new
          origin is added. A script with a `src` is judged by its URL, never by a nonce
          (11u), so the prerendered pages need no change either.
        */}
        <SpeedInsights />
      </body>
    </html>
  );
}
