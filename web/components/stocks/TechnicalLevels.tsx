import { fmtPrice } from '@/lib/format';
import type { Currency, PriceBar } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  priceBars: PriceBar[];
  currency: Currency;
}

function signedPct(n: number, d = 1): string {
  const s = n.toFixed(d);
  return n > 0 ? `+${s}` : s;
}

/** Simple moving average over the last `period` closing prices. */
function computeDMA(bars: PriceBar[], period: number): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  return slice.reduce((acc, b) => acc + b.close, 0) / period;
}

/** Trailing simple moving average at every bar (null until enough history). */
function dmaSeries(bars: PriceBar[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length < period) return out;
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i]!.close;
    if (i >= period) sum -= bars[i - period]!.close;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// A Golden/Death Cross is only "news" for a few months. Beyond this window we
// report the standing trend (Bullish / Bearish) instead of implying a fresh
// crossing event. ~63 trading days ≈ 3 months.
const RECENT_CROSS_BARS = 63;

interface MaSignal {
  label: string;
  color: string;
}

/**
 * Classify the 50-vs-200 DMA relationship, distinguishing a *recent* crossing
 * event (Golden / Death Cross) from a long-standing trend state (Bullish /
 * Bearish). Walks the full DMA history to find the most recent sign change.
 */
function computeMaSignal(bars: PriceBar[]): MaSignal {
  const d50  = dmaSeries(bars, 50);
  const d200 = dmaSeries(bars, 200);
  let lastCrossIdx = -1;
  let prevSign = 0;
  for (let i = 0; i < bars.length; i++) {
    const a = d50[i];
    const b = d200[i];
    if (a == null || b == null) continue;
    const sign = Math.sign(a - b);
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) lastCrossIdx = i;
    if (sign !== 0) prevSign = sign;
  }
  if (prevSign === 0) return { label: '—', color: 'var(--text-muted)' };

  const bullish = prevSign > 0;
  const recentCross =
    lastCrossIdx >= 0 && bars.length - 1 - lastCrossIdx <= RECENT_CROSS_BARS;

  if (recentCross) {
    return bullish
      ? { label: 'Golden Cross', color: '#228B22' }
      : { label: 'Death Cross',  color: '#B22222' };
  }
  return bullish
    ? { label: 'Bullish', color: '#228B22' }
    : { label: 'Bearish', color: '#B22222' };
}

export function TechnicalLevels({ priceBars, currency }: Props) {
  if (priceBars.length === 0) return null;

  const currentClose = priceBars[priceBars.length - 1]!.close;
  const dma50        = computeDMA(priceBars, 50);
  const dma200       = computeDMA(priceBars, 200);

  const abv50  = dma50  !== null ? ((currentClose - dma50)  / dma50)  * 100 : null;
  const abv200 = dma200 !== null ? ((currentClose - dma200) / dma200) * 100 : null;

  const { label: crossBadge, color: crossColor } = computeMaSignal(priceBars);

  // With fewer than ~50 bars neither moving average can be computed, so every
  // tile would read "—". Show one honest message instead of a wall of dashes.
  // (Doesn't occur in the real universe — min history is ~488 bars — but keeps a
  // freshly-listed / sparse ticker graceful.)
  const noMovingAverages = dma50 === null && dma200 === null;

  return (
    <section id="sec-cycle" className="scroll-mt-[120px] card card--stack-snug">
      <div className="card-header">
        <div className="card-title">
          Technical Levels
          <InfoTip title="Technical Levels">
            Reference prices traders watch. A &quot;moving average&quot; (DMA) is the
            average closing price over the last 50 or 200 days — price above it
            suggests an uptrend, below it a downtrend. When the 50-day has
            *recently* crossed the 200-day we flag a bullish &quot;Golden Cross&quot; (or a
            &quot;Death Cross&quot; for the reverse); once that crossing is no longer recent
            the signal simply reads &quot;Bullish&quot; or &quot;Bearish&quot; for the standing trend.
            Hover any tile for detail.
          </InfoTip>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Moving averages · Trend signal
        </div>
      </div>
      <div className="card-body card-body--compact">
        {noMovingAverages ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', lineHeight: 1.55 }}>
            Not enough price history yet to calculate the 50- and 200-day moving averages.
          </div>
        ) : (
        <div className="tech-pill-grid">

          {/* 50 DMA */}
          <div
            className="stat-pill"
            title="50-Day Moving Average (50 DMA) — The average closing price over the last 50 trading days (~2.5 months). Acts as a key short-term support or resistance level. Price above 50 DMA = short-term uptrend. Price below 50 DMA = short-term downtrend."
          >
            <div className="stat-pill-label">50 DMA</div>
            <div
              className="stat-pill-val"
              style={{ color: abv50 !== null ? (abv50 >= 0 ? '#228B22' : '#B22222') : 'var(--text-primary)' }}
            >
              {dma50 !== null ? fmtPrice(dma50, currency) : '—'}
            </div>
          </div>

          {/* vs 50 DMA */}
          <div
            className="stat-pill"
            title="Price vs 50 DMA (%) — How far the current price is above or below the 50-Day Moving Average. Positive = above (bullish short-term). Negative = below (bearish short-term). Large deviations (+15%+) can signal the stock is overbought short-term."
          >
            <div className="stat-pill-label">vs 50 DMA</div>
            <div className={`stat-pill-val${abv50 !== null ? (abv50 >= 0 ? ' green' : ' red') : ''}`}>
              {abv50 !== null ? `${signedPct(abv50)}%` : '—'}
            </div>
          </div>

          {/* 200 DMA */}
          <div
            className="stat-pill"
            title="200-Day Moving Average (200 DMA) — The average closing price over the last 200 trading days (~10 months). The most widely watched long-term trend indicator. Price above 200 DMA = long-term uptrend (bull market for this stock). Price below 200 DMA = long-term downtrend."
          >
            <div className="stat-pill-label">200 DMA</div>
            <div
              className="stat-pill-val"
              style={{ color: abv200 !== null ? (abv200 >= 0 ? '#228B22' : '#B22222') : 'var(--text-primary)' }}
            >
              {dma200 !== null ? fmtPrice(dma200, currency) : '—'}
            </div>
          </div>

          {/* vs 200 DMA */}
          <div
            className="stat-pill"
            title="Price vs 200 DMA (%) — How far the current price is above or below the 200-Day Moving Average. Positive = above (bullish long-term). Negative = below (bearish long-term). Stocks more than 20% above the 200 DMA can be overextended; those trading below may be deeply discounted."
          >
            <div className="stat-pill-label">vs 200 DMA</div>
            <div className={`stat-pill-val${abv200 !== null ? (abv200 >= 0 ? ' green' : ' red') : ''}`}>
              {abv200 !== null ? `${signedPct(abv200)}%` : '—'}
            </div>
          </div>

          {/* MA Signal */}
          <div
            className="stat-pill"
            title="Moving Average Signal — Compares the 50 DMA with the 200 DMA. If the 50 has crossed the 200 within the last ~3 months we show a 'Golden Cross' (50 above 200 — bullish, often precedes sustained rallies) or 'Death Cross' (50 below 200 — bearish). After that window it reads 'Bullish' or 'Bearish' — the standing trend, without implying a fresh crossing event."
          >
            <div className="stat-pill-label">MA Signal</div>
            <div className="stat-pill-val" style={{ color: crossColor }}>
              {crossBadge}
            </div>
          </div>

        </div>
        )}
      </div>
    </section>
  );
}
