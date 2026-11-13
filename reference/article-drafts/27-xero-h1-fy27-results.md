# DRAFT FOR REVIEW — Article 27: Xero's half-year results (H1 FY27)

> Nothing here is published. This file holds the draft, the SEO plan and the fact-check sheet.
>
> Every figure from Xero comes from its own documents, downloaded from the ASX and saved in
> `reference/xro-2026-h1/sources/`: the results announcement, the Appendix 4D and Interim Report, the investor
> presentation, the CFO announcement and the buy-back disclosure document (all 12 November 2026). Xero reports in
> New Zealand dollars, and so does this article for its results; share prices are in Australian dollars, because
> Xero trades on the ASX. Every share-price figure is re-derived by `verify/earn_figures.py` from frozen data, and
> `verify/assert_xro.py` checks each one against the text of this file.
>
> Xero lodged its results at 7:44am Sydney time on 12 November 2026, before the market opened, so the reaction is
> the close on 12 November against the close on 11 November. Share-price history is frozen at the close of
> 12 November 2026.

---

## Publishing details

| Field | Value |
|---|---|
| **URL** | `/articles/xero-h1-fy27-results` |
| **Title tag** | Xero half-year results 2026: revenue up 46%, profit down 86% |
| **H1** | Same as the title tag: the site uses one field for both |
| **Meta description** | Xero's revenue rose 46% and its profit fell 86%. Why both are true, what the A$1 billion buy-back means, and how far the shares have fallen. |
| **Kind** | Market commentary |
| **Region pill** | Australia |
| **Reading time** | see the site check |
| **As at** | Results: 12 November 2026 (before the open). Reaction: the close on 12 November 2026 |
| **Refresh** | Do not refresh in place. The full-year results on 20 May 2027 get their own article. |

**The searches this targets** (Google's own suggestions for "xero", 13 Nov 2026): "xero share price", "xero
shares", "xero results 2026", "xero half year results", "xero share price drop", "xero share price history",
"xero shares falling", "xero buyback", "xero asx".

**Why the title tag carries the search words:** Search Console shows our results articles appearing for searches
like "westpac full year results 2026" and "nab profit 2026" at positions 7 to 12, under title tags that never
said "results" or the year. This one leads with the words people type, then the contradiction.

**Internal links:** `/articles/asx-tech-shares-how-far-have-they-fallen`, `/learn/what-is-a-drawdown`.

---

## The answer, shown under the heading

Xero's revenue rose 46% to NZ$1.75 billion in the six months to September 2026, but its net profit fell 86% to
NZ$18.5 million, mainly because of Melio, the US business it bought. Its shares rose 6.1% on results day, when it
also announced a buy-back of up to A$1 billion, and are still 61.3% below their record.

---

## Body

### The short version

Xero, the accounting software company with 5.1 million customers, most of them small businesses, reported its
results for the six months to 30 September 2026 before the market opened on 12 November. All of Xero's figures are
in New Zealand dollars. In short:

- **Revenue:** NZ$1,745 million, up 46%. Without the US payments business Melio, which Xero did not own a year
  earlier, the comparable growth was 27%.
- **Net profit:** NZ$18.5 million, down 86% from NZ$134.8 million.
- **Customers:** 5,146,000, up 12%, after adding 226,000 in the half.
- **The outlook:** revenue for the year to March 2027 now expected to be NZ$3,770 million to NZ$3,830 million, up
  from NZ$3,620 million to NZ$3,730 million.
- **A buy-back:** Xero will buy back up to A$1 billion of its own shares over the next 12 months.
- **Its finance chief is leaving:** Claire Bramley will step down as chief financial officer on 31 January 2027.
- **The shares:** up 6.1% on results day, to A$75.17.

### Revenue up 46%, profit down 86%: why both are true

The two headline numbers point in opposite directions, and both are right. The gap is Melio, a US bill-payments
company Xero agreed to buy in June 2025 for an upfront US$2.5 billion. This was the first half-year with Melio in
it for all six months, and Melio is still losing money: Xero says it expects Melio to reach break-even, on its
adjusted EBITDA measure, in the second half of the year to March 2028.

Melio adds revenue, which is why revenue jumped. But it also changed the rest of the profit and loss statement.
Net profit fell by NZ$116.3 million, and Xero's own figures show where it went:

| Six months to 30 September, NZ$ | 2025 | 2026 | Change |
|---|---|---|---|
| Operating income | 137.1M | 124.5M | −12.6M |
| Other income and expenses | +77.6M | −14.1M | −91.7M |
| Net finance income or expense | +17.0M | −78.0M | −95.1M |
| Income tax | −96.4M | −13.3M | +83.0M |
| **Net profit** | **134.8M** | **18.5M** | **−116.3M** |

*The table leaves out small losses on asset disposals, NZ$0.6 million and NZ$0.5 million, so its rows add up to
within NZ$0.1 million of the change.*

Reading it line by line:

- **Operating income fell 9%.** That is gross profit less operating costs. Payments carry a lower gross margin than
  software subscriptions, so Xero's gross margin fell from 88.5% to 76.0%.
- **Last year had a one-off gain.** A year earlier, Xero booked NZ$77.6 million of foreign-exchange gains, which it
  says were on US dollar funds it was holding to buy Melio. This year, the same line was a NZ$14.1 million cost.
- **Interest went from income to a cost.** A year ago Xero earned interest on the cash it had raised for Melio.
  That cash has now been spent, and Xero pays interest on money it borrowed for the deal. Finance income fell from
  NZ$73.4 million to NZ$20.0 million, and finance costs rose from NZ$56.4 million to NZ$98.0 million.
- **Tax was much lower,** which softened the fall. Xero says that was largely because it recognised part of the
  value of past US tax losses.

On Xero's adjusted measures, which add back one-off and non-cash items, the picture is different. Adjusted EBITDA
rose 3% to NZ$361.6 million. And on a pro-forma basis, which counts Melio in both years so the two halves can be
compared, adjusted EBITDA rose 23% and free cash flow rose 32% to NZ$238.1 million. On the reported figures, free
cash flow fell 26%.

### Three ways to measure the growth

Xero quotes its growth three ways, and they give three different answers for revenue:

| Revenue growth, six months to 30 September 2026 | |
|---|---|
| Reported | +46% |
| Reported, at constant currency | +41% |
| Pro-forma (as if Xero had owned Melio a year earlier) | +27% |

Constant currency removes the effect of exchange rates, and the New Zealand dollar was weaker, which made revenue
earned in Australian dollars, pounds and US dollars worth more. Pro-forma is the closest to a like-for-like
comparison.

### Where the growth came from

| Six months to 30 September 2026 | Revenue, NZ$ | Growth | Customers |
|---|---|---|---|
| Australia | 670M | +23% | 2,192,000 |
| New Zealand | 125M | +6% | 656,000 |
| United Kingdom | 419M | +24% | 1,404,000 |
| United States | 365M | +51% pro-forma | 455,000 |

- **Australia** is still the biggest market: revenue up 23%, or 17% at constant currency, and 2,192,000 customers,
  up 9%. New Zealand, where Xero started, added 6,000 customers in the half.
- **The UK** added 85,000 customers in the half, against 56,000 a year earlier. Xero tied that partly to Making Tax
  Digital, a UK rule that moves more small businesses onto digital tax records.
- **The US** is where Melio sits. On a pro-forma basis, US revenue rose 51% and payments revenue 62%.

Across the group, average revenue per customer rose 25% to NZ$62.21 a month, helped by Melio's bigger customers,
by price rises and by payments. Xero says more price rises come through in the second half.

### The A$1 billion buy-back

Xero will buy back up to A$1 billion of its own shares on the ASX over the next 12 months, starting on or after
13 November. That is up to 14,320,554 shares, based on the average price over the five days to 11 November of
A$69.83. At the 12 November close, A$1 billion was 7.8% of Xero's market value of A$12.8 billion.

Xero's board says the program is a good use of capital "as the current share price does not reflect Xero's
long-term value and growth potential". That is Xero's view of its own shares, not ours. Xero says part of the
program is meant to offset the new shares it expects to issue to staff in the year to March 2028.

It is a reversal of direction. In June 2025, to help pay for Melio, Xero sold about 10.5 million new shares at
A$176 each, raising A$1.85 billion. On the day before the buy-back was announced, the shares closed at A$70.86.

### The outlook

| Year to March 2027, NZ$ | Before | Now |
|---|---|---|
| Revenue | 3,620M to 3,730M | 3,770M to 3,830M |
| Adjusted EBITDA | 860M to 920M | 880M to 920M |

Xero says the higher revenue forecast "largely reflects stronger Melio payments performance alongside an FX benefit
from the weaker NZD". It now expects revenue of more than NZ$4.6 billion in the year to March 2028.

Chief executive Sukhinder Singh Cassidy said: "Our H1 FY27 results show we're continuing to do what we said we'd
do, delivering strong macro-resilient growth at scale with momentum across every region."

On AI, which investors have worried could replace accounting software, she said: "Our infrastructure, data,
scale and trust advantages position Xero well and help customers continue to benefit in the agentic era."

These are Xero's views of its own business, not ours.

### Its finance chief is leaving

On the same morning, Xero said chief financial officer Claire Bramley had decided to leave to take up a new role
with another global organisation. She stays until 31 January 2027, and Xero will run a global search for her
successor.

### How the shares reacted

Xero's shares closed at A$70.86 on 11 November. On 12 November, results day, they closed at A$75.17, up 6.1%. The
ASX 200 fell 0.07% the same day.

During the day they were up more than 12%, then gave back about half of that gain by the close.

### How Xero shares usually react to results

We measured all 17 of Xero's results from May 2018, after its shares moved to trading only on the ASX, to May
2026, comparing the close on each results day with the close the day before. Xero releases its results before the
market opens.

- The middle move, up or down, was **8.9%**.
- Twelve of the 17 moved the shares 5% or more, and five 10% or more.
- The largest fall was **13.0%** in May 2021.
- The largest rise was **10.8%** in May 2019.
- The shares rose on 8 of the 17 days and fell on 9. The two results before this one both fell by 9.0%.

So a 6.1% rise was a smaller move than usual for Xero: 11 of the 17 earlier results moved the shares more.

### How far Xero has fallen

Xero's record close was A$194.21 on 24 June 2025, the last trading day before it announced the Melio deal. From
there the shares fell 71.5% to A$55.31 on 1 October 2026, their lowest close since.

The fall was not steady. Their worst day this year was 4 February, when they fell 15.9%, after US software shares
had slid on fears that new AI tools, from companies including Anthropic, could replace software services. On
14 May, the day of Xero's full-year results, they fell 9.0%.

By 12 November they had risen 35.9% from the October low, but they were still 61.3% below the record, and down
34.1% since the start of 2026.

Xero's shares have fallen 20% or more seven times in our price history for its ASX shares, which starts in
November 2012. Xero does not pay a dividend, so these are price-only:

| Record close | Lowest point | Fall | Back at the record |
|---|---|---|---|
| March 2014 | September 2015 | −71.1% | June 2018 |
| August 2018 | November 2018 | −29.9% | April 2019 |
| February 2020 | March 2020 | −34.0% | June 2020 |
| December 2020 | March 2021 | −29.7% | October 2021 |
| November 2021 | November 2022 | −58.4% | November 2024 |
| February 2025 | April 2025 | −23.7% | June 2025 |
| June 2025 | October 2026 | −71.5% | Not yet |

The six earlier falls all got back to their record, the longest after more than four years. Until February 2018,
Xero's main listing was in New Zealand, so the first fall is measured on its thinner-traded ASX shares. This is a
record of what happened, not a guide to what will.

### What our model makes of Xero

Our model rates Xero **Constructive**, 67 out of 100, using share prices to 12 November and the financial data it
held before these results. Its Financial Health score is 63.8, its Valuation score 53.1 and its Cycle Payoff score
90.1. This is our model's rating, not a recommendation.

### What comes next

- **Melio.** Whether it reaches the break-even Xero expects in the second half of the year to March 2028.
- **The buy-back.** Xero will tell the ASX each day how many shares it bought the day before.
- **The full-year results,** due on 20 May 2027, and whether revenue lands within the NZ$3,770 million to
  NZ$3,830 million Xero now expects.
- **A new finance chief,** from Xero's global search.

### What this cannot tell you

These are results for six months. Forecasts are Xero's own, not ours, and Xero's adjusted and pro-forma figures
are its own measures, which it says have not been audited. The share-price history is a record of what happened
before, not a prediction. This article is general information and does not take into account your objectives,
financial situation or needs.

---

## Fact-check sheet

**Xero's figures come from its own documents, saved in `reference/xro-2026-h1/sources/`.**

- Results announcement, 12 Nov 2026: `results-announcement.pdf` (highlights table p2, markets p3, buy-back and
  outlook p4–5, CEO quotes p1)
- Appendix 4D and Interim Report: `interim-report-4D.pdf` (business results table p9; net profit, tax and free cash
  flow p10; segments and customers p13–15; finance income and expense p18–19; other income, note 6)
- Investor presentation: `investor-presentation.pdf` (slide 42: the one-time FX gains on US dollar funds held for
  Melio; slide 44: pro-forma)
- CFO transition: `cfo-transition.pdf`
- Buy-back: `buyback-disclosure.pdf` (14,320,554 shares; 5-day VWAP A$69.8297 to 11 Nov)
- Shares on issue before 13 Nov: 170,661,000 after 8,164 quoted on 13 Nov (`app2a-2026-11-13.pdf`), so
  170,652,836 on 12 Nov, equal to the ASX's own figure (`asx-key-stats.json`); × A$75.17 = A$12.83 billion
- Melio price and the June 2025 placement: `melio-announcement-2025-06-25.pdf` (US$2.5 billion upfront),
  `placement-complete-2025-06-26.pdf` (about 10.5 million shares at A$176), `trading-halt-2025-06-25.pdf`
- Results dates: every results release in the ASX announcement lists `asx-list-2012.html`…`asx-list-2026.html`;
  next result 20 May 2027 (`fy27-key-dates.pdf`); sole ASX listing from 5 Feb 2018 (`sole-asx-listing-2018.pdf`)
- Closes: the ASX's own quote shows the 12 Nov close of A$75.17 (`asx-key-stats.json`, priceClose); The Motley
  Fool reported the 11 Nov close of A$70.86 and an intraday price of A$79.66, up about 12%
  (`news-www.fool.com.au_2026_11_12_…`); our stored high for 12 Nov is A$80.02
- 4 February 2026: the Axios report of the US software slide on 3 Feb (`news-axios-2026-02-03-ai-software-anthropic.txt`)
- 14 May 2026: The Nightly (`news-thenightly.com.au_…`), "Xero shares fell 9 per cent on the day"

### Spot-checks you can confirm yourself

- Operating revenue NZ$1,745,305,000 and net profit NZ$18,529,000: the results announcement, highlights table.
- The NZ$77.6 million of foreign-exchange gains a year earlier: Interim Report, note 6, and investor presentation
  slide 42.
- The buy-back of up to 14,320,554 shares: the buy-back disclosure document.
- The 12 November close of A$75.17: the ASX's own Xero page.
