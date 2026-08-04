import type { Metadata } from 'next';
import Link from 'next/link';
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
import { PremiumLockCard, PremiumLockInlineCta } from '@/components/stocks/PremiumLock';
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
import { getViewerEntitlement } from '@/lib/entitlement.server';
import {
  peHistoryUnavailableReason,
  reportingCurrencyNote,
  statementCurrency,
} from '@/lib/format';
import { recordFreeView } from '@/lib/freeViews';
import { parseSpec, isValidMarket, horizonQuery, type RouteSearch } from '@/lib/horizon';
import { fetchMetricMedians } from '@/lib/medians.server';
import { fetchStockDetail } from '@/lib/stocks';
import { urlPartsToTicker, tickerDisplay, tickerToUrlParts } from '@/lib/ticker';
import { isFullCycle, type FundamentalsSnapshot, type Market, type PriceBar } from '@/lib/types';

type RouteParams = { market: string; ticker: string };

// ── Streamed cycle sections ──────────────────────────────────────────────────
// The cycle analysis is the slow part of the page (a cold compute can take a few
// seconds). Rather than block the whole page on it, the stock-only sections
// (header, price chart, fundamentals, sentiment) render immediately and each
// cycle-dependent section streams in via Suspense. All wrappers call the same
// React-cached fetchCycleAnalysis(ticker, preset), so there is still exactly one
// underlying compute shared across them.

// `entitled` is threaded explicitly into every cycle section rather than read from a
// context: each is an async server component that fetches its own (memoised) cycle,
// and `fetchCycleAnalysis` requires the flag because it is part of the cache key.
// Passing it here is what guarantees a free render and a paid render can never share
// a cached payload.
type CycleProps = { ticker: string; spec: CycleSpec; entitled: boolean };

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
  entitled,
  fundamentals,
}: CycleProps & { fundamentals: FundamentalsSnapshot }) {
  const cycle = await fetchCycleAnalysis(ticker, spec, entitled);
  // PREMIUM: the rating + valuation-zone chips are pure judgement. For a free viewer
  // they're absent rather than replaced — a lock chip beside the company name would
  // be noise, and the locked KPI tiles just below already make the offer.
  // `!entitled` is checked alongside the type guard so the chips stay hidden even if
  // an unstripped payload ever reaches this component (see KpiStrip's `entitled`).
  if (!entitled || !isFullCycle(cycle)) {
    return fundamentals.analystRecommendation ? (
      <BadgeRow
        analystRecommendation={fundamentals.analystRecommendation}
        numAnalysts={fundamentals.numAnalystOpinions}
      />
    ) : null;
  }
  return (
    <BadgeRow
      overallLabel={cycle.overallLabel}
      valuationZone={cycle.valuationZone}
      analystRecommendation={fundamentals.analystRecommendation}
      numAnalysts={fundamentals.numAnalystOpinions}
    />
  );
}

async function CycleKpi({ ticker, spec, entitled }: CycleProps) {
  const cycle = await fetchCycleAnalysis(ticker, spec, entitled);
  // MIXED: KpiStrip locks cards 1–2 (Overall Rating, Health Score) and keeps
  // cards 3–4 (Current/Typical Drawdown) working. See KpiStrip.
  // `entitled` is passed as well as the stripped payload so the two tiles need
  // BOTH to render — the API strip is no longer their only defence.
  return cycle ? <KpiStrip cycle={cycle} entitled={entitled} /> : null;
}

/**
 * Honest stand-in for the cycle block when the Major Cycle can't be computed for
 * the chosen horizon (the engine needs ~lookback+ bars; e.g. the Long window
 * needs ~3y of history a recent listing may not have yet). Without this, the
 * rating badges, KPI strip, Verdict and Thesis insights all return null and the
 * page silently jumps from the header to the Company Overview with no
 * explanation. Renders nothing when the cycle IS available.
 */
async function CycleNotice({
  ticker,
  spec,
  entitled,
  horizonLabel,
}: CycleProps & { horizonLabel: string }) {
  const cycle = await fetchCycleAnalysis(ticker, spec, entitled);
  if (cycle) return null;
  const suggestion =
    spec.preset === 'short'
      ? ''
      : spec.preset === 'medium'
        ? ' Switch to the Short horizon on Browse for the full cycle read.'
        : ' Switch to the Short or Medium horizon on Browse for the full cycle read.';
  return (
    <div className="card card--stack-base" role="note">
      <div className="card-header">
        <div className="card-title">Major Cycle — not available at this horizon</div>
      </div>
      <div className="card-body">
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          The <strong>{horizonLabel}</strong>{' '}Major Cycle needs more price history
          than this stock has so far, so the overall rating, verdict and scorecard
          can&apos;t be calculated for this horizon.{suggestion} The price chart,
          financials and sentiment sections below still apply.
        </p>
      </div>
    </div>
  );
}

async function CycleVerdict({
  ticker,
  spec,
  entitled,
  fundamentals,
}: CycleProps & { fundamentals: FundamentalsSnapshot }) {
  const cycle = await fetchCycleAnalysis(ticker, spec, entitled);
  // PREMIUM: the Verdict is the single most concentrated piece of judgement on the
  // page — the rating, the label and the valuation zone in one card.
  if (!entitled) {
    return (
      <PremiumLockCard
        title="The Verdict"
        blurb="Where this stock sits in its Major Cycle right now, its rating and valuation zone, in one read — included with a subscription."
      />
    );
  }
  return isFullCycle(cycle) ? (
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
  entitled,
  fundamentals,
}: CycleProps & { fundamentals: FundamentalsSnapshot }) {
  const cycle = await fetchCycleAnalysis(ticker, spec, entitled);
  // FREE (with one bullet withheld) — see the note on ThesisInsights' Props: its only
  // scored input gates a positive claim, so a free viewer loses that bullet rather
  // than being shown anything untrue.
  return cycle ? (
    <ThesisInsights
      cycle={cycle}
      fundamentals={fundamentals}
      currency={fundamentals.currency}
    />
  ) : null;
}

async function CycleScorecard({ ticker, spec, entitled }: CycleProps) {
  const cycle = await fetchCycleAnalysis(ticker, spec, entitled);
  // PREMIUM: the radar is built entirely from the five Financial Health pillars.
  if (!entitled) {
    return (
      <PremiumLockCard
        // Carries the section's anchor id so the subnav's "Scorecard" pill still
        // scrolls here and the scroll-spy can still highlight it. Without it the
        // pill was a dead click for exactly the viewers being sold to.
        id="sec-scorecard"
        title="Scorecard"
        blurb="The five-pillar financial-health breakdown — profitability, balance sheet, growth, cash flow and shareholder returns — is included with a subscription."
      />
    );
  }
  return isFullCycle(cycle) ? (
    <SnowflakeRadar cycle={cycle} />
  ) : (
    <SectionAnchor
      id="sec-scorecard"
      title="Scorecard"
      note="The financial-health scorecard isn't available at this Major Cycle horizon — see the note above."
    />
  );
}

async function CycleDrawdown({
  ticker,
  spec,
  entitled,
  priceBars,
}: CycleProps & { priceBars: PriceBar[] }) {
  const cycle = await fetchCycleAnalysis(ticker, spec, entitled);
  // FREE: the drawdown overlay and its cycle bands are descriptive price history —
  // the hook that gives a free viewer a reason to come back.
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
  const sp = await searchParams;
  const { spec, label: horizonLabel } = parseSpec(sp);

  const stored = urlPartsToTicker(market, ticker);
  // Only the stock row + sector medians block the initial render — both are
  // fast. The slow cycle analysis and the benchmark series are streamed in via
  // Suspense below, so the bulk of the page paints without waiting on them.
  // Memoised by React cache() and already resolved by the (app) layout for this
  // request, so this costs no extra query. Threaded into every cycle section below —
  // it selects which shape /api/cycle returns, and is part of that fetch's cache key.
  const [stock, medians, viewer] = await Promise.all([
    fetchStockDetail(stored),
    fetchMetricMedians(),
    getViewerEntitlement(),
  ]);
  if (!stock) notFound();
  const entitled = viewer.entitled;

  // Free-tier fence (F3 Step 10). Counted AFTER the notFound() above, so a typo'd
  // ticker never costs a real reader one of their views. Subscribers are never
  // counted at all — locked decision #18 promises them no usage limits — so this
  // whole block is skipped when entitled. Re-opening a stock seen earlier today is
  // free, which is what makes a refresh or a prefetch harmless. See lib/freeViews.ts.
  if (!entitled && viewer.userId) {
    const view = await recordFreeView(viewer.userId, stored);
    if (!view.allowed) return <FreeViewLimitNotice limit={view.limit} />;
  }

  // Props for the subnav's one-click "Download Report" (carries the current
  // Major Cycle horizon; medium → clean URL).
  const reportSymbol = tickerToUrlParts(stored).symbol;
  const reportTitle = `${tickerDisplay(stored)} — ${stock.name ?? stored} · MajorCycle report`;
  const reportHorizonQuery = horizonQuery(sp);

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
      <StockSubnav
        market={market}
        ticker={ticker}
        horizonQuery={reportHorizonQuery}
        symbol={reportSymbol}
        reportTitle={reportTitle}
        entitled={entitled}
      />

      <div className="pt-5 space-y-[18px]">
        {/* Read-only note when a non-default horizon was chosen on Browse.
            (No horizon selector lives on the detail page by design.) */}
        {spec.preset !== 'medium' && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-[var(--brand-mid)] bg-[var(--brand-light)] border border-[var(--brand-light-border)] rounded-[var(--radius-sm)] px-3 py-2"
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
              entitled={entitled}
                  fundamentals={stock.fundamentals}
                />
              </Suspense>
            }
          />
          <Suspense fallback={null}>
            <CycleNotice
              ticker={stored}
              spec={spec}
              entitled={entitled}
              horizonLabel={horizonLabel}
            />
          </Suspense>
          <Suspense fallback={<SectionSkeleton className="h-[96px]" />}>
            <CycleKpi ticker={stored} spec={spec}
              entitled={entitled} />
          </Suspense>
          <Suspense fallback={<SectionSkeleton className="h-[200px]" />}>
            <CycleVerdict
              ticker={stored}
              spec={spec}
              entitled={entitled}
              fundamentals={stock.fundamentals}
            />
          </Suspense>
          <CompanyOverview overview={stock.companyOverview} />
          <Suspense fallback={<SectionSkeleton className="h-[160px]" />}>
            <CycleThesis
              ticker={stored}
              spec={spec}
              entitled={entitled}
              fundamentals={stock.fundamentals}
            />
          </Suspense>
        </section>
        <Suspense
          fallback={<SectionSkeleton className="h-[320px] scroll-mt-[120px]" />}
        >
          <CycleScorecard ticker={stored} spec={spec}
              entitled={entitled} />
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
              entitled={entitled}
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
          {/* Statement figures are in the REPORTING currency, not the price
              currency — see statementCurrency(). BHP.AX trades in AUD and
              reports in USD, so `fundamentals.currency` here would print A$ in
              front of US dollars. */}
          <EarningsHistory
            earningsHistory={stock.earningsHistory ?? []}
            currency={statementCurrency(stock.fundamentals)}
            currencyNote={reportingCurrencyNote(stock.fundamentals)}
          />
          <QuarterlyFinancials
            incomeStatementQuarterly={stock.incomeStatementQuarterly}
            cashflowQuarterly={stock.cashflowQuarterly}
            incomeStatementAnnual={stock.incomeStatementAnnual}
            cashflowAnnual={stock.cashflowAnnual}
            currency={statementCurrency(stock.fundamentals)}
            currencyNote={reportingCurrencyNote(stock.fundamentals)}
          />
          <ValuationHistory
            unavailableReason={peHistoryUnavailableReason(stock.fundamentals)}
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
            industry={stock.industry}
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

/**
 * Shown instead of the page when a free viewer opens a NEW stock having already
 * reached the daily cap (F3 Step 10). Stocks they opened earlier today still load
 * normally, so this is never a dead end — and it resets on its own.
 *
 * Local to this page rather than a shared component: it is the one place the fence
 * can fire, and keeping it here also keeps it out of the report-parity guard's
 * import scan (scripts/check-report-sections.mjs), which tracks only
 * @/components/stocks/* sections.
 */
function FreeViewLimitNotice({ limit }: { limit: number }) {
  return (
    <div className="pt-5">
      <div className="card card--stack-base" role="note">
        <div className="card-header">
          <div className="card-title">Daily browsing limit reached</div>
        </div>
        <div className="card-body space-y-3">
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {/* One expression, not text-around-an-interpolation: JSX trims the
                leading whitespace off a text segment that follows `{limit}`, which
                rendered "25different stocks". A template literal has no such rule. */}
            {`You've opened ${limit} different stocks today on the free plan. The ` +
              `count resets at midnight UTC, and any stock you've already looked at ` +
              `today still opens normally.`}
          </p>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            A subscription removes the limit entirely and unlocks the Major Cycle
            rating, financial-health scorecard, the full screener and downloadable
            reports.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[13px]">
            <PremiumLockInlineCta feature="Overall Rating" />
            <Link
              href="/stocks"
              className="text-[13px] text-[var(--text-muted)] underline underline-offset-2"
            >
              Back to Browse
            </Link>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--text-muted)]">
        Information only — not financial advice.
      </p>
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
