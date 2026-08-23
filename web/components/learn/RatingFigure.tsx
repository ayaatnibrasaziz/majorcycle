import { Figure } from '@/components/Figure';
import {
  EXAMPLE,
  EXAMPLE_LABEL,
  EXAMPLE_TOTAL,
  RATING_PARTS,
  TIER_BANDS,
  WEIGHT_TOTAL,
} from './ratingGeometry';

/**
 * The one figure for "How to read a MajorCycle rating".
 *
 * Two halves of one idea: what the rating is **made of** (three parts at fixed
 * weights, shown as a worked sum), and what the number **is called** (five
 * bands with their real thresholds).
 *
 * ⚠️ Both halves are read from the product rather than drawn from memory — the
 * weights via `RATING_WEIGHTS`, the bands by walking `tierFromScore`. A figure
 * explaining a rating is the last place a stale threshold should be able to
 * survive (CLAUDE.md 11c-v).
 */

export function RatingFigure() {
  const rounded = Math.round(EXAMPLE_TOTAL);

  return (
    <Figure
      caption={
        <>
          The rating is a weighted average of three scores, and the label is
          whichever band the result lands in. In this worked example the three
          parts come to <strong>{rounded} out of 100</strong>, which is{' '}
          <strong>{EXAMPLE_LABEL}</strong>. Note how far the parts can sit from the
          total: a company can be strong on the business and middling on the price
          and still land in the middle band. The number is a summary, and the three
          rows above it are the actual reading.
        </>
      }
    >
      {/* ── What it is made of ─────────────────────────────────────────── */}
      <p className="text-[13px] font-semibold text-[var(--text-primary)]">
        What the rating is made of
      </p>
      <ul className="figure-list mt-3 flex flex-col gap-3" data-rating-parts>
        {RATING_PARTS.map((part) => {
          const score = EXAMPLE[part.key];
          return (
            /* One row is one label: a name, its weighting, the question it asks
               and its bar all describe the same pillar and are stacked by
               design. See `[data-label-group]` in `learn.spec.ts`. */
            <li key={part.key} data-label-group="">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {part.label}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]">
                  {score} × {part.weight}%
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">
                {part.asks}
              </p>
              <span className="mt-1.5 block h-[9px] w-full rounded-full bg-[var(--border)]">
                <span
                  className="block h-full rounded-full bg-[var(--brand-mid)]"
                  style={{ width: `${part.weight}%` }}
                  data-rating-weight={part.weight}
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
      >
        Weights add to {WEIGHT_TOTAL}%. This example totals{' '}
        <strong className="font-[family-name:var(--font-mono)] text-[var(--text-primary)]">
          {rounded}
        </strong>{' '}
        <span data-example-label className="font-semibold text-[var(--text-primary)]">
          {EXAMPLE_LABEL}
        </span>
        .
      </p>

      {/* ── What the number is called ──────────────────────────────────── */}
      <p className="mt-6 text-[13px] font-semibold text-[var(--text-primary)]">
        What the number is called
      </p>
      <ul className="figure-list mt-2 flex flex-col gap-1.5" data-tier-bands>
        {TIER_BANDS.map((band) => (
          <li key={band.label} className="flex items-center gap-3">
            <span
              className="block h-3 w-3 flex-shrink-0 rounded-[3px]"
              style={{ backgroundColor: band.color }}
              aria-hidden="true"
            />
            <span className="w-[128px] flex-shrink-0 text-[13px] font-semibold text-[var(--text-primary)]">
              {band.label}
            </span>
            <span
              className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
              data-band={band.label}
            >
              {band.from}–{band.to}
            </span>
          </li>
        ))}
      </ul>
    </Figure>
  );
}
