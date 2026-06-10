import { fmtPrice } from '@/lib/format';
import type { Currency } from '@/lib/types';

interface Props {
  low: number;
  high: number;
  current: number;
  currency: Currency;
}

function qualitativeZone(pct: number): string {
  if (pct >= 75) return 'Near high';
  if (pct >= 60) return 'Upper range';
  if (pct >= 40) return 'Mid range';
  if (pct >= 25) return 'Lower range';
  return 'Near low';
}

function offHighText(current: number, high: number): string {
  const fromHigh = ((current - high) / high) * 100;
  if (fromHigh <= -0.05) return `${Math.abs(fromHigh).toFixed(1)}% off high`;
  if (fromHigh >= 0.05) return `+${fromHigh.toFixed(1)}% above high`;
  return 'at 52W high';
}

/**
 * Compact 52-week range gauge — a single-row track with low/high prices flanking
 * a gradient bar + position pin. Visual parity with `.detail-header-52w` in
 * `/reference/original-design.html` lines 362-371, 2595-2615.
 */
export function WeekRangeGauge({ low, high, current, currency }: Props) {
  const range = high - low;
  if (range <= 0) return null;

  // Clamp to [2, 98] so the pin stays visually inside the track at extremes.
  const pct = Math.max(2, Math.min(98, ((current - low) / range) * 100));
  const zone = qualitativeZone(pct);
  const offText = offHighText(current, high);

  return (
    <div
      className="flex flex-col gap-[3px] mt-auto pt-[10px] border-t border-dotted border-[var(--border)] text-left cursor-help"
      title="52-Week Range Position — Shows where the current price sits between the lowest and highest closing prices over the past 52 weeks. Near the left edge (low) = potentially undervalued or beaten down. Near the right edge (high) = approaching resistance or extended."
    >
      <div className="flex items-center gap-[6px] w-full">
        <span className="text-[9px] font-bold tracking-[1.2px] uppercase text-[var(--text-muted)] whitespace-nowrap flex-shrink-0 leading-none">
          52W
        </span>
        <span className="font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-secondary)] whitespace-nowrap flex-shrink-0 leading-none">
          {fmtPrice(low, currency)}
        </span>
        <div className="relative flex-1 min-w-0 h-[14px] flex items-center">
          <div
            className="relative h-[5px] w-full rounded-full"
            style={{
              background:
                'linear-gradient(90deg, var(--c-tier-1), var(--c-tier-2), var(--c-tier-3), var(--c-tier-4))',
            }}
            aria-hidden="true"
          />
          <div
            className="absolute top-1/2 w-[9px] h-[9px] rounded-full bg-[var(--brand-mid)] border-2 border-white"
            style={{
              left: `${pct}%`,
              transform: 'translate(-50%, -50%)',
              boxShadow:
                '0 1px 3px rgba(0,0,0,0.25), 0 0 0 1px rgba(26,58,110,0.20)',
            }}
            aria-label={`Current price position: ${zone}, ${offText}`}
          />
        </div>
        <span className="font-[var(--font-mono)] text-[10px] font-semibold text-[var(--text-secondary)] whitespace-nowrap flex-shrink-0 leading-none">
          {fmtPrice(high, currency)}
        </span>
      </div>
      <div className="block text-[9.5px] font-semibold text-[var(--text-muted)] tracking-[0.2px] leading-[1.2] text-right">
        <span className="font-bold text-[var(--text-secondary)]">{zone}</span>
        {' · '}
        <span className="font-[var(--font-mono)] font-semibold text-[var(--text-secondary)] ml-[3px]">
          {offText}
        </span>
      </div>
    </div>
  );
}
