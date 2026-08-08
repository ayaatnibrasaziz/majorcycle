import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { SignupForm } from './SignupForm';

// Signing up creates a FREE account — the trial starts later, at Checkout (F3
// Step 10). This is the browser-tab title and the search-result headline, so it has
// to make the same promise the page body does.
// noindex (crawlable) — see lib/seo.ts. The description states only what a FREE
// account actually includes (CLAUDE.md, F3 Step 10): browse, the price chart, the
// drawdown overlay with its cycle bands, and every fundamentals section.
export const metadata: Metadata = pageMetadata({
  path: '/signup',
  title: 'Create a Free Account',
  description:
    'Create a free MajorCycle account — no card required. Browse US, Australian and Canadian stocks with price charts, drawdown cycles and full fundamentals.',
});

export default function SignupPage() {
  return <SignupForm />;
}
