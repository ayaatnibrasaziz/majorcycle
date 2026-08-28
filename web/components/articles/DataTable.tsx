/**
 * A table for an article body.
 *
 * ⚠️ **THIS EXISTS BECAUSE `.reading` HAS NO TABLE RULES AT ALL.** The Learn
 * content module forbids `<table>` outright for that reason — an unstyled
 * browser table in the middle of a designed page, and an undefined class is
 * silence rather than an error. That rule was right for explainers, which do not
 * need tables. It is the wrong rule for this section, where an article's whole
 * job is to report a measurement and a column of figures is the clearest way to
 * do it. So the answer is to define the styles once, here, rather than to let
 * each article invent them.
 *
 * ⚠️ **A NUMERIC COLUMN IS DECLARED, NOT DETECTED.** Marking a column `numeric`
 * sets it in the mono face with `tabular-nums` and right-aligns it, which is what
 * makes a column of percentages readable down the page. Sniffing the content for
 * digits instead would work until an article printed "60" as a company count in
 * a text column, and the failure would be a subtly misaligned table nobody files
 * a bug about.
 *
 * ⚠️ **The wrapper scrolls, the page never does.** A five-column table at 375px
 * is wider than the reading column, and a table that widens its own page pushes
 * every paragraph sideways — the one layout failure a reader cannot work around.
 */

export interface DataColumn {
  readonly key: string;
  readonly label: string;
  /** Mono, tabular figures, right-aligned. See the warning above. */
  readonly numeric?: boolean;
}

export interface DataRow {
  readonly cells: Readonly<Record<string, string>>;
  /**
   * Draw this row as the one the surrounding prose is about — the median, the
   * total, the company being singled out.
   *
   * Weight and colour only. Never a background tint: the tables sit inside a
   * card that already has a ground, and a second one reads as a selected row.
   */
  readonly emphasis?: boolean;
}

export function DataTable({
  caption,
  columns,
  rows,
}: {
  /** Rendered as the table's accessible name. Never decorative. */
  caption: string;
  columns: readonly DataColumn[];
  rows: readonly DataRow[];
}) {
  return (
    <div className="art-tablewrap">
      <table className="art-table">
        <caption className="art-table-cap">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? 'art-num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.emphasis ? 'art-tr-em' : undefined}>
              {columns.map((c, j) =>
                j === 0 ? (
                  <th key={c.key} scope="row">
                    {r.cells[c.key] ?? ''}
                  </th>
                ) : (
                  <td key={c.key} className={c.numeric ? 'art-num' : undefined}>
                    {r.cells[c.key] ?? ''}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
