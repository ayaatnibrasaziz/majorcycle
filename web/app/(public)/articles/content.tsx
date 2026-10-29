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

/**
 * The ASX tech article (2026-10-17) — its own measurement date.
 *
 * ⚠️ A DIFFERENT study from the four above, taken seven weeks later, so it has
 * its own date constant rather than borrowing `STUDY_END`. Every figure below is
 * asserted against the draft by `reference/article-drafts/verify/assert_tech.py`,
 * which re-derives it from `reference/asx-tech-2026-10-15-DATA.json.gz`.
 *
 * ⚠️ These are NOT the `ASX_DEPTH_LADDER` figures and must not be merged with
 * them: same method, different date and different index membership, so the
 * whole-index columns differ slightly (CLAUDE.md 11k).
 */
const TECH_AS_AT = '15 October 2026';

/**
 * The Netflix results piece: share prices are at the close of the first full session
 * after the results. Netflix's own figures (revenue, forecasts, buybacks) are from its
 * letter of 20 October and do not move with this date.
 */
const NFLX_AS_AT = '21 October 2026';

/** [company, below its one-year high, normally falls, times its normal, deepest on record] */
const TECH_NORMAL_FALLS = [
  ['Netwealth', '−53.2%', '−20.7%', '2.6×', '−49.4%'],
  ['Xero', '−63.3%', '−25.2%', '2.5×', '−67.4%'],
  ['PEXA', '−60.4%', '−24.4%', '2.5×', '−61.4%'],
  ['NEXTDC', '−47.2%', '−19.8%', '2.4×', '−48.8%'],
  ['Iress', '−45.4%', '−19.6%', '2.3×', '−55.1%'],
  ['WiseTech Global', '−60.1%', '−26.6%', '2.3×', '−76.2%'],
  ['Life360', '−63.1%', '−32.6%', '1.9×', '−82.8%'],
  ['Silex Systems', '−67.9%', '−40.3%', '1.7×', '−87.4%'],
  ['Elsight', '−63.9%', '−39.5%', '1.6×', '−76.6%'],
  ['Weebit Nano', '−72.3%', '−47.1%', '1.5×', '−81.2%'],
  ['Technology One', '−22.4%', '−19.6%', '1.1×', '−73.9%'],
  ['Megaport', '−32.6%', '−30.1%', '1.1×', '−78.0%'],
  ['Codan', '−13.5%', '−24.5%', '0.5×', '−83.2%'],
  ['Block', '−12.0%', '−32.0%', '0.4×', '−58.7%'],
  ['Data#3', '−5.7%', '−20.6%', '0.3×', '−83.1%'],
] as const;

/** [company, 20% falls, came back, typical wait, longest wait, now below record, record set] */
const TECH_RECOVERIES = [
  ['Block', '2', '1', '1 month', '1 month', '−44.2%', 'Mar 2022'],
  ['Codan', '9', '9', '5 months', '5.4 years', '—', '—'],
  ['Data#3', '11', '11', '1.2 years', '4.9 years', '—', '—'],
  ['Elsight', '7', '6', '1 month', '7.6 years', '−63.1%', 'Jun 2026'],
  ['Iress', '9', '8', '1.4 years', '2.1 years', '−58.4%', 'Aug 2021'],
  ['Life360', '4', '3', '1.9 years', '2.3 years', '−65.9%', 'Oct 2025'],
  ['Megaport', '9', '8', '4 months', '4.8 years', '−30.0%', 'Oct 2026'],
  ['NEXTDC', '8', '7', '1.0 years', '2.9 years', '−52.0%', 'Jul 2024'],
  ['Netwealth', '6', '5', '9 months', '3.0 years', '−58.1%', 'Aug 2025'],
  ['PEXA', '1', '0', '—', '—', '−68.7%', 'Jan 2022'],
  ['Silex Systems', '5', '4', '6 months', '5.3 years', '−73.0%', 'Jun 2007'],
  ['Technology One', '11', '10', '8 months', '6.6 years', '−27.2%', 'Jun 2025'],
  ['Weebit Nano', '7', '6', '8 months', '2.8 years', '−71.9%', 'Mar 2023'],
  ['WiseTech Global', '8', '7', '6 months', '1.9 years', '−75.0%', 'Nov 2024'],
  ['Xero', '7', '6', '7 months', '4.2 years', '−70.3%', 'Jun 2025'],
] as const;

/** [how far it fell, tech typical wait, tech back within 5y, whole typical wait, whole back within 5y] */
const TECH_DEPTH_LADDER = [
  ['20% to 30%', '3 months', '100%', '3 months', '100%'],
  ['30% to 40%', '6 months', '100%', '8 months', '99%'],
  ['40% to 50%', '8 months', '100%', '1.4 years', '94%'],
  ['50% to 70%', '2.8 years', '89%', '3.0 years', '72%'],
  ['More than 70%', '4.9 years', '58%', '7.7 years', '33%'],
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
        wrapHeaders
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
        wrapHeaders
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
        stretches the typical wait about four times, from 4 months to 1.5 years.
        Going past 70% nearly triples it again, from 2.9 years to 8.3 years.
      </p>

      <h2>Australian shares take longer than American ones</h2>
      <p>Australia is the slowest of the three markets we cover, on both measures.</p>
      <DataTable
        wrapHeaders
        minWidth="600px"
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
        shares is certainly worse than 12.4%.
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
          { key: 'when', label: 'That peak was', alignRight: true, width: '20%' },
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
          { key: 'when', label: 'That peak was', alignRight: true, width: '20%' },
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
        minWidth="600px"
        caption="Every S&P/TSX 60 company more than 20% below its own one-year high. Nothing else in the index qualifies."
        /* ⚠️ THE ONE RANKED TABLE WITH ITS OWN WIDTHS, and the reason is data, not
           taste. Its last column holds sector NAMES where the AU and US tables hold
           dates: "Communication Services" needs 165px against "Nov 2024"'s 76px, so
           the shared 20% (123px at the 614px reading width) broke TELUS's label over
           two lines and left "Consumer Cyclical" hard against the edge. Owner review,
           2026-08-30: "it looks very squished".

           Re-allocated from MEASUREMENT rather than by trying percentages until it
           looked right. Every column's true need, at the 614px reading width:

             #        27px    Company  176px   (Constellation Software)
             1-year  101px    best     123px   (both bound by their HEADER, not their
             Sector  165px            figures: -35.8% is 61px, but "Below its best
                                      since 2000" only fits two lines from 111px)

           So the slack was never in the sector column — it was the two percentage
           columns holding 270px for content needing 61px each. 5/29/17/21/28 gives
           every column its measured need plus a margin.

           ⚠️ Shortening the headers would have been the easy fix and is forbidden:
           they are the words the piece was approved with, and this file already
           records that trade-off being refused once.

           minWidth 600px, not 614px: at the reading width the table fills its
           wrapper, and a minWidth ABOVE that would make the table scroll on a full
           desktop — the exact defect wrapHeaders was added to cure. At 600px the
           sector column still clears its 165px; "Constellation Software" wraps to two
           lines, which is ordinary for a company name on a phone and is not what was
           being complained about. */
        columns={[
          { key: 'rank', label: '#', width: '5%' },
          { key: 'name', label: 'Company', width: '29%' },
          { key: 'y1', label: 'Below its 1-year high', numeric: true, width: '17%' },
          { key: 'all', label: 'Below its best since 2000', numeric: true, width: '21%' },
          { key: 'sector', label: 'Sector label', alignRight: true, width: '28%' },
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
  'asx-tech-shares-how-far-have-they-fallen': () => (
    <>
      <h2>The index looks calm. Most of the market does not</h2>
      <p>
        As at {TECH_AS_AT}, the ASX 200 index sat{' '}
        <strong>6.2% below its high of 6 August</strong>. That is a smaller dip than
        usual: measured the same way across its history, the index normally falls
        12.8% before it turns.
      </p>
      <p>
        The companies inside it tell a different story. The middle company in the ASX
        200 sat <strong>22.1% below its own one-year high</strong>, and 109 of the 200
        were down more than 20%. The index holds up because it is weighted by size,
        and its largest companies have fallen far less — Commonwealth Bank 14.4%, BHP
        13.8%, CSL 13.5%.
      </p>
      <DataTable
        caption={`The middle ASX 200 company in each sector, below its own one-year high, as at ${TECH_AS_AT}`}
        columns={[
          { key: 'sector', label: 'Sector' },
          { key: 'n', label: 'Companies', numeric: true },
          { key: 'mid', label: 'Middle company, below its one-year high', numeric: true },
        ]}
        rows={[
          { cells: { sector: 'Technology', n: '15', mid: '−53.2%' }, emphasis: true },
          { cells: { sector: 'Communication Services', n: '10', mid: '−32.3%' } },
          { cells: { sector: 'Consumer Cyclical', n: '18', mid: '−31.6%' } },
          { cells: { sector: 'Basic Materials', n: '49', mid: '−30.1%' } },
          { cells: { sector: 'Energy', n: '13', mid: '−25.8%' } },
          { cells: { sector: 'Real Estate', n: '19', mid: '−20.8%' } },
          { cells: { sector: 'Industrials', n: '24', mid: '−19.4%' } },
          { cells: { sector: 'Healthcare', n: '13', mid: '−18.5%' } },
          { cells: { sector: 'Consumer Defensive', n: '8', mid: '−12.8%' } },
          { cells: { sector: 'Financial Services', n: '26', mid: '−10.8%' } },
          { cells: { sector: 'Utilities', n: '3', mid: '−4.8%' } },
        ]}
      />
      <p>
        Twelve of the fifteen technology companies are more than 20% below their high,
        and eight are more than half below. No other sector is close.
      </p>

      <h2>Down a lot is not the same as down a lot for them</h2>
      <p>
        A 50% fall means something different for a small chip developer than for an
        accounting-software company. Some shares routinely halve and come back; others
        almost never move that far. So for every company we also measured{' '}
        <strong>how far it normally falls</strong>: the average of every dip of more
        than 5% in its own price history, each measured from its highest price of the
        year before.
      </p>
      <DataTable
        wrapHeaders
        minWidth="560px"
        caption={`The fifteen ASX 200 technology companies, each against its own history, as at ${TECH_AS_AT}`}
        columns={[
          { key: 'name', label: 'Company', width: '28%' },
          { key: 'now', label: 'Below its one-year high', numeric: true, width: '18%' },
          { key: 'normal', label: 'Normally falls', numeric: true, width: '17%' },
          { key: 'x', label: 'Times its normal fall', numeric: true, width: '17%' },
          { key: 'record', label: 'Deepest fall on record', numeric: true, width: '20%' },
        ]}
        rows={TECH_NORMAL_FALLS.map(([name, now, normal, x, record]) => ({
          cells: { name, now, normal, x, record },
        }))}
      />
      <p>Three things stand out.</p>
      <p>
        <strong>The deepest falls are not the most unusual ones.</strong> Weebit Nano is
        down the most, 72.3%, but it normally falls 47.1%. It is a small semiconductor
        developer whose shares have always moved violently. The most unusual falls
        belong to steadier businesses — Netwealth, Xero, PEXA, NEXTDC, Iress and
        WiseTech are each down more than twice their normal amount.
      </p>
      <p>
        <strong>One is past anything in its record.</strong> Netwealth is 53.2% below
        its high, and the deepest fall in its listed history before this one was
        49.4%. PEXA (−60.4% against a record of −61.4%) and NEXTDC (−47.2% against
        −48.8%) are within two points of theirs.
      </p>
      <p>
        <strong>It is not the whole sector.</strong> Codan, Block and Data#3 sit well
        inside their normal range, and Technology One and Megaport only just past it.
      </p>

      <h2>Technology is the outlier this year</h2>
      <p>
        Across the whole ASX 200, 99 of the 200 companies are past their own normal
        fall, which shows how broad this year’s weakness has been. Being more than
        twice past it is rarer — 21 companies — and six of those 21 are technology
        companies, from a sector of fifteen.
      </p>
      <DataTable
        caption={`Technology against the rest of the ASX 200, as at ${TECH_AS_AT}`}
        columns={[
          { key: 'what', label: 'Measure' },
          { key: 'tech', label: 'Technology', numeric: true },
          { key: 'rest', label: 'Rest of the ASX 200', numeric: true },
        ]}
        rows={[
          { cells: { what: 'Companies', tech: '15', rest: '185' } },
          { cells: { what: 'Past their normal fall', tech: '12 (80%)', rest: '87 (47%)' } },
          {
            cells: { what: 'More than twice their normal fall', tech: '6 (40%)', rest: '15 (8%)' },
            emphasis: true,
          },
          { cells: { what: 'Middle company, below its one-year high', tech: '−53.2%', rest: '−20.8%' } },
          { cells: { what: 'Middle company, normal fall', tech: '−25.2%', rest: '−21.4%' } },
        ]}
      />
      <p>
        The last row is the one worth sitting with. Technology companies do not
        normally fall much further than the rest of the market, 25.2% against 21.4%.
        This year the middle one is down 53.2%, two and a half times the rest of the
        market’s 20.8%.
      </p>

      <h2>Technology falls have usually come back faster</h2>
      <p>
        For the history, we used the same method as{' '}
        <Link href="/articles/how-long-does-an-asx-share-take-to-recover">
          How long does an ASX share take to recover?
        </Link>{' '}
        The clock starts when a share is 20% below its high and stops only when it
        closes back at that high. We ran it again on these fifteen companies and on
        the whole index, to the same date as everything above.
      </p>
      <DataTable
        caption={`Every 20% fall since 2000, as at ${TECH_AS_AT}`}
        columns={[
          { key: 'what', label: 'Every 20% fall since 2000' },
          { key: 'tech', label: 'Technology', numeric: true },
          { key: 'all', label: 'Whole ASX 200', numeric: true },
        ]}
        rows={[
          { cells: { what: 'Falls measured', tech: '104', all: '1,265' } },
          { cells: { what: 'Typical wait to get back', tech: '9 months', all: '11 months' }, emphasis: true },
          { cells: { what: 'Back within 1 year', tech: '52.6%', all: '51.9%' } },
          { cells: { what: 'Back within 3 years', tech: '81.0%', all: '75.7%' } },
          { cells: { what: 'Back within 5 years', tech: '91.8%', all: '84.3%' } },
          { cells: { what: 'Not back yet', tech: '13', all: '159' } },
        ]}
      />
      <p>
        On this record, a 20% fall in an ASX technology share has come back a little
        faster and a little more often than one in the rest of the market. It is the
        only good news in this article, and the next two sections explain why it should
        be held loosely.
      </p>

      <h2>How each of the fifteen has come back before</h2>
      <DataTable
        wrapHeaders
        minWidth="600px"
        caption={`Every 20% fall each company has had since 2000, or since it listed, as at ${TECH_AS_AT}`}
        columns={[
          { key: 'name', label: 'Company', width: '20%' },
          { key: 'falls', label: '20% falls', numeric: true, width: '10%' },
          { key: 'back', label: 'Came back', numeric: true, width: '10%' },
          { key: 'wait', label: 'Typical wait', numeric: true, width: '14%' },
          { key: 'longest', label: 'Longest wait', numeric: true, width: '14%' },
          { key: 'now', label: 'Now, below its record high', numeric: true, width: '18%' },
          { key: 'when', label: 'Record set', alignRight: true, width: '14%' },
        ]}
        rows={TECH_RECOVERIES.map(([name, falls, back, wait, longest, now, when]) => ({
          cells: { name, falls, back, wait, longest, now, when },
        }))}
      />
      <p>
        The waits count only the falls that came back, from the day each was first 20%
        down. Thirteen of the fifteen are in a fall of 20% or more right now. Only Codan
        and Data#3 are not.
      </p>
      <p>Two things in this table matter more than the waits.</p>
      <p>
        <strong>Eight of the fifteen are already deeper than any fall they have come
        back from.</strong> WiseTech’s worst recovered fall was 72.7% and it has now
        been 79.2% down. Netwealth’s was 44.9% against 58.1% now, NEXTDC’s 48.4%
        against 52.0%, Iress’s 58.1% against 64.7%, and Block’s 34.3% against 68.8%.
        Xero’s current fall has gone just past the 71.1% fall it came back from in
        2018, to 71.5%. Silex has been down 98.8% in a fall that began in 2007, and
        PEXA has not come back from the only 20% fall it has had since listing in 2021.
        For these eight, the company’s own history has no precedent for a recovery from
        here.
      </p>
      <p>
        <strong>Some of these falls are already old.</strong> Silex has waited 19.3
        years and is still 73.0% below its 2007 record. Iress has waited 5.1 years,
        PEXA 4.6 and Block 4.5. Each is longer than any wait those companies have come
        through before.
      </p>

      <h2>The deeper the fall, the longer the wait</h2>
      <DataTable
        wrapHeaders
        minWidth="600px"
        caption={`Every 20% fall since 2000, grouped by how far it fell, as at ${TECH_AS_AT}`}
        columns={[
          { key: 'depth', label: 'How far it fell', width: '20%' },
          { key: 'tw', label: 'Technology: typical wait', numeric: true, width: '20%' },
          { key: 't5', label: 'Technology: back within 5 years', numeric: true, width: '20%' },
          { key: 'aw', label: 'Whole ASX 200: typical wait', numeric: true, width: '20%' },
          { key: 'a5', label: 'Whole ASX 200: back within 5 years', numeric: true, width: '20%' },
        ]}
        rows={TECH_DEPTH_LADDER.map(([depth, tw, t5, aw, a5]) => ({
          cells: { depth, tw, t5, aw, a5 },
        }))}
      />
      <p>
        “Back within 5 years” counts only falls with five full years of history behind
        them. For technology that is a small number in the bottom two rows — 9 falls of
        50% to 70%, and 12 past 70% — so those figures could move a long way on one or
        two companies.
      </p>
      <p>
        The thirteen technology companies in a fall today sit mostly in those bottom two
        rows. Measured from each company’s record high, eight have been between 50% and
        70% down at their worst, and four — Silex, Weebit Nano, WiseTech and Xero — more
        than 70%. Across the whole market, about two in three falls past 70% were still
        not back five years later.
      </p>

      <h2>What this cannot tell you</h2>
      <p>
        These are the fifteen technology companies in the ASX 200{' '}
        <strong>today</strong>. Technology companies that fell and were dropped from the
        index are not here, and they did worse than the ones that stayed. That flatters
        the recovery figures above, probably more for technology than for the market as
        a whole, because a company that falls far enough leaves the index. Read them as
        “what the history of today’s large Australian technology companies looks like”,
        not as the odds facing any particular share.
      </p>
      <p>
        It is also a description of the past, and the past has no obligation to repeat.
        A deep fall is where the better opportunities have historically been found, and
        it is also where the permanent losses are. This cannot tell you which of the two
        any particular company is. Only the business can.
      </p>

      <h2>How to read the numbers</h2>
      <p>
        Two different highs are used here, on purpose. The first tables measure each
        company against its <strong>one-year high</strong>, the highest price traded in
        the past 252 trading days, which is the “current drawdown” on every stock page.
        The recovery tables measure from the <strong>record high</strong>, the highest
        close since 2000 or since listing, because a fall has only recovered when the
        price is back above the last peak. That is why Xero is 63.3% below its one-year
        high and 70.3% below its record.
      </p>
      <p>
        Eight of the fifteen set their one-year high in October or November 2025, so
        those highs are about to drop out of the one-year window. When they do, each
        will be measured from a lower high and its fall will look smaller, without the
        share price moving. That is why this article is dated and will not be updated in
        place.
      </p>
      <p>
        “Technology” is each company’s standard sector classification, not our
        judgement. It includes Netwealth, PEXA and Iress, which some would call
        financial or property services, and two US-based companies listed in Australia,
        Block and Life360. Weebit Nano listed in August 2016 through Radar Iron, an
        iron-ore company, so its figures start on 3 August 2016, its first day of trading
        as Weebit. This is the one place our figures differ from its stock page, which
        still includes the older history.
      </p>
      <p>Prices include dividends. Nothing here is advice about any company.</p>
    </>
  ),
  'netflix-q3-2026-results': () => (
    <>
      <h2>The short version</h2>
      <p>
        Netflix reported its results for the three months to 30 September after the US
        market closed on 20 October 2026. In short:
      </p>
      <ul>
        <li>
          <strong>Revenue:</strong> $12.87 billion, up 12% on a year earlier, and within
          0.1% of the $12.86 billion Netflix had forecast in July.
        </li>
        <li>
          <strong>Profit:</strong> operating income of $4.46 billion, 4.5% above the
          company’s own forecast, giving an operating margin of 34.6% against the 33.2% it
          expected. Netflix says this was mainly the timing of expenses, and its full-year
          margin forecast is unchanged at 31.5%.
        </li>
        <li>
          <strong>Earnings per share:</strong> $0.87, against Netflix’s forecast of $0.82
          and $0.59 a year earlier.
        </li>
        <li>
          <strong>The full-year outlook:</strong> revenue of $51.1 billion, at the lower
          half of the $51.0–51.4 billion range it gave in July, with an unchanged operating
          margin of 31.5%.
        </li>
        <li>
          <strong>What changed:</strong> advertising revenue for 2026 is now expected to be
          about <strong>$2.7 billion</strong>, not about $3 billion, and free cash flow
          about <strong>$12.0 billion</strong>, not $12.5 billion.
        </li>
      </ul>
      <p>
        All figures are in US dollars. Share prices and earnings per share are on the basis
        of Netflix’s ten-for-one share split of November 2025, as Netflix itself reports
        them.
      </p>

      <h2>The quarter against Netflix’s own forecast</h2>
      <p>
        Netflix publishes its own forecast for the next quarter with every set of results,
        and says it is its “actual internal forecast”, so the cleanest test of a quarter is
        against that number.
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="Q3 2026 against Netflix’s own July forecast"
        columns={[
          { key: 'what', label: 'Measure', width: '31%' },
          { key: 'fc', label: 'Netflix’s forecast (July)', numeric: true, width: '23%' },
          { key: 'rep', label: 'Reported', numeric: true, width: '23%' },
          { key: 'yago', label: 'A year earlier', numeric: true, width: '23%' },
        ]}
        rows={[
          { cells: { what: 'Revenue', fc: '$12.86B', rep: '$12.87B', yago: '$11.51B' } },
          { cells: { what: 'Revenue growth', fc: '11.7%', rep: '11.8%', yago: '17.2%' } },
          { cells: { what: 'Operating income', fc: '$4.27B', rep: '$4.46B', yago: '$3.25B' }, emphasis: true },
          { cells: { what: 'Operating margin', fc: '33.2%', rep: '34.6%', yago: '28.2%' } },
          { cells: { what: 'Net income', fc: '$3.45B', rep: '$3.66B', yago: '$2.55B' } },
          { cells: { what: 'Diluted earnings per share', fc: '$0.82', rep: '$0.87', yago: '$0.59' } },
        ]}
      />
      <p>
        Growth is slowing. Revenue grew 17.2% in the third quarter of 2025, 16.2% in the
        first quarter of 2026, 13.4% in the second, and 11.8% now. Netflix forecasts 11.5%
        for the fourth quarter. That slowdown was in Netflix’s forecast and is not a
        surprise in itself.
      </p>
      <p>By region, measured in US dollars, every part of the business grew by more than 10%:</p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="Netflix’s revenue by region, third quarter of 2026"
        columns={[
          { key: 'region', label: 'Region', width: '37%' },
          { key: 'rev', label: 'Revenue', numeric: true, width: '19%' },
          { key: 'g', label: 'Growth', numeric: true, width: '19%' },
          { key: 'fx', label: 'Growth without currency moves', numeric: true, width: '25%' },
        ]}
        rows={[
          { cells: { region: 'US and Canada', rev: '$5.63B', g: '11%', fx: '11%' } },
          { cells: { region: 'Europe, Middle East and Africa', rev: '$4.11B', g: '11%', fx: '9%' } },
          { cells: { region: 'Latin America', rev: '$1.60B', g: '17%', fx: '12%' } },
          { cells: { region: 'Asia-Pacific', rev: '$1.54B', g: '12%', fx: '15%' } },
        ]}
      />
      <p>
        Netflix no longer publishes its number of subscribers each quarter: it stopped with
        its first-quarter 2025 results, and now announces only milestones. The last was 325
        million paid memberships, passed in the fourth quarter of 2025. Instead, it says
        that in the third quarter churn, the rate at which members cancel, improved on a
        year earlier and was better than forecast, globally and in the US.
      </p>

      <h2>What changed: the advertising forecast</h2>
      <p>
        The biggest change was to advertising. Netflix started selling ads in November
        2022, and its ad revenue grew more than two and a half times to over $1.5 billion in
        2025. In January it said it expected ad revenue to roughly double in 2026, and in
        April and July it put that at about $3 billion.
      </p>
      <p>
        It now expects <strong>about $2.7 billion</strong>. That is around 10% below what it
        had said, though co-CEO Greg Peters said in the earnings interview that the ads
        business is still growing by “over 80% this year”. Netflix’s explanation is a
        “slightly slower than expected rollout of some ad product capabilities”. It also
        said subscription revenue had done better than it expected. Full-year revenue moved
        only slightly: $51.1 billion is 0.2% below the middle of its July range.
      </p>
      <p>
        Netflix also confirmed that its cheaper plan with ads will launch in 15 more
        countries in 2027, starting in March with nine in Europe, the Middle East and
        Africa, plus Colombia, Peru and <strong>New Zealand</strong>. Australia has had an
        ads plan since November 2022.
      </p>
      <p>
        In the interview, Peters said Netflix had set itself an “aggressive product road
        map” and was “currently a bit behind our aggressive target for the year”, because of
        “delays in the rollout and partner integrations for some of those new ads
        products”.
      </p>

      <h2>The layoffs, and a new head of content</h2>
      <p>In the week before the results, Netflix made two big staff changes.</p>
      <ul>
        <li>
          <strong>Job cuts.</strong> On 14 October, Netflix told staff it would cut about
          1,000 jobs, around 6% of its workforce, mostly in product, technology, legal and
          human resources, as reported by{' '}
          <a href="https://www.nbcnews.com/business/media/netflix-layoffs-rcna603454">NBC News</a> and{' '}
          <a href="https://techcrunch.com/2026/10/14/netflix-to-lay-off-1000-staff-amid-intensifying-competition-for-user-attention/">
            TechCrunch
          </a>
          , to which Netflix confirmed the cuts. The shareholder letter refers to the
          “recently announced headcount reductions” and gives their cost: about 1.2
          percentage points off its fourth-quarter operating margin, which on its revenue
          forecast is roughly $160 million, and about 0.3 points off the full year.
        </li>
        <li>
          <strong>A new chief content officer.</strong> On 15 October Netflix announced that
          Peter Rice, formerly chairman of Walt Disney Television, will run its global
          content team from 26 October. He replaces Bela Bajaria, who is leaving after
          nearly 10 years (
          <a href="https://about.netflix.com/en/news/peter-rice-named-netflix-chief-content-officer">
            Netflix
          </a>
          ).
        </li>
      </ul>
      <p>
        Netflix’s fourth-quarter operating margin forecast is 26.0%, including the cost of
        the cuts, against 24.5% a year earlier. The letter says the changes let it “continue
        to aggressively invest in high impact areas”.
      </p>
      <p>
        Asked why, Peters said that after years of fast growth “there are some areas that we
        built quickly and we ended up over invested in”. CFO Spence Neumann said Netflix will
        not put a number on the savings, and will give its 2027 forecasts, including its
        margin, in January.
      </p>

      <h2>The question about viewing</h2>
      <p>
        The concern investors had been raising before the results was viewing time. In July
        Netflix said view hours grew 2% in the first half of 2026, after 1.5% growth in 2025.
        This letter gives no global figure for the third quarter. It addresses the concern
        directly instead: “We know there’s some investor concern about our view hours
        growth. … But we do seek to accelerate growth in view hours as well.”
      </p>
      <p>
        Its evidence that members are still engaged is that its 2026 price rises have landed
        the way past ones did. It gives India as an example, where view hours grew 24% on a
        year earlier and revenue grew about 18% excluding currency moves.
      </p>
      <p>
        The interview was more direct than the letter. Neumann: “we want to grow view hours
        faster. We’re not satisfied. We’re working on it”. And the weak spot is the US.
        Co-CEO Ted Sarandos: “We do need better execution in the U.S. … It’s just not
        growing as fast as it could or as fast as we’d like”. He described bringing in Peter
        Rice as a chance to take Netflix’s slate “to the next level, especially in the
        U.S.”.
      </p>
      <p>
        One remark matters for Australian readers. Asked where growth will come from, Peters
        named the US, the UK and <strong>Australia</strong> as Netflix’s “most mature
        markets”, where it is “more deeply penetrated”, so its growth there is “going to
        skew towards” higher revenue per member and advertising. In newer markets such as
        India, he said, more members will be the biggest driver.
      </p>

      <h2>Where the cash went</h2>
      <p>
        Netflix generated $2.9 billion of free cash flow in the quarter and spent $4.8
        billion buying back 63.9 million of its own shares, its largest quarter of buybacks
        ever, at an average of about $75 a share. It has $22.3 billion left under its
        buyback authorisations. Its average diluted share count was 3.3% lower than a year
        earlier.
      </p>
      <p>
        It ended September with $8.2 billion of cash and $15.3 billion of debt. The $1
        billion it borrowed in the quarter is to repay a $1 billion bond falling due in the
        fourth quarter.
      </p>
      <p>
        It now expects about $12.0 billion of free cash flow for 2026, down from $12.5
        billion, which it puts mainly down to a real estate transaction it expects to
        complete in the fourth quarter.
      </p>

      <h2>How the shares reacted</h2>
      <p>
        On {NFLX_AS_AT}, the first full trading day after the results, Netflix closed at
        $65.04, down 5.3% from $68.69 the day before. It was its lowest close since August
        2024. At that close, the shares were:
      </p>
      <ul>
        <li>
          <strong>51.4% below their record close</strong> of $133.91 on 30 June 2025,
        </li>
        <li>
          <strong>44.3% below their</strong>{' '}
          <Link href="/learn/52-week-high">
            <strong>highest price of the past year</strong>
          </Link>
          , $116.73 on 13 November 2025,
        </li>
        <li>
          <strong>30.6% lower than at the start of 2026.</strong>
        </li>
      </ul>
      <p>
        The US market has not fallen with it. On the same day the{' '}
        <Link href="/articles/sp-500-shares-furthest-below-their-highs">S&P 500</Link>{' '}
        rose 0.6%, closing 0.8% below its record close, set on 6 October.
      </p>

      <h2>How Netflix shares usually react to results</h2>
      <p>
        Big moves the day after results are normal for Netflix. We measured all 44 regular
        results releases from January 2016 to October 2026, comparing the close on the day
        after with the close on the day Netflix reported:
      </p>
      <ul>
        <li>
          The middle move, up or down, was <strong>7.3%</strong>. Since 2022 it was{' '}
          <strong>8.8%</strong>.
        </li>
        <li>
          13 of the 44 moved by 10% or more. The largest fall was <strong>35.1%</strong> in
          April 2022, when Netflix reported a loss of 200,000 paid memberships against its
          own forecast of a gain of 2.5 million. The largest rise was{' '}
          <strong>19.0%</strong> in October 2016.
        </li>
        <li>The shares fell after 28 of the 44.</li>
        <li>
          <strong>They have now fallen after each of the last six</strong>: July 2025
          (−5.1%), October 2025 (−10.1%), January 2026 (−2.2%), April 2026 (−9.7%), July
          2026 (−7.3%) and October 2026 (−5.3%).
        </li>
      </ul>

      <h2>How this fall compares with Netflix’s past falls</h2>
      <p>
        Netflix has fallen this far before, several times. These are{' '}
        <Link href="/learn/what-is-a-drawdown">every fall of 40% or more</Link>, measured
        from a record close to the lowest close before the shares got back to it:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption={`Netflix’s falls of 40% or more, as at ${NFLX_AS_AT}`}
        columns={[
          { key: 'peak', label: 'Record close', width: '24%' },
          { key: 'low', label: 'Lowest point', width: '28%' },
          { key: 'fall', label: 'Fall', numeric: true, width: '18%' },
          { key: 'back', label: 'Back at the record', alignRight: true, width: '30%' },
        ]}
        rows={[
          { cells: { peak: 'July 2002', low: 'October 2002', fall: '−70.8%', back: 'March 2003' } },
          { cells: { peak: 'January 2004', low: 'March 2005', fall: '−76.7%', back: 'April 2008' } },
          { cells: { peak: 'April 2008', low: 'October 2008', fall: '−55.9%', back: 'March 2009' } },
          { cells: { peak: 'July 2011', low: 'September 2012', fall: '−82.0%', back: 'September 2013' } },
          { cells: { peak: 'July 2018', low: 'December 2018', fall: '−44.2%', back: 'April 2020' } },
          { cells: { peak: 'November 2021', low: 'May 2022', fall: '−75.9%', back: 'August 2024' } },
          {
            cells: { peak: 'June 2025', low: 'October 2026 (so far)', fall: '−51.4%', back: 'Not yet' },
            emphasis: true,
          },
        ]}
      />
      <p>
        The current fall reached its deepest point so far on {NFLX_AS_AT}, the day after the
        results, 51.4% below the record. It is the sixth-deepest of Netflix’s seven falls of
        40% or more since it listed in 2002. Each of the earlier six got back to its record,
        taking between about five months and just over three years from the low. That is a
        record of what happened, not a guide to what will.
      </p>
      <p>
        Our stock page measures a fall from the highest price of the last 252 trading days,
        which on {NFLX_AS_AT} still included last year’s results day, 21 October 2025, at
        $124.86. On that setting, Netflix{' '}
        <Link href="/learn/own-history-vs-market-average">normally falls</Link> about 26.9%
        below that high before turning. On {NFLX_AS_AT} it was 47.9% below.
      </p>

      <h2>What comes next</h2>
      <ul>
        <li>
          <strong>The fourth quarter.</strong> Netflix forecasts revenue of $13.44 billion
          and earnings of $0.67 a share. Its slate includes three NFL games (Thanksgiving Eve
          and a Christmas Day doubleheader), the Tyson Fury vs Anthony Joshua fight, the
          final season of Emily in Paris, and the film The Further Mis-Adventures of Cliff
          Booth.
        </li>
        <li>
          <strong>The next results.</strong> Netflix said it will report next in January,
          and Neumann said it will give its 2027 forecasts then. It has not set a date. Its
          fourth-quarter results came out on 23 January 2024, 21 January 2025 and 20 January
          2026.
        </li>
        <li>
          <strong>Ads in 15 more countries,</strong> from March 2027.
        </li>
      </ul>

      <h2>What this cannot tell you</h2>
      <p>
        These are results for one quarter and Netflix’s own forecasts for the next. A
        forecast is a company’s estimate and can be wrong, as the advertising number shows.
        The share-price history is a record of what happened before, not a prediction. This
        article is general information and does not take into account your objectives,
        financial situation or needs.
      </p>
    </>
  ),
  'meta-q3-2026-results': () => (
    <>

      <h2>The short version</h2>
      <p>
        Meta reported its results for the three months to 30 September after the US market
        closed on 21 October 2026. In short:
      </p>
      <ul>
        <li>
          <strong>Revenue:</strong> $64.60 billion, up 26% on a year earlier, and above the
          $61–64 billion Meta had forecast in July.
        </li>
        <li>
          <strong>Profit:</strong> operating income of $12.99 billion, down 37%, after a $9.89
          billion charge for its agreement with US state attorneys general over teen mental
          health. Without that charge, Meta says operating income would have been $22.88
          billion, up 11%.
        </li>
        <li>
          <strong>Earnings per share:</strong> $3.83, or $7.40 without the charge.
        </li>
        <li>
          <strong>Spending:</strong> $34.91 billion of capital expenditure in the quarter,
          mostly servers, data centres and network infrastructure, which left free cash flow at{' '}
          <strong>negative $2.12 billion</strong>.
        </li>
        <li>
          <strong>What’s new:</strong> a non-voting Class C share, to be given to every
          shareholder, one for each share they own, after the new class takes effect on 19
          January 2027.
        </li>
      </ul>
      <p>
        All figures are in US dollars.
      </p>

      <h2>The quarter against Meta’s own forecast</h2>
      <p>
        Since October 2021, Meta has given a revenue range for the next quarter with each set of
        results, so the cleanest test of a quarter is against that range.
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="The quarter against Meta’s own forecast"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Meta’s forecast (July)', numeric: true, width: '20%' },
          { key: 'c2', label: 'Reported', numeric: true, width: '20%' },
          { key: 'c3', label: 'A year earlier', numeric: true, width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'Revenue', c1: '$61–64B', c2: '$64.60B', c3: '$51.24B' } },
          { cells: { c0: 'Revenue growth', c1: '19–25%', c2: '26%', c3: '26%' } },
          { cells: { c0: 'Operating income', c1: '—', c2: '$12.99B', c3: '$20.54B' } },
          { cells: { c0: 'Operating margin', c1: '—', c2: '20%', c3: '40%' } },
          { cells: { c0: 'Net income', c1: '—', c2: '$9.86B', c3: '$2.71B' } },
          { cells: { c0: 'Diluted earnings per share', c1: '—', c2: '$3.83', c3: '$1.05' } },
        ]}
      />
      <p>
        The forecast growth of 19–25% is what that range implied. Revenue came in 0.9% above the
        top of the range. Meta’s quarterly forecast covers revenue, not profit, so the profit
        lines have no forecast to test against.
      </p>
      <p>
        The year-earlier profit figures need a warning. Both quarters carry a large one-off
        cost, on different lines:
      </p>
      <ul>
        <li>
          <strong>This year,</strong> the $9.89 billion legal charge sits in expenses. Without
          it, earnings per share would have been $7.40.
        </li>
        <li>
          <strong>A year ago,</strong> a one-time, non-cash tax charge of $15.93 billion, from
          changes to US tax law, cut net income to $2.71 billion. Without it, earnings per share
          would have been $7.25.
        </li>
      </ul>
      <p>
        So the reported 265% rise in earnings per share is mostly those two charges. On Meta’s
        own figures without them, earnings per share grew by about 2%, from $7.25 to $7.40.
      </p>
      <p>
        Revenue growth has held up. It was 24% in the fourth quarter of 2025, 33% in the first
        quarter of 2026, 28% in the second, and 26% now. Advertising, almost all of Meta’s
        revenue, grew 26%: Meta showed 10% more ads and charged 14% more for each one on
        average. On average, 3.64 billion people used at least one of its apps each day in
        September, 3% more than a year earlier.
      </p>

      <h2>The legal charge</h2>
      <p>
        In August, Meta reached an agreement with 52 attorneys general across US states,
        territories and the District of Columbia to settle their lawsuits over teen mental
        health and social media. It provides for payments of up to about $18.59 billion over ten
        years, part of which depends on other companies, such as YouTube and TikTok, agreeing to
        similar terms, and changes to how Facebook and Instagram work for US users under 18.
      </p>
      <p>
        Meta booked a $9.89 billion charge for the agreement in the third quarter. It also
        warned that it has “a number of youth-related trials scheduled in the coming months” in
        the US.
      </p>

      <h2>Where the money is going</h2>
      <p>
        Meta’s spending on computing power keeps rising. In the third quarter, capital
        expenditure was $34.91 billion, against $31.08 billion in the second quarter and $19.37
        billion a year earlier. Cash from operations was $32.79 billion, so spending ran ahead
        of it and free cash flow was negative.
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="Where the money is going"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Third quarter 2026', numeric: true, width: '30%' },
          { key: 'c2', label: 'A year earlier', numeric: true, width: '30%' },
        ]}
        rows={[
          { cells: { c0: 'Cash from operations', c1: '$32.79B', c2: '$30.00B' } },
          { cells: { c0: 'Capital expenditure', c1: '$34.91B', c2: '$19.37B' } },
          { cells: { c0: 'Free cash flow', c1: '−$2.12B', c2: '$10.62B' } },
        ]}
      />
      <p>
        To pay for it, Meta borrowed $25.00 billion in May, and it did not buy back any of its
        own shares in the first nine months of the year: $25.03 billion of its buyback
        authorisation is still unused. It still pays a quarterly dividend of $0.525 a share. It
        ended September with $82.45 billion of cash and marketable securities and $84.00 billion
        of bonds outstanding.
      </p>
      <p>
        Its full-year capital expenditure forecast is now $135–145 billion, narrowed from
        $130–145 billion. Its 2026 expense forecast rose to $175–179 billion, from $165–169
        billion, an increase of $10 billion that Meta says takes in the legal charge. Meta
        usually gives the next year’s forecasts with its fourth-quarter results, and says it
        expects “to continue investing aggressively”.
      </p>

      <h2>Muse, and why Australia does not have it yet</h2>
      <p>
        Most of the call was about Muse, a personal AI agent that can shop, book and manage
        tasks for its user. CEO Mark Zuckerberg said that in a month and a half, “more than 10
        million people in the US and Canada have set up Muse personal agents”, and that about a
        quarter of them use it on any given day.
      </p>
      <p>
        It is not available in Australia. CFO Susan Li: “today Muse is only available in the
        U.S. and Canada”. Muse takes a lot of computing power to run, which Zuckerberg named as
        one reason it has not launched more widely, and Meta expects to make it more than ten
        times more cost-efficient over the next year. For now it makes money only from
        subscriptions.
      </p>

      <h2>Is Meta splitting its stock?</h2>
      <p>
        In effect, yes. Meta is creating a new class of shares, Class C, which carry no votes.
        Every shareholder will receive one Class C share for each Class A or Class B share they
        hold. Li called it “effectively resulting in a two-for-one stock split”.
      </p>
      <ul>
        <li>
          <strong>When:</strong> the new share class takes effect on 19 January 2027, and Meta
          expects Class C trading to “begin in late January 2027”. The exact record and payment
          dates are still to be set.
        </li>
        <li>
          <strong>What happens to the price:</strong> after the payment date, Meta expects the
          Class A share price to reflect a two-for-one split. In principle a shareholder’s
          holding is worth the same, spread over twice as many shares.
        </li>
        <li>
          <strong>Votes:</strong> no shareholder’s voting power changes. Class C shares have
          none.
        </li>
        <li>
          <strong>Why:</strong> Meta says it wants a share it can use to raise money, pay
          employees and make acquisitions without changing who controls the votes. Li: “We don’t
          have any specific financing plans to announce at this time”.
        </li>
      </ul>
      <p>
        How much money might be raised is the open question. The information statement Meta
        filed with the results says forecasts management showed the board in May pointed to “the
        Company’s need to raise hundreds of billions of dollars over a period of several years
        beginning as early as fall 2026”. Asked about it on the follow-up call, Li said the
        reference was “a theoretical maximum” and “not actually a description of our present
        equity financing needs or plans”.
      </p>
      <p>
        Zuckerberg holds about 56.1% of the votes, through his Class B shares. Under a separate
        agreement, he can sell 20% of the Class C shares he receives freely, but for the other
        80% each sale must be matched by selling or converting one of his voting shares.
      </p>

      <h2>Two things for Australian readers</h2>
      <p>
        Beyond Muse, Meta’s quarterly report names Australia twice as a risk:
      </p>
      <ul>
        <li>
          <strong>The under-16 social media ban.</strong> It lists “recent legislation in
          Australia” that “imposes a social media ban for users under 16 years old” among the
          youth rules it must comply with.
        </li>
        <li>
          <strong>Paying for news.</strong> It notes that “Australia has enacted a tax on
          revenue to incentivize payments to news publishers”.
        </li>
      </ul>

      <h2>How the shares reacted</h2>
      <p>
        On 22 October, the first full day of trading after the results, Meta closed at $648.85,
        down 7.0% from $697.52 the day before. The shares had risen in after-hours trading on 21
        October, by about 3.8% according to Investing.com, before the full session’s fall. The
        wider market fell too: the S&P 500 lost 1.2% and the Nasdaq Composite 2.6% that day.
      </p>
      <p>
        It was the third results day in a row on which Meta’s shares fell. After the fall, Meta
        was:
      </p>
      <ul>
        <li>
          <strong>17.9% below its record close</strong> of $790.00 on 12 August 2025,
        </li>
        <li>
          <strong>16.8% below its highest price of the past year</strong>, $779.82 on 24
          September 2026,
        </li>
        <li>
          <strong>1.7% lower than at the start of 2026.</strong>
        </li>
      </ul>
      <p>
        The current dip has already been deeper. From that August record, Meta fell as far as
        $525.72 on 27 March 2026, 33.5% below.
      </p>
      <p>
        The US market is still near its high: on 22 October the S&P 500 was 2.0% below its
        record close, set on 6 October.
      </p>

      <h2>How Meta shares usually react to results</h2>
      <p>
        Results days have become bigger events for Meta. We measured all 44 regular results
        releases from January 2016 to October 2026, comparing the close on the day after with
        the close on the day Meta reported:
      </p>
      <ul>
        <li>
          The middle move, up or down, was <strong>6.0%</strong>. Since 2022 it was{' '}
          <strong>9.5%</strong>.
        </li>
        <li>
          13 of the 44 moved by 10% or more.
        </li>
        <li>
          The largest fall was <strong>26.4%</strong> in February 2022, when Meta forecast
          revenue growth of just 3–11% for the next quarter and pointed to competition for
          people’s time, the shift to Reels, which earn less, and Apple’s iOS changes. It fell{' '}
          <strong>24.6%</strong> again in October 2022.
        </li>
        <li>
          The largest rise was <strong>23.3%</strong> in February 2023, when Meta added $40
          billion to its buyback and cut its expense forecast.
        </li>
        <li>
          The shares fell after 21 of the 44. The last four: January 2026 (+10.4%), April 2026
          (−8.6%), July 2026 (−8.0%) and October 2026 (−7.0%).
        </li>
      </ul>

      <h2>How far Meta has fallen before</h2>
      <p>
        Meta has fallen 30% or more six times since it listed in May 2012, counting the current
        fall. These are measured from a record close to the lowest close before the shares got
        back to it:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="How far Meta has fallen before"
        columns={[
          { key: 'c0', label: 'Record close', width: '40%' },
          { key: 'c1', label: 'Lowest point', width: '20%' },
          { key: 'c2', label: 'Fall', numeric: true, width: '20%' },
          { key: 'c3', label: 'Back at the record', width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'May 2012', c1: 'September 2012', c2: '−53.6%', c3: 'August 2013' } },
          { cells: { c0: 'July 2018', c1: 'December 2018', c2: '−43.0%', c3: 'January 2020' } },
          { cells: { c0: 'January 2020', c1: 'March 2020', c2: '−34.6%', c3: 'May 2020' } },
          { cells: { c0: 'September 2021', c1: 'November 2022', c2: '−76.7%', c3: 'January 2024' } },
          { cells: { c0: 'February 2025', c1: 'April 2025', c2: '−34.2%', c3: 'June 2025' } },
          { cells: { c0: 'August 2025', c1: 'March 2026 (deepest so far)', c2: '−33.5%', c3: 'Not yet' } },
        ]}
      />
      <p>
        The first was the slide after its listing; the 2018 fall began with the results day of
        July 2018 (−19.0%); the 2020 fall came in the market crash of March 2020; and the
        2021–22 fall took in both of the 2022 results-day falls above.
      </p>
      <p>
        The first five all got back to their record, and how long it took followed how far they
        fell. The two falls of about a third, in 2020 and 2025, were back about two months after
        the low. The three deeper ones, of 43% to 77%, took between 11 and 15 months. The
        current fall is, so far, about the size of the two quick ones. That is a record of what
        happened, not a guide to what will.
      </p>
      <p>
        Measured on our stock page’s setting, Meta normally falls about 21.7% below its one-year
        high before turning. On 22 October it was 16.8% below, inside its normal range.
      </p>

      <h2>What comes next</h2>
      <ul>
        <li>
          <strong>The fourth quarter.</strong> Meta forecasts revenue of $73–76 billion, 22–27%
          more than a year earlier, and a tax rate of 15–17%.
        </li>
        <li>
          <strong>2027.</strong> No revenue forecast yet. Meta says it expects to “sustain
          strong overall revenue growth throughout 2027”, and that Reality Labs, its glasses and
          headsets unit, will lose about $15 billion, down from $18–19 billion in 2026.
        </li>
        <li>
          <strong>The share split.</strong> The Class C shares take effect on 19 January 2027.
        </li>
        <li>
          <strong>The next results.</strong> Meta has not set a date. Its fourth-quarter results
          came out on 1 February 2024, 29 January 2025 and 28 January 2026.
        </li>
      </ul>

      <h2>What this cannot tell you</h2>
      <p>
        These are results for one quarter and Meta’s own forecasts for the next. A forecast is a
        company’s estimate and can be wrong. The share-price history is a record of what
        happened before, not a prediction. This article is general information and does not take
        into account your objectives, financial situation or needs.
      </p>
    </>
  ),
  'tesla-q3-2026-results': () => (
    <>

      <h2>The short version</h2>
      <p>
        Tesla reported its results for the three months to 30 September after the US market
        closed on 21 October 2026. In short:
      </p>
      <ul>
        <li>
          <strong>Revenue:</strong> $28.05 billion, against $28.10 billion a year earlier.
        </li>
        <li>
          <strong>Profit:</strong> operating income of $718 million, down 56% from $1.62
          billion. Net income was $787 million, down 43%.
        </li>
        <li>
          <strong>Earnings per share:</strong> $0.22, or $0.48 on Tesla’s adjusted measure,
          which leaves out share-based pay and some investment gains and losses.
        </li>
        <li>
          <strong>Cash:</strong> $1.53 billion of free cash flow, and $45.45 billion of cash and
          investments.
        </li>
        <li>
          <strong>Cars:</strong> 486,532 delivered, 2% fewer than a year earlier. Production
          rose 4%, to 464,391.
        </li>
        <li>
          <strong>What’s new:</strong> a board committee to explore a deeper relationship with
          SpaceX, and a lower spending forecast for 2026.
        </li>
      </ul>
      <p>
        All figures are in US dollars.
      </p>

      <h2>The quarter against a year earlier</h2>
      <p>
        Tesla does not give a revenue forecast, so the cleanest test is against the same quarter
        a year earlier.
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="The quarter against a year earlier"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Third quarter 2026', numeric: true, width: '20%' },
          { key: 'c2', label: 'A year earlier', numeric: true, width: '20%' },
          { key: 'c3', label: 'Change', numeric: true, width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'Revenue', c1: '$28.05B', c2: '$28.10B', c3: '−0.2%' } },
          { cells: { c0: 'Car sales and leasing', c1: '$20.56B', c2: '$21.21B', c3: '−3.0%' } },
          { cells: { c0: 'Energy storage and solar', c1: '$2.88B', c2: '$3.42B', c3: '−15.6%' } },
          { cells: { c0: 'Services and other', c1: '$4.61B', c2: '$3.48B', c3: '+32.5%' } },
          { cells: { c0: 'Gross profit', c1: '$5.49B', c2: '$5.05B', c3: '+8.7%' } },
          { cells: { c0: 'Operating expenses', c1: '$4.78B', c2: '$3.43B', c3: '+39.2%' } },
          { cells: { c0: 'Operating income', c1: '$0.72B', c2: '$1.62B', c3: '−55.8%' } },
          { cells: { c0: 'Operating margin', c1: '2.6%', c2: '5.8%', c3: '' } },
          { cells: { c0: 'Diluted earnings per share', c1: '$0.22', c2: '$0.39', c3: '' } },
        ]}
      />
      <p>
        Tesla made more on each sale: its gross margin rose to 19.6%, from 18.0%. The profit
        went on spending. Operating expenses rose 39%, which Tesla puts down to its AI work,
        which it calls Super Intelligence, and other research projects, to share-based pay,
        including its CEO’s 2025 pay award, and to overheads. Research and development alone
        cost $2.76 billion, up from $1.63 billion, a rise of 69%.
      </p>
      <p>
        Energy storage revenue fell, which Tesla says was partly due to “tariff-related customer
        refunds”. It also says it has its “highest-ever order rate and backlog” for storage.
        Services and other grew 32.5%. Within car revenue, Tesla points to higher sales of Full
        Self-Driving: its active customers, counting both one-off purchases and monthly
        subscriptions, reached 1.74 million, up from 1.04 million a year earlier.
      </p>

      <h2>Where the money is going</h2>
      <p>
        Tesla’s spending is rising quickly, but less quickly than it said in July.
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="Where the money is going"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Third quarter 2026', numeric: true, width: '30%' },
          { key: 'c2', label: 'A year earlier', numeric: true, width: '30%' },
        ]}
        rows={[
          { cells: { c0: 'Cash from operations', c1: '$6.26B', c2: '$6.24B' } },
          { cells: { c0: 'Capital expenditure', c1: '$4.73B', c2: '$2.25B' } },
          { cells: { c0: 'Free cash flow', c1: '$1.53B', c2: '$3.99B' } },
        ]}
      />
      <p>
        In its second-quarter report, Tesla said it expected capital expenditure of “in excess
        of $25 billion in 2026”. In this quarter’s report the figure is “in excess of $20
        billion in 2026”. It has spent $13.01 billion in the first nine months, so the new
        figure points to about $7 billion or more in the last three.
      </p>
      <p>
        Tesla says the spending is driven by its Super Intelligence projects: computing power
        and data centres, new manufacturing and research production lines, and the fleet of cars
        and other assets it runs itself. It plans to take its computing power for training its
        driving and robot software to 400 megawatts by the end of the year, and to start
        commissioning equipment in 2027 at a chip factory it is building in Austin.
      </p>

      <h2>Robotaxi, Optimus and the Semi</h2>
      <ul>
        <li>
          <strong>Robotaxi.</strong> Tesla started giving Robotaxi rides in Cybercabs in Austin
          on 3 September. Its Robotaxi service had driven nearly two million miles unsupervised
          by the end of September.
        </li>
        <li>
          <strong>Optimus.</strong> Production of its humanoid robot began on Tesla’s
          high-volume line in Fremont.
        </li>
        <li>
          <strong>Tesla Semi.</strong> Volume production of its heavy truck began in Nevada.
        </li>
      </ul>

      <h2>SpaceX</h2>
      <p>
        Tesla’s quarterly report, filed the day after the results, says its board “has formed a
        special committee … comprising disinterested directors to explore deepening Tesla’s
        relationship with SpaceX, which could be through certain arrangements including without
        limitation a business combination”. It adds that “there is no assurance that any such
        Transaction will be consummated”, and that one would need the committee’s recommendation
        and, if agreed, shareholder approval.
      </p>
      <p>
        Tesla already owns a small part of SpaceX: it invested $2.00 billion in SpaceX shares in
        March 2026, a stake of less than 1%. Elon Musk is the chief executive of both companies.
      </p>

      <h2>For Australian readers</h2>
      <p>
        Tesla says it achieved “record quarterly deliveries in several markets, including
        Canada, Australia, Japan and Taiwan”. It does not give a figure for Australia.
      </p>

      <h2>How the shares reacted</h2>
      <p>
        On 22 October, the first full day of trading after the results, Tesla closed at $374.58,
        down 3.1% from $386.47 the day before. The wider market fell too: the S&P 500 lost 1.2%
        and the Nasdaq Composite 2.6% that day.
      </p>
      <p>
        It was the fourth results day in a row on which Tesla’s shares fell. After the fall,
        Tesla was:
      </p>
      <ul>
        <li>
          <strong>23.5% below its record close</strong> of $489.88 on 16 December 2025,
        </li>
        <li>
          <strong>24.9% below its highest price of the past year</strong>, $498.83 on 22
          December 2025,
        </li>
        <li>
          <strong>16.7% lower than at the start of 2026.</strong>
        </li>
      </ul>
      <p>
        The current dip has already been deeper. From that December record, Tesla fell as far as
        $298.32 on 29 July 2026, 39.1% below.
      </p>
      <p>
        The US market is still near its high: on 22 October the S&P 500 was 2.0% below its
        record close, set on 6 October.
      </p>

      <h2>How Tesla shares usually react to results</h2>
      <p>
        Tesla’s results days are big events. We measured all 44 regular results releases from
        February 2016 to October 2026, comparing the close on the day after with the close on
        the day Tesla reported:
      </p>
      <ul>
        <li>
          The middle move, up or down, was <strong>6.0%</strong>. Since 2022 it was{' '}
          <strong>9.5%</strong>.
        </li>
        <li>
          11 of the 44 moved by 10% or more.
        </li>
        <li>
          The largest fall was <strong>14.5%</strong> in July 2026. That quarter, free cash flow
          was negative $1.09 billion, the first negative quarter since early 2024.
        </li>
        <li>
          The largest rise was <strong>21.9%</strong> in October 2024.
        </li>
        <li>
          The shares fell after 26 of the 44. The last four: January 2026 (−3.5%), April 2026
          (−3.6%), July 2026 (−14.5%) and October 2026 (−3.1%).
        </li>
      </ul>

      <h2>How far Tesla has fallen before</h2>
      <p>
        Tesla has fallen 35% or more nine times since it listed in June 2010, counting the
        current fall. These are measured from a record close to the lowest close before the
        shares got back to it:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="How far Tesla has fallen before"
        columns={[
          { key: 'c0', label: 'Record close', width: '40%' },
          { key: 'c1', label: 'Lowest point', width: '20%' },
          { key: 'c2', label: 'Fall', numeric: true, width: '20%' },
          { key: 'c3', label: 'Back at the record', width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'November 2010', c1: 'February 2011', c2: '−38.5%', c3: 'March 2012' } },
          { cells: { c0: 'September 2013', c1: 'November 2013', c2: '−37.7%', c3: 'February 2014' } },
          { cells: { c0: 'September 2014', c1: 'February 2016', c2: '−49.8%', c3: 'April 2017' } },
          { cells: { c0: 'September 2017', c1: 'June 2019', c2: '−53.5%', c3: 'December 2019' } },
          { cells: { c0: 'February 2020', c1: 'March 2020', c2: '−60.6%', c3: 'June 2020' } },
          { cells: { c0: 'January 2021', c1: 'March 2021', c2: '−36.2%', c3: 'October 2021' } },
          { cells: { c0: 'November 2021', c1: 'January 2023', c2: '−73.6%', c3: 'December 2024' } },
          { cells: { c0: 'December 2024', c1: 'April 2025', c2: '−53.8%', c3: 'December 2025' } },
          { cells: { c0: 'December 2025', c1: 'July 2026 (deepest so far)', c2: '−39.1%', c3: 'Not yet' } },
        ]}
      />
      <p>
        The first eight all got back to their record. How long it took did not follow how far
        they fell: the 60.6% fall of 2020 was back about three months after its low, while the
        73.6% fall of 2021–23 took almost two years. At 39.1%, the current fall is, so far,
        smaller than five of the eight before it. That is a record of what happened, not a guide
        to what will.
      </p>
      <p>
        Measured on our stock page’s setting, Tesla normally falls about 27.3% below its
        one-year high before turning. On 22 October it was 24.9% below, inside its normal range.
      </p>

      <h2>What comes next</h2>
      <ul>
        <li>
          <strong>Spending.</strong> Tesla expects capital expenditure of more than $20 billion
          in 2026.
        </li>
        <li>
          <strong>SpaceX.</strong> The board committee’s work has no stated end date.
        </li>
        <li>
          <strong>Robotaxi.</strong> Tesla says it expects to reduce wait times in Austin with
          more cars in the fleet.
        </li>
        <li>
          <strong>The next results.</strong> Tesla has not set a date. Its fourth-quarter
          results came out on 29 January 2025 and 28 January 2026.
        </li>
      </ul>

      <h2>What this cannot tell you</h2>
      <p>
        These are results for one quarter. The share-price history is a record of what happened
        before, not a prediction. This article is general information and does not take into
        account your objectives, financial situation or needs.
      </p>
    </>
  ),
  'nextdc-shares-power-poles': () => (
    <>

      <h2>The short version</h2>
      <ul>
        <li>
          <strong>The fall:</strong> NEXTDC’s shares were halted on Monday 19 October. When they
          traded again on Wednesday, they closed at <strong>$5.35</strong>, down{' '}
          <strong>41.7%</strong> from <strong>$9.18</strong>. It was the company’s worst day
          since it listed in December 2010.
        </li>
        <li>
          <strong>The money:</strong> with 759.6 million shares on issue, that is about{' '}
          <strong>A$2.9 billion</strong> of market value gone in a day, from about A$7.0 billion
          to A$4.1 billion.
        </li>
        <li>
          <strong>The cause:</strong> Jemena, the electricity distributor that supplies M3 in
          West Footscray, has suspended part of the 66,000-volt line work needed to bring it
          more power. NEXTDC says Jemena blamed safety concerns and lost access to work sites
          because of community opposition, and the absence of council consent, and does not
          expect to restart before February 2027.
        </li>
        <li>
          <strong>What NEXTDC changed:</strong> it took the affected M3 contracts out of its
          forecast for the year to June 2027. Underlying EBITDA is now forecast at{' '}
          <strong>A$245–265 million</strong>, down from A$385–410 million, and it has put all
          new projects and land purchases on hold.
        </li>
      </ul>
      <p>
        All figures are in Australian dollars.
      </p>

      <h2>What happened on the street</h2>
      <p>
        The new poles are the most visible part of the work. Jemena has been replacing 7-metre
        wooden poles with 15-metre poles rated for up to 66,000 volts, about 160 times the
        voltage previously on one resident’s street, the ABC reported in September. That
        resident told the ABC he learned what the poles were for only when they went up.
      </p>
      <p>
        In Sanderson Street, Yarraville, the suburb next to West Footscray, residents had
        watched the poles go up a few blocks away. The ABC reported that on the day Jemena’s
        crews arrived in August, residents left their cars and bins in the street so the
        equipment could not be put in position, and some taped notes to their car windows
        explaining why. The crews filled in the holes they had dug and left. They had not been
        back by late October.
      </p>
      <p>
        “Everyone decided this is not happening on our watch,” resident Milco Bogoevski told the
        ABC.
      </p>
      <p>
        Maribyrnong City Council says the poles did not need a planning permit, but Jemena
        needed its consent to work in the road reserve (the footpaths and nature strips), and
        that the permits it was contacted about earlier this year were not approved. The council
        has said it wants the lines put underground. Jemena told the ABC that underground cables
        cost more and are more complex, and that its communication “could have been better”.
      </p>
      <p>
        One caution on the story as it is often told. The council describes two sets of works in
        the area: lines for the data centre in West Footscray, and upgrades to ageing power
        infrastructure in Yarraville. The ABC’s reporting links the Sanderson Street blockade to
        the power for NEXTDC’s next stage. NEXTDC’s own release does not mention any street; it
        says Jemena suspended parts of its works in September, citing safety concerns and lack
        of access to work sites arising from “community and stakeholder opposition”, and the
        lack of council consent.
      </p>

      <h2>Why the power matters so much</h2>
      <p>
        A data centre is a building full of computers that companies rent. Its product is, in
        effect, electricity delivered safely to those computers, so a data centre can only
        charge for the space its power supply can run.
      </p>
      <p>
        That is why NEXTDC’s results in August mattered. At 30 June 2026 it had signed customers
        for <strong>740.1 megawatts</strong> of capacity but was billing for <strong>175.0
        megawatts</strong>. The difference, <strong>565.1 megawatts</strong>, more than three
        times what it bills today, is contracted revenue that only starts once the capacity is
        built and powered. Much of the company’s value rests on that backlog turning into
        billing.
      </p>
      <p>
        M3 in West Footscray is part of that backlog. NEXTDC added 42 megawatts there in the
        year to June and had another 165 megawatts in progress. The ABC describes the site as
        about 15 metres from homes, with planned capacity of 225 megawatts. When the next
        increase in its power supply slipped, so did the date NEXTDC can bill for it.
      </p>

      <h2>What NEXTDC changed on 21 October</h2>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="What NEXTDC changed on 21 October"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Forecast in August', width: '30%' },
          { key: 'c2', label: 'Forecast now', width: '30%' },
        ]}
        rows={[
          { cells: { c0: 'Net revenue, year to June 2027', c1: 'A$615–640M', c2: 'A$475–500M' } },
          { cells: { c0: 'Underlying EBITDA', c1: 'A$385–410M', c2: 'A$245–265M' } },
          { cells: { c0: 'Capital expenditure', c1: 'A$5.25–5.75B', c2: 'A$4.5–5.0B' } },
        ]}
      />
      <ul>
        <li>
          <strong>Why:</strong> the August forecast included about <strong>A$140
          million</strong> each of net revenue and underlying EBITDA from the affected M3
          contracts. NEXTDC has taken them out until it can estimate them reliably. That is
          about a third of the earnings forecast at the midpoints.
        </li>
        <li>
          <strong>The customer:</strong> the capacity “remains under contract, subject to the
          customer’s rights”. Those contracts allow credits if capacity is late, and in some
          circumstances let the customer terminate. NEXTDC is considering whether force majeure
          relief applies. It has not named the customer.
        </li>
        <li>
          <strong>Spending:</strong> all new development projects and land acquisitions are on
          hold “for the foreseeable future”, and the board will look at selling some development
          sites it does not need soon.
        </li>
        <li>
          <strong>Debt:</strong> NEXTDC had <strong>A$8.7 billion</strong> of cash and undrawn
          facilities at 30 September and says it meets its covenants. It also warned that a
          material change to when customers start paying could limit how much of its A$6.7
          billion of undrawn senior debt it can draw.
        </li>
        <li>
          <strong>More delay:</strong> later power increases at M3 depend on new transformers at
          Brooklyn Terminal Station, now expected later than planned, and NEXTDC no longer
          expects the Victorian government’s decision on a permit for M3’s next two stages until
          2027, after the state election on 28 November.
        </li>
      </ul>

      <h2>How the shares reacted</h2>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="How the shares reacted"
        columns={[
          { key: 'c0', label: 'Date', width: '40%' },
          { key: 'c1', label: 'Close', numeric: true, width: '30%' },
          { key: 'c2', label: 'Change', width: '30%' },
        ]}
        rows={[
          { cells: { c0: 'Fri 16 Oct', c1: '$9.18', c2: 'last close before the halt' } },
          { cells: { c0: 'Wed 21 Oct', c1: '$5.35', c2: '−41.7% (low of the day $5.07, −44.8%)' } },
          { cells: { c0: 'Thu 22 Oct', c1: '$5.75', c2: '+7.5%' } },
          { cells: { c0: 'Fri 23 Oct', c1: '$5.61', c2: '−2.4%' } },
        ]}
      />
      <p>
        Two prices from this year put the fall in context. In April and May, NEXTDC sold new
        shares to its existing investors at <strong>$12.70</strong> to raise about A$1.5
        billion. In September, it raised A$1.1 billion of convertible notes against a share
        price of <strong>$12.60</strong>. On 23 October the shares were <strong>$5.61</strong>,
        more than 55% below both.
      </p>

      <h2>The worst day in its history</h2>
      <p>
        We measured every trading day since NEXTDC listed in December 2010, close to close.
        Before 21 October, it had fallen 10% or more in a day only once: <strong>13.9%</strong>{' '}
        in November 2020. The 41.7% fall is three times that.
      </p>

      <h2>How far NEXTDC has fallen before</h2>
      <p>
        Measured from a record close to the lowest close before the shares got back to it,
        NEXTDC has had seven falls of 20% or more before this one, and came back from all seven:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="How far NEXTDC has fallen before"
        columns={[
          { key: 'c0', label: 'Record close', width: '40%' },
          { key: 'c1', label: 'Lowest point', width: '20%' },
          { key: 'c2', label: 'Fall', width: '20%' },
          { key: 'c3', label: 'Back at the record', width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'Jul 2011', c1: 'Sep 2011', c2: '−30.5%', c3: 'Mar 2012' } },
          { cells: { c0: 'Mar 2012', c1: 'Jan 2013', c2: '−27.9%', c3: 'May 2013' } },
          { cells: { c0: 'Jul 2013', c1: 'Jul 2014', c2: '−48.4%', c3: 'Apr 2016' } },
          { cells: { c0: 'Sep 2016', c1: 'Dec 2016', c2: '−36.5%', c3: 'May 2017' } },
          { cells: { c0: 'Jun 2018', c1: 'Nov 2018', c2: '−29.0%', c3: 'Mar 2020' } },
          { cells: { c0: 'Mar 2020', c1: 'Mar 2020', c2: '−23.9%', c3: 'Mar 2020' } },
          { cells: { c0: 'Nov 2020', c1: 'Oct 2022', c2: '−40.8%', c3: 'Jan 2024' } },
          { cells: { c0: 'Jul 2024', c1: 'Oct 2026 (so far)', c2: '−71.0%', c3: 'Not yet' } },
        ]}
      />
      <p>
        The record close was <strong>$18.44</strong> on 9 July 2024. On 21 October the shares
        were 71.0% below it, and 69.6% below on 23 October. The deepest fall NEXTDC had come
        back from before was 48.4%, in 2013–14, and that took until April 2016. So the current
        fall has no precedent in its own history.
      </p>
      <p>
        This was already unusual before the halt. Our article of 15 October found NEXTDC 52.0%
        below its record, past the deepest fall it had recovered from. That is a record of what
        happened, not a guide to what will.
      </p>
      <p>
        Measured on our stock page’s setting, NEXTDC normally falls about <strong>19.8%</strong>{' '}
        below its one-year high before turning. On 23 October it was <strong>66.6%</strong>{' '}
        below.
      </p>

      <h2>Is this about AI?</h2>
      <p>
        That is the question many readers are asking, and the evidence points both ways.
      </p>
      <ul>
        <li>
          <strong>Against a demand problem:</strong> NEXTDC says the capacity is still under
          contract and construction of the data halls continues. Luke Laretive of Seneca
          Financial Solutions told SBS the episode probably says little about AI demand.
        </li>
        <li>
          <strong>For a wider worry:</strong> the same month, the AI data centre company Firmus
          withdrew its planned ASX listing, and on 22 October the Nasdaq fell 2.6% on what
          reports put down to worries about AI spending.
        </li>
        <li>
          <strong>What is clearly new</strong> is the risk itself: the ABC called it a dispute
          in a suburban street wiping A$3 billion off a listed company in a day, and in
          September the Victorian government announced rules to ban data centres in residential
          areas, with a 150-metre buffer from homes. NEXTDC’s chief executive, Craig Scroggie,
          also chairs the industry body, Data Centres Australia.
        </li>
      </ul>

      <h2>What comes next</h2>
      <ul>
        <li>
          <strong>3 November:</strong> Victoria’s caretaker period begins ahead of the 28
          November election.
        </li>
        <li>
          <strong>20 November:</strong> NEXTDC’s AGM, where it has promised the outcome of its
          spending review.
        </li>
        <li>
          <strong>February 2027:</strong> the earliest Jemena expects to restart the suspended
          works.
        </li>
        <li>
          <strong>The year to June 2028:</strong> when NEXTDC now expects the next increase in
          power at M3.
        </li>
      </ul>

      <h2>What this cannot tell you</h2>
      <p>
        These are NEXTDC’s own forecasts and Jemena’s estimate, as reported by NEXTDC; both can
        change. The share-price history is a record of what happened before, not a prediction.
        This article is general information and does not take into account your objectives,
        financial situation or needs.
      </p>
    </>
  ),
  'rba-rate-rises-asx-bank-shares': () => (
    <>

      <h2>The short version</h2>
      <ul>
        <li>
          <strong>Rates have gone up four times this year.</strong> The Reserve Bank of
          Australia (RBA) raised its cash rate in February, March, May and September 2026, from{' '}
          <strong>3.60%</strong> to <strong>4.60%</strong>. Counting the 13 rises of 2022–23,
          that is <strong>17 rises</strong> since May 2022.
        </li>
        <li>
          <strong>On the day of a rise, the banks barely moved.</strong> We took the average of
          the four big banks’ share prices on each decision day. They closed higher on{' '}
          <strong>6</strong> of the 17 days and lower on <strong>11</strong>, and the average
          move was <strong>+0.04%</strong>, close to nothing.
        </li>
        <li>
          <strong>The reason: by 2:30pm the news was usually old.</strong> The RBA announces at
          2:30pm on decision day. When nearly everyone expects a rise, share prices have already
          adjusted in the days or weeks before, so the announcement itself changes little.
        </li>
        <li>
          <strong>The big days were the surprises.</strong> The banks’ worst decision day
          (<strong>−2.37%</strong>) was in June 2022, when the RBA raised rates by more than
          expected. Their best (<strong>+4.39%</strong>) was in October 2022, when it raised by
          less than expected.
        </li>
        <li>
          <strong>This year, each bank’s own results mattered more than the RBA.</strong>{' '}
          Westpac fell <strong>5.88%</strong> on the day of its August update and ANZ{' '}
          <strong>2.84%</strong> on its results day. No 2026 rate decision moved any of the four
          by as much.
        </li>
        <li>
          <strong>Rate rises cut both ways for a bank.</strong> All four say higher rates help
          them earn more on some of their customers’ savings. All four also say competition for
          loans takes much of that back, and they have set more money aside in case borrowers
          struggle.
        </li>
      </ul>

      <h2>Five terms used in this article</h2>
      <ul>
        <li>
          <strong>Cash rate:</strong> the interest rate the RBA sets. Banks’ own rates, on home
          loans and savings accounts, tend to follow it. It is now 4.60%.
        </li>
        <li>
          <strong>Percentage point:</strong> a rise from 4.35% to 4.60% is a rise of 0.25
          percentage points. You will also see this called “25 basis points”; 100 basis points
          make one percentage point.
        </li>
        <li>
          <strong>The big four:</strong> Commonwealth Bank (CBA), Westpac, National Australia
          Bank (NAB) and ANZ, Australia’s four largest banks.
        </li>
        <li>
          <strong>ASX 200:</strong> an index of about 200 of the largest companies on the
          Australian share market. When people say “the market rose 1%”, they usually mean this
          index. The big four are part of it.
        </li>
        <li>
          <strong>“Priced in”:</strong> when investors already expect something, they trade on
          that expectation before it happens, so the share price already reflects it. When it
          then happens, the price has little left to adjust.
        </li>
      </ul>

      <h2>Why would interest rates matter to a bank?</h2>
      <p>
        A bank makes most of its money from the gap between the interest it earns and the
        interest it pays. It pays interest to savers and to the investors it borrows from, and
        it earns interest on the home loans and business loans it makes. That gap is called the{' '}
        <strong>net interest margin</strong>.
      </p>
      <p>
        CBA’s net interest margin in the year to June 2026 was <strong>2.05%</strong>. Put
        simply, for every $100 it has lent out or invested, it kept about $2.05 over the year
        after paying interest on the money it used. The other three banks’ latest figures:
        Westpac <strong>1.89%</strong> (three months to June 2026), NAB <strong>1.81%</strong>{' '}
        and ANZ <strong>1.53%</strong> (both the six months to March 2026).
      </p>
      <p>
        When the RBA raises rates, three things happen to that margin, and they pull in
        different directions:
      </p>
      <p>
        1. <strong>Some savings earn the bank more.</strong> Part of the money customers keep in
        everyday accounts earns them little or no interest. The bank invests that money, and
        when rates go up it earns more on it. All four banks named this as a benefit in their
        latest results. 2. <strong>Competition takes some of it back.</strong> Banks compete
        hard for loans by offering lower rates, and savers move money into accounts that pay
        bonus interest. All four named competition as a pressure on their margin. 3.{' '}
        <strong>More borrowers may struggle.</strong> Higher repayments make it harder for some
        customers to keep up, so banks set money aside for loans that may not be repaid. These
        are called <strong>provisions</strong>, and they reduce profit.
      </p>
      <p>
        Here is what each bank said about those three things in its latest results:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="Why would interest rates matter to a bank?"
        columns={[
          { key: 'c0', label: 'Bank', width: '40%' },
          { key: 'c1', label: 'Benefit from higher rates', width: '20%' },
          { key: 'c2', label: 'Pressure', width: '20%' },
          { key: 'c3', label: 'Money set aside', width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'CBA (year to June 2026)', c1: '“higher earnings on replicating portfolio and capital hedges”', c2: '“largely offset by lower lending margins”', c3: 'Loan impairment expense up 9% to $788 million; “arrears rose in some consumer portfolios”' } },
          { cells: { c0: 'Westpac (quarter to June 2026)', c1: '“benefits from the higher interest rate environment”', c2: '“competitive pressures in lending, deposit mix and a higher proportion of customers qualifying for saving bonus rates”', c3: 'Provisions above its central forecast rose to $2.0 billion' } },
          { cells: { c0: 'NAB (half to March 2026)', c1: '“higher earnings from the deposit replicating portfolio”', c2: '“offset by lending competition”', c3: 'An extra $300 million of forward-looking provisions, for “potential stress related to the Middle East conflict”' } },
          { cells: { c0: 'ANZ (half to March 2026)', c1: 'Replicating portfolios added 0.02 percentage points to the margin, “benefiting from higher rates”', c2: '“continued Australia home loan pricing competition”', c3: 'A $175 million charge for “the potential impacts of the Middle East conflict”' } },
        ]}
      />
      <p>
        (A “replicating portfolio” is the bank’s name for the way it invests that low-interest
        savings money.)
      </p>
      <p>
        <strong>What happened last time.</strong> CBA’s results show how these forces played out
        over the 2022–23 rises:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="Why would interest rates matter to a bank?"
        columns={[
          { key: 'c0', label: 'CBA’s results for', width: '40%' },
          { key: 'c1', label: 'Net interest margin', numeric: true, width: '30%' },
          { key: 'c2', label: 'Cash rate at the end of the period', numeric: true, width: '30%' },
        ]}
        rows={[
          { cells: { c0: 'Year to June 2022', c1: '1.90%', c2: '0.85%' } },
          { cells: { c0: 'Six months to December 2022', c1: '2.10%', c2: '3.10%' } },
          { cells: { c0: 'Year to June 2023', c1: '2.07%', c2: '4.10%' } },
          { cells: { c0: 'Year to June 2024', c1: '1.99%', c2: '4.35%' } },
          { cells: { c0: 'Year to June 2025', c1: '2.08%', c2: '3.85%' } },
          { cells: { c0: 'Year to June 2026', c1: '2.05%', c2: '4.35%' } },
        ]}
      />
      <p>
        The first rises lifted CBA’s margin by about 0.2 percentage points within six months.
        After that, rates kept rising but the margin did not: CBA said its monthly margins
        peaked in late 2022 and blamed competition for home loans and customers switching their
        savings. So higher rates helped, but only for a while, and not by much.
      </p>

      <h2>What we measured, and how to read the table</h2>
      <p>
        For each of the 17 rises, we compared each bank’s closing share price on decision day
        with its closing price the trading day before. The RBA announces at 2:30pm Sydney time
        and the ASX’s trading day ends just after 4pm, so the decision-day close includes the
        market’s reaction.
      </p>
      <p>
        The table’s columns:
      </p>
      <ul>
        <li>
          <strong>Decision:</strong> the day the RBA announced the rise.
        </li>
        <li>
          <strong>Rise:</strong> how much the cash rate went up, in percentage points.
        </li>
        <li>
          <strong>New cash rate:</strong> the cash rate after the rise.
        </li>
        <li>
          <strong>Big four banks:</strong> how much the four banks’ share prices moved that day,
          on average. A minus sign means they fell.
        </li>
        <li>
          <strong>ASX 200:</strong> how much the whole market moved that day, for comparison.
        </li>
      </ul>
      <p>
        <strong>Reading one row:</strong> on 7 June 2022, the RBA raised the cash rate by 0.50
        percentage points, to 0.85%. That day, the big four’s shares fell 2.37% on average,
        while the market as a whole fell 1.53%. So the banks fell, and by more than the market.
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="What we measured, and how to read the table"
        columns={[
          { key: 'c0', label: 'Decision', width: '28%' },
          { key: 'c1', label: 'Rise', numeric: true, width: '18%' },
          { key: 'c2', label: 'New cash rate', numeric: true, width: '18%' },
          { key: 'c3', label: 'Big four banks', numeric: true, width: '18%' },
          { key: 'c4', label: 'ASX 200', numeric: true, width: '18%' },
        ]}
        rows={[
          { cells: { c0: '3 May 2022', c1: '+0.25', c2: '0.35%', c3: '−0.35%', c4: '−0.42%' } },
          { cells: { c0: '7 Jun 2022', c1: '+0.50', c2: '0.85%', c3: '−2.37%', c4: '−1.53%' } },
          { cells: { c0: '5 Jul 2022', c1: '+0.50', c2: '1.35%', c3: '−0.23%', c4: '+0.25%' } },
          { cells: { c0: '2 Aug 2022', c1: '+0.50', c2: '1.85%', c3: '+1.00%', c4: '+0.07%' } },
          { cells: { c0: '6 Sep 2022', c1: '+0.50', c2: '2.35%', c3: '−0.32%', c4: '−0.38%' } },
          { cells: { c0: '4 Oct 2022', c1: '+0.25', c2: '2.60%', c3: '+4.39%', c4: '+3.75%' } },
          { cells: { c0: '1 Nov 2022', c1: '+0.25', c2: '2.85%', c3: '+1.15%', c4: '+1.65%' } },
          { cells: { c0: '6 Dec 2022', c1: '+0.25', c2: '3.10%', c3: '−0.46%', c4: '−0.47%' } },
          { cells: { c0: '7 Feb 2023', c1: '+0.25', c2: '3.35%', c3: '−0.27%', c4: '−0.46%' } },
          { cells: { c0: '7 Mar 2023', c1: '+0.25', c2: '3.60%', c3: '+0.90%', c4: '+0.49%' } },
          { cells: { c0: '2 May 2023', c1: '+0.25', c2: '3.85%', c3: '−0.28%', c4: '−0.92%' } },
          { cells: { c0: '6 Jun 2023', c1: '+0.25', c2: '4.10%', c3: '−1.45%', c4: '−1.20%' } },
          { cells: { c0: '7 Nov 2023', c1: '+0.25', c2: '4.35%', c3: '−1.29%', c4: '−0.29%' } },
          { cells: { c0: '3 Feb 2026', c1: '+0.25', c2: '3.85%', c3: '+0.59%', c4: '+0.89%' } },
          { cells: { c0: '17 Mar 2026', c1: '+0.25', c2: '4.10%', c3: '+0.70%', c4: '+0.36%' } },
          { cells: { c0: '5 May 2026', c1: '+0.25', c2: '4.35%', c3: '−0.86%', c4: '−0.19%' } },
          { cells: { c0: '29 Sep 2026', c1: '+0.25', c2: '4.60%', c3: '−0.21%', c4: '+0.34%' } },
        ]}
      />
      <p>
        <strong>What the table shows:</strong>
      </p>
      <ul>
        <li>
          The banks fell on 11 of the 17 days and rose on 6. A rate rise was not reliably good
          or bad news for their shares on the day.
        </li>
        <li>
          On 11 of the 17 days the banks moved by less than 1% either way, and on 15 of the 17
          they moved in the same direction as the market.
        </li>
        <li>
          The banks did better than the market on 9 days and worse on 8, so a rise did not
          reliably favour them over other companies either.
        </li>
        <li>
          The reactions look much the same whether rates were rising from near zero, as in 2022,
          or from 3.60%, as in 2026.
        </li>
      </ul>

      <h2>Why the day itself is usually quiet</h2>
      <p>
        By 2:30pm on decision day, the news was usually out. September 2026 shows how.
      </p>
      <ul>
        <li>
          <strong>On Tuesday 8 September,</strong> Westpac’s economists said they now expected
          the RBA to raise rates again this year, which meant all four big banks’ economists
          did, the Motley Fool reported. That day the four banks’ shares fell{' '}
          <strong>1.77%</strong> on average and the ASX 200 fell <strong>1.00%</strong>.
        </li>
        <li>
          <strong>The day before the decision,</strong> the ABC reported that markets put the
          chance of a rise at about 90%, and that all 29 economists surveyed by Bloomberg
          expected one.
        </li>
        <li>
          <strong>On Tuesday 29 September,</strong> the RBA raised the cash rate to 4.60%. The
          four banks’ shares moved <strong>−0.21%</strong> on average that day, while the ASX
          200 rose 0.34%.
        </li>
      </ul>
      <p>
        So the banks’ bigger move came three weeks before the rise, on the day the expectation
        formed, not on the day the rise was announced.
      </p>

      <h2>The two days that were different</h2>
      <p>
        <strong>7 June 2022: a bigger rise than expected.</strong> Reuters reported that markets
        had been split between a rise of 0.25 and 0.40 percentage points. The RBA raised by
        0.50. The ASX 200 fell 1.53% and the four banks fell 2.37% on average, their worst
        decision day in the run.
      </p>
      <p>
        <strong>4 October 2022: a smaller rise than expected.</strong> After four rises of 0.50
        points in a row, Market Index reported that the market widely expected a fifth. The RBA
        raised by 0.25. The ASX 200 rose 3.75% and the four banks rose 4.39% on average, their
        best decision day in the run. Asia Financial (Reuters) reported it was the market’s best
        session since June 2020.
      </p>
      <p>
        Both days had a rate rise. What made them different was how the rise compared with what
        investors had expected.
      </p>

      <h2>This year, bank by bank</h2>
      <p>
        Each bank’s share price on the four decision days of 2026:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="This year, bank by bank"
        columns={[
          { key: 'c0', label: 'Decision', width: '28%' },
          { key: 'c1', label: 'CBA', numeric: true, width: '18%' },
          { key: 'c2', label: 'Westpac', numeric: true, width: '18%' },
          { key: 'c3', label: 'NAB', numeric: true, width: '18%' },
          { key: 'c4', label: 'ANZ', numeric: true, width: '18%' },
        ]}
        rows={[
          { cells: { c0: '3 Feb 2026', c1: '+1.06%', c2: '+1.03%', c3: '+0.19%', c4: '+0.08%' } },
          { cells: { c0: '17 Mar 2026', c1: '+0.34%', c2: '+1.39%', c3: '+0.85%', c4: '+0.21%' } },
          { cells: { c0: '5 May 2026', c1: '+0.38%', c2: '−2.26%', c3: '−0.64%', c4: '−0.94%' } },
          { cells: { c0: '29 Sep 2026', c1: '−0.82%', c2: '−0.06%', c3: '−0.03%', c4: '+0.05%' } },
        ]}
      />
      <p>
        Westpac’s fall on 5 May came on the same day it released its half-year results, so that
        day’s move reflects more than the RBA.
      </p>
      <p>
        Now compare the days each bank reported its own results:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="This year, bank by bank"
        columns={[
          { key: 'c0', label: 'Bank', width: '40%' },
          { key: 'c1', label: 'Results day', width: '20%' },
          { key: 'c2', label: 'Share price that day', numeric: true, width: '20%' },
          { key: 'c3', label: 'ASX 200 that day', numeric: true, width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'ANZ', c1: 'Fri 1 May 2026 (half-year results)', c2: '−2.84%', c3: '+0.74%' } },
          { cells: { c0: 'NAB', c1: 'Mon 4 May 2026 (half-year results)', c2: '−1.58%', c3: '−0.37%' } },
          { cells: { c0: 'Westpac', c1: 'Tue 5 May 2026 (half-year results)', c2: '−2.26%', c3: '−0.19%' } },
          { cells: { c0: 'Westpac', c1: 'Mon 10 Aug 2026 (quarterly update)', c2: '−5.88%', c3: '−0.33%' } },
          { cells: { c0: 'CBA', c1: 'Wed 12 Aug 2026 (full-year results)', c2: '−0.69%', c3: '−0.45%' } },
        ]}
      />
      <p>
        Westpac’s 5.88% fall on 10 August is bigger than any move by any of the four on a 2026
        decision day. In the update released that day, Westpac said its provisions above its
        central forecast had risen to $2.0 billion. A share price on one day reflects many
        things, and we cannot say for certain what any one move was about, but the pattern is
        clear: in 2026, news about each bank moved its shares more than news about rates.
      </p>

      <h2>How the big four have done this year</h2>
      <p>
        From the last close of 2025 to 27 October 2026:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="How the big four have done this year"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Share price', numeric: true, width: '30%' },
          { key: 'c2', label: 'Including dividends', numeric: true, width: '30%' },
        ]}
        rows={[
          { cells: { c0: 'ANZ', c1: '+9.7%', c2: '+12.2%' } },
          { cells: { c0: 'CBA', c1: '+0.9%', c2: '+4.0%' } },
          { cells: { c0: 'NAB', c1: '−4.8%', c2: '−2.7%' } },
          { cells: { c0: 'Westpac', c1: '−6.3%', c2: '−4.4%' } },
          { cells: { c0: 'S&P/ASX 200', c1: '+1.6%', c2: '' } },
        ]}
      />
      <p>
        “Including dividends” adds back the dividends each bank paid this year, for someone who
        held the shares all year. The ASX 200 figure is the index itself, which does not include
        dividends.
      </p>
      <p>
        Four rate rises, and four different results. Each bank had the same rate rises; what
        differed was what each told investors about its own business this year:
      </p>
      <ul>
        <li>
          <strong>ANZ</strong> said it had cut costs sharply: operating expenses fell 9% in the
          half to March, as part of a plan that removes 3,500 roles. Its cash profit rose 14% on
          the previous half, excluding one-off items.
        </li>
        <li>
          <strong>CBA</strong> said its cash profit rose 7% to $11.0 billion in the year to
          June, and that it grew at or above the market in all five of its main lending and
          deposit businesses for the first time.
        </li>
        <li>
          <strong>NAB</strong> said its cash profit, excluding a one-off accounting charge for
          software, rose 2.3% in the half to March, and it set aside an extra $300 million for
          the Middle East conflict.
        </li>
        <li>
          <strong>Westpac</strong> said its margin fell 0.06 percentage points to 1.89% in the
          half to March, naming competition as a cause, and its provisions above its central
          forecast reached $2.0 billion by June.
        </li>
      </ul>
      <p>
        These are the banks’ own statements. We report them beside the share prices; we do not
        claim any one of them caused a particular move.
      </p>

      <h2>What comes next</h2>
      <p>
        <strong>Inflation, Wednesday 28 October, 11:30am.</strong> Inflation is how fast prices
        are rising. The RBA raises interest rates to slow it down, and it aims to keep inflation
        within its target range of 2–3% a year. On 28 October the ABS (the Australian Bureau of
        Statistics) reported that inflation is now <strong>4.3%</strong>, meaning prices in
        September were 4.3% higher than a year earlier. A month ago, inflation was{' '}
        <strong>4.0%</strong>. So inflation is above the RBA’s target, and it went up rather
        than down.
      </p>
      <p>
        <strong>The RBA, Tuesday 3 November, 2:30pm.</strong> Melbourne Cup day. On the evidence
        above, what matters for bank shares on the day is less whether rates rise than whether
        the decision matches what investors expect by then.
      </p>
      <p>
        <strong>The banks’ own results, the same fortnight.</strong> Westpac reports its
        full-year results on Monday 2 November, NAB on Thursday 5 November and ANZ on Monday 9
        November, according to their financial calendars. This year, results days moved the
        banks more than decision days did.
      </p>

      <h2>What this does not tell you</h2>
      <ul>
        <li>
          <strong>Seventeen days is a small sample</strong>, and 13 of them came in one run of
          rises in 2022–23, which started from a cash rate of 0.10%.
        </li>
        <li>
          <strong>A share price moves for many reasons at once.</strong> A decision day can also
          carry company news or news from overseas, as 5 May 2026 did.
        </li>
        <li>
          <strong>The past is a record, not a forecast.</strong> None of this tells you what
          bank shares will do on 3 November.
        </li>
      </ul>
      <p>
        This article is general information only, not financial advice. It does not take into
        account your objectives, financial situation or needs.
      </p>
    </>
  ),
  'microsoft-q1-fy27-results': () => (
    <>

      <h2>The short version</h2>
      <p>
        Microsoft reported its results for the three months to 30 September 2026, the first
        quarter of its 2027 financial year, after the US market closed on 28 October 2026. In
        short:
      </p>
      <ul>
        <li>
          <strong>Revenue:</strong> $92.3 billion, up 19% from $77.7 billion a year earlier.
        </li>
        <li>
          <strong>Profit:</strong> operating income of $45.9 billion, up 21%. Net income was
          $36.6 billion, up 32%, or $36.4 billion and up 18% on Microsoft’s adjusted measure,
          which leaves out its investment in OpenAI.
        </li>
        <li>
          <strong>Earnings per share:</strong> $4.92, or $4.89 adjusted.
        </li>
        <li>
          <strong>Azure:</strong> revenue of $33.2 billion, up 48%.
        </li>
        <li>
          <strong>Spending:</strong> $39.4 billion on property and equipment, against $19.4
          billion a year earlier.
        </li>
        <li>
          <strong>Orders already signed:</strong> commercial remaining performance obligation of
          $677 billion, up 73%.
        </li>
      </ul>
      <p>
        All figures are in US dollars.
      </p>

      <h2>The quarter against a year earlier</h2>
      <p>
        Microsoft now reports two segments, Agents and Infra and Devices and Consumer, and has
        recast the year-earlier figures to match.
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="The quarter against a year earlier"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Sep quarter 2026', numeric: true, width: '20%' },
          { key: 'c2', label: 'A year earlier', numeric: true, width: '20%' },
          { key: 'c3', label: 'Change', numeric: true, width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'Revenue', c1: '$92.3B', c2: '$77.7B', c3: '+18.8%' } },
          { cells: { c0: 'Agents and Infra', c1: '$76.8B', c2: '$61.7B', c3: '+24.5%' } },
          { cells: { c0: 'Devices and Consumer', c1: '$15.5B', c2: '$16.0B', c3: '−3.2%' } },
          { cells: { c0: 'Operating income', c1: '$45.9B', c2: '$38.0B', c3: '+21.0%' } },
          { cells: { c0: 'Operating margin', c1: '49.8%', c2: '48.9%', c3: '' } },
          { cells: { c0: 'Net income', c1: '$36.6B', c2: '$27.7B', c3: '+32.0%' } },
          { cells: { c0: 'Net income, excluding OpenAI', c1: '$36.4B', c2: '$30.8B', c3: '+18.1%' } },
          { cells: { c0: 'Diluted earnings per share', c1: '$4.92', c2: '$3.72', c3: '' } },
        ]}
      />
      <p>
        Agents and Infra holds Azure and Microsoft 365. Inside it, Azure brought in $33.2
        billion, up from $22.4 billion, and Microsoft Cloud revenue as a whole was $63.9
        billion, up 30%. Microsoft’s chief financial officer, Amy Hood, said growth was
        “accelerating”. Devices and Consumer holds Windows, Xbox and search: Windows OEM and
        devices revenue fell 22%, to $3.6 billion, and Xbox content and services fell 2%.
      </p>

      <h2>The OpenAI effect</h2>
      <p>
        Microsoft’s reported profit swings with the value of its investment in OpenAI. A year
        ago that investment cut net income by $3.1 billion. This quarter it added $207 million.
        Leave it out, as Microsoft’s own adjusted figures do, and net income grew 18% rather
        than 32%.
      </p>

      <h2>Where the money is going</h2>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="Where the money is going"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Sep quarter 2026', numeric: true, width: '30%' },
          { key: 'c2', label: 'A year earlier', numeric: true, width: '30%' },
        ]}
        rows={[
          { cells: { c0: 'Cash from operations', c1: '$58.0B', c2: '$45.1B' } },
          { cells: { c0: 'Spent on property and equipment', c1: '$39.4B', c2: '$19.4B' } },
          { cells: { c0: 'Free cash flow', c1: '$18.6B', c2: '$25.7B' } },
          { cells: { c0: 'Depreciation, amortisation and other', c1: '$11.7B', c2: '$8.1B' } },
        ]}
      />
      <p>
        Free cash flow here is cash from operations less spending on property and equipment,
        both from Microsoft’s cash flow statement. Cash from operations rose 29%, but spending
        rose 103%, so free cash flow fell 27%. The depreciation charge, which spreads the cost
        of that equipment over the years it is used, rose 44%.
      </p>
      <p>
        Microsoft returned $10.2 billion to shareholders in dividends and share buybacks.
      </p>

      <h2>What management said</h2>
      <p>
        Hood said: “Results exceeded expectations across revenue, operating income, and earnings
        per share.” Microsoft gives its forecast for the next quarter on its results call, not
        in its release.
      </p>

      <h2>How the shares reacted</h2>
      <p>
        Microsoft closed at $531.01 on 28 October, before the results came out. In after-hours
        trading, at 6:47pm New York time, it was at $546.35, up 2.9%. After-hours trading is
        thin, and the price can move a long way before the next day’s close, so this is the
        reaction at that moment, not a final one.
      </p>
      <p>
        On 27 October, the day before the results, Microsoft closed at $531.33. That was:
      </p>
      <ul>
        <li>
          <strong>2.2% below its record close</strong> of $543.45 on 13 October 2026,
        </li>
        <li>
          <strong>9.9% higher than at the start of 2026</strong>, when it stood at $483.62.
        </li>
      </ul>

      <h2>How Microsoft shares usually react to results</h2>
      <p>
        We measured all 43 regular results releases from January 2016 to July 2026, comparing
        the close on the day after with the close on the day Microsoft reported:
      </p>
      <ul>
        <li>
          The middle move, up or down, was <strong>3.3%</strong>.
        </li>
        <li>
          13 of the 43 moved by 5% or more, and one by 10% or more.
        </li>
        <li>
          The largest fall was <strong>10.0%</strong> in January 2026.
        </li>
        <li>
          The largest rise was <strong>15.5%</strong> in July 2026.
        </li>
        <li>
          The shares rose after 25 of the 43 and fell after 18.
        </li>
      </ul>

      <h2>How far Microsoft has fallen before</h2>
      <p>
        Counting dividends, Microsoft has fallen 30% or more five times since it listed in March
        1986. These are measured from a record close to the lowest close before the shares got
        back to it:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="How far Microsoft has fallen before"
        columns={[
          { key: 'c0', label: 'Record close', width: '40%' },
          { key: 'c1', label: 'Lowest point', width: '20%' },
          { key: 'c2', label: 'Fall', numeric: true, width: '20%' },
          { key: 'c3', label: 'Back at the record', width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'October 1987', c1: 'October 1987', c2: '−50.3%', c3: 'October 1989' } },
          { cells: { c0: 'July 1990', c1: 'August 1990', c2: '−34.7%', c3: 'January 1991' } },
          { cells: { c0: 'December 1999', c1: 'March 2009', c2: '−69.4%', c3: 'July 2014' } },
          { cells: { c0: 'November 2021', c1: 'November 2022', c2: '−37.1%', c3: 'June 2023' } },
          { cells: { c0: 'October 2025', c1: 'June 2026', c2: '−34.5%', c3: 'October 2026' } },
        ]}
      />
      <p>
        All five got back to their record. The quickest was back about four months after its
        low, in October 2026; the slowest, after the dot-com fall, took about five years from
        its 2009 low. That is a record of what happened, not a guide to what will.
      </p>
      <p>
        Measured on our stock page’s setting, Microsoft normally falls about 17.2% below its
        one-year high before turning. On 27 October it was 3.6% below.
      </p>

      <h2>What comes next</h2>
      <ul>
        <li>
          <strong>Spending.</strong> Whether property and equipment spending keeps rising, and
          what that does to free cash flow.
        </li>
        <li>
          <strong>Azure.</strong> Whether its growth holds near 48%.
        </li>
        <li>
          <strong>OpenAI.</strong> The investment can move reported profit in either direction
          from quarter to quarter.
        </li>
      </ul>

      <h2>What this cannot tell you</h2>
      <p>
        These are results for one quarter. The share-price history is a record of what happened
        before, not a prediction. This article is general information and does not take into
        account your objectives, financial situation or needs.
      </p>
    </>
  ),
  'alphabet-q3-2026-results': () => (
    <>

      <h2>The short version</h2>
      <p>
        Alphabet reported its results for the three months to 30 September after the US market
        closed on 28 October 2026. In short:
      </p>
      <ul>
        <li>
          <strong>Revenue:</strong> $127.6 billion, up 25% from $102.3 billion a year earlier.
        </li>
        <li>
          <strong>Google Cloud:</strong> revenue of $30.7 billion, up 103%, and operating income
          of $11.1 billion, up from $3.6 billion.
        </li>
        <li>
          <strong>Profit:</strong> operating income of $40.6 billion, up 30%. Net income was
          $26.5 billion, down 24%, because of an $8.7 billion loss on shares Alphabet holds.
        </li>
        <li>
          <strong>Earnings per share:</strong> $2.12, down from $2.87.
        </li>
        <li>
          <strong>Spending:</strong> $51.4 billion on property and equipment, against $24.0
          billion a year earlier.
        </li>
        <li>
          <strong>Free cash flow:</strong> negative $9.1 billion, after negative $5.9 billion
          the quarter before.
        </li>
      </ul>
      <p>
        All figures are in US dollars.
      </p>

      <h2>The quarter against a year earlier</h2>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="The quarter against a year earlier"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Third quarter 2026', numeric: true, width: '20%' },
          { key: 'c2', label: 'A year earlier', numeric: true, width: '20%' },
          { key: 'c3', label: 'Change', numeric: true, width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'Revenue', c1: '$127.6B', c2: '$102.3B', c3: '+24.7%' } },
          { cells: { c0: 'Google Search & other', c1: '$63.4B', c2: '$56.6B', c3: '+12.0%' } },
          { cells: { c0: 'YouTube ads', c1: '$11.2B', c2: '$10.3B', c3: '+9.2%' } },
          { cells: { c0: 'Google subscriptions, platforms and devices', c1: '$14.3B', c2: '$12.9B', c3: '+11.0%' } },
          { cells: { c0: 'Google Cloud', c1: '$30.7B', c2: '$15.2B', c3: '+102.6%' } },
          { cells: { c0: 'Operating income', c1: '$40.6B', c2: '$31.2B', c3: '+29.9%' } },
          { cells: { c0: 'Net income', c1: '$26.5B', c2: '$35.0B', c3: '−24.3%' } },
          { cells: { c0: 'Diluted earnings per share', c1: '$2.12', c2: '$2.87', c3: '' } },
        ]}
      />
      <p>
        Google Cloud was the engine. Alphabet says sales of its TPU systems “were also a
        meaningful contributor to revenue growth”, and Cloud’s operating income more than
        tripled. Chief executive Sundar Pichai said Alphabet is “now on a half-trillion dollar
        revenue run rate”, and that the Gemini app “has reached one billion users”.
      </p>

      <h2>Why profit fell</h2>
      <p>
        The fall in net income came from below the operating line. A year earlier, gains on the
        shares Alphabet holds in other companies added $10.7 billion. This quarter they lost
        $8.7 billion, and Alphabet says that loss cut its net income by $6.7 billion after tax.
        Operating income, which leaves those investments out, rose 30%.
      </p>

      <h2>Where the money is going</h2>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="Where the money is going"
        columns={[
          { key: 'c0', label: 'Measure', width: '40%' },
          { key: 'c1', label: 'Third quarter 2026', numeric: true, width: '30%' },
          { key: 'c2', label: 'A year earlier', numeric: true, width: '30%' },
        ]}
        rows={[
          { cells: { c0: 'Cash from operations', c1: '$42.3B', c2: '$48.4B' } },
          { cells: { c0: 'Spent on property and equipment', c1: '$51.4B', c2: '$24.0B' } },
          { cells: { c0: 'Free cash flow', c1: '−$9.1B', c2: '$24.5B' } },
        ]}
      />
      <p>
        Alphabet defines free cash flow as cash from operations less capital spending. Spending
        rose 114% and for the second quarter in a row it was more than the business brought in.
      </p>
      <p>
        To pay for it, Alphabet raised $28.7 billion from new bonds and sold $12.4 billion of
        new shares through its at-the-market program. It bought back no shares this quarter,
        against $11.5 billion a year earlier.
      </p>

      <h2>How the shares reacted</h2>
      <p>
        Alphabet’s Class A shares closed at $324.89 on 28 October, before the results came out.
        In after-hours trading, at 6:47pm New York time, they were at $292.90, down 9.8%. That
        is 27.3% below their record close. After-hours trading is thin, and the price can move a
        long way before the next day’s close, so this is the reaction at that moment, not a
        final one.
      </p>
      <p>
        On 27 October, the day before the results, Alphabet’s Class A shares closed at $320.58.
        That was:
      </p>
      <ul>
        <li>
          <strong>20.4% below their record close</strong> of $402.62 on 13 May 2026,
        </li>
        <li>
          <strong>2.4% higher than at the start of 2026</strong>, when they stood at $313.00.
        </li>
      </ul>

      <h2>How Alphabet shares usually react to results</h2>
      <p>
        We measured all 43 regular results releases from February 2016 to July 2026, comparing
        the close on the day after with the close on the day Alphabet reported:
      </p>
      <ul>
        <li>
          The middle move, up or down, was <strong>3.8%</strong>.
        </li>
        <li>
          17 of the 43 moved by 5% or more, and one by 10% or more.
        </li>
        <li>
          The largest fall was <strong>9.5%</strong> in October 2023.
        </li>
        <li>
          The largest rise was <strong>10.2%</strong> in April 2024.
        </li>
        <li>
          The shares rose after 23 of the 43 and fell after 20.
        </li>
      </ul>

      <h2>How far Alphabet has fallen before</h2>
      <p>
        Counting dividends, Alphabet has fallen 20% or more nine times since it listed in August
        2004, counting the current fall. These are measured from a record close to the lowest
        close before the shares got back to it:
      </p>
      <DataTable
        wrapHeaders
        minWidth="520px"
        caption="How far Alphabet has fallen before"
        columns={[
          { key: 'c0', label: 'Record close', width: '40%' },
          { key: 'c1', label: 'Lowest point', width: '20%' },
          { key: 'c2', label: 'Fall', numeric: true, width: '20%' },
          { key: 'c3', label: 'Back at the record', width: '20%' },
        ]}
        rows={[
          { cells: { c0: 'January 2006', c1: 'March 2006', c2: '−28.5%', c3: 'October 2006' } },
          { cells: { c0: 'November 2007', c1: 'November 2008', c2: '−65.3%', c3: 'September 2012' } },
          { cells: { c0: 'July 2018', c1: 'December 2018', c2: '−23.4%', c3: 'April 2019' } },
          { cells: { c0: 'February 2020', c1: 'March 2020', c2: '−30.9%', c3: 'July 2020' } },
          { cells: { c0: 'November 2021', c1: 'November 2022', c2: '−44.3%', c3: 'January 2024' } },
          { cells: { c0: 'July 2024', c1: 'September 2024', c2: '−22.1%', c3: 'December 2024' } },
          { cells: { c0: 'February 2025', c1: 'April 2025', c2: '−29.8%', c3: 'August 2025' } },
          { cells: { c0: 'February 2026', c1: 'March 2026', c2: '−20.4%', c3: 'April 2026' } },
          { cells: { c0: 'May 2026', c1: 'October 2026 (deepest so far, before these results)', c2: '−21.2%', c3: 'Not yet' } },
        ]}
      />
      <p>
        The first eight all got back to their record. The quickest was back about a month after
        its low, in April 2026; the slowest, after the 2008 fall, took almost four years. That
        is a record of what happened, not a guide to what will.
      </p>
      <p>
        Measured on our stock page’s setting, Alphabet normally falls about 15.8% below its
        one-year high before turning. On 27 October it was 21.4% below, past its normal fall.
      </p>

      <h2>What comes next</h2>
      <ul>
        <li>
          <strong>Google Cloud.</strong> Whether growth near 100% holds.
        </li>
        <li>
          <strong>Spending and cash.</strong> Whether spending keeps running ahead of cash from
          operations.
        </li>
        <li>
          <strong>Investments.</strong> Gains and losses on the shares Alphabet holds can move
          its net income in either direction from quarter to quarter.
        </li>
      </ul>

      <h2>What this cannot tell you</h2>
      <p>
        These are results for one quarter. The share-price history is a record of what happened
        before, not a prediction. This article is general information and does not take into
        account your objectives, financial situation or needs.
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
