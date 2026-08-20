import { Figure, LegendItem } from '@/components/Figure';
import { AxisFrame, AxisLabels, Swatch, rx } from './chartPrimitives';
import {
  DD_TICKS,
  DEEPEST_MEMBER,
  DEPTH_RATIO,
  INDEX_DD,
  INDEX_WORST,
  MEMBERS,
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
 * ⚠️ **Member curves are drawn thinner and paler than the index, not in
 * different hues.** Four saturated lines on one axis reads as four categories;
 * the point here is one category and its average, and weight carries that where
 * colour would not.
 */

const MEMBER_LINE = 'var(--brand-mid)';
const INDEX_LINE = 'var(--brand-deep)';
const FLOOR_Y = yOf(0) + 88;

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
          Three imaginary companies and the index built from them. The deepest
          company fall is{' '}
          <strong>{Math.abs(DEEPEST_MEMBER.worst).toFixed(0)}%</strong>; the index
          never falls further than{' '}
          <strong>{Math.abs(INDEX_WORST).toFixed(0)}%</strong> —{' '}
          {DEPTH_RATIO.toFixed(1)} times shallower. Nothing here is safer than
          anything else. The falls simply happen in different years, and averaging
          them flattens all three. That flat line is what a market-wide figure
          describes, and no company in it behaves like that.
        </>
      }
    >
      <div className="relative w-full aspect-[16/9]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Four falling-and-recovering curves on one axis. The three company curves reach ${Math.abs(MEMBERS[0]!.worst).toFixed(0)}%, ${Math.abs(MEMBERS[1]!.worst).toFixed(0)}% and ${Math.abs(MEMBERS[2]!.worst).toFixed(0)}% below their peaks at three different times, while the index curve built from them never falls below ${Math.abs(INDEX_WORST).toFixed(0)}%.`}
        >
          <AxisFrame floorY={FLOOR_Y} />
          {MEMBERS.map((m) => (
            <polyline
              key={m.name}
              data-member-path={m.name}
              points={pathOf(m.dd)}
              fill="none"
              stroke={MEMBER_LINE}
              strokeOpacity="0.45"
              strokeWidth="1.6"
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
            strokeWidth="2.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <AxisLabels
          ticks={DD_TICKS.map((v) => ({ y: yOf(v), value: v }))}
          format={(v) => `${v}%`}
        />
      </div>
    </Figure>
  );
}
