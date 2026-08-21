import { Figure, LegendItem } from '@/components/Figure';
import {
  AXIS_LABEL_GAP_PX,
  AxisFrame,
  AxisLabels,
  DD_FILL,
  DD_LINE,
  PLOT_L,
  Plot,
  PointDot,
  Swatch,
  XTickRow,
  ddArea,
  rx,
  yearTick,
} from './chartPrimitives';
import {
  DD_FLOOR_Y,
  DD_TICKS,
  DRAWDOWN,
  PRICES,
  PRICE_FLOOR_Y,
  PRICE_TICKS,
  UNDERWATER,
  YEAR_TICKS,
  ddY,
  priceY,
  yearX,
  yearsInWords,
} from './priceRecoveryGeometry';

/**
 * The worked example for "How long do recoveries actually take?".
 *
 * The two panels the stock page actually draws, one above the other on a shared
 * time axis: the share price, and the same years expressed as a drawdown. The
 * whole point is the SHADED WIDTH — every stretch below zero is a stretch spent
 * under a previous high, and how wide it is, is how long that took.
 *
 * ⚠️ **The measurement is the subject, so it is drawn, not described.** Each
 * underwater stretch carries a span rule and its length in words. A caption
 * saying "you can read the duration off the chart", beside a chart with nothing
 * marked on it, is an instruction the reader has to carry out before they can
 * check whether it is true.
 *
 * ⚠️ **The span rules sit ON the zero line, not under the curve.** Inside the
 * shaded fill a horizontal rule reads as a threshold LEVEL rather than as a
 * distance — the same mistake already recorded and removed in `DrawdownFigures`.
 * On the zero line it reads as what it is: the stretch the price spent below it.
 */

const pricePath = PRICES.map((p) => `${rx(p.x).toFixed(2)},${priceY(p.price).toFixed(2)}`).join(' ');
const ddPath = DRAWDOWN.map((p) => `${rx(p.x).toFixed(2)},${ddY(p.pct).toFixed(2)}`).join(' ');

/** The high a stretch is measured against: the price at the moment it left zero. */
const highOf = (fromX: number): number => PRICES.find((p) => p.x >= fromX)!.price;

export function PriceRecoveryFigure() {
  const done = UNDERWATER.filter((u) => u.recovered);
  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color="var(--brand-deep)" dashed={false} />}>
            The share price
          </LegendItem>
          <LegendItem swatch={<Swatch color={DD_LINE} dashed={false} />}>
            The same years as a drawdown — how far under its own high it was
          </LegendItem>
          <LegendItem swatch={<Swatch color="var(--text-primary)" dashed={false} />}>
            How long it stayed below that high
          </LegendItem>
        </>
      }
      caption={
        <>
          A schematic, not a real company — but drawn the way MajorCycle draws it.
          Wherever the lower curve hangs below zero, the price was under a high it
          had already made, and the <strong>width</strong> of that shaded stretch is
          how long it stayed there. This company took{' '}
          <strong>{yearsInWords(done[0]!.years)}</strong> to get back the first time
          and <strong>{yearsInWords(done[1]!.years)}</strong> the second, and the
          fall on the right has not got back yet. Three falls, one company, three
          different waits — and none of the three lengths could have been read in
          advance. They are only lengths once they are over.
        </>
      }
    >
      {/* ── the price ─────────────────────────────────────────────────────── */}
      <Plot box="aspect-[16/7] sm:aspect-[16/5]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            'Upper panel: a schematic share price over eight years, with a price ' +
            'scale up the left. It falls sharply three times and climbs back to a ' +
            'new high after the first two. The third fall has not recovered yet.'
          }
        >
          <AxisFrame floorY={PRICE_FLOOR_Y} />

          {/* The high each fall is measured against — the level the price has to
              get back to before its drawdown returns to zero. */}
          {UNDERWATER.map((u) => (
            <line
              key={u.id}
              x1={rx(u.fromX)}
              y1={priceY(highOf(u.fromX))}
              x2={rx(u.toX)}
              y2={priceY(highOf(u.fromX))}
              stroke="var(--brand-mid)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <polyline
            points={pricePath}
            fill="none"
            stroke="var(--brand-deep)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <AxisLabels ticks={PRICE_TICKS} format={(v) => `$${v}`} stub />
      </Plot>

      {/* ── the same years, as a drawdown ─────────────────────────────────── */}
      {/* ⚠️ 16/9 on a phone, not 16/6. Three axis labels in a 94px panel leave
          them touching — measured at 360px as **0.x px** of vertical clearance,
          which no overlap guard would call a collision and which the next font
          that renders a hair taller turns into one. Height is the only variable
          available: 12px is the reading floor and the panel cannot narrow. */}
      <Plot box="aspect-[16/9] sm:aspect-[16/4]" className="mt-2">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            'Lower panel: the same eight years drawn as a drawdown. Zero per cent is ' +
            'the top line and the curve hangs below it. There are three shaded ' +
            'stretches below zero, of clearly different widths: ' +
            UNDERWATER.map(
              (u) =>
                `${Math.abs(Math.round(u.troughPct))} per cent deep and ${yearsInWords(u.years)} ` +
                `${u.recovered ? 'long' : 'so far'}`,
            ).join(', ') +
            '.'
          }
        >
          <AxisFrame floorY={DD_FLOOR_Y} />
          <line
            x1={PLOT_L}
            y1={ddY(0)}
            x2="100"
            y2={ddY(0)}
            stroke="var(--text-secondary)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <polygon points={ddArea(DRAWDOWN, ddY)} fill={DD_FILL} stroke="none" />
          <polyline
            points={ddPath}
            fill="none"
            stroke={DD_LINE}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* The span each stretch covers, drawn on the zero line it returns to.
              This IS the duration: the reader is being shown where to put a
              ruler, so the ruler is on the chart.

              ⚠️ **Ink, not a third blue.** Drawn in --brand-mid it was the exact
              colour of the drawdown curve, so the legend carried two identical
              swatches meaning different things and the measurement read as a
              fourth data series. Annotation is a different KIND of mark from
              data and has to look like one. */}
          {UNDERWATER.map((u) => (
            <g key={u.id} data-underwater-span={u.id}>
              <line
                x1={rx(u.fromX)}
                y1={ddY(0)}
                x2={rx(u.toX)}
                y2={ddY(0)}
                stroke="var(--text-primary)"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={rx(u.fromX)}
                y1={ddY(0) - 4}
                x2={rx(u.fromX)}
                y2={ddY(0) + 4}
                stroke="var(--text-primary)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              {u.recovered && (
                <line
                  x1={rx(u.toX)}
                  y1={ddY(0) - 4}
                  x2={rx(u.toX)}
                  y2={ddY(0) + 4}
                  stroke="var(--text-primary)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          ))}
        </svg>
        <AxisLabels ticks={DD_TICKS} format={(v) => `${v}%`} />

        {/* Each stretch's lowest point — the number everybody reads — so depth
            and duration sit on one drawing and can be compared. */}
        {UNDERWATER.map((u) => (
          <PointDot key={u.id} x={u.troughX} y={ddY(u.troughPct)} color={DD_LINE} id={u.id} />
        ))}

        {/* The lengths, in words, sitting above the span they measure.
            HTML so they stay 12px at every width.

            ⚠️ **Desktop only, and the mobile fallback is right below.** At 375px
            the first stretch is 56px wide and its label is 66px — measured — so
            three centred labels overlap each other and the third runs off the
            panel. Squeezing them (`19 mo`) buys the room by making the words
            cryptic on the pass where the reader most needs them plain. The
            brackets stay drawn on the phone; only the words move. */}
        {UNDERWATER.map((u) => {
          const mid = (u.fromX + u.toX) / 2;
          // Anchored from whichever side keeps it on the panel — the last span
          // ends AT the right edge, so a centred label hangs half off it.
          const anchorRight = mid > 70;
          return (
            <span
              key={u.id}
              data-underwater-label={u.id}
              className="hidden sm:block absolute whitespace-nowrap font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--text-primary)]"
              style={{
                left: `${rx(mid)}%`,
                top: `${ddY(0)}%`,
                transform: `translate(${anchorRight ? '-100%' : '-50%'}, calc(-100% - ${AXIS_LABEL_GAP_PX}px))`,
              }}
            >
              {u.recovered ? yearsInWords(u.years) : `${yearsInWords(u.years)} so far`}
            </span>
          );
        })}

        <XTickRow
          id="price-recovery"
          floorY={DD_FLOOR_Y}
          ticks={YEAR_TICKS.map((y) => ({ key: y, x: yearX(y), label: yearTick(y) }))}
        />
      </Plot>
      <div className="h-6" />

      {/* The same three numbers, for the width where they cannot sit on the
          drawing. Built from `UNDERWATER`, so it cannot disagree with the
          brackets it is standing in for. */}
      <p
        data-underwater-list
        className="sm:hidden mt-1 text-[12px] text-[var(--text-secondary)]"
      >
        Time under the old high:{' '}
        {UNDERWATER.map((u) =>
          u.recovered ? yearsInWords(u.years) : `${yearsInWords(u.years)} so far`,
        ).join(' · ')}
      </p>
    </Figure>
  );
}
