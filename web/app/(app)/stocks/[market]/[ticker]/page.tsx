import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { KpiStrip } from '@/components/stocks/KpiStrip';
import { PriceChart } from '@/components/stocks/PriceChart';
import { StockHeader } from '@/components/stocks/StockHeader';
import { StockSubnav } from '@/components/stocks/StockSubnav';
import { VerdictCard } from '@/components/stocks/VerdictCard';
import { fetchCycleAnalysis } from '@/lib/cycle';
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
  // Parallel fetch — stock data and cycle analysis are independent
  const [stock, cycle] = await Promise.all([
    fetchStockDetail(stored),
    fetchCycleAnalysis(stored),
  ]);
  if (!stock) notFound();

  return (
    <div className="-mt-2">
      <StockSubnav />

      <div className="pt-5 space-y-[18px]">
        <section id="sec-thesis" className="scroll-mt-[120px]">
          <StockHeader stock={stock} cycle={cycle} />
          {cycle && <KpiStrip cycle={cycle} />}
          {cycle && (
            <VerdictCard
              cycle={cycle}
              fundamentals={stock.fundamentals}
              currency={stock.fundamentals.currency}
            />
          )}
        </section>
        <SectionAnchor
          id="sec-scorecard"
          title="Scorecard"
          note="Snowflake radar and technical levels strip land here."
        />
        <PriceChart priceBars={stock.priceBars} ticker={stored} />
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
