import { Figure, LegendItem } from '@/components/Figure';

import { BACKWARD, FORWARD, SPANS, TODAY_X, YEAR_TICKS, xOf } from './limitsGeometry';

/**
 * The one figure for "What MajorCycle deliberately doesn't do".
 *
 * A timeline of everything a stock page is built from. Two of the three bars
 * stop at today; the only one that goes further belongs to somebody else. That
 * shape is the article's first and largest limit, and it is far more convincing
 * seen than asserted.
 *
 * ⚠️ **Built in HTML, not SVG.** Every element is a horizontal extent on one
 * axis, and HTML keeps the bars' corner radius and the labels' 12px without the
 * distorting `preserveAspectRatio="none"` viewBox the curve figures need.
 */

const OURS = 'var(--brand-mid)';
const THEIRS = 'var(--c-tier-3)';

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
          reproduced without judgement. The other {BACKWARD.length} describe periods
          that have already closed. There is no line here that predicts a price,
          because we do not draw one.
        </>
      }
    >
      <div className="relative w-full pb-8">
        {/* Today, drawn behind the bars and running the full height. */}
        <span
          data-today-rule=""
          className="absolute top-0 bottom-8 w-px border-l border-dashed border-[var(--text-secondary)]"
          style={{ left: `${TODAY_X}%` }}
          aria-hidden="true"
        />

        <ul className="figure-list flex flex-col gap-5">
          {SPANS.map((s) => (
            <li key={s.id} data-span={s.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {s.label}
                </span>
                <span className="text-right text-[12px] text-[var(--text-secondary)]">
                  {s.ours ? 'ours' : 'third party'}
                </span>
              </div>
              <div className="relative mt-2 h-[10px] w-full">
                <span
                  data-span-bar={s.id}
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${xOf(s.from)}%`,
                    width: `${xOf(s.to) - xOf(s.from)}%`,
                    backgroundColor: s.ours ? OURS : THEIRS,
                  }}
                />
              </div>
              <p className="mt-[6px] text-[12px] leading-snug text-[var(--text-secondary)]">
                {s.note}
              </p>
            </li>
          ))}
        </ul>

        {/* The time axis, underneath everything. */}
        <div className="absolute inset-x-0 bottom-0 h-6 border-t border-[var(--border)]">
          {YEAR_TICKS.map((y) => (
            <span
              key={y}
              data-year-tick="limits"
              className={`absolute -translate-x-1/2 pt-1 text-[12px] ${
                y === 0
                  ? 'font-semibold text-[var(--text-primary)]'
                  : 'font-[family-name:var(--font-mono)] text-[var(--text-secondary)]'
              }`}
              style={{ left: `${xOf(y)}%` }}
            >
              {y === 0 ? 'today' : `${Math.abs(y)} yrs ago`}
            </span>
          ))}
        </div>
      </div>
    </Figure>
  );
}
