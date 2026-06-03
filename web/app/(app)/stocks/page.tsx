import type { Metadata } from 'next';

import { StockBrowser } from '@/components/stocks/StockBrowser';
import { fetchUniverseIndex } from '@/lib/universe.server';

export const metadata: Metadata = {
  title: 'Browse Stocks',
  description:
    'Search and browse the MajorCycle universe of US, Australian, and Canadian equities.',
};

// The universe index is read from Supabase at request time (behind a daily
// cache), so this page must render on demand — never static-prerendered at
// build, where Supabase env vars are absent. (The [market]/[ticker] detail
// route is dynamic-by-default via its params; this static route is not.)
export const dynamic = 'force-dynamic';

export default async function StocksBrowsePage() {
  const stocks = await fetchUniverseIndex();

  return (
    <div>
      <p className="text-[12px] text-[var(--text-muted)] mb-4 max-w-2xl leading-relaxed">
        Search by ticker or company name, or filter by market and sector. Select
        a stock to open its full Major Cycle breakdown.
      </p>
      <StockBrowser stocks={stocks} />
    </div>
  );
}
