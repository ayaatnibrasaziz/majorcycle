import {
  compositionRamp,
  healthColor,
  healthRatingLabel,
  scoreColor,
  tierFromLabel,
  valuationAppealLabel,
} from '@/lib/ratings';
import { mag7Rows, signed1, type Mag7Row, type Mag7Snapshot } from '@/lib/mag7';

/**
 * The worked screener run, as a still photograph.
 *
 * ⚠️ Deliberately NOT `components/results/ResultsTable.tsx`, and the reason is
 * worth stating because "reuse the component" is the usual right answer. That one
 * is sortable, its rows are links into `/stocks/…` (gated — every click from here
 * would bounce a stranger to a sign-in form), its tier badge is a filter BUTTON,
 * and it is typed against the screener's full `ResultRow`, which carries thirty-odd
 * fields this snapshot has no business holding.
 *
 * What IS reused is everything that decides how it looks: `.results-table`,
 * `.score-stack`, `.score-row`, `.score-num`, `.micro-bar` and `.tier-badge` from
 * globals.css, and `scoreColor` / `compositionRamp` / `tierFromLabel` from
 * lib/ratings.ts. A reader who signs up meets the same table.
 *
 * ⚠️ **Overall and Rating Tier are ONE column**, because that is what the product
 * does — `OverallCell` renders the score chip, the tier badge and the 40/35/25
 * composition micro-bar in a single cell, and "Rating Tier" is a separate optional
 * column that the default view does not show. The first version of this table split
 * them into two, which advertised a layout the product does not have.
 */

/** The product's Overall cell, minus the parts that need a live run. */
function OverallCell({ row }: { row: Mag7Row }) {
  // ⚠️ NOT re-derived here. `ratingComposition` is the one definition of the
  // 40/35/25 split; recomputing it from the rounded total would be a second
  // implementation free to disagree with the first (CLAUDE.md 11c iii). It needs
  // all three parts, which is why the generator publishes `cyclePayoffScore`.
  const health = row.healthScore * 0.4;
  const valuation = row.valuationScore * 0.35;
  const payoff = row.cyclePayoffScore * 0.25;
  const total = health + valuation + payoff || 1;
  const ramp = compositionRamp(row.overallRating);

  return (
    <div className="score-stack">
      <div className="score-row">
        <span className="score-num" style={{ background: scoreColor(row.overallRating) }}>
          {row.overallRating}
        </span>
        <span className={`tier-badge tier-badge--${tierFromLabel(row.overallLabel)}`}>
          {row.overallLabel}
        </span>
      </div>
      <div
        className="micro-bar"
        title={`Composition: Health ${Math.round(row.healthScore)} (40%) + Valuation ${Math.round(
          row.valuationScore,
        )} (35%) + Cycle Payoff ${Math.round(row.cyclePayoffScore)} (25%)`}
      >
        <div className="micro-seg" style={{ width: `${(health / total) * 100}%`, background: ramp[0] }} />
        <div className="micro-seg" style={{ width: `${(valuation / total) * 100}%`, background: ramp[1] }} />
        <div className="micro-seg" style={{ width: `${(payoff / total) * 100}%`, background: ramp[2] }} />
      </div>
    </div>
  );
}

export function Mag7Table({ snapshot }: { snapshot: Mag7Snapshot }) {
  const rows = mag7Rows(snapshot);

  return (
    // ⚠️ This carried `data-legacy-contrast` until 2026-08-22 — a marker excusing
    // every chip and tag below from the contrast guard, because they are painted by
    // the screener's own palette and three of the five tier colours could not hold
    // white text (Neutral at 2.38:1). It was the right call at the time: the owner
    // had asked the landing to match the live product exactly, so fixing it here
    // would have put two different colours on one score.
    //
    // The palette itself is fixed now, at its source, so the marker is GONE rather
    // than merely unused — and `e2e/contrast.spec.ts` asserts it cannot come back.
    // If a future surface needs excusing, that is a new defect and a new decision,
    // not an inheritance.
    <div className="results-table-wrap">
      <table className="results-table">
        <caption className="sr-only">
          A worked MajorCycle run over the seven largest US technology companies, ranked by
          Overall Rating, as at {snapshot.asOf}.
        </caption>
        <thead>
          {/* Two header rows — a tinted BAND row above the column row — because
              that is how the screener groups its columns. Dropping it here would
              make the landing page's table a different object from the one it is
              advertising. */}
          <tr>
            <th className="band band-identity" colSpan={2} scope="colgroup">
              Identity
            </th>
            <th className="band band-verdict" colSpan={3} scope="colgroup">
              MajorCycle Verdict
            </th>
            <th className="band band-growth" colSpan={4} scope="colgroup">
              Major Cycle
            </th>
          </tr>
          <tr>
            <th scope="col">Ticker</th>
            <th scope="col">Company</th>
            <th scope="col">Overall</th>
            <th scope="col">Health</th>
            <th scope="col">Valuation</th>
            <th className="text-right" scope="col">
              Current DD%
            </th>
            <th className="text-right" scope="col">
              Typical DD%
            </th>
            <th className="text-right" scope="col">
              Lower Bound%
            </th>
            <th className="text-right" scope="col">
              Pullbacks
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.ticker} className={i % 2 ? 'stripe' : ''}>
              <td className="ticker-cell">{r.ticker}</td>
              <td className="name-cell">{r.name}</td>
              <td>
                <OverallCell row={r} />
              </td>
              {/* ⚠️ Health takes `healthColor`, NOT `scoreColor`. Financial Health
                  has only THREE tiers (Healthy / Adequate / At Risk at 80 and 60)
                  against the rating ladder's five, so scoreColor would paint one
                  label several different shades — Tesla at 49.8 would come out
                  tier-4 orange here and tier-5 red in the product. Each chip also
                  carries its word, exactly as the screener's cell does. */}
              <td>
                <span className="score-cell">
                  <span className="score-num" style={{ background: healthColor(r.healthScore) }}>
                    {Math.round(r.healthScore)}
                  </span>
                  <span className="score-tag" style={{ color: healthColor(r.healthScore) }}>
                    {healthRatingLabel(r.healthScore)}
                  </span>
                </span>
              </td>
              <td>
                <span className="score-cell">
                  <span className="score-num" style={{ background: scoreColor(r.valuationScore) }}>
                    {Math.round(r.valuationScore)}
                  </span>
                  <span className="score-tag" style={{ color: scoreColor(r.valuationScore) }}>
                    {valuationAppealLabel(r.valuationScore)}
                  </span>
                </span>
              </td>
              {/* Current DD% carries NO colour, here or in the screener — owner
                  decision, 2026-09-02. It used to run green for a deeper dip, on
                  the reasoning that deeper is more cyclically favourable. That is
                  the argument this page makes in words, and it is exactly why the
                  colour had to go: the fall is a measured FACT, while whether a
                  given fall is good news is our Valuation score, which is the
                  paid product. Colouring the fact quietly published the verdict.
                  A red ramp was considered and rejected for the mirror-image
                  reason — it would have contradicted the analysis on the same
                  page. The reader is left to judge the number. */}
              <td className="text-right" style={{ fontWeight: 600 }}>
                {signed1(r.currentDrawdownPct)}
              </td>
              <td className="text-right">{signed1(r.typicalDrawdownPct)}</td>
              <td className="text-right">{signed1(r.lowerBoundPct)}</td>
              <td className="text-right">{r.pullbackEvents}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
