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

export function DelistedNotice({ stock }: { stock: StockRecord }) {
  if (!shouldShowDelistedNotice(stock)) return null;

  const lastBar = frozenAsAtDate(stock);

  return (
    <div className="card card--stack-base" role="note" data-testid="delisted-notice">
      <div className="card-header">
        <div className="card-title">{stock.name ?? stock.ticker} no longer trades</div>
      </div>
      <div className="card-body text-[13px] leading-[1.6] text-[var(--text-secondary)]">
        <p>
          Three independent checks agree this listing has stopped trading: it returns no
          price from our data provider, and it is absent from both its exchange&rsquo;s
          directory and every index we track.
        </p>
        <p className="mt-2">
          {/* ⚠️ THE DATE IS THE POINT OF THE WHOLE COMPONENT, and the first version
              printed the WRONG ONE. It showed `inactiveSince` — the day our sweep
              NOTICED the listing was gone — under the words "every figure is frozen
              as at". On BK that read "frozen as at 2026-08-31" while the header two
              inches below said "Updated Jul 23" and the price was five weeks old.
              Both dates are real, they answer different questions, and the one a
              reader needs is when the DATA stops. Caught only by looking at the
              rendered page: the sentence was fluent, specific and wrong (11k).

              So this uses `updatedAt`, which is the same value StockHeader prints —
              one fact, one source, so the notice and the header cannot disagree. */}
          <strong className="text-[var(--text-primary)]">
            Every figure on this page is frozen
          </strong>
          {lastBar ? <> at our last update on {lastBar}</> : <> at our last update</>}.
          Nothing here is being updated, and the prices are not current. We keep the
          history because it cannot be re-fetched once a symbol is withdrawn.
        </p>
        {stock.inactiveSince && (
          <p className="mt-2">
            We marked this listing inactive on {stock.inactiveSince}, which is when our
            checks first agreed it had stopped trading &mdash; not the date it stopped.
          </p>
        )}
        <p className="mt-2">
          A company can stop trading for many reasons &mdash; it may have been acquired,
          taken private, renamed, or moved to another exchange. This page does not say
          which, and a ticker that has been renamed will have its history under the new
          symbol.
        </p>
      </div>
    </div>
  );
}
