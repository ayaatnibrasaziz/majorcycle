# Layer C — Stock Detail Audit Tracker

> Living checklist for the multi-session production-readiness audit of the Stock
> Detail page. See the approved plan for context and session sequencing. Update
> this file in the same PR as each session's fixes.

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
| 1 | StockHeader | Thesis | done (S0) | ✅ | Analyst badge lowercase→Title-Case fixed (format.ts). **S1: visually re-confirmed** — Buy/Hold/Buy on AAPL/BHP/SHOP. |
| 2 | KpiStrip | Thesis | done (S0) | ✅ | Values + tier colors correct. |
| 3 | VerdictCard | Thesis | done (S0) | ✅ | Faithful port; ring/peak/band math sound; inline disclaimer present. |
| 4 | CompanyOverview | Thesis | done (S0) | ✅ | Simple, correct; collapses when no overview. |
| 5 | ThesisInsights | Thesis | done (S0) | ✅ | "Strong Buy" insight now fires (fixed by analyst normalization). |
| 6 | SnowflakeRadar | Scorecard | S9 | ⬜ | Prior fix: label clipping + chart-h-radar CSS. Re-audit + insufficient-data state. |
| 7 | TechnicalLevels | Cycle | S7 | ⬜ | Recompute 50/200 DMA + Golden/Death-Cross. |
| 8 | PriceChart | Cycle | S7 | ⬜ | Candlestick + DMA colors vs design-system; §19 crosshair. |
| 9 | DrawdownOverlay | Cycle | S7 | ⚠️ | 🔧 **Curve now uses the preset's lookback window** (`cycle.params.lookbackBars`) + pivot bars, was hardcoded 252 → matched engine current_drawdown/profit per preset for MSFT (S4 follow-up). Remaining S7: recompute typical/bounds + synced axis re-verify. |
| 10 | AnalystTargetTrack | Cycle | S7 | ⬜ | Recompute marker positions + implied upside. |
| 11 | RelativePerformance | Cycle | S7 | ⬜ | Recompute alpha vs home-market index. |
| 12 | EarningsHistory | Fundamentals | S8 | ⬜ | Recompute beat/miss + surprise %. |
| 13 | QuarterlyFinancials | Fundamentals | S8 | ⬜ | Rev/GP/OpInc/FCF; annual/quarterly toggle. |
| 14 | ValuationHistory | Fundamentals | S8 | ⬜ | PE history; empty state <4 pts. |
| 15 | BalanceSheet | Fundamentals | S8 | ⬜ | Recompute net cash; stacked bars + debt line. |
| 16 | DividendHistory | Fundamentals | S8 | ⬜ | Annual totals; non-payer empty state. |
| 17 | MetricsTable (Key Metrics) | Fundamentals | rebuilt (S0) | ✅ | Rebuilt as sector/market comparison; data verified vs SQL. **S1: re-verified** — 12 rows, columns Metric/Value/vs Sector/vs {market} (localised US market/ASX/TSX), green/red/gray color-coding correct, tooltips correct, table contains own horizontal scroll at 375px (`.km-scroll`). 🔧 Fixed: sector header now names the sector (`vs Technology`, was generic `vs Sector`). 🔧 **S5 beginner softening done**: each metric name now carries a visible ⓘ definition; intro reworded ("How it compares with its peers") + a worded green/red/grey legend. |
| 18 | SmartMoneyActivity | Sentiment | S6 | ⬜ | 548 lines; flagged as built without full design-system adherence. Kept despite Phase-2 spec. |
| 19 | OwnershipStructure | Sentiment | S6 | ⬜ | Recompute donut %; verify holders table. |
| 20 | ShortInterest | Sentiment | S6 | ⬜ | Recompute short %/days-to-cover; null AU handling. |
| 21 | NewsFeed | Sentiment | S6 | ⚠️ | Decoupled to daily refresh. **S1: news now populating** (refresh run after PR #9 merge); empty-state + populated cards render correctly. 🔧 **Critical prod-crash fixed**: NewsFeed is a Server Component but had `onMouseEnter`/`onMouseLeave` handlers → "Event handlers cannot be passed to Client Component props" → "Something went wrong" on every news-bearing ticker in production (PR #11; replaced with `.news-row:hover` CSS; verified clean in prod logs). Full design-system/parity audit still pending in S6. |

## Cross-cutting items (apply site-wide)

- 🔧 Insufficient-data states (replace fabricated "neutral 50"; no fake scores). — **S3 engine done** (FH pillars omit-not-fabricate + renormalise; FH withheld <3 pillars; cycle-only overall when no FH; radar plots only real pillars + insufficient/"not scored" states). Sanity-bounds + source labels still S9.
- ⬜ Sanity-bounds on absurd values ($0.08-class). — S9
- ⬜ "via Yahoo Finance, may be delayed/estimated" source labels. — S9
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
