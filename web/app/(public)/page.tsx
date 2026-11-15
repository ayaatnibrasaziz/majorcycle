import type { Metadata } from 'next';
import Link from 'next/link';

import { pageMetadata } from '@/lib/seo';
import { jsonLdScript, organizationJsonLd, websiteJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { LANDING, UNIVERSE_COUNT, depth } from '@/lib/landing';
import { MAG7 } from '@/lib/mag7';
import { RATING_WEIGHTS, tierFromLabel } from '@/lib/ratings';
import { learnPath } from '@/lib/learn';
import { PRESETS } from '@/lib/presets';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/landing/CheckIcon';
import { LandingFilm } from '@/components/landing/LandingFilm';
import { Mag7Table } from '@/components/landing/Mag7Table';
import { LandingMotion } from '@/components/landing/LandingMotion';

import './landing.css';

// The worked example is Apple on the Medium preset (build_landing_snapshot.py PRESET).
const MEDIUM_FALL = Math.abs(PRESETS.medium.pullbackThreshold);

export const metadata: Metadata = pageMetadata({
  path: '/',
  title: 'Where a stock sits in its own cycle',
  description:
    `MajorCycle ranks ${UNIVERSE_COUNT} US, Australian and Canadian companies by how far they have fallen against how far they usually fall. Educational analysis, not advice.`,
});

/** The five compliant rating tiers (design-system §4 / CLAUDE.md #16). */
const TIERS = [
  { label: 'High Conviction', range: '80+' },
  { label: 'Constructive', range: '65+' },
  { label: 'Neutral', range: '50+' },
  { label: 'Cautious', range: '35+' },
  { label: 'Bearish', range: 'below 35' },
] as const;

/**
 * The front door.
 *
 * Rebuilt in November 2026 around the landing film (owner decision): a 35-second
 * cartoon (silent until the reader asks for its voice) that shows the whole product — too many companies, three checks,
 * a ranked shortlist — so the page no longer has to explain it in prose. Six
 * sections, in this order: the film, the proof strip, the three checks, one real
 * run, free vs paid, and what this is and isn't. `e2e/landing.spec.ts` names every
 * one, because a missing section renders perfectly (CLAUDE.md 11j).
 *
 * ── Where the numbers come from ──────────────────────────────────────────────
 *
 * `landing.ts` supplies the company count and Apple's typical fall (nightly,
 * free-tier geometry only). `mag7.ts` is a frozen, dated run over seven stocks,
 * and is the one bounded place premium output appears publicly
 * (docs/architecture.md §7.1). The film's last scene draws that same run, with
 * its date, so the picture and the table below it cannot disagree.
 *
 * ⚠️ NOTHING here types a figure. Every number is read from a snapshot.
 */
export default function LandingPage() {
  const s = LANDING;

  const asOf = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  const runLabel = `Real output · Magnificent Seven · ${MAG7.preset} horizon · ${asOf(MAG7.asOf)}`;

  return (
    // `lp-bleed` cancels the public layout's own padding so the band sections run
    // edge to edge. Guarded in e2e/landing.spec.ts by measuring the dark band
    // against the viewport — if the layout's padding ever changes, that goes red
    // rather than the page quietly growing a 20px gutter.
    <div className="lp lp-bleed">
      {/* Who publishes this site, stated once, on the page Google treats as its
          root. Nothing here describes a security — see lib/jsonld.ts. */}
      <JsonLd json={jsonLdScript([organizationJsonLd(), websiteJsonLd()])} />
      {/* ── ① The film ─────────────────────────────────────────────────── */}
      <section className="hero" data-rise>
        <div className="lp-wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">US · Australia · Canada</p>
            <h1>
              {UNIVERSE_COUNT} companies.
              <br />
              Which ones are worth your time?
            </h1>
            <p className="lead hero-lead">
              MajorCycle checks every one of them three ways, scores it out of 100 and ranks
              the list. You start from a shortlist, not a search.
            </p>
            {/* The site's own Button, not a landing-only lookalike. Its `primary`
                variant carries the contrast fix its gradient needs (see
                components/ui/button.tsx); a hand-rolled `.btn` here would be a second
                definition of the thing customers click to pay (CLAUDE.md 11c). */}
            <div className="cta-row">
              <Button asChild variant="primary" size="lg">
                <Link href="/signup">
                  Create a free account <span className="arw">→</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="hero-second">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            {/* Disclaimer above the fold — CLAUDE.md #4/#12/#24. The film's last
                scene shows ratings, so this page still owes it. */}
            <p className="disc">
              <span className="tag">Information only</span>
              <span>
                Educational analysis, not financial advice. Nothing here is a
                recommendation to buy, hold or sell.
              </span>
            </p>
          </div>

          <LandingFilm />
        </div>
      </section>

      {/* ── ② Proof strip ──────────────────────────────────────────────── */}
      <section className="sec-tight" data-rise style={{ paddingBottom: 'clamp(40px,6vh,64px)' }}>
        <div className="lp-wrap">
          <div className="card strip">
            <div className="cell">
              <div className="v">{UNIVERSE_COUNT}</div>
              <div className="k">companies covered</div>
            </div>
            <div className="cell">
              <div className="v">3</div>
              <div className="k">markets — US, Australia, Canada</div>
            </div>
            <div className="cell">
              <div className="v">1 run</div>
              <div className="k">covers a whole index at once — minutes, not evenings</div>
            </div>
            <div className="cell">
              <div className="v">$0</div>
              <div className="k">to open an account — no card</div>
            </div>
          </div>
        </div>
      </section>
      {/* ── ③ The three checks ─────────────────────────────────────────────
          Also where `/methodology` lands (308 → /#how-it-works), so the guard
          scopes its named-content checks over this block.

          `scroll-mt` is load-bearing, not decoration: the header is sticky, so an
          anchor jump without it lands the heading UNDERNEATH the bar. */}
      <div id="how-it-works">
        <section className="band" data-rise>
          <div className="lp-wrap">
            <div style={{ maxWidth: '62ch' }}>
              <p className="eyebrow">How it works</p>
              <h2 style={{ marginTop: '10px' }}>Every company gets the same three checks.</h2>
              <p className="lead" style={{ marginTop: '18px' }}>
                Shares fall and recover in a pattern, and for most established companies
                the size of those falls settles into a range. That range is the
                company&rsquo;s <strong>Major Cycle</strong>. Two of the three checks
                measure it; the first asks whether the business underneath is any good.
              </p>
            </div>

            <div className="steps" style={{ marginTop: '32px' }}>
              <div className="card">
                <div className="card-body">
                  <div className="check-head">
                    <div>
                      <div className="idx" style={{ color: 'var(--c-tier-2-ink)' }}>
                        {RATING_WEIGHTS.health}% OF THE RATING
                      </div>
                      <h3 style={{ marginTop: '6px' }}>Financial Health</h3>
                    </div>
                    <CheckIcon kind="health" />
                  </div>
                  <p className="ask">Is the business sound?</p>
                  <p>
                    Five things from the company&rsquo;s accounts: profitability, balance
                    sheet, growth, cash flow and shareholder returns. Where the accounts
                    don&rsquo;t give enough to judge, we withhold the score rather than
                    guess.
                  </p>
                </div>
              </div>
              <div className="card">
                <div className="card-body">
                  <div className="check-head">
                    <div>
                      <div className="idx" style={{ color: 'var(--brand-mid)' }}>
                        {RATING_WEIGHTS.valuation}% OF THE RATING
                      </div>
                      <h3 style={{ marginTop: '6px' }}>Valuation</h3>
                    </div>
                    <CheckIcon kind="valuation" />
                  </div>
                  <p className="ask">How far has it fallen, against how far it usually falls?</p>
                  <p>
                    The deeper a share sits inside its own usual range, the higher it
                    scores. A weak business is marked down, so a share that is cheap
                    because the company is failing cannot pass as a bargain.
                  </p>
                </div>
              </div>
              <div className="card">
                <div className="card-body">
                  <div className="check-head">
                    <div>
                      <div className="idx" style={{ color: 'var(--accent-warm-ink)' }}>
                        {RATING_WEIGHTS.payoff}% OF THE RATING
                      </div>
                      <h3 style={{ marginTop: '6px' }}>Cycle Payoff</h3>
                    </div>
                    <CheckIcon kind="payoff" />
                  </div>
                  <p className="ask">When it falls, how well does it bounce back?</p>
                  <p>
                    How far its typical recovery has gone past its typical fall, and how
                    much history that pattern rests on.
                  </p>
                </div>
              </div>
            </div>

            <div
              // A stable hook for the contrast guard, which measures the REAL
              // badge — this legend is the one place all five tiers appear on a
              // public page. A data attribute cannot be renamed by a styling change.
              data-tier-legend
              // A tier badge is an alpha tint over whatever is behind it, so the
              // legend carries its own ground rather than inheriting the band's.
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-page)] px-4 py-3"
              style={{
                marginTop: '26px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="body" style={{ fontSize: '14px', marginRight: '4px' }}>
                The three scores combine into one rating, in five tiers:
              </span>
              {/* The REAL badge component, not a re-coloured copy. */}
              {TIERS.map((t) => (
                <span
                  key={t.label}
                  className={`tier-badge tier-badge--${tierFromLabel(t.label)}`}
                >
                  {t.label} · {t.range}
                </span>
              ))}
            </div>

            <p className="body" style={{ marginTop: '18px', fontSize: '14px' }}>
              Want the detail?{' '}
              <Link className="lp-link" href={learnPath('how-to-read-a-majorcycle-rating')}>
                How to read a MajorCycle rating <span className="arw">→</span>
              </Link>
            </p>
          </div>
        </section>
      </div>

      {/* ── ④ The real run ─────────────────────────────────────────────── */}
      <section data-rise>
        <div className="lp-wrap">
          <div style={{ maxWidth: '62ch' }}>
            <p className="eyebrow">Real output</p>
            <h2 style={{ marginTop: '10px' }}>This is what a run gives you.</h2>
            <p className="lead" style={{ marginTop: '18px' }}>
              The shortlist at the end of the film is not a mock-up. It is this run, over
              seven companies everybody knows.
            </p>
          </div>
          <p className="card-note" style={{ margin: '28px 0 9px' }}>
            {runLabel}
          </p>
          <Mag7Table snapshot={MAG7} />
          <p
            style={{
              marginTop: '12px',
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: '92ch',
            }}
          >
            Overall is Financial Health {RATING_WEIGHTS.health}%, Valuation{' '}
            {RATING_WEIGHTS.valuation}% and Cycle Payoff {RATING_WEIGHTS.payoff}%.{' '}
            <strong>Current DD%</strong> is how far below its last high the stock sits today,{' '}
            <strong>Typical DD%</strong> is the average depth of its past low points,{' '}
            <strong>Lower Bound%</strong> is the deepest fall in its record, and{' '}
            <strong>Low points</strong> counts how often its falls bottomed out more than{' '}
            {MEDIUM_FALL}% below a high. Information only — not financial advice.
          </p>
        </div>
      </section>

      {/* ── ⑦ Free vs paid ─────────────────────────────────────────────── */}
      <section id="plans" className="band" data-rise>
        <div className="lp-wrap">
          <div style={{ maxWidth: '56ch' }}>
            <p className="eyebrow">What you get</p>
            <h2 style={{ marginTop: '10px' }}>
              The data is free. Our judgement is the paid part.
            </h2>
          </div>
          <div className="plans" style={{ marginTop: '30px' }}>
            <div className="card plan">
              <div className="card-header">
                <span className="card-title">Free account</span>
                <span className="card-note">No card</span>
              </div>
              <div className="card-body">
                <ul>
                  <li>Browse all {UNIVERSE_COUNT} companies across three markets</li>
                  <li>Price chart and full price history</li>
                  <li>The drawdown overlay, with its cycle bands</li>
                  <li>Every fundamentals and sentiment section</li>
                  <li>Analyst targets and consensus, shown verbatim</li>
                </ul>
                {/* The free card carries its own way in, so the two plans end level and
                    each offers the step that belongs to it. */}
                <Button asChild variant="outline" className="mt-[18px]">
                  <Link href="/signup">
                    Create a free account <span className="arw">→</span>
                  </Link>
                </Button>
              </div>
            </div>
            <div className="card plan plan--paid">
              <div className="card-header">
                <span className="card-title">Subscription</span>
                <span className="card-note">7-day free trial</span>
              </div>
              <div className="card-body">
                <ul>
                  <li>The Overall Rating, Health Score and Verdict</li>
                  <li>The scorecard and radar</li>
                  <li>The screener — run any list, any horizon</li>
                  <li>The Opportunity Map and the ranked results table</li>
                  <li>Downloadable report, CSV and Excel exports</li>
                </ul>
                <Button asChild variant="primary" className="mt-[18px]">
                  <Link href="/pricing">
                    See pricing <span className="arw">→</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ⑧ Before you use it ────────────────────────────────────────── */}
      <section className="dark" data-rise>
        <div className="lp-prose">
          <p className="eyebrow">Before you use it</p>
          <h2 style={{ marginTop: '10px' }}>What this is, and what it isn&rsquo;t.</h2>
          <div className="honest">
            <div>
              {/* Real headings, not styled divs: they are the page's honesty
                  contract, so they belong in the document outline a screen reader
                  navigates — and a named heading is something a guard can check
                  has not quietly gone missing. */}
              <h3 className="h">These are algorithmic summaries.</h3>
              <p>
                Every score on this site is produced by a formula running over public market
                data, refreshed nightly. No human reviews an individual company before you
                see its rating, and no score is stored — each one is recalculated from the
                raw price history and the latest filings every time you ask for it.
              </p>
            </div>
            <div className="rule" />
            <div>
              <h3 className="h">A ranking is where research starts, not where it ends.</h3>
              <p>
                MajorCycle narrows {UNIVERSE_COUNT} companies down to a handful worth your
                attention. What
                it cannot know is why a company fell, what management is
                doing about it, what happens at the next earnings date, or anything at all
                about your own circumstances. Treat a high rating as a reason to go and read
                about the company — never as a reason to buy it.
              </p>
            </div>
            <div className="rule" />
            <div>
              <h3 className="h">Information only — not financial advice.</h3>
              <p>
                MajorCycle is an educational tool. Nothing on this site is a recommendation
                to buy, hold or sell any security, and we are not licensed to give personal
                financial advice. Analyst recommendations shown alongside our scores are
                third-party data, reproduced verbatim, and are not our view. Past patterns
                are not a forecast — a stock that has fallen{' '}
                {depth(s.typicalDrawdownPct)} nine times can fall 60% on the tenth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Renders nothing. Arms and plays the three approved moments of motion;
          without it the page is simply static, which is the correct fallback. */}
      <LandingMotion />
    </div>
  );
}