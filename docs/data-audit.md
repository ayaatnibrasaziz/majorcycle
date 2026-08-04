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

**Result:** 7 findings. **3 fixed** (two of them changing numbers a customer can
see), 4 documented with a recommendation. **4 new guards**, each broken on
purpose before being trusted. Python suite **121 → 142**.

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

## D5 — 52-week high/low are on a different price basis than the chart ⚠️ RECOMMENDATION

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

The current price is unaffected (auto-adjustment leaves the latest bar alone),
so the range gauge's marker is right; it is the endpoints that come from
elsewhere.

**Not fixed, because it is the owner's call.** Deriving both from our own bars
makes the page self-consistent and always fresh — but it would then disagree
with the number Yahoo and every broker shows. Consistency inside our page versus
agreement with the outside world is a product decision, not a bug fix.

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
| `analytics/tests/test_check_field_units.py` (7 tests) | the cohort tripwire failing to fire | drove the real `dividendYield` regression through it |
| `web/scripts/check-data-integrity.mjs` (52 checks) | an unbounded read of a growing table; a statement figure labelled with the price currency | 4 ways |
| `analytics/cron/check_field_units.py` | a provider changing a field's units, live | — runs nightly, emails the owner |

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
| `pytest analytics/` | 121 | **142** |
| `pnpm check:data-integrity` | — | **52 checks** |
| `check_field_units` (live) | — | **39 fields / 863 stocks** |
| `_engine` drift | 6 hardcoded | **7 derived** |
| `pnpm typecheck` · `pnpm lint` | clean | clean |

Read the counts, not the colours.
