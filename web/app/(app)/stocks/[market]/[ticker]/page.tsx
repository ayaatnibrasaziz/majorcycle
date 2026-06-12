import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

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
import { ShortInterest } from '@/components/stocks/ShortInterest';
import { ThesisInsights } from '@/components/stocks/ThesisInsights';
import { SmartMoneyActivity } from '@/components/stocks/SmartMoneyActivity';
import { SnowflakeRadar } from '@/components/stocks/SnowflakeRadar';
import { BadgeRow, StockHeader } from '@/components/stocks/StockHeader';
import { TechnicalLevels } from '@/components/stocks/TechnicalLevels';
import { StockSubnav } from '@/components/stocks/StockSubnav';
import { ValuationHistory } from '@/components/stocks/ValuationHistory';
import { VerdictCard } from '@/components/stocks/VerdictCard';
import { fetchBenchmarks } from '@/lib/benchmarks.server';
import { fetchCycleAnalysis } from '@/lib/cycle';
import { fetchMetricMedians } from '@/lib/medians.server';
import { fetchStockDetail } from '@/lib/stocks';
import { urlPartsToTicker } from '@/lib/ticker';
import type { FundamentalsSnapshot, Market, PriceBar } from '@/lib/types';

type RouteParams = { market: string; ticker: string };
type RouteSearch = { preset?: string };

type CyclePreset = 'short' | 'medium' | 'long';

function isValidMarket(value: string): value is Market {
  return value === 'us' || value === 'au' || value === 'ca';
}

// The Browse page picks the Major Cycle horizon and passes it via ?preset=.
// Anything unknown (incl. a future "custom") falls back to the Medium headline.
function parsePreset(value: string | undefined): CyclePreset {
  return value === 'short' || value === 'long' ? value : 'medium';
}

const PRESET_LABEL: Record<CyclePreset, string> = {
  short: 'Short-term (≈ 3 months)',
  medium: 'Medium-term (≈ 1 year)',
  long: 'Long-term (≈ 3 years)',
};

// ── Streamed cycle sections ──────────────────────────────────────────────────
// The cycle analysis is the slow part of the page (a cold compute can take a few
// seconds). Rather than block the whole page on it, the stock-only sections
// (header, price chart, fundamentals, sentiment) render immediately and each
// cycle-dependent section streams in via Suspense. All wrappers call the same
// React-cached fetchCycleAnalysis(ticker, preset), so there is still exactly one
// underlying compute shared across them.

type CycleProps = { ticker: string; preset: CyclePreset };

/** A muted placeholder matching a section's height, to limit layout shift. */
function SectionSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-[var(--bg-stripe)] rounded-[var(--radius)] animate-pulse ${className ?? 'h-[200px]'}`}
    />
  );
}

async function CycleBadges({
  ticker,
  preset,
  fundamentals,
}: CycleProps & { fundamentals: FundamentalsSnapshot }) {
  const cycle = await fetchCycleAnalysis(ticker, preset);
  if (!cycle) return null;
  return (
    <BadgeRow
      overallLabel={cycle.overallLabel}
      valuationZone={cycle.valuationZone}
      analystRecommendation={fundamentals.analystRecommendation}
      numAnalysts={fundamentals.numAnalystOpinions}
    />
  );
}

async function CycleKpi({ ticker, preset }: CycleProps) {
  const cycle = await fetchCycleAnalysis(ticker, preset);
  return cycle ? <KpiStrip cycle={cycle} /> : null;
}

async function CycleVerdict({
  ticker,
  preset,
  fundamentals,
}: CycleProps & { fundamentals: FundamentalsSnapshot }) {
  const cycle = await fetchCycleAnalysis(ticker, preset);
  return cycle ? (
    <VerdictCard
      cycle={cycle}
      fundamentals={fundamentals}
      currency={fundamentals.currency}
    />
  ) : null;
}

async function CycleThesis({
  ticker,
  preset,
  fundamentals,
}: CycleProps & { fundamentals: FundamentalsSnapshot }) {
  const cycle = await fetchCycleAnalysis(ticker, preset);
  return cycle ? (
    <ThesisInsights
      cycle={cycle}
      fundamentals={fundamentals}
      currency={fundamentals.currency}
    />
  ) : null;
}

async function CycleScorecard({ ticker, preset }: CycleProps) {
  const cycle = await fetchCycleAnalysis(ticker, preset);
  return cycle ? (
    <SnowflakeRadar cycle={cycle} />
  ) : (
    <SectionAnchor
      id="sec-scorecard"
      title="Scorecard"
      note="Snowflake radar scorecard is unavailable for this stock."
    />
  );
}

async function CycleDrawdown({
  ticker,
  preset,
  priceBars,
}: CycleProps & { priceBars: PriceBar[] }) {
  const cycle = await fetchCycleAnalysis(ticker, preset);
  return cycle ? <DrawdownOverlay priceBars={priceBars} cycle={cycle} /> : null;
}

async function RelativePerformanceSection({
  ticker,
  market,
  priceBars,
  benchSince,
}: {
  ticker: string;
  market: Market;
  priceBars: PriceBar[];
  benchSince: string | undefined;
}) {
  const benchmarks = benchSince ? await fetchBenchmarks(benchSince) : {};
  return (
    <RelativePerformance
      ticker={ticker}
      market={market}
      priceBars={priceBars}
      benchmarks={benchmarks}
    />
  );
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
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<RouteSearch>;
}) {
  const { market, ticker } = await params;
  if (!isValidMarket(market)) notFound();

  const { preset: presetParam } = await searchParams;
  const preset = parsePreset(presetParam);

  const stored = urlPartsToTicker(market, ticker);
  // Only the stock row + sector medians block the initial render — both are
  // fast. The slow cycle analysis and the benchmark series are streamed in via
  // Suspense below, so the bulk of the page paints without waiting on them.
  const [stock, medians] = await Promise.all([
    fetchStockDetail(stored),
    fetchMetricMedians(),
  ]);
  if (!stock) notFound();

  // Benchmark index series for the Relative Performance chart. Capped to the
  // later of the stock's first bar and ~20 years ago, so we never pull decades
  // of unneeded index history (the chart's Max range tops out around 20Y).
  const twentyYearsAgo = new Date();
  twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
  const benchFloor = twentyYearsAgo.toISOString().slice(0, 10);
  const firstBar = stock.priceBars[0]?.date;
  const benchSince = firstBar ? (firstBar > benchFloor ? firstBar : benchFloor) : undefined;

  return (
    <div className="-mt-2">
      <StockSubnav />

      <div className="pt-5 space-y-[18px]">
        {/* Read-only note when a non-default horizon was chosen on Browse.
            (No horizon selector lives on the detail page by design.) */}
        {preset !== 'medium' && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-[var(--brand-mid)] bg-[var(--brand-light)] border border-[#bfdbfe] rounded-[var(--radius-sm)] px-3 py-2"
            role="note"
          >
            <span className="font-semibold uppercase tracking-[0.5px] text-[10px]">
              Major Cycle horizon
            </span>
            <span className="text-[var(--text-secondary)]">
              {PRESET_LABEL[preset]}
            </span>
          </div>
        )}
        <section id="sec-thesis" className="scroll-mt-[120px]">
          <StockHeader
            stock={stock}
            badgeSlot={
              <Suspense fallback={null}>
                <CycleBadges
                  ticker={stored}
                  preset={preset}
                  fundamentals={stock.fundamentals}
                />
              </Suspense>
            }
          />
          <Suspense fallback={<SectionSkeleton className="h-[96px]" />}>
            <CycleKpi ticker={stored} preset={preset} />
          </Suspense>
          <Suspense fallback={<SectionSkeleton className="h-[200px]" />}>
            <CycleVerdict
              ticker={stored}
              preset={preset}
              fundamentals={stock.fundamentals}
            />
          </Suspense>
          <CompanyOverview overview={stock.companyOverview} />
          <Suspense fallback={<SectionSkeleton className="h-[160px]" />}>
            <CycleThesis
              ticker={stored}
              preset={preset}
              fundamentals={stock.fundamentals}
            />
          </Suspense>
        </section>
        <Suspense
          fallback={<SectionSkeleton className="h-[320px] scroll-mt-[120px]" />}
        >
          <CycleScorecard ticker={stored} preset={preset} />
        </Suspense>
        <section id="sec-cycle" className="scroll-mt-[120px] space-y-[18px]">
        {stock.priceBars.length > 0 && (
          <TechnicalLevels
            priceBars={stock.priceBars}
            currency={stock.fundamentals.currency}
          />
        )}
        <PriceChart priceBars={stock.priceBars} ticker={stored} />
        <Suspense fallback={<SectionSkeleton className="h-[260px]" />}>
          <CycleDrawdown
            ticker={stored}
            preset={preset}
            priceBars={stock.priceBars}
          />
        </Suspense>
        {stock.priceBars.length > 0 && (
          <AnalystTargetTrack
            fundamentals={stock.fundamentals}
            currentClose={stock.priceBars[stock.priceBars.length - 1]!.close}
            currency={stock.fundamentals.currency}
          />
        )}
        {stock.priceBars.length > 0 && (
          <Suspense fallback={<SectionSkeleton className="h-[300px]" />}>
            <RelativePerformanceSection
              ticker={stored}
              market={market}
              priceBars={stock.priceBars}
              benchSince={benchSince}
            />
          </Suspense>
        )}
        </section>
        <section id="sec-fundamentals" className="scroll-mt-[120px] space-y-[18px]">
          <EarningsHistory
            earningsHistory={stock.earningsHistory ?? []}
            currency={stock.fundamentals.currency}
          />
          <QuarterlyFinancials
            incomeStatementQuarterly={stock.incomeStatementQuarterly}
            cashflowQuarterly={stock.cashflowQuarterly}
            incomeStatementAnnual={stock.incomeStatementAnnual}
            cashflowAnnual={stock.cashflowAnnual}
          />
          <ValuationHistory
            peHistory={stock.peHistory ?? []}
            currentPe={stock.fundamentals.pe}
          />
          <BalanceSheet
            balanceSheetAnnual={stock.balanceSheetAnnual}
            fundamentals={stock.fundamentals}
          />
          <DividendHistory
            dividendHistory={stock.fundamentals.dividendHistory}
            fundamentals={stock.fundamentals}
            currentClose={
              stock.priceBars.length > 0
                ? stock.priceBars[stock.priceBars.length - 1]!.close
                : null
            }
          />
          <MetricsTable
            fundamentals={stock.fundamentals}
            sector={stock.sector}
            market={market}
            medians={medians}
          />
        </section>
        <section id="sec-sentiment" className="scroll-mt-[120px] space-y-[18px]">
          <SmartMoneyActivity
            insiderTransactions={stock.insiderTransactions}
            analystUpgradesDowngrades={stock.analystUpgradesDowngrades}
            priceBars={stock.priceBars}
          />
          <OwnershipStructure
            topHolders={stock.topHolders}
            fundamentals={stock.fundamentals}
          />
          <ShortInterest fundamentals={stock.fundamentals} />
          <NewsFeed news={stock.news} />
        </section>
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
