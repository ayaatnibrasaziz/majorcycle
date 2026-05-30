import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AnalystTargetTrack } from '@/components/stocks/AnalystTargetTrack';
import { BalanceSheet } from '@/components/stocks/BalanceSheet';
import { DividendHistory } from '@/components/stocks/DividendHistory';
import { DrawdownOverlay } from '@/components/stocks/DrawdownOverlay';
import { EarningsHistory } from '@/components/stocks/EarningsHistory';
import { KpiStrip } from '@/components/stocks/KpiStrip';
import { MetricsTable } from '@/components/stocks/MetricsTable';
import { NewsFeed } from '@/components/stocks/NewsFeed';
import { OwnershipStructure } from '@/components/stocks/OwnershipStructure';
import { PriceChart } from '@/components/stocks/PriceChart';
import { QuarterlyFinancials } from '@/components/stocks/QuarterlyFinancials';
import { ShortInterest } from '@/components/stocks/ShortInterest';
import { SmartMoneyActivity } from '@/components/stocks/SmartMoneyActivity';
import { SnowflakeRadar } from '@/components/stocks/SnowflakeRadar';
import { StockHeader } from '@/components/stocks/StockHeader';
import { TechnicalLevels } from '@/components/stocks/TechnicalLevels';
import { StockSubnav } from '@/components/stocks/StockSubnav';
import { ValuationHistory } from '@/components/stocks/ValuationHistory';
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
        {cycle ? (
          <SnowflakeRadar cycle={cycle} />
        ) : (
          <SectionAnchor
            id="sec-scorecard"
            title="Scorecard"
            note="Snowflake radar scorecard lands here once cycle data loads."
          />
        )}
        {stock.priceBars.length > 0 && (
          <TechnicalLevels
            priceBars={stock.priceBars}
            currency={stock.fundamentals.currency}
          />
        )}
        <PriceChart priceBars={stock.priceBars} ticker={stored} />
        {cycle && <DrawdownOverlay priceBars={stock.priceBars} cycle={cycle} />}
        {stock.priceBars.length > 0 && (
          <AnalystTargetTrack
            fundamentals={stock.fundamentals}
            currentClose={stock.priceBars[stock.priceBars.length - 1]!.close}
            currency={stock.fundamentals.currency}
          />
        )}
        <section id="sec-fundamentals" className="scroll-mt-[120px] space-y-[18px]">
          <EarningsHistory earningsHistory={stock.earningsHistory ?? []} />
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
          <MetricsTable fundamentals={stock.fundamentals} />
        </section>
        <section id="sec-sentiment" className="scroll-mt-[120px] space-y-[18px]">
          <SmartMoneyActivity
            insiderTransactions={stock.insiderTransactions}
            analystUpgradesDowngrades={stock.analystUpgradesDowngrades}
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
