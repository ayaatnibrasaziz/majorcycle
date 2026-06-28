import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReportDocument } from '@/components/stocks/ReportDocument';
import { buildReportData } from '@/lib/report-data';
import { isValidMarket, type RouteSearch } from '@/lib/horizon';
import { fetchStockDetail } from '@/lib/stocks';
import { urlPartsToTicker, tickerDisplay } from '@/lib/ticker';

type RouteParams = { market: string; ticker: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { market, ticker } = await params;
  if (!isValidMarket(market)) return { title: 'Report not found' };
  const stored = urlPartsToTicker(market, ticker);
  const stock = await fetchStockDetail(stored);
  if (!stock) return { title: 'Report not found' };
  const name = stock.name ?? stored;
  return {
    title: `${tickerDisplay(stored)} report — ${name}`,
    robots: { index: false, follow: false },
  };
}

/**
 * On-screen interactive preview of the full report. Renders the SAME
 * `ReportDocument` the one-click download bakes into the offline file, from the
 * SAME `buildReportData` payload — so what you see here is exactly what the
 * downloaded .html contains. (The download itself is one-click from the Stock
 * Detail subnav; this page is the live A/B reference + a shareable deep-link.)
 *
 * Auth-gated by the (app) layout for free. Scores derived on demand — nothing
 * persisted (#15-compliant).
 */
export default async function StockReportPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<RouteSearch>;
}) {
  const { market, ticker } = await params;
  if (!isValidMarket(market)) notFound();

  const data = await buildReportData(market, ticker, await searchParams);
  if (!data) notFound();

  return (
    <main className="report-page -mt-2 pt-5">
      <ReportDocument data={data} />
    </main>
  );
}
