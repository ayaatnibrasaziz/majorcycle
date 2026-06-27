# Layer C — Stock Detail Audit Tracker

> Living checklist for the multi-session production-readiness audit of the Stock
> Detail page. See the approved plan for context and session sequencing. Update
> this file in the same PR as each session's fixes.
>
> **🔁 REOPENED 2026-06-26 for a round-2 re-audit** — round 1 (S1–S10) used the
> 9-check model below; round 2 adds the Layer D/E techniques (deep a11y, formal
> perf/compliance/#15, a systematic null-data render sweep, a deploy-gated live tail)
> **plus** the Download Report button fix. Full gap analysis + scope at the bottom:
> **"🔁 REOPENED — round 2"**.

## Definition of "audited" (9 checks)

Each component must pass all nine, verified on **AAPL (US) + BHP.AX (AU) + SHOP.TO (CA)**:

1. **Parity** — matches `reference/original-design.html` (or design-system + owner intent for new/diverging sections).
2. **Data** — displayed values match Supabase raw (`curl` SSR + `execute_sql`).
3. **Calc** — derived values independently recomputed and matched.
4. **Color** — matches `docs/design-system.md` tiers/chart colors.
5. **Layout** — no clipping/overflow at desktop + quick 375px check.
6. **Tooltips** — present and correct.
7. **Empty/insufficient-data** — graceful state on sparse ticker (no fabricated scores).
8. **Beginner clarity** — a non-finance user can understand it.
9. **A11y (light)** — chart `aria-label`, focus-visible.

Status key: ✅ pass · ⚠️ issue logged · ❌ fail · ⬜ not yet audited · 🔧 fixed this round

## Verification method

- Data/calc: `curl http://localhost:3000/stocks/us/AAPL` + grep; `execute_sql`; recompute.
- CSS/layout: `preview_inspect` (scroll-independent). Visual/mobile: Claude-Preview screenshot + `preview_resize` 375 (reliable after the S1 dev-loop hardening).
- CI gate per session: `pnpm typecheck && pnpm lint && pnpm build`; Python → `ruff`/`mypy`/`pytest`.

## Component status

| # | Component | Section | Planned session | Status | Notes |
|---|---|---|---|---|---|
| 1 | StockHeader | Thesis | S0 / re-audit | ✅ | Analyst badge lowercase→Title-Case fixed (format.ts). **S1: visually re-confirmed** — Buy/Hold/Buy on AAPL/BHP/SHOP. **Thesis re-audit (2026-06-10): reads correct, no change** — price/delta/upside/52W gauge verbatim; tier colours §4/§5; BadgeRow tooltips already say "Cycle Payoff (25%)" (S3 P4). |
| 2 | KpiStrip | Thesis | S0 / re-audit | ✅ | Values + tier colors correct. **Thesis re-audit (2026-06-10): reads correct, no change** — gated `overallRating`; `Health Score → "—"` when FH withheld (S3 P3); drawdown tooltip already preset-aware (`lookbackBars`, S5); ratingColor matches §4 exactly. |
| 3 | VerdictCard | Thesis | S0 / re-audit | 🔧 | Faithful port; ring (gated rating)/peak/band math sound; `s2` handles withheld FH → "unavailable"; inline disclaimer present. 🔧 **Thesis re-audit (2026-06-10):** (i) **dynamic lookback** — `sentence1` DEEP-VALUE branch said literal "252-day peak"; now interpolates `cycle.params.lookbackBars` (matches KpiStrip/DrawdownOverlay) — verified FMC reads 63/252/756-day per preset. (ii) **S9 sanity caps** — `bestStrength`/`topRisk` interpolated raw ROE/margins/FCF/D-E/PEG/growth; now via shared `fmtCapped` (web/lib/format.ts): ROE/margins/growth 300, FCF 100, D/E/PEG 25. Display-only; firing thresholds unchanged. |
| 4 | CompanyOverview | Thesis | S0 / re-audit | ✅ | Simple, correct; collapses when no overview. **Thesis re-audit (2026-06-10): reads correct, no change** (source name already removed S9). |
| 5 | ThesisInsights | Thesis | S0 / re-audit | 🔧 | "Strong Buy" insight fires (analyst normalization). 🔧 **Thesis re-audit (2026-06-10):** (i) **value-trap gate (owner)** — `buildAttractive`'s "historically attractive entry zone" bullet fired purely on cycle position (`dd ≤ typical`) and was tagged Strong ★★★, so a value trap (FMC FH 21, gated to Cautious 43 by S3) still cheerled the dip. Now gated: when FH is weak (`< 50`) or withheld (`null`) the bullet is dropped — verified FMC absent / SHOP (FH 83) present. Mirrors the S3 quality-gate philosophy. (ii) **dynamic lookback** — `buildRisks` "Near 252-day highs" → `c.params.lookbackBars` (verified KO 252→63 medium/short). (iii) **S9 caps** via `fmtCapped` on ROE/D-E/growth/PEG/netMargin (verified CL ROE 363 → ">300%"). `riskInvalidation` has no raw-value display (threshold copy only). |
| 6 | SnowflakeRadar | Scorecard | S9 | 🔧 | **S9 audited.** Data/calc independently recomputed ✓ (AAPL 81.0, BHP 84.5, SHOP 83.2, BAC 74.2 — renormalised pillar weights, e.g. BAC (70·30+67.5·20+100·10)/60). **Insufficient-data/withheld-pillar state confirmed** — BAC (bank) plots a 3-axis triangle; Balance Sheet + Cash Flow show "—" + the "Not scored: … common for banks & REITs" caption (the S3 P3 work, re-verified live in dev). 🔧 **A11y fix:** the radar had no `aria-label` (every other chart got one in S6). Added `role="img"` + a dynamic summary ("Financial health scorecard radar. Profitability 76 out of 100, …" — reflects only the real pillars, so BAC reads 3). 🔧 **Per-pillar InfoTips (owner):** the 5 right-hand bars' explanations moved from invisible native `title=` to the InfoTip primitive (hover/tap/keyboard); `.radar-axis-label` made `inline-flex` so the ⓘ aligns. **S9 follow-up (owner, 3 asks):** (1) **Weighting explained + surfaced** — the Health Score is the *weighted* mean of the pillars (Profitability 30 / Balance Sheet 25 / Growth 20 / Cash Flow 15 / Shareholder 10; e.g. 100/100/100/60/85 → (3000+2500+2000+900+850)/100 = 92.5 → 93, vs a naive equal-average of 89); the "discrepancy" was just the invisible weighting. The weights live in the card ⓘ + subtitle ("Weighted average of the five pillars"). **Owner follow-up: removed the per-bar weight % (too busy)** — weights stay in the tooltip only; the card ⓘ text was trimmed to the owner's shorter wording (no bold). (2) **Pillar colours now score-based (deviates from reference, owner-approved):** bars + radar vertex dots colour by the rating tiers via `tierColor()` (≥80 #006400 → ≥65 #228B22 → ≥50 #D4A017 → ≥35 #FF4500 → #B22222), so colour is *meaningful* (strong=green, weak=red) instead of the reference's fixed identity colours (which left Shareholder red even at 100). Verified: SHOP Shareholder 75 → green, Cash Flow 53 → gold. (3) **Labels off the plot — final approach (owner: keep the full 0–100 shape, put labels outside the grid like a standard radar):** reverted `PolarRadiusAxis` domain to **0–100** (a maxed pillar reaches the outer grid ring again); instead the custom tick now **anchors labels *outward*** (right→start, left→end, top/bottom→middle) + a 10px outward nudge, so they sit in the **margin beyond the grid ring** (not over the shape). To give the long side names ("Balance Sheet", "Shareholder") room without clipping, **outerRadius reduced to 52%** and the **radar column widened 280→340px** (`.radar-grid`). Removed the **"· Weighted average of the five pillars"** subtitle text (kept just "Health Score N/100"). Verified live (SHOP, 340px canvas): all labels within the canvas (Shareholder left margin 31px, Balance Sheet right margin 21px), sitting clearly outside the pentagon — matches the owner's reference radar. **Mobile caveat:** at 375px the canvas is squished to ~170px by the pre-existing 220px fixed sidebar (Layer H — no mobile drawer yet), which clips these outward labels along with every other component; once Layer H gives the radar real width (~343px) the labels fit (same as the 340px desktop column). **Full pillar-scoring breakdown explained to owner** (each pillar = mean of its step-function sub-scores: ROE/margins → Profitability; D/E, current ratio, interest cover → Balance Sheet; rev+earnings growth → Growth; FCF yield+margin → Cash Flow; payout+share-count → Shareholder). Owner flagged the hard step-bands (ROE 19.9→80 vs 20.0→100) — smoothing them is the S2-deferred "smooth pillar steps" item, offered for later. |
| 7 | TechnicalLevels | Cycle | S7 | 🔧 | **S7 audited.** 50/200 DMA = trailing-N-close SMA, vs-DMA% = (close−DMA)/DMA; recomputed ✓. 🔧 **MA Signal honesty fix (owner C):** was labelling the *state* (50>200) as "Golden/Death Cross". Now walks the full DMA history for the most recent sign-change — shows **Golden/Death Cross only if that cross is within ~63 trading days** (`RECENT_CROSS_BARS`), else the standing-trend **Bullish/Bearish**. Verified: SHOP.TO "Bearish" (50<200, old cross, red), BHP.AX "Bullish" (50>200, old cross). InfoTip + pill tooltip reworded. |
| 8 | PriceChart | Cycle | S7 | 🔧 | **S7 audited.** Candlesticks match design-system §5 exactly (up #228B22/down #B22222, borders/wicks #006400/#8B0000) ✓. 🔧 **DMA colour fix (owner A):** the overlaid 50/200 lines diverged from §5 (were #1E5CB3 solid / #D4A017 gold solid; reference HTML has no DMA lines so §5 governs). Now **50 = #2E7DE8 brand-bright solid, 200 = #1A3A6E brand-deep dashed** (`LineStyle.Dashed`) — kills the gold-on-gold clash with the drawdown Avg line. Legend chips (`.ma-pill--50/--200`) re-coloured to match. (LWC widths are integer → §5's 1.5px renders as 2.) §19 crosshair/range-sync re-verified vs DrawdownOverlay. |
| 9 | DrawdownOverlay | Cycle | S7 | 🔧 | **S7 done.** Curve uses the preset lookback (`cycle.params.lookbackBars`) + the same HIGH/LOW rolling basis as the engine ✓; Current/Typical/Bound/Events all from engine ✓ (Curve current = engine current_drawdown, MSFT proven S4). 🔧 **Markers fix (owner B):** the ▲/▼ pivot markers were drawn for *every* pivot but the "Events" stat only counts threshold-crossing pivots → markers outnumbered Events. Now filtered to `value < pullbackThreshold` / `> profitThreshold` so **markers == Events** by construction (same pivot + threshold logic as the engine). Verified SHOP.TO (Events 145, cycle params loaded). |
| 10 | AnalystTargetTrack | Cycle | S7 | ✅ | **S7 audited — reads correct, no change.** Bear/Consensus/Bull = analystLow/Target/High verbatim (yfinance, decision #17); # analysts verbatim; implied upside = (target−close)/close; bear/bull-vs-current likewise; currentClose = last priceBar close (matches header). Marker x-positions are visual-only (18% padded domain, clamp 2–98%). Null-safe (card hidden if any of the 4 missing). |
| 11 | RelativePerformance | Cycle | S7 | ✅ | **S7 audited — reads correct, no change.** Each series indexed to 100 at first in-range bar; Stock/Index Return = last−100; **Alpha = stockReturn − home-index return** (home by market: us→^GSPC, au→^AXJO, ca→^GSPTSE); Verdict = sign of alpha. Benchmarks forward-filled to stock dates, downsampled to 180 pts. Empty state on <2 in-range bars. |
| 12 | EarningsHistory | Fundamentals | S8 | ✅ | **S8 audited — reads correct, no change.** Estimate/Actual = `epsestimate`/`epsactual` verbatim; beat=`act≥est` (green/red §5); **Surprise % = `surprisepercent`×100 recomputed ✓** (AAPL 2.01 vs 1.9427 → 3.46% = stored 0.0346×100). Beat Rate/Avg Surprise/Recent Trend (latest vs 2 qtrs prior)/Last EPS all sound. Empty state ✓ — **BHP.AX has 0 earnings rows → card hidden**. |
| 13 | QuarterlyFinancials | Fundamentals | S8 | 🔧 | **S8 audited.** Rev/GP/OpInc = income-stmt rows; FCF = cashflow `free_cash_flow`; first bar neutral, then green/red vs prior ✓. 🔧 **FCF now date-keyed** (was positional): cashflow can carry more periods than the income stmt (AAPL 7 vs 5 quarters) → matched by DATE so FCF can't mislabel against the wrong quarter. 🔧 **Null-data periods dropped** (owner: "a year with no data"): periods whose value is null for the selected metric are filtered out (e.g. BHP FY2021 revenue null → no empty leading bar). Annual/quarterly toggle locks to the one present (BHP = annual-only, no toggle ✓). |
| 14 | ValuationHistory | Fundamentals | S8 | 🔧 | **S8 audited.** Curve = monthly P/E (`pe_history` = monthly close ÷ TTM EPS); Avg = mean of points (gold dashed); vs-Average = (curr−avg)/\|avg\|; Verdict banded; empty state <4 pts ✓. 🔧 **Current marker now sits on the curve** (owner): append today's trailing P/E (`fundamentals.pe`) as a final **"Now"** point so the Current line meets the curve end + stays consistent with Key Metrics. 🔧 **Current line recoloured** red `#B22222` → brand-bright `#2E7DE8` (§5 highlight token — it's a position marker, not "bad"). Verified SHOP.TO: Current 107.6x (=trailingPE), Avg 488.8x, vs −78% "Historically Cheap"; "Now" tick + blue line on curve end confirmed. |
| 15 | BalanceSheet | Fundamentals | S8 | 🔧 | **S8 audited.** Stacked bars Cash (green) + Other Assets=`total_assets−cash` (neutral) + Debt line (red); Net Cash/Debt = `totalCash−totalDebt` recomputed ✓ (SHOP +$5.6B net cash; BHP −$15.7B net debt). Current Ratio/D-E/Interest-Coverage bands ✓ (AAPL interest-cov null → "—"). 🔧 **Newest 5 years** (`slice(-5)`, was `slice(0,5)` = oldest) + **null-asset years dropped** (no empty bars). |
| 16 | DividendHistory | Fundamentals | S8 | 🔧 | **S8 audited.** Annual bars = yfinance `dividends` summed per calendar year; non-payer empty state ✓ (SHOP). 🔧 **Current (incomplete) calendar year DROPPED** (owner) — it only holds YTD payments so it faked a red "cut", zeroed the streak, and halved Annual DPS + Current Yield. Now chart + DPS + streak + yield use the last **complete** year. Verified BHP.AX: **Annual DPS $1.71 (FY2025, not the partial 2026 $1.04)**, Current Yield 2.79%, streak 0 (real 2024→2025 cut). Edge: payer with only current-year divs → "history building" state. |
| 17 | MetricsTable (Key Metrics) | Fundamentals | rebuilt (S0) | ✅ | Rebuilt as sector/market comparison; data verified vs SQL. **S1: re-verified** — 12 rows, columns Metric/Value/vs Sector/vs {market} (localised US market/ASX/TSX), green/red/gray color-coding correct, tooltips correct, table contains own horizontal scroll at 375px (`.km-scroll`). 🔧 Fixed: sector header now names the sector (`vs Technology`, was generic `vs Sector`). 🔧 **S5 beginner softening done**: each metric name now carries a visible ⓘ definition; intro reworded ("How it compares with its peers") + a worded green/red/grey legend. 🔧 **S8 owner polish:** removed the footnote (the card-title ⓘ covers it); **made non-sortable** (removed clickable headers/sort arrows/"tap a column to sort" + neutralised the global `thead th` pointer/hover); **compacted** to the reference results-tab density (padding 8/12px, single-line rows, 11.5px mono values, min-width 460); moved the category into a **dedicated Category column** (Valuation/Profitability/Growth/Balance Sheet pills); added **Earnings Growth** (`earnings_growth_yoy`, 604/720 populated) as a 2nd Growth metric → medians cache key bumped v1→v2. Now 13 rows (12 where earnings-growth is null, e.g. SHOP). |
| 18 | SmartMoneyActivity | Sentiment | S6 | 🔧 | **S6: chart REBUILT on Lightweight Charts** (was Recharts) → native pan/zoom + crosshair-driven **combined tooltip** (every event on the hovered day + price; full-column hit area fixes the easy-to-miss markers). Events = LWC markers (▲ buy belowBar green / ▼ sell aboveBar red / ● award inBar / ▮ analyst square, gradeColor). Kept 1Y/3Y/All presets + clickable event-series legend. Insider net-buyer + analyst BULLISH/BEARISH/NEUTRAL consensus tags kept (owner: keep consensus). Data verbatim (insider value = raw $; analyst grades verbatim; no per-firm target in yfinance). Verified on SHOP.TO: tooltip showed two insider buys on one date + price; range buttons switch view; 7 LWC canvases, no console errors. **S6 follow-up (PR #26): two-tier event view** — the combined tooltip became a **hover preview** (portalled to `<body>` so the chart edge never clips it; capped at 4 events + "+N more — click to see all") plus a **click/tap-to-open pinned day panel** that lists *every* event that day, scrollable, with a close button (portalled, viewport-clamped, closes on Esc/outside/scroll/resize). Fixes dense days (hover tooltips can't be scrolled) + touch (no hover). Verified: clicking a day with 11 analyst calls opens a scrollable panel listing all 11. Default chart range = 1Y. **Dev gotcha:** running `pnpm build` while the `next dev`/preview server is up poisons the shared `.next` CSS cache (serves stale globals.css) — clear `.next` + restart after a prod build. 🔧 **Empty-data alignment fix (PR #30, post-S8):** the two columns (Insider Transactions / Analyst Rating Changes) misaligned when one side had no data — the empty text sat top-left while the data column ran full height. Now each column is a flex `.smart-col` and the empty state `.smart-empty` fills + centres in the column (grid `align-items:stretch` → equal heights). **Both-empty no longer hides the whole section** (was `return null`): it renders the two empty columns; the chart (and its legend + range buttons) is skipped when there are no events (`hasChart = hasEvents && bars>0`) so a bare price line doesn't duplicate the Cycle chart. Section heads get `min-height` to always align. Verified EQB.TO (insider-only) / ABX.TO (analyst-only) / FBU.AX (both-empty). |
| 19 | OwnershipStructure | Sentiment | S6 | 🔧 | **S6 audited.** Donut % calc verified vs DB: float = 100−inst−insider (SHOP 100−73.79−0.22 = 25.99 ✓); holders `pct_out` is a fraction → ×100 (BlackRock 0.0779→7.79% ✓); shares ÷1e6 → "M" matches header ✓. 🔧 per-row tips (Institutions/Insiders/Public Float) → InfoTip; donut `aria-label`. 🔧 holders table scrolls within its card at ≤600px (`overflow-x:auto` + `min-width:0`, scoped to mobile — desktop unchanged) so it no longer pushes the page at 375px. **Data note:** DB stores snake_case (`institution_ownership_pct`…); bridged to camelCase by `toCamel` in stocks.ts — read the snake keys when verifying via SQL. 🔧 **Striping fix (PR #26):** the holders table carried a dead `stripe` class from the reference port (no `.stripe` rule exists on the site) → rendered unshaded, unlike every other table. Aligned to the site standard `tbody tr:nth-child(even)` (same as `.km-table`) + dropped the dead class. See design-system §9 "Table". |
| 20 | ShortInterest | Sentiment | S6 | 🔧 | **S6 audited.** short %/days-to-cover verbatim from `short_pct_of_float`/`short_ratio`; bands <5/<15/≥15 match tooltip copy + reference. 🔧 **colour fix**: gauge/Signal bands now green `--c-tier-2` → amber `--c-tier-3` → orange-red `--c-tier-4` (was tier-4/tier-5 → "Neutral" rendered alarming orange-red). Only existing tier tokens (owner: no new colours). 🔧 per-row tips (Days to Cover, Signal) → InfoTip; gauge `aria-label` present. **AU null handling verified**: BHP.AX has null short data → whole card gracefully hidden (curl SSR: 0 Short Interest cards). |
| 21 | NewsFeed | Sentiment | S6 | ✅ | Decoupled to daily refresh. **S1: news populating**; empty-state + populated cards render. 🔧 PR #11 prod-crash fix (Server Component event handlers → `.news-row:hover` CSS). 🔧 **S6**: article count reflects items shown (`min(news.length,10)`, was raw `news.length`); trailing divider fixed. Card-level InfoTip already added in S5; "via Yahoo Finance" provenance is the S9 cross-cutting item. |

## Cross-cutting items (apply site-wide)

- 🔧 Insufficient-data states (replace fabricated "neutral 50"; no fake scores). — **S3 engine done** (FH pillars omit-not-fabricate + renormalise; FH withheld <3 pillars; cycle-only overall when no FH; radar plots only real pillars + insufficient/"not scored" states). Sanity-bounds + source labels still S9.
- 🔧 Sanity-bounds on absurd values ($0.08-class). — **S9 done** (display-only; no data/cycle-math change). Extended the S8 `MetricDef.cap` + median-outlier pattern across all displayed metrics: Key Metrics now caps **P/E 150x, EV/EBITDA 150x, PEG 25, FCF Yield 100%, Operating/Net Margin 300%, ROE 300%, ROA 300%, Debt/Equity 25, Current Ratio 25** (Revenue/Earnings Growth already 300) — the cell shows ">+cap", the true value stays in the hover tooltip, and the outlier is excluded from the peer median (`medians.server.ts` `OUTLIER_BOUND` mirrors the caps; cache key v3→v4). Dividend History: **Payout Ratio capped 300%** + **distress-yield treatment** — a trailing Current Yield >20% (e.g. GEM.AX 40.74% from a collapsed A$0.135 price, not a yfinance artifact) shows the real number but in amber (not green) with a ⚠ and a "unusually high — a cut may be coming" caution. The FH step-functions already clamp these inputs (ROE 8457→100), so ratings are untouched. **S8's earlier slices** (growth caps + the `dividend_yield_pct` ×100 source fix) remain. Verified via curl SSR: TFX P/E `>+150x`/Payout `>+300%`, GEM yield amber+⚠, SHOP 107.6x uncapped.
- 🔧 Source provenance — **S9 done (owner reversed the plan):** instead of *adding* "via Yahoo Finance" labels, the owner decided to **remove the source name entirely** (don't advertise the free data source). Reworded the 5 visible "Yahoo Finance" mentions (StockHeader badge title + rating-badge InfoTip, AnalystTargetTrack, NewsFeed, OnboardingModal) to drop the name while keeping the compliance-relevant "third-party data, not our rating" framing (decision #17). **Open item flagged to owner:** the Latest-News article links still point to `finance.yahoo.com` URLs (the real article destinations) — no visible "Yahoo" label, but the href reveals it; left functional pending owner call.
- 🔧 Beginner explainers/tooltips/onboarding on jargon. — **S5 done** (PR #22 merged + live, `d0470f3`): new reusable `web/components/ui/InfoTip.tsx` (ⓘ) — a visible affordance that opens on hover (desktop), **tap (mobile/touch)** and keyboard focus, portalled to `<body>` (fixed, viewport-clamped) so it is never clipped by a card/chart/table overflow. Plain-English explainers wired across every Stock Detail section (KPIs, Verdict, Scorecard radar, Cycle charts, Fundamentals, Sentiment) + the rating/valuation-zone/analyst badge row. Key Metrics softened (per-metric ⓘ + friendlier intro/legend). First-login onboarding modal already covered decision #23 — left as-is. No engine/data change. (First-visit hint declined by owner.)
- 🔧 Stock search + curated landing (fix /stocks 404). — **S4 done** (PR #19): `/stocks` Browse & Search page over the 720-stock universe; search by ticker+name, market/sector filters, market-cap-desc list; links via ticker.ts helpers. Live-add of unknown tickers deferred.
- ⬜ Methodology page (heuristic framing, ASIC-honest). — S10
- 🔧 **Stock Detail page-load performance** (owner-reported slow). Three confirmed causes: (A) cold `cycle.py` compute ~6–7s — price bars loaded *sequentially* (~12 paginated round-trips); (B) **no streaming** — the whole page blocks on the slowest of {stock, cycle, medians, benchmarks} before anything paints (benchmarks even await *after* the others); (C) ~3 MB HTML — full daily history (AAPL 11,458 bars) shipped to the client for the charts. **Owner-approved plan (2026-06-04): do #1 + #2; defer #3/#4.** **#1 Stream with Suspense — DONE** (PR #20): cycle-dependent sections (rating badges, KPI, verdict, radar, drawdown) + RelativePerformance each stream via their own Suspense boundary; only stock+medians block the initial paint; one shared React-cached cycle compute. **#2 Parallelize `cycle.py` `_load_price_bars` — DONE** (PR #20): first page fetched with an exact count, remaining pages via ThreadPoolExecutor; byte-identical output verified. Deferred for later: #3 slim the client chart payload (ship ~3–5y, lazy-load older — keeps full history for the math, which runs server-side from the DB, not from shipped bars), #4 cache-warming cron.

## Known data issues (carry-over)

- ~~News column 0/720~~ — **resolved**: PR #9 merged + "Full Enriched Data Refresh" run; news populating across the 720 (6–10 items/ticker). Refresh continues to fill remaining tickers.
- Short interest null for some ASX tickers (yfinance limitation) — handle gracefully.
- CA universe ~67 stocks → some sector medians/scores will show "Insufficient data".

## Session log

### S1 — Foundation + re-verify (2026-06-02) ✅ complete
- **Merged PR #9** (Layer C baseline) → main. Triggered the news refresh; news now populating.
- **Re-verified S0 work** on AAPL/BHP/SHOP: analyst badge Title-Case, Key Metrics layout/columns/colors/tooltips/375px, News render. All pass (see rows 1, 17, 21).
- **Production hardening (3 follow-up PRs, all merged + live on majorcycle.com):**
  - PR #9 follow-up (`af3abe6`): benchmark cache was storing a ~3MB value in `unstable_cache` (2MB limit) → `unhandledRejection` on every render + zero caching → replaced with a module-scope cache. Also named the KM sector header (`vs Technology`).
  - **PR #10** (`perf/parallel-price-bar-fetch`): parallel price-bar paging — AAPL bar fetch 7.0s → 1.7s, warm page 6.5s → 2.8s; byte-identical output verified. Owner chose to **keep full history** (no depth cap).
  - **PR #11** (`fix/news-server-component-handlers`): the NewsFeed Server-Component crash (see row 21). **Verified in production logs**: previously-crashing `/stocks/us/BLK` now 200, zero errors on the new deployment.
- **Verification lesson:** `next dev` hides Server/Client boundary errors and local prod builds are auth-gated → RSC-boundary regressions are only confirmable on a real Vercel deploy via `get_runtime_logs` (filter by `deploymentId`, check the previously-failing path is clean).
- **Deferred:** `cycle.py` parallel fetch (owner deferred — 1h-cached, lower value); Layer H mobile (section-tab nav overflows at 375px — pre-existing app shell, not a Layer C component).

### S2 — Methodology proposal (2026-06-03) ✅ doc written, awaiting sign-off
- Merged PR #12 (docs S1) first — was clean/green.
- Wrote **`docs/methodology-audit.md`** — 6 proposals, each grounded in real engine output (ran `web/api/cycle.py` on AAPL/BHP/SHOP + FMC/BAX/KMX/BAC, medium preset):
  - **P1 Quality-gate valuation (HIGH):** `qf = FLOOR + (1−FLOOR)·(FH/100)^GAMMA` (rec. 0.30/1.5, no cliffs). FMC 63→42, BAX 68→54, KMX 63→47; SHOP.TO 84→80 (healthy dip preserved).
  - **P2 sector-blind FH:** BAC balance-sheet & cashflow pillars both fabricated 50 (banks report no D/E/current-ratio/interest-coverage). Rec. Option C now (insufficient-data), Option A (sector-relative) Phase 2. Keep 40/35/25 weights; defer reweight.
  - **P3 insufficient-data (HIGH):** kill fabricated 50; withhold FH when <3/5 pillars; cycle-only read + banner when no fundamentals.
  - **P4 rename "Momentum" → "Cycle Payoff":** it's signal-reliability + reward/risk, no trend. events_score saturates at 20 events → permanently 100 for established stocks. Rename only.
  - **P5 mean→median typical dd/profit:** mean overstates (crash-skewed); AAPL dd −24.4→−19.3. Bundle with P1.
  - **P6 carried:** sanity bounds + provenance labels (S9).
- **S3 order:** (P1+P5)→reverify→P3→P4; defer 2a/2b + Option-A.
- No engine code touched. Doc awaiting owner sign-off.

### S3 — Methodology engine implementation (2026-06-03) — PR #14, awaiting CI + owner merge
Owner signed off (P2c revised to **Option C now**, P5 **declined → keep mean**). Implemented on `feat/s3-methodology-engine` (4 commits), `analytics/` + `web/_engine/` synced (drift check green):
- **P1 quality-gate (`509fd14`):** `qf = 0.30 + 0.70·(FH/100)^1.5` applied in `analyze_ticker`; new `valuation_score_raw` + `quality_factor` fields. Verified: FMC 63→42, BAX 68→54, KMX 63→47, SHOP 84→80, AAPL/BHP unchanged.
- **P3 insufficient-data (`ad821c1`):** `score_financial_health` omits empty pillars + renormalises; returns None <3 pillars; `calculate_overall_rating` takes Optional FH → cycle-only renormalised when None; SnowflakeRadar plots only real pillars + "not scored"/insufficient states. Verified BAC FH 64.5→74.2 (balance-sheet+cashflow omitted), 3-axis radar (SSR + screenshot). Full-data tickers byte-identical.
- **P4 rename (`5544549`):** `momentum_score`→`cycle_payoff_score` (engine + contract + TS + 3 tooltips). Pure rename, values unchanged.
- **`1aa8ee0`:** caption em-dash spacing fix.
- All green: pnpm typecheck/lint/build, ruff, mypy, pytest (36), drift check. **Visual venue for final sign-off = Vercel preview (BAC scorecard).** Same pause-before-merge rule.

### S4 — Stock search + curated landing (2026-06-03/04) — ✅ COMPLETE (PR #19 merged + live)
Fixed the `/stocks` 404 (no landing route existed — only `/stocks/[market]/[ticker]`). Owner approved the unified search + browse approach, deferring live-add of unknown tickers, and renaming the nav item to "Browse".
- **`web/lib/universe.server.ts`** — `unstable_cache` (daily) loads only the light columns (`ticker, market, name, sector, industry, currency, market_cap`) for the **720 non-index equities**; never ships the `fundamentals` JSONB to the client. `market_cap` (numeric) coerced to number; `market='index'` excluded.
- **`web/components/stocks/StockBrowser.tsx`** (client) — search by ticker AND company name; market pills (All/US/ASX/TSX); sector dropdown; market-cap-desc list (top 120 painted for Lighthouse); no-match empty state → Run Analysis; links via `ticker.ts` helpers.
- **`web/app/(app)/stocks/page.tsx`** — server shell (`force-dynamic` — reads Supabase at request time, so never static-prerendered at build where env vars are absent; the CI build caught this).
- **Sidebar** `Stock Detail` → **Browse**; **Header** `/stocks` → **Browse Stocks** (depth-aware so detail pages keep "Stock Detail").
- **Verified + MERGED + LIVE:** PR #19 (`9cb1ad5`); prod `www.majorcycle.com/stocks` was a 404, now 307→`/login?next=/stocks`→200 (route exists, auth-gated). 720 stocks market-cap sorted; ticker + name search; TSX filter = 67; TSX+Energy = 12; correct hrefs (`BHP.AX`→`/stocks/au/BHP`). **375px:** component fits on its own; remaining overflow is the pre-existing 220px fixed sidebar / no mobile drawer (Layer H, out of scope).

### S4 follow-ups (2026-06-04) — Browse horizon selector, Stock-Detail perf, drawdown preset fix
Bonus work beyond S4's original scope, surfaced during S4 review. All merged (PR #20 = `11b36a4`; PR #18 docs = `00f3a1c`) except the drawdown preset fix (PR pending).
- **Cycle horizon selector on Browse (PR #20):** the user picks Short/Medium/Long **before** opening a stock; carried into the detail page via `?preset=` (Medium = clean URL). Persisted in `localStorage` via `useSyncExternalStore` (hydration-safe). **No selector on the detail page** (owner decision) — only a small read-only "Major Cycle horizon: …" note for non-Medium. Custom deferred to Layer D. Prod-verified: `/api/cycle?ticker=AAPL&preset={short,medium,long}` → lookback 63/252/756, typDD −16/−24/−34%.
- **Stock-Detail perf #1 + #2 (PR #20):** **#1** stream the page with `<Suspense>` (shell paints ~1.7s, cycle sections stream in; one shared React-cached cycle compute; `StockHeader` takes `badgeSlot`). **#2** parallelize `cycle.py` `_load_price_bars` (first page with `count=CountMethod.exact`, rest via `ThreadPoolExecutor`) — byte-identical output verified; ruff+mypy clean. Chart sync safe (chartSync replays to late-mounting overlay).
- **Drawdown/Profit curve preset window (PR pending):** the shaded curve in `DrawdownOverlay.tsx` was hardcoded to a 252-day rolling window while its overlaid Typical/Lower-Bound/Current values come from the preset-aware engine → mismatch on Short/Long (newly visible via the horizon selector). Fixed: `computeDrawdown`/`computeProfit` use `cycle.params.lookbackBars`; markers use `cycle.params.pivotBars`; tooltips say "{lookback}-day". **Verified vs engine for MSFT** — curve current value now equals engine `current_drawdown`/`current_profit` per preset (short −8.76/19.67, medium −22.79/19.67, long −22.79/40.44). This resolves part of the row-9 (DrawdownOverlay) S7 audit early.

### S5 — Beginner help (tooltips / jargon explainers + Key Metrics softening) (2026-06-05) — ✅ MERGED + LIVE (PR #22, `d0470f3`)
Owner approved (AskUserQuestion): **build the reusable ⓘ InfoTip**, **full sweep across all sections**, **no first-visit hint**. Onboarding modal already satisfies decision #23 — left as-is. Pure web change — **no engine/data/Python touched**. CI green; merged → main `d0470f3`; prod auto-deploy healthy (login 200, `/stocks` 307→login, `/api/cycle` 200 byte-unchanged); owner did logged-in visual sign-off. Instant-revert = `d50a276`.
- **`web/components/ui/InfoTip.tsx` (new):** a visible ⓘ (Lucide `Info`) affordance that opens on **hover (desktop), tap (mobile/touch) and keyboard focus** — the old native `title=` tooltips were invisible to beginners and never fired on touch (design-system §10 requires tap-to-reveal on mobile). The bubble is **portalled to `<body>` with `position: fixed`** so it's never clipped by a card/`chart-canvas-wrap`/`km-scroll` overflow and **clamps to the viewport**; flips above when low on space; closes on Escape / outside-pointerdown / scroll / resize. `role="tooltip"`, `aria-label`/`aria-expanded`, `:focus-visible` ring. No new deps (uses `createPortal` + `lucide-react`). No `set-state-in-effect` (portal guarded by `open && typeof document`).
- **CSS:** `.info-tip-trigger` + `.info-tip-pop*` added to globals.css (Sora 11px, shadow-lg per §3); `.kpi-label` made flex so the icon aligns with the 9px label.
- **Wired across the page (full sweep):** KPI strip (all 4), Verdict eyebrow, Why Attractive / Key Risks, Company Overview, Stock Scorecard radar, Technical Levels (DMAs + golden/death cross), Price Chart, Drawdown/Profit, Analyst Targets, Relative Performance (alpha), Earnings, Financial Trends, P/E History, Balance Sheet, Dividends, **Key Metrics** (per-metric ⓘ + reworded intro + worded green/red/grey legend — the deferred KM softening), Smart Money, Ownership, Short Interest (short %, days-to-cover), Latest News, and the rating/Valuation-Zone/analyst **badge row** (one combined ⓘ).
- **Bonus fix:** KpiStrip "Current Drawdown" explainer now uses the preset lookback window (was hardcoded "252-day").
- **Verified:** `pnpm typecheck && lint && build` all green. SSR renders **37 ⓘ triggers** across all sections (MSFT). In-browser (local dev, Claude-Preview): ⓘ opens on **hover and tap** with correct title+body, in-viewport, z-9999, placement flip; desktop + 375px screenshots clean (mobile bubble renders as a styled tap-to-reveal popover); no InfoTip/hydration/JS console errors (the `removeChild` noise seen was self-inflicted by debug `.remove()` evals). **Chart/cycle fixes are pure client JS → local dev representative** (no Vercel-wall gotcha; this isn't an `/api/cycle`-path bug class). Same pause-before-merge rule.

### S6 — Sentiment component audits (2026-06-05) — ✅ MERGED + LIVE (PR #24, merge `ac1ca16`; + `488ba24` default chart range → 1Y per owner)
Audited the four Sentiment components (rows 18–21) against the 9-check definition. **Data/calc were already correct** — the divergences were parity / colour / layout / a11y / beginner-clarity. **No engine/data/Python touched.** Owner sign-off captured via AskUserQuestion before building (see below).
- **DATA GOTCHA (logged):** the cards read camelCase (`shortPctOfFloat`, `institutionOwnershipPct`…) but the DB `fundamentals` JSONB is **snake_case** (`short_pct_of_float`, `institution_ownership_pct`…); bridged by `toCamel` in `web/lib/stocks.ts`. Verifying via `execute_sql` must read the snake keys (the camel keys return null). Runtime values are populated correctly. Confirmed AAPL inst 65.82/insider 1.63/short 0.95/dtc 2.84; SHOP 73.79/0.22/0.48/2.82; BHP 41.81/0.03/**null**/**null**.
- **Row 18 SmartMoneyActivity — chart REBUILT on Lightweight Charts** (owner: "rebuild in LWC" + "increase hit area" + "multiple events in one tooltip + price" + "keep 1Y/3Y/All"). Was Recharts (ComposedChart + Scatter + a per-marker `Tooltip`). Now an LWC area series + event **markers** (▲ buy belowBar #006400 / ▼ sell aboveBar #B22222 / ● award inBar / ▮ analyst square gradeColor), native click-drag pan + scroll/pinch zoom (mirrors PriceChart config; `fixLeftEdge/fixRightEdge`), and a **crosshair-driven combined tooltip** (`.smart-chart-tip`, imperative innerHTML, escaped) that lists EVERY insider+analyst event on the hovered day + the price — the full-column crosshair is the "large hit area." Events snapped to nearest price-bar date; `eventsByTime`/`priceByTime`/`markersAll` memoised; markers re-filtered on legend toggle; range applied by a dedicated effect (no rebuild). Kept the static top legend + clickable bottom event-series legend (dropped the now-pointless "Price" toggle). Insider net-buyer + analyst BULLISH/BEARISH/NEUTRAL consensus tags KEPT (owner chose keep over reference's plain "N recent"). **Lint gotcha:** `react-hooks/refs` forbids mutating a ref during render → `visibleRef` synced via effect; dropped `rangeRef`.
- **Row 19 Ownership:** per-row tips → InfoTip; donut `aria-label`; calc reverified (float 100−inst−insider; pct_out×100; shares/1e6). Mobile: holders table now scrolls within its card (`@media ≤600px` `overflow-x:auto` + `.ownership-grid>* min-width:0`) — **desktop intentionally unchanged** (a global version regressed desktop with a scrollbar; scoped to mobile).
- **Row 20 ShortInterest — colour fix** (owner: only existing tokens, confirm first): bands green `--c-tier-2` → amber `--c-tier-3` → orange-red `--c-tier-4` (was tier-4/tier-5). Kept the SVG arc gauge (owner: keep+polish, not reference text-block). per-row tips → InfoTip. **AU null verified** (BHP card hidden).
- **Row 21 NewsFeed:** article count = items shown; trailing-divider fix.
- **Verified (local dev, Claude-Preview — chart is pure client JS so local IS representative; no Vercel-wall/`api-cycle` gotcha):** typecheck/lint/build green. SHOP.TO: LWC chart mounts (7 canvases, 0 console errors); **combined tooltip proven** — hovering May 7 showed `$152.57` + two insider buys (Lutke 15,000 sh $1.7M + 3,000 sh $330K) in one bubble; price-only on no-event days; range buttons switch All(full history)/1Y/3Y. Ownership: 3 stat-row InfoTips, donut aria-label "Institutions 73.79%…", holders table data correct. ShortInterest: value-arc stroke = rgb(34,139,34) green (=c-tier-2), Signal "Bullish" green, dtc 2.8, gauge aria-label present, 2 InfoTips. News: "10 articles"/10 rows. **375px** (sidebar neutralised): all four cards fit; holders table scroll-contained (wrapper right 335 ≤ card 354, scrollWidth>clientWidth). BHP.AX (curl SSR): Short Interest card absent (AU null). The analyst-row tooltip path wasn't isolated via synthetic hover (fixRightEdge pins the last bar and all 50 SHOP analyst events share one date), but it's byte-identical builder code to the proven insider path + analyst markers render. **Same pause-before-merge rule.**

### S6 follow-up — Smart Money two-tier event view, 1Y default, hydration + striping (2026-06-06) — PR #26 (open, CI green, awaiting owner merge)
Owner-driven refinements after PR #24 merged. Branch `feat/s6-day-panel` off main; commits `488ba24`-equivalent 1Y default already in #24, then `2e871a7` (two-tier) + `bac79ff`/this doc + `74a17ab` (hydration fix) + `ea76904` (striping).
- **Default chart range → 1Y** (owner): `useState<Range>('1y')` so every Stock Detail load lands on the 1Y window (was All). Verified: 1Y button active by default, ~1-year window.
- **Two-tier event view** (owner: dense days couldn't be scrolled + tooltip clipped at chart edge): **hover preview** `.smart-chart-tip` now created imperatively on `<body>` (position:fixed, un-clipped, capped at 4 + "+N more — click to see all"); **click/tap day panel** `.smart-day-panel` (React `dayPanel` state + `chart.subscribeClick`) — portalled, viewport-clamped, `max-height:50vh; overflow-y:auto`, lists every event that day + × close; closes on Esc/outside/scroll/resize. Verified on SHOP.TO: clicking an 11-analyst-call day opens a scrollable panel listing all 11. (Advised owner first: hover tooltips fundamentally can't scroll → need a click panel; owner picked two-tier.)
- **HYDRATION BUG fixed (`74a17ab`):** the hover preview was first written as `{typeof document!=='undefined' && createPortal(<div…/>)}` → server (false) ≠ client-first (true) → hydration mismatch on every Stock Detail page (owner hit it in preview). Fixed by the imperative-`createElement` approach above. Day panel was always safe (gated on `dayPanel`, null at hydration). → coding-standards §3 React Patterns updated with the rule.
- **Ownership zebra striping fixed (`ea76904`):** holders table had a dead `stripe` class (reference port; no `.stripe` rule on site) → unshaded. Aligned to site standard `.ownership-table tbody tr:nth-child(even)` (= `.km-table`). → design-system §9 "Table" documents the canonical striping convention.
- **DEV GOTCHA (logged in coding-standards §12 anti-patterns):** running `pnpm build` while the dev/preview server is up poisons the shared `web/.next` cache → stale `globals.css` served (new JS, old CSS) even across restart. Fix: `rm -rf web/.next` + restart. Bit me twice this session (the `position:fixed` and the `:nth-child(even)` edits both showed stale until a `.next` clear).
- **Docs synced this session:** design-system.md (§9 Table + Smart Money event-marker chart subsections), coding-standards.md (hydration/portal rule + refs rule + dev-server anti-pattern), layer-c-audit.md (rows 18–21 + this log).
- **STATUS: PR #26 CI green, PAUSED for owner merge confirm.**

### S7 — Cycle-section chart audits (2026-06-07) — built + locally verified, PAUSED for owner merge confirm
Audited the five Cycle components (rows 7–11) against the 9-check definition. Wrote the full per-value calc/data lineage first, owner signed off via AskUserQuestion **before** building (standing directive). **Reads-correct, no change:** AnalystTargetTrack (row 10) + RelativePerformance (row 11) + the candlesticks (row 8). **No engine/data/Python touched** — pure web (`web/components/stocks/{TechnicalLevels,PriceChart,DrawdownOverlay}.tsx` + `web/app/globals.css`).
- **Fix A — PriceChart DMA colours (owner: align to §5).** The overlaid 50/200 DMA lines diverged from design-system §5 (were `#1E5CB3` solid / `#D4A017` gold solid; the reference HTML draws **no** DMA lines, so §5 governs). Now **50 = `#2E7DE8` (brand-bright) solid, 200 = `#1A3A6E` (brand-deep) `LineStyle.Dashed`** — removes the gold-on-gold clash with the drawdown "Avg" line + consensus marker. `.ma-pill--50/--200.active` legend chips re-coloured to match (were `#1E5CB3`/`#C08000`). LWC line widths are integer-only, so §5's "1.5px" renders as the existing 2 (noted in code).
- **Fix B — DrawdownOverlay markers (owner: filter to events).** The ▲/▼ pivot markers were drawn for *every* pivot, but the engine's "Events" stat only counts pivots that cross the preset threshold (−3/−5/−8) → markers outnumbered Events and sat on a different basis than the Typical/Bound lines. Now filtered to `value < cycle.params.pullbackThreshold` (DD) / `> cycle.params.profitThreshold` (profit) — **markers == Events** by construction (the client pivot fn already mirrors the engine's strict-inequality `ta_pivotlow`/`high`, `i+right` placement). `cycle.params.{pullback,profit}Threshold` arrive via `asdict`→`toCamel` (already on the TS `CycleParams` type).
- **Fix C — TechnicalLevels MA Signal (owner: recent-cross vs trend).** Was labelling the *current state* (50>200) as "Golden/Death **Cross**" — but a cross means the *crossing event*. New `computeMaSignal` walks the full 50/200 DMA history (O(n) rolling sums) for the most recent sign-change: shows **Golden/Death Cross only if that cross is within `RECENT_CROSS_BARS`=63 trading days (~3 mo)**, otherwise the standing-trend **Bullish/Bearish** (same green/red). InfoTip + MA-Signal pill tooltip reworded to explain.
- **Verified (local dev, Claude-Preview — these are non-cycle/client-JS chart fixes, so local IS representative; the only cycle-dependent value is DrawdownOverlay's threshold, which loads fine via dev `useLocalCompute`):** typecheck/lint/build green; `web/.next` cleared before the dev server (post-build, per the §12 gotcha). **SHOP.TO (CA):** MA Signal **"Bearish"** red `rgb(178,34,34)` (50 CA$158.56 < 200 CA$192.11, old cross); legend chips `rgb(46,125,232)`=#2E7DE8 / `rgb(26,58,110)`=#1A3A6E; screenshot shows the **solid blue 50 + dashed navy 200** (gold line gone) and the drawdown ▲ markers with **Events 145**; 0 console errors; 21 canvases. **BHP.AX (AU):** MA Signal **"Bullish"** (50 A$57.04 > 200 A$47.99, old cross). Both confirm the state branch; the recent-cross branch is the symmetric code path (no live recent-cross ticker among the two). **AAPL (US) not loaded in dev** (11k-bar browser-wedge risk) — same ticker-agnostic logic; owner does the final logged-in prod sign-off.
- **Owner UI polish (commit `cd1f342`, after CBA confirmed Golden Cross live):** PriceChart — removed the redundant circular "i" button beside Max (the card-title ⓘ already covers it) + dropped its dead CSS. RelativePerformance — S&P 500 line solid (was dashed), removed the "Indexed to 100 at start of period" caption + the matching InfoTip line. AnalystTargetTrack — un-italicised `.target-stat-caption` ("Most cautious/Central Wall Street/Most optimistic … view"). Verified in Claude-Preview (SHOP.TO): 0 `.chart-info-btn`, no "Indexed to 100" text, caption fontStyle `normal`, 0 dashed SVG paths; screenshot confirms solid S&P line + upright captions. typecheck/lint/build green.
- **MA Signal style follow-up (PR #28, merge `2460e91`):** owner found the MA Signal text looked off beside the numbers. First tried a bold Sora label (stood out too much), then per owner settled on **matching the number pills exactly** — the MA Signal now uses the plain `.stat-pill-val` (JetBrains Mono, 15px, weight 600), colour-only difference (green Bullish/Golden Cross, red Bearish/Death Cross). Removed the interim `.stat-pill-val--signal` CSS + the old inline 11px. Verified SHOP.TO: all five pills identical font/size/weight; "Golden Cross"/"Death Cross" stay one line at desktop widths.
- **STATUS: ✅ MERGED + LIVE.** S7 = PR #27 → main `af37a6f` (commits `8ef3539` A/B/C + `cd1f342` UI polish + `0f8fe56` doc). MA-signal follow-up = PR #28 → main `2460e91`. Prod deploy `dpl_DWKshiyvYNGYJ82DJQHHtF25MysK` (2460e91) READY + production; health-checked (login 200, /api/cycle?ticker=AAPL 200 engine byte-unchanged, /stocks 307). Owner confirmed Golden Cross live on CBA. **Instant-revert = prev prod `dpl_BiZYZ75Xy3BQLmAqB8ReVBPihgxL` (af37a6f, S7) — isRollbackCandidate — or `git revert 2460e91`.** No engine/data/Python touched. **Next = S8 (Fundamentals charts).**

### S8 — Fundamentals chart audits (2026-06-07) — built + locally verified, PAUSED for owner merge confirm
Audited the five Fundamentals components (rows 12–16) against the 9-check def. Wrote the full per-value calc/data lineage first (grounded in real AAPL/BHP/SHOP DB rows via `execute_sql`); owner signed off the fixes + open questions via AskUserQuestion **before** building (standing directive). Branch `feat/s8-fundamentals-charts` off main `62f324c`. **EarningsHistory (row 12) reads correct, no change** (surprise % recomputed ✓). **Key Metrics (row 17) re-checked, correct** (dividend yield is NOT among its 12 metrics → bug B doesn't surface there; already in `sec-fundamentals`). One small Python/data change; rest pure web.
- **Bug A — dividend current-year is partial (HIGH, every payer).** yfinance sums dividends by **calendar** year, so the latest bucket is YTD-only (AAPL 2026 $0.53 vs 2025 $1.03; BHP 2026 $1.04 vs 2025 $1.71) → faked a red "cut", zeroed the growth streak, halved Annual DPS + Current Yield. **Owner: drop the partial year.** `DividendHistory.tsx` now filters `year < currentYear` and drives the chart + DPS + streak + yield off the last **complete** year; a payer with only current-year divs → "history building" state. Verified BHP.AX SSR: **Annual DPS $1.71 (FY2025), Current Yield 2.79%**, streak 0 (real 2024→2025 cut). SHOP non-payer empty state intact.
- **Bug B — dividend yield stored 100× too big (HIGH, data/engine, cross-cutting).** `dividend_yield_pct` = 35.0 (AAPL) / 320.0 (BHP) — newer yfinance returns `dividendYield` already in **percent units** but `analytics/providers/yfinance_provider.py` still did `_pct` (×100). **Owner: fix at source now.** Changed `_pct`→`_safe`. Analytics-only (yfinance_provider is **not** in the `_engine` drift check — the Vercel fn doesn't bundle the fetcher → no mirror). **Needs a Full Enriched Data Refresh to repopulate all 720 (owner GitHub Action).** Until then the visible Current Yield uses the computed path (correct); only the rare fallback would show the stale value.
- **C — FCF date-keyed alignment (`QuarterlyFinancials.tsx`).** Cashflow can carry more periods than the income stmt (AAPL 7 vs 5 quarters); FCF was matched positionally (aligned only by luck of equal end-dates). Now `buildFcf` maps cashflow `free_cash_flow` by **date label**.
- **C2 — null-data periods dropped (`QuarterlyFinancials.tsx`, owner: "a year with no data").** Periods whose value is null for the selected metric are filtered before charting (e.g. BHP FY2021 revenue null → no empty leading bar). isUp computed between consecutive present periods.
- **Current-P/E-on-curve + D recolour (`ValuationHistory.tsx`, owner).** Append today's trailing P/E (`fundamentals.pe`) as a final **"Now"** point so the Current marker line sits on the curve end (and stays consistent with the Key Metrics trailing P/E — more current than the last month-end). Current line recoloured red `#B22222` → brand-bright `#2E7DE8` (§5 highlight token; it's a position marker, not "bad"). Verified SHOP.TO: "Now" x-tick + blue `#2E7DE8` Current 107.6x line meeting the curve end; Avg 488.8x gold; −78% "Historically Cheap".
- **E — BalanceSheet newest-5 + null-year drop (`BalanceSheet.tsx`).** `slice(0,5)` (oldest) → `slice(-5)` (newest); years with null assets dropped (no empty bars). Harmless-today safety + handles the owner's "year with no data".
- **Verified (local dev, Claude-Preview + curl SSR — these read priceBars/fundamentals/enriched JSONB, NOT `/api/cycle`, so local IS fully representative; no Vercel-wall gotcha):** `pnpm typecheck && lint && build` green; `ruff`/`mypy`/`pytest 36` green; `web/.next` cleared before the dev server (post-build §12 gotcha). SHOP.TO Valuation chart screenshot + DOM (ref-line strokes `#D4A017`/`#2E7DE8`) confirm Current-on-curve + recolour; BHP.AX SSR confirms the dividend complete-year stats + annual-only Financial Trends (no toggle) + Net Debt $15.7B. 0 console errors. **AAPL not loaded in dev** (11k-bar wedge); logic is ticker-agnostic. The QF null-drop is code+typecheck-verified (BHP FY2021 revenue null; browser wedge avoided). **bug B's repopulation only shows after the owner's data refresh.**
- **Chart-height consistency (owner follow-up, commit `64e43ac`):** the Fundamentals graphs used mixed canvas heights (Earnings/Balance Sheet `chart-h-lg` 300px, Financial Trends `chart-h-md` 220px) → looked inconsistent. Unified all to **`chart-h-sm` (200px)** to match Valuation History, Dividend History and the **Relative Performance** chart. `initialDimension` SSR fallback heights → 200. Verified in Claude-Preview: all five Fundamentals chart-canvas-wraps + Relative Performance measure 200px.
- **Key Metrics rework (owner follow-up, commits `3afc9d6` + `e8a0e08` + `3e244a6`, row 17):** removed the footnote, made the table **non-sortable**, **compacted** it to the reference results-tab density, added a **Category column**, and added **Earnings Growth** as a 2nd Growth metric (medians v1→v2). Verified BHP.AX SSR (13 rows, all 4 category pills, Earnings Growth present, no footnote/sort-wording) + SHOP.TO Claude-Preview (5 cols, `td` padding 8/12, header `cursor:default`, screenshot). **CSS-stale gotcha bit again:** the `cursor:default` override didn't HMR (prod build earlier poisoned `.next` CSS) → fixed by stop server + `rm -rf web/.next` + restart (per §12).
  - **Fillet (`e8a0e08`):** the full-bleed table's square bottom corners poked past the card's 10px radius → added `.km-card { overflow: hidden; }` (same pattern as `.card--verdict`/KPI card). Verified `overflow:hidden` computed + rounded bottom corners in screenshot.
  - **Sanity cap on explosive growth (`3e244a6`, owner-approved — early slice of S9):** Earnings/Revenue growth explode from a near-zero prior base (MGR.AX earnings **+31,987%**, NTR.TO +1,250%; 43 tickers >200% vs revenue's 2). **Confirmed the calc is correct** (yfinance `earningsGrowth` YoY fraction ×100, same as revenue growth; median 13.75%, AAPL 21.8%, BHP 27.5%). Display now caps `|value|>300` to **">+300%"** (true value in cell `title`), caps the comparison delta to **">+300pp"** (tip keeps the real gap), and **excludes outliers from the peer median** (medians key v2→v3). `MetricDef.cap` is per-metric/reusable for the rest of S9. Verified NTR.TO SSR: ">+300%" value + ">+300pp" deltas + "capped for display" title.
- **Data refresh confirmed (2026-06-08):** owner ran Full Enriched Data Refresh on the branch. Verified: dividend yield corrected universe-wide (median **2.39%**, was ~239%; AAPL 0.35%, BHP 3.2%); news 716/720; all rows updated. One outlier `GEM.AX` div yield 40.74% (yfinance artifact → S9 sanity-bounds; low impact, not shown in Key Metrics).
- **Browse↔Detail consistency pass (2026-06-08):** (1) Browse "Cycle horizon" ⓘ now uses the shared **InfoTip** (was a native `title=` Info icon — invisible on touch). (2) Browse sidebar icon `TrendingUp`→**`Compass`** (TrendingUp duplicated the logo's trend-line). (3) **Detail header ticker** now shows the clean symbol + market badge (`SHOP` + `TSX`) instead of the raw `SHOP.TO` (tight tracking read as "SHOPTO") — matches Browse + the URL (owner-approved). Verified all three in Claude-Preview. Intentional per-page differences left as-is (detail sub-nav/Methodology/Download; Browse market-cap column + horizon selector).
- **STATUS: built + verified, all CI green. Owner authorised merge-live after this consistency pass.** After merge: data already refreshed (above). **Next = S9 (Scorecard radar re-audit + sanity-bounds + "via Yahoo Finance" source labels).**

### S9 — Scorecard radar re-audit + sanity-bounds + source-name removal (2026-06-09) — built + locally verified, PAUSED for owner merge
Branch `feat/s9-radar-sanity-source` off main `07c2e7b` (PR #30 held open by owner, not merged — S9 is disjoint from #30's files so it branches off main). Owner signed off all four decisions via AskUserQuestion **before** building (standing directive); ground-truth pulled from the live engine + DB (`curl` PostgREST). **Pure web — no engine/data/Python touched** (`financial_health.py` unchanged; `medians.server.ts` is TS). These read fundamentals/cycle, so local dev IS representative (cycle path via dev `useLocalCompute`; the radar is the only cycle-gated piece and renders fine).
- **(a) Radar (row 6) — reads correct.** Engine FH recomputed and matched: AAPL 81.0 / BHP 84.5 / SHOP 83.2 (all 5 pillars), **BAC 74.2 (3 pillars, BS+CF withheld)** — the insufficient-data/withheld-pillar state (S3 P3) confirmed live (triangle + "—" + "Not scored… banks & REITs" caption). **Fixes:** (i) added the missing `role="img"` + dynamic `aria-label` (check #9 — every other chart had one; reflects only real pillars, so BAC reads 3); (ii) **per-pillar InfoTips (owner)** — the 5 right-hand bars moved from invisible native `title=` to the InfoTip primitive, `.radar-axis-label` → `inline-flex` for icon alignment. Pillar identity colours left as-is (reference parity #1). Verified: SSR aria-label (5 vs 3 pillars), 5 InfoTip triggers, DOM shows no label overflow at 120px, screenshot of the clean pentagon + 5 ⓘ bars, 0 server errors.
- **(b) Sanity-bounds (owner: all recommended) — display-only.** Extended `MetricDef.cap` + `OUTLIER_BOUND` across all displayed metrics (P/E 150x, EV/EBITDA 150x, PEG 25, FCF Yield 100%, Op/Net Margin 300%, ROE 300%, ROA 300%, D/E 25, Current Ratio 25; growth already 300; medians cache v3→v4). Dividend History: Payout Ratio cap 300% + **distress-yield treatment** (yield >20% shows the real value in amber + ⚠ + caution tooltip, not reassuring green). **GEM.AX traced:** 40.74% is the honest trailing yield ($0.055 DPS ÷ collapsed A$0.135 price), not a yfinance artifact. FH clamps these inputs (ROE 8457→100) so ratings are unaffected. Verified curl SSR: TFX `>+150x`/`>+300%` (+ "Actual … capped for display" titles), GEM 40.74% amber+⚠, SHOP 107.6x uncapped.
- **(c) Source name removal (owner reversed the plan).** Owner: *"don't use the name Yahoo Finance anywhere — we don't want to advertise where the data comes from."* So instead of adding provenance labels, **removed the name** from the 5 visible mentions (StockHeader badge title + rating InfoTip, AnalystTargetTrack, NewsFeed, OnboardingModal), keeping the "third-party data, not our rating" framing (decision #17). Code comments + Python `yfinance` provider names stay (internal). **OPEN ITEM flagged to owner:** Latest-News article links still point to `finance.yahoo.com` hrefs (the real article URLs) — no visible label, but the destination reveals it; left functional pending owner call.
- **(d) Radar refinements (owner, after reviewing the live PR #31 screenshot — 3 asks):** (1) **explained the FH calc + surfaced the weights** — the Health Score IS the weighted pillar mean (no math discrepancy; the *weights were just invisible*), so the bars now show each pillar's weight + the card ⓘ/subtitle state the formula; (2) **pillar colours → score-based tiers** (`tierColor()`, deviating from the reference's identity colours so Shareholder isn't red at 100 — owner-approved); (3) **labels moved off the plot** (radius domain 0→120 headroom + outerRadius 68% + 10px outward nudge). Verified live (SHOP DOM: weights 30/25/20/15/10, Shareholder 75 green not red, Cash Flow 53 gold; screenshot: labels clear of the pentagon). Owner signed off (1)+(2) via AskUserQuestion; (3) is layout.
- **Verified:** `pnpm typecheck && lint && build` green; `web/.next` cleared before the dev server (post-build §12 gotcha). 0 server/console errors. **STATUS: ✅ MERGED + LIVE** (PR #31 → main `ab66b0b`; PR #30 Smart Money empty-data fix → main `3ca8f5c`). Prod health-checked green.

### Thesis re-audit — StockHeader/KPI/Verdict/CompanyOverview/ThesisInsights (rows 1–5) (2026-06-10) — built + locally verified, PAUSED for owner merge
Re-audited the five Thesis components (rows 1–5) against the 9-check def. These were built earliest (S0) + signed off in S1, **before** the S3 engine changes (quality-gated valuation, "Cycle Payoff" rename, insufficient-data/withheld pillars) and the standing explain-before-build directive. Owner signed off all three fixes via AskUserQuestion **before** building (standing directive); ground-truth from the live engine (`web/api/cycle.py` CLI, env from `web/.env.local`, Python 3.14). **Pure web — no engine/data/Python touched** (`web/lib/format.ts`, `VerdictCard.tsx`, `ThesisInsights.tsx`). Branch `feat/thesis-reaudit` off main `ab66b0b`.
- **Reads-correct, no change:** StockHeader (row 1) + KpiStrip (row 2) + CompanyOverview (row 4). Confirmed every value reflects the post-S3 engine: gated `overallRating`, `Health Score → "—"` when FH withheld, "Cycle Payoff (25%)" tooltips, source name already gone (S9).
- **Fix 1 — dynamic lookback (owner: clear bug).** `VerdictCard.sentence1` (DEEP-VALUE branch) and `ThesisInsights.buildRisks` ("Near …-day highs") hardcoded the literal **"252-day"**, but the lookback is preset-dependent (Short 63 / Medium 252 / Long 756); KpiStrip + DrawdownOverlay were already fixed to interpolate `cycle.params.lookbackBars`, these two were missed. Now both interpolate `lookbackBars`. **Verified:** FMC Verdict reads `63 / 252 / 756-day peak` across short/medium/long; KO Key Risks `Near 252-day highs` (medium) → `Near 63-day highs` (short).
- **Fix 2 — value-trap gate on the Why-Attractive cheapness bullet (owner: "gate the cycle bullet on FH").** `buildAttractive`'s *"Trading at or below its historical average dip — historically attractive entry zone"* fired purely on cycle position (`dd ≤ typical`), with **no FH input**, and was tagged **Strong ★★★** (pushed first). So a value trap (live FMC: FH 21.3, dd −74.5%, the S3 quality-gate already knocked it to **Cautious 43**) still led the Why-Attractive card with a Strong "historically attractive entry zone" — the S3 fix had reached the *score* but not this *narrative*. Now the bullet is **dropped when FH is weak (`< 50`) or withheld (`null`)** — the same "stressed" line the Verdict's `s2` uses. **Verified:** FMC → bullet absent (Why-Attractive falls through to "532 confirmed pullback events…"); SHOP.TO (FH 83) → bullet present + Strong, screenshot confirms. Owner declined the optional zone-badge qualifier, so the `DEEP VALUE` badge + Verdict `s1` are unchanged (the Verdict self-tempers via `s2`/`s3`).
- **Fix 3 — S9 sanity caps on the Thesis narrative numbers (owner: all recommended).** `bestStrength`/`topRisk` (Verdict) + `buildAttractive`/`buildRisks` (Insights) interpolated raw fundamentals (ROE, op/net/gross margin, FCF yield, D/E, PEG, growth) — uncapped, so yfinance absurdities (documented ROE 8457%, op-margin −546,607%) would render as confident headlines. Added a shared **`fmtCapped(value, cap, decimals)`** to `web/lib/format.ts` (mirrors `MetricDef.cap`/design-system §9): ROE/margins/growth **300**, FCF Yield **100**, D/E & PEG **25**. **Display-only** — the firing thresholds still test the raw value. **Verified:** CL (ROE 363.6) → "Exceptional ROE of **>300%**" (vs Key Metrics' own S9 `>+300%`); SHOP 34.3% growth uncapped. `riskInvalidation` has no raw-value display (threshold copy only) — untouched.
- **Verify harness:** SSR via `curl localhost:3000/stocks/...` across FMC/CL/KO (us), SHOP (ca), BHP (au) + `?preset=short|long` — Thesis cycle sections render in dev via `useLocalCompute` (spawns cycle.py); curl avoids the heavy-ticker browser wedge. One Claude-Preview screenshot of SHOP's Why-Attractive/Key-Risks confirms no layout regression (text-only edits to existing elements). `pnpm typecheck && lint && build` green; `web/.next` cleared post-build before the dev server (§12 gotcha). 0 server errors.
- **STATUS: built + verified, all CI gates green locally. PAUSED for owner merge confirm** (live-site rule). Instant-revert target after merge = main `ab66b0b`. Files: `web/lib/format.ts`, `web/components/stocks/VerdictCard.tsx`, `web/components/stocks/ThesisInsights.tsx`, `docs/layer-c-audit.md`, `docs/design-system.md`.

### Thesis follow-up — no-contradiction statement engine + entry-zone + page-wide price formatting (2026-06-11) — extends PR #32, PAUSED for owner merge
Owner-driven refinements after the re-audit. Approved plan (`.claude/plans/things-that-i-want-twinkly-dahl.md`); design questions signed off via AskUserQuestion **before** building. Same branch `feat/thesis-reaudit` (extends PR #32 — builds on its `fmtCapped` + value-trap gate). **Pure web + docs — no engine/data/Python touched.**
- **Contradiction-free statements (owner: "never contradicts; if something can, remove it; show me the full catalogue").** Root cause: ungated "fill the card" fallbacks asserting a metric claim without checking the value (e.g. SHOP showed *"Accelerating revenue growth 34%"* AND *"34% is modest"*). Fix = the two rules now in design-system §9 (disjoint thresholds per metric + fallbacks never assert). Changes: `buildRisks` modest-growth is now a **gated** risk `[0,15)` (not a fill), the fill-to-3 is removed, and an empty card shows **one tautological caveat**; `buildAttractive`'s entry-zone bullet gains a `tdd ≤ −5` guard (disjoint from "near highs"); its empty-state is a factual cycle line; `bestStrength` net-margin branch gains a `≥ 10` floor + a composite fallback ("a solid overall financial-health profile"); `topRisk` modest-growth gated `[0,15)` + a safe cycle-caveat final fallback; `riskInvalidation` gains the gated growth branch + safe fallback, and is suppressed on the caveat-only card. **Full statement catalogue is in the approved plan file.** **Verified empirically:** a sweep over **all 720 tickers** found **0 contradictions**; every ticker lands in exactly one revenue-growth bucket (177 accelerating / 426 modest / 109 declining / 8 none). SSR: SHOP "is modest" gone (now the cycle caveat as primary risk); FMC entry-zone still absent.
- **Verdict entry-zone band (owner).** Was centred on the typical dip (extended *above* it — triggered before the stock even reached its average dip). Now **top = typical-dip price, bottom = 85% of the distance toward the lower bound** (`priceAt(typDD + 0.85·(lb − typDD))`); Reload (lowerBound) + Invalidation (5% below) unchanged, sit below the band. Tile copy "centre"→"top". Verified FMC band $12.77→reload $9.01→invalidation $8.56; AAPL/SHOP bands sane.
- **Verdict ticker suffix (owner).** Eyebrow `MajorCycle Verdict · {ticker}` → `tickerToUrlParts(ticker).symbol` — shows `SHOP` not `SHOP.TO` (market already in header; matches Browse). Verified eyebrow "MajorCycle Verdict · SHOP". (PriceChart title + Relative-Performance legend still carry the full storage ticker — chart series labels, out of scope.)
- **Page-wide price formatting (owner: "header + any other parts; consistent everywhere; check Browse").** New shared `fmtPrice(n, currency)` + `fmtPerShare(n, currency)` in `web/lib/format.ts` (both `Intl`-based → correct `$`/`A$`/`CA$`). Applied to StockHeader, WeekRangeGauge, AnalystTargetTrack, TechnicalLevels, VerdictCard, ThesisInsights (`fmtPrice`) + EarningsHistory, DividendHistory (`fmtPerShare`); removed three local `currencySymbol`/`formatPrice` helpers. **Bugs fixed:** DividendHistory/EarningsHistory hardcoded `$` (BHP now `A$1.71`); Browse `formatMarketCap` CAD `C$`→`CA$`.
  - **First shipped as magnitude-aware with a live-vs-level split (≥$100→0dp for levels, cents for the live quote). Owner then flagged it looked inconsistent** — within one group the decimals flipped at the $100 line (a `$95.20` analyst target beside a `$120` one). **Revised to uniform 2 dp** (`fmtPrice` = exactly 2 dp ≥ $1, more only < $1; dropped the `minDecimals` param + the ≥$100→0dp tier + the live/level distinction). Finance-standard, never mixes. ("Whole ≥ $1" was rejected — rounds low-priced stocks coarsely, e.g. $4.30 DMA → "$4".) See design-system §9 "Price formatting".
  - **Verified SSR (uniform-2dp):** AAPL header `$301.54`, band levels + all three analyst targets 2 dp (no mixing); GEM.AX sub-$1 → `A$0.13`/`A$0.135` (no `A$0`); BHP Annual DPS `A$1.71`; FMC "Now $11.10".
- **Rows 1–5 impact:** StockHeader/WeekRangeGauge/AnalystTargetTrack price format; VerdictCard (statements + band + ticker + prices); ThesisInsights (statements + prices); EarningsHistory/DividendHistory (per-share currency); StockBrowser (CAD symbol). `pnpm typecheck && lint && build` green; `web/.next` cleared post-build before the dev server (§12).
- **STATUS: built + verified (sweep + 6-ticker SSR + screenshot), CI gates green locally. PAUSED for owner merge confirm.** Extends PR #32 — same instant-revert target main `ab66b0b`. **(Merged → main `68ff85d`.)**

### S10 — Methodology modal + session polish (2026-06-13/14) — PR #34, all green
Branch `feat/s10-methodology-modal` off main `68ff85d`. **Pure web + docs — no engine/data/Python touched.** One PR accumulating the whole session; explain-before-build honoured throughout (plan-mode + AskUserQuestion for each design fork). Commits `7eb51d9`→`fb7f7dd`.

- **Methodology modal (the S10 item).** First attempt built a PUBLIC `/methodology` page full of formulas (PR #33) — **owner redirected and it was closed/deleted**: the methodology must be an **in-app modal** opened from the Stock Detail subnav "Methodology" button (signed-in only — "don't give all the info without signing up"); a separate high-level/no-formula PUBLIC page is deferred to **Layer F**. `reference/original-design.html:794-846` already specifies this modal — reproduced its LOOK with content corrected to the post-S3 engine + compliant tiers. New `web/components/stocks/MethodologyModal.tsx` on the existing Radix `Dialog`; static/general (no cycle-data coupling). Sections: Overall = 40/35/25 + the 5 tiers (`--c-tier-*` hex, compliant labels) → Financial Health pillars (omit-and-renormalise, withhold <3) → value-trap-gated Valuation (`0.30 + 0.70·(FH/100)^1.5`) → Cycle Payoff (reliability + reward/risk, **not** momentum; points to the Drawdown/Profit-Recovery charts) → Verdict entry-zone band. **No forbidden words.** Wired the (disabled) subnav button to open it; re-applied the stale `OnboardingModal` Valuation-line fix.
- **Audit polish on the modal (owner-reported).** (i) **z-index** — Dialog overlay+content were `z-50` but Sidebar=`z-100`/Header=`z-99`, so the chrome painted OVER the backdrop (sidebar/header un-blurred, modal left edge clipped); bumped `ui/dialog.tsx` overlay+content to **`z-[200]`** → modal now centres over the full screen with everything behind blurred (also fixes the latent OnboardingModal stacking bug). (ii) **3 missing spaces** after inline `</strong>`/`</em>` where the next text wrapped (JSX whitespace collapse) → explicit `{' '}`. (iii) mobile side-margins (`w-[calc(100%-2rem)]`). (iv) subnav icon `BookOpen`→`ShieldCheck` (matches the modal + reference).
- **Modal copy + section-nav (owner).** "Valuation (35% pillar)"→"Valuation (0–100)"; footer reworded (dropped "nothing is computed off-screen"). **Fixed a pre-existing nav bug:** the subnav "Cycle" pill had **no `#sec-cycle` element** (cycle charts sat unwrapped) → clicking did nothing; wrapped them in `<section id="sec-cycle">`. **And** the scroll offset was `58+12=70` but the sticky chrome is header 58 + sticky subnav ~47 = 105, so every section landed ~35px behind the bar → bumped to **120** (matches the sections' `scroll-mt-[120px]`). Verified all 5 pills land cleanly.
- **Brand logo everywhere.** Replaced the placeholder gradient-box "M" SVG with the real `reference/logo.png` (via `next/image`) in the Sidebar, public/auth layout, OnboardingModal; added favicon `app/icon.png` + `favicon.ico`. Then **re-cropped** the served copies tight to the icon (source had ~16% transparent margin → filled only ~67% of its box). `reference/logo.png` left pristine. See CLAUDE.md #27 + design-system "Brand logo".
- **Drop `.AX`/`.TO` from user-facing labels.** New `tickerDisplay()`/`marketLabel()` in `lib/ticker.ts`. Browser-tab `<title>` → "SHOP · TSX — Shopify Inc. | MajorCycle" (also fixed a double-brand bug — the root title template already appends "| MajorCycle"). Price-Chart heading + Relative-Performance legend → the **bare symbol** ("SHOP") per owner. See design-system "Ticker display".
- **Adaptive number formatting — no "0M"/"0B" collapse (owner-reported, SEK.AX).** New shared **`fmtCompact(value, currency?)`** (adaptive K/M/B/T, mantissa always ≥ 1) in `web/lib/format.ts`. **BalanceSheet** was the headline bug (chart pre-divided by 1e9 + axis hardcoded `$${v}B` → small-cap axis all "$0B"): now plots raw, adaptive axis/tooltip/Net-Cash, currency-aware. Also fixed `OwnershipStructure` ("0.0M" shares → real count; header "Shares (M)"→"Shares"), `QuarterlyFinancials` (+`currency` prop), `StockBrowser` (`formatMarketCap`). The "one institution at 50.57%" is a **yfinance data limit**, not formatting. Prices/%s/multiples were already safe — untouched.
- **Uniform decimals on compact axes (owner: "whole when whole").** Per-value `fmtCompact` mixed "70.0M" beside "140M" on an axis. New **`makeCompactAxisFormatter(axisMax, currency?)`** — one unit + one dp per axis (0 dp when whole, uniform 1 dp when fractional); dp from a **nice-rounded** step (`ceilNiceStep`, because recharts nices its top tick — raw `dataMax/4` is unreliable). Applied to the only 2 compact-unit axes (BalanceSheet:131, QuarterlyFinancials:185), each computing `axisMax` from the currently-plotted values (BalanceSheet reacts to legend toggles + accounts for stacked bars). Off-axis keeps per-value `fmtCompact`. Verified across SEK.AX (FCF A$70M…A$280M, cash-only A$85M…A$340M, all-series A$1.5B…A$6.0B) + AAPL ($95B…$380B).
- **Verified throughout:** `pnpm typecheck && lint && build` green on every commit; CI (Frontend/Python/Vercel) green; Claude-Preview DOM + screenshots on SEK.AX (small-cap) + AAPL (large-cap) + Browse; `web/.next` cleared post-build before dev (§12). Docs synced: roadmap (S10 ✅, Layer C complete), design-system §9/§15 + Ticker-display + Brand-logo, coding-standards §12 (3 new anti-patterns), CLAUDE.md #27 (logo), this tracker.
- **STATUS: ✅ all green on PR #34 — owner authorised merge-live.** Instant-revert target = main `68ff85d`. **→ Layer C COMPLETE.** Next: Layer D (Run Analysis) or as owner directs. Deferred: the public high-level/no-formula methodology page (Layer F).

---

## 🔁 REOPENED — round 2: production-readiness re-audit (owner, 2026-06-26)

Layer C's round-1 audit (S1–S10) used a **9-check** model. Since then, Layers **D**
(`docs/layer-d-audit.md`) and **E** (`docs/layer-e-audit.md`) audited their tabs against
a stronger **10-check** model and added techniques Layer C never applied. The owner
reopened Layer C to bring the Stock Detail page up to that same bar, **plus** fix the
**Download Report** button and do a systematic null-data render sweep + a live tail.

### What D & E did that Layer C's round-1 audit did NOT (the gap to close)

| # | New in D/E | What Layer C did in round 1 | Round-2 action for Layer C |
|---|---|---|---|
| 1 | **Deep keyboard-a11y** — every interactive control fully operable: `aria-sort` headers, the full `role=combobox/listbox/option` + arrow-key + `aria-activedescendant` pattern, `role=menu`/`aria-haspopup`/Esc dropdowns, `role=dialog`/focus-trap/Esc, `aria-pressed` toggles, `aria-live`/`role=status` regions, drop-zones as `role=button`+key handlers. | **"A11y (light)"** — only chart `aria-label` + `focus-visible`. | Full keyboard-operability pass on every Stock-Detail control: `StockSubnav` anchor pills + the 2 action buttons, the chart **range buttons** (PriceChart / SmartMoney / DrawdownOverlay 1Y/3Y/All), the **SmartMoney day-panel** + **MethodologyModal** dialogs (focus trap/Esc/return-focus), `WeekRangeGauge`, `MetricsTable`, InfoTips (re-confirm). |
| 2 | **Formal perf check** re-verified **live** (E: 700+ rows snappy; D: 0-skip reliability on a real deploy run). | Page-load perf was a **cross-cutting item** (streaming + parallel fetch, S4) — not a per-surface check, and not re-verified live recently. | Make perf a formal check: re-verify Stock-Detail cold + warm load (US/AU/CA) on **prod** — no jank, Suspense sections stream, charts mount cleanly. |
| 3 | **Formal compliance check** — labels #16 + analyst verbatim #17 + **disclaimer #4/#12 visible without scrolling**, asserted per surface. | Compliance was verified implicitly via Parity/Data, not as a dedicated check; **no explicit "disclaimer above the fold" assertion** for Stock Detail. | Formalise: confirm only the 5 compliant tiers in our output, analyst verbatim, and an "information only — not advice" disclaimer **visible without scrolling** (VerdictCard has an inline one — confirm it's above the fold on load across viewports). |
| 4 | **No-recompute / nothing-persisted (#15)** asserted via a **SQL *negative*** (E confirmed `analysis_runs.results` IS NULL; nothing stored). | Data check verified DB values (the *positive*); never asserted #15 for the detail page. | Assert #15 for Stock Detail: cycle/scores are derived **on-demand** by `cycle.py`; only raw price + fundamentals are stored — confirm no rating output is persisted. |
| 5 | **Systematic edge/empty enumeration** as a matrix (E #8: no-run / all-skipped / no-match / hydration / partial / single-row). | Per-component empty states were done **piecemeal** (good, but ad-hoc). | **Owner ask:** a **systematic null-data render sweep across ALL ~25 Stock-Detail components** — render each with null/missing data, **verify it VISUALLY in Claude Preview** (looks nice + consistent page-wide, not just "no crash"), and **LIST every null case for the owner to eyeball** before fixing. No "NaN"/"$0"/"Invalid Date", no empty bars, no fabricated values; card hidden or honest empty-state. Fix what's flagged. |
| 6 | **Deploy-gated live tail via Claude-in-Chrome** — drove the **live** site (real run, live states) as part of the audit. | Some prod verification (RSC-crash via `get_runtime_logs`, health checks) but **no formal live walk** of Stock Detail. | **Owner ask:** live-check Stock Detail end-to-end on www.majorcycle.com (US/AU/CA + a bank/REIT + a sparse/short-history ticker) — every section renders correctly, no console errors. |

### Round-2 scope (next session)

- **C-R1 — Download Report button (fix the placeholder).** `StockSubnav.tsx` (lines ~151–160)
  is a **disabled "Coming soon"** button (`disabled` + `aria-disabled` + `Download` icon) —
  same shape as the old Excel "SOON" placeholder. Implement a real per-stock report download.
  **Decide the format with the owner** (client print-to-PDF of the page · a generated HTML
  report · a styled PDF/RTF) and the contents; then remove the disabled state. Mirrors the
  E10 pattern (client-side download). *(The `anthropic-skills:investment-research-report`
  skill generates a full HTML equity report — reference only; the detail-page "report" is a
  snapshot of THIS page's analysis, scope TBD with owner.)*
- **C-R2 — Null-data render sweep (check 5).** Systematically render every Stock-Detail
  component with null/missing inputs (banks/REITs → withheld FH pillars; AU tickers → null
  short interest; non-payers → no dividends; spin-offs → short history; missing analyst
  targets/news/overview). **Verify each null state VISUALLY in Claude Preview** (real
  tickers that exercise each null + seeded/edited fixtures for the rest) — not just "no
  crash" but that it *looks nice* and is **consistent across the page** (every empty card
  uses the same honest empty-state pattern / hidden-card rule; no lone "—" floating in an
  otherwise full card, no half-empty grids). **Produce a LIST of every null case for the
  owner** — `component → which field(s) null → how it renders (screenshot/desc) → verdict`
  — so the owner can eyeball each before any fix is agreed; then fix what's flagged.
- **C-R3 — Deep a11y pass (check 1).** Apply the D/E keyboard-a11y depth to all Stock-Detail
  interactive controls (table above).
- **C-R4 — Formal perf + compliance + #15 (checks 2/3/4).** Re-verify live load perf; assert
  the disclaimer-above-the-fold + compliant labels; confirm nothing-persisted.
- **C-R5 — Deploy-gated live tail (check 6).** Live walk on prod across US/AU/CA + a
  bank/REIT + a sparse ticker, like D & E.

**Audit model:** keep the 9 round-1 checks **+** the D/E additions above (effectively the
10-check model). Engine stays UNTOUCHED unless a methodology change is proposed + signed off
first. Pause-before-merge; explain-before-build; self-verify; the live tail is **deploy-gated**
(after the round-2 fixes merge). Tracker continues here.

### Owner additions to round-2 scope (2026-06-27)

- **C-R6 — Drawdown/Profit bound correctness (TUA.AX).** Owner: the TUA Lower Bound looked
  wrong (Sept-2020 deeper than June-2022 yet not reflected). Investigate + fix.
- **C-R7 — Stock-split price-history handling.** The daily refresh re-pulls only the last 5
  days, so a split *after* the initial full fetch leaves a two-scale history → fake crash. Add
  split detection + full re-pull + a one-off backfill. (TUA is NOT a split — see C-R6.)
- **C-R8 — Stock Browser tab (`/stocks`) full 10-check audit** as a new Layer C surface.
- **C-R5 live tail** now also covers TUA + Browse.

### Owner additions to round-2 scope (2026-06-28)

- **C-R9 — Smart split-adjustment verification + dated backend state (NEXT SESSION, plan mode).**
  C-R7's split detection re-pulls on every nightly run while a split is inside the 1-month
  incremental window, **with no record and no "is it actually fixed?" check**. Two problems the
  owner hit on **DD** (see the session-2 log entry): (a) it keeps re-pulling for 30 days even after
  the data is already correct (wasteful), and (b) **nothing is recorded in Supabase**, so the owner
  can't see what the pipeline is doing. **New logic the owner wants:**
  - After a detected split is re-pulled, **verify the discontinuity is actually resolved** (the
    series is now continuous at the split). If resolved → **mark it done and STOP re-pulling** (don't
    keep hammering for 30 days).
  - If NOT resolved (yfinance served unadjusted prices, as with DD) → keep the **30-day retry**
    window; **after 30 days still unresolved → notify the owner** that this ticker's data didn't
    update correctly.
  - **Record dated split-handling state in Supabase** (detected_at / split_date / ratio /
    last_repull_at / status pending|resolved|failed / resolved_at or similar) so the owner has
    **backend visibility** into exactly what happened and when.
  - **Data-pipeline only — NOT a methodology/cycle-formula change** (no `analytics/scoring` /
    `major_cycle.py` edit; like C-R7). Likely needs a new Supabase table/columns (migration) +
    `daily_refresh.py` logic + a notification channel (Resend is available — channel is a design
    fork). Owner: **"I don't want to do anything manually"** — no hand-editing of price data; the
    fix must be the automatic pipeline detecting + reporting. START IN PLAN MODE; agree the schema +
    notification approach first.
- **C-R1 — Download Report REDESIGN (session after C-R9).** The first cut (built + verified this
  session — see session-2 log) shipped **two** export modes (Save-as-PDF via `window.print()` + a
  **static** HTML snapshot with charts flattened to `<img>`). **Owner redirected:**
  - **DROP "Save as PDF" entirely.** A static print can't capture interactive/hidden content (full
    price history needs pan/zoom; the Drawdown vs Profit toggle hides one series; chips switch data)
    → a PDF/static snapshot is "useless".
  - **HTML export ONLY, and it must be FULLY INTERACTIVE offline** — the downloaded `.html` must
    **behave exactly like the live site**: the top section-nav works, charts **pan/zoom + show full
    price history**, **chips/toggles** switch data, and **every tooltip works (normal title tips +
    the custom InfoTips)**. Anything you can do on the live page, you can do in the offline file.
    (The current `report-download.ts` canvas→`<img>` approach is the OPPOSITE of this and will be
    largely replaced — a static image isn't interactive.)
  - **Button styling:** the Stock-Detail "Download Report" button must look like the **Results-tab
    Export button** — the brand-**blue** gradient `.export-btn` (`globals.css:1253`,
    `linear-gradient(135deg, var(--brand-mid), var(--brand-deep))`, white text), NOT the current
    outline button. (`StockSubnav.tsx`.)
  - This is a substantial technical problem (a self-contained, offline, *interactive* React page —
    not a snapshot). START IN PLAN MODE; design the approach with the owner before building. Reuse
    what still fits from the first cut: the report route scaffolding, the `web/lib/horizon.ts` shared
    util, the subnav wiring; rework the export + drop the print path.

## Round-2 session log

### C-R6 — drawdown/profit bound investigation + first-lookback warmup fix (2026-06-27) — built + verified locally, engine change OWNER-APPROVED

Branch `feat/layer-c-round2` off the docs branch (`13162b4`, which carries the PR #45 reopen
docs). **Investigated TUA.AX with real data, two owner forks, landed one engine fix.**

- **First hypothesis (split) — REJECTED by evidence.** TUA's −63% drop (2026-05-18, $6.10→$2.27,
  ~30× volume) is a **real crash**: live yfinance shows **no splits** and a fresh `max` pull
  matches the stored bars. So TUA is not a split/stale-data case (that mechanism is real but
  uncorrupted here → still fixed proactively as **C-R7**).
- **Owner fork 1 (envelope the live value into the bound) — BUILT then REVERTED.** Owner decided
  a current drawdown piercing the "deepest confirmed" line is *informative* (this dip is the
  deepest since any confirmed prior one), so the math should NOT envelope the current. Reverted
  cleanly (`git checkout`), no trace.
- **Root cause of the TUA Lower Bound = `min_periods` warmup.** `ta_highest`/`ta_lowest` used
  `min_periods=length`, blanking each stock's first lookback window (Short 63 / Medium 252 /
  **Long 756** bars). So early dips are never measured → excluded from `lower_bound`/`typical`/
  events. This also **diverges from the docstring's Pine `ta.highest` claim** (Pine uses available
  bars in warmup) and from the **client chart** (`DrawdownOverlay.computeDrawdown` uses available
  bars from bar 0 → the curve shows early dips the engine bound ignores → curve dips below its
  own bound line).
- **Owner fork 2 (fix the warmup) — APPROVED + DONE.** `min_periods=length → 1` in both
  `analytics/major_cycle.py` and `web/_engine/major_cycle.py` (drift-checked in sync). Records
  early **confirmed** cycle events. **Impact (before→after, isolated via git-stash on today's
  data):** all Overall **labels unchanged**; only AAPL 70→69 (still Constructive, from a tiny
  `typical` deepening); mature-stock bounds unchanged; **TUA Long bound −31.3% → −53.4%** (the
  756-bar warmup had been dropping ~3 years of its history), events 38→70. Full table +
  rationale recorded in `docs/methodology-audit.md` "C-R6 — first-lookback warmup".
- **TUA Medium bound stays −53.45%** (owner's original case): the −58% Sept-2020 low is a 1-day
  **V-spike that never satisfies the 5-bar pivot confirmation** — a denoising choice, not a
  warmup artifact. So the Lower Bound = deepest **confirmed cyclical** low; the curve can still
  dip below it on a sharp spike or the live ongoing dip (the latter intended/informative per the
  owner). Relabelling the line was offered + not taken.
- **Verified:** `pytest` (50, incl. updated `ta_highest`/`ta_lowest` warmup tests), `ruff`,
  `mypy`, and the `_engine` drift check all green. Engine before/after captured on
  TUA/AAPL/BHP/SHOP/BAC. Web charts unaffected (the client already used available bars).
- **Still pending in C-R6/related:** owner to eyeball the TUA charts live in C-R5; **C-R7**
  (split handling) next.

### C-R7 — stock-split price-history handling + a zero-close data bug (2026-06-27) — built + verified locally

**Forward fix + backfill BUILT, all Python CI green.** Engine cycle math UNTOUCHED — this is
data-pipeline hygiene (`analytics/cron/*`, not `major_cycle.py`/scoring).
- **Root cause** (same mechanism as the rejected C-R6 split hypothesis): `daily_refresh.py`
  re-pulled only the last 5 days on incremental runs and upserted them, so a split *after* a
  ticker's initial `max` pull leaves older bars on the pre-split scale → permanent fake gap.
- **Forward fix** (`daily_refresh.py` + `yfinance_provider.py`): detection uses yfinance's
  **authoritative split calendar**, not a price heuristic (owner flagged an 8% price-ratio as
  dodgy — a real stock can drop 8% without a split). The provider reads the `Stock Splits` actions
  column from the incremental fetch and surfaces split dates on `df.attrs['recent_splits']`;
  `daily_refresh._recent_splits(df)` checks it, and a non-empty list triggers a full `max` re-pull
  that overwrites the whole series re-adjusted. Incremental window widened `5d → 1mo` so a split in
  the last month is in the window. A normal price move never appears in the split calendar → no
  false positives. 4 unit tests (`test_daily_refresh.py`); live-verified the provider extracts
  **DD's real 2026-06-24 split** (`['2026-06-24']`) while AAPL returns `[]`. ruff+mypy+pytest(54) green.
- **Backfill** (`analytics/cron/fix_split_history.py`): one-off re-pull of full `max` history for
  `--ticker` / `--tickers` / `--all` (reuses `_get_supabase`/`_upsert_price_bars`). Safe on
  correct tickers (rewrites identical data).
- **Universe scan (MCP SQL) — no current differential split victims.** Recent (2026) big
  consecutive-day jumps are all either **real moves** (ZS −31%, SMCI −33%, COH.AX −41%, TUA −63%)
  or **yfinance-non-bridged corporate actions** (DD/DuPont: a 1-for-3 reverse split dated
  2026-06-24 that fresh yfinance auto_adjust *also* shows as a $48→$143 jump → our stored matches
  fresh, not the incremental bug). Older (pre-2026) jumps sit inside each ticker's single `max`
  pull (consistently adjusted) → not the bug. So the bug is **latent**; the forward fix guards it
  and the backfill repairs any future victim with one command.
- **SEPARATE data bug found + FIXED (owner-approved):** exactly **2 zero-close bad bars** in the
  universe — **CM.TO 2001-12-26** and **ENB.TO 2003-05-19** (`close=0.0`, a yfinance glitch
  surrounded by normal ~$9/~$4 prices). A $0 close = a −100% drawdown bar that became the
  confirmed pivot → **both tickers' Long-preset `lower_bound` = −100.0** (corrupt). Re-pull
  doesn't help (yfinance still serves the 0). **Fix:** drop non-positive-close bars in BOTH
  download paths of `analytics/providers/yfinance_provider.py` (yfinance + stooq) + deleted the 2
  stored bad bars via MCP. **Verified:** ENB.TO Long bound −100 → **−39.7%**, CM.TO −100 →
  **−62.3%**; both Overall ratings **unchanged** (44 Cautious / 58 Neutral — the bad bar corrupted
  the displayed bound line, not the rating). `yfinance_provider` is NOT in the `_engine` drift
  mirror (the Vercel fn doesn't bundle the fetcher), so no mirror edit. ruff/mypy/pytest(55) green.
- **C-R7 STATUS: built + verified locally, all Python CI green. Cron-side (split detection) is
  exercised on the next nightly `daily_refresh`; no current victim to repair. Pause-before-merge.**

### TASK 0 — C-R7 split detection VERIFIED LIVE end-to-end (2026-06-28)

The deploy-gated proof for C-R7. Today's prod cron (`Daily Data Refresh`, run 28272443624,
2026-06-27 00:15Z — *after* PR #46 merged 2026-06-26 16:26Z) logged the split path firing:
- `DD: stock split detected (2026-06-24) — re-pulling full re-adjusted history` → `DD | price+fund | bars=13630`.
- Bonus multi-ticker proof: also caught **FDX** (2026-06-01) and **KLAC** (2026-06-12) splits.
- **DD stored bars == fresh yfinance** (spot-checked 2026-06-18→26 OHLC to the cent; split
  `0.333333` = the real 1-for-3 reverse split on 2026-06-24; the $48→$143 jump is genuine, as predicted).
- **ENB.TO / CM.TO** now have **0 non-positive-close bars** (the −100% Long-bound cause is gone at the
  data layer; the *live* prod bound refreshes as the 1h cycle cache cycles → re-confirm in C-R5).

No backfill needed — the pipeline self-healed.

### C-R1 — Download Report (report route + both export modes + subnav wiring) (2026-06-28) — built + verified locally, PAUSED for owner merge

Branch `feat/layer-c-round2-report` off main (`b385180`). **Pure web — no engine/data/Python touched.**
Design was LOCKED last session (owner picked BOTH export modes; contents = full snapshot, every section).
- **New shared util `web/lib/horizon.ts`** — lifted `parseSpec`/`PRESET_LABEL`/`RouteSearch`/`isValidMarket`
  out of the detail `page.tsx` (now imports them) + added `horizonQuery(sp)` (re-serializes the window to a
  `?…` string; medium → clean URL). One source of truth for both pages.
- **New report route `web/app/(app)/stocks/[market]/[ticker]/report/page.tsx`** — server component under
  `(app)` (auth-gated by the layout for free). Reuses the same fetchers + section components as the detail
  page but **awaits the cycle once** (print artifact — no Suspense) and renders **every section** single-column
  inside `#report-root`: a report header (logo + ticker + horizon + generated-date + "Information only — not
  advice" disclaimer) + all 21 sections, each wrapped in `.report-section` (`break-inside: avoid`). `robots:
  noindex`. The `(app)` chrome (sidebar/header/app-disclaimer-strip) still shows ON SCREEN but is hidden in
  both export artifacts.
- **New client toolbar `web/components/stocks/ReportToolbar.tsx`** (OUTSIDE `#report-root`, class
  `.report-toolbar`): **Save as PDF** → `window.print()`; **Download HTML** → `downloadReportHtml(...)` (spinner
  while building).
- **New client helper `web/lib/report-download.ts`** — mirrors `downloadCsv`/`downloadXlsx`: clones `#report-root`,
  swaps every `<canvas>` (LWC) for an `<img>` of the **live** canvas `toDataURL` (cloned canvases are blank),
  inlines same-origin `<img>` (the logo) as data URLs **and drops their `srcset`/`sizes`** (next/image's srcset
  pointed at `/_next/image?…` and would beat the inlined `src` offline — caught in verification), embeds every
  same-origin stylesheet (Tailwind + globals + `:root` vars) into one `<style>`, blob → download
  `majorcycle_<SYMBOL>_report.html`.
- **Print CSS** appended to `globals.css`: `@media print { body * {visibility:hidden} #report-root,#report-root *
  {visibility:visible} … .report-toolbar{display:none} .report-section{break-inside:avoid} @page{margin:14mm} }`
  + `.report-doc`/`.report-header`/`.report-section` screen styles.
- **Subnav wiring** (`StockSubnav.tsx` + detail `page.tsx`): the disabled "Coming soon" `<button>` is now an
  enabled `<a href={reportHref} target="_blank">` (removed `disabled`/`aria-disabled`/"Coming soon"); `page.tsx`
  builds `reportHref = /stocks/<m>/<t>/report${horizonQuery(sp)}` and passes it as a prop.
- **Verified (Claude Preview, `DEV_BYPASS_AUTH`, removed after; `.next` cleared post-build):**
  - SHOP.TO (CA, non-payer), BAC (US **bank** → withheld-FH), BHP.AX (AU) report routes all **200**;
    each renders **21 `.report-section` + 21 canvases + 78 svgs + the logo**; report header correct
    ("SHOP · CA / Shopify Inc. / Horizon: Medium-term … / Generated 27 June 2026" + disclaimer). BAC's bank
    state carries through honestly (radar aria-label = only the 3 real pillars; "Not scored / not enough data").
    **0 console errors.**
  - **Download HTML proven end-to-end** (intercepted the blob): `text/html;charset=utf-8`, ~510 KB, `<!doctype>`,
    correct `<title>`, **22 inlined `data:image/png`** (21 charts + logo), **0 leftover `<canvas>` tags**,
    **0 `/_next/image` refs** (srcset fix), CSS inlined.
  - **Save-as-PDF** print rules confirmed in the CSSOM (only `#report-root` visible, `.report-toolbar` hidden).
  - Subnav: detail page no longer has "Coming soon"; the Download Report link = `/stocks/au/BHP/report?preset=long`
    (horizon carried; medium → clean URL).
  - `pnpm typecheck && lint && build` green (twice — incl. after the srcset fix).
- **C-R1 STATUS: built + verified locally, all CI green. Pause-before-merge / commit only when asked.**
  Files: `web/lib/horizon.ts` (new), `web/lib/report-download.ts` (new),
  `web/components/stocks/ReportToolbar.tsx` (new), `web/app/(app)/stocks/[market]/[ticker]/report/page.tsx`
  (new), `web/components/stocks/StockSubnav.tsx`, `web/app/(app)/stocks/[market]/[ticker]/page.tsx`,
  `web/app/globals.css`.

### DD investigation + owner redirects (2026-06-28) — split-adjust gap found; C-R9 added; C-R1 redesign

Owner reviewed DD live after the cron and reported its chart still shows the un-adjusted data while
**FDX/KLAC** (never visited before) show corrected data — and asked to investigate/fix.

- **Root cause = a yfinance data gap, NOT a cache.** `fetchStockDetail` (`web/lib/stocks.ts`) has **no
  persistent cache** (React `cache()` per-request only; reads the DB fresh via the
  `get_price_bars_json` RPC each request) — and DD renders wrong in **both** dev preview and live, so
  it isn't a prod cache. A discontinuity scan (`lag(close)` SQL) found DD has **one ~3× cliff at
  2026-06-18** (close 47.95 → 143.13, ratio 2.985), while **FDX/KLAC are smooth**. A **fresh** `period
  ="max"` pull (auto_adjust=True) **still** returns DD's cliff — yfinance lists DD's split (dated
  **2026-06-24**, ratio 0.333333 = a 1-for-3 reverse split) but **does not back-adjust the prices**
  (and note the date mismatch: the price cliff is **2026-06-18**, ~6 days before yfinance's split
  date). FDX/KLAC came back smooth because yfinance *did* adjust those. So **C-R7's re-pull can't fix
  DD — the source itself serves it wrong**; the cliff also injects a fake +199% one-day spike + a
  distorted drawdown window into DD's cycle math.
- **C-R7 detection re-fires every night (verified in code).** `daily_refresh.py` fetches a **1-month**
  incremental window (`_INCREMENTAL_PRICE_PERIOD="1mo"`, line 42) and re-checks the split calendar each
  run with **no "already handled" flag** (lines 252-261), so DD is re-pulled on **every** nightly run
  while its 2026-06-24 split is inside the 1-month window (until ~2026-07-24). **Conclusion to owner:
  it auto-heals with NO manual action *iff* yfinance corrects DD's adjustment within that ~1-month
  window** (the next nightly run then overwrites DD with the corrected series). Risks: yfinance may
  never line up the 06-24 split date with the 06-18 cliff, and after ~1 month the split ages out of the
  window so auto-healing stops.
- **Owner decisions (2026-06-28):**
  1. **"I don't want to do anything manually."** → No hand-editing of DD's prices. **Did NOT** apply a
     manual ×3 re-adjust. DD left to auto-heal via the pipeline.
  2. **Make the split logic SMART (→ new task C-R9, NEXT SESSION, plan mode):** verify the
     discontinuity is actually resolved after a re-pull and **stop re-pulling once fixed**; keep the
     30-day retry only for the still-broken ones; **after 30 days unresolved → notify the owner**; and
     **record dated split state in Supabase for backend visibility** (the owner currently can't see
     what the pipeline did). Data-pipeline only (no methodology change). See the C-R9 scope entry above.
  3. **Redesign C-R1 (session after C-R9):** drop Save-as-PDF; HTML-only and **fully interactive
     offline** (nav/pan-zoom/full-history/chips/tooltips all work, like the live site); button →
     brand-**blue** like the Results Export `.export-btn`. See the C-R1 redesign scope entry above.
- **State:** C-R1 first-cut code + this session's doc edits are **uncommitted** on
  `feat/layer-c-round2-report`. Next session (C-R9) should branch off **main** — preserve or set aside
  this WIP first so it doesn't pollute the C-R9 branch.

**Revised round-2 order:** **C-R9** (smart split + backend state, plan mode) → **C-R1 redesign**
(interactive-HTML report + blue button, plan mode) → C-R2 null sweep → C-R3 a11y → C-R4 perf/
compliance/#15 → C-R8 Browse audit → **C-R5 live tail (last)**. One task at a time.

### C-R9 — smart split-adjustment verification + dated backend state (2026-06-28) — built + verified locally, PAUSED for owner merge

> **Branch note:** this entry is on `feat/layer-c-r9-split-state` (off `main` `b385180`). The round-2
> session-2 scope/log (DD investigation, the C-R9 + C-R1-redesign scope blocks, the revised order) lives
> on the un-merged `feat/layer-c-round2-report` branch; the two will reconcile when both merge.

**Data-pipeline only — engine/methodology UNTOUCHED** (`major_cycle.py` / `scoring/*` / `web/_engine/*`
clean; neither changed Python file is in the `_engine` drift mirror). Owner decisions via AskUserQuestion
**before** building: **new `split_events` table** · **DB-record-only** (no email — a 30-day-unresolved split
just sets `status='failed'`, visible in the table). Plan: `.claude/plans/woolly-dazzling-hedgehog.md`.

- **Problem C-R9 fixes (from the DD case):** C-R7 re-pulled a ticker's full history on *every* nightly run
  while its split sat in the 1-month window, with **no "did it work?" check and no record**. DD exposed both:
  yfinance lists DD's 1-for-3 reverse split (2026-06-24, ratio 0.3333) but never back-adjusts the prices, so
  a fresh `max` pull still returns a ~3x cliff at 2026-06-18 → re-pulling can't fix it, yet nothing was
  recorded so the owner had no visibility.
- **Migration `supabase/migrations/20260628000000_split_events.sql`** (applied via MCP + mirrored to the
  repo). One row per detected split per ticker: `split_date / ratio / status (pending|resolved|failed) /
  detected_at / last_repull_at / repull_count / resolved_at / cliff_date / cliff_ratio`. Unique
  `(ticker, split_date)`; partial index on pending. **Server-only RLS** (enable, no policies — like
  `stocks`/`index_membership`; service-role bypasses). Advisor shows only the intended INFO
  `rls_enabled_no_policy` notice.
- **Provider (`yfinance_provider.py`):** surfaces the split **ratio** on a new
  `df.attrs['recent_split_events']` = `[{date, ratio}]` (the `Stock Splits` value), leaving `recent_splits`
  (dates) + its tests intact. Not in the drift mirror → no mirror edit.
- **`daily_refresh.py`:** new pure helpers — `_recent_split_events`; `_verify_split_resolved` (scans
  adjacent-day close ratios in a ±10-bar window around the split date for a leftover cliff matching the
  expected unadjusted factor `1/ratio` within ±20%; split-ratio-specific so a real crash/spike never
  false-fires; returns `(resolved, cliff_date, cliff_ratio)`); `_classify_split` (resolved→`resolved`;
  unresolved <30d→`pending`; ≥30d→`failed`) — plus DB helpers (`_load_pending_splits` up front,
  `_ticker_pending_splits`, `_record_split_detection` with `ignore_duplicates` so a resolved/failed row is
  never reopened, `_update_split_state`). **Main loop rewired:** detection records a `pending` row; the
  re-pull+verify is **driven by the pending set, not the 1-month window**, so a still-broken split keeps
  being retried for 30 days while a fixed one is **never re-pulled again** (kills the waste).
- **Verified (real prod Supabase, `--only DD,KLAC`):** **DD** → detected (ratio 0.3333), re-pulled 13,630
  bars, **`pending`**, `cliff_date 2026-06-18`, `cliff_ratio 2.985`. **KLAC** (real 10-for-1 forward, ratio
  10.0) → re-pulled 11,521 bars, **`resolved`**, `resolved_at` set. **Idempotency:** a 2nd run re-pulled DD
  (pending) but **skipped KLAC** (resolved row not reopened; `repull_count` stayed 1, DD's climbed). **30-day
  flag:** backdated DD's `detected_at` 31 days → run flipped it to **`failed`** (cliff still present, DB-only)
  → then **restored DD to its true `pending` state**. `ruff` + `mypy` (31 files) + `pytest` **63 passed**
  (8 new helper tests incl. the 30-day boundary + crash-not-misread guard) all green.
- **C-R9 STATUS: built + verified locally, all Python CI green, migration live on Supabase.
  Pause-before-merge / commit only when asked.** Files: `supabase/migrations/20260628000000_split_events.sql`
  (new), `analytics/providers/yfinance_provider.py`, `analytics/cron/daily_refresh.py`,
  `analytics/tests/test_daily_refresh.py`. Next = **C-R1 redesign** (interactive-HTML report + blue button,
  plan mode).
