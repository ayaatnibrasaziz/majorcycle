import { Figure, LegendItem } from '@/components/Figure';

import { BACKWARD, FORWARD, SPANS, TODAY_X, YEAR_TICKS, edgeLabel, xOf } from './limitsGeometry';

/**
 * The one figure for "What MajorCycle deliberately doesn't do".
 *
 * A timeline of everything a stock page is built from. Two of the three bars
 * stop at today; the only one that goes further belongs to somebody else, and
 * the longest one has no left end at all. That shape is the article's first and
 * largest limit, and it is far more convincing seen than asserted.
 *
 * ⚠️ **Built in HTML, not SVG.** Every element is a horizontal extent on one
 * axis, and HTML keeps the bars' corner radius and the labels' 12px without the
 * distorting `preserveAspectRatio="none"` viewBox the curve figures need.
 *
 * ── Three owner corrections, 2026-08-22 ──────────────────────────────────────
 *
 * ⚠️ **1. The today rule is drawn in SEGMENTS, one per bar track, and never
 * across text.** It used to be a single line running the full height of the
 * figure, which meant it struck straight through three row headings and three
 * notes — a dashed rule crossing prose reads as a print defect, and the halo
 * that would hide it was already rejected on the other figures. Segments cost
 * one thing: they only read as a single line if they genuinely line up, so
 * `learn.spec.ts` asserts every segment shares one x.
 *
 * ⚠️ **2. Each row's heading and its explanation are adjacent.** The note used
 * to sit *below* the bar, so the bold label and the sentence explaining it were
 * separated by the drawing they both describe. Heading, note, then bar.
 *
 * ⚠️ **3. The price-history bar has no left end** — see `limitsGeometry.ts` for
 * why the old three-year bar was wrong twice over. It is drawn flush to the
 * plot edge with a square corner and a fade, so it reads as *continues past
 * here*, and the axis tick sits well inside it rather than at its edge.
 */

const OURS = 'var(--brand-mid)';
const THEIRS = 'var(--c-tier-3)';

/** How far the open end fades in, in pixels. Enough to read as a fade, not a gap. */
const FADE_PX = 40;

export function LimitsFigure() {
  return (
    <Figure
      legend={
        <>
          <LegendItem
            swatch={
              <span
                className="block h-[7px] w-6 rounded-full"
                style={{ backgroundColor: OURS }}
              />
            }
          >
            What our reading is built from — all of it already happened
          </LegendItem>
          <LegendItem
            swatch={
              <span
                className="block h-[7px] w-6 rounded-full"
                style={{ backgroundColor: THEIRS }}
              />
            }
          >
            Third-party estimates, shown as given and never scored
          </LegendItem>
        </>
      }
      caption={
        <>
          Everything a MajorCycle page is built from, laid out in time.{' '}
          <strong>
            Only {FORWARD.length} of the {SPANS.length} rows reaches past today
          </strong>
          , and it is not ours — analyst targets are other people&rsquo;s estimates,
          reproduced without judgement. The other {BACKWARD.length}{' '}describe periods
          that have already closed, and the price row has no left edge because it
          uses the company&rsquo;s whole listed record. There is no line here that
          predicts a price, because we do not draw one.
        </>
      }
    >
      <div className="relative w-full">
        <ul className="figure-list flex flex-col gap-5">
          {SPANS.map((s) => {
            const color = s.ours ? OURS : THEIRS;
            return (
              <li key={s.id} data-span={s.id}>
                {/* Heading and its explanation, together, above the drawing. */}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {s.label}
                  </span>
                  <span className="shrink-0 text-right text-[12px] text-[var(--text-secondary)]">
                    {s.ours ? 'ours' : 'third party'}
                  </span>
                </div>
                <p className="mt-[3px] text-[12px] leading-snug text-[var(--text-secondary)]">
                  {s.note}
                </p>

                <div className="relative mt-[9px] h-[20px] w-full">
                  {/* Today, behind the bar and only ever as tall as the track. */}
                  <span
                    data-today-rule=""
                    className="absolute inset-y-0 w-px border-l border-dashed border-[var(--text-secondary)]"
                    style={{ left: `${TODAY_X}%` }}
                    aria-hidden="true"
                  />
                  <span
                    data-span-bar={s.id}
                    data-open-ended={s.openEnded ? '' : undefined}
                    className={`absolute top-1/2 h-[10px] -translate-y-1/2 ${
                      s.openEnded ? 'rounded-r-full' : 'rounded-full'
                    }`}
                    style={{
                      left: `${xOf(s.from)}%`,
                      width: `${xOf(s.to) - xOf(s.from)}%`,
                      /* ⚠️ `backgroundImage`, never the `background` shorthand:
                         the shorthand resets `background-color` to transparent
                         and anything reading the DOM for what sits behind a
                         colour then reads straight through (CLAUDE.md 11l iii). */
                      backgroundColor: s.openEnded ? 'transparent' : color,
                      backgroundImage: s.openEnded
                        ? `linear-gradient(to right, transparent 0, ${color} ${FADE_PX}px)`
                        : undefined,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {/* The time axis, in flow directly under the last track so the segments
            above it read as one line reaching the word "today". */}
        <div className="relative mt-2 h-6 w-full border-t border-[var(--border)]">
          {YEAR_TICKS.map((y) => (
            <span
              key={y}
              data-year-tick="limits"
              className={`absolute -translate-x-1/2 whitespace-nowrap pt-1 text-[12px] ${
                y === 0
                  ? 'font-semibold text-[var(--text-primary)]'
                  : 'font-[family-name:var(--font-mono)] text-[var(--text-secondary)]'
              }`}
              style={{ left: `${xOf(y)}%` }}
            >
              {edgeLabel(y)}
            </span>
          ))}
        </div>
      </div>
    </Figure>
  );
}
