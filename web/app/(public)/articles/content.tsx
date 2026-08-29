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
        caption="Australian banks, typical fall and worst fall since 2000"
        columns={[
          { key: 'name', label: 'Bank' },
          { key: 'typical', label: 'Typical fall', numeric: true },
          { key: 'worst', label: 'Worst since 2000', numeric: true },
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
        caption="Australian miners, typical fall and worst fall since 2000"
        columns={[
          { key: 'name', label: 'Miner' },
          { key: 'typical', label: 'Typical fall', numeric: true },
          { key: 'worst', label: 'Worst since 2000', numeric: true },
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
