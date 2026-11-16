# DRAFT FOR REVIEW — Article 29: Australia's home loans just had their biggest fall on record

> Nothing here is published. This file holds the draft, the SEO plan and the fact-check sheet.
> The long video and the Short are scripted only after the owner approves the article.
>
> Every lending figure comes from the ABS's own release and workbook (Lending indicators,
> September Quarter 2026, released 11:30am AEDT, 11 November 2026). Every bank's loan book comes
> from APRA's Monthly ADI Statistics for September 2026. What each bank said and forecast comes
> from that bank's own documents. The RBA's view comes from its 3 November decision statement, its
> November Statement on Monetary Policy and its October Financial Stability Review. The tax changes
> come from Treasury and the ATO. Share prices are our stored history, frozen at the close of
> Friday 13 November 2026.
>
> Every derived figure is produced by `verify/housing_figures.py` from the saved ABS and APRA
> workbooks and `reference/housing-2026-11-DATA.json.gz`, and checked against this file by
> `verify/assert_housing.py`. All sources are saved in `reference/housing-2026-11/sources/`.

---

## Publishing details

| Field | Value |
|---|---|
| **URL** | `/articles/home-loans-record-fall-bank-shares` |
| **Title tag** | Home loans had a record fall. What it means for bank shares (59 chars) |
| **H1** | Australia's home loans just had their biggest fall on record. Here is what it means for the banks |
| **Meta description** | New home loans fell 15.5% and investor loans 32.3% in three months, both records. Why, what the banks expect, and what bank shares did in past downturns. (153 chars) |
| **Kind** | Market commentary |
| **Region pill** | Australia |
| **Reading time** | about 14 minutes |
| **As at** | Lending: September quarter 2026 (ABS, 11 Nov 2026). Bank loan books: 30 September 2026 (APRA). Share prices: the close on 13 November 2026 |
| **Refresh** | Do not refresh in place. The December quarter figures (ABS, 10 February 2027) get their own article. |

**The searches this targets:** "home loans fall record", "investor lending fall", "ABS lending
indicators", "house prices falling australia 2026", "negative gearing changes 2026",
"house price forecast 2027", "bank shares house prices", "cba shares", "westpac shares",
"nab shares", "anz shares".

**What competitors already cover, and what this adds** (four pieces read and saved in
`sources/competitors/`, plus the banks' own economists' notes in `sources/`; Kalkine refused the
download and Switzer's page held no article text): The Urban Developer
and HtAG reported the ABS figures well, with industry reaction and a city-by-city price view.
CommBank's and NAB's economists each published their own house-price forecast. Morningstar covered
Westpac's quarter. Motley Fool's 2017 piece is headlined "Why the Big 4 banks are a huge bet on
Australian property prices". **None puts the four banks' own house-price forecasts and worst-case scenarios side by
side. None measures what bank shares actually did in past housing downturns. None shows how much
of each bank's lending is home loans, or what the banks themselves say the slowdown means for them.**
This piece does all three, in plain language, with every number checkable.

**Chart for the site page:** the value of new investor and owner-occupier loans every quarter since
September 2002 (`chart_inv_value_bn`, `chart_oo_value_bn` in `housing_figures.py`), marking mid-2008,
late 2015 and the September quarter 2026.

**Internal links:** `/learn/what-is-a-drawdown`, `/articles/rba-rate-rises-asx-bank-shares`,
`/articles/westpac-fy26-results`, `/articles/nab-fy26-results`, `/stocks/au/CBA`, `/stocks/au/WBC`,
`/stocks/au/NAB`, `/stocks/au/ANZ`.

---

## The answer, shown under the heading

New home loans fell 15.5% in the September quarter and investor loans 32.3%, the biggest falls
since the ABS series began in 2002. The RBA blames higher rates and the budget's tax changes. The
banks expect fewer new loans and lower house prices, but so far their shares have not fallen with
the housing market.

---

## Body

### The short version

- **New home loans fell by a record amount.** Australians took out **$81.2 billion** of new home
  loans in the September quarter, **15.5%** less than in the June quarter. That is the largest
  quarterly fall since the series began in 2002, the ABS says. The previous largest was **13.3%**,
  in mid-2008.
- **Investors pulled back the most.** Loans to property investors fell **32.3%** to **$24.7 billion**,
  almost double the previous record fall of **18.4%** (late 2015). Loans to people buying a home to
  live in fell **5.3%**.
- **Two reasons, in the RBA's and ABS's own words.** The RBA has raised its cash rate five times this
  year, from 3.60% to **4.85%**. And the federal budget of 12 May limited negative gearing to new
  homes and changed how capital gains are taxed, from 1 July 2027. The RBA says new housing lending
  "has declined sharply in response to tighter monetary policy and recent tax changes".
- **House prices are falling, and the banks expect more.** The RBA says national prices were
  **4.7%** below their peak in September, in "one of the steepest" downturns of the past 50 years.
  Three of the big four's economists now expect a total fall of about **11% to 14%** from the peak.
- **For the banks: fewer new loans and more money set aside.** Home loans are more than half of each
  big bank's lending in Australia. The banks expect home lending to grow more slowly, and all four
  have increased the money they hold for loans that may go bad.
- **Bank shares have not followed house prices down, at least so far.** Since the house-price peak in
  March, the big four's shares are up **4.1%** on average, including dividends. In past housing
  downturns there was no single pattern: what else was happening mattered more.

### Seven terms used in this article

- **New loan commitment:** a home loan a borrower has signed up to in the quarter. It counts new
  borrowing only, not loans people already have, and not refinancing an existing loan with another
  bank.
- **Owner-occupier:** someone borrowing to buy a home they will live in.
- **Investor:** someone borrowing to buy a property they will rent out.
- **First home buyer:** an owner-occupier buying their first home. The ABS counts them inside the
  owner-occupier figures, so the two cannot be added together.
- **Negative gearing:** when a rental property costs its owner more each year (in interest and other
  costs) than it earns in rent, and the owner deducts that loss from their other income, such as
  wages, to pay less tax.
- **Capital gains tax (CGT) discount:** until now, an individual who sold an investment held for more
  than a year paid tax on only half of the profit.
- **Cash rate:** the interest rate the RBA sets. Banks' home-loan rates tend to follow it.

### What the ABS reported on 11 November

The ABS measures new home loans every quarter. Its figures are seasonally adjusted, which removes
the normal rise and fall across the year so that one quarter can be compared fairly with the one
before.

**The money lent** in the September quarter:

| Borrowers | Value | On June quarter | On a year ago |
|---|---|---|---|
| All new home loans | $81.2b | −15.5% | −18.1% |
| Owner-occupiers | $56.5b | −5.3% | −4.6% |
| First home buyers | $16.2b | −8.0% | −3.7% |
| Investors | $24.7b | −32.3% | −38.1% |

**The number of loans** in the same quarter:

| Borrowers | New loans | On June quarter |
|---|---|---|
| All new home loans | 111,878 | −15.0% |
| Owner-occupiers | 76,578 | −5.3% |
| First home buyers | 26,415 | −8.6% |
| Investors | 35,301 | −30.6% |

("$81.2b" means $81.2 billion. First home buyers are counted inside owner-occupiers.)

**Reading one row:** in the September quarter, investors took out 35,301 new home loans worth
$24.7 billion. That is 30.6% fewer loans than in the June quarter, and 32.3% less money.

**What the table shows:**

- **Almost four-fifths of the fall came from investors.** The value of all new home loans fell by
  **$14.9 billion** in the quarter, and **$11.8 billion** of that was investors. That is **78.9%** of
  the fall, from a group that took out **38.0%** of the money lent in the June quarter.
- **It is the third quarter in a row of falling investor lending.** Investor lending peaked at
  **$43.6 billion** in the December quarter of 2025. It is now **43.3%** below that.
- **Investors' share of new lending has shrunk.** In the December quarter of 2025 investors took
  out **40.1%** of the value of new home loans. In the September quarter it was **30.4%**.
- **The investor fall was everywhere.** The ABS says it was "broad-based, with strong falls
  recorded in all states and territories".

In the ABS's own words: "Our data suggests that investor activity is being influenced by factors
beyond increasing borrowing costs, including the potential impacts of tax changes and expectations
of lower house prices." (Dr Mish Tan, ABS head of finance statistics.)

### How big is this, against 24 years of records?

The ABS's value series starts in September 2002. Over those 24 years, these are the largest
quarterly falls:

| Value of new loans | Quarter | Fall |
|---|---|---|
| All home loans: largest fall | Sep 2026 | −15.5% |
| All home loans: second largest | Jun 2008 | −13.3% |
| Investor loans: largest fall | Sep 2026 | −32.3% |
| Investor loans: second largest | Dec 2015 | −18.4% |

The second-largest falls each came at a moment of its own. Mid-2008 was the start of the global
financial crisis. Late 2015 came a year after APRA, the bank regulator, told banks in December 2014
that investor lending growing faster than 10% a year would be "an important risk indicator" for its
supervisors. This quarter's investor fall is almost twice the one in late 2015.

### Why it happened: rates and tax

**1. Five rate rises this year.** The RBA raised its cash rate on 3 February, 17 March, 5 May,
29 September and 3 November, from 3.60% to 4.85%, a total of 1.25 percentage points. Its reason, in
its 3 November statement: "Inflation remains elevated and recent data indicate that it is broadly
based." Higher rates mean bigger repayments, so people can borrow less. CBA's own results show
this: it says borrowing capacity was "impacted by higher interest rates and Federal Budget tax reform
changes".

**2. The budget's tax changes.** On 12 May 2026 the government announced two changes, which
apply from 1 July 2027 (Treasury; the ATO says both are now law):

- **Negative gearing** on residential property will be limited to new builds. Someone who buys an
  established home to rent out after 7:30pm on 12 May 2026 can no longer deduct its losses from their
  wages. Properties already held at that moment are exempt.
- **Capital gains tax:** the 50% discount is replaced with a discount based on inflation, and a
  minimum 30% tax rate on capital gains. It applies only to gains made from 1 July 2027.

Both changes fall on investors in established homes, and that is where the fall is largest. CBA's
economists found that new-build lending held up: it fell **10.4%**, and its share of investor lending
rose from **17.3%** in the March quarter to **27.6%** in September. CBA's senior economist Ashwin
Clarke called that "consistent with the design of the government's tax policy changes, which favour
investors' purchases of new builds".

**The RBA puts the two together.** Its November Statement on Monetary Policy says housing prices "have
declined by more than expected and new housing lending has declined sharply in response to tighter
monetary policy and recent tax changes".

### House prices: how far they have fallen, and what the banks expect

**So far.** The RBA says national housing prices were **4.7%** below their recent peak in
September, and that the downturn is "one of the steepest over the past 50 years". Its October
Financial Stability Review attributes the fall to "the somewhat restrictive stance of monetary
policy and changes to negative gearing and capital gains tax discount policies". More recent figures
from Cotality, a property data company, quoted by CommBank's economists: national values fell another
**1.2%** in October, leaving them **6.7%** below their March peak.

**What the banks' economists now expect.** Three of the big four publish a forecast of the total
fall from peak to trough. Here are the latest, from each bank's own website or results:

| Bank | Fall from peak to trough it expects | Published | What it expected before |
|---|---|---|---|
| CBA | about 14% (national) | November 2026 | about 9% (September) |
| NAB | about 14% (combined capital cities) | November 2026 | 11% |
| Westpac | 10.9% (March 2026 to 2027) | 2 November 2026 (results) | 7.3% (September) |

All three now expect a bigger fall than they did two or three months ago. NAB expects "a floor in
house prices likely in Q2 2027". CommBank expects prices "to continue falling into 2027". ANZ's
results give a yearly figure instead: in the central case it uses to set aside money for bad loans,
Australian house prices fall **4.3%** in 2026 and **3.4%** in 2027.

These are forecasts, and forecasts are often wrong. We report them because they are what the banks
themselves expect, and the banks are the ones holding the loans.

### What it means for the banks

**First, how much of each bank is home loans.** APRA, the bank regulator, publishes every bank's
loans each month. At 30 September 2026:

| Bank | Home loans | Share of its loans | To investors |
|---|---|---|---|
| CBA | $643b | 67.5% | 34.7% |
| Westpac | $505b | 64.3% | 33.8% |
| ANZ | $334b | 62.3% | 34.2% |
| NAB | $351b | 50.6% | 32.8% |
| All lenders | $2,510b | 60.4% | 32.6% |

("All lenders" means every bank, credit union and building society that reports to APRA. "Share of
its loans" is home loans as a share of all the bank's loans to Australian residents. "To investors"
is the share of its home loans that are to investors.)

**Reading one row:** CBA has $643 billion of home loans in Australia. That is 67.5% of all its
Australian loans, and 34.7% of those home loans are to investors.

Together the big four hold **73.0%** of all the home loans held by banks, credit unions and building
societies that report to APRA. NAB is the least reliant on home loans of the four, because more of
its lending is to businesses.

**Second, what the slowdown means for them, in their own words.** A bank's profit depends on how much
it lends, the margin it earns on each loan, and how many loans go bad. The housing slowdown touches
all three.

1. **Fewer new loans.** Three of the four give a figure, and all three expect home lending across the
   banking system to grow more slowly:
   - NAB expects system growth of "~2.6% in FY27", down from about 7% in FY26.
   - Westpac's economists expect housing credit growth of 3.8% in FY27, and 3.0% for investors.
   - CBA's economists expect it to slow to 2.0% by the end of 2027.
   - CBA said its home loan applications in the September quarter "remained lower by 16%" than a
     year earlier.
2. **More money set aside for loans that may go bad.** Banks hold money aside, called provisions, in
   case some borrowers cannot repay. Each bank added to them this year:
   - Westpac's impairment charge rose **104%** to **$864 million** in the year to September.
   - NAB's credit impairment charge rose **85.7%** to **$1,547 million**. NAB said it had "strengthened
     provisioning to reflect a more challenging environment of slowing growth, declining house prices,
     higher interest rates and inflationary pressures".
   - ANZ's collective provision charge was **$222 million**, $108 million higher than last year.
   - CBA said, in its September-quarter update, that higher provisions "primarily" reflected "the
     impact of lower house prices on the mortgage portfolio". It also said home loan arrears rose
     0.07 percentage points in the quarter.
3. **How bad could it get?** Each bank tests itself against a severe downturn. ANZ's downside
   scenario has Australian house prices falling **27.3%** from peak to trough. NAB's has them falling
   **26.6%** in FY27. These are not forecasts: they are the bad cases the banks hold provisions
   against.

**Third, what the RBA says about the risk.** In its October Financial Stability Review, the RBA
said:

- "Australian banks are well positioned to continue lending, even in a significant downturn."
- Less than 1% of borrowers owe more than their home is worth. Even if prices fell another 20%,
  "only around 5 per cent of mortgages would fall into negative equity".
- Over 90% of home loans already in trouble are "well secured": selling the home would repay the
  loan in full.
- Investors "have historically exhibited lower rates of arrears and default than owner-occupiers".
  But in a falling market they "may be less willing to enter the market and more
  inclined to sell properties to limit losses", which "can amplify price declines".

### What bank shares did in past housing downturns

Westpac's own results pack lists Australia's three housing downturns since 2008, with their dates.
We measured each big bank's share price over the same months, and the ASX 200 for comparison.

The four downturns, with Westpac's dates: January 2008 to January 2009, July 2017 to May 2019,
January 2022 to January 2023, and March 2026 to now (we measure to the close on 13 November 2026).

| Downturn | House prices fell | Big four | ASX 200 |
|---|---|---|---|
| 2008–09 | 6.9% | −40.9% | −37.3% |
| 2017–19 | 8.6% | +2.6% | +11.8% |
| 2022–23 | 7.5% | +17.3% | +7.2% |
| 2026 so far | 10.9% | +4.1% | +7.1% |

("Big four" is the average of the four banks' share-price moves. The 2026 house-price figure is
Westpac's forecast for the whole downturn.)

Each bank on its own:

| Downturn | CBA | Westpac | NAB | ANZ |
|---|---|---|---|---|
| 2008–09 | −42.2% | −35.0% | −41.1% | −45.4% |
| 2017–19 | +5.1% | −1.8% | +1.7% | +5.6% |
| 2022–23 | +22.0% | +23.1% | +23.0% | +0.9% |
| 2026 so far | +3.6% | −0.2% | −2.1% | +15.0% |

**How to read it:** from the end of January 2008 to the end of January 2009, house prices fell 6.9%
(Westpac's figure). Over the same months, the big four's shares fell 40.9% on average, and the ASX 200
fell 37.3%.

The bank figures include the dividends each bank paid during the downturn. The ASX 200 figure is the
index itself, which does not include dividends. So the comparison flatters the banks. Even so, the
banks did worse than the index in two of the three past downturns.

**What the table shows:**

- **There is no single pattern.** Bank shares fell hard in 2008–09, roughly stood still in 2017–19,
  and rose strongly in 2022–23, through downturns of a similar size.
- **What else was happening mattered more than house prices.** 2008–09 was the global financial
  crisis, when shares everywhere fell. In 2017–19 the banks were under the Royal Commission into
  Misconduct in the Banking, Superannuation and Financial Services Industry, whose final report was
  released on 4 February 2019. In 2022–23 the RBA was raising rates from near zero, which lifted
  the banks' margins: CBA's rose from 1.90% to 2.10% in the six months to December 2022 (see our
  article on the RBA's rate rises).
- **In 2026, the banks have neither collapsed nor led the market.** Since the March peak in prices,
  the big four are up 4.1% on average including dividends, behind the ASX 200's 7.1% without them.
  Over the calendar year to 13 November, they are up **5.4%**, against **4.2%** for the index.
- **The banks have moved far apart.** ANZ is up 15.0% since March and NAB is down 2.1%. All four lend
  to the same housing market; what differed was each bank's own news, such as its results and its
  cost-cutting.

On the day the ABS figures came out, 11 November, AAP reported that "the big four banks retreated"
while the ASX 200 rose 0.27%. CBA released its own quarterly update the same day, so its move that
day reflects more than the lending figures.

### What to watch next

- **The RBA's next decision: Tuesday 8 December, 2:30pm.** It said on 3 November that it "will be
  attentive to the data".
- **House prices for November:** Cotality publishes national figures at the start of each month.
- **Investor lending, month by month:** APRA publishes each bank's loans monthly. Its next release
  covers October.
- **The next ABS lending release: 10 February 2027,** for the December quarter.
- **The tax changes start on 1 July 2027.** The ATO says investors who bought established homes
  after 12 May 2026 will not be able to deduct their losses from wages from then on.

### What this does not tell you

- **Three past downturns is a small sample,** and each had a different cause. They tell us bank shares
  do not move in step with house prices. They cannot tell us what happens this time.
- **A share price moves for many reasons at once.** We do not claim the housing market caused any
  particular move.
- **Forecasts are forecasts.** The banks' expected falls changed within two months. They may change
  again.
- **The ABS counts new loans, not existing ones.** Fewer new loans does not mean people are failing to
  repay the ones they have.

This article is general information only, not financial advice. It does not take into account
your objectives, financial situation or needs.

---

## Fact-check sheet

Every source is saved in `reference/housing-2026-11/sources/` (gitignored, re-downloadable from the
links). Derived figures are produced by `verify/housing_figures.py` and asserted by
`verify/assert_housing.py`.

| Claim | Source / how derived |
|---|---|
| Every ABS number, % change, count and share | ABS, Lending indicators, September Quarter 2026, Table 1 (`abs-560101.xlsx`), seasonally adjusted, https://www.abs.gov.au/statistics/economy/finance/lending-indicators/latest-release; derived by `housing_figures.py` (`abs`) |
| Release time 11:30am AEDT, 11 Nov 2026; "largest quarterly fall since the commencement of the series in September quarter 2002"; investor fall "almost double the previous record"; "strong falls recorded in all states and territories"; Dr Mish Tan quote | ABS media release, 11 Nov 2026 (`abs-media-release.html`), https://www.abs.gov.au/media-centre/media-releases/largest-quarterly-falls-record-led-loans-investors |
| Five 2026 rises (3 Feb, 17 Mar, 5 May, 29 Sep, 3 Nov; holds on 16 Jun and 11 Aug); 3.60% before February as in article 11 | RBA statements mr-26-03, -08, -12, -15, -19, -27, -30 |
| Previous largest falls (−13.3% Jun 2008; −18.4% Dec 2015) | Derived from Table 1 (`total_value_second_worst`, `inv_value_second_worst`) |
| APRA, 9 Dec 2014: investor lending growth "materially above a threshold of 10 per cent will be an important risk indicator" | APRA media release, 9 Dec 2014 (`apra-2014-investor-lending.html`), https://www.apra.gov.au/news-and-publications/apra-outlines-further-steps-to-reinforce-sound-residential-mortgage-lending |
| Cash rate rises 3 Feb, 17 Mar, 5 May, 29 Sep, 3 Nov 2026; 3.60% → 4.85%; quotes | RBA decision statements mr-26-03, -08, -12, -27, -30 (`rba-mr-26-*.html`) |
| "housing prices have declined by more than expected and new housing lending has declined sharply in response to tighter monetary policy and recent tax changes" | RBA SMP November 2026, Chapter 1 (`rba-smp-2026-11.pdf`, p22) |
| National prices 4.7% below peak in September; "one of the steepest over the past 50 years" | RBA SMP November 2026, Chapter 2, Graph 2.14 text (p47) |
| FSR quotes: "somewhat restrictive stance … negative gearing and capital gains tax discount policies"; <1% negative equity; 20% fall → ~5%; >90% of housing NPLs well secured; investor quotes; "well positioned to continue lending, even in a significant downturn" | RBA Financial Stability Review October 2026 (`rba-fsr-2026-10.pdf`, pp. 31–35, 51; In Brief page) |
| Tax changes, dates and the 7:30pm 12 May exemption | Treasury, Budget 2026–27 tax system changes (`treasury-budget-2026-27-tax.html`); ATO (`ato-tax-reform-ng-cgt.html`) |
| CBA borrowing capacity "impacted by higher interest rates and Federal Budget tax reform changes" | CBA 2026 Full Year Results Presentation (`cba-fy26-presentation.pdf`, p78) |
| CBA 1Q27: applications "lower by 16%"; provisions "primarily reflecting the impact of lower house prices"; arrears +7bpts | CBA 1Q27 Trading Update, 11 Nov 2026 (`cba-1q27-update.pdf`) |
| New-build lending −10.4%; share 17.3% → 27.6%; Ashwin Clarke quote; CBA forecast 14%, previously ~9%; "into 2027"; housing credit 2.0% by end-2027; Cotality Oct −1.2%, 6.7% below March peak | CommBank Newsroom, 11–12 Nov 2026 (`cba-1q27-news.html`, `cba-econ-home-prices-nov26.html`) |
| NAB ~14% (prev. 11%), "floor … Q2 2027" | NAB Housing Monitor, November 2026 (`nab-housing-monitor-nov26.html`) |
| Westpac 10.9% Mar 2026–2027f; three past cycles and their dates and falls; housing credit 3.8% FY27, investor 3.0% | Westpac 2026 Full Year Results Presentation & IDP, p40 (`wbc-full-year-presentation-and-IDP-2026.pdf`) |
| Westpac 7.3% (September) | Westpac Wire, 9 Sep 2026 (`wbc-housing-forecast-news.html`) |
| Westpac impairment charge $864m, +104% | Westpac 2026 Full Year media release, results table (`wbc-media-release-2026.pdf`) |
| NAB system growth ~2.6% FY27 (~7% FY26); impairment $1,547m +85.7%; provisioning quote; downside house prices −26.6% FY27 | NAB 2026 Full Year Results summary and investor presentation (`nab-fy26-summary.pdf`, `nab-fy26-presentation.pdf`) |
| ANZ CP charge $222m, +$108m; house prices −4.3% CY26, −3.4% CY27 (base); downside −27.3% | ANZ 2026 Full Year news release and results presentation (`anz-fy26-news-release.pdf`, `anz-fy26-presentation.pdf`, p84) |
| Every bank's home loans, share of loans, investor share; big four 73.0% of the total | APRA, Monthly ADI Statistics, September 2026, Table 2 (`apra-madis-sep-2026.xlsx`); derived by `housing_figures.py` (`apra`). Resident loans of each bank's Australian ADI |
| CBA net interest margin 1.90% (year to June 2022) and 2.10% (six months to December 2022) | CBA FY23 ASX announcement, 9 Aug 2023, as used and checked in article 11 (`/articles/rba-rate-rises-asx-bank-shares`) |
| Every share-price move | `housing_figures.py` (`prices`) on `housing-2026-11-DATA.json.gz`. Dividend-adjusted prices, so bank moves include dividends |
| Our stored index closes = published closes | ASX 200 9,029.7 (9 Nov), 9,153.2 (11 Nov, +24.2, +0.27%) and 9,020.8 (6 Nov, −0.49%) match AAP's closing reports on the CommBank newsroom (`market-wraps/`) |
| 11 Nov: "the big four banks retreated" | AAP via CommBank newsroom, 11 Nov 2026 (`market-wraps/wall-street-slips-as-hot-inflation-revives-rate-hike-fears1.html`) |
| Royal Commission final report presented 1 Feb 2019, released 4 Feb 2019 | Treasury (`treasury-royal-commission-final-report.html`), https://treasury.gov.au/publication/p2019-fsrc-final-report |
| RBA next decision 8 Dec 2026, 2:30pm; ABS next release 10 Feb 2027 | RBA meeting schedule; ABS release calendar (on the release page) |
| ⚠️ Not used: per-bank moves on 11 Nov | Our ANZ figure (+1.4%) disagrees with AAP's "the big four banks retreated"; not independently confirmed, so only AAP's sentence is quoted |
| ⚠️ Not used: "CBA fell 6.6% on its trading update" (search result) | That was 11 Nov 2025, not 2026 |

---

## Plan for the video and Short (scripted after approval)

- **Long video (~7–8 min), PaperBillions-style animation:** "Australians just stopped borrowing for
  homes. Here's what happens to the banks." Scenes: the queue outside the bank, three queues shrinking
  by their real figures, the 24-year record line, the rate dial and the budget-night clock, the four
  banks' forecast cards side by side, the "how much of each bank is home loans" stacks, then the
  past-downturn table played as a guess-first moment ("did bank shares fall with house prices?").
- **Short (~50–60 s, owner 16 Nov):** opens on the empty investor queue at frame 0 with the record
  figure, adds the "almost double the previous record" beat, then asks the question it does not
  answer ("So what happened to bank shares the last three times house prices fell? The answer
  surprised us.") and points to the full video via the description link and the Related video.
