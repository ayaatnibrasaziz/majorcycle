import Link from 'next/link';

import { LANDING, depth } from '@/lib/landing';
import type { LearnSlug } from '@/lib/learn';
import { CUSTOM_PARAM_BOUNDS, PRESETS, PRESET_HORIZONS, PRESET_LABELS } from '@/lib/presets';
import {
  OwnRecordFigure,
  PeakChoiceFigure,
  WindowChoiceFigure,
} from '@/components/learn/DrawdownFigures';
import { MarketWordsFigure, TwoRecordsFigure } from '@/components/learn/CorrectionFigures';
import { MARKET_LEVELS, QUIET, ROUTINE, TODAY_PCT } from '@/components/learn/correctionGeometry';
import { WeekHighFigure } from '@/components/learn/WeekHighFigure';
import { LOW_GAP_PCT } from '@/components/learn/weekHighGeometry';

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
 *
 * ⚠️ **And the same rule applies to the PRODUCT's own settings** (CLAUDE.md
 * 11c-v). Where this article states a horizon length, a threshold or a bound, it
 * renders `PRESETS` / `CUSTOM_PARAM_BOUNDS` rather than repeating the figure in
 * prose. A sentence that states a constant IS a copy of that constant, and prose
 * is where copies go to drift unnoticed: retune a preset and the article would
 * not error, would not look stale and would not stop rendering — it would simply
 * become a confident, fluent, false statement about what the product does.
 *
 * ⚠️ **No `<table>` in a body.** `.reading` styles paragraphs, headings and
 * lists; it has no table rules at all, so a table renders as unstyled browser
 * default in the middle of a designed page. An undefined class is silence, not
 * an error.
 */

/** Trading days in the reader's units. Derived, so a changed bound restates itself. */
function tradingDaysInWords(bars: number): string {
  if (bars < 252) {
    const months = Math.max(1, Math.round(bars / 21));
    return months === 1 ? 'about a month' : `about ${months} months`;
  }
  const years = Math.round(bars / 252);
  return years === 1 ? 'about a year' : `about ${years} years`;
}

/**
 * A negative percentage as the positive magnitude a reader says out loud.
 *
 * ⚠️ The figures store falls negative because a fall IS negative, and the prose
 * says "a fall of 10%", never "a fall of −10%". Converting at the point of
 * display keeps the sign convention honest in the data — the same reasoning as
 * `depth()` in `lib/landing.ts`.
 */
const mag = (v: number): string => `${Math.abs(Math.round(v))}%`;

/**
 * The two conventional thresholds, looked up by NAME rather than by position.
 *
 * `MARKET_LEVELS[0]` would be correct today and silently wrong the moment
 * anyone reorders the array — the exact defect `recentView()` was rewritten to
 * avoid in `drawdownGeometry.ts`.
 */
const CORRECTION_PCT = MARKET_LEVELS.find((l) => l.label === 'Correction')?.pct ?? -10;
const CRASH_PCT = MARKET_LEVELS.find((l) => l.label.startsWith('Crash'))?.pct ?? -20;

const HORIZON_KEYS = ['short', 'medium', 'long'] as const;
const MEDIUM_FALL = Math.abs(PRESETS.medium.pullbackThreshold);
const MIN_BARS = CUSTOM_PARAM_BOUNDS.lookbackBars.min;
const MAX_BARS = CUSTOM_PARAM_BOUNDS.lookbackBars.max;
const MIN_FALL = Math.abs(CUSTOM_PARAM_BOUNDS.pullbackThreshold.max);
const MAX_FALL = Math.abs(CUSTOM_PARAM_BOUNDS.pullbackThreshold.min);

const asOfWords = new Date(`${LANDING.asOf}T00:00:00Z`).toLocaleDateString('en-AU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export const ARTICLE_BODIES: Record<LearnSlug, () => React.ReactNode> = {
  'what-is-a-drawdown': () => (
    <>
      <h2>Measured from the peak, not from what you paid</h2>
      <p>
        This is the part that catches people out. A drawdown is measured from the
        share price&rsquo;s own high, not from the price you bought at and not
        from the start of the year.
      </p>
      <p>
        Two people who bought the same company at different times are sitting on
        very different losses. But the stock has exactly one drawdown, and it is
        the same number for both of them.
      </p>
      <p>
        That is what makes it useful for comparison. &ldquo;Down 20%&rdquo; means
        the same thing for every company on every exchange, so you can line two
        businesses up beside each other without knowing anything about who owns
        them or when they bought.
      </p>

      <h3>Which peak, though? The part most explanations skip</h3>
      <p>
        Almost every guide tells you a drawdown is measured &ldquo;from the
        peak&rdquo; and then moves on. That leaves the most important question
        unanswered: <strong>which</strong> peak?
      </p>
      <p>
        There are three answers in common use, and they produce genuinely
        different numbers.
      </p>
      <p>
        <strong>The textbook definition.</strong> In academic and fund-management
        writing, the peak is the highest value the investment has ever reached
        since records began — what mathematicians call the running maximum. Most
        finance textbooks define it this way. It is precise, and for a company
        with a long history it can produce a number that says more about the
        distant past than about today.
      </p>
      <p>
        <strong>The last local top.</strong> Many investors mean something looser:
        the most recent point at which the price stopped rising and turned down.
        This is intuitive but slippery, because a share can have dozens of small
        tops and no two people will pick the same one.
      </p>
      <p>
        <strong>How MajorCycle measures it.</strong> We use the highest price
        reached inside a fixed recent window, and that window is a setting you
        control.
      </p>
      <p>
        Why a window rather than the all-time high? Because a share that peaked
        twenty years ago and has traded in a completely different range ever since
        is not usefully described as being &ldquo;in a drawdown&rdquo; from that
        ancient number. A window keeps the comparison recent enough to mean
        something.
      </p>

      <PeakChoiceFigure />

      <p>
        Three ready-made horizons cover most needs, and each one looks back a
        fixed number of trading days:
      </p>
      <ul>
        {HORIZON_KEYS.map((k) => (
          <li key={k}>
            <strong>{PRESET_LABELS[k]}</strong> — {PRESETS[k].lookbackBars} trading
            days, {PRESET_HORIZONS[k].replace('~', 'roughly ')}
            {k === 'medium' ? ' (the default)' : ''}
          </li>
        ))}
      </ul>
      <p>
        <strong>
          This means one stock has more than one drawdown, and all of them are
          correct.
        </strong>{' '}
        A share that has been falling for two years might be down only slightly
        against its three-month high, and down heavily against its three-year
        high. Neither figure is wrong. They answer different questions, and
        switching horizons is often the fastest way to see the shape of what has
        actually happened.
      </p>
      <p>
        The one-year figure is the one you will meet most often, because it is the
        number brokers quote as the 52-week high — and it is not measured quite the
        way you would expect. That is covered in{' '}
        <Link href="/learn/52-week-high">What a 52-week high really tells you</Link>.
      </p>

      <WindowChoiceFigure />

      <h3>Setting your own window</h3>
      <p>
        You are not limited to those three. A fourth option, <strong>Custom</strong>,
        hands you the dial directly.
      </p>
      <p>
        With Custom you set the window yourself, anywhere from {MIN_BARS} trading
        days to {MAX_BARS.toLocaleString('en-AU')} — {tradingDaysInWords(MIN_BARS)}{' '}
        at the short end, {tradingDaysInWords(MAX_BARS)} at the long end. You can
        also change what counts as a fall worth recording, anywhere from {MIN_FALL}%
        to {MAX_FALL}%, and the same for what counts as a recovery. Switching to
        Custom starts you on the {PRESET_LABELS.medium} settings, so you begin
        somewhere sensible and adjust from there.
      </p>
      <p>
        The reason to bother is that the right window is a question about{' '}
        <strong>you</strong>, not about the company. If you expect to hold a share
        for a decade, judging today&rsquo;s price against a three-month high tells
        you almost nothing useful. If you are looking at a company that listed four
        years ago, a three-year window is most of its entire life. Matching the
        window to how you actually invest is the difference between a number that
        means something and a number that merely exists.
      </p>
      <p>
        One honest warning about the dial. Make the window short enough and almost
        every share looks close to its high, because it has not had time to fall far
        from it. Make it long enough and almost everything looks deeply fallen,
        because you are reaching back to a peak from a different era. Neither view is
        false, and neither is the truth on its own —{' '}
        <strong>
          the window changes the question you are asking, not the company you are
          asking about.
        </strong>{' '}
        Pick it deliberately, then leave it alone while you compare one business
        against another.
      </p>

      <h2>A drawdown is not a loss</h2>
      <p>
        These get used interchangeably and they are not the same thing.
      </p>
      <p>
        A drawdown is a fall from a peak. It exists whether or not you own the
        share, and it reverses on its own if the price recovers. A loss is what
        happens when you sell for less than you paid. Until you sell, a drawdown is
        a description of the price; it is not money that has gone anywhere.
      </p>
      <p>
        The practical consequence is that you can hold a share that is deep in a
        drawdown and still be well ahead on your own purchase, if you bought early
        enough. And you can be down on your purchase while the stock&rsquo;s
        drawdown is small, if you bought near the top.
      </p>

      <h2>What counts as a normal drawdown for a stock?</h2>
      <p>
        Here is where most explanations stop being useful. They tell you what a
        drawdown is, then advise you to &ldquo;check the stock&rsquo;s
        history&rdquo; without showing you how or what to look for.
      </p>
      <p>
        The answer is that normal is different for every company, and the only
        sensible comparison is against that company&rsquo;s own record.
      </p>
      <p>
        It is also why the usual vocabulary does not help here. If you have wondered
        where the familiar thresholds come from, that is covered in{' '}
        <Link href="/learn/dip-correction-crash">
          Dip, correction, crash — what&rsquo;s the difference?
        </Link>
      </p>

      <h3>Why the market&rsquo;s average tells you nothing about your company</h3>
      <p>
        You will find plenty of statistics about how often the market as a whole
        falls: a 10% drop roughly six years in ten, a 20% drop around once every
        four years. These describe an index of hundreds of companies averaged
        together.
      </p>
      <p>
        Individual shares are far more volatile than that average, and they differ
        enormously from one another. Some fall 30% as a matter of routine. Others
        have rarely dropped more than 12% in their entire history. A 25% fall is
        ordinary weather for the first kind and a genuinely unusual event for the
        second — and the market&rsquo;s average cannot tell you which one you are
        holding.
      </p>
      <p>
        So the question worth asking is not &ldquo;is 25% a big fall?&rdquo; It is
        &ldquo;is 25% a big fall <strong>for this company</strong>?&rdquo;
      </p>

      <h3>A worked example, using real figures</h3>
      <p>
        Take {LANDING.name}, using its full price record to {asOfWords}, on the{' '}
        {PRESET_LABELS.medium.toLowerCase()} horizon.
      </p>
      <p>
        It was recently <strong>{depth(LANDING.currentDrawdownPct)}</strong> below
        its one-year high. On its own, that sounds like a meaningful drop.
      </p>
      <p>
        Set against its own history, it is unremarkable. Across{' '}
        {LANDING.pullbackEvents.toLocaleString('en-AU')} separate falls of more
        than {MEDIUM_FALL}% in its record, the average one ran to{' '}
        <strong>{depth(LANDING.typicalDrawdownPct)}</strong>. Today&rsquo;s fall is
        under half of that. And at its worst, the share has fallen{' '}
        <strong>{depth(LANDING.deepestDrawdownPct)}</strong> from a high.
      </p>

      <OwnRecordFigure />

      <p>
        That last number is the one worth sitting with — and it carries a caveat
        that matters. A record long enough to contain a fall of{' '}
        {depth(LANDING.deepestDrawdownPct)} spans eras when the business, its
        products and its finances looked nothing like they do now. The figure is
        real, and it is not a forecast.
      </p>

      <h2>Current drawdown and maximum drawdown</h2>
      <p>
        Two terms that sound similar and answer opposite questions.
      </p>
      <p>
        <strong>Current drawdown</strong> is where the price sits right now
        relative to its recent peak. It changes every day, and it goes to zero the
        moment the share sets a new high.
      </p>
      <p>
        <strong>Maximum drawdown</strong> is the deepest fall in the record — the
        worst it has ever been, historically. It does not change from day to day,
        and it is the standard measure of how painful holding something has been at
        its worst.
      </p>
      <p>
        The distinction matters because a stock sitting in a 15% current drawdown
        has not necessarily finished falling. The current figure describes a
        situation that is still unfolding; the maximum describes one that has
        already played out.
      </p>

      <h2>Why the deepest number is worth knowing before you buy</h2>
      <p>
        The average fall tells you what usually happens. The deepest fall tells you
        what has actually happened, at least once, to this exact company.
      </p>
      <p>
        Those are different questions, and the second one is more useful, because
        it is the one that decides whether you could have held on.
      </p>
      <p>
        A company that typically dips {depth(LANDING.typicalDrawdownPct)} and has
        once fallen {depth(LANDING.deepestDrawdownPct)}{' '}
        is not a company where &ldquo;it can&rsquo;t drop much further&rdquo; is
        supported by its own record. Knowing that in advance is worth more than any
        rating, because it is the number that tells you what you would need to be
        able to sit through.
      </p>

      <h2>What a drawdown cannot tell you</h2>
      <p>
        A drawdown is one measurement. It is silent on four things that matter at
        least as much.
      </p>
      <ul>
        <li>
          <strong>Why the price fell.</strong> A market-wide panic and a collapsing
          business produce a similar-looking number and call for opposite responses.
        </li>
        <li>
          <strong>Whether the company is any good.</strong> That is answered by the
          accounts — profitability, debt, cash flow — not by the price chart.
        </li>
        <li>
          <strong>Whether it will recover.</strong> Every past recovery in the
          record happened. That is not a promise about the next one. A share that
          has fallen {depth(LANDING.typicalDrawdownPct)} nine times can fall 60% on
          the tenth.
        </li>
        <li>
          <strong>How long a recovery would take.</strong> Two shares can fall by
          the same amount and take wildly different lengths of time to climb back,
          and time is a real cost.
        </li>
      </ul>
      <p>
        This is why MajorCycle never ranks a stock on the fall alone. Where a share
        sits in its own cycle is one input; how healthy the business underneath it
        is counts for more.
      </p>

      <h2>Four questions to ask before buying a share that has fallen</h2>
      <ol>
        <li>
          <strong>How far is it down now?</strong>{' '}
          The current drawdown, on a window you have chosen deliberately.
        </li>
        <li>
          <strong>How far does this company normally fall?</strong>{' '}
          Its average, from its own record — not the market&rsquo;s.
        </li>
        <li>
          <strong>What is the worst it has ever done?</strong>{' '}
          The maximum drawdown.
        </li>
        <li>
          <strong>Could you have held through question 3?</strong>{' '}
          If the honest answer is no, the first three numbers do not matter.
        </li>
      </ol>
      <p>
        Question four is the one people skip, and it is the one that does the work.
        It changes the subject from <em>is this cheap?</em> to{' '}
        <em>could I survive being wrong about the timing?</em> Nobody can answer the
        first in advance. You can answer the second honestly, today.
      </p>

      <h2>See the numbers for any stock, free</h2>
      <p>
        Everything in this article — the current fall, the average fall across a
        company&rsquo;s whole record, the deepest fall it has ever had, on any
        window from {tradingDaysInWords(MIN_BARS)} to {tradingDaysInWords(MAX_BARS)}{' '}
        — is available on a free MajorCycle account.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up any company on
        the US, Australian or Canadian markets.
      </p>
    </>
  ),

  'dip-correction-crash': () => (
    <>
      <h2>The three words, and the numbers behind them</h2>
      <p>Here they are, plainly, because that is what you came for.</p>
      <ul>
        <li>
          <strong>Dip</strong>{' '}
          — a fall of less than {mag(CORRECTION_PCT)}{' '}
          from a recent high. Common,
          usually brief, and often over before it has a name.
        </li>
        <li>
          <strong>Correction</strong>{' '}
          — a fall of {mag(CORRECTION_PCT)}{' '}
          or more. Ordinary enough that the market
          has one every year or two.
        </li>
        <li>
          <strong>Crash</strong>{' '}
          — a fall that is severe <em>and fast</em>. There is no agreed percentage.
          What makes a crash is the speed.
        </li>
      </ul>

      <h3>The fourth word people usually mean</h3>
      <p>
        Most explanations stop at three and quietly get the last one wrong. When
        someone says &ldquo;a {mag(CRASH_PCT)}{' '}
          crash&rdquo;, they almost always mean
        a <strong>bear market</strong> — a fall of {mag(CRASH_PCT)}{' '}
          or more that
        unfolds over months.
      </p>
      <p>
        The difference is time, and it matters more than the label. A bear market is
        a long grind, and you can watch one arrive. A crash is measured in days, and
        you cannot. Two very different experiences to sit through, frequently given
        the same name.
      </p>

      <MarketWordsFigure />

      <h2>Where those numbers came from</h2>
      <h3>Nobody voted on this</h3>
      <p>
        There is no committee. No regulator sets the threshold, no exchange enforces
        it, and no textbook derived {mag(CORRECTION_PCT)}{' '}
          from anything.
      </p>
      <p>
        They are round numbers. They stuck because financial journalists needed a
        consistent way to say &ldquo;this one is bigger than usual&rdquo;, and a
        round figure is easy to write and easy to remember. That is the whole origin
        story.
      </p>
      <p>
        This is not a criticism. Shared shorthand is genuinely useful — it means two
        people can discuss the same event without defining terms first. It is only a
        problem when a convenient label gets treated as a measurement.
      </p>

      <h2>They were built for the index, not for your company</h2>
      <p>
        This is the part that almost every explanation skips, and it is the one that
        changes what you do with the words.
      </p>
      <p>
        The {mag(CORRECTION_PCT)}{' '}
          and {mag(CRASH_PCT)}{' '}
          figures describe an{' '}
        <strong>index</strong>{' '}
        — the S&amp;P 500, the ASX 200, the S&amp;P/TSX 60. An
        index is hundreds of companies averaged together, and averaging is exactly
        what makes those thresholds meaningful. For a whole market to fall{' '}
        {mag(CORRECTION_PCT)}, hundreds of companies have to fall at once. That is a
        rare, informative event.
      </p>
      <p>
        An individual company is not an average of anything. It is one business, and
        it moves on its own news.
      </p>

      <h3>Why a {mag(CRASH_PCT)}{' '}
          fall in one share isn&rsquo;t a crash</h3>
      <p>
        An index is a crowd, and a crowd moves slowly because its members disagree.
        One company&rsquo;s disaster is a competitor&rsquo;s windfall; a bad quarter
        here is offset by a good one there. Averaging cancels most of it out, which
        is precisely why a fall big enough to show up in the average is worth a name.
      </p>
      <p>
        Nothing cancels inside a single company. A {mag(CRASH_PCT)}{' '}
        move in an index needs most of the market to agree. A {mag(CRASH_PCT)}{' '}
        move in one share needs one earnings call, one regulator, or one contract
        lost — which is why it happens so much more often, and means so much less
        when it does.
      </p>
      <p>
        Apply &ldquo;{mag(CRASH_PCT)}{' '}
          equals crash&rdquo; to both and you get the
        same word for two completely different situations: one entirely
        unremarkable, one genuinely unprecedented.
      </p>

      <h3>The same number, two different events</h3>
      <p>
        Picture two companies, both down {mag(TODAY_PCT)}{' '}
          from their highs today.
      </p>
      <p>
        The first falls a long way as a matter of course. Its average fall is{' '}
        {mag(ROUTINE.stats.typical ?? 0)}, and it has been{' '}
        {mag(ROUTINE.stats.lowest ?? 0)}{' '}
          down before now. Today&rsquo;s{' '}
        {mag(TODAY_PCT)}{' '}
          is <strong>shallower than one of its ordinary years</strong>.
      </p>
      <p>
        The second has traded quietly for as long as anyone has watched it. It
        normally falls {mag(QUIET.stats.typical ?? 0)}, and the worst in its whole
        record was {mag(QUIET.stats.lowest ?? 0)}. Today&rsquo;s {mag(TODAY_PCT)}{' '}
          is{' '}
        <strong>deeper than anything that has ever happened to it</strong> — something
        is going on that has not gone on before.
      </p>


      <TwoRecordsFigure />

      <p>
        <strong>Same number. Opposite meanings.</strong>{' '}
          And dip, correction and
        crash cannot tell them apart, because they were never designed to. That is
        not a flaw in the words; it is a flaw in using them for a job they were not
        built for.
      </p>

      <h2>What MajorCycle does instead</h2>
      <p>
        We do not have a fixed threshold for &ldquo;a fall worth counting&rdquo;,
        because we do not think a fixed threshold can be right for every company.
      </p>
      <p>
        Instead it is a setting you control. Each of the three ready-made horizons
        carries its own figure — the shortest counts a fall of{' '}
        {Math.abs(PRESETS.short.pullbackThreshold)}%, the medium{' '}
        {Math.abs(PRESETS.medium.pullbackThreshold)}%, the longest{' '}
        {Math.abs(PRESETS.long.pullbackThreshold)}% — because a three-month window and
        a three-year window are not looking for the same size of event. On{' '}
        <strong>Custom</strong>, you set it yourself, anywhere from {MIN_FALL}% to{' '}
        {MAX_FALL}%.
      </p>
      <p>
        Then, rather than telling you whether a fall crosses some universal line, we
        compare it with <strong>that company&rsquo;s own record</strong>: how far it
        typically falls, and the deepest it has ever fallen. Those two numbers do the
        job that &ldquo;correction&rdquo; and &ldquo;crash&rdquo; cannot, because
        they are specific to the business you are actually looking at.
      </p>
      <p>
        If you want the mechanics of how a fall is measured in the first place, that
        is covered in{' '}
        <Link href="/learn/what-is-a-drawdown">What is a drawdown?</Link>
      </p>

      <h2>So which word should you use?</h2>
      <p>
        For the market as a whole, the conventional words are fine. If the index is
        down 12%, &ldquo;correction&rdquo; is accurate, widely understood, and saves
        everyone a paragraph.
      </p>
      <p>
        For a single company, they are close to useless. &ldquo;This share is in a
        correction&rdquo; tells you it has fallen {mag(CORRECTION_PCT)}{' '}
          and nothing
        else — not whether that is normal for it, not whether it has been much worse
        before, not whether anything is actually wrong.
      </p>
      <p>
        It is also worth knowing that the number being quoted is not measured the way
        most people assume — see{' '}
        <Link href="/learn/52-week-high">What a 52-week high really tells you</Link>.
      </p>
      <p>
        A more useful sentence has the company&rsquo;s own history in it:{' '}
        <em>
          it is down {mag(TODAY_PCT)}, it usually falls about{' '}
          {mag(ROUTINE.stats.typical ?? 0)}, and its worst ever was{' '}
          {mag(ROUTINE.stats.lowest ?? 0)}
        </em>
        . That is three facts instead of one label, and it is the difference between
        naming a situation and understanding it.
      </p>

      <h2>What none of these words tell you</h2>
      <p>
        Whichever label you land on, it is a name for how far an index fell. Four
        things it leaves out, all of which change what you should make of it.
      </p>
      <ul>
        <li>
          <strong>Which companies actually fell.</strong>{' '}
          An index down 10% is an average. Inside it some shares are down 40%, and a
          few are up. The label describes the crowd, never anyone in it.
        </li>
        <li>
          <strong>Whether the fall has finished.</strong>{' '}
          These words name the depth reached, never the depth remaining. A
          &ldquo;correction&rdquo; is only ever called one after the fact, which is
          why nobody can tell you at the time whether it is one.
        </li>
        <li>
          <strong>How fast it happened.</strong>{' '}
          The same {mag(CRASH_PCT)} gets called a crash or a bear market. One arrives
          in days and the other over months, and only one of them can be watched
          coming — a difference the percentage hides completely.
        </li>
        <li>
          <strong>What it means for you.</strong>{' '}
          The same fall is an inconvenience to someone with twenty years and a
          serious problem to someone who needs the money next year. No label knows
          your circumstances.
        </li>
      </ul>
      <p>
        A word for how far something fell is a description, not a diagnosis. It is a
        reasonable place to start looking, and a poor place to stop.
      </p>

      <h2>See it for any stock, free</h2>
      <p>
        Where a share sits against its own record — today&rsquo;s fall, its average
        fall, and the deepest in its history — is available on a free MajorCycle
        account, across the US, Australian and Canadian markets.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up any company you
        are thinking about.
      </p>
    </>
  ),

  '52-week-high': () => (
    <>
      <h2>What the number actually is</h2>
      <p>
        The 52-week high is the highest price a share has traded at during the last
        52 weeks. Its twin, the 52-week low, is the lowest.
      </p>
      <p>
        Two things about it are worth knowing straight away, and neither is usually
        said.
      </p>
      <p>
        <strong>It moves every day.</strong>{' '}
        It is not a fixed landmark. The window slides forward each session, so a high
        set thirteen months ago silently drops out and the number falls — with
        nothing at all happening to the company. A share can be further from its
        52-week high on Tuesday than it was on Monday because{' '}
        <em>last year&rsquo;s Monday</em> left the window.
      </p>
      <p>
        <strong>It is a single moment, not a period.</strong>{' '}
        One trade, on one day, at one price. It can be set in the first minute of a
        session and never revisited.
      </p>

      <h2>Why the chart&rsquo;s peak never quite reaches the quoted high</h2>
      <p>
        Here is something almost nobody explains, and it puzzles people who look
        closely enough to notice it.
      </p>
      <p>
        Pull up a company&rsquo;s price chart and find the highest point on the line.
        Then look at the 52-week high quoted beside it.{' '}
        <strong>They will not match.</strong> The quoted number is higher — usually
        by a percent or two, sometimes more.
      </p>
      <p>Nothing is broken. They are two different measurements.</p>

      <h3>The quoted high is a moment; the chart line is a day</h3>
      <p>
        Almost every price chart is drawn from <strong>closing</strong> prices: one
        price per day, the one the market settled at. That is what turns a year of
        trading into a line you can read.
      </p>
      <p>
        The quoted 52-week high is an <strong>intraday</strong> extreme: the highest
        price anyone paid at any instant, including a spike that lasted seconds and
        was gone by the close.
      </p>
      <p>
        A line made of closing prices can never reach a price that no close ever
        touched. The gap between them is the size of the year&rsquo;s biggest
        intraday spike.
      </p>

      <WeekHighFigure />

      <p>
        <strong>The 52-week low works the same way, in reverse.</strong>{' '}
        It is the bottom of the lowest wick — a moment of panic selling that was
        bought back before the bell. In the chart above, the low sits{' '}
        {LOW_GAP_PCT.toFixed(1)}% below the year&rsquo;s worst close, so anyone
        comparing &ldquo;how far above its low&rdquo; against a chart meets the same
        disagreement at the other end.
      </p>

      <h3>Charts usually adjust for dividends too</h3>
      <p>
        There is a second, smaller effect. Most historical charts are{' '}
        <strong>dividend-adjusted</strong>: past prices are shifted down slightly so
        the line reflects what an investor actually earned, dividends included,
        rather than the raw price on the day.
      </p>
      <p>
        That makes returns comparable over time, which is the right choice. It also
        nudges historical peaks a little lower than the prices really quoted at the
        time. Over a single year this is the smaller of the two effects for most
        companies — the intraday-versus-closing difference does most of the work.
      </p>

      <h3>Which number to use for what</h3>
      <ul>
        <li>
          <strong>Comparing against what brokers, screeners and news quote.</strong>{' '}
          Use the 52-week high. It is the standard, and using anything else means
          quietly disagreeing with every source your reader can check.
        </li>
        <li>
          <strong>Reading a chart, or comparing returns over time.</strong>{' '}
          Use the chart&rsquo;s own line. It is internally consistent, which is what
          a comparison needs.
        </li>
      </ul>
      <p>
        The mistake is not choosing one. It is expecting them to agree, and assuming
        something is broken when they do not.
      </p>

      <h2>A 52-week high is a fact about a window, not about a company</h2>
      <p>This is where the number gets over-read.</p>
      <p>
        &ldquo;At its 52-week high&rdquo; sounds like a statement about a business.
        It is a statement about <strong>one year of prices</strong>. Change the
        window and the meaning changes with it:
      </p>
      <ul>
        <li>
          A share can sit at a 52-week high and remain far below its all-time high.
          It is recovering, not thriving.
        </li>
        <li>
          A share can be well below its 52-week high and still be up substantially
          over five years.
        </li>
        <li>
          A company that listed ten months ago has a 52-week high covering almost
          its entire life. The same phrase means something quite different there.
        </li>
      </ul>
      <p>
        The number tells you where today sits inside one particular year. It says
        nothing about whether that year was a sensible one to measure against.
      </p>

      <h2>How MajorCycle uses it</h2>
      <p>
        Our default horizon looks back {PRESETS.medium.lookbackBars} trading days —
        about a year — so the high it measures from is, in effect, the 52-week high.
        That is deliberate: it is the window most people already have in their heads.
      </p>
      <p>
        Two things we do differently. We show you{' '}
        <strong>where today sits inside the range</strong>, not just the two
        endpoints, so &ldquo;near the high&rdquo; is something you can see rather
        than calculate. And we do not stop at one year: the same stock measured over{' '}
        {PRESET_HORIZONS.short.replace('~', 'roughly ')} or{' '}
        {PRESET_HORIZONS.long.replace('~', 'roughly ')} produces a different high, a
        different distance, and often a different impression. The window is a setting
        you control, because which year matters depends on how long you intend to
        hold — not on a convention.
      </p>
      <p>
        If you want the mechanics of how distance from a high is measured, that is
        covered in{' '}
        <Link href="/learn/what-is-a-drawdown">What is a drawdown?</Link>
      </p>

      <h2>What it cannot tell you</h2>
      <p>
        A 52-week high is one price, from one moment, in one window. It is silent on
        everything that decides whether it matters.
      </p>
      <ul>
        <li>
          <strong>Whether the price is high or low relative to the business.</strong>{' '}
          That is a question about earnings, debt and cash flow, not about last
          year&rsquo;s trading range.
        </li>
        <li>
          <strong>Why the high was set.</strong>{' '}
          A steady climb and a one-day spike on takeover speculation leave the same
          mark.
        </li>
        <li>
          <strong>What happens next.</strong>{' '}
          Sitting at a 52-week high is equally consistent with a long advance
          continuing and with it ending. The number does not distinguish them.
        </li>
        <li>
          <strong>Whether the year was representative.</strong>{' '}
          Pick a window starting just after a{' '}
          <Link href="/learn/dip-correction-crash">crash</Link> and everything looks
          strong. That is the window flattering the company, not the company earning
          it.
        </li>
      </ul>
      <p>It is a useful piece of context, and a poor conclusion.</p>

      <h2>See where any stock sits, free</h2>
      <p>
        Where a share sits between its 52-week low and high — and how that changes
        when you widen or narrow the window — is available on a free MajorCycle
        account, across the US, Australian and Canadian markets.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up any company you
        are curious about.
      </p>
    </>
  ),
};
