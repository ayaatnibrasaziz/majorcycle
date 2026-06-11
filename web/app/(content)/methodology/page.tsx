import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Methodology · MajorCycle',
  description:
    'How the Major Cycle analysis works, in plain language — the Overall Rating, Financial Health, Valuation, and Cycle Payoff, plus the honest limits of a heuristic.',
};

/** A locked rating tier, for the bands table. */
const TIERS = [
  { range: '80–100', label: 'High Conviction', token: 'var(--c-tier-1)' },
  { range: '65–79', label: 'Constructive', token: 'var(--c-tier-2)' },
  { range: '50–64', label: 'Neutral', token: 'var(--c-tier-3)' },
  { range: '35–49', label: 'Cautious', token: 'var(--c-tier-4)' },
  { range: '0–34', label: 'Bearish', token: 'var(--c-tier-5)' },
] as const;

/** A scoring preset (decision #15). */
const PRESETS = [
  { name: 'Short', window: '63 trading days (~3 months)', trigger: '−3%' },
  { name: 'Medium', window: '252 trading days (~1 year)', trigger: '−5%' },
  { name: 'Long', window: '756 trading days (~3 years)', trigger: '−8%' },
  { name: 'Custom', window: 'Your own window', trigger: 'Your own trigger' },
] as const;

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-[18px] font-bold text-[var(--text-primary)] tracking-[-0.2px] mb-3"
    >
      {children}
    </h2>
  );
}

export default function MethodologyPage() {
  return (
    <article className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
      {/* Page title */}
      <header className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--brand-mid)] mb-2">
          How it works
        </p>
        <h1 className="text-[26px] font-bold text-[var(--text-primary)] tracking-[-0.5px] leading-tight">
          The Major Cycle methodology
        </h1>
      </header>

      {/* Top compliance banner — §15 mandatory */}
      <div className="mb-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-stripe)] px-4 py-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
        <strong className="text-[var(--text-secondary)]">Information only — not financial advice.</strong>{' '}
        Everything below is a heuristic re-weighting of public price history and
        fundamentals. It is not a backtested trading edge, and the labels are
        algorithmic summaries, not recommendations. Past performance does not
        indicate future results. Always conduct your own research.
      </div>

      {/* 1. What MajorCycle does */}
      <section className="mb-9">
        <SectionHeading id="overview">What MajorCycle does</SectionHeading>
        <p className="mb-3">
          Every stock has a rhythm of falling and recovering. MajorCycle measures
          where a stock sits <strong>today</strong> inside its own historical
          drawdown-and-recovery cycle, combines that with a read on the company&apos;s
          financial health and how favourably it has rebounded in the past, and
          rolls it into a single 0–100 rating.
        </p>
        <p>
          It is a lens for <strong>where to look</strong> — not a verdict on what
          to do.
        </p>
      </section>

      {/* 2. The Overall Rating */}
      <section className="mb-9">
        <SectionHeading id="overall-rating">The Overall Rating</SectionHeading>
        <p className="mb-4">
          The headline 0–100 score is a weighted blend of three parts:
        </p>
        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 font-[var(--font-mono)] text-[12.5px] text-[var(--text-primary)]">
          Overall = 40% Financial Health + 35% Valuation + 25% Cycle Payoff
        </div>
        <p className="mb-4">
          That score maps to one of five neutral, advice-free labels:
        </p>
        <ul className="space-y-1.5">
          {TIERS.map((t) => (
            <li key={t.label} className="flex items-center gap-3">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: t.token }}
                aria-hidden="true"
              />
              <span className="font-[var(--font-mono)] text-[12px] text-[var(--text-muted)] w-[58px] tabular-nums">
                {t.range}
              </span>
              <span className="font-semibold" style={{ color: t.token }}>
                {t.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Financial Health */}
      <section className="mb-9">
        <SectionHeading id="financial-health">Financial Health — 40%</SectionHeading>
        <p className="mb-3">
          A 0–100 read on the business itself, built from five pillars, each
          scored on transparent thresholds:
        </p>
        <ul className="mb-4 space-y-1 pl-4 list-disc marker:text-[var(--brand-bright)]">
          <li><strong>Profitability</strong> — 30%</li>
          <li><strong>Balance Sheet</strong> — 25%</li>
          <li><strong>Growth</strong> — 20%</li>
          <li><strong>Cash Flow</strong> — 15%</li>
          <li><strong>Shareholder Returns</strong> — 10%</li>
        </ul>
        <p className="mb-3">
          <strong>We never invent a middle score.</strong> If we don&apos;t have the
          data for a pillar, we leave it out and re-weight the rest. If fewer than
          three of the five pillars have data, we withhold Financial Health
          entirely and say <em>&ldquo;Not enough data&rdquo;</em> rather than guess.
        </p>
        <p>
          This is why some businesses — banks and REITs in particular — can show
          &ldquo;insufficient data&rdquo;: their accounts don&apos;t fit the standard
          template, so we&apos;d rather withhold than mislead (
          <a href="#limitations" className="text-[var(--brand-mid)] underline underline-offset-2 hover:text-[var(--brand-bright)]">
            see Limitations
          </a>
          ).
        </p>
      </section>

      {/* 4. Valuation */}
      <section className="mb-9">
        <SectionHeading id="valuation">Valuation — 35%</SectionHeading>
        <p className="mb-3">
          This starts as <strong>cycle position</strong>: how deep today&apos;s
          drawdown is versus the stock&apos;s <em>typical</em> drawdown. The deeper
          the dip, the cheaper it reads — shown as a zone:
        </p>
        <div className="mb-4 flex flex-wrap gap-2 text-[12px] font-semibold">
          {['Deep Value', 'Value', 'Fair', 'Stretched'].map((z) => (
            <span
              key={z}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-stripe)] px-2.5 py-1 text-[var(--text-secondary)]"
            >
              {z}
            </span>
          ))}
        </div>
        <p className="mb-3">
          But cheap isn&apos;t always good — a falling price can mean a failing
          business. So the <em>score</em> is scaled by company quality: a
          financially strong company in a real dip keeps almost all of its
          valuation credit, while a weak company has most of it stripped away. A
          floor keeps a little either way — the dip is real, it just can&apos;t
          dominate the rating on its own.
        </p>
        <p className="mb-3">
          The zone <em>label</em> always reflects the raw price position; only the
          score that feeds the Overall Rating is quality-adjusted.
        </p>
        <p className="text-[12.5px] text-[var(--text-muted)]">
          The exact quality factor, for the curious:{' '}
          <span className="font-[var(--font-mono)]">
            0.30 + 0.70 × (Financial&nbsp;Health / 100)<sup>1.5</sup>
          </span>
          .
        </p>
      </section>

      {/* 5. Cycle Payoff */}
      <section className="mb-9">
        <SectionHeading id="cycle-payoff">Cycle Payoff — 25%</SectionHeading>
        <p className="mb-3">
          <strong>Cycle Payoff is not price momentum or trend.</strong> It blends
          two things equally:
        </p>
        <ul className="mb-4 space-y-1.5 pl-4 list-disc marker:text-[var(--brand-bright)]">
          <li>
            <strong>Signal reliability</strong> — how many historical
            dip-then-recover cycles we&apos;ve actually observed. More history means
            the pattern is more trustworthy.
          </li>
          <li>
            <strong>Reward vs risk</strong> — the typical rebound divided by the
            typical drawdown. When this stock dips, has it historically paid to
            wait?
          </li>
        </ul>
        <p>
          Cycle Payoff is a <strong>summary number</strong>. To see what it&apos;s
          actually describing — and crucially <strong>how quickly or slowly</strong>{' '}
          a stock has historically recovered — read the{' '}
          <strong>Drawdown Analysis</strong> and <strong>Profit Recovery</strong>{' '}
          charts in the Cycle section of any stock&apos;s page. The shape and timing
          of those curves are the real signal; the score just compresses them into
          one figure.
        </p>
      </section>

      {/* 6. How the cycle math works */}
      <section className="mb-9">
        <SectionHeading id="cycle-math">How the cycle math works</SectionHeading>
        <p className="mb-3">
          A &ldquo;drawdown&rdquo; is measured against the stock&apos;s rolling high
          over a lookback window. The <strong>typical</strong> dip and rebound are
          the <strong>average</strong> of every historical dip and recovery event we
          find in that window. You choose the window with a preset:
        </p>
        <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
          <table className="w-full min-w-[360px] text-[12.5px] text-left">
            <thead>
              <tr className="bg-[var(--bg-stripe)] text-[var(--text-muted)] uppercase tracking-[0.5px] text-[11px]">
                <th className="px-3 py-2 font-semibold">Preset</th>
                <th className="px-3 py-2 font-semibold">Lookback window</th>
                <th className="px-3 py-2 font-semibold">Dip trigger</th>
              </tr>
            </thead>
            <tbody>
              {PRESETS.map((p, i) => (
                <tr
                  key={p.name}
                  className={i % 2 === 1 ? 'bg-[var(--bg-stripe)]/40' : undefined}
                >
                  <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{p.name}</td>
                  <td className="px-3 py-2">{p.window}</td>
                  <td className="px-3 py-2 font-[var(--font-mono)] tabular-nums">{p.trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Limitations */}
      <section className="mb-4">
        <SectionHeading id="limitations">Honest limitations</SectionHeading>
        <ul className="space-y-3">
          <li>
            <strong className="text-[var(--text-primary)]">It&apos;s a heuristic, not an edge.</strong>{' '}
            The whole engine is a re-weighting of public data. It has not been
            validated as a backtested trading strategy.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">A score can&apos;t show timing.</strong>{' '}
            Two stocks with the same Cycle Payoff may recover at very different
            speeds. Always read the <strong>Drawdown Analysis</strong> and{' '}
            <strong>Profit Recovery</strong> charts on a stock&apos;s page before
            drawing conclusions — the graph is the primary signal, not the number.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Survivorship bias.</strong>{' '}
            We analyse today&apos;s index members, so companies that already failed or
            were delisted aren&apos;t in the history.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Thresholds are global.</strong>{' '}
            The same cut-offs apply across sectors, so businesses that don&apos;t fit
            the template (banks, REITs) surface as &ldquo;insufficient data&rdquo;
            rather than a misleading score.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Third-party data.</strong>{' '}
            The underlying prices and fundamentals come from external sources and
            may be delayed or estimated.
          </li>
        </ul>
      </section>

      {/* In-app return hint */}
      <p className="mt-8 pt-5 border-t border-[var(--border)] text-[12.5px] text-[var(--text-muted)]">
        Ready to look at a stock?{' '}
        <Link href="/stocks" className="text-[var(--brand-mid)] underline underline-offset-2 hover:text-[var(--brand-bright)]">
          Browse the universe
        </Link>
        .
      </p>
    </article>
  );
}
