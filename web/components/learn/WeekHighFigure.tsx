import { Figure, LegendItem } from '@/components/Figure';
import { AxisFrame, AxisLabels, PLOT_L, PointDot, TimeNote, rx } from './chartPrimitives';
import {
  CANDLES,
  GAP_PCT,
  HIGH_52,
  LOW_52,
  LOW_GAP_PCT,
  PLOT_FLOOR_Y,
  PRICE_TICKS,
  SLOT,
  xOf,
  yOf,
} from './weekHighGeometry';

/**
 * The one figure for "What a 52-week high really tells you" — 52 weekly candles.
 *
 * ⚠️ **Candles rather than a line, at the owner's direction (2026-08-19), and it
 * is the better picture.** A candle draws the distinction the article is about
 * on its own: the BODY is open-to-close, the WICK is everything traded. The
 * quoted 52-week high is the top of the tallest wick and the 52-week low the
 * bottom of the lowest — neither reached by any close. A line chart could only
 * assert that in a caption; candles show it.
 *
 * ⚠️ **The product's own candlestick palette**, lifted from
 * `components/stocks/PriceChart.tsx` rather than chosen here: `#228B22` up,
 * `#B22222` down, `#006400` / `#8B0000` for borders and wicks. A reader who
 * signs up meets that chart, so the one teaching them should be the same one
 * (CLAUDE.md 11m).
 *
 * ⚠️ **Both extremes are READ from the data** — `HIGH_52` and `LOW_52` are
 * arg-maxes over `CANDLES`, and both percentages in the caption are computed
 * from them. A hand-placed rule on a chart is a claim nobody re-checks.
 *
 * ⚠️ **A schematic** (CLAUDE.md #24) — no dates, no gridlines, and the caption
 * says in words that the stock is imaginary.
 */

const UP_FILL = '#228B22';
const DOWN_FILL = '#B22222';
const UP_EDGE = '#006400';
const DOWN_EDGE = '#8B0000';
const RULE = 'var(--text-secondary)';

/** One week's slot, in the horizontal space `rx()` maps into. */
const SLOT_W = rx(SLOT) - rx(0);
const money = (v: number): string => `$${v.toFixed(0)}`;

function Candles() {
  return (
    <>
      {CANDLES.map((c, i) => {
        const up = c.close >= c.open;
        const x = rx(xOf(i));
        const yTop = yOf(Math.max(c.open, c.close));
        const yBottom = yOf(Math.min(c.open, c.close));
        // A week that closed where it opened still has to draw as something.
        const h = Math.max(0.7, yBottom - yTop);
        return (
          <g key={i}>
            <line
              x1={x}
              y1={yOf(c.high)}
              x2={x}
              y2={yOf(c.low)}
              stroke={up ? UP_EDGE : DOWN_EDGE}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={x - SLOT_W * 0.3}
              y={yTop}
              width={SLOT_W * 0.6}
              height={h}
              fill={up ? UP_FILL : DOWN_FILL}
            />
          </g>
        );
      })}
    </>
  );
}

function Rule({ y }: { y: number }) {
  return (
    <line
      x1={PLOT_L}
      y1={y}
      x2="100"
      y2={y}
      stroke={RULE}
      strokeWidth="1.5"
      strokeDasharray="5 4"
      vectorEffect="non-scaling-stroke"
    />
  );
}

export function WeekHighFigure() {
  const highY = yOf(HIGH_52.price);
  const lowY = yOf(LOW_52.price);

  return (
    <Figure
      legend={
        <>
          <LegendItem
            swatch={
              <span className="block h-3 w-2 rounded-[1px]" style={{ backgroundColor: UP_FILL }} />
            }
          >
            A week that closed higher than it opened
          </LegendItem>
          <LegendItem
            swatch={
              <span className="block h-3 w-2 rounded-[1px]" style={{ backgroundColor: DOWN_FILL }} />
            }
          >
            A week that closed lower
          </LegendItem>
          <LegendItem
            swatch={<span className="block h-3 w-px" style={{ backgroundColor: UP_EDGE }} />}
          >
            The thin line through each — the full range traded that week
          </LegendItem>
        </>
      }
      caption={
        <>
          One imaginary year, as 52 weekly candles. Each solid block spans the
          week&rsquo;s open to its close; the thin line running through it is
          everything traded in between.{' '}
          <strong>Both quoted figures come from the thin lines, not the blocks</strong>{' '}
          — the 52-week high is the top of the tallest one and the 52-week low the
          bottom of the lowest, and neither was ever a closing price. Here the high
          sits {GAP_PCT.toFixed(1)}% above the best close of the year, and the low{' '}
          {LOW_GAP_PCT.toFixed(1)}% below the worst. That is why a chart&rsquo;s line
          never quite touches the numbers quoted beside it.
        </>
      }
    >
      <div className="relative w-full aspect-[16/10] sm:aspect-[16/7]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            'A candlestick chart of one imaginary year, one candle per week for 52 ' +
            'weeks. Each candle has a solid body spanning that week’s open and close, ' +
            'and a thin line spanning the full range traded. A dashed rule near the top ' +
            'marks the 52-week high, which is the tip of a single tall line about ' +
            `${GAP_PCT.toFixed(1)} per cent above the highest close of the year. A second ` +
            'dashed rule near the bottom marks the 52-week low, about ' +
            `${LOW_GAP_PCT.toFixed(1)} per cent below the lowest close. Neither figure was ` +
            'ever a closing price.'
          }
        >
          <AxisFrame floorY={PLOT_FLOOR_Y + 8} />
          <Rule y={highY} />
          <Rule y={lowY} />
          <Candles />
        </svg>

        <AxisLabels ticks={PRICE_TICKS} format={money} />

        <PointDot x={xOf(HIGH_52.week)} y={highY} color={DOWN_EDGE} id="high52" />
        <PointDot x={xOf(LOW_52.week)} y={lowY} color={DOWN_EDGE} id="low52" />

        {/*
          ⚠️ Labels are anchored to the left of their own RULE, not to the marker.
          The two extremes fall at opposite ends of the plot, so a label pinned to
          each marker would put one hard against the right edge at narrow widths.
          Anchored to the rule, both stay inside the panel and the rule itself
          carries the eye across to the wick that set it.
        */}
        <span
          data-fig-label="high52"
          className="absolute left-[16.5%] -translate-y-[16px] whitespace-nowrap font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--text-secondary)]"
          style={{ top: `${highY}%` }}
        >
          52-week high
        </span>
        <span
          data-fig-label="low52"
          className="absolute left-[16.5%] translate-y-[5px] whitespace-nowrap font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--text-secondary)]"
          style={{ top: `${lowY}%` }}
        >
          52-week low
        </span>
      </div>
      <TimeNote>Time → (52 weeks)</TimeNote>
    </Figure>
  );
}
