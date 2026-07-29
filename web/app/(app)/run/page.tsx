import type { Metadata } from 'next';

import { PremiumLockPage } from '@/components/PremiumLockPage';
import { RunAnalysis } from '@/components/run/RunAnalysis';
import { requirePremiumPage } from '@/lib/entitlement.server';
import { fetchIndexMembership } from '@/lib/index-membership.server';
import { fetchUniverseIndex } from '@/lib/universe.server';

export const metadata: Metadata = {
  title: 'Run Analysis',
  description:
    'Screen a basket or your own list of US, Australian, and Canadian equities through the Major Cycle.',
};

// Loads the light universe index (for baskets + autocomplete + CSV validation)
// from Supabase at request time, behind a daily cache — so the page must render
// on demand, never static-prerendered at build (where Supabase env vars absent).
export const dynamic = 'force-dynamic';

export default async function RunPage() {
  // Fully premium — the screener is the highest-value feature and the only one with
  // a meaningful per-use cost. No free or sample form of it exists.
  const viewer = await requirePremiumPage();
  if (!viewer.entitled) {
    // Returned before the universe is fetched: nothing premium is loaded, and the
    // reader keeps the sidebar, the header and this route.
    return (
      <PremiumLockPage
        feature="Run Analysis"
        blurb="The screener runs the Major Cycle across a whole basket, your own list or the entire universe at once, instead of one stock at a time."
        reason={viewer.reason ?? 'no_subscription'}
        displayName={viewer.displayName ?? ''}
        email={viewer.email ?? ''}
      />
    );
  }

  const [universe, membership] = await Promise.all([
    fetchUniverseIndex(),
    fetchIndexMembership(),
  ]);
  return <RunAnalysis universe={universe} membership={membership} />;
}
