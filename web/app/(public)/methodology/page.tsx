import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How MajorCycle Works',
  description:
    'A plain-English overview of the Major Cycle analysis: cycle position, financial health, valuation, and the overall rating — educational information only, not financial advice.',
};

/** The five compliant rating tiers (design-system §4 / CLAUDE.md #16). */
const TIERS = [
  { range: '80–100', label: 'High Conviction', color: 'var(--c-tier-1)' },
  { range: '65–79', label: 'Constructive', color: 'var(--c-tier-2)' },
  { range: '50–64', label: 'Neutral', color: 'var(--c-tier-3)' },
  { range: '35–49', label: 'Cautious', color: 'var(--c-tier-4)' },
  { range: '0–34', label: 'Bearish', color: 'var(--c-tier-5)' },
] as const;

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-[13.5px] font-bold text-[var(--text-primary)] tracking-[-0.2px]">
        <span
          className="w-[3px] h-[14px] rounded-[2px] bg-[var(--brand-mid)] flex-shrink-0"
          aria-hidden="true"
        />
        {heading}
      </h2>
      <div className="mt-1.5 text-[13px] text-[var(--text-secondary)] leading-relaxed">
        {children}
      </div>
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
    <article className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] shadow-[0_24px_60px_-12px_rgba(15,25,35,0.12),0_8px_24px_-8px_rgba(15,25,35,0.08)] overflow-hidden">
      <div className="px-7 py-8 sm:px-9 sm:py-10">
        <h1 className="text-[22px] sm:text-[24px] font-bold text-[var(--text-primary)] tracking-[-0.4px] leading-[1.2]">
          How MajorCycle works
        </h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          MajorCycle studies where a stock sits in its own history of falls and
          recoveries — its <em>Major Cycle</em> — and pairs that with the health of
          the underlying business. Here is what each part means, in plain English.
        </p>

        {/* Disclaimer — above the fold, per CLAUDE.md #4/#12/#24 */}
        <div className="mt-4 bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3.5 py-2.5">
          <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">
            <strong className="text-[var(--text-secondary)]">Information only — not
            financial advice.</strong>{' '}
            Everything below is educational. Scores and ratings are algorithmic
            summaries, not recommendations to buy, hold, or sell.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <Section heading="The Major Cycle">
            <p>
              Most established stocks don&apos;t move in a straight line — they fall
              and recover in repeating patterns. MajorCycle measures how deep a
              stock&apos;s current pullback is compared with its <em>own</em> typical
              historical drawdown, and how those dips have tended to recover.
            </p>
          </Section>

          <Section heading="Cycle Position">
            <p>
              Shows where today&apos;s price sits versus the stock&apos;s usual
              drawdown, as a simple zone —{' '}
              <strong>Deep Value · Value · Fair · Stretched</strong>. A deeper-than-usual
              pullback lands in the value zones; a price near its highs lands in
              stretched. It describes <em>position</em>, not a prediction.
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
              A single 0–100 score that blends financial health, valuation, and the
              reliability of the stock&apos;s historical cycle, mapped to one of five
              labels:
            </p>
            <div className="grid grid-cols-5 gap-1.5 mt-3">
              {TIERS.map((t) => (
                <div
                  key={t.label}
                  className="flex flex-col items-center justify-start text-center px-0.5 py-2 rounded-[var(--radius-sm)] text-white"
                  style={{ background: t.color }}
                >
                  <div className="font-[var(--font-mono)] text-[10.5px] font-semibold mb-[3px] opacity-95">
                    {t.range}
                  </div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.1px] leading-[1.15] opacity-95 break-words hyphens-auto w-full">
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3">
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

        <div className="mt-8 pt-5 border-t border-[var(--border)] flex flex-col items-start gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--brand-mid)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(30,92,179,.25)] hover:bg-[var(--brand-bright)] transition-colors"
          >
            Start your free trial →
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-bright)] transition-colors"
          >
            ← Back to sign in
          </Link>
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            Questions about how this works? Email{' '}
            <a
              href="mailto:support@majorcycle.com"
              className="font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-bright)] transition-colors"
            >
              support@majorcycle.com
            </a>{' '}
            or use our{' '}
            <Link
              href="/contact"
              className="font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-bright)] transition-colors"
            >
              contact form
            </Link>
            .
          </p>
        </div>
      </div>
    </article>
  );
}
