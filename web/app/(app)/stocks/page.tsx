import type { Metadata } from 'next';

import { StockBrowser } from '@/components/stocks/StockBrowser';
import { fetchUniverseIndex } from '@/lib/universe.server';

export const metadata: Metadata = {
  title: 'Browse Stocks',
  description:
    'Search and browse the MajorCycle universe of US, Australian, and Canadian equities.',
};

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
