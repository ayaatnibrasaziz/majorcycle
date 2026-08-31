import { Figure, LegendItem } from '@/components/Figure';
import { Swatch } from './chartPrimitives';
import {
  ANALYST_COUNT,
  AXIS_TICKS,
  AXIS_TOP_PX,
  MARKERS,
  PAD_BOTTOM_PX,
  PAD_TOP_PX,
  MARKER_GAP_PX,
  type Marker as MarkerSpec,
  HIGH_MOVE_PCT,
  LOW_MOVE_PCT,
  MEAN_UPSIDE_PCT,
  SPREAD_PCT,
  TARGET_HIGH,
  TARGET_LOW,
  xOf,
} from './analystGeometry';

/**
 * The one figure for "How to read an analyst price target".
 *
 * A range, not a chart. The article's argument is that the consensus number is
 * the least interesting of the four figures on the page, so the picture has to
 * put the **spread** in the foreground and the average in it — rather than
 * drawing the average as a destination, which is how it is usually shown and is
 * the impression the article is arguing against.
 *
 * ⚠️ Built in HTML, not SVG. Everything here is a horizontal position on one
 * axis, and HTML keeps the markers circular and the labels at 12px without a
 * distorting viewBox (the `preserveAspectRatio="none"` trap the other figures
 * work around).
 */

const TODAY = 'var(--brand-mid)';
const RANGE = 'var(--c-tier-3)';
const MEAN = 'var(--brand-deep)';

/**
 * ⚠️ **Nothing stacks. The four labels are kept apart by DISTANCE ALONG THE
 * AXIS, and by nothing else.**
 *
 * "Today" and "Average target" both sit above the bar. They used to be on two
 * different rows, because at 414px and below their labels overlapped and
 * raising one was the cheapest fix. Owner feedback (2026-08-22) was that the
 * two read as one line or not at all, and that the prices could move to make
 * room — so `TARGET_MEAN` moved until they clear at 360px, and the second row
 * is gone.
 *
 * That removes the safety net: a label is now only ever as safe as the gap
 * between two prices, which is why `learn.spec.ts` sweeps 1280 → 360 and demands
 * 2px of daylight rather than merely "no overlap" (CLAUDE.md 11i-b — a bound
 * that passes by 1px proves nothing).
 */
function Marker({ spec, color, sub }: { spec: MarkerSpec; color: string; sub: string }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${xOf(spec.price)}%`, top: '50%' }}
      data-analyst-marker={spec.id}
    >
      <span
        className="block h-[13px] w-[13px] rounded-full border-[3px] bg-[var(--bg-surface)]"
        style={{ borderColor: color }}
      />
      <span
        data-marker-label={spec.id}
        /* ⚠️ One label on two lines, not two labels. The overlap guard compares
           every piece of text in a drawing with every other, and once it started
           demanding 2px of daylight it flagged a name sitting directly on its own
           price — which is what a stacked label IS. Marking the wrapper is what
           lets the guard tell "these two touch by design" from "these two
           collided", without softening the rule for everything else. */
        data-label-group=""
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
        style={
          spec.above
            ? { bottom: `calc(100% + ${MARKER_GAP_PX}px)` }
            : { top: `calc(100% + ${MARKER_GAP_PX}px)` }
        }
      >
        <span className="whitespace-nowrap text-center text-[12px] font-semibold text-[var(--text-primary)]">
          {spec.label}
        </span>
        <span className="whitespace-nowrap font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]">
          {sub}
        </span>
      </span>
    </div>
  );
}

export function AnalystTargetFigure() {
  const money = (v: number): string => `$${v}`;

  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color={TODAY} dashed={false} />}>
            Where the share trades today
          </LegendItem>
          <LegendItem
            swatch={
              <span
                className="block h-[7px] w-6 rounded-full"
                style={{ backgroundColor: RANGE }}
              />
            }
          >
            The full range of {ANALYST_COUNT}{' '}analysts&rsquo; twelve-month targets
          </LegendItem>
        </>
      }
      caption={
        <>
          One imaginary company. The consensus target implies{' '}
          <strong>{MEAN_UPSIDE_PCT.toFixed(0)}% upside</strong>, which is the number
          that gets quoted. Underneath it, the same {ANALYST_COUNT} analysts range
          from {LOW_MOVE_PCT.toFixed(0)}% to +{HIGH_MOVE_PCT.toFixed(0)}% — a spread
          of <strong>{SPREAD_PCT.toFixed(0)}% of today&rsquo;s share price</strong>.
          The average is a single point inside a very wide disagreement, and the
          width is the part worth reading.
        </>
      }
    >
      <div
        className="relative w-full"
        style={{ paddingTop: `${PAD_TOP_PX}px`, paddingBottom: `${PAD_BOTTOM_PX}px` }}
      >
        {/* The range bar */}
        <div className="relative h-[10px] w-full">
          <div className="absolute inset-y-0 w-full rounded-full bg-[var(--border)]" />
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: `${xOf(TARGET_LOW)}%`,
              width: `${xOf(TARGET_HIGH) - xOf(TARGET_LOW)}%`,
              backgroundColor: RANGE,
            }}
            data-analyst-range=""
          />

          {MARKERS.map((m) => (
            <Marker
              key={m.id}
              spec={m}
              color={m.id === 'today' ? TODAY : m.id === 'mean' ? MEAN : RANGE}
              sub={money(m.price)}
            />
          ))}
        </div>

        {/* Axis ticks, below everything — offset DERIVED from the marker lift, so
            the axis cannot drift into a lowered label the way it did until
            2026-08-20 (see `AXIS_TOP_PX`). */}
        <div
          className="relative h-4 w-full border-t border-[var(--border)]"
          style={{ marginTop: `${AXIS_TOP_PX}px` }}
        >
          {AXIS_TICKS.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 pt-1 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
              style={{ left: `${xOf(t)}%` }}
            >
              {money(t)}
            </span>
          ))}
        </div>
      </div>
    </Figure>
  );
}
