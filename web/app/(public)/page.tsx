import type { Metadata } from 'next';
import Link from 'next/link';

import { pageMetadata } from '@/lib/seo';
import { PageFrame } from '@/components/PageFrame';
import { CycleDiagram } from '@/components/CycleDiagram';
import { LANDING, depth, price } from '@/lib/landing';

export const metadata: Metadata = pageMetadata({
  path: '/',
  title: 'Where a stock sits in its own cycle',
  description:
    'MajorCycle measures how far a US, Australian or Canadian stock has fallen against how far it usually falls, alongside financial health and valuation. Educational analysis, not financial advice.',
});

/**
 * The front door.
 *
 * Until Layer G this route was `redirect('/stocks')`, so every brand search and
 * every logo click on every public page ended at a login form. A signed-IN reader
 * still goes to the app — `/` is in SIGNED_OUT_ONLY_PATHS, the one list that owns
 * that rule (11c).
 *
 * ── The one idea it is built around ──────────────────────────────────────────
 *
 * Demonstrate before naming (owner decision). The hero states a fact about a real
 * company in words anyone can read — Apple has fallen this much, it usually falls
 * that much — and only afterwards says that the gap between those two numbers is
 * what we call a Major Cycle. Leading with the term would ask a newcomer to learn
 * vocabulary before they have seen why it matters.
 *
 * The page is LAYERED rather than averaged, because the buyer is both a newcomer
 * and someone experienced: the hero needs no vocabulary at all, and each section
 * below it carries more substance than the one above.
 *
 * Figures are real and refresh nightly, from `lib/landing.ts`. Apple is FIXED, not
 * rotating: a rotating example means the page a reader shares is not the page
 * their friend opens.
 */
export default function LandingPage() {
  const s = LANDING;
  const asOf = new Date(s.asOf).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <PageFrame width="wide">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-6 pb-14 sm:pt-10 sm:pb-20">
        <p className="micro text-[var(--brand-mid)]">US · Australia · Canada</p>

        <h1 className="mt-4 max-w-[19ch] text-[clamp(34px,6.2vw,var(--rd-display))] leading-[1.06] tracking-[-1.6px]">
          Every stock falls.{' '}
          <span className="text-[var(--brand-mid)]">
            Some are further down than usual.
          </span>
        </h1>

        <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center">
          <div>
            <p className="lead max-w-[54ch]">
              Right now {s.name} trades at{' '}
              <span className="num">{price(s.price, s.currency)}</span> —{' '}
              <strong>{depth(s.currentDrawdownPct)} below its recent high</strong>.
              Over its history it has typically fallen{' '}
              <strong>{depth(s.typicalDrawdownPct)}</strong> before turning.
            </p>
            <p className="mt-5 max-w-[54ch]">
              That gap — how far a stock has fallen against how far it{' '}
              <em>usually</em> falls — is what we call its <strong>Major Cycle</strong>.
              MajorCycle measures it for every stock it covers, and pairs it with the
              health of the underlying business.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-[var(--radius)] bg-[var(--brand-mid)] px-6 py-3 font-semibold text-white no-underline shadow-[0_2px_10px_rgba(30,92,179,.28)] hover:bg-[var(--brand-bright)] transition-colors"
              >
                Create a free account →
              </Link>
              <Link href="/methodology" className="font-semibold">
                See how it works
              </Link>
            </div>
            <p className="small mt-4 text-[var(--text-secondary)]">
              Free account, no card. A 7-day trial starts only if you choose a plan.
            </p>
          </div>

          {/* The live figure, as the product frames it. Free-tier fields only —
              there is deliberately no rating or score anywhere on this page. */}
          <aside className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-md)]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-[family-name:var(--font-mono)] text-[20px] font-bold text-[var(--text-primary)]">
                {s.ticker}
              </span>
              <span className="small text-[var(--text-secondary)]">{s.name}</span>
            </div>

            <dl className="mt-5 flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-4">
                <dt className="small text-[var(--text-secondary)]">Down from its high</dt>
                <dd className="font-[family-name:var(--font-mono)] text-[26px] font-bold leading-none text-[var(--text-primary)]">
                  {depth(s.currentDrawdownPct)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="small text-[var(--text-secondary)]">
                  Its usual fall
                  {/* Not --text-muted: 2.97:1 on this card. Caught by
                      e2e/contrast.spec.ts within minutes of writing it, which is
                      the argument for the guard existing at all — the token is
                      the obvious reach for "smaller and lighter", every time. */}
                  <span className="block">
                    across {s.pullbackEvents.toLocaleString('en-AU')} pullbacks
                  </span>
                </dt>
                <dd className="font-[family-name:var(--font-mono)] text-[26px] font-bold leading-none text-[var(--brand-mid)]">
                  {depth(s.typicalDrawdownPct)}
                </dd>
              </div>
            </dl>

            <p className="small mt-5 border-t border-[var(--border)] pt-4 text-[var(--text-secondary)]">
              Real figures, updated nightly. Close of {asOf}, in {s.currency}.
            </p>
          </aside>
        </div>

        {/* Disclaimer above the fold — CLAUDE.md #4/#12/#24. */}
        <p className="small mt-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-stripe)] px-5 py-4">
          <strong>Information only — not financial advice.</strong> MajorCycle is an
          educational analysis tool. It does not know your circumstances, and nothing
          here is a recommendation to buy, hold or sell.
        </p>
      </section>

      {/* ── Show the shape ───────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] py-14 sm:py-20">
        <h2>A stock&apos;s falls have a shape of their own</h2>
        <p className="lead mt-4 max-w-[62ch]">
          Most established companies don&apos;t move in a straight line. They fall and
          recover, and the depth of those falls tends to repeat. Comparing today against
          a stock&apos;s <em>own</em> history says more than comparing it against the
          market.
        </p>
        <CycleDiagram />
      </section>

      {/* ── The substance, for the reader who wants it ───────────────────── */}
      <section className="border-t border-[var(--border)] py-14 sm:py-20">
        <h2>What you actually get</h2>
        <div className="mt-9 grid gap-8 sm:grid-cols-3">
          {[
            {
              h: 'The cycle, for any stock',
              p: 'Price history, the drawdown overlay and the cycle bands for every stock we cover — free on a signed-in account, no card.',
            },
            {
              h: 'The business underneath',
              p: 'Profitability, balance sheet, growth, cash flow and dividends, from company filings — so a stock that is cheap because it is struggling cannot look like a bargain.',
            },
            {
              h: 'Hundreds at once',
              p: 'Screen a whole index against its own cycles, rank and filter the results, and take them away as a spreadsheet or a written report.',
            },
          ].map((c) => (
            <div key={c.h}>
              <h3>{c.h}</h3>
              <p className="mt-3">{c.p}</p>
            </div>
          ))}
        </div>
        <p className="small mt-9 text-[var(--text-secondary)]">
          The data is free; our analysis is the paid part. Ratings, scores, the
          downloadable report and the screener need a subscription — everything else
          works on a free account.
        </p>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] py-14 sm:py-20">
        <h2 className="max-w-[20ch]">Start with the stock you already own</h2>
        <p className="lead mt-4 max-w-[58ch]">
          Look up where it sits in its own cycle, and what its accounts look like
          underneath. It takes a minute and costs nothing.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-[var(--radius)] bg-[var(--brand-mid)] px-6 py-3 font-semibold text-white no-underline shadow-[0_2px_10px_rgba(30,92,179,.28)] hover:bg-[var(--brand-bright)] transition-colors"
          >
            Create a free account →
          </Link>
          <Link href="/pricing" className="font-semibold">
            See pricing
          </Link>
        </div>
      </section>
    </PageFrame>
  );
}
