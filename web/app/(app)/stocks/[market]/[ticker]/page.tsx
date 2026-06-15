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
import { fetchCycleAnalysis, type CycleSpec } from '@/lib/cycle';
import { CUSTOM_PARAM_BOUNDS } from '@/lib/presets';
import { fetchMetricMedians } from '@/lib/medians.server';
import { fetchStockDetail } from '@/lib/stocks';
import { urlPartsToTicker, tickerDisplay } from '@/lib/ticker';
import type { FundamentalsSnapshot, Market, PriceBar } from '@/lib/types';

type RouteParams = { market: string; ticker: string };
type RouteSearch = {
  preset?: string;
  pullback?: string;
  profit?: string;
  lookback?: string;
};

function isValidMarket(value: string): value is Market {
  return value === 'us' || value === 'au' || value === 'ca';
}

const PRESET_LABEL = {
  short: 'Short-term (≈ 3 months)',
  medium: 'Medium-term (≈ 1 year)',
  long: 'Long-term (≈ 3 years)',
} as const;

function inBounds(n: number, b: { min: number; max: number }): boolean {
  return n >= b.min && n <= b.max;
}

// The Browse page picks the Major Cycle window and passes it via the query:
// a named preset (?preset=short|medium|long) or a fully custom window
// (?preset=custom&pullback=-7&profit=7&lookback=300). Invalid/unknown input
// falls back to the Medium headline. Returns the spec + a human label.
function parseSpec(sp: RouteSearch): { spec: CycleSpec; label: string } {
  if (sp.preset === 'custom') {
    const pullback = Number(sp.pullback);
    const profit = Number(sp.profit);
    const lookback = Number(sp.lookback);
    const b = CUSTOM_PARAM_BOUNDS;
    if (
      Number.isFinite(pullback) && inBounds(pullback, b.pullbackThreshold) &&
      Number.isFinite(profit) && inBounds(profit, b.profitThreshold) &&
      Number.isInteger(lookback) && inBounds(lookback, b.lookbackBars)
    ) {
      return {
        spec: { preset: 'custom', pullback, profit, lookback },
        label: `Custom (${pullback}% / +${profit}% / ${lookback} bars)`,
      };
    }
    return { spec: { preset: 'medium' }, label: PRESET_LABEL.medium };
  }
  const preset = sp.preset === 'short' || sp.preset === 'long' ? sp.preset : 'medium';
  return { spec: { preset }, label: PRESET_LABEL[preset] };
}

// ── Streamed cycle sections ──────────────────────────────────────────────────
// The cycle analysis is the slow part of the page (a cold compute can take a few
// seconds). Rather than block the whole page on it, the stock-only sections
// (header, price chart, fundamentals, sentiment) render immediately and each
// cycle-dependent section streams in via Suspense. All wrappers call the same
// React-cached fetchCycleAnalysis(ticker, preset), so there is still exactly one
// underlying compute shared across them.

type CycleProps = { ticker: string; spec: CycleSpec };

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
  spec,
  fundamentals,
}: CycleProps & { fundamentals: FundamentalsSnapshot }) {
  const cycle = await fetchCycleAnalysis(ticker, spec);
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

async function CycleKpi({ ticker, spec }: CycleProps) {
  const cycle = await fetchCycleAnalysis(ticker, spec);
  return cycle ? <KpiStrip cycle={cycle} /> : null;
}

async function CycleVerdict({
  ticker,
  spec,
  fundamentals,
}: CycleProps & { fundamentals: FundamentalsSnapshot }) {
  const cycle = await fetchCycleAnalysis(ticker, spec);
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
  spec,
  fundamentals,
}: CycleProps & { fundamentals: FundamentalsSnapshot }) {
  const cycle = await fetchCycleAnalysis(ticker, spec);
  return cycle ? (
    <ThesisInsights
      cycle={cycle}
      fundamentals={fundamentals}
      currency={fundamentals.currency}
    />
  ) : null;
}

async function CycleScorecard({ ticker, spec }: CycleProps) {
  const cycle = await fetchCycleAnalysis(ticker, spec);
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
  spec,
  priceBars,
}: CycleProps & { priceBars: PriceBar[] }) {
  const cycle = await fetchCycleAnalysis(ticker, spec);
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
  // Title is wrapped by the root template ("%s | MajorCycle"), so child titles
  // must NOT repeat the brand.
  if (!isValidMarket(market)) return { title: 'Stock not found' };

  const stored = urlPartsToTicker(market, ticker);
  const stock = await fetchStockDetail(stored);
  if (!stock) return { title: 'Stock not found' };

  const name = stock.name ?? stored;
  const display = tickerDisplay(stored);
  return {
    title: `${display} — ${name}`,
    description: `Major Cycle analysis, financial health, and valuation positioning for ${name} (${display}).`,
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

  // Built ONCE here and passed by reference to every cycle section so React's
  // cache() (and the underlying fetch/dev-spawn dedup) computes the cycle once.
  const { spec, label: horizonLabel } = parseSpec(await searchParams);

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
        {spec.preset !== 'medium' && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-[var(--brand-mid)] bg-[var(--brand-light)] border border-[#bfdbfe] rounded-[var(--radius-sm)] px-3 py-2"
            role="note"
          >
            <span className="font-semibold uppercase tracking-[0.5px] text-[10px]">
              Major Cycle horizon
            </span>
            <span className="text-[var(--text-secondary)]">{horizonLabel}</span>
          </div>
        )}
        <section id="sec-thesis" className="scroll-mt-[120px]">
          <StockHeader
            stock={stock}
            badgeSlot={
              <Suspense fallback={null}>
                <CycleBadges
                  ticker={stored}
                  spec={spec}
                  fundamentals={stock.fundamentals}
                />
              </Suspense>
            }
          />
          <Suspense fallback={<SectionSkeleton className="h-[96px]" />}>
            <CycleKpi ticker={stored} spec={spec} />
          </Suspense>
          <Suspense fallback={<SectionSkeleton className="h-[200px]" />}>
            <CycleVerdict
              ticker={stored}
              spec={spec}
              fundamentals={stock.fundamentals}
            />
          </Suspense>
          <CompanyOverview overview={stock.companyOverview} />
          <Suspense fallback={<SectionSkeleton className="h-[160px]" />}>
            <CycleThesis
              ticker={stored}
              spec={spec}
              fundamentals={stock.fundamentals}
            />
          </Suspense>
        </section>
        <Suspense
          fallback={<SectionSkeleton className="h-[320px] scroll-mt-[120px]" />}
        >
          <CycleScorecard ticker={stored} spec={spec} />
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
            spec={spec}
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
            currency={stock.fundamentals.currency}
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
