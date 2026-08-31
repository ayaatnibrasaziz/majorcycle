import type { StockRecord } from '@/lib/types';

/**
 * "This company no longer trades" — shown above everything else on a retired
 * ticker's page, and in the downloadable report.
 *
 * ── The defect it closes (audit F-035, 2026-08-31) ──────────────────────────
 * `check_stale_tickers` retires a ticker when three independent sources agree it
 * has stopped trading. Its price history is kept on purpose — those bars cannot be
 * re-fetched from anywhere once the provider drops the symbol, and four delisted
 * tickers have already cost 30,784 rows that no longer exist in any copy we can
 * reach. So the row survives and stops being refreshed.
 *
 * Measured on the deployed preview the day the first five were retired:
 * `/stocks/us/BK` answered **200** with a full page and a **$157.13** price frozen
 * at its last trading day — chart, analysis, everything — presented identically to
 * a live stock, with no notice anywhere. A repo-wide grep found no UI string about
 * a company having stopped trading.
 *
 * ⚠️ **This is the owner's own rule pointed at a new surface** (CLAUDE.md 11aa):
 * *of two ways to be wrong, prefer the visible one.* A blank renders as a gap a
 * reader can see and an alarm can fire on; a stale number renders as a plausible
 * one that nobody can see and no guard can find. A frozen price with no notice is
 * the second kind.
 *
 * ⚠️ **Why a notice and not a 404.** Answering 404 would also be honest, and it
 * would throw away history a reader may legitimately want — the whole reason the
 * bars are kept. The notice keeps both: the data, and the truth about it.
 *
 * ── Two deliberate choices in how it looks ──────────────────────────────────
 * **No new colour.** The site has no warning token, and inventing one would put a
 * colour outside `check:tier-palette`'s reach on a page it already polices. This
 * reuses the established `role="note"` card — the same pattern as "Major Cycle —
 * not available at this horizon", which is the closest existing case: a card whose
 * job is to explain why the data is not what a reader expects. The words carry it.
 *
 * **It renders in the REPORT too**, not only on the page. The download is the
 * artifact that outlives the page and travels without it, so a reader opening it
 * offline in six months needs the same sentence. That also satisfies
 * `check:report-sections`, which requires the report to render a superset of the
 * page's analytical sections — the alternative was adding it to `PAGE_ONLY`, which
 * would have been the wrong answer to the right question.
 */
/**
 * Should this stock be announced as no longer trading?
 *
 * Exported so a credential-free Playwright spec can drive it — the component
 * itself cannot be asserted without a retired ticker in the live database, and
 * *which* tickers are retired is data that changes under the test.
 *
 * ⚠️ **The default is the whole safety question, and it points at ACTIVE.** Only an
 * explicit `false` announces a delisting. A row written before the column existed,
 * a read that dropped the field, or a shape change all yield `undefined` — and
 * telling a customer that a healthy company has stopped trading is far worse than
 * failing to tell them about a real one. Same direction as `daily_refresh`,
 * `check_field_units` and every other consumer of `is_active`.
 */
export function shouldShowDelistedNotice(
  stock: Pick<StockRecord, 'isActive'> | null | undefined,
): boolean {
  return stock?.isActive === false;
}

/**
 * The date to print after "every figure on this page is frozen".
 *
 * ⚠️ **Exported only so the one defect this component has already had can be
 * guarded.** The first version printed `inactiveSince` here — the day the sweep
 * NOTICED the listing was gone. On BK that rendered "frozen as at 2026-08-31" two
 * inches above a header reading "Updated Jul 23", with a five-week-old price
 * between them. Both dates are real and they answer different questions; the one a
 * reader needs is when the DATA stopped, which is `updatedAt` — the same value
 * `StockHeader` prints, so the two lines cannot disagree (11c: one fact, one
 * source).
 *
 * It was caught by looking at the rendered page, not by review: the sentence was
 * fluent, specific, and wrong.
 */
export function frozenAsAtDate(
  stock: Pick<StockRecord, 'updatedAt'> | null | undefined,
): string | null {
  return stock?.updatedAt?.slice(0, 10) ?? null;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * `2026-07-23` -> `23 Jul 2026`.
 *
 * ⚠️ Formatted from the STRING, never through `new Date()`. `new Date('2026-07-23')`
 * is parsed as UTC midnight, so anywhere west of Greenwich it formats as the 22nd —
 * the same class of off-by-one-day defect that stored every ASX bar a day early
 * (CLAUDE.md 14a). There is no timezone in a date this precise, so none is applied.
 */
export function formatFrozenDate(iso: string | null): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : null;
}

export function DelistedNotice({ stock }: { stock: StockRecord }) {
  if (!shouldShowDelistedNotice(stock)) return null;

  const frozen = formatFrozenDate(frozenAsAtDate(stock));

  /**
   * ⚠️ ONE SENTENCE, by owner decision 2026-08-31 — and the first version had four
   * paragraphs. Owner: *"I still feel it is way too much."*
   *
   * Everything cut was us explaining OURSELVES rather than telling the reader
   * anything they need: how the three-source test works, the date our sweep noticed,
   * why we keep the history, the ways a company can stop trading. All true, none of
   * it load-bearing. A reader needs two facts — this is dead, and the numbers below
   * are old, from this date — and every extra line makes those two harder to find.
   */
  return (
    <div className="card card--stack-base" role="note" data-testid="delisted-notice">
      <div className="card-header">
        <div className="card-title">{stock.name ?? stock.ticker} no longer trades</div>
      </div>
      <div className="card-body">
        <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">Every figure below is frozen</strong>
          {frozen ? <> at {frozen}</> : null} and is not current.
        </p>
      </div>
    </div>
  );
}
