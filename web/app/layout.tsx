import type { Metadata } from 'next';
import { Sora, JetBrains_Mono } from 'next/font/google';
import { SITE_ORIGIN } from '@/lib/url';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

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
    'Discover where US, Australian, and Canadian stocks sit relative to their historical Major Cycle. Fundamental health scores, valuation positioning, and analyst data — all in one place.',
  // SITE_ORIGIN, not a re-typed literal — it disagreed with lib/url.ts until G1.
  metadataBase: new URL(process.env['NEXT_PUBLIC_SITE_URL'] ?? SITE_ORIGIN),
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
