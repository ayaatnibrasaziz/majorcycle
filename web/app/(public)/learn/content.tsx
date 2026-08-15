import Link from 'next/link';

import { LANDING, depth } from '@/lib/landing';
import type { LearnSlug } from '@/lib/learn';

/**
 * Article bodies, keyed by slug.
 *
 * ⚠️ **`Record<LearnSlug, …>` is the guard.** Register an article in
 * `lib/learn.ts` and forget to write its body, and this file stops compiling.
 * That matters more than it sounds: the failure it prevents is a page that
 * renders its heading, its answer and its disclaimer perfectly and then simply
 * stops — the shape CLAUDE.md 11j is about, where a missing section looks
 * completely deliberate and no assertion fires. Here it is a type error before
 * anything ships.
 *
 * ⚠️ **TSX, never parsed HTML.** No `dangerouslySetInnerHTML` and no Markdown
 * renderer anywhere near this file. An article is a React module, so there is no
 * string of markup for anything to be injected into.
 *
 * ⚠️ **Numbers come from the snapshot, never typed by hand** (CLAUDE.md 11k).
 * `LANDING` is the same nightly file the landing page reads, built through the
 * canonical cycle maths, and it carries free-tier cycle geometry only — there is
 * no path from it to a rating or a health score. Hard-coding "Apple has fallen
 * 11.3%" would be a sentence that is true today, fluent forever, and wrong from
 * tomorrow, with nothing going red.
 */
export const ARTICLE_BODIES: Record<LearnSlug, () => React.ReactNode> = {
  'what-is-a-drawdown': () => (
    <>
      <h2>Measured from the peak, not from what you paid</h2>
      <p>
        This is the part that catches people out. A drawdown is always measured
        from the share price&rsquo;s own most recent high — not from the price you
        bought at, and not from the start of the year. Two people who bought the
        same company at different times are sitting on different losses, but the
        stock has exactly one drawdown, and it is the same number for both of them.
      </p>
      <p>
        That is what makes it useful for comparison. &ldquo;Down 20%&rdquo; means
        the same thing for every company on every exchange, so you can line two
        businesses up beside each other without knowing anything about who owns
        them.
      </p>

      <h2>A big drawdown is not automatically a big problem</h2>
      <p>
        Some companies fall a long way as a matter of routine. Others almost never
        do. A 25% fall in a share that habitually swings by that much is ordinary
        weather; the same 25% in something that has rarely dropped more than 10% is
        a genuinely unusual event. The number on its own cannot tell you which of
        those you are looking at — you need the company&rsquo;s own history for that.
      </p>
      <p>
        Take {LANDING.name}, using its full price history to{' '}
        {new Date(`${LANDING.asOf}T00:00:00Z`).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })}
        . It is currently <strong>{depth(LANDING.currentDrawdownPct)}</strong>{' '}
        below its last high. On its own that sounds like a lot. But across{' '}
        {LANDING.pullbackEvents.toLocaleString('en-AU')} separate falls in its
        record, the <em>typical</em> one has run to{' '}
        <strong>{depth(LANDING.typicalDrawdownPct)}</strong> — and its worst ever
        reached <strong>{depth(LANDING.deepestDrawdownPct)}</strong>. Against its
        own history, today&rsquo;s fall is unremarkable.
      </p>

      <h2>Why the deepest number is worth knowing before you buy</h2>
      <p>
        The typical fall tells you what usually happens. The deepest one tells you
        what has actually happened at its worst, at least once, to this exact
        company. Those are two different questions, and the second is the one that
        decides whether you could sit through it.
      </p>
      <p>
        {/* ⚠️ `{' '}` after the expression, not a plain space. JSX drops the
            whitespace between an expression and the text that follows it in
            several arrangements, and it did here: the rendered DOM read
            "81.4%is not a company" while the source clearly had a space (checked
            with od -c before touching anything). The identical construction two
            lines up survived, which is what makes this worth an explicit
            marker rather than a reformat — the rule is arrangement-sensitive,
            so "it looks fine in the source" proves nothing. Guarded by the
            run-together scan in e2e/learn.spec.ts. */}
        A company that normally dips {depth(LANDING.typicalDrawdownPct)} and has
        once fallen {depth(LANDING.deepestDrawdownPct)}{' '}
        is not a company where
        &ldquo;it can&rsquo;t drop much further&rdquo; is supported by the record.
        Knowing that in advance is worth more than any rating.
      </p>

      <h2>What a drawdown cannot tell you</h2>
      <ul>
        <li>
          <strong>Why the price fell.</strong> A market-wide panic and a collapsing
          business produce the same-looking number and call for opposite decisions.
        </li>
        <li>
          <strong>Whether the company is any good.</strong> That question is
          answered by the accounts — profitability, debt, cash flow — not by the
          price chart.
        </li>
        <li>
          <strong>Whether it will recover.</strong> Every past recovery in the
          record happened; that is not a promise about the next one. A share that
          has fallen {depth(LANDING.typicalDrawdownPct)} nine times can fall 60% on
          the tenth.
        </li>
      </ul>
      <p>
        This is why MajorCycle never ranks on the fall alone. Where a stock sits in
        its own cycle is one input; how healthy the business underneath it is
        counts for more. You can read how the two are combined on the{' '}
        <Link href="/">home page</Link>.
      </p>
    </>
  ),
};
