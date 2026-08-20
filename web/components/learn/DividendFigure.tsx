import { Figure, LegendItem } from '@/components/Figure';
import { AxisFrame, AxisLabels, Swatch, rx } from './chartPrimitives';
import {
  CUT_PCT,
  CUT_Q,
  FIRST_OVER_LIMIT,
  PAYOUT_LIMIT,
  PAYOUT_TICKS,
  PEAK_YIELD,
  POST_CUT_YIELD,
  QUARTERS,
  START_YIELD,
  WARNING_QUARTERS,
  YEAR_TICKS,
  YIELD_TICKS,
  payoutY,
  qx,
  yieldY,
} from './dividendGeometry';

/**
 * The one figure for "Is a dividend safe, and how would you know?".
 *
 * Two panels over the same six years. The top one is the number everybody
 * watches and it goes the wrong way for the right-looking reason. The bottom one
 * is the number that actually answers the question, and it crossed its line a
 * year and a half before anything happened.
 *
 * ⚠️ **The yield is computed from the dividend and the price**, so the top panel
 * cannot say something the bottom panel's inputs disagree with.
 *
 * ⚠️ **The cut is marked on BOTH panels by the same constant.** Two hand-placed
 * rules would be two claims about when it happened, and they would only have to
 * disagree by a pixel to make the "eighteen months of warning" sentence unreadable.
 */

const YIELD_LINE = 'var(--brand-bright)';
const PAYOUT_LINE = 'var(--brand-deep)';
const LIMIT_LINE = '#B22222';
const FLOOR_Y = 92;

function Panel({
  title,
  points,
  color,
  ticks,
  format,
  limitY,
  ariaLabel,
  id,
}: {
  title: string;
  points: string;
  color: string;
  ticks: readonly { y: number; value: number }[];
  format: (v: number) => string;
  limitY?: number;
  ariaLabel: string;
  id: string;
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
      <div className="relative mt-2 w-full aspect-[16/7]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel}
        >
          <AxisFrame floorY={FLOOR_Y} />
          {limitY !== undefined && (
            <line
              x1={rx(0)}
              y1={limitY}
              x2={rx(100)}
              y2={limitY}
              stroke={LIMIT_LINE}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* The quarter the dividend was cut, on both panels from one constant. */}
          <line
            data-cut-rule={id}
            x1={rx(qx(CUT_Q))}
            y1="4"
            x2={rx(qx(CUT_Q))}
            y2={FLOOR_Y}
            stroke="var(--text-secondary)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            data-dividend-path={id}
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <AxisLabels ticks={ticks} format={format} />
      </div>
    </div>
  );
}

export function DividendFigure() {
  const yieldPoints = QUARTERS.map(
    (q) => `${rx(qx(q.q)).toFixed(2)},${yieldY(q.yieldPct).toFixed(2)}`,
  ).join(' ');
  const payoutPoints = QUARTERS.map(
    (q) => `${rx(qx(q.q)).toFixed(2)},${payoutY(q.payoutPct).toFixed(2)}`,
  ).join(' ');

  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color={YIELD_LINE} dashed={false} />}>
            The yield — one year of dividends as a percentage of the share price
          </LegendItem>
          <LegendItem swatch={<Swatch color={PAYOUT_LINE} dashed={false} />}>
            The payout ratio — the share of profit being handed out
          </LegendItem>
          <LegendItem swatch={<Swatch color={LIMIT_LINE} />}>
            Paying out everything it earns
          </LegendItem>
        </>
      }
      caption={
        <>
          One imaginary company, six years, and the dotted upright is the quarter
          the dividend was cut by {CUT_PCT.toFixed(0)}%. The yield rose from{' '}
          {START_YIELD.yieldPct.toFixed(1)}% to{' '}
          <strong>{PEAK_YIELD.yieldPct.toFixed(1)}%</strong> on the way down — not
          because the payment grew, but because the price it is divided by kept
          shrinking. After the cut it was{' '}
          <strong>{POST_CUT_YIELD.yieldPct.toFixed(1)}%</strong>, roughly where it
          started. The panel underneath had crossed the line{' '}
          <strong>{WARNING_QUARTERS} quarters earlier</strong>: the company was
          paying out more than it earned, and had been for over a year.
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-6">
        <Panel
          id="yield"
          title="What the yield looked like"
          points={yieldPoints}
          color={YIELD_LINE}
          ticks={YIELD_TICKS.map((v) => ({ y: yieldY(v), value: v }))}
          format={(v) => `${v}%`}
          ariaLabel={`A yield rising steadily from ${START_YIELD.yieldPct.toFixed(1)} percent to ${PEAK_YIELD.yieldPct.toFixed(1)} percent, then dropping to ${POST_CUT_YIELD.yieldPct.toFixed(1)} percent when the dividend is cut.`}
        />
        <Panel
          id="payout"
          title="What the payout ratio was saying"
          points={payoutPoints}
          color={PAYOUT_LINE}
          ticks={PAYOUT_TICKS.map((v) => ({ y: payoutY(v), value: v }))}
          format={(v) => `${v}%`}
          limitY={payoutY(PAYOUT_LIMIT)}
          ariaLabel={`A payout ratio climbing past ${PAYOUT_LIMIT} percent in quarter ${FIRST_OVER_LIMIT.q} and staying above it until the dividend is cut in quarter ${CUT_Q}.`}
        />

        {/* One time axis for both panels — they share an x scale, so two would be
            two claims about the same thing (CLAUDE.md 11c). */}
        <div className="relative h-4 w-full">
          {YEAR_TICKS.map((t) => (
            <span
              key={t.year}
              data-year-tick="dividend"
              className="absolute -translate-x-1/2 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
              style={{ left: `${rx(qx(t.q))}%` }}
            >
              {t.year === 0 ? 'start' : `${t.year} yrs`}
            </span>
          ))}
        </div>
      </div>
    </Figure>
  );
}
