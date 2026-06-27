import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';

import { AnalystTargetTrack } from '@/components/stocks/AnalystTargetTrack';
import { BalanceSheet } from '@/components/stocks/BalanceSheet';
import { CompanyOverview } from '@/components/stocks/CompanyOverview';
import { DividendHistory } from '@/components/stocks/DividendHistory';
import { DrawdownOverlay } from '@/components/stocks/DrawdownOverlay';
import { EarningsHistory } from '@/components/stocks/EarningsHistory';
import { KpiStrip } from '@/components/stocks/KpiStrip';
import { MetricsTable } from '@/components/stocks/MetricsTable';
import { NewsFeed } from '@/components/stocks/NewsFeed';
import { OwnershipStructure } from '@/components/stocks/OwnershipStructure';
import { PriceChart } from '@/components/stocks/PriceChart';
import { QuarterlyFinancials } from '@/components/stocks/QuarterlyFinancials';
import { RelativePerformance } from '@/components/stocks/RelativePerformance';
import { ReportToolbar } from '@/components/stocks/ReportToolbar';
import { ShortInterest } from '@/components/stocks/ShortInterest';
import { ThesisInsights } from '@/components/stocks/ThesisInsights';
import { SmartMoneyActivity } from '@/components/stocks/SmartMoneyActivity';
import { SnowflakeRadar } from '@/components/stocks/SnowflakeRadar';
import { BadgeRow, StockHeader } from '@/components/stocks/StockHeader';
import { TechnicalLevels } from '@/components/stocks/TechnicalLevels';
import { ValuationHistory } from '@/components/stocks/ValuationHistory';
import { VerdictCard } from '@/components/stocks/VerdictCard';
import { fetchBenchmarks } from '@/lib/benchmarks.server';
import { fetchCycleAnalysis } from '@/lib/cycle';
import { parseSpec, isValidMarket, type RouteSearch } from '@/lib/horizon';
import { fetchMetricMedians } from '@/lib/medians.server';
import { fetchStockDetail } from '@/lib/stocks';
import { urlPartsToTicker, tickerDisplay, tickerToUrlParts } from '@/lib/ticker';

type RouteParams = { market: string; ticker: string };

/** Wrap each section so a card never splits across two printed pages. */
function ReportSection({ children }: { children: React.ReactNode }) {
  return <div className="report-section">{children}</div>;
}

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
 * Chrome-free, print-optimized snapshot of the full Stock Detail analysis. Reuses
 * the same fetchers + section components as the detail page, but renders a single
 * column inside #report-root (no subnav, a report header, every section). The
 * cycle is awaited directly (this is a print artifact — no streaming). Two export
 * modes — Save as PDF + Download HTML — live in the toolbar above the report.
 *
 * Scores are still derived on demand (#15-compliant — nothing new persisted).
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

  const { spec, label: horizonLabel } = parseSpec(await searchParams);
  const stored = urlPartsToTicker(market, ticker);

  const [stock, medians] = await Promise.all([
    fetchStockDetail(stored),
    fetchMetricMedians(),
  ]);
  if (!stock) notFound();

  const cycle = await fetchCycleAnalysis(stored, spec);

  // Benchmark series for Relative Performance — same cap as the detail page.
  const twentyYearsAgo = new Date();
  twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
  const benchFloor = twentyYearsAgo.toISOString().slice(0, 10);
  const firstBar = stock.priceBars[0]?.date;
  const benchSince = firstBar ? (firstBar > benchFloor ? firstBar : benchFloor) : undefined;
  const benchmarks = benchSince ? await fetchBenchmarks(benchSince) : {};

  const display = tickerDisplay(stored);
  const symbol = tickerToUrlParts(stored).symbol;
  const name = stock.name ?? stored;
  const generated = new Date().toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const docTitle = `${display} — ${name} · MajorCycle report`;
  const lastClose =
    stock.priceBars.length > 0 ? stock.priceBars[stock.priceBars.length - 1]!.close : null;

  return (
    <div className="report-page -mt-2">
      <ReportToolbar symbol={symbol} title={docTitle} />

      <div id="report-root" className="report-doc">
        <header className="report-header">
          <div className="report-brand">
            <Image src="/logo.png" alt="MajorCycle" width={32} height={32} priority />
            <div>
              <div className="report-brand-name">MajorCycle</div>
              <div className="report-brand-sub">Major Cycle analysis report</div>
            </div>
          </div>
          <div className="report-meta">
            <div className="report-meta-ticker">{display}</div>
            <div className="report-meta-name">{name}</div>
            <div className="report-meta-line">
              Horizon: {horizonLabel} · Generated {generated}
            </div>
          </div>
          <p className="report-disclaimer">
            Information only — not financial advice. Educational/informational analysis of
            public data; conduct your own independent due diligence.
          </p>
        </header>

        <div className="report-body">
          <ReportSection>
            <StockHeader
              stock={stock}
              badgeSlot={
                cycle ? (
                  <BadgeRow
                    overallLabel={cycle.overallLabel}
                    valuationZone={cycle.valuationZone}
                    analystRecommendation={stock.fundamentals.analystRecommendation}
                    numAnalysts={stock.fundamentals.numAnalystOpinions}
                  />
                ) : null
              }
            />
          </ReportSection>

          {cycle && (
            <ReportSection>
              <KpiStrip cycle={cycle} />
            </ReportSection>
          )}
          {cycle && (
            <ReportSection>
              <VerdictCard
                cycle={cycle}
                fundamentals={stock.fundamentals}
                currency={stock.fundamentals.currency}
              />
            </ReportSection>
          )}
          <ReportSection>
            <CompanyOverview overview={stock.companyOverview} />
          </ReportSection>
          {cycle && (
            <ReportSection>
              <ThesisInsights
                cycle={cycle}
                fundamentals={stock.fundamentals}
                currency={stock.fundamentals.currency}
              />
            </ReportSection>
          )}
          {cycle && (
            <ReportSection>
              <SnowflakeRadar cycle={cycle} />
            </ReportSection>
          )}
          {stock.priceBars.length > 0 && (
            <ReportSection>
              <TechnicalLevels
                priceBars={stock.priceBars}
                currency={stock.fundamentals.currency}
              />
            </ReportSection>
          )}
          <ReportSection>
            <PriceChart priceBars={stock.priceBars} ticker={stored} />
          </ReportSection>
          {cycle && (
            <ReportSection>
              <DrawdownOverlay priceBars={stock.priceBars} cycle={cycle} />
            </ReportSection>
          )}
          {lastClose != null && (
            <ReportSection>
              <AnalystTargetTrack
                fundamentals={stock.fundamentals}
                currentClose={lastClose}
                currency={stock.fundamentals.currency}
              />
            </ReportSection>
          )}
          {stock.priceBars.length > 0 && (
            <ReportSection>
              <RelativePerformance
                ticker={stored}
                market={market}
                priceBars={stock.priceBars}
                benchmarks={benchmarks}
              />
            </ReportSection>
          )}

          <ReportSection>
            <EarningsHistory
              earningsHistory={stock.earningsHistory ?? []}
              currency={stock.fundamentals.currency}
            />
          </ReportSection>
          <ReportSection>
            <QuarterlyFinancials
              incomeStatementQuarterly={stock.incomeStatementQuarterly}
              cashflowQuarterly={stock.cashflowQuarterly}
              incomeStatementAnnual={stock.incomeStatementAnnual}
              cashflowAnnual={stock.cashflowAnnual}
              currency={stock.fundamentals.currency}
            />
          </ReportSection>
          <ReportSection>
            <ValuationHistory
              peHistory={stock.peHistory ?? []}
              currentPe={stock.fundamentals.pe}
            />
          </ReportSection>
          <ReportSection>
            <BalanceSheet
              balanceSheetAnnual={stock.balanceSheetAnnual}
              fundamentals={stock.fundamentals}
            />
          </ReportSection>
          <ReportSection>
            <DividendHistory
              dividendHistory={stock.fundamentals.dividendHistory}
              fundamentals={stock.fundamentals}
              currentClose={lastClose}
            />
          </ReportSection>
          <ReportSection>
            <MetricsTable
              fundamentals={stock.fundamentals}
              industry={stock.industry}
              sector={stock.sector}
              market={market}
              medians={medians}
            />
          </ReportSection>

          <ReportSection>
            <SmartMoneyActivity
              insiderTransactions={stock.insiderTransactions}
              analystUpgradesDowngrades={stock.analystUpgradesDowngrades}
              priceBars={stock.priceBars}
            />
          </ReportSection>
          <ReportSection>
            <OwnershipStructure
              topHolders={stock.topHolders}
              fundamentals={stock.fundamentals}
            />
          </ReportSection>
          <ReportSection>
            <ShortInterest fundamentals={stock.fundamentals} />
          </ReportSection>
          <ReportSection>
            <NewsFeed news={stock.news} />
          </ReportSection>
        </div>
      </div>
    </div>
  );
}
