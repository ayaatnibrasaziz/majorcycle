# Fact-check sheet — "How far do ASX shares actually fall?"

All figures from **one study run, prices through 27 August 2026**, published 29 August 2026.
Draft v3 — every figure asserted against the data.

---

## A. Outside claims — now verified against the source document

I read the paper directly (24 pages, extracted text) rather than relying on search
summaries. **Every claim below was confirmed word-for-word.**

> Michael J. Mauboussin & Dan Callahan, *Drawdowns and Recoveries: Base Rates for
> Bottoms and Bounces*, Counterpoint Global Insights / Consilient Observer,
> Morgan Stanley — **21 May 2025**.
> [Public link](https://www.morganstanley.com/im/en-us/individual-investor/insights/consilient-observer/drawdowns-and-recoveries.html)

| Article says | Paper says, verbatim | ✓ |
|---|---|---|
| "more than 6,500 US companies between 1985 and 2024" | *"more than 6,500 companies from 1985 to 2024"* | ✅ |
| "median company's worst-ever fall was 85%" | *"The median drawdown was 85 percent"* | ✅ |
| "about 54% never got back to their old high" | *"about 54 percent of stocks never return to par after hitting bottom"* | ✅ |
| "the six greatest wealth creators… average worst fall of 80.3%" | *"The average maximum drawdown for the stocks of the top 6 companies was 80.3 percent, similar to the average of the full sample"* | ✅ |

Also confirmed, and it changed the article (see §D):

- Their sample **excludes** delisted and bankrupt companies (*"which typically results
  in drawdowns of 100 percent"*), and excludes anything that never reached a $1m
  market cap — *"essentially a non-investable universe"*. So it is **less**
  failure-biased than a first reading suggests.
- Their "2.5 years" is **peak-to-trough**, not trough-to-recovery.

---

## B. Our own figures — method

- **Universe:** current members of the ASX 200 (201), S&P 500 (500) and S&P/TSX 60 (60) — **761 companies**.
- **Window:** 1 Jan 2000 → 27 Aug 2026.
- **"Typical fall":** the product's own `typical_drawdown` — the average depth of every pullback deeper than 5%, measured from the company's highest high in the previous 252 trading days. Computed by the *same code the site runs* (`analytics/major_cycle.py`), not a separate calculation.
- **Preset:** Medium (−5% / +5% / 252 bars), the product default.

⚠️ **Our measure is not the same as Morgan Stanley's**, and the article says so explicitly rather than inviting a false comparison. Theirs: one worst-ever fall from an all-time peak. Ours: the average ordinary pullback from a one-year high.

⚠️ **Why the window starts at 2000.** Our price history has a hard floor that differs by country — Australia begins **29 Jan 1988** (39 ASX stocks start on that exact day, BHP included, which has traded since 1885), the US at 1962, Canada at 1995. 2000 is the first year clean for all three.

---

## C. Verification run

**All 64 article figures** are re-derived by the workbook builder and asserted against what the article prints — every index median, every sector figure, all 14 rows of the bank and miner tables, both medians, the ratio, and the two US controls. **All pass**, and the build refuses to write the file if any one of them disagrees.

Spot-checks you can confirm publicly in a few minutes:

| # | Claim | Check against |
|---|---|---|
| 1 | CBA closed **$155.46**, 1-year high **$185.59** → **16.2% below** | [Market Index — CBA](https://www.marketindex.com.au/asx/cba) |
| 2 | Fortescue's worst fall since 2000: **−90.2%** | [Market Index — FMG](https://www.marketindex.com.au/asx/fmg) |
| 3 | Westpac's worst was **March 2020**, not the GFC | [Market Index — WBC](https://www.marketindex.com.au/asx/wbc) |
| 4 | **44 of the 50** Basic Materials members are miners; six are not | The six are named in §F below — each is checkable from its own company page |
| 4b | Counting every miner, ASX 200 has **50 of 201**, S&P 500 has **2 of 500** | [S&P/ASX 200 factsheet](https://www.spglobal.com/spdji/en/indices/equity/sp-asx-200/) · the two US miners are Freeport-McMoRan and Newmont |
| 5 | Apple's worst since 2000: **−81.4%**; Nvidia's **−89.9%** | Any long-run chart |

---

## D. Corrections made before publication

| Draft said | What checking found | Fixed |
|---|---|---|
| **The scary statistics are driven by tiny companies and "aren't about the shares you own"** | **False.** The paper says the top 6 US companies averaged an 80.3% worst fall — *the same as everyone else*. Apple −81%, Nvidia −90% in our own data. | ✅ Opening rewritten. The distinction is now the **question asked** ("how bad has it ever got" vs "is this normal"), not the universe. |
| "Fortescue has the **second-deepest** typical pullback" | Owner query. In the table as printed FMG was deepest; across seven miners IGO is deepest on *typical* while FMG is deepest on *worst* (−90.2%). | ✅ Now cites the worst fall, which is unambiguous |
| "Miners, median −25.6%" under **five** rows | The median was computed over **seven** miners. A reader adding the visible numbers got −23.4%. Same defect in the banks table. | ✅ Both tables now show all seven rows, so each median is verifiable on the page |
| "Four banks fell 50%+ **in 2008**" | **Six of seven** in the GFC; **Westpac alone in March 2020** | ✅ Corrected and more specific |
| "Fortescue sits alongside the best returns" | +420,870% from $0.004 — absurd-looking | ✅ Now ~37%/yr, with the small base stated |
| "20 years of ASX history" | 39 ASX stocks start on one day in 1988 — a provider floor | ✅ Window moved to 2000 |
| Universe = "the 250 AU stocks we cover" | Includes reader-requested microcaps (Adavale, Aeris) | ✅ Restricted to real ASX 200 members |

---

## E. Compliance

Ten companies are named. Each appears as a **measurement**, never a suggestion. The
page carries the standard "Information only — not financial advice" notice via the
shared `LegalNotice` component that `/learn` already uses — no second copy of the
wording (CLAUDE.md 11c).

---

## F. The mining claim — CORRECTED after an owner query, 2026-08-29

The owner asked how the article could claim 50 mining companies in the ASX 200, and
whether every Basic Materials company is a miner. **It is not, and the claim as
drafted was wrong.** What the check found:

**The sector is not the industry.** Of the 50 ASX 200 members Yahoo files under Basic
Materials, six have nothing to do with extracting anything:

| Ticker | Company | What it actually does |
|---|---|---|
| BSL.AX | BlueScope Steel | Makes steel |
| SGM.AX | Sims | Recycles metal |
| JHX.AX | James Hardie | Makes fibre cement |
| FBU.AX | Fletcher Building | Makes and distributes building products |
| ORI.AX | Orica | Makes explosives |
| DNL.AX | Dyno Nobel | Makes explosives |

The last two sell **to** miners, which is a different business from mining.

**And miners live outside the sector.** Six more sit under **Energy**: three thermal
coal (WHC, NHC, YAL) and three uranium (PDN, DYL, NXG).

So the honest count is **50 of 201** — a quarter of the index — but it is not the same
50 the article originally meant. The figure survived by coincidence; the reasoning did
not.

### The larger correction the same check produced

The sector table compares Basic Materials across three markets, and **the three
columns do not hold the same kind of company**:

| Index | Basic Materials | of which miners |
|---|---|---|
| ASX 200 | 50 | 44 |
| S&P 500 | 20 | **2** |
| S&P/TSX 60 | 8 | 7 |

The S&P 500's Basic Materials sector is eighteen chemical, fertiliser, paint, cement
and packaging companies plus Freeport-McMoRan and Newmont. So the article's original
sentence — *"Australian miners fall roughly half as far again as American ones"* —
was comparing Australian miners with **American chemical companies**, and the
eleven-point gap it cited was mostly that mismatch.

**Like for like**, counting every miner wherever the labels file it:

| Index | Miners | Typical fall |
|---|---|---|
| ASX 200 | 50 of 201 | −31.8% |
| S&P/TSX 60 | 8 of 60 | −23.8% |
| S&P 500 | 2 of 500 | too few to average |

⚠️ **The S&P denominator is 500, not the index's 503.** Three members — FDXF, HONA and
Q, all recent spin-offs — have no price history and no sector in our data at all, so
they could not be classified. Using 503 would have implied we had checked companies we
had not even seen. 500 is the number of S&P 500 companies actually measured, and it is
the same 500 the article's "761 companies" is built from.

The article now says this instead, and the argument is **stronger** for it: the reason
the ASX 200 falls deeper as a whole is composition, and "a quarter of the Australian
index is mining against four in a thousand of the American one" is a much more
concrete statement of that than a sector median was.

⚠️ **The lesson for the next piece.** A provider's SECTOR label is a classification,
not a description, and a claim about what companies *do* cannot be read off one. Where
an article characterises a group ("miners", "banks", "tech"), name the exclusions and
let the reader check them — which is what the table above is for.

---

## G. Re-run on ONE date — 29 August 2026

The first draft mixed two moments: the drawdowns were measured on a run of 26 August
and the *size ranking* was captured on 28 August, when the market caps were repaired.
Nothing was wrong with either, and a piece whose credibility rests on saying when it
was measured should not need two dates to say it. The owner asked for one run, so the
whole study was re-run and every figure re-derived from it.

**Six figures moved. Fifty-eight did not.**

| Figure | Was | Now | Why |
|---|---|---|---|
| TSX 60, whole index | −15.8% | **−15.7%** | −15.75 became −15.74 — a rounding boundary |
| TSX 60, largest 60 | −15.8% | **−15.7%** | the same value; the TSX 60's largest sixty ARE its sixty |
| S&P 500, largest 60 | −19.0% | **−19.2%** | Micron back inside the top sixty |
| S&P Real Estate | −17.4% | **−17.3%** | one more trading day |
| S&P Financial Services | −18.4% | **−18.3%** | one more trading day |
| TSX Financial Services | −14.6% | **−14.8%** | National Bank of Canada now has no sector (below) |

Every one of the 28 company-level figures — all 14 banks, all 14 miners, both medians,
and the mining counts — is unchanged to the tenth of a point. The per-company change in
"typical fall" across all 871 companies has a **median of 0.0000** points and a maximum
of 0.63. That is what a 26-year average does with one extra day, and it is why only the
*rankings* moved rather than the measurements.

### Three companies our data source no longer classifies

`sector` comes from the provider and is written through nightly, so when the provider
stops returning one, ours goes blank. Today that is true of three index members:

| Ticker | Company | Effect |
|---|---|---|
| NA.TO | National Bank of Canada | Drops out of the TSX 60's Financial Services row: −14.6% becomes −14.8%, over 12 companies instead of 13 |
| FISV | Fiserv | Already unclassified when the article was written; in no sector row |
| SGH.AX | SGH Limited | Same |

⚠️ **The workbook uses the sector the database holds TODAY, not a remembered one.**
An earlier build read the sector frozen into the study record, which still had National
Bank as a financial — and produced −14.5% where the live data gives −14.8%. Two of my
own scripts disagreed by 0.3 of a point for exactly that reason. The rule that settled
it: **every input to a figure comes from the same moment.** The three sit in "(not
classified)" and are named here rather than left to be noticed.
