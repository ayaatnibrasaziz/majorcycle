# Data Audit — 2026-08-05

**Scope.** Owner-requested after the 2026-08-04 session found three silent
defects in one afternoon:

> *"could you please audit our supabase database against the yfinance official
> docs and confirm if we are storing it in the correct format and if anything
> needs editing? Also the way we are manipulating the data to display, if
> anything is incorrect or not… Ensure that whenever we expand, there is no way
> of introducing bugs… ensure we are following the best practices and nothing
> breaks longterm ever."*

The brief was not "find three more bugs". It was **why did those three survive
review, and what would have caught them.** That question turned out to have a
better answer than the bugs did.

**Measured against:** the live Supabase project (`gurrrlogycxawududtyv`, 867
rows in `stocks`, 6,575,807 in `price_bars`) and live yfinance responses on
**1.5.2** — the version the nightly cron actually installs, which is not the one
this machine had.

**Result:** 10 findings. **7 fixed** (three of them changing numbers a customer
can see), 3 documented with a recommendation. **6 new guards**, each broken on
purpose before being trusted. Python suite **121 → 153**, Playwright
**115 → 116**.

**Status: ✅ MERGED `e4237fa` (2026-08-05 04:00Z) and verified on production.**
Both crons re-run afterwards via GitHub `workflow_dispatch` on `main` — see
**D3d** for why running them locally or before the merge would have been worse
than useless. Live result: **au 250/250 · ca 79/79 · us 534/534** carry
`financial_currency`, **zero** rows store a `0.0` margin, all **79**
cross-currency stocks withhold `pe_history`. The nightly tripwire's own
production log: `39 field(s) checked across 863 stocks; invariants: zero-margin
sentinel, cross-currency fcf_yield_pct, financial_currency coverage` — **OK**.

> ⚠️ **A separate defect was found immediately afterwards, and not by any of
> this.** The owner asked whether the *downloaded* report worked; it had been a
> blank page for every stock since 2026-08-01. It is written up in
> `docs/roadmap.md` and as **CLAUDE.md 11d**, not here, because its cause is a
> bundling fault rather than a data one. It belongs in this document's
> conclusions all the same — see **What this audit did NOT cover**.

---

## The systemic answer

Every defect in this audit, and all three from the day before, has the same
shape:

> **A line that isn't there, in code that reads correctly, on a page that renders
> perfectly.**

Not a wrong calculation — a missing one. `tz_convert` instead of `tz_localize`.
A ticker suffix absent from a list. A `Cache-Control` header never written. A
`.range()` never added. A margin of `0.0` never questioned.

Reading the code cannot find these, because there is nothing wrong to see. Three
instruments can:

| Instrument | Finds | Used here for |
|---|---|---|
| **Query the data, not the code** | values that can't be true | D1, D2, D6 |
| **Compare the cohort, not the value** | a unit that changed underneath you | D4's tripwire |
| **Assert the rule, not the instance** | the surface that opted out by not being in the list | D2, D3 guards |

The middle one is new and is the most important thing in this audit. A unit
error is invisible per-value — `0.024` is a perfectly plausible dividend yield —
and obvious across 863 of them. That is why `check_field_units` compares
**medians against declared bands** rather than validating individual numbers.

---

## D1 — A bank's "0% gross margin" was scored as if it were real ✅ FIXED

**Severity: high — it moved the rating four stocks display.**

yfinance returns `grossMargins: 0.0` and `ebitdaMargins: 0.0` for companies
where the concept doesn't apply. Every bank we cover does this — JPM, BAC, WFC,
C, CBA.AX, NAB.AX, ANZ.AX, WBC.AX, RY.TO, TD.TO, BNS.TO, BMO.TO, CM.TO — as do
pre-revenue explorers with no revenue to divide by.

`0.0` is not "zero percent". It is "not reported". The scorer read it literally:

```python
if f.gross_margin is not None:          # 0.0 passes this
    p.append(... 45 if gm >= 20 else 20)  # → 20, the worst bucket
```

The irony is that `score_financial_health` was **designed** for exactly this
case — it omits a pillar with no inputs rather than fabricating a neutral 50
(proposal P3, and the comment saying so is directly above the bug). The design
was defeated by data that said `0.0` instead of `null`.

### Measured, not asserted

Ran the real engine over the real stored data for all 71 affected stocks, twice
— once as production scored them, once with the sentinel treated as missing:

| | |
|---|---|
| Stocks carrying an exact-`0.0` margin | **71** |
| Overall Rating changed | **36** |
| **Customer-facing label changed** | **4** |
| Largest Financial Health swing | JPM and NTRS, **83.3 → 92.5** |

The four labels, verified again against the live database after the fix landed:

| | Financial Health | Was | Now |
|---|---|---|---|
| **C** (Citigroup) | 73.3 → 80.8 | 61 · Neutral | **65 · Constructive** |
| **WFC** (Wells Fargo) | 72.5 → 80.8 | 62 · Neutral | **67 · Constructive** |
| **SYF** (Synchrony) | 64.2 → 74.2 | 61 · Neutral | **67 · Constructive** |
| **EQB.TO** (EQB Inc) | 50.4 → 57.9 | 46 · Cautious | **50 · Neutral** |

It compounds rather than staying in one pillar: Financial Health is 40% of the
Overall Rating **and** it scales the valuation score through
`quality_factor` (JPM 0.832 → 0.923), so a single fabricated 0% is counted
twice.

Six stocks move **down** — DYL.AX, FFM.AX, NXE.TO, NXG.AX, IPX.AX, MI6.AX. That
is also correct. For a pre-revenue miner whose real margins are all negative, a
fake `20` was the best number in the pillar and was flattering it.

**It also poisoned the peer comparison.** The "vs Sector" column pooled the
zeros: the Financial Services median gross margin read **35.81%** when the 89
financials that actually report one have a median of **47.34%** — so every bank
was measured against a sector dragged down by 34 stocks reporting nothing.

### Fix

A new `analytics/providers/field_spec.py` states each field's unit **once**, with
`zero_means_na` where a genuine zero is impossible. Applied in
`normalise_fundamentals()`, called both **on write** (the provider) and **on
read** (`web/api/cycle.py`, `web/api/analyze.py`) — two independent controls, per
CLAUDE.md 11b, so a single bad row can't reach the scorer. 72 stored rows
backfilled; the Financial Services median now reads 47.34%.

Deliberately narrow — **only the four margins**, asserted by a test:

> A zero payout ratio, zero short interest and a debt-free balance sheet are all
> **real** zeros. 198 stocks genuinely pay no dividend and 8 genuinely carry no
> debt; nulling those would destroy true data. A margin of exactly `0.0000` is
> the only one that cannot happen to a company with revenue.

---

## D2 — Reads that silently truncate at 1000 rows ✅ FIXED

**Severity: high — a bug scheduled to arrive by itself, with no commit to blame.**

PostgREST caps every response at 1000 rows. No error, no warning, no truncation
flag. Proven on this project rather than assumed:

```
unpaginated select on price_bars (6,575,807 rows) returned: 1000
listings          true count=  8964   rows returned unpaginated=  1000  TRUNCATED
stocks            true count=   867   rows returned unpaginated=   867  ok
index_membership  true count=   765   rows returned unpaginated=   765  ok
```

`stocks` was **133 rows from the cliff**, on a table that grows *by design* —
the universe auto-expands whenever a reader requests a ticker (locked decision
#12). Nothing would have gone red on the night it crossed 1000. Five unbounded
reads, found by the guard, not by reading:

| Where | What would have happened |
|---|---|
| `analytics/cron/daily_refresh.py` | the nightly refresh silently stops enriching the overflow |
| `web/lib/medians.server.ts` | every "vs Sector" figure computed from an arbitrary 1000 |
| `web/lib/index-membership.server.ts` | index baskets quietly lose constituents |
| `analytics/cron/refresh_index_membership.py` | a short read inflates the churn ratio and **skips the write** |
| `web/app/api/cron/purge-accounts/route.ts` | the 1001st due account never purged — and never retried |

The tell is in `daily_refresh.py` itself. Line 84 paginates, with a comment
explaining the cap. Line 489, in the same file, on the same table, does not.
**Whoever wrote the rule down knew it; the rule just wasn't anywhere the second
function could inherit it.**

### Fix

One helper each side — `selectAll()` in `web/lib/supabase/paginate.ts`,
`_select_all()` in `daily_refresh.py` — and a CI guard that fails the build on
any unbounded read of a growing table. `purge-accounts` takes a bounded batch
instead of pagination *on purpose*: it deletes rows as it handles them, which
shifts every later offset, so a self-draining batch is correct where paging
would skip.

---

## D3 — Financial statements labelled with the wrong currency ✅ FIXED

**Severity: medium — a wrong symbol on screen for 9% of the universe.**

`info['financialCurrency']` appeared **nowhere in the codebase**. We stored only
`info['currency']` — the price currency — and used it for everything.

They are not the same thing. Census across the live universe:

| | |
|---|---|
| Checked | 858 |
| **Report in a different currency than they trade in** | **79 (9.2%)** |
| Australian stocks affected | 50 of 250 — **20%** |
| Canadian stocks affected | 27 of 79 — **34%** |

AUD→USD 36 · CAD→USD 27 · AUD→NZD 10 · AUD→CAD 2 · USD→EUR, USD→TWD, AUD→SGD,
AUD→EUR 1 each. BHP.AX trades in AUD and reports in USD. A2M.AX reports in NZD.

Two consequences:

1. **Mislabelled.** Revenue, EBITDA, debt, cash and EPS were rendered with an
   `A$` in front of US dollars, on the Stock Detail page *and* in the
   downloadable report.
2. **Arithmetically wrong.** `fcf_yield_pct = free_cashflow / market_cap` divides
   a **USD** numerator by an **AUD** denominator — off by an exchange rate, ~35%
   for BHP.AX. And it feeds the cash-flow pillar of Financial Health.

### Fix

`financial_currency` is now stored. `statementCurrency(fundamentals)` is the one
place that answers "which currency is this figure in", and `currencySymbol()`
derives the symbol from `Intl` so NZD prints `NZ$` rather than a bare `$`.
`fcf_yield_pct` is **withheld** when the currencies differ rather than published
wrong — the same "withhold, never fabricate" posture the scorer already takes.
`fcf_margin_pct` is kept, because both its inputs come from the statements and
therefore share a currency.

**The whole universe is 7 reporting currencies**, and the symbol for each comes
from `Intl` rather than a hand-written table, so a currency we have never held
cannot arrive unhandled:

| | stocks | renders as |
|---|---|---|
| USD | 595 | `$15.7B` |
| AUD | 200 | `A$15.7B` |
| CAD | 54 | `CA$15.7B` |
| NZD | 10 | `NZ$15.7B` |
| EUR | 2 | `€15.7B` |
| TWD | 1 | `NT$15.7B` |
| SGD | 1 | `SGD 15.7B` |

Two things fell out of actually rendering that table:

* SGD has no glyph in this locale and `Intl` falls back to the bare code, which
  butted against the number as `SGD15.7B`. A space is added when the symbol ends
  in a letter — matching what `Intl` itself does for a full amount.
* **A symbol alone cannot carry this.** In `en-US` the US dollar is a bare `$`,
  so BHP's corrected balance sheet reads `$15.7B` three inches below a share
  price of `A$60.52`, and nothing tells the reader those are different dollars —
  a gap of about A$8B on that one figure. `reportingCurrencyNote()` adds a line
  of text to the statement cards, and only when the two currencies differ:

  > Figures reported in US dollars (USD) — the company's reporting currency, not
  > its share price currency (AUD).

### ⚠️ The fix shipped inert, and only looking at the screen caught it

`financial_currency` was added to the provider, the type, the spec and three
components — and left at `null` on **all 863 rows**, because enrichment is
staleness-driven and would have taken over a week to repopulate. `statementCurrency()`
correctly falls back to the price currency when it is missing, so every page
would have gone on showing `A$` while the code, the tests and the guards all
said the bug was fixed.

Reading the code could not show this. Rendering the page did, in one screenshot.
The field is now backfilled for the whole universe (863 rows, 79 differing).

**The lesson is narrower than "test more".** A guard that asserts *the code asks
the right question* passes happily while *the data has no answer*. When a fix
depends on a new field, the fix is not done until that field is populated —
assert on the rendered figure, not on the function that produces it.

---

## D4 — The nightly pipeline installed whatever was newest ✅ FIXED

**Severity: high, and this is the one that answers "nothing breaks longterm ever".**

Both cron workflows ran:

```yaml
pip install "yfinance>=0.2.40" "pandas>=2.2.0" …
```

For a data pipeline that is **an unreviewed deploy every night**. An upstream
release can change what a number *means*, with no commit, no diff, no review and
nothing red.

That is not hypothetical — it is the documented history of this codebase.
yfinance changed `dividendYield` from a fraction to a percent in a routine
release, and the only record is a comment warning the next person not to
multiply by 100. If that release had landed on a Tuesday night, every dividend
yield on the site would have been **100× wrong** by Wednesday morning, and the
first sign would have been a reader noticing.

It was drifting from development too: **the cron was installing yfinance 1.5.2
while this machine had 1.3.0**, and nothing anywhere recorded either number. The
first unit probe in this audit ran on the wrong version; it was re-run on 1.5.2
before any conclusion was kept.

### Fix

`analytics/requirements-cron.txt` pins the exact set, verified end-to-end on
1.5.2 (raw `info` value printed beside what we store, for every field that gets
scaled). Upgrading is now a deliberate PR with a stated procedure.

And because a pin only helps if you notice what the upgrade did,
`analytics/cron/check_field_units.py` runs after each refresh and emails the
owner when a field's **cohort median** leaves its declared band. Verified live:
39 fields across 863 stocks, no breaches.

---

## D3b — The P/E-history chart divided one currency by another ✅ FIXED

**Found by asking the right follow-up question**, not by the audit sweep: *if the
currency changes, what else needs converting?*

The answer for **scores** is reassuring, and it is a property of the design
rather than luck. Financial Health is built almost entirely from **ratios**, and
a ratio whose numerator and denominator both come off the statements is
currency-free — the units cancel:

| Pillar | Inputs | Safe? |
|---|---|---|
| Profitability | ROE, gross/operating/net margin | ✅ statement ÷ statement |
| Balance sheet | debt/equity, current ratio, interest coverage | ✅ statement ÷ statement |
| Growth | revenue & earnings growth | ✅ percent change within one currency |
| Cash flow | `fcf_margin_pct` | ✅ statement ÷ statement |
| Cash flow | **`fcf_yield_pct`** | ⚠️ **statement ÷ market cap** — the one mixed input, now withheld (D3) |
| Shareholder | payout ratio, share-count change | ✅ ratio / not money |

Cycle maths, the valuation zone and the Overall Rating are all percentages of a
single stock's own price series, so nothing there mixes currencies either.

**But `pe_history` did, and it was on screen.** `_compute_pe_history` divides
prices from the exchange (trading currency) by an EPS row from the income
statement (reporting currency). Yahoo's own `trailingPE` is currency-corrected;
ours was not, so the same page contradicted itself:

| | reports in | Key Metrics P/E | Valuation chart P/E | |
|---|---|---|---|---|
| **ABX.TO** Barrick | USD, trades CAD | 10.1x | **19.2x** | 1.90× |
| **AEM.TO** Agnico | USD, trades CAD | 12.4x | **22.9x** | 1.85× |
| **BHP.AX** | USD, trades AUD | 21.1x | **34.0x** | 1.61× |
| **SHOP.TO** | USD, trades CAD | 114.8x | **160.4x** | 1.40× |
| AAPL · JPM · CBA.AX | same currency | — | — | 1.01–1.17 *(annual-vs-TTM noise)* |

Those same-currency controls matter: they set the noise floor, so 1.4–1.9× is
demonstrably not timing.

**Withheld, not converted** — 79 stocks, 0 charts remaining, 765 untouched. A
single FX rate cannot fix it: rates move 15–30% across the five years plotted, so
the *shape* distorts as well as the level. Doing it properly needs a historical
FX series, which is a feature to decide on, not a patch to slip in. The empty
state now says why, because the default message ("P/E history is building")
promised a chart that could never arrive.

> ⚠️ **A note on the instrument.** The first test written for this compared each
> Yahoo ratio against the same ratio recomputed from raw parts, and reported
> "Yahoo DID convert" for **AAPL** — a company that is US dollars throughout,
> where there is nothing to convert. The gap was annual vs trailing-twelve-month
> earnings. The test could not separate the two effects and its verdicts were
> worthless; only the our-value-vs-Yahoo's-value comparison, with a same-currency
> control, actually discriminated.

## D3c — "Fixed" in one runtime, still live in another ✅ FIXED

Found by signing in as a **subscriber** and reading the report payload — the last
verification step, after everything else was green.

`normalise_fundamentals()` withholds `fcf_yield_pct` when the currencies differ.
It runs in the provider (write) and in `web/api/cycle.py` + `analyze.py` (read).
Both are **Python**. The Key Metrics table is rendered from `web/lib/stocks.ts`,
which is **TypeScript** and does neither — so 73 stored rows still had a
cross-currency FCF yield, and it was still on screen, after the fix was written,
tested, guarded and merged into the branch.

The instinct is to add the same normalisation in TypeScript. That is the wrong
move: it makes the rule exist twice, in two languages, free to drift — the exact
defect CLAUDE.md 11c was written about.

**Assert the invariant on the DATA instead.** `check_invariants()` in
`analytics/cron/check_field_units.py` now fails nightly if any stored row has

* a margin of exactly `0.0` (the sentinel, worth four rating labels), or
* an `fcf_yield_pct` where price and reporting currencies disagree,

which covers **every** reader at once — Python, TypeScript, the report bundle and
anything added later — rather than re-implementing the rule per language and
hoping the copies agree. 73 rows cleared; live run at the time: 39 fields
+ invariants across 863 stocks, clean.

## D3d — The database fixes do not survive the next cron run ✅ FIXED (guard), ⛔ NEEDS THE MERGE

**Every data fix in this audit was applied twice: to the code, and to the 863
stored rows. Only the first of those is durable.** The second was reverted
14 hours later, by our own nightly job, and nothing said so.

`daily_refresh.py:640` writes `"fundamentals": _jsonb(fund_dict)` — a **whole-object
replace**, for every ticker, every night. Whatever the running code produces
becomes the row. And `actions/checkout@v6` in a `schedule`-triggered workflow
checks out the **default branch**, not the branch the fix lives on. So while
PR #77 sits unmerged, each night's refresh rewrites the universe with pre-fix
output.

Measured on the live database at **2026-08-05 03:16 UTC**:

| market | rows | `financial_currency` present | rows with a `0.0` margin | last written |
|---|---:|---:|---:|---|
| au | 250 | **250** | 0 | 2026-08-04 **12:00Z** ← the backfill |
| ca | 79 | **0** | 8 | 2026-08-04 **23:xxZ** ← the cron |
| us | 534 | **5** | 32 | 2026-08-04 **23:xxZ** ← the cron |

The split is exactly the workflow boundary. The US+CA refresh (22:30 UTC, writing
23:36–23:51) ran **after** the backfill and undid it for its 608 rows; the AU
refresh (08:00 UTC) ran **before** and its 250 rows survived — until 08:00 UTC
the next morning.

Confirmed on screen, signed in as a subscriber against the fixed branch: JPM's
Key Metrics table showed **Gross Margin 0.0%**, `−47.3pp` against its sector.
Note what did *not* break — Overall Rating 63/100 and Health Score 93/100 were
still correct, because `/api/cycle` normalises on read. **The scores are
defended by code; the Key Metrics table is defended only by the data being
clean.** That is D3c's asymmetry, seen from the other side.

### The instrument was blind, which is worse than the bug

Run against that same broken universe, `check_invariants()` reported **zero**
cross-currency `fcf_yield_pct` violations. Not because there were none — because
the field the test reads had been wiped, so every affected row was
*unmeasurable* and unmeasurable counted as clean.

A third invariant now covers it: `financial_currency` missing on more than **5%**
of rows is itself a breach, named as "what a refresh running pre-fix code looks
like". A proportion rather than an absolute, because a few tickers genuinely lack
`financialCurrency` upstream and a check that cries wolf gets ignored. Broken on
purpose both ways (threshold `0.0` → the cry-wolf test fails; `0.99` → the
wholesale-loss test fails) before being trusted. Against the live data it fires:

```
financial_currency: missing on 608 of 863 row(s) (70%) — the cross-currency
checks cannot run on those, so they PASS without being tested.
```

The nightly log now prints the invariant **names** rather than a count, because a
count goes stale silently the moment a rule is added — this repo has already paid
for that once, when the entitlement guard printed "14 checks" over 11 sections.

### What this means operationally

* **Merging is not cosmetic — it is what makes the data fixes permanent.** Until
  then every night re-breaks 608–863 rows.
* **No re-backfill is needed after the merge.** The refresh rewrites every row
  from the provider anyway, so the first post-merge run repairs the universe as
  a side effect. Backfilling before merging would just be undone again.
* **Nothing a customer sees is wrong in a new way**: this is the pre-audit
  behaviour, which is what the site has always shown.

### The P/E chart now has two controls, not one

Withholding `pe_history` at the source protected the chart only for as long as no
cross-currency series was ever written — and 14g is precisely the mechanism that
writes one. Worse, `ValuationHistory` consulted `unavailableReason` **only when
the series ran out of points**, so a stale five-year series would have rendered
as an ordinary chart with the explanation suppressed.

The draw decision is now gated on `!unavailableReason` first. Proven in the
browser against a fixture pair, because the scenario cannot be built from real
data (every affected row is already empty):

| fixture | stored series | result |
|---|---|---|
| cross-currency (CAD price / USD earnings) | 5 points | **refused**, reason shown |
| same-currency control | the same 5 points | **chart drawn** |

The control is what makes it evidence rather than a component that never draws.
Removing the gate flipped the first case to a rendered chart with no warning —
the failure mode itself, reproduced. Guarded in CI by section C of
`check-data-integrity.mjs` (53 → **55 checks**), broken on purpose first.

### D4 was fixed in two of three workflows

Same session, same family: `analytics/requirements-cron.txt` was wired into
`daily-refresh.yml` and `daily-refresh-au.yml`, but **`weekly-enriched-refresh.yml`
kept the old unpinned `yfinance>=0.2.40` floors** — the CLAUDE.md 11c trap, a
rule fixed in two places and a third surface opting out by not being in either
list. It matters more there, not less: `--mode full` rewrites enriched data for
the entire universe in one run. Now pinned.

**Listed, not changed:** the CI job at `.github/workflows/ci.yml:168` installs the
same unpinned floors. That is a test environment rather than a data-writing
pipeline, so the blast radius is different — but it does mean a green CI does not
prove the *pinned* pipeline works, and an upstream release can redden untouched
code (which ruff has already done here once). Owner's call.

## D5 — 52-week high/low are on a different price basis than the chart ✅ OWNER DECIDED: LEAVE AS IS

`week52_high` / `week52_low` come from `info` as **raw traded prices**. Our
`price_bars` are **dividend-adjusted** (`auto_adjust=True`), so every historical
bar sits below the price actually traded that day.

| Market | Median gap: our 252-bar max vs the stated 52-week high | Stocks >3% below |
|---|---|---|
| AU | **−2.37%** | 99 of 250 |
| US | −1.53% | 92 of 534 |
| CA | −0.97% | 9 of 79 |

Australia is worst because Australian yields are highest. For 99 ASX stocks the
price chart **never reaches** the 52-week high shown next to it.

**The gauge itself is correct, and reading it settled the question.**
`WeekRangeGauge` computes `off high` as `(current − week52High) / week52High`.
Auto-adjustment leaves the *latest* bar untouched, so `current` is the real
traded price and `week52High` is the real traded high — same basis, both raw.
The percentage beside the bar is right.

The mismatch is confined to the *historical* chart line, which is
dividend-adjusted so that returns are comparable across time. That is the
correct thing for a chart to do, and it is why the drawn peak can sit a couple
of percent under the printed 52-week high.

**Owner decision, 2026-08-05: leave both exactly as they are.** Deriving our own
52-week high from adjusted bars would make the page internally tidy at the cost
of disagreeing with Yahoo, Google and every broker on a number readers routinely
cross-check. Do not "fix" this in a later session.

---

## D6 — 46 bars carry an OHLC that cannot be true ⚠️ ACCEPTED

64,782 bars have a close outside the high/low range. Almost all are nothing:

| | |
|---|---|
| Breach >0.01% of price | **46** |
| Breach >1% | 20 |
| Everything else (64,736) | float32 rounding — median breach **0.0000%** |

Yahoo serves prices as float32; widening to float64 leaves an eight-decimal tail
(`0.02999899908900261` for a stock that traded at 3.0¢). Invisible on screen,
because every display path rounds — but it is why a `close = high` comparison
fails on a stock that only traded at one price all day.

The 46 real ones are Yahoo's own data on thinly-traded penny stocks
(FFM.AX 2018-09-20: O=H=L=0.030, close 0.037). Worth knowing about:
`_download_yfinance` forward-fills O/H/L over gaps while keeping that day's
close, which can *manufacture* an inconsistent candle rather than just passing
one through.

Not fixed: no user-visible effect, and the cycle maths uses `close` and `low`
independently rather than the candle as a unit. Recorded so the next person
finding it in a query knows it has been looked at.

---

## D7 — `rel_strength_vs_sp500` compares Australian stocks to the S&P 500 ℹ️ INERT

`SandP52WeekChange` is the same value for every ticker — 18.90% today, including
BHP.AX, CBA.AX and RY.TO. So the stored "relative strength" of an ASX stock is
measured against **the S&P 500**, not the ASX 200. CBA.AX's +0.3% year reads as
−18.6% relative, which is a statement about two different economies.

**Harmless today: the field is stored and never rendered.** It appears in the
Python dataclass, the TypeScript type and the docs, and in no component.

Left in place, with a warning in the field spec: if it is ever surfaced, it needs
a per-market benchmark first. We already hold `^AXJO` and `^GSPTSE` for the
Relative Performance chart, which does this correctly.

---

## Verified clean

Not everything checked was broken. Recorded so the next audit doesn't repeat it:

- **Units, end to end on yfinance 1.5.2** — `dividendYield` percent (0.35 vs
  0.353 derived independently), `payoutRatio` fraction ×100, `debtToEquity`
  ÷100 to a multiple, `heldPercentInstitutions` fraction ×100. All correct.
- **Bar integrity** — 0 weekend-dated bars, 0 future-dated, 0 non-positive
  closes, 0 null volumes, 0 highs below lows, across 6.5M rows. The
  2026-08-04 ASX fix is holding.
- **No field is 100% null.** `pegRatio` still populates (85.7%) — worth
  re-checking after any yfinance bump, since it is the field most likely to be
  dropped upstream.
- **Display transforms** — `format.ts` is consistent with the stored units, the
  compact formatter picks its own magnitude so a small company never renders
  `$0.0B`, and `fmtCapped` already exists for absurd-but-real values.
- **Peer-median outlier bounds** already mirror the display caps.

---

## Guards added

Each was **broken on purpose** and the failure text read, not just the exit code
— a red run is not automatically red for your reason.

| Guard | Catches | Broken how |
|---|---|---|
| `analytics/tests/test_field_spec.py` (14 tests) | a fundamentals field added with no declared unit; the margin sentinel being read as real; FCF yield published across a currency mismatch | 3 ways — each named the right test |
| `analytics/tests/test_check_field_units.py` (14 tests) | the cohort tripwire failing to fire; a stored margin sentinel; a cross-currency FCF yield; **a wholesale loss of `financial_currency`** | drove the real `dividendYield` regression through it, and broke the coverage threshold **both** ways (`0.0` → the cry-wolf test fails; `0.99` → the wholesale-loss test fails) |
| `analytics/tests/test_pe_history_currency.py` (4 tests) | a P/E series built across a currency mismatch | — |
| `web/scripts/check-data-integrity.mjs` (**55 checks**) | an unbounded read of a growing table; a statement figure labelled with the price currency; **the P/E chart's currency gate being removed** | 5 ways, incl. a vacuous scan that passed while covering a third less code |
| `analytics/cron/check_field_units.py` | a provider changing a field's units, live; three per-row invariants whose **names** it prints | — runs nightly, emails the owner; verified against the genuinely-broken universe of 2026-08-05 |
| `web/e2e/report-download.spec.ts` | the **downloaded** report failing to render at all | removed the bundle shim → *"never mounted — the customer gets a blank page. Uncaught: ReferenceError: process is not defined"*; deleted the bundle → *"report.js is missing"* |

Two of those breaks are worth keeping:

**The threshold that was wrong.** `check_field_units` prints a hint naming the
likely cause. Written with a 50× threshold — and the test for the actual
`dividendYield` regression showed the hint never firing, because a median of
0.024 against a lower bound of 1.0 is a ratio of 42, not 100. The band has
width; the miss measured against its edge is smaller than the error. Now 20×.
**The guard was right and its explanation was useless, which is a failure mode
worth having a test for.**

**The scan that stopped looking.** `check-data-integrity` asserts it found files
before trusting a clean result. The first version checked only the *total*: when
the break harness pointed `app/` at a nonexistent directory, `lib/` and
`components/` still cleared the floor and the guard reported **OK while covering
a third less code**. Each root now carries its own floor. A scan that quietly
narrows is precisely the failure it exists to catch.

Also hardened: the `_engine` drift check in `ci.yml` **derives** its file list
from the directory instead of hardcoding six paths — the hardcoded list would
not have covered the `field_spec.py` added by this audit, and nothing would have
said so.

---

## What is now true

| Rule | Stated once in | Enforced by |
|---|---|---|
| What every fundamentals field means | `analytics/providers/field_spec.py` | `test_field_spec.py` + `check_field_units.py` |
| Which currency a statement figure is in | `statementCurrency()` in `web/lib/format.ts` | `check-data-integrity.mjs` |
| How to read a growing table | `selectAll()` / `_select_all()` | `check-data-integrity.mjs` |
| What the pipeline runs on | `analytics/requirements-cron.txt` | pinned; upgrade is a PR |
| A daily bar's date is the exchange's own | `data-contracts.md` `PriceBar.date` | `test_no_utc_date_conversion.py` |
| Ticker → market | `MARKET_SUFFIXES` in `web/lib/ticker.ts` | `test_market_inference.py`, `ticker-routing.spec.ts` |

---

## Gates

| | Before | After |
|---|---|---|
| `pytest analytics/` | 121 | **153** |
| Playwright e2e | 115 | **116** |
| `pnpm check:data-integrity` | — | **55 checks** |
| `check_field_units` (live) | — | **39 fields + 3 named invariants / 863 stocks** |
| `_engine` drift | 6 hardcoded | **7 derived** |
| `pnpm typecheck` · `pnpm lint` · `pnpm build` | clean | clean |

Read the counts, not the colours.

---

## What this audit did NOT cover

Recorded because the gap is the useful part, and because four defects on this
day were invisible to every automated check and surfaced only when a finished
artifact was opened and looked at — three by rendering pages, and the blank
downloaded report **by the owner asking the right question**. The guards are
good at holding *known* failures and poor at finding *new* ones.

> ✅ **Four of these were closed on 2026-08-06** — see § *Follow-up session* at the
> end of this file. The table below is left as written so the gap and its closure
> can both be read; each closed row says so.

| Not covered | Consequence |
|---|---|
| ~~**Every surface as a FREE (unentitled) account**~~ ✅ **CLOSED 2026-08-06** | All verification was done as a *subscriber*. The paywall and these data changes interact and only one side has been seen. **The largest remaining gap.** |
| **A per-stock cross-check** of our figure against the provider's own independently-derived one | `check_field_units` watches **cohort medians**, so it catches a provider changing a field's units for *everyone* and is blind to *one* stock being wrong. Demonstrated, not assumed: a synthetic universe with a single 100×-wrong dividend yield produces **0 breaches**; the same error applied to all 40 is caught. This is the comparison that exposed D3b — run by hand, once. |
| ~~**The exported `.xlsx` cells**~~ ✅ **CLOSED 2026-08-06 — and it found a defect** | Verified only as a well-formed file (correct MIME, `PK` zip magic, 8.6 KB) built from rows checked in the CSV. Never opened in a spreadsheet. |
| ~~**`/account`, `/request`, the Sentiment tab, the remaining detail tabs**~~ ✅ **CLOSED 2026-08-06** | Untouched. |
| **375px / mobile** | Owner-deferred to Layer H. |
| **859 of 863 stocks individually** | Four were checked by eye; the rest rest on the automated rules above. |
| **`ci.yml` still installs unpinned `yfinance>=…`** for the test job | Listed, not changed (§ D4 fixed the three *data-writing* workflows). A green CI therefore does not prove the **pinned** pipeline works, and an upstream release can redden untouched code — which ruff has already done here once. |

**Six fields have no median band at all** — `analyst_target_price`,
`analyst_low_price`, `analyst_high_price`, `week52_high`, `week52_low`,
`rel_strength_vs_sp500`. The first five are per-share prices spanning roughly
$0.30 to several hundred dollars across the universe, so a single median band
would be meaningless rather than merely loose; the last is deliberately never
displayed (D7). Their units are still declared in `field_spec.py` and still
enforced by `test_field_spec.py`.

---

## ⏸ DEFERRED — the per-stock number check

**Status: not built. Owner-scheduled 2026-08-06 to be picked up after the
remaining layers.** Recorded here in full so the next session does not have to
re-derive it.

### What it is, in one sentence

For each stock individually, take a number we publish, compute the same number
a second time from a different starting point, and complain when the two
disagree by more than a set tolerance.

### Why the checks we already have cannot do this

Three instruments exist and each one is blind to a *single* wrong stock:

| Instrument | What it actually watches | Blind to |
|---|---|---|
| `field_spec.py` + `test_field_spec.py` | that every field **declares** a unit | whether the stored value obeys it |
| `check_field_units.py` — the nightly cohort tripwire | the **median** of ~860 stocks staying inside a declared band | one stock being wrong; the median does not move |
| `check_invariants()` | three **structural** rules (a `0.0` margin sentinel, a cross-currency FCF yield, `financial_currency` coverage) | a number that is structurally fine and numerically wrong |

This was demonstrated rather than assumed: a synthetic universe with a single
100×-wrong dividend yield produces **0 breaches**; the same error applied to
all 40 rows is caught immediately. A wrong number is still a *plausible*
number, which is exactly why neither review nor the type checker sees it.

### The shape of the check

The principle is **two independent derivations of the same quantity**. Each
row below has a figure we compute or store and a figure the provider supplies
having derived it its own way, so agreement is real evidence and disagreement
names the stock:

| Our figure | The independent one | Why they should agree |
|---|---|---|
| `pe_ratio` (Key Metrics) | `info['trailingPE']` | Yahoo's is currency-corrected; ours was not — **this exact comparison is what exposed D3b**, run by hand, once |
| last close in `price_bars` | `info['currentPrice']` / `regularMarketPrice` | different endpoints; a stale or mis-dated bar shows up as a gap |
| `market_cap` | `currentPrice × sharesOutstanding` | catches a price/shares unit mismatch |
| `dividend_yield_pct` | trailing 12m dividends ÷ price, from the dividend history | the ×100 class of error, per stock |
| `fcf_yield_pct` | free cash flow ÷ market cap, recomputed from the statements | the cross-currency class (D3), per stock |
| `week52_high` / `week52_low` | max/min close over the trailing 252 bars | a basis mismatch — expect a **known ~2% gap** here by design (D5), so this row is a *report*, never a failure |

### How it must be built, given what this audit learned

1. **Tolerance in percent, not equality.** Rounding, adjusted vs unadjusted
   closes and different as-of timestamps all produce small honest differences.
   Start loose (say 5%), then tighten once the real spread is measured — a
   check that cries wolf gets ignored, which is worse than no check.
2. **Report the stock, not a count.** The whole point is naming which one. The
   nightly log already prints invariant **names** rather than a total for the
   same reason (D3d).
3. **Assert coverage as well as agreement.** A stock missing the comparison
   field must count as *unmeasured*, never as *passing* — D3d's guard reported
   zero violations precisely when the universe was most broken, because the
   field it read had disappeared.
4. **Run it nightly beside `check_field_units.py`**, emailing the owner, and
   **pin the provider** — an unpinned upgrade changes both sides at once.
5. **Break it on purpose first.** Corrupt one stock's `pe_ratio` in a fixture
   and confirm the check goes red naming that ticker, before trusting a green.

### Rough size

About half a session. `analytics/cron/check_field_units.py` already supplies
the loading, the paginated read, the reporting shape and the email path, so
this is a second module beside it rather than new machinery.

---

# Follow-up session — 2026-08-06

Closing follow-ups **1, 3 and 4** from the list above. All work was done against
**production** (`www.majorcycle.com`), never a preview, using throwaway accounts
whose entitlement state was set directly in `profiles` — which is exactly the
input the rendering reads (`lib/entitlement.ts`). Every account was deleted in a
`finally`. The shared E2E login was never touched.

### 👉 START HERE NEXT TIME

**Three more findings, D8–D10.** Two fixed, one open. Ordered by what a future
audit should care about, which is *not* the order they were found:

| | Finding | Status | The transferable lesson |
|---|---|---|---|
| **D9** | **The alarm that reports every other guard had never worked** — dead API key *and* code that cannot see a rejected send | ✅ fixed | **Break the notifier on purpose, not just the guard.** Silence was both the failure state and the healthy state |
| **D10** | **SanDisk dropped nightly by a `NaN` on the way to the database**, behind two silencers — scheduled after Layer G | ⚠️ **OPEN** | A dead alarm costs real defects, not just comfort. ⚠️ Also: *"4 failed" was 1 defect + 3 companies not yet trading* — read the traceback, not the summary line |
| **D8** | The `.csv` and the `.xlsx` of one run disagreed by a cent | ✅ fixed | When the duplicated rule is an *algorithm*, sharing a constant isn't enough — make one consume the other's output |
| **D11** | **A partial refresh failure is silent** — needs a threshold, not "any failure is red" | 🔵 **OPEN DECISION** | An alarm that cries wolf nightly is ignored in a fortnight, and then *looks* like coverage |

**Then re-run these three checks**, each of which found something this time:

1. **Fire the alarm deliberately** — the recipe is in D9. Do this *first*; if it's
   dead again, nothing else you conclude can be trusted.
2. **Ask the data how many cases exist** before believing you have covered them.
   The previous audit checked four reporting currencies; there are **seven**. It
   had counted the ones it happened to meet.
3. **Open the finished artifact**, don't inspect the code that makes it — the
   downloaded report, the `.xlsx` *cells*, the rendered page. Every defect on
   2026-08-05 and D8 here were found that way and by nothing else.

### ⚠️ Housekeeping left behind by D9 — decide, don't inherit

Deliberately not done, because each is a decision rather than a cleanup:

✅ **All done the same day.**

| Item | Outcome |
|---|---|
| `RESEND_API_KEY` · `OWNER_EMAIL` GitHub secrets | **Deleted by the owner.** Six secrets remain, none Resend-related — confirmed on the settings page |
| `check_field_units._email()` + `--email` | **Deleted** |
| `daily_refresh._send_failure_email()` | **Deleted**, with all **four** of its call sites |
| `notify_on_failure` plumbing | **Deleted** — the parameter and both callers that passed it |
| Env lines in the workflows | **Deleted** — 12 across three files |

> ⚠️ **There were FOUR call sites, and the first pass removed one.**
> `_send_failure_email` also lived in `refresh_index_membership` and
> `refresh_listings`. An instruction applied to one surface and not its
> siblings is **exactly rule 11c** — committed, as it happens, while writing the
> document that explains rule 11c. The owner caught it.
> **Grep for the function, not for the feature.**

**Nothing changed operationally.** Every one of those paths was already dead: the
key had not existed since 2026-07-02. Removing them stops the code *claiming* an
alert that isn't there — it does not remove an alert that was working.

## D8 — The `.csv` and the `.xlsx` of one run disagreed by a cent ✅ FIXED

**This is the defect that opening the cells produced**, and it is the reason the
follow-up existed: the file had been checked as a *file* (valid zip, right MIME,
right size, built from rows verified in the CSV) and never as *cells*.

Barrick's analyst target, one screener run, three surfaces:

| Surface | Figure |
|---|---|
| the Stock Detail page | **CA$65.76** |
| `Download Excel` | **65.76** |
| `Download CSV` | **65.75** ✗ |

### Cause

One number, three rounding rules — the shape 11c warns about, with a third copy:

| | rule | 65.755 | 1.005 |
|---|---|---|---|
| screen | `Intl.NumberFormat` | 65.76 | 1.01 |
| `.csv` | `value.toFixed(2)` | 65.75 ✗ | 1.00 ✗ |
| `.xlsx` | `Math.round(v * 100) / 100` | 65.76 | 1.00 ✗ |

`toFixed` and `Math.round` both round the **binary double**, which sits a hair
below a half-cent; `Intl` rounds the decimal the reader is actually shown. So the
CSV parts company on one set of values and *both* exports part company from the
page on another. Measured: **~4.3% of values carrying a third decimal**.

Nothing was red, and `lib/ratings.ts` carried a comment asserting the two files
"always show identical figures" — a documented invariant that had never been true.

### Fix

`exportText` now formats with the **screen's** `Intl` (`useGrouping: false`, so a
CSV field carries no comma and an Excel cell stays parseable), and `lib/xlsx.ts`
derives its cell **number** by parsing that same string rather than rounding a
second time. One rule, one place; the workbook cannot drift from the CSV because
it is downstream of it.

### Guard

`web/e2e/export-parity.spec.ts` — pure and credential-free, so it can never
silently skip. It imports both real functions rather than re-implementing either
(a fourth copy of the rule is the thing being guarded against). Broken on purpose
three ways before being trusted, each failing on the exact value:

| Break | Failure |
|---|---|
| CSV back to `toFixed(2)` | `value 65.755 vs the screen — Expected "65.76", Received "65.75"` |
| workbook rounding independently again | `value 1.005 as num2 — Expected "1.00", Received "1.01"` |
| `useGrouping: false` removed | `value 1234.565 — Expected "1234.57", Received "1,234.57"` |

### Verified live after the merge

Same screener run, exports downloaded from production again: the CSV now reads
`65.76`, and a **cell-by-cell comparison of all 152 cells against the CSV
produced 0 mismatches.**

---

## D9 — The alarm that tells us any of this went wrong had never worked ✅ FIXED

**Severity: the highest in this document, because it is the finding that hides
every other finding.**

Every guard in this audit ends the same way: *"…and it emails the owner."* On
2026-08-06 that sentence was tested for the first time, by deliberately breaking
both crons on `main`. Both went red with the correct message. **Resend recorded
nothing** — no bounce, no rejection, no such message. It had never sent one in
the project's life: 42 messages in the account since July, not one from a cron.

### Two independent faults, and the design could report neither

| # | Fault | Why nothing showed |
|---|---|---|
| 1 | **The API key does not exist.** Resend holds exactly one key, `supabase-smtp`, created **2026-07-02**. The `RESEND_API_KEY` GitHub secret was created **2026-05-24** — five weeks earlier, so it holds a key since deleted. | A 401 is a *response*, not an exception |
| 2 | **`_email()` never inspects the response.** `requests.post` does not raise on 4xx, and the `except` clause catches only transport errors. | A rejected send returns normally, logs nothing, and is byte-for-byte indistinguishable from a delivered one |

⚠️ **The app was never affected.** Vercel holds its own `RESEND_API_KEY`, updated
when the domain was set up; billing and auth mail delivers normally. **Only the
GitHub copy went stale** — which is precisely why it went unnoticed: the obvious
sanity check ("is Resend working?") answers *yes*.

### Why it was undetectable rather than merely undetected

This is **D3d's lesson one layer up**, and worth stating in its own words:

> The instrument read *nothing*. *Nothing* was also the expected reading on a
> healthy night. So the failure state and the success state produced identical
> evidence, and no amount of looking could separate them.
>
> **An untested alarm is a belief, not a safety net.** This project already
> breaks every new *guard* on purpose before trusting it. It had never done that
> to the *notifier*.

### Fix

The alert is now **GitHub's own failed-workflow email**, and nothing else:

- `continue-on-error: true` removed from the units check in **both** crons, so a
  data problem fails the run.
- `--email` and the two Resend secrets removed from both check steps.
- Destination is **visible** rather than sealed in a write-only secret —
  GitHub Settings → Notifications shows `ayaatnibrasaziz@gmail.com` with Actions
  set to *"Failed workflows only"*. **GitHub secrets cannot be read back after
  creation, by anyone including the owner**, which is the structural reason a
  visible channel beats a configured one.
- Cost: **$0**. Actions minutes are unlimited on a public repo and notifications
  are free on every plan.

### 🔁 How to re-test it (do this in every future audit)

The whole point is that this decays silently. Repeat it:

1. Branch, and bend one band to something impossible **in the workflow command**,
   not in `field_spec.py` — a unit test correctly pins the real band, so editing
   the spec turns CI red for the wrong reason:
   ```yaml
   run: |
     python - <<'EOF'
     import dataclasses, sys
     from analytics.providers.field_spec import FUNDAMENTALS_SPEC
     from analytics.cron import check_field_units as C
     FUNDAMENTALS_SPEC["dividend_yield_pct"] = dataclasses.replace(
         FUNDAMENTALS_SPEC["dividend_yield_pct"], median_band=(100.0, 200.0))
     sys.exit(C.main([]))
     EOF
   ```
2. Merge it — `workflow_dispatch` runs the **default branch** (14g), so it cannot
   be tested from a branch.
3. `gh workflow run daily-refresh-au.yml --ref main` — the AU cron is the short
   one, ~7 minutes. Confirm **failure**, and read the log to confirm it failed
   for the *right reason*.
4. **Confirm the email actually arrived.** This is the step that has no substitute.
5. Revert, re-run clean, confirm **green** and `OK — every median is where it
   should be`.

Expected messages, for comparison next time:

```
BROKEN:  dividend_yield_pct: median 2.34 is outside the expected [100, 200] over 666 stocks
           <-- looks like a FRACTION where a percent is expected (x100 missing)
CLEAN:   39 field(s) checked across 864 stocks; invariants: zero-margin sentinel,
         cross-currency fcf_yield_pct, financial_currency coverage
         OK — every median is where it should be
```

---

## D10 — SanDisk is dropped every night by a NaN on the way to the database ⚠️ OPEN

**Found only because D9's alarm was being tested.** It is the concrete proof that
a dead notifier costs real defects, not just peace of mind.

> ⚠️ **CORRECTED 2026-08-06.** This section first said *"four S&P 500 companies
> missing, basket resolves to 499 of 503"*. That was written from the summary
> line (`Failed tickers (4)`) without reading the traceback under it. **Reading
> it showed two unrelated causes, and only one of them is ours.** The error is
> recorded rather than quietly edited because it is the same mistake this whole
> audit is about: a plausible number, taken at face value, not checked against
> the thing it claims to describe.

### Three of the four are NOT a defect

`FDXF`, `HONA` and `Q` fail with *"all data sources failed"* — no traceback, no
crash. Looked up in our own `listings` table, they are **announced spin-offs that
have not started trading**:

| Ticker | Company | Exchange |
|---|---|---|
| `FDXF` | FedEx Freight Holding Company, Inc. | NYSE |
| `HONA` | Honeywell Aerospace Inc. | NASDAQ |
| `Q` | Qnity Electronics, Inc. | NYSE |

The S&P constituent list names upcoming members before they list, so the provider
correctly has no price history. **The pipeline tried, found nothing, and invented
nothing** — the right outcome. They will arrive by themselves once they trade.
*(Worth remembering next time this list is read: "N failed" is not "N broken".)*

### One of the four IS our defect — SanDisk

```
SNDK | enriched | market=us | sector=Technology | bars=369
SNDK: unexpected error: Out of range float values are not JSON compliant: nan
  File "analytics/cron/daily_refresh.py", line 714, in run
    supabase.table("stocks").upsert(stock_row, on_conflict="ticker").execute()
```

Read those two lines together: **the fetch succeeded.** 369 bars, sector
resolved, enrichment done — and then it died on the *write*. A `NaN` reached the
HTTP layer, which refuses it (correctly: `NaN` is not valid JSON).

| | |
|---|---|
| Real consequence | the screener's S&P 500 basket resolves to **502 of the 503 that exist**, and SanDisk never appears in Browse |
| Why SanDisk | a recent spin-off has genuinely blank cells in its statement history, where an established company has numbers |

### Cause — the cleaner doesn't clean the one thing that breaks the write

```python
def _jsonb(obj: Any) -> Any:
    return json.loads(json.dumps(obj, default=str))
```

**`json.dumps` permits `NaN` by default** — it emits a bare `NaN` token, which is
invalid JSON, and `json.loads` reads it straight back. So the round-trip is a
**no-op for exactly the value that breaks the save**: the function looks like a
sanitiser, and passes the problem through untouched until `httpx` rejects it and
the whole stock is dropped.

The provider *does* have a real cleaner — `_safe()` in `yfinance_provider.py`
turns `NaN`/`inf` into `None` — but it is applied to individual scalar
fundamentals, not to the statement blobs.

### Fix (planned — **owner-scheduled for after Layer G**)

**In `_jsonb`, not at the call site.** It is the single funnel every blob passes
through — `fundamentals`, all six statement blobs, `news`, `earnings_history`,
`top_holders`, `insider_transactions`, `analyst_upgrades_downgrades`. Teaching it
to map `NaN`/`inf` → `None` fixes all of them at once and every future one, which
is the same "one rule, one place" that D8 and 11c are about. Patching SanDisk's
particular field would just move the crash to the next spin-off.

⚠️ **While in there, check the sibling weakness:** `default=str` silently turns
anything non-serialisable into a **string**, so a `numpy.int64` would be stored as
`"123"` rather than `123`. Not observed causing harm, but it is the same shape —
a fallback that converts a problem into a plausible-looking wrong value.

Then, per this project's own rules:

1. **Break it on purpose first** — a fixture blob carrying a `NaN`, red before the
   fix and green after.
2. **Re-run the cron and confirm SanDisk actually lands in `stocks`** — assert on
   the row, not on the function (14d: a fix that ships inert still reads as done).
3. Fold in **D11**, which is what would have reported this in the first place.

Rough size: about an hour including the test.

---

## The free tier, walked end to end ✅ NOTHING FOUND

Nine surfaces as an account with no subscription. Every claim of absence carried
a positive control in the same read (§15).

| Surface | Result |
|---|---|
| `/stocks`, three Stock Details, `/run`, `/results`, `/account`, `/request` | 200, **zero** of the nine premium fields anywhere in the HTML |
| `/pricing` | redirects a signed-in reader to `/account` — deliberate (F-A4-c) |
| `GET …/report` | **402** `private, no-store`, `reason: no_subscription` |
| `POST /api/analyze` | **402** `private, no-store` |
| uncaught JS errors across the walk | none |

The free reader keeps the price chart, drawdown with bands, technicals, analyst
targets, relative performance, earnings, quarterly financials, valuation history,
balance sheet, dividends, Key Metrics, insider activity, analyst rating changes,
short interest and news — and sees `Unlock` in place of the Overall Rating and
Health Score, with a short pitch where the Verdict and Scorecard would be. That
is the F3 Step 10 rule rendering exactly as written.

**The data-audit fixes render correctly for a free reader too** — which was the
actual question, since the paywall strips fields and the currency work adds them.
BHP and ABX both show the reporting-currency sentence, both withhold the P/E
history with a plain-English reason, and both omit the FCF Yield row that AAPL
shows. The withholding survives into the CSV and the workbook as blank cells.

**The 25-stock daily fence** was driven to its limit: the 26th distinct stock
shows an honest explanation naming the reset time and confirming already-opened
stocks still work; a stock already counted today opens normally and writes nothing.

## The subscription-state matrix on live ✅ NOTHING FOUND

Eleven states × four surfaces. Entitled states show the real rating and carry all
nine premium fields; unentitled states show `Unlock` and carry **zero**.

⚠️ **Measured 2026-08-06; the `reason` column has since moved.** Audit F-005 (2026-08-23)
found that four of Stripe's eight statuses — `incomplete`, `incomplete_expired`, `unpaid`,
`paused` — all reported `no_subscription`, telling a reader whose subscription was *stuck*
that they did not have one. The **access decisions in this table are unchanged and were
always right**; only the reason string moved. Today: `paused` → `subscription_paused`,
`incomplete`/`incomplete_expired` → `setup_incomplete`, `unpaid` → `payment_failed`.

| State | Badge | Rating | Screener | `…/report` |
|---|---|---|---|---|
| no subscription | NO PLAN | locked | locked | 402 `no_subscription` |
| trialing | TRIAL ACTIVE | shown | open | 200 |
| active | ACTIVE | shown | open | 200 |
| active, cancelling at period end | ACTIVE | shown | open | 200 |
| past_due inside grace | PAYMENT DUE | shown | open | 200 |
| past_due, grace expired | ACCESS PAUSED | locked | locked | 402 `payment_failed` |
| canceled | CANCELLED | locked | locked | 402 `canceled` |
| `paused` (unreachable — see below) | NO PLAN | locked | locked | 402 `no_subscription` → **`subscription_paused` since 2026-08-23** |
| dispute lock on an ACTIVE sub | ON HOLD | locked | locked | 402 `billing_blocked` |
| dispute LOST (cancelled + blocked) | ON HOLD | locked | locked | 402 `billing_blocked` |
| deletion scheduled on an ACTIVE sub | — | confined | confined | 403 `account_deleting` |

Every response — including every refusal — sends `private, no-store`. The two
`billing_blocked` states offer **Contact support** rather than an upgrade, which
is the right refusal: we do not sell to someone whose payment is being clawed
back. Deletion confinement outranks entitlement, sending an *entitled* account to
`/reactivate` from every `(app)` route.

> **`paused` cannot occur.** `mapStripeStatus` translates Stripe's `paused` to
> `null`, and the only production writers of `subscription_status` are that
> function plus three literal `'canceled'`/`'active'`/`'past_due'` writes in the
> webhook. Typing `paused` in by hand proves the half that matters: an
> **unrecognised** status locks. Already pinned by `entitlement.spec.ts`.

## ⚠️ Open, owner's decision — the Results table shows one `$` for three currencies

`formatValue`'s `money2` / `money0` hardcode a bare `$` (`components/results/columns.ts`),
so one screener run rendered `$309.38` (USD), `$62.54` (AUD) and `$53.74` (CAD) in
the same sortable column. The `Close` and `Analyst Target` columns of both export
files carry no currency column at all.

Not incorrect — the values *are* in each stock's home currency, the `Market`
column sits beside them, and the column tooltip says "in the stock's home
currency". But it is the same shape as 14d: *a symbol alone is not enough.*
Everywhere else is careful (`A$`, `CA$` throughout the detail pages).

> **It also breaks a rule we had already written down**, which is the part worth
> noticing. `design-system.md` § *Price formatting* says, in bold: **"Never
> hand-roll `Intl`/`currencySymbol`/hardcoded `$` in a component"** — and gives
> the reason from the last time it happened: *"that drifted into `C$` vs `CA$`
> and `$1.71` for AUD."* `formatValue` in `components/results/columns.ts` is
> exactly a hand-rolled hardcoded `$`. So this is not an unconsidered design
> choice, it is a **known-bad pattern that survived because nothing enforces the
> rule** — the rule lives in prose in the design system and in no check. Whoever
> picks this up should fix it by routing the money formats through
> `web/lib/format.ts` (which is currency-aware) rather than by adding a symbol
> lookup beside the existing one, and should consider whether
> `check-data-integrity` can assert the prohibition so prose isn't the only
> guard. Found 2026-08-06 while reconciling the docs against the code, *after*
> the owner had already deferred the fix — the deferral stands, but it is now an
> informed one.

**⏸ OWNER DECISION 2026-08-06, taken with the table on screen: leave it, revisit
later.** Not a bug to fix now. It is a design decision about a deliberately-built
table, and adding per-row symbols does not make a mixed-currency numeric sort
meaningful either. Three options when it is picked up:

1. **A symbol per row** — `A$62.54`, `CA$53.74`. Easiest to read; does nothing
   for the sort.
2. **A Currency column**, in the table *and* both export files. Least pretty,
   most honest, and the only one that survives leaving the website — a tooltip
   does not travel into a spreadsheet. **Recommended.**
3. **Leave it**, on the grounds that the `Market` column and the tooltip already
   disclose it.

Affected surfaces, so none is missed later: the Results table's `Close` and
`Analyst Target` columns (`formatValue` in `components/results/columns.ts`), the
mobile result cards (`CardStat label="Close"`), and the same two columns in the
`.csv` and `.xlsx` exports, which carry no currency column at all.

## The owner re-walked all of it, driving their own browser

Same day, after the automated pass. Worth recording separately because it is a
**different instrument**: the checks above were driven by a script against
throwaway accounts, this was a person looking at a screen on their own signed-in
account. Two things came out of it that the script had not produced.

**(1) There are SEVEN reporting currencies, not the four the audit had seen.**
The 2026-08-05 audit checked USD, AUD, CAD and NZD. Asked to cover "all the
currencies", a census of the live universe returned **USD, AUD, CAD, NZD, EUR,
TWD and SGD** across eleven price/report combinations (tabulated in
`data-contracts.md`). **Four of them — EUR, TWD, SGD, and the AUD-priced/CAD-reporting
pair — had never been looked at by anyone.** All were then opened on production
and all were correct:

| Stock | Prices in | Reports in | Note in words | P/E withheld | FCF Yield absent | Statement symbol |
|---|---|---|---|---|---|---|
| CBA.AX *(control)* | AUD | AUD | — none, correctly | no — **chart drawn** | n/a (a bank) | `A$` |
| BHP.AX | AUD | USD | ✅ | ✅ | ✅ | `$` |
| A2M.AX | AUD | NZD | ✅ | ✅ | ✅ | `NZ$` |
| NXG.AX | AUD | CAD | ✅ | ✅ | ✅ | `CA$` |
| TUA.AX | AUD | SGD | ✅ | ✅ | ✅ | `SGD` |
| ASML | USD | EUR | ✅ | ✅ | ✅ | `€` |
| TSM | USD | TWD | ✅ | ✅ | ✅ | `NT$` |

The control matters as much as the seven: CBA has **no** note and **does** draw
its P/E chart, so the rule is firing on the condition and not on everything.

Two things that look wrong and are not. **`Intl` gives SGD no short symbol in
`en-US`**, so Tuas reads `SGD 477M` rather than `S$477M` — unambiguous, and not
to be "fixed" with a hand-rolled symbol table. **Tuas shows ANNUAL rather than
QUARTERLY financial trends**, because it doesn't report quarterly and the card
adapts. Owner accepted both.

Also raised and dismissed with evidence: NexGen's financial-trend chart draws
**revenue = 0** for several years. `total_revenue` is stored as **`null`**, not
`0`, so the scorer excludes it — this is *not* the `zero_means_na` sentinel class
(D1). The zeros come from the statement blobs, where a pre-revenue uranium
developer genuinely earned nothing. Champion Iron (CIA.AX), the other
AUD-priced/CAD-reporting stock, carries real revenue of ~$1.7bn, so the pipeline
is not blanking that pair wholesale. **Owner decision: leave as is, it is the
truth from the source.**

**(2) All ten subscription states were re-confirmed by eye**, on the owner's own
account, and the account was restored field-by-field afterwards against a
snapshot taken before the first change. One additional detail surfaced that the
script had not exercised: **the COUNTRY field on `/account` is locked while a
subscription exists** and unlocks when it doesn't — correct, because country
picks the billing currency (A$19 / US$15 / C$20), so an editable country during
a subscription would let someone re-price their own bill. And **Manage billing on
an account with no Stripe customer** refuses gracefully — *"There's no billing to
manage on your account yet."* — rather than erroring.

> **The general lesson, since it has now happened three times.** The 2026-08-05
> session found four defects that no guard caught, all by looking at a finished
> artifact. This session found a fifth class — *a whole dimension of the data we
> had never enumerated* — by the owner asking "what about all the currencies?"
> **Ask the data how many cases exist before deciding you have covered them.** The
> audit checked four currencies because four were the ones it happened to meet,
> not because it had counted.

## Gates after this session

| | |
|---|---|
| Playwright e2e | 116 → **121** (the count moved, so the new suite ran) |
| `pnpm typecheck` · `pnpm lint` | clean, 0 errors |
| `check:entitlement-gates` · `check:data-integrity` · `check:report-sections` | 11 · 55 · 22 |
| **The nightly alarm itself** | 🆕 **broken on purpose and proven** — see D9. This is the only gate in the list that had never been exercised |

> ⚠️ **A gate that has never fired is not evidence.** Every other row above has
> been seen to fail at some point, so a pass means something. The alarm had only
> ever been seen to *pass*, and D9 is what that was worth.

## How the owner is told when the data breaks

Settled 2026-08-06 after tracing the alert path end to end. **Design rule: no
email on a good night; two independent signals on a bad one.**

### What runs, and when

| Cron | UTC | Sydney | Runs the units check? |
|---|---|---|---|
| `daily-refresh-au.yml` | 08:00 | 6:00pm | ✅ yes *(added 2026-08-06)* |
| `daily-refresh.yml` (US+CA) | 22:30 | 8:30am next day | ✅ yes |

**Both runs check the WHOLE universe, not "their half".** `check_field_units`
does not inspect what the run just wrote — it reads all 863 stocks, ASX included,
via a paginated select. One run was therefore already sufficient for *coverage*;
adding the second (owner decision 2026-08-06, once the alert became a red run
rather than an unproven email) simply **halves the worst-case blind window** from
~14 hours to ~7, for the cost of one paginated read. Verified from a real run:

```
check_field_units: 39 field(s) checked across 863 stocks;
invariants: zero-margin sentinel, cross-currency fcf_yield_pct, financial_currency coverage
check_field_units: OK — every median is where it should be
```

### The signal — one channel, and it was tested by breaking it

**GitHub's failed-workflow email is the only alert.** Verified end to end on
2026-08-06 rather than assumed:

| Step | Result |
|---|---|
| Both crons deliberately broken on `main` (one band bent to an impossible range, in the workflow command so no unit test was falsified) | — |
| AU run | **failed** — `dividend_yield_pct: median 2.34 is outside the expected [100, 200] over 666 stocks  <-- looks like a FRACTION where a percent is expected` |
| US+CA run | **failed**, same message over 667 stocks |
| Destination | GitHub Settings → Notifications: **`ayaatnibrasaziz@gmail.com`**, Actions set to *"Failed workflows only"* — **seen on screen** |
| Cost | **$0** — Actions minutes are unlimited on a public repo, and GitHub notifications are free on every plan |

The hint firing is the part that matters: that is the **exact** yfinance change
that would otherwise put a 100×-wrong yield on every page overnight.

### 🔴 The Resend alert was DEAD, and could not have told us so

The same test proved the thing it was meant to prove and one thing it wasn't:
both runs called `_email()` with `--email`, both went red — and **Resend recorded
nothing at all.** Not a bounce, not a rejection: no such message exists.

**Two independent faults, and the design could not report either.**

1. **The key does not exist.** Resend holds exactly **one** API key, `supabase-smtp`,
   created **2026-07-02**. The `RESEND_API_KEY` GitHub secret was created
   **2026-05-24** — five weeks earlier. It holds a key that has since been deleted.
   (The *app* is unaffected: Vercel has its own copy, and billing mail is
   delivering normally. Only the GitHub copy went stale.)
2. **A rejected send is indistinguishable from a delivered one.** `_email()` calls
   `requests.post(...)` and never inspects the result. `requests` does not raise on
   4xx, and the `except` clause only catches transport errors — so a `401` returns
   normally, logs nothing, and looks exactly like success.

So the alert this project believed it had **has never worked, in its entire life**
— consistent with the Resend history: 42 messages since July, not one from a cron.

> **The lesson, and it is 14g's again one layer up.** The instrument reported
> nothing and nothing was the expected reading, so nothing looked like health.
> *An untested alarm is not a safety net; it is a belief.* The only reason we know
> is that the alarm was deliberately triggered — which is the same rule this
> project already applies to every new guard, applied for once to the notifier
> itself.

**Owner decision 2026-08-06: remove the Resend email from both crons entirely.**
`--email` and the two Resend secrets are gone from both check steps. One channel,
whose destination is visible, beats two where one lies.

### ⚠️ Still open — a PARTIAL refresh failure is silent

Found while testing the above, not yet fixed. `daily_refresh.run()` logs
`Failed tickers (N)`, calls the (dead) email, and **returns normally** — it never
exits non-zero. So:

| Failure | Signal today |
|---|---|
| The pipeline crashes outright | Python exits non-zero → red → GitHub email ✅ |
| **N tickers fail but the run completes** | logged, and **nothing else** ❌ |

A handful failing is routine — measured across four nights: **2, 4, 5 and 7** of
~863, i.e. **0.2%–0.8%**. Delisted tickers and provider rate-limits account for
it, and it is not worth waking anyone for.

### 🔵 D11 — OPEN DECISION: what should make a failure loud?

⚠️ **Widened 2026-08-06.** Clearing out the dead code made plain that **four**
conditions carry no signal, not one. All four were *already* silent — the email
nominally covering them had not worked since July — but they are now silent
*visibly*, which is the honest state to decide from:

| Condition | Reddens the run today? |
|---|---|
| The pipeline crashes outright | ✅ yes — non-zero exit |
| A units / invariant breach | ✅ yes — since 2026-08-06 (D9) |
| **N tickers fail, run completes** | ❌ no — `run()` returns normally |
| **Listings: every source failed** | ❌ no — the step is `continue-on-error` |
| **Index membership: every source failed** | ❌ no — same |

The last two matter more than the first: *"every source failed"* is unambiguous,
where a few failed tickers is routine. They are quiet only because
`continue-on-error: true` exists so a flaky source cannot block the price
refresh — a good reason for the **step** to continue, and no reason at all for
the **run** to look healthy.

**Not decided as of 2026-08-06.** Recorded here in full so the next session does
not have to re-measure or re-argue it.

**Why "any failure is red" is the wrong answer.** It would redden the cron on
essentially every night, and an alarm that cries wolf nightly is ignored inside a
fortnight — at which point it is worse than no alarm, because it *looks* like
coverage. This is the same reasoning that killed the daily "all clear" email.

**Why the obvious alternative is also wrong.** Reviving the Resend failure email
(by updating the stale key) would send mail on ~every night for the same reason —
`if failed:` fires at 2 failures just as readily as at 200. That is precisely the
noise the owner rejected, and it is probably *why nobody noticed the key was
dead*: nothing was missed.

**The shape of a fix.** Exit non-zero only past a threshold, so an ordinary night
stays green and silent and a real outage goes red and emails:

| Option | Behaviour | Note |
|---|---|---|
| **Percentage of attempted tickers** (recommended) | e.g. red above **5%** — ~43 of 863 | Survives the universe growing; the measured ceiling is 0.8%, so ~6× headroom before a false alarm |
| Absolute count | e.g. red above 25 | Simpler to read, but needs revisiting every time the universe grows |
| Per-market | red if any one market fails wholesale | Catches "the ASX feed is down" while the rest is fine — the failure that a whole-universe percentage can mask |

⚠️ **Whichever is chosen, the threshold must be broken on purpose before it is
trusted** (D9's lesson): force the failure count past it and confirm the run goes
red, then confirm a normal night still passes. A threshold that is never
exercised is a belief, exactly like the alarm was.

⚠️ **Do this alongside D10, not separately.** D10 is a live example of the thing
D11 is meant to catch, so the fix and its test case are the same piece of work.

**And it was already hiding a live defect.** The *index-membership* step has
reported four failures every single night. Three are companies that have not
started trading yet, which is fine; the fourth is **SanDisk**, dropped by a `NaN`
on the way to the database (**D10**). It is invisible because that step is
`continue-on-error` *and* the email that would have reported it was dead.

> ⚠️ **And note how nearly it stayed hidden even after being found.** The
> summary line reads `Failed tickers (4)`, and this document first recorded all
> four as broken. Only the traceback distinguished one real defect from three
> non-events. A count is not a diagnosis — the same lesson as reading the COUNT
> of a test run rather than its colour, one level further in.

## Live universe census, 2026-08-06

Recorded so the next session can tell growth from breakage rather than guessing.

| | |
|---|---|
| `stocks` rows | **867** — 863 equities + 4 index tickers |
| Cross-currency stocks | **79** (9.2%) |
| Distinct reporting currencies | **7** |
| Rows with no `financial_currency` | **4** — exactly the index tickers, which have no statements |
| `listings` rows | **9,090** — *already past PostgREST's silent 1000-row cap; must be read with `selectAll()` (§ D2)* |
| `price_bars` rows | **6,576,669** |
