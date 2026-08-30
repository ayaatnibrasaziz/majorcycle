import Link from 'next/link';

import { DataTable } from '@/components/articles/DataTable';
import { FallByMarketFigure } from '@/components/articles/FallByMarketFigure';
import type { ArticleSlug } from '@/lib/articles';

/**
 * Article bodies and figures, keyed by slug.
 *
 * ⚠️ **`Record<ArticleSlug, …>` is the guard.** Register an article in
 * `lib/articles.ts` and forget to write its body, and this file stops compiling.
 * The failure that prevents is a page which renders its heading, its answer and
 * its disclaimer perfectly and then simply stops — the shape CLAUDE.md 11j is
 * about, where a missing section looks entirely deliberate and no assertion
 * fires. Here it is a type error before anything ships.
 *
 * ⚠️ **TSX, never parsed HTML.** No `dangerouslySetInnerHTML` and no Markdown
 * renderer anywhere near this file. An article is a React module, so there is no
 * string of markup for anything to be injected into.
 *
 * ── Why the numbers here are HARD-CODED, which is the opposite of the Learn rule
 *
 * `learn/content.tsx` reads every figure from the nightly snapshot, because an
 * explainer describes how the product behaves TODAY and a typed-in number would
 * quietly go stale. An article is the other thing: a measurement taken on a
 * stated day, published with that day beside it. If these figures moved with the
 * market the piece would stop being a record of anything — and the sentence
 * "as at 27 August 2026" would become false while every number still looked
 * plausible.
 *
 * ⚠️ So the guarantee is different in kind, and it is a WORKBOOK rather than a
 * live read: `reference/how-far-do-asx-shares-fall-WORKING.xlsx` holds the full
 * study, every published figure as a live formula over the underlying rows, so
 * each one can be re-derived rather than taken on trust. Re-taking a measurement
 * is an edit to the article, never a data refresh (CLAUDE.md 11k).
 *
 * ⚠️ **No italics anywhere in a body** (owner, 2026-08-29): emphasis is carried
 * by `<strong>` and by sentence construction. Long runs of italic prose read as
 * machine-written.
 */

/** The window every figure in the first article is measured over. */
const STUDY_START = '1 January 2000';
const STUDY_END = '27 August 2026';

/**
 * The ASX depth ladder — ONE copy, printed by two articles.
 *
 * ⚠️ CLAUDE.md 11c. The recovery article prints all five columns; the ASX
 * ranking article prints two of them as the base rate under its table. Typed
 * twice, they would be two copies of one measurement free to drift — and they
 * already did once in the drafts, where the same band read 20.5 in one file and
 * 20.4 in the other. Nothing about that looks wrong on either page.
 *
 * `back` and `down` are the same falls counted two ways and must sum to 100.
 * Only the falls with a full five years behind them are counted: 374 of the 490
 * shallowest down to 153 of the deepest.
 */
const ASX_DEPTH_LADDER = [
  { depth: '20% to 30%', n: '489', wait: '4 months', back: '100%', down: '0%' },
  { depth: '30% to 40%', n: '254', wait: '9 months', back: '99%', down: '1%' },
  { depth: '40% to 50%', n: '157', wait: '1.5 years', back: '94%', down: '6%' },
  { depth: '50% to 70%', n: '190', wait: '2.9 years', back: '73%', down: '27%' },
  { depth: 'More than 70%', n: '170', wait: '8.3 years', back: '33%', down: '67%' },
] as const;

export const ARTICLE_BODIES: Record<ArticleSlug, () => React.ReactNode> = {
  'how-far-do-asx-shares-fall': () => (
    <>
      <p>
        You have probably read a frightening statistic about shares. That the typical
        company’s worst fall runs to <strong>85%</strong>. That{' '}
        <strong>more than half</strong> never get back to their old high.
      </p>
      <p>
        Both come from a Morgan Stanley study of more than 6,500 US companies, and
        both are true. The comforting explanation — that numbers like these must be
        dragged down by tiny speculative businesses — is not. The same study found
        that America’s six greatest wealth creators, Apple and Microsoft and
        Nvidia among them, averaged a worst fall of <strong>80.3%</strong>. Almost
        exactly everybody else. Our own figures agree: Apple fell 81%, Nvidia 90%.
      </p>
      <p>The giants are not exempt.</p>
      <p>
        But that statistic answers a question you are probably not asking. It answers
        how bad it has ever got — one catastrophe per company, measured from an
        all-time peak. When something you own drops 12% over a few weeks, you are
        asking something much smaller and far more useful:{' '}
        <strong>is this normal?</strong>
      </p>
      <p>Nobody had answered that for Australian shares. So we did.</p>

      <h2>What we measured</h2>
      <p>
        Every company in the <strong>ASX 200</strong>, the <strong>S&P 500</strong>{' '}
        and the <strong>S&P/TSX 60</strong> — 761 in all — using daily prices from{' '}
        {STUDY_START} to {STUDY_END}.
      </p>
      <p>
        For each one we found every pullback deeper than 5% and took the average
        depth. One number per company: its <strong>typical fall</strong>.
      </p>
      <p>Two things are worth being precise about, because they change what the number means:</p>
      <ul>
        <li>
          A fall is measured from the company’s highest point in the previous
          year, not from an all-time record. That makes it a question about ordinary
          setbacks, and therefore not the same measure as the 85% above.
        </li>
        <li>
          We start in 2000 because that is where our price history is complete for all
          three countries. It still covers the dot-com crash, the global financial
          crisis and COVID.
        </li>
      </ul>

      <h2>The headline number</h2>
      <DataTable
        caption="Typical fall, whole index, 2000 to 2026"
        columns={[
          { key: 'index', label: 'Index' },
          { key: 'fall', label: 'Typical fall', numeric: true },
        ]}
        rows={[
          { cells: { index: 'ASX 200', fall: '−21.7%' }, emphasis: true },
          { cells: { index: 'S&P 500', fall: '−18.9%' } },
          { cells: { index: 'S&P/TSX 60', fall: '−15.7%' } },
        ]}
      />
      <p>
        Read plainly, that says Australian shares fall harder than American ones, and
        a lot harder than Canadian ones.
      </p>
      <p>It is the wrong conclusion, and the reason is worth more than the number.</p>

      <h2>Why the headline misleads</h2>
      <p>
        The three indexes are not the same shape. The TSX 60 holds sixty of
        Canada’s largest companies; the ASX 200 holds two hundred, reaching much
        further down into mid-sized businesses — and smaller companies fall harder
        everywhere.
      </p>
      <p>So we compared like with like: the sixty largest companies in each index.</p>
      <DataTable
        caption="Typical fall, sixty largest companies only"
        columns={[
          { key: 'index', label: 'Largest 60 only' },
          { key: 'fall', label: 'Typical fall', numeric: true },
        ]}
        rows={[
          { cells: { index: 'ASX 200', fall: '−18.5%' }, emphasis: true },
          { cells: { index: 'S&P 500', fall: '−19.2%' } },
          { cells: { index: 'S&P/TSX 60', fall: '−15.7%' } },
        ]}
      />
      <p>
        The gap does not narrow. It <strong>reverses.</strong> Australia’s sixty
        biggest listed companies have fallen slightly less than America’s sixty
        biggest.
      </p>
      <p>
        The difference was never really about Australia. It was about what the ASX 200
        holds.
      </p>

      <h2>Where Australia is genuinely different</h2>
      <p>
        One difference survives the like-for-like test, and it is much larger than the
        rest.
      </p>
      <DataTable
        caption="Typical fall by sector, whole index. A dash means the index holds too few companies in that sector for a median worth printing."
        columns={[
          { key: 'sector', label: 'Sector' },
          { key: 'au', label: 'ASX 200', numeric: true },
          { key: 'us', label: 'S&P 500', numeric: true },
          { key: 'ca', label: 'TSX 60', numeric: true },
        ]}
        rows={[
          { cells: { sector: 'Real Estate', au: '−16.0%', us: '−17.3%', ca: '—' } },
          { cells: { sector: 'Financial Services', au: '−18.5%', us: '−18.3%', ca: '−14.8%' } },
          { cells: { sector: 'Healthcare', au: '−19.1%', us: '−18.5%', ca: '—' } },
          { cells: { sector: 'Consumer Cyclical', au: '−19.7%', us: '−21.7%', ca: '−16.3%' } },
          { cells: { sector: 'Communication Services', au: '−20.3%', us: '−21.4%', ca: '—' } },
          { cells: { sector: 'Consumer Defensive', au: '−20.4%', us: '−15.0%', ca: '−13.4%' } },
          { cells: { sector: 'Industrials', au: '−21.7%', us: '−17.8%', ca: '−14.2%' } },
          { cells: { sector: 'Technology', au: '−24.6%', us: '−22.1%', ca: '−23.0%' } },
          { cells: { sector: 'Energy', au: '−25.5%', us: '−21.3%', ca: '−19.2%' } },
          {
            cells: { sector: 'Basic Materials', au: '−30.7%', us: '−19.7%', ca: '−23.8%' },
            emphasis: true,
          },
          // Last, because the column the table is sorted on is empty: the ASX 200
          // holds three utilities, below the five-company floor. Printed rather
          // than dropped, so a reader can see the sector exists and that
          // Australia is the market too small to answer for it.
          { cells: { sector: 'Utilities', au: '—', us: '−14.8%', ca: '—' } },
        ]}
      />
      <p>
        Most of these rows are ordinary differences. Australia runs a little deeper
        in about half of them — two to five points — and shallower in property,
        consumer cyclicals and communication services. Financial services land
        within a fifth of a point of each other.
      </p>
      <p>
        Two rows are not ordinary. In both, the sector label is describing
        something other than what a reader would assume.
      </p>

      <h3>Basic Materials is not comparing the same thing</h3>
      <p>
        Basic Materials looks like the big one, and the sector label hides why. In
        Australia it is 50 of the 201 companies, and{' '}
        <strong>44 of those 50 are miners</strong>. In the S&P 500 the same sector
        is 20 companies out of 500, and <strong>only two of them are miners</strong> —
        Freeport-McMoRan and Newmont. The rest make paint, fertiliser, industrial
        gases, cement and packaging.
      </p>
      <p>
        So −30.7% against −19.7% is not Australian miners against American miners. It
        is Australian miners against American chemical companies.
      </p>
      <p>
        Counted properly — every company that digs ore, coal or uranium out of the
        ground, wherever the sector labels happen to file it — the three indexes look
        like this:
      </p>
      <DataTable
        caption="Mining companies in each index. Coal and uranium miners are filed under Energy rather than Basic Materials, and are counted here."
        columns={[
          { key: 'index', label: 'Index' },
          { key: 'n', label: 'Miners', numeric: true },
          { key: 'fall', label: 'Typical fall', numeric: true },
        ]}
        rows={[
          { cells: { index: 'ASX 200', n: '50 of 201', fall: '−31.8%' }, emphasis: true },
          { cells: { index: 'S&P/TSX 60', n: '8 of 60', fall: '−23.8%' } },
          { cells: { index: 'S&P 500', n: '2 of 500', fall: 'too few to average' } },
        ]}
      />
      <p>
        The two fifties are a coincidence rather than the same fifty. Six of the
        Basic Materials companies do not mine anything — two make explosives and sell
        them to miners, the others make steel, building products or recycle metal —
        and six miners sit under Energy instead: three coal, three uranium.
      </p>
      <p>
        A quarter of the Australian index is mining. Four in a thousand of the
        American one is. That is the difference the headline was picking up — not a
        national temperament, but a stock exchange built on top of a resources
        economy.
      </p>
      <p>
        It also explains the Energy row above. Three of Australia’s coal miners
        and three of its uranium companies sit there rather than in Basic Materials,
        which is why that row runs deeper than America’s too.
      </p>

      <h3>Financial Services is not the banks</h3>
      <p>
        Financial Services reads as “the banks”. Mostly it is not. In the ASX 200 it
        is 28 companies, of which <strong>seven are banks</strong>; the rest are
        insurers, fund managers, an exchange, a share registry and a buy-now-pay-later
        lender. In the S&P 500 it is 70 companies, of which{' '}
        <strong>fourteen are banks</strong> — the others include Visa, Mastercard,
        Berkshire Hathaway and every large American insurer.
      </p>
      <p>
        So −18.5% against −18.3% is not a fact about banks. Counted as banks alone,
        the three markets separate:
      </p>
      <DataTable
        caption="Banks only — the companies our data files under Banks, rather than the whole Financial Services sector. National Bank of Canada is absent because the provider no longer classifies it; including it at −12.9% would make the Canadian figure −13.7%."
        columns={[
          { key: 'index', label: 'Index' },
          { key: 'n', label: 'Banks', numeric: true },
          { key: 'fall', label: 'Typical fall', numeric: true },
        ]}
        rows={[
          { cells: { index: 'ASX 200', n: '7 of 201', fall: '−15.6%' }, emphasis: true },
          { cells: { index: 'S&P 500', n: '14 of 500', fall: '−20.2%' } },
          { cells: { index: 'S&P/TSX 60', n: '5 of 60', fall: '−14.0%' } },
        ]}
      />
      <p>
        Australian banks fall about four and a half points less than American ones in
        an ordinary pullback, and Canadian banks less again. That is the opposite of
        what the Financial Services row suggests, and it is the sector label doing the
        misleading rather than the data.
      </p>
      <p>
        Two names are arguable. Macquarie is filed under capital markets rather than
        banks, and Judo Capital under banks. Swap either for the other and the
        Australian figure does not move: it stays on NAB at −15.6%.
      </p>

      <h2>Banks and miners, side by side</h2>
      <p>The clearest view is inside Australia alone. First the banks:</p>
      <DataTable
        // ⚠️ The SAME widths as the miners table below, and that is the point:
        // the prose says "on the same scale", and a reader cannot run their eye
        // down two columns that do not line up. Left to size themselves, these
        // two put Typical fall 43.6px apart.
        minWidth="440px"
        caption="Australian banks, typical fall and worst fall since 2000"
        columns={[
          { key: 'name', label: 'Bank', width: '46%' },
          { key: 'typical', label: 'Typical fall', numeric: true, width: '27%' },
          { key: 'worst', label: 'Worst since 2000', numeric: true, width: '27%' },
        ]}
        rows={[
          { cells: { name: 'Commonwealth Bank', typical: '−14.3%', worst: '−52.7%' } },
          { cells: { name: 'Westpac', typical: '−14.8%', worst: '−51.7%' } },
          { cells: { name: 'ANZ', typical: '−15.5%', worst: '−53.1%' } },
          {
            cells: { name: 'NAB — median', typical: '−15.6%', worst: '−53.9%' },
            emphasis: true,
          },
          { cells: { name: 'Bendigo & Adelaide', typical: '−16.9%', worst: '−56.4%' } },
          { cells: { name: 'Bank of Queensland', typical: '−18.5%', worst: '−62.0%' } },
          { cells: { name: 'Macquarie', typical: '−19.0%', worst: '−74.2%' } },
        ]}
      />
      <p>And then the miners, on the same scale:</p>
      <DataTable
        // The same three widths as the banks table above — see the note there.
        minWidth="440px"
        caption="Australian miners, typical fall and worst fall since 2000"
        columns={[
          { key: 'name', label: 'Miner', width: '46%' },
          { key: 'typical', label: 'Typical fall', numeric: true, width: '27%' },
          { key: 'worst', label: 'Worst since 2000', numeric: true, width: '27%' },
        ]}
        rows={[
          { cells: { name: 'BHP', typical: '−16.9%', worst: '−57.2%' } },
          { cells: { name: 'Rio Tinto', typical: '−17.0%', worst: '−80.4%' } },
          { cells: { name: 'South32', typical: '−23.4%', worst: '−63.7%' } },
          {
            cells: { name: 'Mineral Resources — median', typical: '−25.6%', worst: '−81.9%' },
            emphasis: true,
          },
          { cells: { name: 'Northern Star', typical: '−27.0%', worst: '−83.3%' } },
          { cells: { name: 'Fortescue', typical: '−27.8%', worst: '−90.2%' } },
          { cells: { name: 'IGO', typical: '−28.4%', worst: '−86.8%' } },
        ]}
      />
      <p>
        A typical mining pullback is about <strong>1.6 times</strong> as deep as a
        typical banking one.
      </p>
      <p>
        The wrinkle is at the top of that second table.{' '}
        <strong>BHP and Rio Tinto sit with the banks, not with the miners</strong> —
        both around −17%. The two giant diversified miners have been far steadier than
        the pure-play producers beneath them. “Mining is volatile” is true
        of the sector, and not especially true of its two largest members.
      </p>

      <h2>What this does not tell you</h2>
      <p>
        A great deal. These are averages over twenty-six years, and an average is not
        a forecast. Every bank above typically falls around 15%, and every one of them
        has at some point fallen more than 50%.
      </p>
      <p>
        When those falls happened is worth noticing too. Six of those seven worst
        falls came in the global financial crisis.{' '}
        <strong>Westpac’s came in March 2020</strong>, in the COVID crash — the
        worst moment in a company’s history is not always the one you would
        guess.
      </p>
      <p>
        Nor does a deeper typical fall mean a worse investment. It means a bumpier
        one. Fortescue has the deepest single fall in that table, −90.2%. It has also
        compounded at roughly <strong>37% a year</strong> since 2000, more than
        anything else named here — though from a very low base, since it began the
        period as a small explorer rather than the iron ore producer it is today.
      </p>
      <p>
        What the typical fall gives you is <strong>context for a fall in progress</strong>.
        A share down 12% is doing something ordinary if it usually falls 20%, and
        something unusual if it usually falls 6%. That is the one thing a headline
        percentage can never tell you.
      </p>
      <p>
        That idea has a little more behind it. We have unpacked it in{' '}
        <Link href="/learn/what-is-a-drawdown">what a drawdown is</Link> and{' '}
        <Link href="/learn/own-history-vs-market-average">
          why a company’s own history beats the market average
        </Link>
        .
      </p>
    </>
  ),
  'how-long-does-an-asx-share-take-to-recover': () => (
    <>
      <h2>Half get back inside a year</h2>
      <p>
        We took the 201 companies in the ASX 200 today and read every daily price
        back to January 2000. Whenever a company’s share price dropped 20% or more
        below its own previous high, we started a clock and stopped it on the day
        the price got back to that high.
      </p>
      <p>
        That happened <strong>1,260 times</strong> across <strong>198</strong> of
        the 201 companies. Only three have never once been 20% below their own
        high — Coles, Dalrymple Bay Infrastructure and The Lottery Corporation,
        all of which listed recently enough that they have not yet met a bad year.
      </p>
      <p>Of those 1,260 falls:</p>
      <DataTable
        caption={`Share of ASX 200 falls back at the old price, ${STUDY_START} to ${STUDY_END}`}
        columns={[
          { key: 'within', label: 'Back to the old price within' },
          { key: 'share', label: 'Share of falls', numeric: true },
        ]}
        rows={[
          { cells: { within: '1 year', share: '51.7%' }, emphasis: true },
          { cells: { within: '2 years', share: '68.5%' } },
          { cells: { within: '3 years', share: '75.9%' } },
          { cells: { within: '5 years', share: '84.4%' } },
          { cells: { within: '10 years', share: '91.2%' } },
        ]}
      />
      <p>
        Each row only counts falls that have had that much time to run. A fall that
        started in 2024 cannot tell you anything about ten-year recoveries, so it is
        left out of the ten-year row rather than counted as a failure. The rows are
        built from 1,170 falls, then 1,107, 1,072, 946 and 650.
      </p>
      <p>
        <strong>And 156 falls, 12.4% of them, are still below their old price today.</strong>{' '}
        That number needs care, because most of those are simply recent. Sixty-three
        of the 156 began less than a year ago and have not had time to do anything
        yet. The ones worth worrying about are the old ones:{' '}
        <strong>
          45 falls, 3.6% of the total, have been under water for more than five
          years.
        </strong>
      </p>

      <h2>The depth of the fall decides almost everything</h2>
      <p>
        The single most useful thing in this study is not the average. It is how
        fast the odds change with the size of the fall.
      </p>
      <DataTable
        wrapHeaders
        caption="Every ASX 200 fall since 2000, grouped by how far it fell. The last two columns are the same falls counted two ways, so they add to 100%."
        columns={[
          { key: 'depth', label: 'How far it fell' },
          { key: 'n', label: 'Falls', numeric: true },
          { key: 'wait', label: 'Typical wait', numeric: true },
          { key: 'back', label: 'Back within 5 years', numeric: true },
          { key: 'down', label: 'Still down 5 years on', numeric: true },
        ]}
        rows={ASX_DEPTH_LADDER.map((r, i) => ({
          cells: r,
          emphasis: i === ASX_DEPTH_LADDER.length - 1,
        }))}
      />
      <p>
        The last two columns are the same falls counted two ways, so they add to
        100%. They cover only the falls old enough to be judged — those with a
        full five years of history behind them, which is 376 of the 489 shallow
        ones down to 153 of the deepest.
      </p>
      <p>
        A 25% fall is close to routine: every single one that had five years to
        recover, did. Not one exception in 376. A fall past 70% is a different
        animal — two thirds of those were still below the old price five years
        later.
      </p>
      <p>
        This is also where the “still under water” falls are concentrated. Of the
        45 Australian falls that have been under water for more than five years,{' '}
        <strong>38 of them are falls of more than 70%</strong>, and not a single
        one is a fall of less than 40%.
      </p>
      <p>
        The useful way to read this is that the first half of a big fall and the
        second half are not the same event. Going from down 20% to down 50%
        roughly doubles the wait. Going from down 50% to down 70% quadruples it.
      </p>

      <h2>Australian shares take longer than American ones</h2>
      <p>Australia is the slowest of the three markets we cover, on both measures.</p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="Every 20% fall in each index since 2000. “Down over 5 years” counts the falls that have been below their old price for more than five years."
        columns={[
          { key: 'index', label: 'Index', width: '17%' },
          { key: 'wait', label: 'Typical wait', numeric: true, width: '23%' },
          { key: 'y1', label: 'Back within 1 year', numeric: true, width: '20%' },
          { key: 'now', label: 'Still down today', numeric: true, width: '20%' },
          { key: 'old', label: 'Down over 5 years', numeric: true, width: '20%' },
        ]}
        rows={[
          {
            cells: {
              index: 'ASX 200',
              wait: 'about 11 months',
              y1: '51.7%',
              now: '12.4%',
              old: '3.6%',
            },
            emphasis: true,
          },
          {
            cells: {
              index: 'S&P 500',
              wait: 'about 10 months',
              y1: '54.1%',
              now: '8.5%',
              old: '0.8%',
            },
          },
          {
            cells: {
              index: 'TSX 60',
              wait: 'about 10 months',
              y1: '55.9%',
              now: '6.2%',
              old: '0.3%',
            },
          },
        ]}
      />
      <p>
        The last column is the one that separates the three markets. Australia has
        45 falls that have stayed under water for more than five years; the United
        States, with three times as many falls in the sample, has 32.
      </p>
      <p>
        The obvious suspicion is that this is really about company size, and in{' '}
        <Link href="/articles/how-far-do-asx-shares-fall">
          How far do ASX shares actually fall?
        </Link>{' '}
        that turned out to be the whole story: Australian shares look like they
        fall harder than American ones, and once you compare the sixty biggest in
        each, the gap reverses.
      </p>
      <p>
        <strong>Here it does not reverse.</strong> Comparing the sixty largest
        companies in each index, the Australian ones still take longer and still
        leave more falls unrecovered — a typical wait of 0.82 years against 0.71
        in the United States, and 10.1% still down against 7.1%. Matching for size
        narrows the gap. It does not close it.
      </p>

      <h2>Property is where falls go to die</h2>
      <p>
        Inside the Australian market, the differences between industries are far
        larger than the difference between countries.
      </p>
      <DataTable
        wrapHeaders
        caption="Australian groups compared. Miners are counted as the companies that actually mine, which is not the same as the Basic Materials sector."
        columns={[
          { key: 'group', label: 'Group' },
          { key: 'n', label: 'Companies', numeric: true },
          { key: 'wait', label: 'Typical wait', numeric: true },
          { key: 'back', label: 'Back within 5 years', numeric: true },
          { key: 'now', label: 'Still down today', numeric: true },
        ]}
        rows={[
          {
            cells: { group: 'Miners', n: '50', wait: '6 months', back: '84%', now: '11.8%' },
          },
          { cells: { group: 'Banks', n: '7', wait: '1.4 years', back: '84%', now: '14.0%' } },
          {
            cells: {
              group: 'Listed property',
              n: '19',
              wait: '2.9 years',
              back: '61%',
              now: '19.6%',
            },
            emphasis: true,
          },
        ]}
      />
      <p>
        Miners fall the furthest of any Australian group, which is what{' '}
        <Link href="/articles/how-far-do-asx-shares-fall">
          How far do ASX shares actually fall?
        </Link>{' '}
        measured, and they also climb back the fastest. Commodity prices turn, and
        the share price turns with them.
      </p>
      <p>
        Property does the opposite. Eleven property falls of 20% or more are still
        below their old price, and four of those have been that way for more than
        five years — the highest rate of any Australian group. The GPT Group
        peaked in February 2007, fell 93%, and is still about 18% below that price
        more than nineteen years later. Lendlease peaked in August 2018 and now
        trades 83% below it. The reason is that property trusts answer a crash by
        issuing new shares, often at a heavy discount, and an investor who owned
        the shares before that cannot get back to where they started no matter
        what the buildings are worth afterwards.
      </p>

      <h2>What “recovered” means here, exactly</h2>
      <p>
        Two things are worth being precise about, because they change the answer.
      </p>
      <p>
        <strong>Dividends count.</strong> Our prices are adjusted for dividends, so
        “back to the old price” means back to where you started including the
        income along the way. That matters most for the highest-yielding shares.
        Across the largest ASX companies, 86.7% of falls recovered on that basis
        against 81.8% on the share price alone. Westpac’s typical fall took 2.1
        years to recover with dividends counted and 5.1 years without. If you check
        one of these against a price chart, the chart will show a later date,
        because the chart does not show the income.
      </p>
      <p>
        <strong>We measure from the day it was 20% down</strong>, not from the peak
        — that is the day a holder actually notices, and the more useful clock.
      </p>

      <h2>What this cannot tell you</h2>
      <p>
        These are the 201 companies in the ASX 200 <strong>today</strong>.
        Companies that fell and were dropped from the index are not here, and they
        did worse than the ones that stayed. So read this as “what the history of
        today’s large Australian companies looks like”, not as the odds facing any
        share you might buy. The true never-recovered figure across all Australian
        shares is certainly worse than 12.8%.
      </p>
      <p>
        It is also a description of the past, and the past has no obligation to
        repeat. Nothing here is advice about any particular company.
      </p>
    </>
  ),
  'asx-200-shares-furthest-below-their-highs': () => (
    <>
      <h2>Nearly half the index is down more than 20%</h2>
      <p>
        As at {STUDY_END}, the middle company in the ASX 200 sat{' '}
        <strong>17.5% below its own highest price of the past year</strong>. That
        is not a market-wide crash — the index itself is nowhere near down that
        much, because the largest companies are holding up better than the rest —
        but it does mean the typical listed Australian company has given back a
        meaningful part of its last year.
      </p>
      <DataTable
        caption={`How far the 201 ASX 200 companies sit below their own one-year highs, as at ${STUDY_END}`}
        columns={[
          { key: 'band', label: 'How far below its own one-year high' },
          { key: 'n', label: 'Companies', numeric: true },
        ]}
        rows={[
          { cells: { band: 'More than 10%', n: '144 of 201' } },
          { cells: { band: 'More than 20%', n: '88' }, emphasis: true },
          { cells: { band: 'More than 30%', n: '46' } },
          { cells: { band: 'More than 50%', n: '16' } },
          { cells: { band: 'Within 2% of the high', n: '6' } },
        ]}
      />
      <p>
        Six companies out of 201 are near their high. That is the number worth
        sitting with.
      </p>

      <h2>The fifteen furthest down</h2>
      <DataTable
        wrapHeaders
        minWidth="560px"
        caption="The fifteen ASX 200 companies furthest below their own one-year high. The second column measures the same close against the company’s best price since 2000."
        columns={[
          { key: 'rank', label: '#', width: '7%' },
          { key: 'name', label: 'Company', width: '29%' },
          { key: 'y1', label: 'Below its 1-year high', numeric: true, width: '20%' },
          { key: 'all', label: 'Below its best since 2000', numeric: true, width: '24%' },
          { key: 'when', label: 'That peak was', width: '20%' },
        ]}
        rows={[
          { cells: { rank: '1', name: 'Tuas', y1: '−74.0%', all: '−74.0%', when: 'Sep 2025' } },
          { cells: { rank: '2', name: 'DroneShield', y1: '−73.2%', all: '−73.2%', when: 'Oct 2025' } },
          { cells: { rank: '3', name: 'IperionX', y1: '−68.2%', all: '−68.2%', when: 'Oct 2025' } },
          { cells: { rank: '4', name: 'Vulcan Energy', y1: '−65.7%', all: '−84.5%', when: 'Sep 2021' } },
          { cells: { rank: '5', name: 'Life360', y1: '−64.2%', all: '−64.2%', when: 'Oct 2025' } },
          { cells: { rank: '6', name: 'WiseTech Global', y1: '−60.4%', all: '−71.9%', when: 'Nov 2024' } },
          { cells: { rank: '7', name: 'Pantoro Gold', y1: '−58.9%', all: '−68.0%', when: 'Mar 2011' } },
          { cells: { rank: '8', name: 'Generation Development', y1: '−58.1%', all: '−58.1%', when: 'Oct 2025' } },
          { cells: { rank: '9', name: 'Liontown', y1: '−56.8%', all: '−64.2%', when: 'Jun 2023' } },
          { cells: { rank: '10', name: 'Cochlear', y1: '−53.7%', all: '−59.3%', when: 'Jul 2024' } },
          { cells: { rank: '11', name: 'Austal', y1: '−53.4%', all: '−53.4%', when: 'Jan 2026' } },
          { cells: { rank: '12', name: 'PEXA Group', y1: '−52.1%', all: '−61.1%', when: 'Jan 2022' } },
          { cells: { rank: '13', name: '4DMedical', y1: '−51.8%', all: '−51.8%', when: 'Mar 2026' } },
          { cells: { rank: '14', name: 'Judo Capital', y1: '−51.0%', all: '−60.2%', when: 'Nov 2021' } },
          { cells: { rank: '15', name: 'Xero', y1: '−50.8%', all: '−58.4%', when: 'Jun 2025' } },
        ]}
      />
      <p>
        Fifteenth place is a coin toss: Xero and ARB Corporation are separated by
        seven hundredths of a percentage point, so read the bottom of
        this table as a group rather than as an order.
      </p>
      <p>
        The two columns say different things and the gap between them is the
        interesting part. Where they are identical — Tuas, DroneShield, IperionX,
        Life360, Generation Development, Austal and 4DMedical — the company’s best
        price ever was set within the last year, so the whole fall is recent. Where
        they differ, the company had already fallen before this year began: Vulcan
        Energy is 66% below its one-year high and 85% below its 2021 peak.
      </p>
      <p>
        Cochlear is the one most Australian readers will not expect. It is one of
        the country’s best-known medical device makers rather than a speculative
        miner, and it lost about 40% of its value in a single trading day on 22
        April 2026. Its market value now stands at about A$8.9 billion.
      </p>

      <h2>No industry was spared</h2>
      <p>
        This is what makes the current run different from an ordinary rotation. In
        most pullbacks one or two sectors carry the damage. Here almost every part
        of the market has a substantial share of its companies down more than 20%.
      </p>
      <p>
        The table below groups companies by their standard sector classification. A
        sector is a filing category, not a description of what a company actually
        does, so the commentary underneath names the companies rather than trusting
        the grouping.
      </p>
      <DataTable
        wrapHeaders
        caption="ASX 200 companies more than 20% below their own one-year high, by sector label. Two companies carry no sector in our data and are left out of this table only."
        columns={[
          { key: 'sector', label: 'Sector' },
          { key: 'n', label: 'In the index', numeric: true },
          { key: 'down', label: 'More than 20% down', numeric: true },
          { key: 'rate', label: 'Rate', numeric: true },
        ]}
        rows={[
          { cells: { sector: 'Technology', n: '13', down: '9', rate: '69%' }, emphasis: true },
          { cells: { sector: 'Communication Services', n: '12', down: '8', rate: '67%' } },
          { cells: { sector: 'Consumer Defensive', n: '9', down: '6', rate: '67%' } },
          { cells: { sector: 'Consumer Cyclical', n: '19', down: '11', rate: '58%' } },
          { cells: { sector: 'Real Estate', n: '19', down: '8', rate: '42%' } },
          { cells: { sector: 'Energy', n: '13', down: '6', rate: '46%' } },
          { cells: { sector: 'Healthcare', n: '13', down: '6', rate: '46%' } },
          { cells: { sector: 'Basic Materials', n: '50', down: '20', rate: '40%' } },
          { cells: { sector: 'Financial Services', n: '27', down: '8', rate: '30%' } },
          { cells: { sector: 'Industrials', n: '21', down: '5', rate: '24%' } },
          { cells: { sector: 'Utilities', n: '3', down: '0', rate: '0%' } },
        ]}
      />
      <p>Two of those rows are misleading if you read the label and stop there.</p>
      <p>
        <strong>Consumer Defensive is not the supermarkets.</strong> Six of its
        nine members are down more than 20%, which sounds like a warning about the
        most reliable corner of the market. The six are GrainCorp, a2 Milk,
        Treasury Wine Estates, Metcash, Endeavour and Elders — agriculture, dairy,
        wine and liquor. The two actual supermarkets are Woolworths, 4.0% below its
        high, and Coles, 3.5% below. They are among the steadiest shares in the
        entire index, and the sector label hides that completely.
      </p>
      <p>
        <strong>Financial Services is not the banks.</strong> The sector looks
        resilient at 30%, and the resilience belongs to the insurers: of the nine
        insurance companies, only one is more than 20% down. The banks are in the
        middle of the pack, with three of seven down more than a fifth — National
        Australia Bank, Westpac, and Judo Capital, which is much the smallest and
        much the worst at 51%. Commonwealth Bank is 15.1% below its own high.
      </p>
      <p>
        And on the mining sector, which is the largest single block in the market:
        counting the fifty companies that actually mine things — which is not the
        same as the fifty classified under Basic Materials —{' '}
        <strong>22 are more than 20% below their highs</strong>, a rate of 44%.
        That is at the index average rather than above or below it, which is itself
        worth noticing in a market this concentrated in mining.
      </p>

      <h2>What the history says about shares in this position</h2>
      <p>
        <Link href="/articles/how-long-does-an-asx-share-take-to-recover">
          How long does an ASX share take to recover?
        </Link>{' '}
        measured every 20% fall in this index since 2000 and how long each took to
        come back. That gives a base rate for the companies in the table above.
      </p>
      <DataTable
        caption="Every ASX 200 fall since 2000 with five full years of history behind it, grouped by how far it fell."
        columns={[
          { key: 'depth', label: 'The size of the fall' },
          { key: 'back', label: 'Back within 5 years', numeric: true },
          { key: 'down', label: 'Still down 5 years on', numeric: true },
        ]}
        rows={ASX_DEPTH_LADDER.map((r) => ({
          cells: { depth: r.depth, back: r.back, down: r.down },
        }))}
      />
      <p>
        The two columns are the same falls counted two ways, so they add to 100%.
        Both cover only the falls old enough to be judged — the ones with five full
        years of history behind them.
      </p>
      <p>
        Every company in the fifteen above sits in one of the bottom two rows:
        thirteen in the 50-to-70% band and two past 70%. On the record of the past
        twenty-six years, about a third of a group like that would still be below
        its old price five years from now, and most of the rest would take years
        rather than months.
      </p>
      <p>
        That cuts both ways, and it is the reason this list is a starting point for
        work rather than a conclusion. A deep fall is where the better
        opportunities have historically been found, and it is also where the
        permanent losses are. The list cannot tell you which of the two any
        particular company is. Only the business can.
      </p>

      <h2>How to read the numbers</h2>
      <p>
        The “one-year high” is the highest price the share actually traded at in
        the past 252 trading days. For a few companies on this list that high was
        set on a single day, so the fall looks larger than the experience of anyone
        who held through it. Where that matters, the second column — the distance
        below the best close since 2000 — is the steadier figure.
      </p>
      <p>Prices include dividends. Nothing here is advice about any company.</p>
    </>
  ),
  'sp-500-shares-furthest-below-their-highs': () => (
    <>
      <h2>An index near its high, holding a lot of companies that are not</h2>
      <p>
        As at {STUDY_END}, the middle company in the S&P 500 sat{' '}
        <strong>11.7% below its own highest price of the past year</strong>.
        Twenty-five companies were within 2% of their high.
      </p>
      <DataTable
        caption={`How far the S&P 500 companies sit below their own one-year highs, as at ${STUDY_END}`}
        columns={[
          { key: 'band', label: 'How far below its own one-year high' },
          { key: 'n', label: 'Companies', numeric: true },
        ]}
        rows={[
          { cells: { band: 'More than 10%', n: '283 of 499' } },
          { cells: { band: 'More than 20%', n: '143' }, emphasis: true },
          { cells: { band: 'More than 30%', n: '63' } },
          { cells: { band: 'More than 50%', n: '12' } },
          { cells: { band: 'Within 2% of the high', n: '25' } },
        ]}
      />
      <p>
        That is a much healthier picture than{' '}
        <Link href="/articles/asx-200-shares-furthest-below-their-highs">
          the ASX 200
        </Link>
        , where 44% of the index is more than 20% down against 29% here. But the
        American average conceals a bigger split than the Australian one.
      </p>

      <h2>The fifteen furthest down</h2>
      <DataTable
        wrapHeaders
        minWidth="560px"
        caption="The fifteen S&P 500 companies furthest below their own one-year high. The second column measures the same close against the company’s best price since 2000."
        columns={[
          { key: 'rank', label: '#', width: '7%' },
          { key: 'name', label: 'Company', width: '29%' },
          { key: 'y1', label: 'Below its 1-year high', numeric: true, width: '20%' },
          { key: 'all', label: 'Below its best since 2000', numeric: true, width: '24%' },
          { key: 'when', label: 'That peak was', width: '20%' },
        ]}
        rows={[
          { cells: { rank: '1', name: 'The Trade Desk', y1: '−76.2%', all: '−90.5%', when: 'Dec 2024' } },
          { cells: { rank: '2', name: 'CoStar Group', y1: '−65.9%', all: '−69.0%', when: 'Oct 2021' } },
          { cells: { rank: '3', name: 'Fiserv', y1: '−62.1%', all: '−78.0%', when: 'Mar 2025' } },
          { cells: { rank: '4', name: 'Insulet', y1: '−59.6%', all: '−59.6%', when: 'Nov 2025' } },
          { cells: { rank: '5', name: 'AppLovin', y1: '−58.1%', all: '−58.1%', when: 'Sep 2025' } },
          { cells: { rank: '6', name: 'Boston Scientific', y1: '−57.4%', all: '−57.4%', when: 'Sep 2025' } },
          { cells: { rank: '7', name: 'Oracle', y1: '−55.6%', all: '−55.6%', when: 'Sep 2025' } },
          { cells: { rank: '8', name: 'Builders FirstSource', y1: '−55.5%', all: '−68.7%', when: 'Mar 2024' } },
          { cells: { rank: '9', name: 'Coinbase', y1: '−52.6%', all: '−57.1%', when: 'Jul 2025' } },
          { cells: { rank: '10', name: 'Zoetis', y1: '−51.1%', all: '−68.2%', when: 'Dec 2021' } },
          { cells: { rank: '11', name: 'Nike', y1: '−50.3%', all: '−76.7%', when: 'Nov 2021' } },
          { cells: { rank: '12', name: 'Intuit', y1: '−50.1%', all: '−56.8%', when: 'Jul 2025' } },
          { cells: { rank: '13', name: 'Lululemon', y1: '−49.1%', all: '−77.7%', when: 'Dec 2023' } },
          { cells: { rank: '14', name: 'Aptiv', y1: '−48.9%', all: '−74.9%', when: 'Nov 2021' } },
          { cells: { rank: '15', name: 'Charter Communications', y1: '−48.1%', all: '−82.0%', when: 'Sep 2021' } },
        ]}
      />
      <p>
        Two things stand out. The first is how many are household names rather than
        speculative small companies: Oracle, Nike, Intuit, Boston Scientific and
        Charter are among the largest businesses in the United States.
      </p>
      <p>
        The second is the gap between the columns. Nike is 50% below its one-year
        high and 77% below its 2021 peak, so this year’s fall is the latest
        instalment of a four-year decline rather than a new event. Oracle is the
        opposite: the two figures are identical because Oracle’s highest price ever
        was September 2025. It went up a very long way and gave all of it back
        inside twelve months.
      </p>

      <h2>The split is technology, and it is not the giants</h2>
      <DataTable
        wrapHeaders
        caption="S&P 500 companies more than 20% below their own one-year high, by sector label. One company carries no sector in our data and is left out of this table only."
        columns={[
          { key: 'sector', label: 'Sector' },
          { key: 'n', label: 'In the index', numeric: true },
          { key: 'down', label: 'More than 20% down', numeric: true },
          { key: 'rate', label: 'Rate', numeric: true },
        ]}
        rows={[
          { cells: { sector: 'Technology', n: '83', down: '44', rate: '53%' }, emphasis: true },
          { cells: { sector: 'Consumer Cyclical', n: '54', down: '25', rate: '46%' } },
          { cells: { sector: 'Communication Services', n: '24', down: '9', rate: '38%' } },
          { cells: { sector: 'Industrials', n: '74', down: '25', rate: '34%' } },
          { cells: { sector: 'Basic Materials', n: '20', down: '6', rate: '30%' } },
          { cells: { sector: 'Consumer Defensive', n: '32', down: '7', rate: '22%' } },
          { cells: { sector: 'Healthcare', n: '59', down: '10', rate: '17%' } },
          { cells: { sector: 'Real Estate', n: '30', down: '3', rate: '10%' } },
          { cells: { sector: 'Financial Services', n: '70', down: '8', rate: '11%' } },
          { cells: { sector: 'Utilities', n: '31', down: '3', rate: '10%' } },
          { cells: { sector: 'Energy', n: '21', down: '2', rate: '10%' } },
        ]}
      />
      <p>
        The obvious reading is that this is an artificial intelligence unwind, and
        the obvious reading is wrong. The companies most associated with that trade
        are holding up: Nvidia is 3.5% below its high, Microsoft 8.0%, Apple 8.6%,
        Amazon 10.8%. The damage is in the tier below them. Oracle is down 56%,
        Intuit 50%, Intel 35%.
      </p>
      <p>
        Of the fifty largest listings in the index, fourteen are more than 20% below
        their own high — so this is not only a small-company story either. Meta is
        27.5% below, Tesla 28.9%, Broadcom 24.8%.
      </p>
      <p>
        Meanwhile the oldest parts of the market are at their peaks. Visa is 1.5%
        below its high, Mastercard 1.6%, Marathon Petroleum 1.1%. Only two of
        twenty-one energy companies and three of thirty-one utilities are down more
        than 20%.
      </p>
      <p>
        Those three utilities are worth a sentence, because they are the exception
        that explains the rule. NRG, Vistra and Constellation Energy are
        independent power producers, and each had more than doubled in the two
        years before this fall — Vistra was up 162% and is now 36% below its high.
        They fell furthest because they had risen furthest, which is a different
        thing from a sector in trouble.
      </p>

      <h2>What the history says about shares in this position</h2>
      <p>
        <Link href="/articles/how-long-does-an-asx-share-take-to-recover">
          How long does an ASX share take to recover?
        </Link>{' '}
        measured every 20% fall in these indices since 2000 and how long it took to
        come back. For the S&P 500, 54% of falls were back within a year and 90%
        within five, and <strong>8.5% are still below their old price today</strong>.
      </p>
      <p>
        American falls have recovered faster and more reliably than Australian
        ones. The clearest version of that is the long stragglers: 0.8% of American
        falls have been under water for more than five years against 3.6% of
        Australian ones, and the gap survives matching the two markets for company
        size.
      </p>
      <p>
        But the base rate that matters for the table above is the one for deep
        falls rather than average ones. Within the S&P 500 itself:
      </p>
      <DataTable
        wrapHeaders
        caption="Every S&P 500 fall since 2000 with five full years of history behind it, grouped by how far it fell. The last two columns are the same falls counted two ways."
        columns={[
          { key: 'depth', label: 'The size of the fall' },
          { key: 'n', label: 'Falls', numeric: true },
          { key: 'back', label: 'Back within 5 years', numeric: true },
          { key: 'down', label: 'Still down 5 years on', numeric: true },
        ]}
        rows={[
          { cells: { depth: '20% to 30%', n: '1,630', back: '100%', down: '0%' } },
          { cells: { depth: '30% to 40%', n: '877', back: '99%', down: '1%' } },
          { cells: { depth: '40% to 50%', n: '512', back: '97%', down: '3%' } },
          { cells: { depth: '50% to 70%', n: '537', back: '79%', down: '21%' } },
          { cells: { depth: 'More than 70%', n: '296', back: '34%', down: '66%' }, emphasis: true },
        ]}
      />
      <p>
        The last two columns are the same falls counted two ways and add to 100%.
        Both use only the falls with five full years of history behind them.
      </p>
      <p>
        America’s advantage sits in the shallow and middle falls, not the deep
        ones. Once a company has fallen more than 70% the three markets look almost
        identical: about a third are back within five years in each of them, and
        the American edge only reappears over ten years, at 61% against Australia’s
        56%.
      </p>
      <p>
        Every company in the fifteen above has fallen more than 48%. Whatever else
        is true of them, they are in the part of the distribution where the
        outcomes are widest — both the best recoveries and the permanent losses
        live there. A list like this is a place to start reading company filings,
        not a conclusion.
      </p>

      <h2>How to read the numbers</h2>
      <p>
        The one-year high is the highest price actually traded in the past 252
        trading days; for a few companies here it was set on a single day. Prices
        include dividends. Figures are as at {STUDY_END} and will be out of date
        the moment the market opens again. Nothing here is advice about any
        company.
      </p>
    </>
  ),
  'tsx-60-shares-furthest-below-their-highs': () => (
    <>
      <h2>The calmest of the three markets</h2>
      <p>
        As at {STUDY_END}, the middle company in the S&P/TSX 60 sat{' '}
        <strong>10.2% below its own highest price of the past year</strong>.
      </p>
      <DataTable
        wrapHeaders
        caption={`The three markets on the same day, ${STUDY_END}`}
        columns={[
          { key: 'measure', label: 'Measure' },
          { key: 'au', label: 'ASX 200', numeric: true },
          { key: 'us', label: 'S&P 500', numeric: true },
          { key: 'ca', label: 'S&P/TSX 60', numeric: true },
        ]}
        rows={[
          {
            cells: {
              measure: 'Middle company is below its high by',
              au: '17.5%',
              us: '11.7%',
              ca: '10.2%',
            },
          },
          { cells: { measure: 'More than 20% below', au: '44%', us: '29%', ca: '17%' } },
          {
            cells: {
              measure: 'More than 50% below',
              au: '16 companies',
              us: '12 companies',
              ca: 'none',
            },
          },
          {
            cells: { measure: 'Deepest single fall', au: '−74.0%', us: '−76.2%', ca: '−39.1%' },
            emphasis: true,
          },
        ]}
      />
      <p>
        The last row is the one that matters. Australia has sixteen companies more
        than half below their own high and the United States has twelve. Canada’s
        worst performer, Thomson Reuters, is down 39.1%, and nothing else in the
        index is below 36%.
      </p>
      <p>
        Part of that is simply that sixty of a country’s largest companies are a
        narrower and steadier group than two hundred of them. But it is not only
        size: comparing the sixty largest companies in each market, Canada still
        comes out the steadiest.
      </p>

      <h2>The ten that are down more than 20%</h2>
      <DataTable
        wrapHeaders
        minWidth="560px"
        caption="Every S&P/TSX 60 company more than 20% below its own one-year high. Nothing else in the index qualifies."
        columns={[
          { key: 'rank', label: '#', width: '7%' },
          { key: 'name', label: 'Company', width: '29%' },
          { key: 'y1', label: 'Below its 1-year high', numeric: true, width: '20%' },
          { key: 'all', label: 'Below its best since 2000', numeric: true, width: '24%' },
          { key: 'sector', label: 'Sector label', width: '20%' },
        ]}
        rows={[
          { cells: { rank: '1', name: 'Thomson Reuters', y1: '−39.1%', all: '−49.3%', sector: 'Industrials' } },
          { cells: { rank: '2', name: 'Open Text', y1: '−35.8%', all: '−41.9%', sector: 'Technology' } },
          { cells: { rank: '3', name: 'TELUS', y1: '−35.6%', all: '−48.0%', sector: 'Communication Services' } },
          { cells: { rank: '4', name: 'WSP Global', y1: '−34.4%', all: '−34.4%', sector: 'Industrials' } },
          { cells: { rank: '5', name: 'Celestica', y1: '−32.9%', all: '−32.9%', sector: 'Technology' } },
          { cells: { rank: '6', name: 'Constellation Software', y1: '−32.4%', all: '−40.9%', sector: 'Technology' } },
          { cells: { rank: '7', name: 'FirstService', y1: '−32.2%', all: '−32.2%', sector: 'Real Estate' } },
          { cells: { rank: '8', name: 'CAE', y1: '−27.6%', all: '−27.6%', sector: 'Industrials' } },
          { cells: { rank: '9', name: 'Gildan Activewear', y1: '−25.5%', all: '−25.5%', sector: 'Consumer Cyclical' } },
          { cells: { rank: '10', name: 'CGI', y1: '−22.9%', all: '−40.6%', sector: 'Technology' } },
        ]}
      />
      <p>
        Four of the ten are technology companies, and Canada only has five
        technology companies in this index. The fifth, Shopify, is 15.6% below its
        high.{' '}
        <strong>
          Every single technology company in the S&P/TSX 60 is meaningfully below
          its own peak, and four of the five are down more than 20%.
        </strong>
      </p>
      <p>
        The two sector labels that would mislead you here are the first and the
        fifth. Thomson Reuters is filed under Industrials but sells legal and
        financial information, and Celestica is filed under Technology but
        manufactures electronics to order. If you read the sector column as a
        description of the business, you would draw the wrong conclusion about
        both.
      </p>

      <h2>Everything Canada is famous for is near its high</h2>
      <p>
        The mirror image of that concentration is how completely untouched the rest
        of the index is.
      </p>
      <ul>
        <li>
          <strong>Five of the six banks</strong> are within 8% of their own highs —
          Royal Bank 6.9% below, Toronto-Dominion 4.3%, Bank of Nova Scotia 2.2%,
          Bank of Montreal and CIBC 7.9% each — and the sixth, National Bank, is
          10.2% below.
        </li>
        <li>
          <strong>All five gold companies</strong> are near their peaks:
          Franco-Nevada 2.7% below, Wheaton 3.4%, Barrick 10.2%, Agnico Eagle
          14.5%, Kinross 15.5%.
        </li>
        <li>
          <strong>Every oil and gas producer</strong> is within 11%: Canadian
          Natural 2.6% below, Suncor 4.0%, Imperial Oil 4.2%, Cenovus 4.4%,
          Tourmaline 10.6%.
        </li>
        <li>
          The two copper miners, Teck and First Quantum, are 2.0% and 1.8% below —
          First Quantum is the only company in the whole index within 2% of its
          high.
        </li>
      </ul>
      <p>
        Not one company in financial services, energy, basic materials, consumer
        staples or utilities is more than 20% below its high. Between them those
        five groups are 38 of the 60.
      </p>
      <p>
        This is a very unusual shape for a market to be in. The parts of the
        Canadian index that people think of as cyclical and risky — banks, oil,
        mining — are the parts holding up, and the damage sits almost entirely in
        software and services.
      </p>

      <h2>What the history says about falls this size</h2>
      <p>
        Because nothing in this index has fallen more than 40%, the relevant
        history is the shallow end of the range, and it is comparatively
        reassuring. Measuring every 20% fall in the TSX 60 since 2000:
      </p>
      <DataTable
        wrapHeaders
        caption="Every TSX 60 fall since 2000 with five full years of history behind it. Nothing in the current index has fallen far enough to need a deeper row."
        columns={[
          { key: 'depth', label: 'The size of the fall' },
          { key: 'n', label: 'Falls', numeric: true },
          { key: 'back', label: 'Back within 5 years', numeric: true },
          { key: 'down', label: 'Still down 5 years on', numeric: true },
        ]}
        rows={[
          { cells: { depth: '20% to 30%', n: '195', back: '100%', down: '0%' } },
          { cells: { depth: '30% to 40%', n: '74', back: '100%', down: '0%' } },
        ]}
      />
      <p>
        Every Canadian fall of between 20% and 40% that has had five years to
        recover, has recovered. Not one exception in 206 of them. That is a
        completely different picture from a fall past 70%, where only about a third
        were back inside five years.
      </p>
      <p>
        It is not a promise. Those are 269 past falls in a specific set of large
        companies, not a rule about the future, and eleven Canadian falls are below
        their old price as we write — all of them recent. But the size of a fall is
        the strongest single predictor we have found of how it ends, and on that
        measure Canada’s ten are in the mildest part of the range.
      </p>
      <p>
        The same measurement across all three markets is in{' '}
        <Link href="/articles/how-long-does-an-asx-share-take-to-recover">
          How long does an ASX share take to recover?
        </Link>
        , and the two companion rankings are{' '}
        <Link href="/articles/asx-200-shares-furthest-below-their-highs">the ASX 200</Link>{' '}
        and{' '}
        <Link href="/articles/sp-500-shares-furthest-below-their-highs">the S&P 500</Link>.
      </p>

      <h2>How to read the numbers</h2>
      <p>
        The one-year high is the highest price actually traded in the past 252
        trading days. Prices include dividends, which matters in Canada, where the
        banks and pipelines pay a large part of their return that way. Figures are
        as at {STUDY_END}. Nothing here is advice about any company.
      </p>
    </>
  ),
};

/**
 * An article's figure for the index's featured card — optional by design.
 *
 * ⚠️ `Partial`, deliberately, where `ARTICLE_BODIES` is total. A body is
 * mandatory because an article without one is a blank page; a figure is not,
 * because the owner's constraint is that "the article may or may not have any
 * figures" and the featured card collapses cleanly without it. Making this total
 * would force a drawing to exist for every commentary piece, which is how
 * placeholder art gets shipped.
 */
export const FIGURES: Partial<Record<ArticleSlug, () => React.ReactNode>> = {
  'how-far-do-asx-shares-fall': FallByMarketFigure,
};
