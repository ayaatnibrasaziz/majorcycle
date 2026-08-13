import type { Metadata } from 'next';
import Link from 'next/link';

import { pageMetadata } from '@/lib/seo';
import { PageFrame } from '@/components/PageFrame';
import { CycleDiagram } from '@/components/CycleDiagram';
import { LANDING, depth, price } from '@/lib/landing';
import { HOW_IT_WORKS_HREF } from '@/lib/publicNav';

/**
 * The five compliant rating tiers (design-system §4 / CLAUDE.md #16).
 *
 * Moved here verbatim from `/methodology` when that page was folded into this
 * one. `tier` is the badge modifier, so the legend renders the SAME component a
 * reader meets inside the product — a re-coloured lookalike is how the white-on-
 * tier-3 failure (2.38:1) survived review in the first place.
 */
const TIERS = [
  { tier: 1, range: '80–100', label: 'High Conviction', color: 'var(--c-tier-1)' },
  { tier: 2, range: '65–79', label: 'Constructive', color: 'var(--c-tier-2)' },
  { tier: 3, range: '50–64', label: 'Neutral', color: 'var(--c-tier-3)' },
  { tier: 4, range: '35–49', label: 'Cautious', color: 'var(--c-tier-4)' },
  { tier: 5, range: '0–34', label: 'Bearish', color: 'var(--c-tier-5)' },
] as const;

/** The four derived measures, in the order the product presents them. */
const MEASURES = [
  {
    h: 'Cycle Position',
    p: 'Where today’s price sits against the stock’s usual drawdown, as a simple zone — Deep Value, Value, Fair or Stretched. A deeper-than-usual pullback lands in the value zones; a price near its highs lands in stretched. It describes position, not a prediction.',
  },
  {
    h: 'Financial Health Score',
    p: 'A 0–100 measure of the business itself, blended from five pillars: profitability, balance sheet, growth, cash flow and shareholder returns. Where a company’s accounts don’t provide enough to judge — some banks and REITs — we withhold the score rather than guess, and say so.',
  },
  {
    h: 'Valuation',
    p: 'Combines the cycle position with company quality, so a stock that is cheap because the business is weak cannot masquerade as a bargain. The zone label always reflects the real price position; the score behind the rating is quality-adjusted.',
  },
  {
    h: 'Overall Rating',
    p: 'A single 0–100 score blending financial health, valuation and Cycle Payoff — how reliable this stock’s historical cycle has been, and what it has paid off relative to the risk taken.',
  },
] as const;

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
              {/* The same constant the header and footer use, so the three can
                  never point at different explanations of the same thing (11c). */}
              <Link href={HOW_IT_WORKS_HREF} className="font-semibold">
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

      {/* ── How it works ─────────────────────────────────────────────────────
          This section IS the old `/methodology` page. That route is gone (308 →
          `#how-it-works`), because a separate explainer meant the front door had
          to sell the idea and then send the reader somewhere else to understand
          it — and the two pages had already begun saying it differently.

          `scroll-mt` is load-bearing, not decoration: the header is
          `position: sticky`, so an anchor jump without it lands the heading
          UNDERNEATH the header and the reader arrives at a section whose title
          they cannot see. Asserted in e2e/how-it-works.spec.ts. */}
      <section
        id="how-it-works"
        className="scroll-mt-[calc(var(--header-h)+24px)] border-t border-[var(--border)] py-14 sm:py-20"
      >
        <h2>How it works</h2>
        <p className="lead mt-4 max-w-[62ch]">
          Most established companies don&apos;t move in a straight line. They fall and
          recover, and the depth of those falls tends to repeat. Comparing today against
          a stock&apos;s <em>own</em> history says more than comparing it against the
          market.
        </p>
        <CycleDiagram />
        <p className="mt-8 max-w-[62ch]">
          That repeating shape is what we call a stock&apos;s{' '}
          <strong>Major Cycle</strong>. From it, and from the company&apos;s own
          filings, we derive four things.
        </p>

        <div className="mt-9 grid gap-8 sm:grid-cols-2">
          {MEASURES.map((m) => (
            <div key={m.h}>
              <h3>{m.h}</h3>
              <p className="mt-3">{m.p}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-[62ch]">
          The Overall Rating maps to one of five labels. We deliberately avoid
          &ldquo;Buy&rdquo; and &ldquo;Sell&rdquo; language — where a Wall Street
          analyst consensus appears in the product it is third-party data, shown
          as-is, and not MajorCycle&apos;s view.
        </p>

        {/* The product's entire vocabulary, rendered with the REAL badge component
            rather than a re-coloured copy — the same reason G2 fixed the contrast
            here (2.38 → 4.73:1) by rendering the real thing. Guarded by name and
            count in e2e/contrast.spec.ts, which followed this legend over from
            /methodology. */}
        <div className="tier-legend mt-6">
          {TIERS.map((t) => (
            <div
              key={t.label}
              className="tier-legend-row"
              style={{ '--tier': t.color } as React.CSSProperties}
            >
              <span className="tier-legend-swatch" aria-hidden="true" />
              <span className="tier-legend-range">{t.range}</span>
              <span>
                <span className={`tier-badge tier-badge--${t.tier}`}>{t.label}</span>
              </span>
            </div>
          ))}
        </div>

        <h3 className="mt-12">What MajorCycle is not</h3>
        <p className="mt-3 max-w-[62ch]">
          It is <strong>not financial advice</strong>, and it does not know your goals
          or circumstances. Historical cycles are not a promise about the future — past
          performance does not indicate future results. Treat every score as a starting
          point for your own research, not a decision.
        </p>
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
