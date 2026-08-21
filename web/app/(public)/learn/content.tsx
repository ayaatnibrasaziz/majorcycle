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
import { BargainFigure } from '@/components/learn/BargainFigure';
import { PeFigure } from '@/components/learn/PeFigure';
import { HealthShapeFigure } from '@/components/learn/HealthShapeFigure';
import { AnalystTargetFigure } from '@/components/learn/AnalystTargetFigure';
import { RatingFigure } from '@/components/learn/RatingFigure';
import { IndexAverageFigure } from '@/components/learn/IndexAverageFigure';
import { PriceRecoveryFigure } from '@/components/learn/PriceRecoveryFigure';
import { DividendFigure } from '@/components/learn/DividendFigure';
import { LimitsFigure } from '@/components/learn/LimitsFigure';
import {
  DISTRESS_YIELD_PCT,
  PAYOUT_COMFORTABLE_MAX,
  PAYOUT_STRAINED_MAX,
} from '@/lib/dividends';
import { FALL_PCT } from '@/components/learn/bargainGeometry';
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
      <p>
        And a fall on its own does not answer the first question either — that
        depends on the business behind it, which is covered in{' '}
        <Link href="/learn/falling-price-bargain-or-warning">
          Is a falling share price a bargain or a warning?
        </Link>
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
        A more useful sentence has the company&rsquo;s own history in it:{' '}
        <em>
          it is down {mag(TODAY_PCT)}, it usually falls about{' '}
          {mag(ROUTINE.stats.typical ?? 0)}, and its worst ever was{' '}
          {mag(ROUTINE.stats.lowest ?? 0)}
        </em>
        . That is three facts instead of one label, and it is the difference between
        naming a situation and understanding it.
      </p>
      <p>
        It is also worth knowing that the number being quoted is not measured the way
        most people assume — see{' '}
        <Link href="/learn/52-week-high">What a 52-week high really tells you</Link>.
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

      <h2>Why a chart&rsquo;s peak often sits below the quoted high</h2>
      <p>
        Here is something almost nobody explains, and it puzzles people who look
        closely enough to notice it.
      </p>
      <p>
        Pull up a company&rsquo;s price chart, find its highest point, and compare it
        with the 52-week high quoted beside it. On most charts{' '}
        <strong>they will not match.</strong> The quoted number is higher — usually
        by a percent or two, sometimes more.
      </p>
      <p>Nothing is broken. They are two different measurements.</p>

      <h3>The quoted high is a moment; a closing price is a whole day</h3>
      <p>
        The quoted 52-week high is an <strong>intraday</strong> extreme: the highest
        price anyone paid at any instant, including a spike that lasted seconds and
        was gone by the close.
      </p>
      <p>
        Most charts you meet — in a news story, on a broker&rsquo;s summary page, in a
        search result — are <strong>lines drawn through closing prices</strong>: one
        price per day, the one the market settled at. A line made of closes can never
        reach a price that no close ever touched, so its peak stops short. The gap is
        the size of the year&rsquo;s biggest intraday spike.
      </p>

      <h3>A candlestick chart draws both, which is why we use one</h3>
      <p>
        A candlestick chart records more per day. The solid body still spans the open
        and the close, but the thin line through it — the wick — marks the full range
        traded. So the quoted high <em>is</em> on the chart: it is the tip of the
        tallest wick, not the top of the tallest body.
      </p>
      <p>
        That is why the answer depends on what you compare. Against the closes, the
        quoted high sits above the chart. Against the wicks, it matches.{' '}
        <strong>
          MajorCycle draws candlesticks, so on our own price chart the quoted
          52-week high is the tip of the tallest wick you can see.
        </strong>{' '}
        If you are comparing against a line chart somewhere else, expect the
        disagreement — and now you know which of the two numbers moved.
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
        <strong>dividend-adjusted</strong>, ours included: past prices are shifted
        down slightly so the chart reflects what an investor actually earned,
        dividends included, rather than the raw price on the day.
      </p>
      <p>
        That makes returns comparable over time, which is the right choice. It also
        nudges historical peaks a little lower than the prices really quoted at the
        time — which is why our own tallest wick can sit a whisker below the quoted
        high rather than exactly on it. Over a single year this is much the smaller
        of the two effects for most companies; the intraday-versus-closing difference
        does the bulk of the work.
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
          Use the chart&rsquo;s own figures. They are internally consistent, which is
          what a comparison needs.
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
        Two different numbers sit on the same page, and knowing which is which saves
        a lot of confusion.
      </p>
      <p>
        <strong>The 52-week range is fixed.</strong>{' '}
        We show it in the header of every stock page as a gauge: the low at one end,
        the high at the other, and a marker where today&rsquo;s price sits between
        them — so &ldquo;near the high&rdquo; is something you can see rather than
        calculate. It is the standard figure, taken straight from market data, and it
        is <em>always</em> 52 weeks. No setting moves it. That is the point of it:
        it is the number you can check against any broker or screener and get the
        same answer.
      </p>
      <p>
        <strong>The Major Cycle window is yours to choose.</strong>{' '}
        That is our own measurement, and it is a different question — not
        &ldquo;where does today sit in the last year?&rdquo; but &ldquo;how far is
        today below the highest price of the period I care about?&rdquo; You pick the
        period on Browse before opening a stock:{' '}
        {PRESET_LABELS.short} ({PRESET_HORIZONS.short.replace('~', 'roughly ')}),{' '}
        {PRESET_LABELS.medium} ({PRESET_HORIZONS.medium.replace('~', 'roughly ')}) or{' '}
        {PRESET_LABELS.long} ({PRESET_HORIZONS.long.replace('~', 'roughly ')}).
      </p>
      <p>
        At the default {PRESET_LABELS.medium} setting that window is{' '}
        {PRESETS.medium.lookbackBars} trading days — about a year — so the peak it
        measures from is the 52-week high, give or take a rounding difference. Widen
        it to {PRESET_LABELS.long} and the peak becomes the highest price in{' '}
        {PRESET_HORIZONS.long.replace('~', 'roughly ')}, the distance grows, and the
        impression often changes with it. The gauge is a convention; the window is a
        choice — because which peak matters depends on how long you intend to hold,
        and the 52-week range was never designed to answer that.
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
        Where a share sits between its 52-week low and high — and how far it stands
        below the peak of whatever period you choose — is available on a free
        MajorCycle account, across the US, Australian and Canadian markets.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up any company you
        are curious about.
      </p>
    </>
  ),

  'falling-price-bargain-or-warning': () => (
    <>
      <h2>&ldquo;Cheap&rdquo; is not the same as &ldquo;cheaper&rdquo;</h2>
      <p>
        A share that was $100 and is now $70 is <strong>cheaper</strong>. Whether it
        is <strong>cheap</strong> is a different question entirely, and the price
        alone cannot answer it.
      </p>
      <p>
        Cheaper compares today&rsquo;s price with yesterday&rsquo;s. Cheap compares
        today&rsquo;s price with what the business is actually worth. Those are two
        different comparisons, and only one of them is about the company.
      </p>
      <p>
        This sounds obvious written down. It is remarkably easy to forget while
        looking at a chart, because a falling line is doing such a good impression of
        an answer.
      </p>

      <h2>A fall means one of two things</h2>
      <p>
        Every large fall comes down to one of two causes, and telling them apart is
        most of the work.
      </p>
      <p>
        <strong>The mood changed.</strong>{' '}
        Interest rates moved, the sector fell out of favour, a bigger market panic
        dragged everything down with it, or the company simply got less exciting than
        it was last year. Nothing about the business is different. The same products
        are sold to the same customers at the same margins.
      </p>
      <p>
        <strong>The business changed.</strong>{' '}
        Sales are shrinking. Margins are being squeezed. Debt that was comfortable is
        now expensive. A key product failed, a licence was lost, or a competitor
        arrived and is winning.
      </p>
      <p>
        The first kind of fall creates opportunities. The second kind is the market
        telling you something true, and often telling you early.
      </p>
      <p>
        Here is the difficulty:{' '}
        <strong>on a price chart these look exactly the same.</strong> A{' '}
        {Math.abs(FALL_PCT)}% fall is a {Math.abs(FALL_PCT)}% fall. There is no line
        on the chart that separates a company having a bad year from a company in
        real trouble.
      </p>

      <BargainFigure />

      <h2>What to check before calling it a bargain</h2>
      <p>
        If the chart cannot answer the question, the accounts have to. Five things
        are worth checking, and they are the same five we score.
      </p>

      <h3>1. Is it profitable, and is it staying profitable?</h3>
      <p>
        Not just &ldquo;does it make money&rdquo; but whether the margin — the slice
        of each dollar of sales it keeps — is holding up. A company whose sales are
        flat but whose margins are quietly shrinking is a business getting worse,
        slowly.
      </p>

      <h3>2. Can it survive a bad year?</h3>
      <p>
        This is the balance sheet: what it owns against what it owes. A company with
        modest debt and cash in the bank can absorb a rough patch. A heavily indebted
        one has no room, and its lenders get paid before its shareholders do.
      </p>

      <h3>3. Is it growing?</h3>
      <p>
        Revenue and earnings, over several years rather than one. A single weak year
        happens to everyone. A pattern of decline is a different story, and price
        falls tend to follow it rather than lead it.
      </p>

      <h3>4. Does the profit turn into actual cash?</h3>
      <p>
        Reported profit is an accounting figure. Cash is what pays wages, interest
        and dividends. When profits look healthy but cash does not follow, that gap
        is worth understanding before anything else.
      </p>

      <h3>5. What does it return to shareholders?</h3>
      <p>
        Dividends and buybacks. A dividend that is comfortably covered by earnings is
        a sign of confidence. One that is not covered is a promise on borrowed time —
        and cutting it usually costs the share price more than keeping it ever did.
      </p>
      <p>
        None of these is decisive alone. Together they answer the question the chart
        cannot: is this a good business having a bad year, or a business getting
        worse?
      </p>

      <h2>The value trap</h2>
      <p>This is the specific trap the question walks into.</p>
      <p>
        A <strong>value trap</strong> is a share that looks cheap on every measure,
        gets cheaper, and keeps looking cheap all the way down. Buyers arrive at each
        new low convinced they have found a bargain, because by the usual yardsticks
        it genuinely is one.
      </p>
      <p>
        The reason is simple. Those yardsticks compare today&rsquo;s price against{' '}
        <strong>past</strong> earnings — the{' '}
        <Link href="/learn/pe-ratio">P/E ratio</Link>{' '}
        being the one everybody quotes. If the earnings are on their way down, the
        comparison flatters the company — and it flatters it more with every fall.
        The share never looks expensive again, and the business never recovers.
      </p>
      <p>
        Falling shares in structural decline are where value traps live. That is
        precisely where &ldquo;it&rsquo;s down 40%, it must be cheap&rdquo; leads
        people.
      </p>

      <h2>When a fall genuinely is an opportunity</h2>
      <p>Set against that, the honest version of the case:</p>
      <ul>
        <li>
          The <strong>business</strong> is intact — profits, debt and cash all look
          much as they did before the fall
        </li>
        <li>
          The reason for the fall is <strong>outside</strong> the company, or is
          something temporary and identifiable
        </li>
        <li>
          The company has fallen <strong>this far before</strong> and traded through
          it
        </li>
        <li>Nothing in the accounts has changed direction, only the price has</li>
      </ul>
      <p>
        That last point is worth its own sentence.{' '}
        <strong>A fall is more interesting when the accounts have not moved with it.</strong>{' '}
        When the price drops and the business drops with it, the market is simply
        keeping up. When the price drops and the business does not, there is at least
        a question worth asking.
      </p>

      <h2>What a falling price can never tell you</h2>
      <ul>
        <li>
          <strong>Whether the company is worth more than it costs.</strong>{' '}
          That is a question about the business, and the price is not evidence about
          itself.
        </li>
        <li>
          <strong>Whether the fall is over.</strong>{' '}
          Nothing in a fall says how much further it goes. Shares that have fallen 50%
          can fall 50% again.
        </li>
        <li>
          <strong>Why it fell.</strong>{' '}
          A market-wide panic and a failed product leave the same mark on the chart.
        </li>
        <li>
          <strong>How long recovery takes.</strong>{' '}
          Some falls are recovered in weeks and some are never recovered at all.
        </li>
      </ul>
      <p>
        A falling price is the beginning of the question, not the answer to it.
      </p>

      <h2>How MajorCycle helps</h2>
      <p>We split the question into its two halves, deliberately.</p>
      <p>
        <strong>How far has it fallen, and is that unusual for this company?</strong>{' '}
        That is the cycle side, and it is covered in{' '}
        <Link href="/learn/what-is-a-drawdown">What is a drawdown?</Link> and{' '}
        <Link href="/learn/dip-correction-crash">Dip, correction, crash</Link>. The
        useful comparison is a company against its own history, not against a round
        number.
      </p>
      <p>
        <strong>Is the business behind it healthy?</strong>{' '}
        That is the five checks above. Every figure they are built from — profits,
        debt, growth, cash flow, dividends — is on the stock page for free, so you
        can read the accounts yourself whether or not you ever pay us.
      </p>
      <p>
        Our <strong>Health Score</strong> rolls those five into a single number,
        weighted the way we think they deserve, and that part is a paid feature. It
        is a shortcut, not a secret: the data is free, our judgement of it is what
        you would be paying for.
      </p>
      <p>
        Neither number is a recommendation. A strong business can be a poor
        investment at the wrong price, and both halves of the question have to be
        asked.
      </p>

      <h2>See both halves for any stock, free</h2>
      <p>
        How far a share has fallen against its own history — and the accounts of the
        company behind it — are available on a free MajorCycle account, across the
        US, Australian and Canadian markets.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up any company you
        are curious about.
      </p>
    </>
  ),

  'pe-ratio': () => (
    <>
      <h2>What it actually is</h2>
      <p>
        P/E stands for <strong>price to earnings</strong>. It is one number divided
        by another: the share price, divided by the profit per share over the last
        year.
      </p>
      <p>
        A company earning $5 per share, trading at $100, has a P/E of 20.
      </p>
      <p>
        The useful way to read that:{' '}
        <strong>you are paying $20 for every $1 the company earns in a year.</strong>{' '}
        Or, put another way, at today&rsquo;s rate of profit it would take 20 years
        of earnings to add up to what you paid.
      </p>
      <p>
        That is the whole calculation. Everything difficult about the P/E is in the
        interpretation.
      </p>

      <h2>There is no &ldquo;good&rdquo; P/E</h2>
      <p>
        This is the part most people want a number for, and there isn&rsquo;t one.
      </p>
      <p>
        A P/E of 12 is unremarkable for a bank and remarkable for a fast-growing
        software company. A P/E of 40 is alarming for a supermarket and ordinary for
        a business doubling in size every two years. The ratio on its own says
        nothing at all.
      </p>
      <p>It only becomes useful as a comparison, and there are two worth making:</p>
      <ul>
        <li>
          <strong>Against the company&rsquo;s own history.</strong>{' '}
          Is this business more expensive than it usually is, or less?
        </li>
        <li>
          <strong>Against similar companies.</strong>{' '}
          Is it more expensive than its direct competitors, and if so, why?
        </li>
      </ul>
      <p>
        Both of those have an answer. &ldquo;Is 18 a good P/E?&rdquo; does not.
      </p>

      <h2>Why you cannot compare across industries</h2>
      <p>
        A high P/E means investors expect earnings to grow. A low one means they
        don&rsquo;t. That expectation is built into every industry differently.
      </p>
      <p>
        Software companies sell the same product repeatedly at almost no extra cost,
        so profits can grow quickly — and investors pay in advance for that growth.
        Banks, utilities and miners are shaped by things that move slowly: capital,
        regulation, commodity prices. Their earnings rarely surprise anyone, and the
        price reflects that.
      </p>
      <p>
        Comparing a P/E across two industries is comparing two different
        expectations, not two prices. That is why any sensible comparison is against
        a <strong>peer group</strong>, and why a screen for &ldquo;P/E under
        10&rdquo; mostly returns industries that always trade under 10.
      </p>

      <h2>The three ways it misleads</h2>

      <h3>1. Earnings are falling</h3>
      <p>
        This is the big one, and it is exactly the{' '}
        <Link href="/learn/falling-price-bargain-or-warning">value trap</Link> at
        work.
      </p>
      <p>
        The &ldquo;E&rdquo; in P/E is the <strong>last twelve months</strong> of
        profit — history. If profits are shrinking, that history is better than the
        present, and the ratio flatters the company. Worse, it keeps flattering it:
        as the price falls, the ratio falls too, so the share looks cheaper at every
        stage of its decline.
      </p>
      <p>
        A company can look cheap on this measure for years while the business quietly
        disappears. The ratio never warns you, because a falling price and falling
        earnings move it in the same direction.
      </p>

      <PeFigure />

      <h3>2. A one-off event inflated the earnings</h3>
      <p>
        A company sells a building, wins a lawsuit, or books a tax benefit. Profit
        jumps for one year. Divide the price by that inflated figure and the P/E
        collapses to something that looks like a bargain.
      </p>
      <p>
        Next year the one-off is gone, earnings return to normal, and the ratio
        doubles without the share price moving at all.
      </p>

      <h3>3. There are no earnings</h3>
      <p>
        If a company loses money, there is no meaningful P/E. The number is either
        negative or simply absent — you will see a blank or a dash.
      </p>
      <p>
        That is not a data problem. A loss-making company cannot be valued this way,
        and any ratio printed for one should be ignored rather than interpreted.
      </p>

      <h2>Trailing and forward: one is history, one is a guess</h2>
      <p>You will see two versions quoted.</p>
      <p>
        <strong>Trailing P/E</strong>{' '}
        uses the profits the company actually reported over the last twelve months.
        It is a fact. It is also, by definition, out of date.
      </p>
      <p>
        <strong>Forward P/E</strong>{' '}
        uses what analysts <em>expect</em> the company to earn next year. It is more
        current in intent and entirely a forecast.
      </p>
      <p>
        Forward P/E is almost always the lower of the two, because forecasts usually
        assume growth. That makes every share look cheaper on a forward basis, which
        is worth remembering when a number is quoted at you without saying which one
        it is.
      </p>
      <p>
        Neither is better. They answer different questions, and it is worth knowing
        which one you are reading.
      </p>

      <h2>What a P/E can never tell you</h2>
      <ul>
        <li>
          <strong>Whether the company is any good.</strong>{' '}
          It says nothing about debt, cash generation, or whether the profits are
          durable.
        </li>
        <li>
          <strong>Whether the earnings are real.</strong>{' '}
          Profit is an accounting figure. The ratio treats a solid one and a
          flattered one identically.
        </li>
        <li>
          <strong>Whether the price will rise.</strong>{' '}
          Cheap shares can stay cheap indefinitely, and expensive ones have made
          money for decades.
        </li>
        <li>
          <strong>What the right price is.</strong>{' '}
          It measures what you are paying against what the company earns. It has no
          opinion on whether that is sensible.
        </li>
      </ul>
      <p>
        A P/E is one number in a much longer conversation about whether a business is
        worth owning.
      </p>

      <h2>How MajorCycle shows it</h2>
      <p>
        We show the trailing P/E on every stock page, alongside the other key
        figures — the reported one, not a forecast.
      </p>
      <p>
        We also chart the <strong>P/E over the last five years</strong>, which is the
        comparison that actually helps: not whether 18 is a good number, but whether
        this company is more expensive today than it has usually been. A share on a
        P/E of 18 that has averaged 25 is telling you something. The number 18 on its
        own is not.
      </p>
      <p>
        One thing worth separating: our <strong>Valuation</strong>{' '}
        reading is a different measure entirely. It describes where today&rsquo;s price sits
        inside the company&rsquo;s own history of falls and recoveries — the cycle
        question covered in{' '}
        <Link href="/learn/what-is-a-drawdown">What is a drawdown?</Link> It is not a
        P/E judgement, and the two can disagree. A share can be cheap against its own
        price history and expensive against its earnings at the same time, and
        knowing that is more useful than having one number that hides it.
      </p>

      <h2>See any company&rsquo;s P/E history, free</h2>
      <p>
        The trailing P/E, the five-year P/E chart, and the full set of financial
        figures behind them are available on a free MajorCycle account, across the
        US, Australian and Canadian markets.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up any company you
        are curious about.
      </p>
    </>
  ),

  'is-a-company-financially-healthy': () => (
    <>
      <h2>What &ldquo;healthy&rdquo; actually means</h2>
      <p>
        A healthy company can do two things: survive a bad year without asking
        anyone&rsquo;s permission, and turn a good year into more of itself.
      </p>
      <p>
        Those are separate abilities, and companies often have one without the
        other. A business can be growing fast and be one bad quarter from breaching
        a loan covenant. Another can be utterly safe and going nowhere.
      </p>
      <p>
        Five questions cover it. They are the same five we score, and this article
        is about how to answer each one from figures you can look up.
      </p>

      <h2>1. Does it make money, and keep making it?</h2>
      <p>
        Three margins tell you most of what you need, and each one is a slice of
        every dollar of sales.
      </p>
      <ul>
        <li>
          <strong>Gross margin</strong>{' '}— what is left after the direct cost of
          making the product. High and stable means pricing power.
        </li>
        <li>
          <strong>Operating margin</strong>{' '}— what is left after running the
          business. This is where bloated companies show up.
        </li>
        <li>
          <strong>Net margin</strong>{' '}— what is left after everything, including
          interest and tax.
        </li>
      </ul>
      <p>
        Alongside them, <strong>return on equity</strong>{' '}asks a different question:
        for every dollar shareholders have tied up, how much profit comes back each
        year? A consistently high figure is the mark of a genuinely good business.
      </p>
      <p>
        <strong>What to look for:</strong>{' '}the direction, over several years, more
        than the level. Margins that are drifting down while sales grow mean the
        company is buying its growth.
      </p>

      <h2>2. Can it survive a bad year?</h2>
      <p>This is the balance sheet, and three figures do the work.</p>
      <ul>
        <li>
          <strong>Debt to equity</strong>{' '}— how much it has borrowed against what
          the owners have put in. Low is safe; very high leaves no room for error.
        </li>
        <li>
          <strong>Current ratio</strong>{' '}— whether what it owns in the short term
          covers what it owes in the short term. Under 1 means it does not, which is
          survivable but worth understanding.
        </li>
        <li>
          <strong>Interest cover</strong>{' '}— how many times over its operating profit
          could pay the interest on its debt. This is the one that decides whether a
          downturn is uncomfortable or fatal.
        </li>
      </ul>
      <p>
        Of the three, interest cover is the one to check first. A heavily indebted
        company with enormous interest cover is fine. A modestly indebted one that
        can barely cover its interest is not.
      </p>

      <h2>3. Is it growing?</h2>
      <p>
        Revenue growth and earnings growth, over several years rather than one. One
        weak year happens to everyone; a pattern is a different thing.
      </p>
      <p>
        Watch for the two moving apart. Revenue growing while earnings shrink means
        the growth is costing more than it brings in — worth knowing before deciding
        the company is expanding.
      </p>

      <h2>4. Does the profit turn into cash?</h2>
      <p>
        Profit is an accounting figure and involves judgement. Cash is what pays
        wages, interest and dividends, and involves none.
      </p>
      <p>
        <strong>Free cash flow</strong>{' '}is what is left after the company has paid
        for the equipment and investment it needs to keep running. Two ways to read
        it:
      </p>
      <ul>
        <li>
          <strong>As a margin</strong>{' '}— free cash flow as a share of sales. How much
          of each dollar of revenue ends up as spendable cash.
        </li>
        <li>
          <strong>As a yield</strong>{' '}— free cash flow against the company&rsquo;s
          market value. What the business generates relative to what it costs to buy.
        </li>
      </ul>
      <p>
        A company reporting healthy profits and thin cash flow, year after year, is
        the single most useful warning sign on this list.
      </p>

      <h2>5. What does it return to owners?</h2>
      <p>
        The <strong>payout ratio</strong>{' '}is the share of earnings paid out as
        dividends. Comfortably covered is a sign of confidence. A payout above
        earnings is a promise being funded from somewhere else, and it usually ends
        with a cut.
      </p>
      <p>
        <strong>Share count</strong>{' '}matters too, and almost nobody looks. A company
        steadily buying back its own shares is concentrating your stake. One steadily
        issuing them is diluting it — your slice of the same business gets smaller
        each year, which does not show up in the share price at all.
      </p>
      <p>
        Paying no dividend is not a negative. A company reinvesting everything into
        growth is making a legitimate choice, and it should be read as that rather
        than as a missing figure.
      </p>

      <h2>Why the thresholds are not universal</h2>
      <p>
        Every number above depends on the industry, and applying one rule across all
        of them produces confident nonsense.
      </p>
      <ul>
        <li>
          <strong>Banks</strong>{' '}are built on debt — it is their raw material. Debt
          ratios that would be alarming anywhere else are simply how a bank works.
        </li>
        <li>
          <strong>Utilities and infrastructure</strong>{' '}borrow heavily against very
          predictable income. High debt with high interest cover is the normal shape.
        </li>
        <li>
          <strong>Young or fast-growing companies</strong>{' '}often have negative cash
          flow on purpose, because they are spending to build something.
        </li>
        <li>
          <strong>Miners and energy</strong>{' '}swing with commodity prices, so a single
          year&rsquo;s margins can be the best or worst in a decade.
        </li>
      </ul>
      <p>
        The useful comparison is always the same company over time, and companies
        doing the same thing as each other.
      </p>

      <h2>One score, two very different companies</h2>
      <p>
        This is the limitation worth understanding before you lean on any health
        score, ours included.
      </p>

      <HealthShapeFigure />

      <p>
        A single number is an average, and an average hides its own shape. Two
        businesses can arrive at the same total from opposite directions, and the
        risk you would be taking on is entirely different in each case. The score is
        a place to start, not a substitute for looking.
      </p>

      <h2>What financial health cannot tell you</h2>
      <ul>
        <li>
          <strong>Whether the price is sensible.</strong>{' '}
          A superb business bought at the wrong price is still a poor investment.
          That is the question in{' '}
          <Link href="/learn/pe-ratio">What a P/E ratio does and doesn&rsquo;t tell you</Link>.
        </li>
        <li>
          <strong>What happens next.</strong>{' '}
          These are figures about the past. A healthy company can lose a court case,
          a licence, or its main customer.
        </li>
        <li>
          <strong>Whether management is honest.</strong>{' '}
          Every figure here comes from accounts the company prepared itself.
        </li>
        <li>
          <strong>Whether the industry has a future.</strong>{' '}
          A company can be the healthiest business in a shrinking market.
        </li>
      </ul>

      <h2>How MajorCycle scores it</h2>
      <p>
        We roll the five into one Health Score out of 100, weighted in the order
        above: profitability counts most, then the balance sheet, then growth, cash
        flow and shareholder returns.
      </p>
      <p>
        Two things about how we handle missing data, because they matter more than
        the weighting.
      </p>
      <p>
        <strong>We withhold rather than invent.</strong>{' '}
        If a check has no usable figures, it is left out and the remaining weights
        are rescaled — it is not quietly scored as average. And if too few checks
        have data to be meaningful, we publish no score at all rather than a
        confident-looking number resting on nothing.
      </p>
      <p>
        <strong>The underlying figures are free.</strong>{' '}
        Margins, return on equity, debt, interest cover, growth, free cash flow and
        payout ratios are all on the stock page for anyone with an account. The
        Health Score itself — our judgement of how they combine — is the paid part.
      </p>
      <p>
        A falling price with intact health is a different situation from a falling
        price with deteriorating health, which is the question in{' '}
        <Link href="/learn/falling-price-bargain-or-warning">
          Is a falling share price a bargain or a warning?
        </Link>
      </p>

      <h2>Check any company&rsquo;s figures, free</h2>
      <p>
        Margins, debt, interest cover, growth, cash flow and payout ratios are on
        every stock page on a free MajorCycle account, across the US, Australian and
        Canadian markets.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up any company you
        are curious about.
      </p>
    </>
  ),

  'analyst-price-target': () => (
    <>
      <h2>Where the number comes from</h2>
      <p>
        A professional analyst covers a handful of companies full time. They build a
        model of the business, forecast its earnings, and publish a{' '}
        <strong>price target</strong>: what they think the share should be worth in
        roughly twelve months.
      </p>
      <p>
        The number you see quoted is almost never one person&rsquo;s. It is the{' '}
        <strong>average</strong>{' '}of everyone covering that company — sometimes thirty
        analysts, sometimes two.
      </p>
      <p>
        That averaging is where most of the meaning goes missing.
      </p>

      <h2>The spread matters more than the average</h2>
      <p>
        An average promising healthy upside can mean two completely different
        things. Every analyst might agree the share is worth about that much more
        &mdash; or half of them expect it to halve while the other half expect it to
        double.
      </p>
      <p>
        Those are opposite situations, and the headline figure is identical.
      </p>

      <AnalystTargetFigure />

      <p>
        A wide spread is not a flaw in the data. It is the most honest thing on the
        page: it tells you the outcome genuinely depends on something nobody yet
        knows, and that anyone claiming confidence is overstating their case. A
        narrow spread means the professionals agree, which is worth knowing but is
        not the same as being right — the whole group has been wrong together many
        times.
      </p>
      <p>
        Check how many analysts the average is built from. Two analysts averaging
        each other is a very different figure from twenty.
      </p>

      <h2>Targets follow the price more than they lead it</h2>
      <p>
        This is the part that surprises people, and it is worth sitting with.
      </p>
      <p>
        When a share falls hard, targets tend to come down afterwards. When it runs
        up, targets are raised. The forecast moves to stay within a defensible
        distance of the price rather than the price moving toward the forecast.
      </p>
      <p>
        There are ordinary reasons. A large price move often reflects real news that
        genuinely changes the forecast. And a target far from the current price is
        professionally uncomfortable — being wrong alongside everyone else costs an
        analyst much less than being wrong alone.
      </p>
      <p>
        The practical consequence:{' '}
        <strong>
          a target that has just been cut is telling you what already happened
        </strong>
        , not what happens next.
      </p>

      <h2>They lean optimistic, structurally</h2>
      <p>
        Across the market, targets sit above the current price far more often than
        below it, and by more.
      </p>
      <p>
        Part of this is honest: analysts tend to cover companies they find
        interesting, and a share expected to go nowhere attracts little coverage.
        Part of it is structural. Negative research is harder to publish, harder to
        maintain a relationship around, and reaches an audience mostly made up of
        people who own the share and would like reassurance.
      </p>
      <p>
        None of that makes the numbers useless. It means the baseline is not zero:
        &ldquo;analysts see upside&rdquo; is close to the resting state, so it is
        only interesting when it is unusually large, unusually small, or negative.
      </p>

      <h2>Upgrades and downgrades</h2>
      <p>
        Alongside targets, analysts publish a recommendation — the familiar ladder
        from strong buy down to sell. Two things are worth knowing.
      </p>
      <p>
        <strong>The scale is compressed.</strong>{' '}
        Outright sell recommendations are rare across the whole market. In practice
        the meaningful signal is often a downgrade to &ldquo;hold&rdquo;, which reads
        as neutral and frequently is not.
      </p>
      <p>
        <strong>The change carries more than the level.</strong>{' '}
        A company that has been rated buy for three years tells you less than one
        downgraded last week. The direction of revision is the information.
      </p>

      <h2>What a price target cannot tell you</h2>
      <ul>
        <li>
          <strong>What the share will actually do.</strong>{' '}
          It is a forecast about an uncertain future, published by people who are
          wrong regularly and know it.
        </li>
        <li>
          <strong>Over what period.</strong>{' '}
          Twelve months is the convention, not a promise, and nothing resets when the
          twelve months pass.
        </li>
        <li>
          <strong>Whether the assumptions hold.</strong>{' '}
          Every target rests on forecasts of revenue, margins and multiples. Those
          are visible in the research and almost never in the number.
        </li>
        <li>
          <strong>Whether it suits you.</strong>{' '}
          A target says nothing about how much of a fall you could tolerate on the
          way to being right.
        </li>
      </ul>

      <h2>How MajorCycle shows it</h2>
      <p>
        We show the consensus target, the lowest and highest individual targets, and
        how many analysts the figures come from — because the spread and the count
        are the parts that get dropped everywhere else.
      </p>
      <p>
        Further down the same page, Smart Money Activity plots the individual rating
        changes against the price itself: which firm moved, what they moved from and
        to, and the day they did it. That is the other half of the story. The same
        consensus figure means one thing when the last few firms to move were raising
        their view, and something quite different when they were cutting it &mdash; and
        neither the average nor its range tells you which of those happened.
      </p>
      <p>
        We also show the recommendation{' '}
        <strong>exactly as the analysts word it</strong>. Those are their labels, not
        ours, and we do not translate them into our own scale. Our own ratings never
        use buy-and-sell language at all, and keeping the two visibly separate is
        deliberate: third-party opinion and our analysis should never be mistaken for
        each other.
      </p>
      <p>
        Analyst targets sit alongside, and independent of, our own reading — which is
        built from a company&rsquo;s own history of falls and the health of the
        business behind it, described in{' '}
        <Link href="/learn/how-to-read-a-majorcycle-rating">
          How to read a MajorCycle rating
        </Link>
        .
      </p>

      <h2>See the full target range, free</h2>
      <p>
        The consensus target, the high and low, the analyst count, the current
        recommendation and the record of individual rating changes are on every stock
        page on a free MajorCycle account, across the US, Australian and Canadian
        markets.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up any company you
        are curious about.
      </p>
    </>
  ),

  'how-to-read-a-majorcycle-rating': () => (
    <>
      <h2>One number, three questions</h2>
      <p>
        A MajorCycle rating is a score out of 100. It exists to answer one question:{' '}
        <em>
          given what this company is and where its price sits in its own history, how
          interesting is this right now?
        </em>
      </p>
      <p>
        It is built from three separate readings, each asking something different.
      </p>

      <RatingFigure />

      <h3>Financial Health — is the business sound?</h3>
      <p>
        Profitability, debt, growth, cash generation and what the company returns to
        its owners, rolled into a score out of 100. This is the largest single
        contribution, because a cheap price attached to a deteriorating business is
        not an opportunity. The detail is in{' '}
        <Link href="/learn/is-a-company-financially-healthy">
          How to check if a company is financially healthy
        </Link>
        .
      </p>

      <h3>Valuation — where is the price in this company&rsquo;s own cycle?</h3>
      <p>
        Not a P/E judgement. This asks how far today&rsquo;s price sits below the
        peak of the chosen window, and — crucially — how that compares with{' '}
        <strong>this company&rsquo;s own typical fall</strong>. A share down 15% when
        it usually falls 40% is in a different position from one down 15% that has
        never fallen more than 18%. The mechanics are in{' '}
        <Link href="/learn/what-is-a-drawdown">What is a drawdown?</Link>
      </p>

      <h3>Cycle Payoff — has that history been worth anything?</h3>
      <p>
        Two things at once. How many complete falls and recoveries the company&rsquo;s
        record actually contains — a company with a handful of cycles gives a more
        reliable read than one with two. And how its typical recovery has compared
        with its typical fall.
      </p>
      <p>
        Despite the name, there is nothing about price momentum in it. It measures
        whether the pattern is well-established and whether it has historically been
        rewarded.
      </p>

      <h2>What the five labels mean</h2>
      <p>
        The score maps to one of five labels, shown in the figure above with the
        exact bands.
      </p>
      <ul>
        <li>
          <strong>High Conviction</strong>{' '}— all three readings are strong at once.
          Rare, and it should be.
        </li>
        <li>
          <strong>Constructive</strong>{' '}— the case holds together, usually with one
          part weaker than the others.
        </li>
        <li>
          <strong>Neutral</strong>{' '}— genuinely balanced, or a mix of strengths and
          weaknesses that cancel out. Worth opening rather than dismissing.
        </li>
        <li>
          <strong>Cautious</strong>{' '}— something material is working against it.
        </li>
        <li>
          <strong>Bearish</strong>{' '}— the readings are poor across the board.
        </li>
      </ul>
      <p>
        You will notice these are not buy and sell. That is deliberate and it is not
        a legal formality: we do not know your circumstances, your timeframe or what
        else you own, and those decide whether any share suits you far more than our
        score does. The labels describe{' '}
        <strong>what the numbers say</strong>, and stop there.
      </p>

      <h2>Read the parts, not just the total</h2>
      <p>
        The most common mistake is treating the headline as the answer. It is an
        average, and averages hide their shape.
      </p>
      <p>
        A rating of 60 built from a strong business at a stretched price is a
        completely different proposition from a 60 built from a weak business at a
        bargain price. Same number, opposite situations, and only the three parts
        tell them apart. The score is the summary; the reading is underneath it.
      </p>

      <h2>When part of the picture is missing</h2>
      <p>
        Some companies do not have the fundamentals we need — recent listings,
        unusual structures, or gaps in the data.
      </p>
      <p>
        In that case we do not fabricate a Financial Health score or quietly treat it
        as average. It is left out, and the rating is computed from the price cycle
        alone with the remaining weights rescaled. A rating built on two readings
        instead of three is a narrower judgement, and worth treating as one.
      </p>

      <h2>What the rating deliberately will not do</h2>
      <p>
        Nothing in it forecasts a price, nothing in it tells you when, and nothing in
        it knows the first thing about your circumstances. Those are design decisions
        rather than gaps, and each one has a reason:{' '}
        <Link href="/learn/what-majorcycle-doesnt-do">
          What MajorCycle deliberately doesn&rsquo;t do
        </Link>{' '}
        sets them out in full.
      </p>
      <p>
        It is a way of reading a company&rsquo;s own record quickly and consistently
        across hundreds of them. That is genuinely useful, and it is all it is.
      </p>

      <h2>See a rating for any stock</h2>
      <p>
        Signing up is free and takes no card. A free account includes the price
        chart, the drawdown overlay and every fundamentals section; the Overall
        Rating, Health Score and the full scorecard come with a subscription, which
        starts with a 7-day trial.
      </p>
      <p>
        <strong>No card required to sign up.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up any company you
        are curious about.
      </p>
    </>
  ),

  'own-history-vs-market-average': () => (
    <>
      <h2>The average belongs to something you cannot own</h2>
      <p>
        When a headline says the market fell 10%, it is talking about an index — one
        number made by adding hundreds of companies together and dividing.
      </p>
      <p>
        An index falls far less than the businesses inside it, and the reason is
        arithmetic rather than safety. Companies run into trouble at different
        moments. One is collapsing in the same month another is having its best year,
        and in an average those two partly cancel each other out.
      </p>

      <IndexAverageFigure />

      <p>
        So the flat line is not a calmer investment. It is three separate bad years
        blended into one mild-looking one. Every company on that chart lived through
        something much worse than the index it belongs to.
      </p>

      <h2>Same index, two completely different normals</h2>
      <p>
        Now put two real kinds of business side by side. A regulated water utility
        sells the same thing to the same customers at a price a regulator sets. A
        copper miner sells into a price it does not control, set by demand on the
        other side of the world.
      </p>
      <p>
        Over twenty years the utility might never once have fallen 25%. The miner may
        have fallen 40% or more, several times, and recovered every time. Both can sit
        in the same index. The index&rsquo;s number describes neither of them.
      </p>
      <p>
        This is why the same headline percentage means two different things depending
        on whose chart it appears on — the point{' '}
        <Link href="/learn/dip-correction-crash">
          Dip, correction, crash — what&rsquo;s the difference?
        </Link>{' '}
        makes about the words themselves.
      </p>

      <h2>What &ldquo;normal&rdquo; means for one company</h2>
      <p>
        Instead of a market-wide rule, MajorCycle reads each company&rsquo;s own
        record. Over the window you choose it finds every fall the company has
        actually completed — each time the price dropped further below its running
        high than the threshold you set, bottomed out, and turned back up — and works
        out two things from them.
      </p>
      <ul>
        <li>
          <strong>Avg</strong>{' '}— the size of a typical fall for this company. The
          depth it keeps coming back to.
        </li>
        <li>
          <strong>Low</strong>{' '}— the deepest it has been in that window. The worst
          the record contains.
        </li>
      </ul>
      <p>
        Both are drawn as horizontal lines across the drawdown chart, with today&rsquo;s
        fall plotted against them. A share sitting at its Avg line is doing something
        ordinary for itself. A share below its Low line is somewhere its own history
        has never been, which is a genuinely different statement — and neither one can
        be read off a market-wide figure.{' '}
        <Link href="/learn/what-is-a-drawdown">What is a drawdown?</Link>{' '}
        covers how those falls are measured.
      </p>

      <h2>How many falls is enough to mean anything</h2>
      <p>
        A company&rsquo;s own record only helps if there is enough of it. Two falls
        make an average; they do not make a pattern.
      </p>
      <p>
        This is why the number of completed cycles matters as much as their size, and
        why the chart puts it on screen as <strong>Events</strong>{' '}rather than
        quietly averaging whatever is there. Fewer events is not a reason to ignore a
        company — it is a reason to hold the reading more loosely, and it feeds
        directly into how much weight the analysis gives that history.
      </p>

      <h2>When the record is the wrong record</h2>
      <p>
        There are companies whose past genuinely does not describe their present.
      </p>
      <ul>
        <li>
          <strong>Recent listings.</strong>{' '}A company two years public has no
          history to speak of, and the little it has was all in one market mood.
        </li>
        <li>
          <strong>Businesses that changed.</strong>{' '}A retailer that sold its stores
          and became a software company is a different business wearing an old ticker.
        </li>
        <li>
          <strong>Something that has never happened before.</strong>{' '}A record of
          falls contains no fall bigger than the biggest one in it. That is a limit of
          the method, not a prediction about the future.
        </li>
      </ul>
      <p>
        The honest position is that a company&rsquo;s own record is the best available
        benchmark, and it is still a description of the past. It narrows the question
        from &ldquo;is this a lot?&rdquo; to &ldquo;is this a lot{' '}
        <em>for this company</em>?&rdquo;, which is a much better question. It does
        not answer it for you.
      </p>

      <h2>See any company against its own record</h2>
      <p>
        The drawdown chart, the Avg and Low lines and today&rsquo;s position on them
        are on every stock page with a free MajorCycle account — US, Australian and
        Canadian listings.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and look up a company you
        already follow.
      </p>
    </>
  ),

  'how-long-do-recoveries-take': () => (
    <>
      <h2>The honest answer, and the useful one</h2>
      <p>
        The honest answer is that nobody knows. Anyone who gives you a number for
        how long a particular share will take to get back is guessing, however
        confident they sound.
      </p>
      <p>
        The useful answer is that this company has probably done it before, more
        than once, and each of those recoveries took a specific amount of time. You
        can look them up. That will not tell you what happens next, but it will tell
        you what kind of wait this business has asked of people in the past, which
        is a great deal better than nothing.
      </p>

      <h2>Where the time is hiding on a price chart</h2>
      <p>
        Look at any share price chart and your eye goes up and down. Prices are on
        the vertical axis, so that is where the drama is. The horizontal axis is
        just dates, and most people never read it.
      </p>
      <p>
        But the length of a recovery is a horizontal measurement. It is the distance
        between the day a price left a high behind and the day it climbed back to
        it. On an ordinary price chart that distance is hard to see, because you
        have to remember where the old high was while your eye travels sideways.
      </p>
      <p>
        A drawdown chart fixes that. It shows the same days, but instead of the
        price it plots how far below its own recent high the price is. It starts at
        zero, dips whenever the price falls, and comes back to zero on the day the
        price reaches its old high again. Every dip below the line is one complete
        round trip, drawn to scale.
      </p>
      <p>
        So the shaded shape is not just a picture of a fall. Its depth is how far
        the price dropped, and its <strong>width is how long the wait lasted</strong>.
      </p>

      <PriceRecoveryFigure />

      <h3>Reading one off the chart</h3>
      <ol>
        <li>
          <strong>Find where the line leaves zero.</strong>{' '}That is the day the
          price passed a high it would not see again for a while.
        </li>
        <li>
          <strong>Follow it right until it touches zero again.</strong>{' '}That is
          the day it got back.
        </li>
        <li>
          <strong>Read the gap off the dates underneath.</strong>{' '}That is how long
          that recovery took.
        </li>
      </ol>
      <p>
        Do that for each dip and you have something better than an average. You have
        this company&rsquo;s own range. Some businesses climb out of everything
        inside a year. Others have spent half a decade below an old high, more than
        once. Thirty seconds with the chart tells you which sort you are looking at.
      </p>
      <p>
        MajorCycle draws this chart on every stock page, under the price, with a
        matching set of dates. There is also a second view of the same thing that
        measures upwards from the lowest point instead of downwards from the high,
        which is the more natural way to watch a recovery you are already in. Both
        mark the size of a typical move for that company and the most extreme one in
        its record, so you can see whether the current episode is ordinary for it.
      </p>

      <h2>What the record can and cannot tell you</h2>
      <p>
        Past recoveries are real evidence. They are also history, and it is worth
        being clear about the limits before you lean on them.
      </p>
      <ul>
        <li>
          <strong>A deeper fall is not a longer one.</strong>{' '}This trips almost
          everybody up. A modest 15% slide can grind on for years while a brutal 45%
          drop is over in eight months. The two things barely track each other, so
          the width has to be read rather than guessed from the depth.
        </li>
        <li>
          <strong>Three or four falls is not a lot to go on.</strong>{' '}Most
          companies have a handful in their whole listed life. That is enough to
          show you the character of the business. It is not enough to be an average
          of anything.
        </li>
        <li>
          <strong>The company may have changed.</strong>{' '}A recovery from fifteen
          years ago happened under different management, with a different balance
          sheet, often in a different business. The chart remembers all of it. The
          company has moved on.
        </li>
        <li>
          <strong>Whatever is happening now has no width yet.</strong>{' '}The current
          dip is still getting wider while you look at it. Every finished stretch on
          the chart looked exactly like that once.
        </li>
      </ul>

      <h2>Why the figure you will find online does not help</h2>
      <p>
        Search this question and you will get a single tidy number, usually
        something like &ldquo;markets have historically recovered in about two
        years.&rdquo; Three things are wrong with leaning on it.
      </p>
      <ul>
        <li>
          <strong>It describes an index.</strong>{' '}An index recovers once enough of
          its members do, and its falls are shallower than theirs to start with.
          More on that in{' '}
          <Link href="/learn/own-history-vs-market-average">
            Why your company&rsquo;s own history beats the market&rsquo;s average
          </Link>
          .
        </li>
        <li>
          <strong>The ones that never came back are missing.</strong>{' '}A study of
          recoveries can only count things that recovered. Companies taken over
          cheaply, delisted or wound up drop out of the sample, and the average
          quietly improves because they left.
        </li>
        <li>
          <strong>Averaging things that disagree does not produce a forecast.</strong>{' '}
          When the real range runs from eight months to eight years, the midpoint is
          a number, not an expectation.
        </li>
      </ul>
      <p>
        One company&rsquo;s own three or four stretches beat a market-wide average,
        precisely because you can see how much they disagree with each other.
      </p>

      <h2>What anyone would have to know to answer this</h2>
      <p>
        To say how long the current fall will last, you would need to know when the
        company&rsquo;s earnings turn back up, when enough other investors change
        their minds about it, and whether the thing that caused the fall is
        temporary or permanent.
      </p>
      <p>
        The first is a forecast. The second is a forecast about other people. The
        third is usually only settled with hindsight. Nobody has all three, and a
        product that pretended otherwise would be selling confidence rather than
        information.
      </p>

      <h2>The waiting is the part that costs you</h2>
      <p>
        None of this makes duration unimportant. It may be the thing that decides
        whether an investment suits you at all.
      </p>
      <p>
        Money in a share that spends six years getting back to where it started has
        done nothing for six years, and it was not available for anything else in
        the meantime. Two people can buy the same company at the same price and have
        completely different experiences, purely because of how long they had to sit
        there. One of them may not have been able to.
      </p>
      <p>
        That is a question about your circumstances, not about the company, and no
        analysis of the company can answer it. What the chart can do is show you how
        long this business has asked people to wait before.
      </p>

      <h2>What MajorCycle measures, and what it leaves to you</h2>
      <p>
        Everything we calculate is a size. There is no number of days, months or
        years anywhere in the analysis.
      </p>
      <ul>
        <li>
          <strong>How far this company usually falls</strong>{' '}before it turns, and
          how today&rsquo;s fall compares.
        </li>
        <li>
          <strong>How far it usually rises</strong>{' '}afterwards. The size of the
          recovery, not its speed.
        </li>
        <li>
          <strong>How many separate falls</strong>{' '}its record contains, which is
          how much weight any of it deserves.
        </li>
      </ul>
      <p>
        We could publish an average recovery time per company. It would be a neat
        figure built on three or four events that disagreed with each other, and it
        would look far more certain than it was. Drawing the falls against time
        instead gives you the same information without dressing it up as a single
        answer.{' '}
        <Link href="/learn/how-to-read-a-majorcycle-rating">
          How to read a MajorCycle rating
        </Link>{' '}
        covers what the three readings do tell you.
      </p>

      <h2>See it for any stock, free</h2>
      <p>
        The price chart, the drawdown and recovery views, and this company&rsquo;s
        own record of falls are free on every stock page, across the US, Australian
        and Canadian markets.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and time a few recoveries
        for yourself.
      </p>
    </>
  ),


  'is-a-dividend-safe': () => (
    <>
      <h2>A yield is a fraction, and the bottom half moves</h2>
      <p>
        The dividend yield is the payment divided by the share price. Most people read
        it as a property of the company — a generous one, a stingy one. Half of it is
        a property of the price.
      </p>
      <p>
        Which means a yield can double without the company handing over a single extra
        cent. It just needs the share price to halve.
      </p>

      <DividendFigure />

      <p>
        That is the trap, and it is the opposite of how it feels. The screen that
        sorts by highest yield is, quite reliably, a list of companies other people
        have decided are in trouble.
      </p>

      <h2>The four questions that decide whether a payment lasts</h2>

      <h3>1. Is it covered by profit?</h3>
      <p>
        The payout ratio is the share of a company&rsquo;s profit that goes out as
        dividends. Below{' '}
        <strong>{PAYOUT_COMFORTABLE_MAX}%</strong>{' '}there is room to keep paying
        through a bad year and room to raise it. Between{' '}
        {PAYOUT_COMFORTABLE_MAX}% and {PAYOUT_STRAINED_MAX}% it is being funded with
        little left over. Above{' '}
        <strong>{PAYOUT_STRAINED_MAX}%</strong>{' '}almost everything earned is being
        handed back, and above 100% the company is paying out more than it earns,
        which it can only do for so long.
      </p>

      <h3>2. Is it covered by cash?</h3>
      <p>
        Dividends are paid in cash, and profit is an accounting figure that does not
        always arrive as cash. A company can report a healthy profit and still be
        funding its dividend by borrowing or by selling something.
      </p>
      <p>
        Free cash flow — what is left after the business has paid for its own upkeep —
        is the number that actually has to cover the payment. When profit and cash
        disagree for more than a year or two, cash is usually the one telling the
        truth.
      </p>

      <h3>3. Does the debt need the money more?</h3>
      <p>
        A dividend and an interest payment come out of the same pot, and the lender
        does not have to ask politely. A company with heavy borrowings and thin
        interest cover has already decided who gets paid first in a bad year, whether
        or not it has said so.
      </p>

      <h3>4. What has it actually done before?</h3>
      <p>
        A company that has raised its dividend every year for a decade has told you
        something about how seriously its board takes it. One that has cut before will
        cut again more easily. The record is the cheapest evidence available and the
        least used.
      </p>

      <h2>What the stock page shows you</h2>
      <p>
        The Dividend History section gives you the payment per share for each year as
        a bar chart — increases in green, cuts in red — plus the current yield, the
        latest annual dividend, how many consecutive years it has grown, and the
        payout ratio coloured against the bands above.
      </p>
      <p>
        There is one extra guard. A trailing yield above{' '}
        <strong>{DISTRESS_YIELD_PCT}%</strong>{' '}is flagged rather than coloured
        reassuringly, because at that level the number is almost always describing a
        collapsed price rather than reliable income. We still show the real figure; we
        just decline to make it look like good news.
      </p>
      <p>
        Everything in that section is free, and none of it requires a card. It is
        third-party data and history, not our judgement — the same principle as{' '}
        <Link href="/learn/analyst-price-target">
          How to read an analyst price target
        </Link>
        .
      </p>

      <h2>Where dividends sit in our scoring</h2>
      <p>
        The payout ratio is one input to the smallest of the five pillars behind a
        Financial Health score, and deliberately a small one. A generous dividend is
        not evidence of a good business, and paying none is not a fault — a company
        reinvesting everything it earns is treated as a reasonable choice rather than
        marked down for it.{' '}
        <Link href="/learn/is-a-company-financially-healthy">
          How to check if a company is financially healthy
        </Link>{' '}
        walks through the other four.
      </p>

      <h2>What none of this can tell you</h2>
      <ul>
        <li>
          <strong>A board can cut whenever it likes.</strong>{' '}Cover, history and
          cash flow describe capacity, not intention.
        </li>
        <li>
          <strong>Tax is not in the figures.</strong>{' '}Yields are shown before any
          tax treatment — Australian franking credits and cross-border withholding
          both change what actually reaches you, and neither is something we model.
        </li>
        <li>
          <strong>One-off payments distort the picture.</strong>{' '}A special dividend
          inflates a year in the history and the yield with it, and it was never
          meant to repeat.
        </li>
      </ul>

      <h2>Look up a dividend for yourself</h2>
      <p>
        The full dividend history, current yield and payout ratio are on every stock
        page on a free account, across the US, Australian and Canadian markets.
      </p>
      <p>
        <strong>No card required.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and check a company you hold
        for income.
      </p>
    </>
  ),

  'what-majorcycle-doesnt-do': () => (
    <>
      <h2>Almost everything it reads has already happened</h2>
      <p>
        This is the shape of the whole product, and it is easier to see than to
        describe.
      </p>

      <LimitsFigure />

      <p>
        There is no forecast anywhere in it. Not a hidden one, not a conservative one
        — none. Every input is a record of something that has already occurred, and
        the analysis is a way of reading that record quickly and the same way for
        every company.
      </p>

      <h2>It has no opinion about you</h2>
      <p>
        We do not know how long you can leave money alone, what you already own, what
        you earn, what tax you pay or how you would feel watching a holding halve.
      </p>
      <p>
        Those things decide whether any particular share suits a particular person far
        more than any score does. Two people can look at the same company, read the
        same reading and be right to do opposite things. That is not a gap we intend
        to close — it is the reason the labels describe companies rather than
        instructing readers.
      </p>

      <h2>It cannot see anything that is not a number</h2>
      <p>
        The analysis is built from prices and filed accounts. A great deal of what
        determines a company&rsquo;s future never appears in either.
      </p>
      <ul>
        <li>Whether the people running it are any good.</li>
        <li>A lawsuit, a regulator, or a licence about to be reviewed.</li>
        <li>A competitor whose product is better and whose revenue has not shown it yet.</li>
        <li>A takeover approach, a strike, a fire, an election.</li>
      </ul>
      <p>
        Some of that eventually turns into numbers. By then it is history, which is
        the only form we can read it in.
      </p>

      <h2>It will not tell you when</h2>
      <p>
        A reading describes a position, not a moment. A share can sit deep in its own
        cycle for a year and go lower first, and nothing in the analysis is a signal
        that the turn has arrived.
      </p>
      <p>
        This is the same limit as{' '}
        <Link href="/learn/how-long-do-recoveries-take">
          How long do recoveries actually take?
        </Link>{' '}
        seen from the other side: we measure how far, and timing is a question about
        the future that we have no instrument for.
      </p>

      <h2>It does not cover everything, and the data can be wrong</h2>
      <ul>
        <li>
          <strong>Listed shares in three markets only.</strong>{' '}The United States,
          Australia and Canada. No funds, no bonds, no currencies, no crypto, no
          private companies.
        </li>
        <li>
          <strong>Daily prices, refreshed overnight.</strong>{' '}Nothing here is live,
          and nothing is intended for trading within a day.
        </li>
        <li>
          <strong>One data provider.</strong>{' '}Figures come from a third party and
          are occasionally missing, late or plain wrong. Where a number is missing we
          leave it out rather than estimate it, which is why a score is sometimes
          withheld instead of shown.
        </li>
      </ul>

      <h2>And it is not advice</h2>
      <p>
        That sentence appears at the top of every page here and it is not a formality
        bolted on by a lawyer. Advice means a recommendation made with knowledge of
        your circumstances. We have none of that knowledge, so we do not make
        recommendations — which is also why our labels are{' '}
        <em>High Conviction</em>{' '}through <em>Bearish</em> rather than buy and sell.
      </p>

      <h2>Why the limits are the point</h2>
      <p>
        Every one of these could be papered over. We could publish an expected
        recovery time, or a price target of our own. Both would be guesswork wearing
        the same typeface as the parts that are measured, and a reader would have no
        way to tell which was which.
      </p>
      <p>
        There is a Verdict on every stock page, and it is worth being exact about
        what it is. It states where the price sits against this company&rsquo;s own
        history of falls, how many past cycles that reading rests on, and the price
        levels those cycles work out to. Every figure in it is back-solved from
        measured history.
      </p>
      <p>
        And it stops there. It does not tell you to buy, it does not tell you when,
        and it never turns into an instruction &mdash; because the moment it did, the
        measured half of the page and the invented half would look identical.
      </p>
      <p>
        What is left when you take the guesswork out is genuinely useful: a
        company&rsquo;s own record of falls and recoveries, the health of the business
        underneath, and a consistent way of reading both across hundreds of companies
        instead of the handful you would get through by hand. That is what{' '}
        <Link href="/learn/how-to-read-a-majorcycle-rating">
          How to read a MajorCycle rating
        </Link>{' '}
        describes, and it is all we claim.
      </p>

      <h2>See exactly what it does do</h2>
      <p>
        Signing up is free and takes no card. A free account includes the price chart,
        the drawdown overlay with this company&rsquo;s own cycle bands, and every
        fundamentals section; our judgement — the Overall Rating, the Health Score and
        the full scorecard — comes with a subscription that starts with a 7-day trial.
      </p>
      <p>
        <strong>No card required to sign up.</strong>{' '}
        <Link href="/signup">Create a free account</Link> and decide for yourself
        whether the rest is worth paying for.
      </p>
    </>
  ),
};
