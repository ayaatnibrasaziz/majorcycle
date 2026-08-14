import { scoreChipColor, tierFromLabel } from '@/lib/ratings';
import { mag7Rows, signed1, type Mag7Snapshot } from '@/lib/mag7';

/**
 * The worked screener run, as a still photograph.
 *
 * ⚠️ Deliberately NOT `components/results/ResultsTable.tsx`, and the reason is
 * worth stating because "reuse the component" is the usual right answer. That one
 * is sortable, its rows are links into `/stocks/…` (gated — every click from here
 * would bounce a stranger to a sign-in form), and it is typed against the
 * screener's full `ResultRow`, which carries thirty-odd fields this snapshot has
 * no business holding.
 *
 * What IS reused is the part that decides how it looks: `.results-table` and
 * `.tier-badge` from globals.css, and `scoreColor` / `tierFromLabel` from
 * lib/ratings.ts. So the colour of a chip and the shape of a badge have exactly
 * one definition, and this table cannot drift from the product's while looking
 * fine in review (CLAUDE.md 11c iii — share the FUNCTION, not the spec).
 */
export function Mag7Table({ snapshot }: { snapshot: Mag7Snapshot }) {
  const rows = mag7Rows(snapshot);

  return (
    <div className="results-table-wrap">
      <table className="results-table">
        <caption className="sr-only">
          A worked MajorCycle run over the seven largest US technology companies,
          ranked by Overall Rating, as at {snapshot.asOf}.
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
            <th className="band band-verdict" colSpan={4} scope="colgroup">
              MajorCycle Verdict
            </th>
            <th className="band band-growth" colSpan={4} scope="colgroup">
              Major Cycle
            </th>
          </tr>
          <tr>
            <th scope="col">Ticker</th>
            <th scope="col">Company</th>
            <th className="text-right" scope="col">
              Overall
            </th>
            <th scope="col">Rating Tier</th>
            <th className="text-right" scope="col">
              Health
            </th>
            <th className="text-right" scope="col">
              Valuation
            </th>
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
              <td className="text-right">
                <span className="score-num" style={{ background: scoreChipColor(r.overallRating) }}>
                  {r.overallRating}
                </span>
              </td>
              <td>
                <span className={`tier-badge tier-badge--${tierFromLabel(r.overallLabel)}`}>
                  {r.overallLabel}
                </span>
              </td>
              <td className="text-right">
                <span className="score-num" style={{ background: scoreChipColor(r.healthScore) }}>
                  {Math.round(r.healthScore)}
                </span>
              </td>
              <td className="text-right">
                <span className="score-num" style={{ background: scoreChipColor(r.valuationScore) }}>
                  {Math.round(r.valuationScore)}
                </span>
              </td>
              {/* The current fall is the one figure here a reader is meant to
                  react to, so it carries the tier-5 ink the product uses for a
                  drawdown. The three beside it are context, not signal. */}
              <td className="text-right" style={{ color: 'var(--c-tier-5-ink)' }}>
                {signed1(r.currentDrawdownPct)}
              </td>
              <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                {signed1(r.typicalDrawdownPct)}
              </td>
              <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                {signed1(r.lowerBoundPct)}
              </td>
              <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                {r.pullbackEvents}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
