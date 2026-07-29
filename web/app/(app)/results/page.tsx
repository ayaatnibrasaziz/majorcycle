import type { Metadata } from 'next';

import { PremiumLockPage } from '@/components/PremiumLockPage';
import { Results, type ResultsLookup } from '@/components/results/Results';
import { requirePremiumPage } from '@/lib/entitlement.server';
import { fetchUniverseIndex } from '@/lib/universe.server';

export const metadata: Metadata = {
  title: 'Results',
  description: 'Your ranked Major Cycle analysis results.',
};

// Loads the light universe index at request time (behind a daily cache) to build
// a ticker → {name, sector, market} lookup the client table uses to label rows.
// The actual results are held client-side (AnalysisContext + sessionStorage), so
// this page only supplies the enrichment map — never the ratings (those are always
// derived in the browser from the in-memory run, CLAUDE.md #15).
export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  // Premium: results are the output of the screener, and the ranked table exposes
  // every rating and score. Gated with /run so the pair can't be reached separately.
  const viewer = await requirePremiumPage();
  if (!viewer.entitled) {
    return (
      <PremiumLockPage
        feature="Results"
        blurb="The ranked output of a screener run — every stock you analysed sorted by rating, with filters, the opportunity map and CSV export."
        reason={viewer.reason ?? 'no_subscription'}
        displayName={viewer.displayName ?? ''}
        email={viewer.email ?? ''}
      />
    );
  }

  const universe = await fetchUniverseIndex();
  const lookup: ResultsLookup = {};
  for (const s of universe) {
    lookup[s.ticker] = { name: s.name, sector: s.sector, market: s.market };
  }

  return <Results lookup={lookup} />;
}
