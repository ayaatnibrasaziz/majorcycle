import type { Metadata } from 'next';

import { RunAnalysis } from '@/components/run/RunAnalysis';
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
  const [universe, membership] = await Promise.all([
    fetchUniverseIndex(),
    fetchIndexMembership(),
  ]);
  return <RunAnalysis universe={universe} membership={membership} />;
}
