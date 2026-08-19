import { Figure, LegendItem } from '@/components/Figure';
import { Swatch } from './chartPrimitives';
import {
  ANALYST_COUNT,
  AXIS_TICKS,
  HIGH_MOVE_PCT,
  LOW_MOVE_PCT,
  MEAN_UPSIDE_PCT,
  PRICE_TODAY,
  SPREAD_PCT,
  TARGET_HIGH,
  TARGET_LOW,
  TARGET_MEAN,
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
 * ⚠️ `lift` exists because of a defect a guard did not catch.
 *
 * "Today" and "Average target" both sit above the bar and are only ~20% of the
 * plot apart. At 1280px their labels clear each other comfortably; at **414px
 * and below they overlapped**, on a site whose stated floor is 375px. The guard
 * measured one width — the one where the bug is invisible (CLAUDE.md 11i-b).
 *
 * Rather than shrink the type or hide a label on small screens, the two are put
 * on different rows: `lift` raises one clear of the other, so they cannot
 * collide at any width. The guard now sweeps 1280 → 360.
 */
function Marker({
  price,
  color,
  label,
  sub,
  id,
  above,
  lift,
}: {
  price: number;
  color: string;
  label: string;
  sub: string;
  id: string;
  above?: boolean;
  /** Push the LABEL clear of its neighbour's. The dot never moves. */
  lift?: boolean;
}) {
  // ⚠️ The difference between the two gaps must exceed a label's own height
  // (two 12px lines ≈ 32px), or the rows still intersect. 30 vs 6 left an 8px
  // overlap that looked deliberate and was measured, not eyeballed.
  const gap = lift ? 52 : 6;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${xOf(price)}%`, top: '50%' }}
      data-analyst-marker={id}
    >
      <span
        className="block h-[13px] w-[13px] rounded-full border-[3px] bg-[var(--bg-surface)]"
        style={{ borderColor: color }}
      />
      <span
        data-marker-label={id}
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
        style={above ? { bottom: `calc(100% + ${gap}px)` } : { top: `calc(100% + ${gap}px)` }}
      >
        <span className="whitespace-nowrap text-center text-[12px] font-semibold text-[var(--text-primary)]">
          {label}
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
      <div className="relative w-full pt-28 pb-28">
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

          <Marker
            price={PRICE_TODAY}
            color={TODAY}
            label="Today"
            sub={money(PRICE_TODAY)}
            id="today"
            above
            lift
          />
          <Marker
            price={TARGET_LOW}
            color={RANGE}
            label="Lowest"
            sub={money(TARGET_LOW)}
            id="low"
            lift
          />
          <Marker
            price={TARGET_MEAN}
            color={MEAN}
            label="Average target"
            sub={money(TARGET_MEAN)}
            id="mean"
            above
          />
          <Marker
            price={TARGET_HIGH}
            color={RANGE}
            label="Highest"
            sub={money(TARGET_HIGH)}
            id="high"
          />
        </div>

        {/* Axis ticks, below everything. */}
        <div className="relative mt-24 h-4 w-full border-t border-[var(--border)]">
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
