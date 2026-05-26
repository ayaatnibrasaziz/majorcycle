import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { StockSubnav } from '@/components/stocks/StockSubnav';
import { fetchStockDetail } from '@/lib/stocks';
import { urlPartsToTicker } from '@/lib/ticker';
import type { Market } from '@/lib/types';

type RouteParams = { market: string; ticker: string };

function isValidMarket(value: string): value is Market {
  return value === 'us' || value === 'au' || value === 'ca';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { market, ticker } = await params;
  if (!isValidMarket(market)) return { title: 'Stock not found · MajorCycle' };

  const stored = urlPartsToTicker(market, ticker);
  const stock = await fetchStockDetail(stored);
  if (!stock) return { title: 'Stock not found · MajorCycle' };

  const name = stock.name ?? stored;
  return {
    title: `${stored} — ${name} · MajorCycle`,
    description: `Major Cycle analysis, financial health, and valuation positioning for ${name} (${stored}).`,
  };
}

export default async function StockDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { market, ticker } = await params;
  if (!isValidMarket(market)) notFound();

  const stored = urlPartsToTicker(market, ticker);
  const stock = await fetchStockDetail(stored);
  if (!stock) notFound();

  return (
    <div className="-mt-2">
      <StockSubnav />

      <div className="pt-5 space-y-[18px]">
        <SectionAnchor
          id="sec-thesis"
          title="Thesis"
          note={`Header strip, verdict card, and insight grid land here. Loaded: ${stored} · ${stock.priceBars.length} price bars.`}
        />
        <SectionAnchor
          id="sec-scorecard"
          title="Scorecard"
          note="Snowflake radar and technical levels strip land here."
        />
        <SectionAnchor
          id="sec-cycle"
          title="Cycle"
          note="Price chart, drawdown/profit overlay, Major Cycle stats, analyst target track, and relative performance land here."
        />
        <SectionAnchor
          id="sec-fundamentals"
          title="Fundamentals"
          note="Earnings dashboard, quarterly financials, valuation history, balance sheet, dividends, and the metrics table land here."
        />
        <SectionAnchor
          id="sec-sentiment"
          title="Sentiment"
          note="Smart money activity, ownership structure, short interest, and news feed land here."
        />
      </div>
    </div>
  );
}

function SectionAnchor({
  id,
  title,
  note,
}: {
  id: string;
  title: string;
  note: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-[120px] bg-white border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] p-[18px]"
    >
      <div className="text-[10px] uppercase font-bold tracking-[1px] text-[var(--text-muted)]">
        {title}
      </div>
      <div className="mt-1.5 text-[13px] text-[var(--text-secondary)] leading-relaxed">
        {note}
      </div>
    </section>
  );
}
