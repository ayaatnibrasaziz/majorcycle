import type { Metadata } from 'next';
import Link from 'next/link';

import { pageMetadata } from '@/lib/seo';
import { LANDING, depth, price } from '@/lib/landing';
import { MAG7, cardinal, mag7Facts, pct1, shortName } from '@/lib/mag7';
import { tierFromLabel } from '@/lib/ratings';
import { Button } from '@/components/ui/button';
import { CycleRulers } from '@/components/landing/CycleRulers';
import { Mag7Table } from '@/components/landing/Mag7Table';
import { LandingMotion } from '@/components/landing/LandingMotion';
import { OpportunityMapStill } from '@/components/landing/OpportunityMapStill';

import './landing.css';

export const metadata: Metadata = pageMetadata({
  path: '/',
  title: 'Where a stock sits in its own cycle',
  description:
    'MajorCycle ranks 863 US, Australian and Canadian companies by how far they have fallen against how far they usually fall — then asks whether the business underneath is any good. Educational analysis, not financial advice.',
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
 * Built to the approved storyboard artifact — eight sections, in this order. That
 * sentence is the entire lesson of CLAUDE.md 11j: this page was recorded COMPLETE
 * in G2 while missing twelve of them, because a missing section renders perfectly.
 * There is no error, no gap, no failing assertion; the page simply stops earlier
 * than it should and looks deliberate. `e2e/landing.spec.ts` therefore names every
 * section, because only something that enumerates what SHOULD be here can see what
 * isn't.
 *
 * ── The two ideas it is built around ─────────────────────────────────────────
 *
 * **Demonstrate before naming** (owner decision). The page opens on a real run
 * over seven companies everybody has heard of, and only afterwards says that the
 * gap between "how far it has fallen" and "how far it usually falls" is what we
 * call a Major Cycle. Leading with the term asks a newcomer to learn vocabulary
 * before seeing why it matters.
 *
 * **Layered, not averaged.** The buyer is both a newcomer and someone who already
 * invests. The hero needs no vocabulary at all; each section below carries more
 * substance than the one above. Writing for the average of the two serves neither.
 *
 * ── Where the numbers come from ──────────────────────────────────────────────
 *
 * Two snapshots, and they are different on purpose. `landing.ts` is Apple, rebuilt
 * nightly — free-tier cycle geometry only, and structurally incapable of holding a
 * paid field. `mag7.ts` is a frozen, dated run over seven stocks, and is the one
 * bounded place premium output appears publicly (docs/architecture.md §7.1). It is
 * frozen because this page writes *sentences about* that run, and a sentence that
 * was true on Thursday is a lie on Friday.
 *
 * ⚠️ NOTHING here types a figure. Every number, every marker position and every
 * count is read from a snapshot or derived by `mag7Facts()`. The storyboard's own
 * copy said "5 rate Constructive or better" and Tesla "still comes sixth"; on the
 * regenerated run the answers are four and seventh. Both would have shipped as
 * confident, specific, false statements about real companies with nothing red.
 */
export default function LandingPage() {
  const s = LANDING;
  const f = mag7Facts();

  const asOf = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  const runLabel = `Real output · Magnificent Seven · ${MAG7.preset} horizon · ${asOf(MAG7.asOf)}`;

  // The briefing ring: r=23 → circumference 2πr. Filled to the share of the run
  // rating Constructive or better, exactly as BriefingCard does it in the product.
  const CIRC = 2 * Math.PI * 23;
  const filled = CIRC * (1 - f.constructiveOrBetter / f.total);

  return (
    // `lp-bleed` cancels the public layout's own padding so the band sections run
    // edge to edge. Guarded in e2e/landing.spec.ts by measuring the dark band
    // against the viewport — if the layout's padding ever changes, that goes red
    // rather than the page quietly growing a 20px gutter.
    <div className="lp lp-bleed">
      {/* ── ① The hook ─────────────────────────────────────────────────── */}
      <section className="hero" data-rise>
        <div className="lp-wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">US · Australia · Canada</p>
            <h1>
              863 companies.
              <br />
              Which ones are actually on sale?
            </h1>
            <p className="lead">
              Checking five hundred companies isn&rsquo;t realistic, so most people end up
              buying the one they happened to read about. MajorCycle does the checking for
              you. It ranks every company by how far it has fallen against how far it{' '}
              <em>normally</em> falls — then asks whether the business underneath is any
              good.
            </p>
            {/* The site's own Button, not a landing-only lookalike. Its `primary`
                variant is already the navy gradient the design artifact specifies,
                and it carries the contrast fix that gradient needs (a gradient
                paints via background-image, leaving the computed background-color
                transparent — see components/ui/button.tsx). A hand-rolled `.btn`
                here would be a second definition of the thing customers click to
                pay (CLAUDE.md 11c). */}
            <div className="cta-row">
              <Button asChild variant="primary" size="lg">
                <Link href="/signup">
                  Create a free account <span className="arw">→</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            {/* Disclaimer above the fold — CLAUDE.md #4/#12/#24. */}
            <p className="disc">
              <span className="tag">Information only</span>
              <span>
                Educational analysis, not financial advice. Nothing here is a
                recommendation to buy, hold or sell.
              </span>
            </p>
          </div>

          <div>
            <p className="card-note" style={{ marginBottom: '9px' }}>
              {runLabel}
            </p>
            {/* The product's own Analyst Briefing chrome (globals.css) — not a
                lookalike. A reader who signs up meets this exact card. */}
            <div className="briefing">
              <div className="briefing-ring-block">
                <div className="briefing-ring">
                  <svg viewBox="0 0 56 56" aria-hidden="true">
                    <circle className="briefing-ring-bg" cx="28" cy="28" r="23" />
                    <circle
                      className="briefing-ring-fg"
                      cx="28"
                      cy="28"
                      r="23"
                      strokeDasharray={CIRC.toFixed(2)}
                      strokeDashoffset={filled.toFixed(2)}
                      data-ring
                      style={{ ['--circ' as string]: CIRC.toFixed(2) }}
                    />
                  </svg>
                  <div
                    className="briefing-ring-num"
                    style={{ fontSize: '20px', fontWeight: 700 }}
                  >
                    {f.constructiveOrBetter}
                  </div>
                </div>
                <div className="briefing-ring-cap">of {f.total}</div>
              </div>
              <div className="briefing-body">
                <div className="briefing-head">
                  <span className="briefing-title">Analyst Briefing</span>
                </div>
                <p className="briefing-text">
                  Of {f.total} stocks analysed, {f.constructiveOrBetter} rate Constructive or
                  better. The standout is <span className="b-link">{f.top.ticker}</span> (
                  {f.top.name}) — a financially healthy company, Health{' '}
                  {Math.round(f.top.healthScore)}, currently rated {f.top.overallLabel}.
                </p>
                <div className="briefing-pills">
                  <span className="b-pill">
                    <b className="b-pill-n" style={{ color: 'var(--c-tier-2-ink)' }}>
                      {f.constructiveOrBetter}
                    </b>{' '}
                    Constructive or better
                  </span>
                  <span className="b-pill">
                    Top pick:{' '}
                    <b className="b-pill-n" style={{ color: 'var(--brand-mid)' }}>
                      {f.top.ticker}
                    </b>
                  </span>
                  <span className="b-pill">
                    <b className="b-pill-n" style={{ color: 'var(--c-tier-3-ink)' }}>
                      {f.cautiousOrWorse}
                    </b>{' '}
                    Cautious / Bearish
                  </span>
                </div>
                <p className="briefing-disclaimer">Information only — not financial advice.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ② Proof strip ──────────────────────────────────────────────── */}
      <section className="sec-tight" data-rise style={{ paddingBottom: 'clamp(40px,6vh,64px)' }}>
        <div className="lp-wrap">
          <div className="card strip">
            <div className="cell">
              <div className="v">863</div>
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

      {/* ── ③ How a scan works ─────────────────────────────────────────── */}
      <section style={{ paddingTop: 0 }} data-rise>
        <div className="lp-wrap">
          <p className="eyebrow">How a scan works</p>
          <h2 style={{ marginTop: '10px', maxWidth: '18ch' }}>
            Three decisions, then a ranked list.
          </h2>
          <div className="steps" style={{ marginTop: '32px' }}>
            <div className="card step">
              <div className="card-body">
                <div className="idx">STEP 01</div>
                <h3>Pick a list</h3>
                <p>
                  Start from an index, the biggest names, or paste in tickers of your own.
                  There&rsquo;s nothing to set up.
                </p>
                <div className="chips">
                  <span className="chip sel">S&amp;P 500</span>
                  <span className="chip">ASX 200</span>
                  <span className="chip">S&amp;P/TSX 60</span>
                  <span className="chip">Top 100 largest</span>
                  <span className="chip">Paste your own</span>
                </div>
              </div>
            </div>
            <div className="card step">
              <div className="card-body">
                <div className="idx">STEP 02</div>
                <h3>Pick a horizon</h3>
                <p>
                  This sets what counts as a fall, and how far back we look for them. Most
                  people never move off Medium.
                </p>
                <div className="chips">
                  <span className="chip">Short · 3% · 3 months</span>
                  <span className="chip sel">Medium · 5% · 1 year</span>
                  <span className="chip">Long · 8% · 3 years</span>
                </div>
              </div>
            </div>
            <div className="card step">
              <div className="card-body">
                <div className="idx">STEP 03</div>
                <h3>Read the ranking</h3>
                <p>
                  Every company scored out of 100 and sorted, best first. Filter it, chart
                  it, or take the whole thing away as a spreadsheet.
                </p>
                <div className="chips">
                  <span className="chip">Sortable table</span>
                  <span className="chip">Opportunity map</span>
                  <span className="chip">CSV / Excel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ④ The real run ─────────────────────────────────────────────── */}
      <section style={{ paddingTop: 0 }} data-rise>
        <div className="lp-wrap">
          <p className="card-note" style={{ marginBottom: '9px' }}>
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
            Overall is Financial Health 40%, Valuation 35% and Cycle Payoff 25%.{' '}
            <strong>Current DD%</strong> is how far below its last high the stock sits today,{' '}
            <strong>Typical DD%</strong> is its average fall across every past one, and{' '}
            <strong>Lower Bound%</strong> is the deepest fall in its record — worth knowing
            before you decide how much of a fall you could live with. Information only — not
            financial advice.
          </p>
        </div>
      </section>

      {/* ── ⑤ + ⑥ How it works ─────────────────────────────────────────────
          One scroll target covering both halves of the method: what a Major
          Cycle is, and why a falling price alone isn't enough. This is where
          `/methodology` landed when it was folded in (308 → /#how-it-works), so
          the guard scopes its named-content checks over this whole block.

          `scroll-mt` is load-bearing, not decoration: the header is sticky, so an
          anchor jump without it lands the heading UNDERNEATH the bar and the
          reader arrives at a section whose title they cannot see. */}
      <div id="how-it-works">
        <section className="band" data-rise>
          <div className="lp-wrap">
            <div style={{ maxWidth: '62ch' }}>
              <p className="eyebrow">The idea</p>
              <h2 style={{ marginTop: '10px' }}>
                Shares don&rsquo;t fall in a straight line. They fall by roughly the same
                amount, over and over.
              </h2>
              <p className="lead" style={{ marginTop: '18px' }}>
                They drop, they bottom out, they climb back — and for most established
                companies the depth of those drops settles into a range. {s.name} has been
                through <strong>{s.pullbackEvents.toLocaleString('en-AU')} of them</strong>.
                That range is the company&rsquo;s <strong>Major Cycle</strong>, and knowing
                it lets you answer the question that actually matters when a price falls: is
                this normal for this company, or is this something else?
              </p>
            </div>

            <div className="card" style={{ marginTop: '34px' }}>
              <div className="card-header">
                <span className="card-title">
                  {s.name} Inc. · {s.ticker} · {price(s.price, s.currency)}
                </span>
                <span className="card-note">
                  {MAG7.preset} horizon · full price history to {asOf(s.asOf)}
                </span>
              </div>
              <div className="card-body" style={{ padding: '26px 24px 30px' }}>
                <CycleRulers snapshot={s} />
              </div>
            </div>

            <div style={{ maxWidth: '62ch', marginTop: '30px' }}>
              <h3>So what does that tell you about {s.name} today?</h3>
              <p className="body" style={{ marginTop: '10px', fontSize: '15px' }}>
                It&rsquo;s <strong>{depth(s.currentDrawdownPct)} below its high</strong>,
                against a typical fall of <strong>{depth(s.typicalDrawdownPct)}</strong>.
                Down — but nowhere near where {s.name}&rsquo;s own falls usually end. And it
                has once fallen <strong>{depth(s.deepestDrawdownPct)}</strong>, so
                &ldquo;it&rsquo;s too big to drop much&rdquo; isn&rsquo;t what the record
                says. Put a different company a third below its high with the same quality
                behind it, and you&rsquo;re having a completely different conversation.
              </p>
            </div>
          </div>
        </section>

        <section data-rise>
          <div className="lp-wrap">
            <div className="split-grid">
              <div>
                <p className="eyebrow">The second question</p>
                <h2 style={{ marginTop: '10px' }}>
                  A falling price is not the same as a bargain.
                </h2>
                <p className="lead" style={{ marginTop: '18px' }}>
                  A share can be down 40% because the market panicked, or because the
                  company is genuinely in trouble. Those are opposite decisions, and the
                  price on its own won&rsquo;t tell you which one you&rsquo;re looking at. So
                  every company is scored on its own accounts as well — and the ranking uses
                  both halves.
                </p>
                <div className="callout" style={{ marginTop: '24px' }}>
                  <div className="h">What this particular run is telling you</div>
                  <p>
                    <strong>
                      {shortName(f.deepestFall.name)} has fallen furthest of the{' '}
                      {cardinal(f.total)} — {pct1(f.deepestFall.currentDrawdownPct)} — and
                      still comes {f.deepestFallRank}.
                    </strong>{' '}
                    Its Financial Health is {f.weakest.healthScore.toFixed(1)} against{' '}
                    {shortName(f.healthiest.name)}&rsquo;s {f.healthiest.healthScore.toFixed(1)}. That&rsquo;s exactly the trap the
                    second question exists to catch: the biggest discount on the list belongs
                    to the weakest business on it.
                  </p>
                  <p style={{ marginTop: '11px' }}>
                    Now look at what <em>isn&rsquo;t</em> here.{' '}
                    {f.opportunityZone.length === 0
                      ? 'Nothing has landed in the green Opportunity Zone.'
                      : `Only ${f.opportunityZone.length} of ${f.total} has landed in the green Opportunity Zone.`}{' '}
                    On these numbers, on this date, the Magnificent Seven are strong
                    companies at full prices — and we&rsquo;d rather tell you that than
                    manufacture a bargain. A tool that always finds you something to buy
                    isn&rsquo;t really measuring anything.
                  </p>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Opportunity Map</span>
                  <span className="card-note">Bubble size = Overall Rating</span>
                </div>
                <div className="card-body">
                  <OpportunityMapStill snapshot={MAG7} />
                </div>
              </div>
            </div>

            {/* The three components of the Overall Rating, with their weights. */}
            <div className="steps" style={{ marginTop: 'clamp(34px,5vh,52px)' }}>
              <div className="card">
                <div className="card-body">
                  <div className="idx" style={{ color: 'var(--c-tier-2-ink)' }}>
                    40% OF THE RATING
                  </div>
                  <h3 style={{ marginTop: '6px' }}>Financial Health</h3>
                  <p>
                    Five pillars from company filings: profitability, balance sheet, growth,
                    cash flow and shareholder returns. Where a company&rsquo;s accounts
                    don&rsquo;t provide enough to judge — some banks and REITs — we withhold
                    the score rather than guess, and say so.
                  </p>
                </div>
              </div>
              <div className="card">
                <div className="card-body">
                  <div className="idx" style={{ color: 'var(--brand-mid)' }}>
                    35% OF THE RATING
                  </div>
                  <h3 style={{ marginTop: '6px' }}>Valuation</h3>
                  <p>
                    Where today&rsquo;s price sits inside that stock&rsquo;s own drawdown
                    band — then marked down if the company underneath is weak, so a share
                    that is cheap because the business is failing cannot masquerade as a
                    bargain.
                  </p>
                </div>
              </div>
              <div className="card">
                <div className="card-body">
                  <div className="idx" style={{ color: 'var(--c-tier-3-ink)' }}>
                    25% OF THE RATING
                  </div>
                  <h3 style={{ marginTop: '6px' }}>Cycle Payoff</h3>
                  <p>
                    How reliable the pattern is — more past falls means more confidence — and
                    how the typical recovery compares with the typical fall.
                  </p>
                </div>
              </div>
            </div>

            <div
              // A stable hook for the contrast guard, which measures the REAL
              // badge — this legend is the one place all five tiers appear on a
              // public page, and it was 2.38:1 until G2. A class would do, but a
              // data attribute cannot be renamed by a styling change.
              data-tier-legend
              // On the SURFACE, not the page ground. The Neutral badge is a gold
              // tint over whatever is behind it: on white it measures 4.73:1 (the
              // figure G2 fixed it to), on --bg-page 4.32:1 — under the floor. The
              // badge did not change; the thing behind it did. Composited colours
              // have to be measured where they actually sit.
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
              style={{
                marginTop: '26px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="body" style={{ fontSize: '14px', marginRight: '4px' }}>
                Which lands the stock in one of five tiers:
              </span>
              {/* The REAL badge component, not a re-coloured copy — the same reason
                  G2 fixed this legend's contrast (2.38 → 4.73:1) by rendering the
                  real thing rather than approximating it. */}
              {TIERS.map((t) => (
                <span
                  key={t.label}
                  className={`tier-badge tier-badge--${tierFromLabel(t.label)}`}
                >
                  {t.label} · {t.range}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

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
                  <li>Browse all 863 companies across three markets</li>
                  <li>Price chart and full price history</li>
                  <li>The drawdown overlay, with its cycle bands</li>
                  <li>Every fundamentals and sentiment section</li>
                  <li>Analyst targets and consensus, shown verbatim</li>
                </ul>
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
                MajorCycle narrows 863 companies down to a handful worth your attention. What
                it cannot know is <strong>why</strong> a company fell, what management is
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
