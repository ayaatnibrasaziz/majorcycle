# Methodology Audit — Proposals for Sign-off (S2)

> **Status: PROPOSAL ONLY. No code has changed.** This document lays out six
> concrete, tunable changes to the MajorCycle scoring engine for the owner to
> approve, reject, or adjust **before** any implementation (S3). Every proposal
> states the current behaviour, the proposed change, the rationale, and the
> trade-offs — each cross-checked against real tickers so the impact is visible.
>
> Engine files in scope (do **not** edit this session): `analytics/scoring/*.py`,
> `analytics/major_cycle.py`, and their mirrors in `web/_engine/`.
>
> Compliance note (locked decision #24): everything below is a **heuristic**
> re-weighting of public fundamentals and price history. None of it is a
> backtested trading edge, and the methodology page must keep framing it that
> way (educational/informational, not financial advice).

---

## ✅ Sign-off outcomes (owner, 2026-06-03)

The owner reviewed all six proposals. Decisions for S3:

| # | Proposal | Decision |
|---|---|---|
| 1 | Quality-gate valuation | **APPROVED** — `FLOOR 0.30 / GAMMA 1.5` as the starting dials; tune after eyeballing ~20 tickers in S3. |
| 2c | Sector-adjusted FH | **Option C NOW** (keep global thresholds, but surface the fabricated bank/REIT pillars honestly via Proposal 3's insufficient-data state). **Option A (peer-relative) → Phase 2.** |
| 3 | Insufficient-data states | **ADOPT** (recommended; no objection raised) — and now **owns the bank/REIT case** (Option C routes the fabricated pillars here). |
| 4 | Rename "Momentum" | **APPROVED — "Cycle Payoff"** (internal `cycle_payoff`). Rename only, no math change. |
| 5 | Mean → median | **DECLINED — keep MEAN** for typical drawdown/profit. |
| 2a/2b | Reweight / smooth pillars | **DEFERRED** (unchanged from recommendation). |

**What Option C means for S3 (vs the deferred Option A):**
- **No sector-median plumbing this round.** Global thresholds stay. The only
  change is that a pillar whose inputs are all null (e.g. a bank's balance-sheet:
  no `debt_to_equity` / `current_ratio` / `interest_coverage`) stops returning a
  fabricated **50** and instead becomes Proposal 3's **`insufficient_data`**
  state — withheld and flagged, not invented. So **Proposal 3 fully absorbs the
  bank/REIT problem** for now; there's no separate sector workstream in S3.
- **BAC example under Option C:** balance-sheet and cashflow pillars → "not
  enough data," FH is **renormalised over the 3 real pillars** (profitability 70,
  growth 67.5, shareholder 100) and flagged, rather than diluted by two fake 50s.
- **Phase 2 (Option A)** can later replace those "insufficient" pillars with real
  peer-relative scores using the median plumbing already built for Key Metrics
  (`web/lib/medians.server.ts`), once we solve getting sector medians into the
  **Python** engine and handle the thin **CA universe (~67 stocks)** with a
  peer-count floor. Not this session.

**Because P5 was declined (mean kept):** Proposal 1's verification is *cleaner*
— the typical-drawdown anchor doesn't move, so the only thing changing valuation
numbers in S3 is the quality-gate itself. Easier before/after attribution.

**Revised S3 build order:** P1 (gate, mean anchor unchanged) → re-verify on
AAPL/BHP/SHOP + FMC/BAX/KMX/BAC → P3 insufficient-data (incl. bank/REIT pillars
via Option C) → P4 rename. Option-A sector-relative FH → Phase 2.

---

## How the engine works today (one-paragraph recap)

For each ticker, on a chosen preset (Short/Medium/Long), the engine computes a
**cycle position** from price history, then three scores that roll up to one
**Overall rating (0–100)**:

```
Overall = 0.40 · Financial Health  +  0.35 · Valuation  +  0.25 · "Momentum"
```

- **Financial Health (FH)** — 5 fundamental pillars, each a step-function of
  ratios, weighted profitability 30 / balance-sheet 25 / growth 20 / cashflow 15 / shareholder 10.
- **Valuation** — purely the **cycle position**: how deep today's drawdown is
  versus the stock's own *typical* drawdown. Deeper dip → higher score. **No
  quality input at all.**
- **"Momentum"** — 50% a count of historical pivot events + 50% the
  reward/risk ratio (typical profit ÷ typical drawdown). Despite the name, it
  contains **no price-momentum/trend signal**.

Rating bands: ≥80 High Conviction · ≥65 Constructive · ≥50 Neutral · ≥35 Cautious · <35 Bearish.

**Verification tickers used throughout:** AAPL (US), BHP.AX (AU), SHOP.TO (CA),
plus FMC / BAX / KMX (value-trap candidates) and BAC (a bank), all pulled live
from Supabase and run through the actual `web/api/cycle.py` engine on the
*medium* preset on 2026-06-03.

**Baseline engine output (today, unchanged):**

| Ticker | Drawdown | Typical DD | FH | Valuation | "Momentum" | **Overall** | Label |
|---|---:|---:|---:|---:|---:|---:|---|
| AAPL | −2.8% | −24.4% | 81.0 | 4.5 | 100.0 | **59** | Neutral |
| BHP.AX | −0.3% | −16.8% | 84.5 | 9.3 | 91.2 | **60** | Neutral |
| SHOP.TO | −33.8% | −26.3% | 83.2 | 73.9 | 100.0 | **84** | High Conviction |
| FMC | −69.3% | −21.6% | 21.3 | 94.8 | 86.0 | **63** | Neutral |
| BAX | −42.1% | −17.4% | 45.0 | 84.5 | 83.1 | **68** | Constructive |
| KMX | −37.5% | −27.2% | 28.4 | 75.8 | 99.4 | **63** | Neutral |
| BAC | −10.0% | −22.4% | 64.5 | 34.2 | 91.7 | **61** | Neutral |

The problems this document fixes are already visible in that table:
**FMC** (ROE −78%, net margin −73%, down 69% in a year) is scored a near-perfect
**"DEEP VALUE" 94.8** on valuation and lands a respectable **Neutral 63**
overall; **BAX**, a falling-knife healthcare name, is rated **Constructive**.
The engine is mistaking *cheapness* for *opportunity*.

---

## Proposal 1 — Quality-gate the Valuation score (the value-trap fix)

**Priority: HIGH.** This is the single most important change.

### Current behaviour
`calculate_valuation_zone()` (in `analytics/scoring/valuation.py`) maps *only*
the current drawdown vs the stock's typical drawdown to a 0–100 score. A
company can be bankrupt-adjacent and still score 95 if the price has fallen far
enough. Financial Health is computed separately and never touches Valuation —
they only meet at the final weighted average, where Valuation still carries its
full 35%.

Concretely: **FMC** scores **94.8 / "DEEP VALUE"** while losing money on every
line; **BAX** scores **84.5**; **KMX** scores **75.8**. These are classic
*value traps* — cheap because the business is deteriorating, not because the
market is wrong.

### Proposed change
Scale the raw valuation score by a **quality factor** derived from Financial
Health, with **no hard cliffs** (a smooth curve, not an if/else threshold):

```
quality_factor = FLOOR + (1 − FLOOR) · (FH / 100) ^ GAMMA
valuation_adjusted = valuation_raw × quality_factor
```

- **FLOOR** = the most we ever discount. A genuinely cheap-but-weak stock still
  keeps *some* valuation credit (the dip is real), it just can't dominate.
- **GAMMA** = curvature. `1.0` = straight line; `>1.0` punishes low-FH stocks
  progressively harder while barely touching healthy ones.

**Recommended starting values: `FLOOR = 0.30`, `GAMMA = 1.5`.** Both are single
numbers the owner can tune later without touching logic.

The `valuation_zone` *label* (DEEP VALUE / VALUE / FAIR / STRETCHED) stays tied
to the raw cycle position — that label honestly describes *where the price is*.
Only the *score* that feeds the Overall rating gets quality-gated. (Optionally,
the UI can show both: "DEEP VALUE — but low financial health" so the cheapness
isn't hidden, just contextualised.)

### Why this shape
- **No cliff** — a stock at FH 49 and FH 51 get almost identical treatment;
  nothing flips on a knife-edge. This matters because FH itself is noisy.
- **Two intuitive knobs.** "How hard do we punish weak companies" (GAMMA) and
  "what's the floor" (FLOOR) are both explainable in one sentence.
- **Asymmetric by design** — healthy companies in a real dip are *rewarded*
  (kept near full score), only the weak ones are dragged down.

### Trade-off / real-ticker impact

Quality factor at sample FH levels (recommended `FLOOR 0.30 / GAMMA 1.5`):

| FH → | 20 | 40 | 50 | 60 | 80 | 95 |
|---|---|---|---|---|---|---|
| quality_factor | 0.36 | 0.48 | 0.55 | 0.63 | 0.80 | 0.95 |

Effect on the real tickers (Overall recomputed with the same 40/35/25 weights):

| Ticker | FH | val_raw | quality_factor | val_adj | Overall old → new | Label change |
|---|---:|---:|---:|---:|---:|---|
| **FMC** | 21.3 | 94.8 | 0.37 | **35.0** | 63 → **42** | Neutral → **Cautious** |
| **BAX** | 45.0 | 84.5 | 0.51 | **43.2** | 68 → **54** | Constructive → **Neutral** |
| **KMX** | 28.4 | 75.8 | 0.41 | **30.8** | 63 → **47** | Neutral → **Cautious** |
| **SHOP.TO** | 83.2 | 73.9 | 0.83 | **61.4** | 84 → **80** | High Conviction → **High Conviction** |
| BHP.AX | 84.5 | 9.3 | 0.84 | 7.8 | 60 → 59 | Neutral → Neutral |
| AAPL | 81.0 | 4.5 | 0.81 | 3.6 | 59 → 59 | Neutral → Neutral |

This is exactly the behaviour we want:
- **Value traps drop** out of attractive territory (FMC and KMX → Cautious;
  BAX loses "Constructive").
- **A genuinely strong company in a genuine dip is barely touched** — SHOP.TO
  (FH 83, down 34%) stays High Conviction. The gate distinguishes "cheap and
  good" from "cheap and broken."
- **Expensive healthy stocks are unaffected** — AAPL/BHP barely move because
  their valuation score is already low (near all-time highs).

**The cost:** this couples two pillars that are currently independent, so FH now
influences the rating through *two* channels (its own 40% weight + the gate).
That is intentional (quality should matter more than the raw 40% implies for
distressed names), but it's a real change in philosophy and worth the owner
consciously accepting. The `GAMMA`/`FLOOR` defaults are a starting point, not
sacred — we should eyeball ~20 tickers post-implementation and tune.

---

## Proposal 2 — Threshold & weight review (incl. sector-adjusted FH option)

**Priority: MEDIUM.** Propose now, decide before S3.

### 2a. The Overall weighting (40 / 35 / 25)

**Current:** `0.40·FH + 0.35·Valuation + 0.25·Momentum`.

**Observation, not yet a proposal:** once Proposal 1 makes Valuation
quality-aware *and* Proposal 4 reframes "Momentum," the 25% on the momentum
component deserves a second look (see Proposal 4 — for any established stock its
first half is permanently maxed out, so it's effectively a 25% bet on one
reward/risk ratio). **Recommendation: keep 40/35/25 for now**, ship Proposals 1
and 3–4, then revisit weights with fresh eyes. Changing weights *and* gating
valuation *and* renaming momentum all at once makes the before/after impossible
to attribute. One change at a time.

### 2b. The 5 FH pillars and their step-function thresholds

The thresholds (e.g. ROE ≥20→100, ≥15→80, …) are reasonable industry rules of
thumb and I'm **not proposing to retune the individual cut-points** this session
— that's a large, low-confidence surface and the current values are defensible.
Two structural issues are worth flagging, both addressed elsewhere:

1. **Hard steps inside each pillar.** A stock at ROE 19.9% scores 80; at 20.0%
   scores 100 — a 20-point jump on a rounding error. This is the same "no
   cliffs" concern as Proposal 1. *Optional* future change: smooth each pillar
   with interpolation between cut-points. **Recommendation: defer** — it's a lot
   of surface area for a second-order effect; revisit after Proposals 1/3 land.
2. **Missing-pillar fabrication** — handled in Proposal 3.

### 2c. Sector-adjusted Financial Health (the bank/REIT problem)

**Current:** thresholds are **global** — the same ROE/margin/debt cut-points
apply to a software company and a bank. This systematically misreads whole
sectors whose accounting doesn't fit the template.

**Real evidence — BAC (Bank of America):**

| Pillar | Score | Why |
|---|---:|---|
| profitability | 70.0 | OK |
| **balance_sheet** | **50.0** | **fabricated** — banks report no `debt_to_equity`, `current_ratio`, or `interest_coverage` in the yfinance shape → all three inputs null → falls back to a made-up 50 |
| growth | 67.5 | OK |
| **cashflow** | **50.0** | **fabricated** — bank cashflow fields null → fallback 50 |
| shareholder | 100.0 | OK |

So for a bank, **40% of the Financial Health score (balance-sheet 25 +
cashflow 15) is literally invented.** "Current ratio" and "debt/equity" are not
meaningful for a deposit-taking institution, and REITs break the model
differently (huge debt loads that are *normal* for the model, would score them
15/100 on balance sheet).

**Proposed options (pick one):**

- **Option A — Sector-relative pillars (best, more work).** Score each pillar
  against the *median of the stock's sector* rather than global cut-points
  (we already compute sector medians for the Key Metrics table —
  `web/lib/medians.server.ts` — so the data plumbing exists). A bank is then
  judged against banks. Removes the global-threshold bias entirely.
- **Option B — Sector-aware pillar weights (lighter).** For sectors where a
  pillar is structurally inapplicable (banks: drop balance-sheet's current-ratio
  & interest-coverage; REITs: replace D/E with a REIT-appropriate leverage
  metric), **renormalise the remaining pillars** instead of fabricating 50. This
  pairs naturally with Proposal 3.
- **Option C — Do nothing yet, surface honestly.** Keep global thresholds but
  ship Proposal 3 so the fabricated 50s become explicit "insufficient data for
  this sector" states rather than silent fake scores.

**Recommendation:** **Option C now, Option A as a Phase-2 enhancement.** Option A
is the right long-term answer but it's a meaningful build and needs its own
verification pass across all three markets (and the CA universe is thin —
~67 stocks — so some sector medians are unstable). Shipping Option C first stops
the *dishonesty* (fake 50s) immediately and cheaply; Option A then upgrades
accuracy later. **This is the main open decision in this proposal — see the
sign-off section.**

---

## Proposal 3 — Insufficient-data state (kill the fabricated "neutral 50")

**Priority: HIGH.** Cheap, honest, and unblocks the audit's cross-cutting item.

### Current behaviour
Three places silently invent a **50** when data is missing:

1. **A missing pillar input** → `score_financial_health()` returns `50.0` for
   that pillar (`np.mean(empty) → 50.0` fallback). (This is what fabricates 40%
   of BAC's FH above.)
2. **No fundamentals at all** → `analyze_ticker()` sets
   `effective_fh = 50.0` and still produces a full Overall rating
   (`financial_health_score` is stored as `None`, but the rating is computed as
   if FH were 50).
3. **No typical drawdown** (too few pivot events) → valuation falls back to a
   drawdown-only formula capped at 60.

A fabricated 50 is the *worst* possible default: it reads as "average/neutral"
to a beginner when the truth is "we don't know." It also silently props up the
Overall rating — a no-fundamentals ticker still gets a confident number.

### Proposed change
Introduce an explicit **`insufficient_data`** state and a clear rule for when a
score is **withheld** vs **shown**:

- **Pillar level:** if a pillar has **zero** inputs, mark that pillar
  `insufficient_data` (not 50). When rolling up FH, **renormalise over the
  pillars that *do* have data** instead of averaging in a fake 50. If **fewer
  than 3 of 5 pillars** have any data, **withhold the FH score entirely**
  (`financial_health_score = null`, displayed as "Not enough data").
- **Overall level:** if FH is withheld, **do not fabricate `effective_fh = 50`**.
  Instead either (a) show Overall as `insufficient_data`, or (b) show a
  **Valuation-and-cycle-only** read with an explicit "fundamentals unavailable —
  rating based on price cycle only" banner. **Recommendation: (b)** — the cycle
  math is still valid and useful, we just stop pretending we graded the
  business.
- **Valuation level:** if there are too few pivot events to establish a
  *typical* drawdown, label the cycle read `insufficient_data` rather than
  emitting the capped drawdown-only number as if it were comparable.

**When to show vs withhold (the rule):**

| Situation | Show | Withhold |
|---|---|---|
| ≥3 of 5 FH pillars have data | FH (renormalised), note which pillars are estimated | — |
| <3 FH pillars have data | — | FH score; show "Not enough data" |
| No fundamentals at all | Cycle/valuation read + banner | FH + the FH-weighted Overall |
| <~5 pivot events | "New/short history" note | "typical drawdown", quality of valuation read |

### Trade-off / impact
- **BAC** today shows FH **64.5** (40% of it invented). Under this rule,
  balance-sheet and cashflow become "estimated/insufficient," FH is
  **renormalised over the 3 real pillars** (profitability 70, growth 67.5,
  shareholder 100 → ~76 on their re-weighted basis) **and flagged**, so the user
  sees an honest number with a caveat instead of a diluted fake one. *(This
  also interacts with Proposal 2c — sector-relative scoring would later replace
  the "estimated" pillars with real bank-appropriate ones.)*
- **Cost:** more states to design in the UI (the audit already lists
  "insufficient-data states" and "via Yahoo Finance" labels as cross-cutting
  work — this is that work). The radar chart (SnowflakeRadar) needs an
  "estimated" visual treatment for fabricated pillars.
- **Upside:** directly satisfies the ASIC-honest / beginner-clarity goals and
  removes a whole class of "why does this dead company score 50?" confusion.

---

## Proposal 4 — Rename "Momentum" (it isn't momentum)

**Priority: MEDIUM (naming) — but it's a correctness/honesty issue, so do it.**

### Current behaviour
The "Momentum" score (in `calculate_overall_rating`) is:

```
events_score (50%) = min(100, (pullback_events + profit_events) / 20 × 100)
rr_score     (50%) = min(100, (typical_profit / |typical_drawdown|) / 3 × 100)
Momentum = 0.5 · events_score + 0.5 · rr_score
```

Neither half is momentum. **There is no trend, no rate-of-change, no
moving-average signal anywhere in it.** What it actually measures:

- **events_score** = how *many* historical pivot cycles we've observed → a
  **signal-reliability / sample-size** measure ("can we trust the pattern?").
- **rr_score** = typical bounce ÷ typical dip → a **payoff-asymmetry /
  reward-to-risk** measure ("when it dips, does it historically pay to wait?").

A beginner reading "Momentum: 100" will think the stock is *trending up right
now*. That's a material mislabel — AAPL near flat (drawdown −2.8%) scores
"Momentum 100." It's actively misleading.

**Bonus finding (feeds Proposal 2a):** `events_score` saturates at just **20
total events**. Every established stock has *hundreds* (AAPL 1,204; BHP 749;
even SHOP.TO 306), so **events_score is permanently 100 for any real company**
— the "reliability" half is a dead input in practice, and "Momentum" collapses
to *just* the reward/risk ratio. That's worth knowing when we revisit the 25%
weight.

### Proposed change
Rename the component to reflect what it is. Internal field name and user-facing
label proposals (pick a pairing):

| Internal name | User-facing label | Note |
|---|---|---|
| `cycle_payoff` | **"Cycle Payoff"** | recommended — short, accurate, beginner-readable |
| `signal_strength` | **"Signal Strength"** | emphasises reliability half |
| `reward_risk` | **"Reward / Risk"** | most literal, but ignores the events half |

**Recommendation: `cycle_payoff` / "Cycle Payoff"**, with a tooltip:
*"How favourably this stock has historically rebounded from dips, and how often
we've seen that pattern. Not a measure of current price trend."*

This is a **rename + relabel only** — the math is unchanged in this proposal
(any reweight is Proposal 2a, deferred). Low risk, high honesty.

### Trade-off
- Touches the data contract (`momentum_score` field name), the type
  definitions, and every UI string that says "Momentum" — a mechanical but
  multi-file change. Worth scoping in S3 so nothing references the old name.
- No numeric change to any rating, so no methodology re-verification needed —
  purely a labelling fix.

---

## Proposal 5 — Mean vs median for "typical" drawdown/profit

**Priority: MEDIUM.** Small code change, real accuracy gain.

### Current behaviour
`typical_drawdown` and `typical_profit` are the **mean** of the pivot-event
lists (`np.mean(pullback_list)`, `np.mean(profit_list)`). These feed:
- the **Valuation** score (today's drawdown vs *typical* drawdown), and
- the **reward/risk** half of "Momentum" (typical_profit / |typical_drawdown|),
- and the "typical drawdown / typical profit" stats shown on the page.

Pivot events are heavily **right-skewed** — a handful of crashes (2008, COVID,
1987) sit in a long tail and **drag the mean far from where events usually
cluster.** Mean is the wrong centre for a skewed distribution.

### Proposed change
Use the **median** of the pivot lists for the "typical" figures.
(`lower_bound`/`upper_bound` stay as the min/max extremes — those are
*supposed* to be the tail.)

### Trade-off / real-ticker impact (measured)

| Ticker | typical **drawdown** mean → median | typical **profit** mean → median |
|---|---|---|
| AAPL | −24.4% → **−19.3%** | +79.6% → **+60.7%** |
| BHP.AX | −16.8% → **−14.3%** | +41.5% → **+37.7%** |
| SHOP.TO | −26.3% → **−19.1%** | +127.4% → **+119.0%** |

Consistently, the **mean overstates** both the typical dip and the typical
bounce (by ~5pts on drawdown, ~7–19pts on profit for these names) because the
tail pulls it. The median says: AAPL's *usual* dip is ~19%, not ~24%.

Effects to weigh:
- **Valuation anchor shifts.** A shallower "typical drawdown" (−19% vs −24%)
  means today's drawdown reaches "typical/VALUE/DEEP VALUE" sooner → valuation
  scores rise *slightly* for mid-dip stocks. This is arguably *more* honest
  (the typical dip really is shallower than the mean implies), but it nudges
  scores up, so it should land **in the same release as Proposal 1's gate**, not
  before it, so the net effect on real tickers is reviewed together.
- **Reward/risk ratio changes.** For AAPL, mean ratio = 79.6/24.4 = 3.3 vs
  median ratio = 60.7/19.3 = 3.1 — small here, but for skewed names it stabilises
  the number against single-crash distortion.
- **The page stats get more representative** — "typical drawdown −19%" matches a
  beginner's intuition of a *normal* dip far better than a crash-inflated −24%.
- **Cost:** essentially a one-line change per leg, but it moves numbers, so it
  needs the AAPL/BHP/SHOP re-verification pass in S3.

**Recommendation: adopt median, ship bundled with Proposal 1** so the combined
valuation impact is verified once.

---

## Proposal 6 (carried) — Sanity bounds & source labels

Not in the original five, but the audit's cross-cutting list pairs with the
above and I want it on the record for S3 scoping:

- **Sanity bounds** on absurd inputs (the historical `$0.08` split-adjusted
  class of value) so a garbage ratio can't silently produce a confident score —
  it should route to the Proposal 3 `insufficient_data` state instead.
- **"via Yahoo Finance — may be delayed/estimated"** provenance labels wherever
  a fabricated/estimated value could appear, per locked decision #24.

These are UI/guardrail work (S9 in the tracker), listed here only so they're
not forgotten when Proposal 3's states are designed.

---

## Summary & recommended sequencing for S3

| # | Proposal | Priority | Risk | **Owner decision (2026-06-03)** |
|---|---|---|---|---|
| 1 | **Quality-gate valuation** (`FLOOR 0.30 / GAMMA 1.5`) | HIGH | Med | ✅ **APPROVED** as proposed. The headline fix. |
| 2c | **Sector-adjusted FH** | MED | High | ✅ **Option C NOW** (honest insufficient-data via P3); **Option A → Phase 2.** |
| 3 | **Insufficient-data states** (no fake 50) | HIGH | Low | ✅ **ADOPT** — now also owns the bank/REIT pillar case. |
| 4 | **Rename "Momentum" → "Cycle Payoff"** | MED | Low | ✅ **APPROVED** (rename only). |
| 5 | **Median** for typical dd/profit | MED | Low | ❌ **DECLINED — keep mean.** |
| 2a | **Reweight 40/35/25** | LOW | Med | ⏸ **Defer.** |
| 2b | **Smooth FH pillar steps** | LOW | Med | ⏸ **Defer.** |

**Confirmed S3 build order:** (1) quality-gate (mean anchor unchanged) →
re-verify on AAPL/BHP/SHOP + FMC/BAX/KMX/BAC → (3) insufficient-data, which under
Option C also handles the bank/REIT fabricated pillars → (4) rename to Cycle
Payoff. Option-A sector-relative FH → Phase 2. Hold (2a/2b). Every step keeps
`analytics/` canonical and the `web/_engine/` mirror in sync in the **same
commit**, with the CI drift check green.

**Nothing here is implemented yet.** Proposals signed off; implementation is S3.

---

## E6 — Presenting the missing-component (FH-null) Overall (Layer E, 2026-06-26)

**Not an engine change.** This records how the app *presents and ranks* the
cycle-only Overall that the engine already produces when Financial Health is
withheld — the composition itself is unchanged (Proposal 3, signed off above).

**Behaviour today.** `score_financial_health` returns `None` when fewer than 3 of
5 pillars have data (`_MIN_PILLARS_FOR_SCORE`). `calculate_overall_rating` then
renormalises the Overall over Valuation (35) + Cycle Payoff (25) only — a cycle-only
score on the **same 0–100 scale and the same five tier labels**. `financialHealthScore`
is the **only** nullable component; Valuation and Cycle Payoff always exist (a ticker
with no usable price history is dropped to `unavailable`, never partial). Because the
cycle-only Overall is indistinguishable on screen, a data-poor name could out-rank a
fully-scored one — misleading on `/results` and Stock Detail.

**Agreed treatment (owner, 2026-06-26) — "Badge + de-rank", web/presentation only:**
- **Badge** — FH-null rows are flagged "Cycle-only" on `/results` (Overall cell +
  mobile card, with an InfoTip) and on Stock Detail (KpiStrip Overall card + Verdict
  eyebrow), explaining the Overall excludes Financial Health.
- **De-rank** — on the Overall sort (and the default Overall-desc), fully-scored rows
  always rank above FH-null rows (`sortRows` groups by completeness first, then score),
  so an incomplete name never tops the table. Other-column sorts honour the column order.
- **Briefing** — `buildBriefing` picks the standout from fully-scored rows when any exist.
- **Exports** — a "Data Completeness" column (`Full` / `Cycle-only (no Financial Health)`)
  is added to CSV (and the E10 Excel), and the Excel mutes the Overall cell of FH-null
  rows, so downloads match the on-screen table.

**Engine untouched.** No `analytics/` / `web/_engine/` edits; the renormalisation stays
as signed off. If the owner later wants to *change the composition* (e.g. penalise or
withhold the cycle-only Overall), that is a fresh methodology proposal to add here first.
