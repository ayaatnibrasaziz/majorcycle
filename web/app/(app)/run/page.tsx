import type { Metadata } from 'next';

import { RunAnalysis } from '@/components/run/RunAnalysis';
import { requireEntitled } from '@/lib/entitlement.server';
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
  await requireEntitled();

  const [universe, membership] = await Promise.all([
    fetchUniverseIndex(),
    fetchIndexMembership(),
  ]);
  return <RunAnalysis universe={universe} membership={membership} />;
}
