import { Figure, LegendItem } from '@/components/Figure';
import { AxisFrame, AxisLabels, Swatch, rx } from './chartPrimitives';
import {
  DD_TICKS,
  FASTEST,
  RECOVERIES,
  SLOWEST,
  SPAN_YEARS,
  TROUGH_PCT,
  WAIT_RATIO,
  YEAR_TICKS,
  yOf,
  waitFromTrough,
} from './recoveryGeometry';

/**
 * The one figure for "How long do recoveries actually take?".
 *
 * Three falls of exactly the same depth, and three completely different waits.
 * The vertical axis is the one everybody reads and it is identical in all three;
 * the horizontal axis is the one nobody reads and it is the entire answer.
 *
 * ⚠️ **Illustrative, and the caption says so in words.** MajorCycle does not hold
 * recovery durations — the engine measures magnitudes only — so a figure drawn in
 * our house style has to state that it is not a chart of our data. Leaving it
 * implied is how a reader ends up believing we publish something we do not.
 */

const FLOOR_Y = 86;

const pathOf = (dd: readonly { x: number; pct: number }[]): string =>
  dd.map((p) => `${rx(p.x).toFixed(2)},${yOf(p.pct).toFixed(2)}`).join(' ');

export function RecoveryTimeFigure() {
  return (
    <Figure
      legend={RECOVERIES.map((r) => (
        <LegendItem key={r.id} swatch={<Swatch color={r.color} dashed={false} />}>
          Back to its old peak in {r.label}
        </LegendItem>
      ))}
      caption={
        <>
          Three illustrative falls, all exactly{' '}
          <strong>{Math.abs(TROUGH_PCT)}% deep</strong> — one depth, drawn three
          times. What differs is the width: the slowest takes{' '}
          <strong>{WAIT_RATIO.toFixed(0)} times longer</strong> to climb out than the
          fastest ({waitFromTrough(SLOWEST).toFixed(1)} years against{' '}
          {waitFromTrough(FASTEST).toFixed(1)}). Depth is a fact you can measure
          today. Duration is only ever known afterwards, which is why MajorCycle
          measures the first and says nothing about the second.
        </>
      }
    >
      <div className="relative w-full aspect-[16/8]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Three curves that all fall to ${Math.abs(TROUGH_PCT)} percent below their peak and then climb back to it after ${RECOVERIES.map((r) => r.label).join(', ')} respectively.`}
        >
          <AxisFrame floorY={FLOOR_Y} />
          {RECOVERIES.map((r) => (
            <polyline
              key={r.id}
              data-recovery-path={r.id}
              points={pathOf(r.series)}
              fill="none"
              stroke={r.color}
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <AxisLabels
          ticks={DD_TICKS.map((v) => ({ y: yOf(v), value: v }))}
          format={(v) => `${v}%`}
        />
        {/* Year markers, in HTML so they stay 12px at every width. */}
        <div className="absolute inset-x-0 top-full">
          {YEAR_TICKS.map((y) => (
            <span
              key={y}
              data-year-tick="recovery"
              className="absolute -translate-x-1/2 pt-1 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
              style={{ left: `${rx((y / SPAN_YEARS) * 100)}%` }}
            >
              {y === 0 ? 'peak' : `${y} yrs`}
            </span>
          ))}
        </div>
      </div>
      <div className="h-6" />
    </Figure>
  );
}
