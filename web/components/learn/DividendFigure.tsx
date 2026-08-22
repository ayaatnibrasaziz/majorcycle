import { Figure, LegendItem } from '@/components/Figure';
import {
  AxisFrame,
  AxisLabels,
  Plot,
  PointDot,
  Swatch,
  rx,
  yearTick,
} from './chartPrimitives';
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
  markCut,
  markCross,
}: {
  title: string;
  points: string;
  color: string;
  ticks: readonly { y: number; value: number }[];
  format: (v: number) => string;
  limitY?: number;
  ariaLabel: string;
  id: string;
  /** Name the vertical rule. Once, on the top panel — both share one x. */
  markCut?: boolean;
  /** Mark the quarter the payout ratio first passed the line it is read against. */
  markCross?: boolean;
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
      <Plot box="aspect-[16/7]" className="mt-2">
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

        {/* ⚠️ The rule was unlabelled until 2026-08-20, so the one event the whole
            figure turns on was a faint dotted line a reader had to find in the
            caption. Right-anchored: it sits at 79% of the plot and a centred
            label would hang off the panel. */}
        {/* ⚠️ The caption's headline is "6 quarters earlier", and that is a
            DISTANCE — it only means anything if both ends of it are on the chart.
            The cut was marked and its cause was not. */}
        {markCross && (
          <>
            <PointDot
              x={qx(FIRST_OVER_LIMIT.q)}
              y={payoutY(FIRST_OVER_LIMIT.payoutPct)}
              color={LIMIT_LINE}
              id="crossed"
            />
            {/* ⚠️ **Anchored right, so its width is spent LEFTWARDS from a dot a
                third of the way across the plot** — and at 360px the full phrase is
                wider than that, so it ran out of the drawing and into the axis
                gutter, landing on "100%" and "150%". It measured clear on Windows
                and overlapped by 3px on CI, because Linux renders the same font a
                touch wider: a label that only just fits is a label that does not.
                Above-left is still the right *place* (the curve is below the line
                there, and above-right is where it climbs), so what gives on a
                narrow screen is the number of words. */}
            <span
              data-cross-label=""
              className="absolute whitespace-nowrap text-[12px] font-semibold text-[var(--text-primary)]"
              style={{
                left: `${rx(qx(FIRST_OVER_LIMIT.q))}%`,
                top: `${payoutY(FIRST_OVER_LIMIT.payoutPct)}%`,
                transform: 'translate(-100%, -22px)',
              }}
            >
              <span className="sm:hidden">over 100%&nbsp;</span>
              <span className="hidden sm:inline">more than it earns&nbsp;</span>
            </span>
          </>
        )}
        {markCut && (
          <span
            data-cut-label=""
            className="absolute whitespace-nowrap text-[12px] font-semibold text-[var(--text-primary)]"
            style={{ left: `${rx(qx(CUT_Q))}%`, top: 0, transform: 'translate(-100%, -2px)' }}
          >
            dividend cut&nbsp;
          </span>
        )}
      </Plot>
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
          markCut
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
          markCross
          ariaLabel={`A payout ratio climbing past ${PAYOUT_LIMIT} percent in quarter ${FIRST_OVER_LIMIT.q} and staying above it until the dividend is cut in quarter ${CUT_Q}.`}
        />

        {/* One time axis for both panels — they share an x scale, so two would be
            two claims about the same thing (CLAUDE.md 11c).

            ⚠️ It wears the same gutter as the panels. It is their sibling, not
            their child, so when the plots moved inside a fixed-width axis gutter
            this row stayed at the card edge and every year marker slid 44px left
            of the data it labels. Nothing errored and the row still rendered;
            "start" simply pointed at the wrong place. */}
        <Plot box="h-4">
          {YEAR_TICKS.map((t) => (
            <span
              key={t.year}
              data-year-tick="dividend"
              className="absolute -translate-x-1/2 whitespace-nowrap font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
              style={{ left: `${rx(qx(t.q))}%` }}
            >
              {yearTick(t.year)}
            </span>
          ))}
        </Plot>
      </div>
    </Figure>
  );
}
