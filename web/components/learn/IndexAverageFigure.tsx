import { Figure, LegendItem } from '@/components/Figure';
import {
  AxisFrame,
  AxisLabels,
  PinnedLabel,
  Plot,
  PointDot,
  Swatch,
  XTickRow,
  rx,
  yearTick,
} from './chartPrimitives';
import {
  DD_TICKS,
  DEPTH_RATIO,
  INDEX_DD,
  INDEX_TROUGH,
  INDEX_WORST,
  MEMBERS,
  MEMBER_TROUGHS,
  YEAR_TICKS,
  yOf,
} from './indexGeometry';

/**
 * The one figure for "Why your company's own history beats the market's average".
 *
 * Four drawdown curves on one axis: three companies and the index they belong
 * to. The index is the flattest line on the chart and it is not a safer
 * investment — it is an average of three falls that happened at three different
 * times, and averaging things that do not coincide makes them small.
 *
 * ⚠️ **The index curve is derived from the other three** (`indexGeometry.ts`), so
 * the picture is an instance of the claim rather than a drawing of it.
 *
 * ⚠️ **The troughs are LABELLED and there is a time axis, and both were missing
 * until 2026-08-20.** Without them the figure was four tangled lines: a reader
 * could see that one was flatter and had no way to see *why*, because the two
 * things the caption asserts — how deep each company went, and that they went
 * there in different years — were the two things the drawing did not show. It
 * passed every guard, because a missing annotation renders perfectly (CLAUDE.md
 * 11j). Each depth and each trough position is read off the curve it belongs to,
 * so a reshaped path moves its own label.
 *
 * ⚠️ **Member curves are drawn lighter than the index, not in different hues.**
 * Four saturated lines on one axis reads as four categories; the point here is
 * one category and its average, and weight carries that where colour would not.
 */

const MEMBER_LINE = 'var(--brand-mid)';
const INDEX_LINE = 'var(--brand-deep)';
const FLOOR_Y = 88;

const pathOf = (dd: readonly { x: number; pct: number }[]): string =>
  dd.map((p) => `${rx(p.x).toFixed(2)},${yOf(p.pct).toFixed(2)}`).join(' ');

export function IndexAverageFigure() {
  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color={MEMBER_LINE} dashed={false} />}>
            Each of the three companies, measured from its own peak
          </LegendItem>
          <LegendItem swatch={<Swatch color={INDEX_LINE} dashed={false} />}>
            The index they make up — the average of the three
          </LegendItem>
        </>
      }
      caption={
        <>
          Three imaginary companies and the index built from them. Each hits its own
          worst in a different year —{' '}
          {MEMBER_TROUGHS.map((t) => `${t.name} ${Math.abs(t.pct).toFixed(0)}%`).join(', ')} — and
          because those years do not line up, the average of the three never falls
          past <strong>{Math.abs(INDEX_WORST).toFixed(0)}%</strong>. That is{' '}
          {DEPTH_RATIO.toFixed(1)} times shallower than the worst of them, and it is
          arithmetic rather than safety. The flat line is what a market-wide figure
          describes, and no company in it behaves like that.
        </>
      }
    >
      {/* ⚠️ Taller on a phone, not merely narrower. Four labelled points in a
          16:9 box have 211px of height at 375px and the labels are 22px each — so
          the crowding is vertical, and shrinking the type is not available (12px
          is the reading floor). Giving the plot more height is the only move that
          buys rows without abbreviating the words. */}
      <Plot box="aspect-[16/12] sm:aspect-[16/9]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Four falling-and-recovering curves on one axis over three years. ${MEMBER_TROUGHS.map(
            (t) => `${t.name} reaches ${Math.abs(t.pct).toFixed(0)} percent`,
          ).join(', ')} below its own peak, each in a different year, while the index curve built from them never falls below ${Math.abs(
            INDEX_WORST,
          ).toFixed(0)} percent.`}
        >
          <AxisFrame floorY={FLOOR_Y} />
          {MEMBERS.map((m) => (
            <polyline
              key={m.name}
              data-member-path={m.name}
              points={pathOf(m.dd)}
              fill="none"
              stroke={MEMBER_LINE}
              strokeOpacity="0.55"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            data-index-path=""
            points={pathOf(INDEX_DD)}
            fill="none"
            stroke={INDEX_LINE}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <AxisLabels
          ticks={DD_TICKS.map((v) => ({ y: yOf(v), value: v }))}
          format={(v) => `${v}%`}
        />

        {/* Each company's own worst, where and when it happened.

            ⚠️ A dot as well as a label. Without one the numbers floated in open
            plot and a reader had to guess which curve each belonged to — which is
            most of the figure's information, sitting on the page unattached. */}
        {MEMBER_TROUGHS.map((t) => (
          <span key={t.name}>
            <PointDot x={t.x} y={yOf(t.pct)} color={MEMBER_LINE} id={t.name} />
            <PinnedLabel
              id={t.name}
              x={t.x}
              y={yOf(t.pct)}
              text={`${t.name} ${t.pct.toFixed(0)}%`}
              short={`${t.name.replace('Company ', '')} ${t.pct.toFixed(0)}%`}
            />
          </span>
        ))}
        {/* …and the index's, which is the whole comparison. */}
        <PointDot
          x={INDEX_TROUGH.x}
          y={yOf(INDEX_TROUGH.pct)}
          color={INDEX_LINE}
          id="index"
        />
        <PinnedLabel
          id="index"
          x={INDEX_TROUGH.x}
          y={yOf(INDEX_TROUGH.pct)}
          text={`index ${INDEX_TROUGH.pct.toFixed(0)}%`}
          /* On a phone the number goes and the name stays. The label is centred
             on the index's low, which is the same moment as the deepest member's
             — so its left half lies over that member's descent, and the wider the
             label the further into it. The caption states the figure one line
             below; nothing else on the drawing says which curve is the index. */
          short="index"
          strong
        />

        {/* The years, in HTML so they stay 12px at every width, hung off the
            floor line rather than the bottom of the box. */}
        <XTickRow
          id="index"
          floorY={FLOOR_Y}
          ticks={YEAR_TICKS.map((t) => ({ key: t.year, x: t.x, label: yearTick(t.year) }))}
        />
      </Plot>
      <div className="h-6" />
    </Figure>
  );
}
