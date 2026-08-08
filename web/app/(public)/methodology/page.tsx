import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { PageFrame } from '@/components/PageFrame';
import { CycleDiagram } from '@/components/CycleDiagram';

export const metadata: Metadata = pageMetadata({
  path: '/methodology',
  title: 'How MajorCycle Works',
  description:
    'A plain-English overview of the Major Cycle analysis: cycle position, financial health, valuation, and the overall rating — educational information only, not financial advice.',
});

/**
 * The five compliant rating tiers (design-system §4 / CLAUDE.md #16).
 *
 * `tier` is the badge modifier, so this legend renders the SAME component the
 * reader will meet in the product. It used to paint white on the solid tier
 * fill, which measured 2.38:1 on --c-tier-3 (design-system §14) — the product's
 * entire vocabulary set in the least readable text on the page.
 */
const TIERS = [
  { tier: 1, range: '80–100', label: 'High Conviction', color: 'var(--c-tier-1)' },
  { tier: 2, range: '65–79', label: 'Constructive', color: 'var(--c-tier-2)' },
  { tier: 3, range: '50–64', label: 'Neutral', color: 'var(--c-tier-3)' },
  { tier: 4, range: '35–49', label: 'Cautious', color: 'var(--c-tier-4)' },
  { tier: 5, range: '0–34', label: 'Bearish', color: 'var(--c-tier-5)' },
] as const;

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-baseline gap-3">
        <span
          className="w-[4px] h-[20px] rounded-[2px] bg-[var(--brand-mid)] flex-shrink-0 translate-y-[2px]"
          aria-hidden="true"
        />
        {heading}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Public, pre-sign-up methodology explainer — the plain-English counterpart to the
 * in-app MethodologyModal (which shows the actual formulas behind the paywall).
 * NO formulas here: it tells a first-time visitor what the analysis means and,
 * crucially, what it is not (CLAUDE.md #24). Disclaimer sits above the fold.
 */
export default function MethodologyPage() {
  return (
    <PageFrame width="prose">
      <article className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] shadow-[0_24px_60px_-12px_rgba(15,25,35,0.12),0_8px_24px_-8px_rgba(15,25,35,0.08)] overflow-hidden">
        <div className="px-7 py-9 sm:px-12 sm:py-12">
          <p className="micro text-[var(--brand-mid)]">The method</p>
          <h1 className="mt-3">How MajorCycle works</h1>
          <p className="lead mt-5">
            MajorCycle studies where a stock sits in its own history of falls and
            recoveries — its <em>Major Cycle</em> — and pairs that with the health of
            the underlying business. Here is what each part means, in plain English.
          </p>

          {/* Disclaimer — above the fold, per CLAUDE.md #4/#12/#24 */}
          <div className="mt-7 bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[var(--radius)] px-5 py-4">
            <p className="small">
              <strong>Information only — not financial advice.</strong>{' '}
              Everything below is educational. Scores and ratings are algorithmic
              summaries, not recommendations to buy, hold, or sell.
            </p>
          </div>

          <div className="mt-11 flex flex-col gap-10">
            {/* Demonstrate, then name. The picture comes BEFORE the paragraph
                that introduces the term, so a reader meets the idea with no
                vocabulary and then gets the word for what they just saw. */}
            <Section heading="The Major Cycle">
              <p>
                Most established stocks don&apos;t move in a straight line — they fall
                and recover in repeating patterns.
              </p>
              <CycleDiagram />
              <p>
                That repeating shape is what we call a stock&apos;s{' '}
                <strong>Major Cycle</strong>. MajorCycle measures how deep the current
                pullback is compared with the stock&apos;s <em>own</em> typical
                historical drawdown, and how those dips have tended to recover.
              </p>
            </Section>

            <Section heading="Cycle Position">
              <p>
                Shows where today&apos;s price sits versus the stock&apos;s usual
                drawdown, as a simple zone —{' '}
                <strong>Deep Value · Value · Fair · Stretched</strong>. A
                deeper-than-usual pullback lands in the value zones; a price near its
                highs lands in stretched. It describes <em>position</em>, not a
                prediction.
              </p>
            </Section>

            <Section heading="Financial Health Score">
              <p>
                A 0–100 measure of the business itself, blended from five pillars:
                profitability, balance sheet, growth, cash flow, and shareholder
                returns. When a company&apos;s accounts don&apos;t provide enough data
                (some banks and REITs, for example), we{' '}
                <strong>withhold the score rather than guess</strong> — you&apos;ll see
                &ldquo;Not enough data&rdquo; instead of a made-up number.
              </p>
            </Section>

            <Section heading="Valuation">
              <p>
                Combines the cycle position with company quality, so a stock that is
                cheap <em>because</em>{' '}the business is weak can&apos;t masquerade as a
                bargain. The zone label always reflects the real price position; the
                score behind the rating is quality-adjusted.
              </p>
            </Section>

            <Section heading="Overall Rating">
              <p>
                A single 0–100 score that blends financial health, valuation, and{' '}
                <strong>Cycle Payoff</strong>
                {' — '}
                how reliable the stock&apos;s historical cycle has been, and what it has
                paid off relative to the risk taken. Mapped to one of five labels:
              </p>

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

              <p className="mt-6">
                We deliberately avoid &ldquo;Buy&rdquo; and &ldquo;Sell&rdquo; language.
                Where a Wall Street analyst consensus is shown, it is third-party data,
                displayed as-is — not MajorCycle&apos;s view.
              </p>
            </Section>

            <Section heading="What MajorCycle is not">
              <p>
                It is <strong>not financial advice</strong> and does not know your goals
                or circumstances. Historical cycles are not a promise about the future —
                past performance does not indicate future results. Treat every score as
                a starting point for your own research, not a decision.
              </p>
            </Section>
          </div>

          <div className="mt-12 pt-7 border-t border-[var(--border)] flex flex-col items-start gap-5">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-[var(--radius)] bg-[var(--brand-mid)] px-6 py-3 font-semibold text-white no-underline shadow-[0_2px_10px_rgba(30,92,179,.28)] hover:bg-[var(--brand-bright)] transition-colors"
            >
              Create a free account →
            </Link>
            <Link href="/login" className="font-semibold no-underline">
              ← Back to sign in
            </Link>
            {/* --text-secondary (inherited from .reading), not --text-muted: muted
                measures 2.97:1 on a white card. It is fine for decoration and
                wrong for a sentence — design-system §14. */}
            <p className="small">
              Questions about how this works? Email{' '}
              <a href="mailto:support@majorcycle.com" className="font-semibold">
                support@majorcycle.com
              </a>{' '}
              or use our{' '}
              <Link href="/contact" className="font-semibold">
                contact form
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </PageFrame>
  );
}
