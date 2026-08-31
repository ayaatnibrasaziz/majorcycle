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
 * ── How it looks, and who decided ───────────────────────────────────────────
 * **A slim RED banner, by owner decision 2026-08-31.** My first build was a full
 * card in the neutral `role="note"` style, on the argument that the site owns no
 * warning colour and inventing one would put a hue outside `check:tier-palette`'s
 * reach. The owner looked at it and said *"I don't like how it looks, can't you
 * just make it a notice in red?"*, then sent the checkout-cancelled banner from
 * `/account` as the shape they wanted.
 *
 * ⚠️ **That reference answered the objection instead of overriding it.** The banner
 * in `SubscriptionCard` is already built from the RATING TIER tokens — tier 3, the
 * neutral amber — used purely as a UI tint with no rating meaning. So the red here
 * is `--c-tier-5-ink` / `--tint-tier-5`, the same established set one hue over: no
 * new colour, no literal hex, nothing the palette guard cannot see, and a shape the
 * product already uses for exactly this job. Measured before it was written:
 * **8.06:1** on a white card and **7.32:1** on the page ground, against a 4.5 floor
 * — a margin rather than a boundary (11l).
 *
 * ⚠️ **`role="note"`, NOT `role="alert"`** — the one place this departs from the
 * banner it copies. `alert` is an ARIA live region for messages that ARRIVE; this
 * is static page content present on first paint, and announcing it as an
 * interruption is a misuse that also makes the page noisier for a screen-reader
 * user on every visit.
 *
 * ⚠️ **The icon is an inline SVG, not `lucide-react`.** No component the REPORT
 * renders imports lucide today — the four that do are all page-only — so importing
 * it here would pull that library into the esbuild bundle for the first time. That
 * bundle rendered a blank page for every stock for four days when `next/link`
 * arrived through a component three imports away (11d), and six lines of SVG buys
 * the same picture with none of that risk.
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
    <div
      role="note"
      data-testid="delisted-notice"
      className="flex items-start gap-2 text-[12px] text-[var(--c-tier-5-ink)] bg-[var(--tint-tier-5)] border border-[var(--tint-tier-5-strong)] rounded-[var(--radius-sm)] px-3 py-2.5"
    >
      {/* Inline, not lucide — see the note at the top of this file on the report
          bundle. Same glyph as the banner this copies: ring, stem, dot. */}
      <svg
        className="w-4 h-4 flex-shrink-0 mt-px"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="leading-relaxed">
        <strong>{stock.name ?? stock.ticker} no longer trades.</strong> Every figure
        below is frozen{frozen ? <> at {frozen}</> : null} and is not current.
      </span>
    </div>
  );
}
