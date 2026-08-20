import { Figure } from '@/components/Figure';
import { AxisFrame, AxisLabels, PinnedLabel, PointDot, rx, yearTick } from './chartPrimitives';
import {
  DD_TICKS,
  FASTEST,
  RECOVERIES,
  SLOWEST,
  SPAN_YEARS,
  TROUGH_PCT,
  WAIT_RATIO,
  YEAR_TICKS,
  recoveryX,
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

        {/* Where each one gets back to its old peak.
            ⚠️ On the chart, not in a legend. Three legend rows all reading "back
            to its old peak in …" put the figure's only variable in a list beside
            the drawing, so the reader had to match colours to find the thing the
            horizontal axis was already showing them. */}
        {RECOVERIES.map((r, i) => (
          <span key={r.id}>
            <PointDot x={recoveryX(r)} y={yOf(0)} color={r.color} id={r.id} />
            {/* ⚠️ Staggered rows. The first two recoveries finish 20% of the plot
                apart, which is 69px at 375px and less than two 12px mono labels
                need — they overlapped by 13px at 360px, measured. Alternating the
                offset keeps the words rather than abbreviating them. */}
            <PinnedLabel
              id={r.id}
              x={recoveryX(r)}
              y={yOf(0)}
              text={r.label}
              dy={9 + (i % 2) * 26}
            />
          </span>
        ))}
        {/* Year markers, in HTML so they stay 12px at every width. */}
        <div className="absolute inset-x-0 top-full">
          {YEAR_TICKS.map((y) => (
            <span
              key={y}
              data-year-tick="recovery"
              className="absolute -translate-x-1/2 whitespace-nowrap pt-1 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
              style={{ left: `${rx((y / SPAN_YEARS) * 100)}%` }}
            >
              {yearTick(y, 'peak')}
            </span>
          ))}
        </div>
      </div>
      <div className="h-6" />
    </Figure>
  );
}
