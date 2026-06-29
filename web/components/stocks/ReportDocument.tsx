'use client';

import { useRef } from 'react';

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
import { ValuationHistory } from '@/components/stocks/ValuationHistory';
import { VerdictCard } from '@/components/stocks/VerdictCard';
import { cn } from '@/lib/utils';
import { useScrollSpy } from '@/lib/useScrollSpy';
import type { ReportData } from '@/lib/report-types';

/** Wrap each section card so a card never splits across a page break. */
function ReportSection({ children }: { children: React.ReactNode }) {
  return <div className="report-section">{children}</div>;
}

// The five nav groups — same ids/order/labels as the live Stock Detail subnav,
// so the report's nav behaves like the page's.
const NAV = [
  { id: 'sec-thesis', label: 'Thesis' },
  { id: 'sec-scorecard', label: 'Scorecard' },
  { id: 'sec-cycle', label: 'Cycle' },
  { id: 'sec-fundamentals', label: 'Fundamentals' },
  { id: 'sec-sentiment', label: 'Sentiment' },
] as const;

const NAV_IDS = NAV.map((n) => n.id);

/**
 * Sticky section-nav for the report. Uses the same deterministic scroll-spy as
 * the live Stock Detail subnav (useScrollSpy), with the active line tracking this
 * nav's own bottom so it adapts whether the report renders inside the app shell
 * (preview) or as the standalone offline file. Anchor links also scroll natively,
 * so navigation still works even with JS disabled. Defined locally (not a
 * @/components/stocks import) so the report↔page section drift guard ignores it.
 */
function ReportNav() {
  const navRef = useRef<HTMLElement>(null);
  // Offset = the sticky nav's current bottom (≈45 when stuck) + a gap that clears
  // the groups' scroll-margin-top (64px), so a just-clicked section reliably
  // counts as active rather than leaving the previous one highlighted.
  const { active, setActive, lock } = useScrollSpy(
    NAV_IDS,
    () => (navRef.current?.getBoundingClientRect().bottom ?? 45) + 24,
  );

  return (
    <nav ref={navRef} className="report-nav" aria-label="Report sections">
      {NAV.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            onClick={() => {
              // Highlight immediately + lock so the smooth anchor scroll doesn't
              // walk the highlight through intervening sections.
              setActive(id);
              lock();
            }}
            className={cn('report-nav-pill', isActive && 'is-active')}
            aria-current={isActive ? 'true' : undefined}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}

/**
 * Honest stand-in for the cycle block when the Major Cycle couldn't be computed
 * for the chosen horizon (mirrors the live page's CycleNotice). Without it the
 * report would silently drop the rating badges / KPI / Verdict / Thesis /
 * Scorecard with no explanation. Uses the stable `.card` classes + inline styles
 * so it renders identically in the offline bundle (no Tailwind-scan dependency).
 */
function CycleUnavailableNotice({ horizonLabel }: { horizonLabel: string }) {
  return (
    <div className="card card--stack-base" role="note">
      <div className="card-header">
        <div className="card-title">Major Cycle — not available at this horizon</div>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          The <strong>{horizonLabel}</strong>{' '}Major Cycle needs more price history than
          this stock has, so the overall rating, verdict and scorecard aren&apos;t
          included for this horizon. A shorter horizon would include them. The price
          chart, financials and sentiment sections below still apply.
        </p>
      </div>
    </div>
  );
}

/**
 * The full Stock-Detail analysis rendered as a single-column report. This is the
 * ONE source of truth for the report layout — rendered three ways from the same
 * code:
 *   1. the on-screen /report preview page (server component → hydrates), and
 *   2. the offline interactive report file (web/report-bundle/entry.tsx mounts it
 *      client-side from the inlined `__REPORT_DATA__` JSON, so it behaves exactly
 *      like the live site with no server/network).
 *
 * Sections are grouped under the same five anchors the live page + subnav use, so
 * the report's section-nav scrolls identically. Every section component is a
 * self-contained client island driven purely by props — which is what makes the
 * offline bundle possible. The logo is a data: URL (no next/image) so the offline
 * file needs nothing from the network.
 *
 * IMPORTANT: the set of section components rendered here must stay in sync with
 * the live detail page (web/app/(app)/stocks/[market]/[ticker]/page.tsx). The CI
 * guard web/scripts/check-report-sections.mjs fails the build if they diverge.
 */
export function ReportDocument({ data }: { data: ReportData }) {
  const {
    stock,
    cycle,
    benchmarks,
    medians,
    market,
    horizonLabel,
    generated,
    logoDataUrl,
    lastClose,
  } = data;
  // Canonical yfinance-native ticker (e.g. "BHP.AX") — what the charts key on.
  const stored = stock.ticker;

  return (
    <div id="report-root" className="report-doc">
      <header className="report-header">
        <div className="report-brand">
          {/* Plain <img> with an inlined data: URL — works offline, no next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoDataUrl} alt="MajorCycle" width={32} height={32} />
          <div>
            <div className="report-brand-name">MajorCycle</div>
            <div className="report-brand-sub">Major Cycle analysis report</div>
          </div>
        </div>
        {/* Ticker + company name intentionally omitted — the identity block
            (StockHeader) directly below shows them with price + rating badges, so
            the header stays a branding/context band (horizon, date, disclaimer). */}
        <div className="report-meta">
          <div className="report-meta-line">
            Horizon: {horizonLabel} · Generated {generated}
          </div>
        </div>
        <p className="report-disclaimer">
          Information only — not financial advice. Educational/informational analysis of
          public data; conduct your own independent due diligence.
        </p>
      </header>

      <ReportNav />

      <div className="report-body">
        <section id="sec-thesis" className="report-group">
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
          {!cycle && (
            <ReportSection>
              <CycleUnavailableNotice horizonLabel={horizonLabel} />
            </ReportSection>
          )}
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
        </section>

        <section id="sec-scorecard" className="report-group">
          {cycle ? (
            <ReportSection>
              <SnowflakeRadar cycle={cycle} />
            </ReportSection>
          ) : (
            <ReportSection>
              <div className="card card--stack-base" role="note">
                <div className="card-header">
                  <div className="card-title">Scorecard</div>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    The financial-health scorecard isn&apos;t available at this Major Cycle
                    horizon — see the note above.
                  </p>
                </div>
              </div>
            </ReportSection>
          )}
        </section>

        <section id="sec-cycle" className="report-group">
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
        </section>

        <section id="sec-fundamentals" className="report-group">
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
        </section>

        <section id="sec-sentiment" className="report-group">
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
        </section>
      </div>
    </div>
  );
}
