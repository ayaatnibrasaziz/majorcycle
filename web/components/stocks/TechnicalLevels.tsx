import type { Currency, PriceBar } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  priceBars: PriceBar[];
  currency: Currency;
}

function currencySymbol(currency: Currency): string {
  if (currency === 'AUD') return 'A$';
  if (currency === 'CAD') return 'CA$';
  return '$';
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

export function TechnicalLevels({ priceBars, currency }: Props) {
  if (priceBars.length === 0) return null;

  const sym          = currencySymbol(currency);
  const currentClose = priceBars[priceBars.length - 1]!.close;
  const dma50        = computeDMA(priceBars, 50);
  const dma200       = computeDMA(priceBars, 200);

  const abv50  = dma50  !== null ? ((currentClose - dma50)  / dma50)  * 100 : null;
  const abv200 = dma200 !== null ? ((currentClose - dma200) / dma200) * 100 : null;

  let crossBadge = '—';
  let crossColor = 'var(--text-muted)';
  if (dma50 !== null && dma200 !== null) {
    if (dma50 > dma200) {
      crossBadge = 'Golden Cross';
      crossColor = '#228B22';
    } else {
      crossBadge = 'Death Cross';
      crossColor = '#B22222';
    }
  }

  return (
    <section id="sec-cycle" className="scroll-mt-[120px] card card--stack-snug">
      <div className="card-header">
        <div className="card-title">
          Technical Levels
          <InfoTip title="Technical Levels">
            Reference prices traders watch. A &quot;moving average&quot; (DMA) is the
            average closing price over the last 50 or 200 days — price above it
            suggests an uptrend, below it a downtrend. A &quot;Golden Cross&quot; (50-day
            rising above the 200-day) is read as bullish; a &quot;Death Cross&quot; as
            bearish. Hover any tile for detail.
          </InfoTip>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Moving averages · Trend signal
        </div>
      </div>
      <div className="card-body card-body--compact">
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
              {dma50 !== null ? `${sym}${dma50.toFixed(2)}` : '—'}
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
              {dma200 !== null ? `${sym}${dma200.toFixed(2)}` : '—'}
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
            title="Moving Average Signal (Golden/Death Cross) — Compares 50 DMA vs 200 DMA. Golden Cross: 50 DMA rises above 200 DMA — a bullish long-term signal, often precedes sustained rallies. Death Cross: 50 DMA falls below 200 DMA — a bearish signal suggesting possible further weakness."
          >
            <div className="stat-pill-label">MA Signal</div>
            <div className="stat-pill-val" style={{ color: crossColor, fontSize: 11 }}>
              {crossBadge}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
