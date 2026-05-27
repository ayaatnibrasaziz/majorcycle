import { WeekRangeGauge } from '@/components/stocks/WeekRangeGauge';
import type { StockDetail } from '@/lib/stocks';
import type { Currency } from '@/lib/types';

interface Props {
  stock: StockDetail;
}

function formatPrice(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Like formatPrice, but strips auto-sign so we control it ourselves. */
function formatAbsPrice(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'never',
  }).format(amount);
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

interface DailyChange {
  abs: number;
  pct: number;
}

function dailyChange(latest: number, previous: number): DailyChange {
  const abs = latest - previous;
  return { abs, pct: (abs / previous) * 100 };
}

/**
 * The Stock Detail page's identity strip. Visual parity with `.detail-header` in
 * `/reference/original-design.html` (lines 356-381 for CSS, 2562-2618 for markup).
 *
 * Deferred to Section 2 (Verdict card): the 3-badge row under the meta line
 * (overall rating, valuation zone, analyst consensus) — all three need cycle
 * data that the Verdict card PR will introduce.
 */
export function StockHeader({ stock }: Props) {
  const { fundamentals, priceBars } = stock;
  const currency = fundamentals.currency;

  const latestBar = priceBars[priceBars.length - 1];
  const previousBar = priceBars[priceBars.length - 2];

  if (!latestBar) return null;

  const currentClose = latestBar.close;
  const change = previousBar ? dailyChange(currentClose, previousBar.close) : null;
  const changeColor = change && change.pct >= 0
    ? 'var(--c-tier-2)'
    : 'var(--c-tier-5)';

  // Upside-to-analyst-target (if target is available)
  const target = fundamentals.analystTargetPrice;
  const upsidePct = target ? ((target - currentClose) / currentClose) * 100 : null;
  const upsideColor = upsidePct === null
    ? null
    : upsidePct >= 0
      ? 'var(--c-tier-2)'
      : 'var(--c-tier-3)';
  const upsideText = upsidePct === null
    ? null
    : upsidePct >= 0
      ? `+${upsidePct.toFixed(1)}% upside to target`
      : `${Math.abs(upsidePct).toFixed(1)}% above target`;

  return (
    <div className="flex items-stretch gap-5 mb-5 fade-in">
      {/* Left column: identity */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="font-[var(--font-mono)] text-[var(--font-hero)] font-bold text-[var(--text-primary)] tracking-[-1px]">
          {stock.ticker}
        </div>
        <div className="text-[14px] text-[var(--text-secondary)] mt-[2px]">
          {stock.name ?? stock.ticker}
          {stock.sector ? <span> · {stock.sector}</span> : null}
        </div>
        <div
          className="inline-flex items-center gap-[6px] font-[var(--font-mono)] text-[10px] text-[var(--text-muted)] mt-1 tracking-[0.2px] cursor-help self-start"
          title="Data Freshness — Stock prices and fundamentals refresh nightly at 23:00 UTC. This snapshot was generated then."
        >
          <span
            className="w-[6px] h-[6px] rounded-full bg-[var(--c-tier-2)] animate-[metaPulse_2.4s_ease-in-out_infinite]"
            style={{ boxShadow: '0 0 0 3px rgba(34,139,34,0.15)' }}
            aria-hidden="true"
          />
          <span>Updated {formatUpdatedAt(stock.updatedAt)}</span>
        </div>
        {/* Badges row (rating / valuation zone / analyst consensus) lands in
            Section 2 — Verdict card. Reserved space kept for layout continuity. */}
      </div>

      {/* Right column: price + delta + upside + 52W gauge */}
      <div className="ml-auto text-right min-w-[240px] flex flex-col items-stretch justify-start">
        <div className="font-[var(--font-mono)] text-[var(--font-hero)] font-semibold text-[var(--text-primary)] leading-[1.1]">
          {formatPrice(currentClose, currency)}
        </div>
        {change && (
          <div
            className="font-[var(--font-mono)] text-[13px] font-semibold mt-1 tracking-[-0.1px]"
            style={{ color: changeColor }}
          >
            <PriceArrow direction={change.pct >= 0 ? 'up' : 'down'} />
            {change.pct >= 0 ? '+' : '−'}
            {formatAbsPrice(change.abs, currency)}
            {' ('}
            {change.pct >= 0 ? '+' : '−'}
            {Math.abs(change.pct).toFixed(2)}%{')'}
          </div>
        )}
        {upsideText && (
          <div
            className="text-[11px] font-semibold mt-[3px] tracking-[0.3px] uppercase opacity-90"
            style={{ color: upsideColor ?? 'var(--text-muted)' }}
          >
            {upsideText}
          </div>
        )}
        {fundamentals.week52Low != null && fundamentals.week52High != null && (
          <WeekRangeGauge
            low={fundamentals.week52Low}
            high={fundamentals.week52High}
            current={currentClose}
            currency={currency}
          />
        )}
      </div>
    </div>
  );
}

function PriceArrow({ direction }: { direction: 'up' | 'down' }) {
  // Inline SVG matching reference (lines 2587-2588).
  return (
    <svg
      className="inline-block align-[-1px] mr-[3px]"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
    >
      <path
        d={
          direction === 'up'
            ? 'M5 1.5 8.5 6 6.2 6 6.2 8.5 3.8 8.5 3.8 6 1.5 6Z'
            : 'M5 8.5 1.5 4 3.8 4 3.8 1.5 6.2 1.5 6.2 4 8.5 4Z'
        }
        fill="currentColor"
      />
    </svg>
  );
}
