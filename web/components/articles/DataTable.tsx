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
  /**
   * A CSS width for this column, e.g. `'27%'`.
   *
   * ⚠️ **Only for tables a reader is meant to compare with each other.** A
   * browser sizes columns to their content, which is right for a table read on
   * its own and wrong for two stacked tables the prose calls "the same scale":
   * the article's bank and miner tables had their Typical fall columns **43.6px
   * apart**, because "Mineral Resources — median" is longer than "Bendigo &
   * Adelaide". Nothing about that looks like a defect — each table is
   * individually perfect — and the eye simply cannot run down the two columns.
   *
   * Setting a width on any column switches the table to `table-layout: fixed`,
   * so give every column one or the remainder is shared arbitrarily.
   */
  readonly width?: string;
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
  minWidth,
  wrapHeaders,
}: {
  /** Rendered as the table's accessible name. Never decorative. */
  caption: string;
  columns: readonly DataColumn[];
  rows: readonly DataRow[];
  /**
   * The narrowest the table may be squeezed before the wrapper scrolls instead.
   *
   * Only meaningful with column widths: percentages shrink forever, and a
   * header that cannot wrap (`.art-table thead th` is `nowrap`) then overflows
   * its own cell. Measured for the bank/miner pair — the longest name is 186px,
   * the widest header 117px, so 440px is the point below which something has to
   * give.
   */
  minWidth?: string;
  /**
   * Let the column headers wrap onto a second line.
   *
   * ⚠️ **Not a style preference — it is what keeps a five-column table on the
   * screen.** Headers are `nowrap` by default, which is right for the two- and
   * three-column tables and is exactly what pushed the ranked tables in the
   * three "furthest below their own highs" articles to 689px inside a 614px
   * reading column. The table then scrolled sideways on a full desktop, on the
   * one table each of those pieces exists to show.
   *
   * The alternative was to shorten the headers, which loses the words the piece
   * was approved with. This costs one line of height and nothing else. Body
   * cells never wrap: a percentage split across two lines is unreadable, which
   * is why `.art-num` keeps its own `nowrap`.
   */
  wrapHeaders?: boolean;
}) {
  const fixed = columns.some((c) => c.width);
  const cls = [
    'art-table',
    fixed ? 'art-table--fixed' : '',
    wrapHeaders ? 'art-table--wrapth' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="art-tablewrap">
      <table className={cls} style={minWidth ? { minWidth } : undefined}>
        <caption className="art-table-cap">{caption}</caption>
        {fixed && (
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
        )}
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
