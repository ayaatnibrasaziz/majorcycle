import { Figure, LegendItem } from '@/components/Figure';
import { healthColor, healthRatingLabel } from '@/lib/ratings';
import {
  AxisFrame,
  AxisLabels,
  Plot,
  Swatch,
  rx,
} from './chartPrimitives';
import {
  CHECKS,
  FALL,
  FALL_PCT,
  PLOT_FLOOR_Y,
  PRICE_TICKS,
  STEADY,
  STEADY_HEALTH,
  STRAINED,
  STRAINED_HEALTH,
  yOf,
  type Company,
} from './bargainGeometry';

/**
 * The one figure for "Is a falling share price a bargain or a warning?".
 *
 * ⚠️ **Both panels draw the same fall from the same array.** That is the
 * argument, not a shortcut: if the two curves differed at all, a reader checking
 * the claim "the chart looks identical either way" would find the picture
 * quietly disagreeing with the sentence above it.
 *
 * ⚠️ **The product's own three-tier health palette** (`healthColor` /
 * `healthRatingLabel` from `lib/ratings.ts`) — Healthy ≥ 80, Adequate ≥ 60, At
 * Risk below. Not `scoreColor`, which is the five-tier ramp for the Overall
 * Rating and would put a different number of colours on screen than the product
 * uses for exactly this measure (CLAUDE.md 11m).
 *
 * ⚠️ **No white-on-tier text anywhere.** The tier colours are used as bar fills
 * with the figures set in body ink beside them; three of the five are far too
 * light to sit behind white type, which is the defect 11l records.
 */

const LINE = '#1E5CB3'; // --brand-mid, the same price line the other figures use

function PricePanel({ company, health }: { company: Company; health: number }) {
  const points = FALL.map((p) => `${rx(p.x).toFixed(2)},${yOf(p.pct).toFixed(2)}`).join(' ');
  const tint = healthColor(health);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
          {company.name}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]">
          {FALL_PCT}%
        </span>
      </div>

      <Plot box="aspect-[16/11]" className="mt-2">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <AxisFrame floorY={PLOT_FLOOR_Y} />
          <polyline
            points={points}
            data-fall-path={company.name}
            fill="none"
            stroke={LINE}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <AxisLabels ticks={PRICE_TICKS} format={(v) => `$${v}`} />
      </Plot>

      {/* The five checks. HTML rather than SVG so the bars keep their corner
          radius and the labels stay 12px at every width. */}
      <ul className="figure-list mt-4 flex flex-col gap-[7px]" data-checks={company.name}>
        {CHECKS.map((chk) => {
          const value = company.scores[chk.key];
          return (
            <li key={chk.key} className="grid grid-cols-[1fr_auto] items-center gap-x-2">
              <span className="text-[12px] leading-tight text-[var(--text-secondary)]">
                {chk.label}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--text-secondary)]">
                {value}
              </span>
              <span className="col-span-2 h-[7px] w-full rounded-full bg-[var(--border)]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${value}%`, backgroundColor: healthColor(value) }}
                />
              </span>
            </li>
          );
        })}
      </ul>

      {/* ⚠️ `data-label-group` because this is a SENTENCE, not a layout. The
          overlap guard walks leaf elements, so the <strong> runs inside running
          prose read to it as two positioned labels sitting 2.9px apart — which is
          not a near-miss, it is the width of a space character. Stable at every
          width, so it never failed; but it sat 0.9px above a 2px bar, and the one
          thing that moves a space is font rendering, which is exactly what differs
          between this machine and CI (see the guard's own note about Linux
          glyphs). Declaring the line one group is the documented way to say "these
          touch on purpose". Found 2026-08-23 by sweeping the library for its
          tightest clearance rather than waiting for the next flake. */}
      <p
        data-label-group=""
        className="mt-3 border-t border-[var(--border)] pt-2 text-[13px] text-[var(--text-secondary)]"
        data-health={company.name}
      >
        Health of the business:{' '}
        <strong className="font-[family-name:var(--font-mono)] text-[var(--text-primary)]">
          {health.toFixed(0)}
        </strong>{' '}
        <span style={{ color: tint }}>●</span>{' '}
        <strong className="text-[var(--text-primary)]">{healthRatingLabel(health)}</strong>
      </p>
    </div>
  );
}

export function BargainFigure() {
  return (
    <Figure
      legend={
        <>
          <LegendItem swatch={<Swatch color={LINE} dashed={false} />}>
            The share price over one year — identical in both panels
          </LegendItem>
          <LegendItem
            swatch={
              <span
                className="block h-[7px] w-6 rounded-full"
                style={{ backgroundColor: 'var(--c-tier-1)' }}
              />
            }
          >
            Each bar is one of the five checks, scored out of 100
          </LegendItem>
        </>
      }
      caption={
        <>
          Two imaginary companies, both down {Math.abs(FALL_PCT)}% over the year.{' '}
          <strong>The price line is the same array of numbers drawn twice</strong> — there
          is nothing in either chart that separates them. The difference is entirely
          underneath: Company A scores{' '}
          {STEADY_HEALTH.toFixed(0)} on the five checks, Company B scores{' '}
          {STRAINED_HEALTH.toFixed(0)}. One fall is a business having a bad year; the
          other is a business getting worse. A chart cannot tell you which.
        </>
      }
    >
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-6">
        <PricePanel company={STEADY} health={STEADY_HEALTH} />
        <PricePanel company={STRAINED} health={STRAINED_HEALTH} />
      </div>
    </Figure>
  );
}
