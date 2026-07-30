# Roadmap

> **Purpose:** Defines what is in scope for launch, in what order it gets built, how we know it's done, and what's explicitly deferred. Read this before starting any new task. If a task isn't in the current phase, **stop and ask**.
>
> See also: `CLAUDE.md`, `architecture.md`.

---

## 0. Phase Definitions

- **Phase 0** — Setup. Accounts, repo scaffolding, foundational docs. ✅ **COMPLETE**
- **Phase 1** — Launch. Everything currently in `/reference/original-design.html` minus Smart Money Activity, plus auth, payments, static content pages. ⬅️ **YOU ARE HERE — Layers C/D/E built + live; Layer D & E AUDITED; Layer C reopened for a round-2 production-readiness re-audit.**
- **Phase 1.5** — Hardening. Mobile polish, accessibility audit, methodology page content, performance tuning, beta testing.
- **Phase 2** — Expansion. Smart Money Activity UI, watchlists, alerts, sector heatmaps, earnings calendar, FMP migration.
- **Phase 3+** — TBD. Discussed post-launch based on actual user behaviour.

---

## 1. Phase 0 — Setup ✅ COMPLETE

### Accounts to create

- [x] GitHub
- [x] Vercel (sign in via GitHub)
- [x] Supabase (sign in via GitHub)
- [x] Cloudflare (any email)
- [ ] Stripe (defer to Phase 1 payment work)
- [ ] Resend (defer to Phase 1 email work)

### MCP servers to connect via Claude

- [x] GitHub MCP (via gh CLI — ayaatnibrasaziz)
- [x] Vercel MCP (team: Ayaat Nibras Aziz's projects)
- [x] Supabase MCP (project: MajorCycle — us-east-1; was "Stock Project" in Seoul, migrated + renamed pre-launch)
- [x] Cloudflare MCP (account: Ayaatnibrasaziz@gmail.com)

### Repository scaffolding

- [x] Create new GitHub repo (public — github.com/ayaatnibrasaziz/majorcycle)
- [x] Add `CLAUDE.md` at root
- [x] Add all 6 docs under `docs/`
- [x] Copy original HTML to `/reference/original-design.html`
- [x] Initialise `/web` with Next.js 15 + pnpm (TypeScript, Tailwind v4, App Router, ESLint)
- [x] Initialise `/analytics` with Python `pyproject.toml` + module skeleton
- [x] Add `.env.example` documenting required vars
- [x] Configure CI in `.github/workflows/ci.yml`

### Naming decision

- [x] Run naming session — checked 40 domains, 10 available
- [x] Owner selects name: **MajorCycle** (`majorcycle.com`)
- [x] Purchase domain via Cloudflare
- [x] Replace `<APP_NAME>` placeholder throughout repo
- [x] Configure DNS pointing to Vercel

### Exit criteria for Phase 0

- [x] All 4 MCP servers connected and verified working
- [x] Domain purchased and DNS configured
- [x] Repo scaffolded, CI passing
- [x] `.env.local` template created, owner has all required keys

---

## 2. Phase 1 — Launch Build (target: 4-6 weeks)

The build proceeds in layers, bottom-up. Each layer must be complete before the next starts.

### Layer A: Data Pipeline ✅ COMPLETE

Goal: Daily refresh pipeline writes correct data to Supabase.

- [x] Implement `analytics/providers/base.py` — abstract DataProvider + `FundamentalsSnapshot`, `EnrichedData`, `NewsItem` dataclasses
- [x] Implement `analytics/providers/yfinance_provider.py` — full concrete provider including `fetch_enriched_data()`
- [x] Implement `analytics/providers/fmp_provider.py` — stub raising NotImplementedError
- [x] Port `major_cycle.py` from existing script — cycle math + pivot detection
- [x] Port `analytics/scoring/financial_health.py` — 5-pillar score
- [x] Port `analytics/scoring/valuation.py` — valuation score + zone
- [x] Port `analytics/scoring/overall.py` — composite rating + label
- [x] Seed the universe (~720 tickers across S&P 500 / ASX 200 / S&P/TSX 60). *(Static seed CSVs retired 2026-06-24 — the universe now lives in the `stocks` table and auto-expands; index membership is sourced nightly from ETF holdings into `index_membership`.)*
- [x] Create Supabase tables: `stocks`, `price_bars`, `profiles`, `analysis_runs`, `universe_log`
- [x] Build enriched data pipeline — income statements (annual + quarterly), balance sheets, cashflow, earnings history, top institutional holders, insider transactions, analyst upgrades/downgrades, PE history, company overview
- [x] Build smart refresh pipeline (`analytics/cron/daily_refresh.py`) with earnings-date-driven staleness logic — price+fundamentals daily, enriched data only after next earnings date passes (7-day fallback for tickers without calendar data)
- [x] Set up daily GitHub Actions workflow `.github/workflows/daily-refresh.yml` — 23:00 UTC, smart mode, 60 min timeout
- [x] Set up manual full-refresh workflow `.github/workflows/weekly-enriched-refresh.yml` — `workflow_dispatch` only, `--mode full`, 360 min timeout
- [x] Add `next_earnings_date DATE` and `enriched_updated_at TIMESTAMPTZ` columns to `stocks` table
- [x] Add cron failure email via Resend
- [x] Write unit tests for cycle math + scoring against known fixtures (28 tests, all passing)
- [x] Upgrade all GitHub Actions to v6 (Node.js 24 native, no deprecation warnings)
- [x] Repo made public — unlimited GitHub Actions minutes

**Verification:** ✅
- 720 tickers seeded with full price history (5.7M bars, up to latest trading day)
- `pytest analytics/` — 28 passed
- `mypy analytics/ --ignore-missing-imports --explicit-package-bases` — no issues
- CI passing on all commits (green checkmarks on main branch)
- Manual full-refresh workflow triggered to populate enriched data for all 720 tickers

### Layer B: Frontend Foundation ✅ COMPLETE

Goal: Next.js app shell + design system + auth.

- [x] Configure Tailwind v4 with design tokens from `design-system.md`
- [x] Set up shadcn/ui base components (Button, Input, Dialog, etc.)
- [x] Build sidebar + header layout matching reference HTML
- [x] Implement Supabase Auth (email/password + Google OAuth)
- [x] Build signup, login, password reset flows
- [x] Build first-login disclaimer/methodology acknowledgement modal
- [x] Implement `web/lib/ticker.ts` URL ↔ storage mapping
- [x] Implement `web/lib/case.ts` snake↔camel converter
- [x] Implement `web/lib/types.ts` per `data-contracts.md` §4 — includes all enriched data types
- [x] Implement `web/lib/supabase.ts` singleton client
- [x] Build 404, error, and loading pages

**Verification:** ✅
- `pnpm typecheck` — zero errors
- `pnpm lint` — zero errors
- `pnpm build` — successful production build
- Login/signup/Google OAuth flow confirmed working

### Layer C: Stock Detail Tab (target: 2 weeks — the bulk of the build)

Goal: Every section in the reference HTML's Stock Detail tab ported to React, fully functional with real data.

**Per-ticker page route:** `/stocks/[market]/[ticker]/page.tsx` — Server Component fetching from Supabase via `web/lib/stocks.ts`, computing cycle math by calling `/api/cycle` (a Python serverless function at `web/api/cycle.py` backed by the vendored `web/_engine/` package), rendering HTML with full data.

#### Pre-work (✅ COMPLETE)

- [x] **Scaffold** — `/stocks/[market]/[ticker]/{page,loading,not-found}.tsx`, `lib/stocks.ts`, `components/stocks/StockSubnav.tsx`. Renders empty section anchors; verified with `pnpm typecheck/lint/build`.
- [x] **Python serverless function setup** — `web/api/cycle.py` calls the vendored cycle math at `web/_engine/`. Added `web/requirements.txt` (pandas, numpy, supabase) and `web/vercel.json` (with `includeFiles: _engine/**`). CI extended to lint/typecheck `web/_engine/` + `web/api/` and run a drift check that compares `web/_engine/<file>.py` against `analytics/<file>.py` (after the `from analytics.` → `from _engine.` import rewrite).

Build order (each item = one PR):

1. [x] **Header strip** — ticker, company name, sector, current price + delta, upside-to-target, 52W gauge, pulse dot, 3 rating badges (overall label, valuation zone, analyst consensus). Merged PR #5.
2. [x] **KPI strip + Verdict card** — 4-card KPI accent strip (Overall Rating, Health Score, Current Drawdown, Typical Drawdown) + hero Verdict card (score ring, thesis sentences, band tiles, footnote). Badge row in header uses cycle data. Merged PR #6.
3. [x] **Price chart with 50/200 DMA** — Lightweight Charts candlesticks + 50/200 SMA line overlays with toggle buttons and 1Y/3Y/Max range selector. `PriceChart.tsx`.
4. [x] **Drawdown / profit overlay** — Drawdown/Profit mode toggle, LWC area chart with avg + bound reference lines + pivot markers. `DrawdownOverlay.tsx`.
5. [x] **Major Cycle stats strip** — 4 stat pills (Current, Typical, Lower/Upper Bound, Events) rendered inside DrawdownOverlay.
6. [x] **Analyst target track** — Rainbow gradient bar, current price (blue) + consensus (gold) markers, Bear/Consensus/Bull stat grid. `AnalystTargetTrack.tsx`. Uses Supabase data only (independent of cycle).
7. [x] **Snowflake radar scorecard** — Recharts RadarChart (5-axis polygon) + axis bar strip. `SnowflakeRadar.tsx`. Gated on `cycle` data.
8. [x] **Quarterly financials table** — Revenue/GP/OpInc/FCF tab bar chart. `QuarterlyFinancials.tsx`.
9. [x] **Balance sheet card** — stacked asset bars + debt line overlay + net cash stat row. `BalanceSheet.tsx`.
10. [x] **Valuation history** — P/E area chart with avg + current reference lines; empty state when history < 4 pts. `ValuationHistory.tsx`.
11. [x] **Relative performance vs benchmarks** — indexed-to-100 line chart (stock vs S&P 500 + ASX 200 + S&P/TSX), 1Y/3Y/Max, click-to-toggle legend, Stock/Index Return + Alpha summary. `RelativePerformance.tsx`. Benchmark indices (`^GSPC`/`^AXJO`/`^GSPTSE`) ingested as price-only `market='index'` rows by `daily_refresh` (`indices.csv`); fetched via `benchmarks.server.ts`.
12. [x] **Dividend history** — bar chart of annual dividends; green/red coloring; "no dividend" empty state. `DividendHistory.tsx`.
13. [x] **Technical levels strip** — 50 DMA, vs 50 DMA %, 200 DMA, vs 200 DMA %, MA Signal (Golden/Death Cross). Values computed from `priceBars` at render time. `TechnicalLevels.tsx`. Carries `id="sec-cycle"` scroll anchor (Cycle subnav pill targets this card). Always shown when `priceBars.length > 0`, independent of cycle data.
14. [x] **Short interest gauge** — half-circle gauge with design-system arc colours (green/orange/red), Days to Cover + Signal as stat rows below gauge with working hover tooltips. `ShortInterest.tsx`.
15. [x] **Ownership structure** — insider/institutional/public donut + colour legend + holders table, with working hover tooltips on all stat rows. `OwnershipStructure.tsx`. Always renders with graceful empty-states (like Smart Money): "No ownership breakdown available." / "No institutional holder data available." for thinly-covered stocks, instead of the section/column vanishing.
16. [x] **News feed** — top 10 yfinance news items. `NewsFeed.tsx` (already built; checklist was stale).
17. [x] **Earnings dashboard** — EPS beat/miss bar chart with estimate vs actual, summary strip (beat rate, avg surprise, trend, last EPS). `EarningsHistory.tsx`.
18. [x] **Metrics table** — sortable 3-column table with 25 metrics across 7 categories; category pills. `MetricsTable.tsx`.
19. [~] **Synced crosshair** — crosshair on the Price chart mirrors onto the Drawdown overlay (both share the trading-day axis) via Lightweight Charts `subscribeCrosshairMove`/`setCrosshairPosition` with loop guards (`chartSync.ts`). Implemented + non-breaking (no freeze); the Recharts charts use incompatible axes so are intentionally out of scope. Interactive mirror smoothness still to be confirmed with a real hover on a deploy.
20. [x] **Why Attractive / Key Risks** insight grid — Thesis-section card (reference has it; was missing from this list). `ThesisInsights.tsx`, ports `buildAttractive`/`buildRisks`/`riskInvalidation` with Strong/Severe tags + invalidation callout.
21. [x] **Company Overview** — Thesis-section business-summary card. `CompanyOverview.tsx`.
22. [x] **Browse & Search landing (`/stocks`)** — fixes the `/stocks` 404 (no landing route existed). Search by ticker + company name, market (US/ASX/TSX) + sector filters, market-cap-descending list over the ~720-stock universe; links to the detail pages. Loads a lightweight index (`web/lib/universe.server.ts`, `unstable_cache` daily) — never ships the `fundamentals` JSONB to the client. Hosts the **Cycle horizon selector** (Short/Medium/Long, default Medium, persisted; carried into the opened stock via `?preset=`). `StockBrowser.tsx` + `web/app/(app)/stocks/page.tsx`. Sidebar nav renamed `Stock Detail` → `Browse`. *(S4. Live-add of unknown tickers deferred; `Custom` horizon deferred to Layer D.)*
23. [x] **Stock Detail performance** — the detail page **streams** (Suspense): the shell paints immediately, cycle sections fill in. `cycle.py`'s price-bar fetch is parallel. *(S4 follow-up; #3 client-payload slimming + #4 cache-warming deferred.)*
24. [x] **Beginner help — InfoTip explainers** — a reusable, accessible **ⓘ** tooltip (`web/components/ui/InfoTip.tsx`; opens on hover/tap/focus, portalled + viewport-clamped) with plain-English explainers across every Stock Detail section + the rating/Valuation-Zone/analyst badge row. **Key Metrics softened** (per-metric ⓘ + worded legend). First-login onboarding modal already covered decision #23. `globals.css` `.info-tip-*`. *(S5. No engine/data change. First-visit hint declined by owner; explicit per-section heading lines deferred — section intent is carried by each card-title ⓘ.)*

> **Deferred to Phase 2 (FMP):** Earnings → **Revenue** tab (actual vs estimate). yfinance's `earnings_history` is EPS-only — no historical revenue estimates. We have revenue *actuals* (quarterly income statement) but not the per-quarter consensus, which FMP provides.

**Verification per section:**
- Side-by-side comparison with reference HTML — visual match
- Real data populated from Supabase
- Tooltips work and contain correct copy
- Responsive on mobile (375px width)

#### Production-readiness audit (multi-session — tracker: `docs/layer-c-audit.md`)

After the components were built, Layer C was reframed into a per-section production-readiness audit (9-check definition, verified on AAPL/BHP.AX/SHOP.TO; **every displayed value's calc is explained to + signed off by the owner before building**). Status:

- ✅ **S1** Foundation/re-verify · ✅ **S2–S3** Methodology engine (quality-gate valuation, "Cycle Payoff" rename, insufficient-data/withheld pillars — see `methodology-audit.md`) · ✅ **S4** Browse/Search landing + perf · ✅ **S5** Beginner InfoTips · ✅ **S6** Sentiment · ✅ **S7** Cycle charts · ✅ **S8** Fundamentals charts.
- ✅ **S9** Scorecard radar (a11y + per-pillar tips + score-based tier colours + labels-outside-grid + weighting explainer) · site-wide **sanity-bounds** (display caps + distress-yield flag) · **source-name removal** (no "Yahoo Finance" in user copy). *(PR #31.)*
- ✅ **Thesis re-audit** (Header / KPI / Verdict / Why-Attractive & Key-Risks / Company Overview) — re-aligned to the post-S3 engine: preset-aware lookback copy, value-trap-gated "Why Attractive" bullet, S9 sanity caps on the narrative numbers. Plus owner follow-ups: a **contradiction-free statement engine** (disjoint thresholds per metric + non-asserting fallbacks — swept all 720 tickers, 0 contradictions; full catalogue in the approved plan), the Verdict **entry-zone band** (typical dip → 85% of the distance to the lower bound), **drop the `.AX`/`.TO` suffix** in the Verdict eyebrow, and **page-wide uniform-2-decimal price formatting** (`fmtPrice`/`fmtPerShare`). *(PR #32.)*
- ✅ **S10 Methodology modal** (in-app, signed-in only) — the Stock Detail subnav "Methodology" button now opens `MethodologyModal` (`web/components/stocks/MethodologyModal.tsx`), a reference-styled scoring explainer (visual parity with the `reference/original-design.html` methodology modal) corrected to the post-S3 engine: Overall = 40/35/25, the 5 compliant tiers, Financial Health pillars (omit-and-renormalise, withhold <3), value-trap-gated Valuation (`0.30 + 0.70·(FH/100)^1.5`), Cycle Payoff (signal-reliability + reward/risk, not momentum), and the Verdict entry-zone band — with formula blocks, since it's behind sign-up. Built on the existing Radix `Dialog`; static (no cycle-data coupling). Also corrected the stale `OnboardingModal` Valuation line. **A separate high-level, no-formula PUBLIC methodology page is deferred to Layer F** (for first-time visitors before sign-up). The same session also shipped Layer-C **hardening**: the real brand logo everywhere (`reference/logo.png`, via `next/image` + favicon), dropping the `.AX`/`.TO` suffix from user-facing labels (`tickerDisplay`/`marketLabel`), and **adaptive number formatting** (`fmtCompact` / `makeCompactAxisFormatter`) so small-cap values no longer collapse to "0M"/"0B" and chart axes keep uniform decimals — see `layer-c-audit.md` (S10 section) for the full list. **Layer C cross-cutting items now complete.**

**→ Layer C round 1 complete** (S1–S10). **🔁 REOPENED for a round-2 production-readiness re-audit (2026-06-26)** — after Layers D & E introduced a stronger 10-check audit model (deep keyboard-a11y, formal perf/compliance/#15 checks, a systematic null-data render sweep, and a deploy-gated live tail via Claude-in-Chrome), the owner reopened Layer C to bring the Stock Detail page up to that same bar, plus fix the **Download Report** button (`StockSubnav.tsx` — a disabled "Coming soon" placeholder). The owner also added: a **drawdown/profit bound** correctness check (C-R6), proactive **stock-split** price-history handling (C-R7), and a full 10-check audit of the **Browse `/stocks` tab** (C-R8). See `docs/layer-c-audit.md` "REOPENED — round 2" for the scope + the C-vs-D/E gap analysis.
>
> **Round-2 session 1 (2026-06-27) — MERGED + LIVE (PR #46):** **C-R6** — `ta_highest`/`ta_lowest` `min_periods=1` so each stock's first lookback window is measured (was blanked), counting early-life events in *both* the drawdown and profit-recovery plots (owner-signed-off methodology change; all Overall labels unchanged, AAPL −1pt; young-stock long bounds corrected, e.g. TUA long −31→−53%). **C-R7** — split detection via yfinance's authoritative split-actions calendar (not a price heuristic) → full re-adjusted re-pull, + a `fix_split_history.py` backfill. **Data hygiene** — drop `$0`-close glitch bars (fixed ENB.TO/CM.TO −100% bound). See `methodology-audit.md` ("C-R6") + `architecture.md` §2 (cron split guard).
>
> **Round-2 session 2 (2026-06-28) — MERGED + LIVE (PR #49):** **C-R9** smart split-adjustment verification + dated `split_events` state; **C-R1** Download Report = a one-click, fully-interactive **offline HTML** report (rebuilt every deploy from the live section components; blue Export-style button) + chart y-axis alignment + faster download.
>
> **Round-2 session 3 (2026-06-30) — MERGED + LIVE (PR #50, main `ed2ecf9`, prod `dpl_Ceyi6…`):** **C-R2** null-data render sweep (consistent hide/empty-state across every Stock-Detail section + a "Major Cycle unavailable at this horizon" notice on both page and report; edge cases verified with fake data via a local-only `/dev-fixtures` gallery); **C-R3** deep keyboard-a11y (chart range buttons `aria-pressed`+`role=group`, dialog `aria-haspopup`, gauge `role=img`, table `aria-label`, day-panel focus); **C-R4** formal perf/compliance/#15 checks (PASS — disclaimer above the fold, 5 compliant tiers, 0/44 `analysis_runs.results` persisted); **split false-positive fix** (FDX — require a *persistent* cliff). See `docs/layer-c-audit.md`. **Remaining:** C-R8 (Browse audit) → C-R5 (deploy-gated live tail).

### Layer D: Run Analysis Tab ✅ MERGED + LIVE · ✅ AUDITED

Goal: Users can pick tickers (ready-made baskets / search / CSV), run analysis with presets/custom, get scored results.

> **Status:** PR #35 (Layer D + industry support + AU/CA labels + cancel UX + nav fix) and PR #36 (run reliability — retry + warm pass + pre-warm) merged to `main` and **live on www.majorcycle.com** (2026-06-16). Run skips reduced to genuine unknown/insufficient-history tickers; partial success per ticker confirmed. Remaining "first batch slow" is the inherent free-tier cold start.

> **Production-readiness audit ✅ COMPLETE (2026-06-23).** Same audit-then-fix model as Layer C — a 10-check definition × 16 surfaces, tracker in **`docs/layer-d-audit.md`** (sessions D0–D4). **Verified:** calc parity `analyze.py` == `/api/cycle` byte-identical (AAPL/BHP.AX/SHOP.TO + custom); persistence inputs-only (#15) SQL-confirmed (0/28 rows store results); **reliability 0-skips proven on two full-universe live runs** (the only skip is GEV-on-long, genuine <3yr history); validation/dedupe/60-cap/compliant-labels/disclaimer all pass. **Fixes (no engine/Python touched):** D1-a progress "Double-checking skipped tickers…" phase label + monotonic skipped count; D2 a11y (input labels, keyboard-operable CSV zone, full search combobox, basket chip labels, one-shot select reset); D3 a11y (progress bar `role=progressbar` + `aria-live`). Visual parity (§16) + a11y tab-order + 375px (Layer-H sidebar isolated, out of scope) all verified live. CI green.

> **Beginner-first reframe (owner-approved).** The reference Run tab (two big cards: CSV upload + raw-threshold settings) optimises for power users and fails our mass-retail beginner audience (the blank-canvas problem). Layer D **deliberately deviates from strict visual parity** (#1) for a "Build your analysis" flow: ready-made **baskets** lead, **search-and-add** builds custom lists, **CSV** is demoted to a small import, all feeding a **visible selected-tickers chip list**; horizon presets up front with **Custom/Advanced** behind a disclosure. Runs execute via **client-side batching** (chunk → POST `/api/analyze` → accumulate) giving an honest progress bar + Cancel. See `design-system.md` §Run-Analysis.

- [x] **Preset selector** — Short / Medium / Long / Custom (`HorizonSettings.tsx`; Custom + raw pullback/profit/lookback behind an "Advanced" disclosure, validated to data-contracts §7 bounds).
  - [x] **Horizon selector on the Browse page (`/stocks`), NOT the detail page** — the user picks a Major Cycle horizon **before** opening a stock; the choice is carried into the opened stock via the query, and the Stock Detail page honours it (default **Medium**). **No selector/option on the Stock Detail page itself** (explicit owner decision). Short / Medium / Long shipped in S4-follow-up. **Custom shipped (2026-06-14):** Browse has a Custom option with pullback/profit/lookback inputs (persisted, §7-validated); links carry `?preset=custom&pullback=&profit=&lookback=`, and **`/api/cycle` + `cycle.ts` + the detail page now compute custom** (additive — named presets untouched; `cycle.ts` threads a `CycleSpec`). `/api/analyze` also accepts custom for Run Analysis. Cache keyed per ticker **and** the full window. *(Decision + initial S/M/L build 2026-06-04; Custom 2026-06-14.)*
- [x] **Custom params panel** — three inputs with validation (`HorizonSettings.tsx`).
- [x] **Ready-made baskets** *(new — solves the blank canvas)* — Index (S&P 500 / ASX 200 / TSX 60) + Top-by-market-cap + compact "By sector ▾" + **"By industry ▾"** (industries grouped under their sector via `<optgroup>`) + "Magnificent Seven", from the light universe index (`baskets.ts`, registry — future "My Watchlist" drops in here). **The three index baskets resolve to the *actual constituents we cover* (membership ∩ universe)** *(2026-06-23)*, replacing the old `byMarket()` "every equity in the market" behaviour so the labels are accurate and Request-a-Ticker additions no longer leak into them. **Membership refresh is now fully automated *(2026-06-24)*:** constituents come from the **`index_membership` DB table**, refreshed **nightly** from official ETF holdings (SPY/IOZ/XIU; `analytics/cron/refresh_index_membership.py`) and read at request time (`index-membership.server.ts` → `buildQuickBaskets`) — **no hand-edited CSVs, no redeploy**. A new constituent we don't yet cover is enqueued into `ticker_requests` + fetched the same night. This also retired the static universe CSVs: `daily_refresh` now sources its universe from the `stocks` table.
- [x] **Industry support across the app** *(2026-06-16)* — Browse (`/stocks`) gains an **Industry filter** dependent on the Sector filter (industries narrow to the chosen sector; changing sector resets it); Run Analysis gains the grouped "By industry ▾" basket; and the Stock Detail **Key Metrics** table gains a **"vs Industry"** comparison column (industry-first, before vs Sector / vs Market) backed by `medians.server.ts` industry medians with a ≥5-peer floor → graceful "—" fallback for small industries. Shared `industry` plumbing (`universe.server.ts` already carries it; `baskets.ts` helpers).
- [x] **Live per-field horizon validation** *(2026-06-16)* — the Custom pullback/profit/lookback inputs on **both** Run (`HorizonSettings`) and Browse (`StockBrowser` `CustomField`, which also gained `InfoTip` explainers) now show instant per-field feedback (red border + inline note on *only* the offending field, clearing the moment it's valid) via a shared `boundError` helper. Sample CSV expanded to 15 real tickers (5 US / 5 AU / 5 CA).
- [x] **Ticker upload zone** — CSV drag-drop + click (`CsvImport.tsx`; reference's validate/preview UX, demoted to a secondary import).
- [x] **Manual ticker entry** — search + autocomplete via `/api/search` (`TickerSearchAdd.tsx`).
- [x] **Selected-tickers chip list** *(new)* — live count + per-chip remove + clear; the single source all inputs feed (`SelectedTickers.tsx`).
- [x] **Run button** — calls `/api/analyze` in chunks; honest progress + Cancel (`RunProgress.tsx`, batching in `analysis.tsx`).
- [x] **Loading state** — real batched progress (chunks done / total, elapsed, ETA, scored/skipped counts).
- [~] **Universe expansion handler** — **queue model** (owner-approved, Layer E fast-follow): unknown tickers go to `unavailable[]`; the user requests them from the **Request a Ticker** page (choose-only over the `listings` menu) → `ticker_requests` queue → the daily cron fetches them via the yfinance `DataProvider`. No synchronous `/api/fetch-ticker`. See `architecture.md` §8 Tier 4.
- [x] **Last Analysis card** — from `analysis_runs` (INPUTS ONLY — #15), "Re-run" re-derives (`LastAnalysisCard.tsx`). *(2026-06-16 fix: `writeRun` now resolves a named preset's thresholds from PRESETS before insert — the threshold columns are NOT NULL, so persisting NULL had been silently dropping every Short/Medium/Long run's history row.)*
- [x] **Error handling** — partial failures listed in `unavailable`; a failed chunk degrades gracefully (its tickers → `unavailable`). *(2026-06-16 reliability: a failed chunk POST now retries inline (`CHUNK_RETRIES`) before giving up, and the run ends with a **warm retry pass** over chunk-failed tickers — only genuine server-`unavailable` (unknown/insufficient-history) stay skipped. The first chunk runs **solo to pre-warm one instance**, so the rest fire against a warm instance instead of a cold-start storm — the cause of the random skips.)*

**Verification:** ✅ (engine untouched; `analyze.py` output byte-matches `cycle.py` for the same params)
- `analyze.py` SHOP.TO/medium == `cycle.py` SHOP.TO/medium (overall 81, 40/35/25 formula holds); RY.TO short scored, `ZZZZ.TO` → unavailable, `ry.to` deduped
- Custom params validate (out-of-bounds pullback → 400; empty list → 400); presets resolve correctly
- Edge cases (empty list, duplicate tickers, unknown tickers) handled gracefully
- UI verified in browser: baskets/search/CSV populate the chip list, Custom/Advanced opens, no console errors
- Universe expansion — handled by the **Request a Ticker** queue (cron-drained), not an on-the-fly fetch
- **Known (pre-existing, deferred to Layer H):** 375px horizontal overflow from the non-responsive sidebar/header shell — identical on the already-live `/stocks`, not a Layer D regression

> **Session infra + security + perf (2026-06-14), shipped on the same PR:**
> - **Performance** — the DB was randomly created in Seoul (cross-Pacific from US/AU/CA). Migrated to a **new `us-east-1` Supabase project** (re-seeded from the pipeline) + pinned Vercel functions to **`iad1`**, and added a one-request `get_price_bars_json` RPC (collapses the 1000-row pagination). A heavy stock's data load went from ~5.6s to a few hundred ms; `analyze.py` also got parallel paging, a warm-instance result cache, and retries. Both Run Analysis **and** the Stock Detail page use the RPC.
> - **Security (Supabase advisor: all WARN/CRITICAL cleared)** — RLS enabled on all tables (`stocks`/`price_bars`/`universe_log` locked to the service role; `profiles`/`analysis_runs` per-user); functions hardened. Migrations `20260614020000`–`20260614040000`.
> - **Auth fix** — `handle_new_user` trigger auto-creates a `profiles` row on every sign-in method (was empty on Google/email sign-in). `20260614030000`.
> - **Dev** — `/api/analyze-dev` shim spawns `analyze.py` under `next dev` (mirrors `cycle.ts`) so Run Analysis is verifiable in local preview.
> - **Polish** — Run tab restyled to the reference's compact look via ported `globals.css` classes; search shows bare symbols (no `.AX`/`.TO`); CSV re-upload fixed; **Download sample CSV** button.
> - **Done (2026-06-16):** owner deleted the old Seoul project and **renamed the new us-east project to `MajorCycle`** (display name only — the ref/URL/keys are unchanged, so nothing broke). Email + Google auth verified live (two real sign-ins, one Google + one email, both auto-created a linked `profiles` row via `handle_new_user`). Local `.env.local` confirmed on the new project. Daily refresh cron confirmed writing to the new project (latest bar current).

### Layer E: Results Tab ✅ BUILT + AUDITED (E1–E11) + MERGED + LIVE

Goal: The ranked Results view from reference HTML, fully functional.

> **Audit status — COMPLETE (2026-06-26).** The full Layer E audit (E1–E11) is done +
> **merged to main (PR #44, `dad5091`) + live**. E1–E4 = the `/results` 10-check
> production-readiness pass (a11y cluster E-a1…E-a7 + E-f1 + E-c1). Reopened E5–E11:
> **E5** premium Briefing score-ring avatar (count of Constructive+; no icon/dot);
> **E6** missing-component (FH-null) Overall — "Cycle-only" badge + de-rank (web-only;
> engine untouched per P3, recorded in `methodology-audit.md`); **E7** unknown-ticker
> Stock Detail page → queue model; **E8** site-wide stale-info sweep (Browse empty-state
> fixed); **E9** Request-a-Ticker audit (+ aria-live); **E10** Download Excel (ExcelJS —
> colour-coded `.xlsx`, per-column precision matching CSV, Health Rating + proper zone
> labels, black borders, content-fit widths, default filters); **E11** deploy-gated tail
> — **verified live on www.majorcycle.com**: a 759-stock run scored 759/0 skips in 243s,
> /results rendered <1s with the Opportunity Map (~756 bubbles, no jank), CSV 15ms /
> Excel 536ms, and all 5 Request/skipped states (Covered / Request / Requested / Available
> / Not-supported). Tracker: `docs/layer-e-audit.md`. Engine never touched across E1–E11.
>
> **Build status (2026-06-17):** Built on `feat/layer-e-results` off `main` (**PR #38, CI
> green, awaiting owner merge**; latest commit `10b4ccf`). Reads the SAME in-memory
> results as the Run tab via `useAnalysis()` (AnalysisContext + the
> `mc:analysis-snapshot-v1` sessionStorage snapshot) — no recompute, ratings always
> DERIVED, never read from / written to the DB (#15). After the initial cut, a
> reference-parity rework (below) + a 9-item review-polish round (Opportunity Map
> legend/bubbles/click-rect, header InfoTips, visible Cycle-Position track, matching
> valuation colours, detail-page sanity caps on fundamentals, non-bold analyst text,
> new briefing icon). typecheck / lint / build + Python checks green; verified in the
> local preview. Engine untouched. **Open follow-ups for next session** (clickable
> Run top-pick, briefing scroll-to-table, pinned legend order, overlapping-bubble
> cluster picker, valuation-tier sign-off, the live ticker fetcher, and the live
> ~0-skip confirmation) are tracked in memory `project-layer-e-progress`.

> **Reference-parity rework (owner-approved, 2026-06-17).** The first cut was
> cycle-only with band-toggle chips; the owner wanted a closer match to the
> reference. Now: the three **Simple / Analyst / Full** view modes; the **full
> reference column set** (Price & Analyst Targets / Valuation Ratios / Profitability
> & Health / Growth & Sentiment) powered by a slim **`fundamentals`** subset now
> returned with each run result (analyze.py already loads it — no extra fetch); the
> **Opportunity Map** rebuilt with 4 quadrant fills + labels and a tier-grouped
> **click-to-toggle legend**; a **compact collapsible** skipped strip; and a
> reference-style **export dropdown**. All OUR scores keep the compliant tiers/zones
> (#2); the **Analyst** column shows the third-party Wall-Street consensus verbatim
> (#17). Plus a **Run-reliability fix** to stop false skips (see below).

- [x] **Analyst Briefing card** — summary callout at top (compliant copy, clickable top-pick + filter pills, "information only" disclaimer in-card → visible without scroll, #4/#12)
- [x] **Provenance bar** — run timestamp + ticker count + Major Cycle horizon + engine name (no third-party provider name, S9)
- [x] **Opportunity Map** — Health vs Valuation bubble chart (Recharts ScatterChart; bubble size = Overall; quadrant split + Opportunity Zone area; click bubble → detail)
- [x] **Sortable / filterable / searchable results table** — the reference's **Simple / Analyst / Full** view modes (default Analyst; 7 → 31 columns) across the seven bands; metric-tinted cells; verbatim Analyst consensus column
- [x] **Fundamentals returned with results** — `/api/analyze` attaches a slim `fundamentals` subset per ticker (P/E, ROE, margins, FCF, D/E, analyst target/consensus, short interest, …) so the Analyst/Full views populate without a second fetch
- [x] **Run reliability — stop false skips** — `analyze.py` lower concurrency (4→2) + RPC retry-before-fallback + stronger per-ticker retries; client **single-ticker reconciliation pass** re-runs any in-universe straggler the way the detail page does (which never fails for these)
- [x] **Tier badge column** — Overall cell badge clickable → filters by that tier (syncs the tier dropdown)
- [x] **Click-to-detail** — clicking a row (or mobile card) opens that stock's detail page
- [x] **Skipped tickers transparency** *(this session's follow-up)* — `unavailable` listed and split into "insufficient price history" (in coverage) vs "outside our coverage" (unknown), inferred via the universe index
- [x] **Advanced filters** *(owner chose to include now)* — multi-rule AND builder (numeric ≥/≤/between, categorical multi-select, text contains), ported from the reference
- [x] **Empty states** — "no analysis run yet" (→ /run), "no stocks could be scored" (run ran, all skipped), "no stocks match your filters" (clear-filters)
- [x] **Export to CSV** — downloads the current filtered+sorted rows (fixed comprehensive cycle column set; compliant headers)

**Verification:** ✅
- All filters (search, tier dropdown, clickable tier badge, min-rating, "Constructive or better" chip, advanced numeric/categorical rules) and column sort verified in the preview
- Bubble-click + row-click navigation to `/stocks/[market]/[ticker]` confirmed
- Mobile (375px): table collapses to cards; the Results component adds no horizontal overflow (the residual shell overflow is the pre-existing non-responsive sidebar — **deferred Layer H**, not a Layer E regression)
- Files: `web/lib/ratings.ts`, `web/components/results/*` (Results orchestrator + BriefingCard / ProvenanceBar / OpportunityMap / ResultsToolbar / AdvancedFilters / ResultsTable / SkippedTickers + `columns.ts` / `filters.ts`), `web/app/(app)/results/page.tsx` (server page → universe lookup), Results CSS appended to `globals.css`

### Layer F: Static Pages + Subscription (target: 1 week)

Goal: All non-app pages live, payment flow works end-to-end.

**F0 — Auth branding / de-Supabase-ification (do first).** Make every auth
touchpoint read as `majorcycle.com`, not a generic Supabase project. Code shipped;
console/DNS steps are owner-driven (see `plan-mode-auth-virtual-ladybug.md`).
- [x] Native Google sign-in (Google Identity Services + `signInWithIdToken`) to kill
      the `*.supabase.co` address-bar flash — `web/components/GoogleSignIn.tsx`
      (falls back to redirect flow until `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set)
- [x] Token-hash email verification route `web/app/auth/confirm/route.ts` (branded
      `majorcycle.com` email links, no `supabase.co`)
- [x] `/account/update-password` page (fixes the broken reset-flow 404)
- [x] `getSiteURL()` helper + friendly auth-error copy (`web/lib/url.ts`,
      `web/lib/authErrors.ts`)
- [x] **Console:** Google consent branding + Authorized JS origins + published to
      Production; Client ID in Vercel (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) + `web/.env.local`
- [x] **Console:** Supabase custom SMTP → Resend (`noreply@majorcycle.com`), Auth Site
      URL (`https://www.majorcycle.com`) + redirect allow-list, Google provider
      Authorized Client IDs
- [x] **Console:** Resend domain `majorcycle.com` verified + SPF/DKIM/DMARC in Cloudflare
- [x] All 6 auth email templates branded with token-hash links + a slim header
      (transparent `email-icon.png` + Sora wordmark + navy gradient) — design-system.md §17
- [x] Branded the 7 Supabase **security notification** emails (password / email-address /
      phone-number changed, sign-in-method linked/removed, MFA added/removed) — enabled +
      same slim header, each with a "didn't do this? `security@majorcycle.com`" callout.
      Edited per-template at `/auth/templates/<slug>` (two saves: toggle + content)
- [x] Footer standardised across **all 13** templates to the grey cell
      (`#f8fafc` + top border) — design-system.md §17
- [x] `security@majorcycle.com` inbox via **Cloudflare Email Routing** (free): destination =
      owner Gmail (verified), rule `security@ → Gmail` active, routing enabled (root MX →
      `route1/2/3.mx.cloudflare.net`); Resend sending on the `send.` subdomain untouched
- [x] Reply **as** `security@majorcycle.com` from Gmail via a **"Send mail as"** identity
      relaying through **Resend SMTP** (`smtp.resend.com:465`) + "reply from same address"
- [x] **Branded reply/signature email template** — on-brand Gmail signature for replies from
      `security@majorcycle.com` (`reference/email-signature.html` + `web/public/signature-logo.png`)
- [x] Live end-to-end test: Google no-flash sign-in + branded reset-email delivery (both verified live)

**F0.5 — Auth hardening & security pass (shipped + live-verified 2026-07-05, PR #61).**
Full code + platform security audit; runbook `plan-mode-auth-virtual-ladybug.md`.
- [x] **Recovery-session confinement (HIGH):** a password-reset link no longer grants roam-the-app
      access before a new password is set. `mc_pw_recovery` httpOnly marker (`auth/confirm`) + guard in
      `web/proxy.ts`; `/account/update-password` moved to the `(public)` shell (no sidebar); marker
      cleared by `/auth/recovery-done`. **Live-verified:** reset link → confined page → `/results`
      bounces back.
- [x] **Sign-out** — POST `/auth/signout` + `SignOutButton` in the sidebar (live-verified)
- [x] **Open-redirect guard** — `safeNextPath()` in `web/lib/url.ts` (login/Google/callback/confirm)
- [x] **`profiles` billing-column lockdown** — migration `20260705032433`: `REVOKE UPDATE` + column
      `GRANT` (display_name/country/acknowledged_disclaimer_at only) so subscription/stripe columns are
      client-immutable; RLS policies rewritten `(select auth.uid())`. Verified via column_privileges.
- [x] **FK covering indexes** — migration `20260705032503` (advisor M); advisor WARNs cleared
- [x] **Security headers** — `web/next.config.ts`: X-Frame-Options, nosniff, Referrer-Policy,
      Permissions-Policy + CSP **report-only** (flip to enforcing is a tracked follow-up)
- [x] **DMARC hardened** — `_dmarc` `p=none` → `p=reject` (strict alignment + rua/ruf reporting);
      safe because all `@majorcycle.com` mail is Resend-signed `d=majorcycle.com`. Verified live.
- Declined/deferred: leaked-password protection (Supabase Pro-only — skipped for an info product);
      "require current password" → build into the future `/account` change-password page (not the
      recovery flow); K/N/G/H/I per plan.
- [x] `/methodology` — public plain-English explainer (no formulas; owner to refine copy) — F1
- [x] `/disclaimer` — disclaimer page (baseline content, owner to review) — F0.5
- [x] `/terms` — terms of service (baseline content, owner to review) — F0.5
- [x] `/privacy` — privacy policy (baseline content, owner to review) — F0.5
- [x] `/contact` — contact form → Resend, brand-styled email, `support@` fallback — F1
- [ ] `/pricing` — monthly/annual plans, region-aware currency
- [x] **`/account` — F2 COMPLETE + MERGED LIVE + FULLY VERIFIED 2026-07-13** (Parts A+B+C merged as a clean
      fast-forward of `feat/f2-account-part-a` into `main` `d6c5eb9` → live on www.majorcycle.com; see the live-verification
      note under Part C). Original plan runbook in
      `~/.claude/plans/plan-mode-auth-virtual-ladybug.md`. Three parts: **(A) core** — edit
      `display_name` + full-country dropdown (read-only once subscribed, since Stripe currency is fixed
      per subscription), read-only subscription placeholder, change-password with **current-password re-auth**
      (Google-only accounts see "you sign in with Google"); **(B) delete account** — **soft-delete + 30-day
      grace** (not immediate hard-delete, so a hijacked session/mistake is recoverable): `deletion_scheduled_at`
      col (service-role-only) + branded "scheduled/deleted" emails via `renderBrandEmail` + reactivation gate in
      `(app)/layout` + a `CRON_SECRET`-guarded Vercel-cron purge route; **needs a migration** to change
      `universe_log.added_by_user` FK to `ON DELETE SET NULL` (currently NO ACTION → would block deletion);
      Stripe-cancel-on-delete is a stub wired in F3; **(C) refer-a-friend** — "invite a friend" card → a
      dedicated branded Resend email that **includes the referrer's name** (not the generic Supabase invite
      template), `referrals` table + ~10/day/user rate-limit + honeypot (anti-abuse), rewards/tracking deferred.
      Verified against the live DB (grants, FK rules, `handle_new_user` trigger). No further Supabase email-template
      work needed (all branded in F0; deletion has no Supabase template → we send our own).
  - [x] **Part A (core) — BUILT + LIVE-VERIFIED 2026-07-11 (awaiting owner sign-off; not yet merged).**
        New: `web/app/(app)/account/page.tsx` (server; `getUser` for email + identity-provider detection,
        loads the profile), `web/components/account/{ProfileForm,SubscriptionCard,PasswordForm}.tsx`,
        `web/lib/countries.ts` (full ISO-3166 list; stores the alpha-2 **code**, `countryName()` helper).
        Edited: `web/components/Sidebar.tsx` (Account nav link in the bottom block). ProfileForm writes only
        `display_name`+`country` via the browser client (allowed by the F0.5 column grant); country locks when
        `subscription_status ∈ {active,trialing,past_due}`. PasswordForm re-auths with the current password
        (`signInWithPassword`) before `updateUser` — the fresh sign-in also makes the user "recently logged in",
        so the change succeeds whether or not Supabase's *require-reauthentication* setting is on. The branded
        "password changed" security email **does** fire on the change — this project's Supabase
        `password_changed` security notification was **enabled + branded back in F0 (2026-07-04)**, so the UI's
        "we've emailed you to confirm" copy is truthful (that notification is opt-in in Supabase generally, but
        it is ON for MajorCycle). Supabase enforces **no password history**: it
        only rejects reusing the *current* password, so a user can later change back to an earlier password.
        Google-only accounts get a "you sign in with Google" notice instead. **Verified:** typecheck / lint /
        build green; **e2e 24/24** — new `web/e2e/account.spec.ts` exercises the REAL page against a real
        session (profile save writes to the DB + persists across reload; password form rejects a mismatch and a
        wrong current password without changing anything). **2026-07-11 follow-up:** live-verified the real route
        end-to-end in the **Claude Browser preview** by signing in with the test account — profile save,
        country-lock (temporarily flipped `subscription_status`→`trialing` then reverted), and both password
        guards, all watched live. The session-injection trick is still documented in `coding-standards.md` §15,
        but signing in with the test account inside the preview is the primary method now (headless Playwright /
        session-injection render nothing in the watched preview pane — that was why an earlier check appeared
        blank). **UI consistency pass:** the account page + its three cards were refactored onto the shared
        `.card` / `.card-header` / `.card-title` (uppercase) / `.card-body` system, and the page `h1` made
        `sr-only` — the visible page title comes from the app Header/topbar (matching Results / Request a Ticker);
        it previously rendered a **duplicate** visible "Account" title. Mobile at 375px inherits the **known
        pre-existing shell overflow deferred to Layer H** (fixed sidebar) — the account cards themselves stack
        cleanly.
  - [x] **Part C (refer-a-friend) — BUILT + VERIFIED 2026-07-12 (not yet merged).** Owner chose a **plain invite**
        (no reward — deferred to F3) and to **collect the referrer's name in the form** (prefilled from
        `display_name`, required) so every invite email is personal. Migration `20260712000000_referrals.sql`
        (applied via MCP): new `referrals` table (`referrer_id → profiles ON DELETE CASCADE`, `friend_email`,
        `message`, `created_at`) + RLS (owner-only select/insert; no update/delete = immutable audit) + index on
        `(referrer_id, created_at)`. New: `web/lib/email/format.ts` (shared email helpers extracted from
        `accountEmails.ts`), `web/lib/email/referralEmails.ts` (`sendReferralEmail` from **noreply@** — referrer
        name + optional quoted note + 7-day-trial CTA + one-off provenance line for anti-spam), server action
        `sendReferral` in `account/actions.ts` (guards in order: honeypot → auth → email validity → required name →
        no self-referral → **≤10/day** → no re-invite same address within 30 days; **sends first, records only a
        successful send** so a failure never burns the limit), `web/components/account/ReferAFriendCard.tsx` (invite
        card with hidden honeypot + `noValidate` so brand-styled errors drive validation). Wired into `account/page.tsx`
        before the danger zone. **Email owner-approved via Artifact preview 2026-07-12 before build.** Verified:
        typecheck/lint/build green, **e2e 26/26** (new non-destructive test: invalid-email client validation +
        self-referral server rejection — neither sends an email); card render + hidden honeypot confirmed live in the
        preview DOM; `referrals` table left empty. **F2 (Parts A + B + C) COMPLETE.**
  - [x] **F2 MERGED LIVE + FULLY VERIFIED 2026-07-13.** Owner gave the go; clean fast-forward of `feat/f2-account-part-a`
        into `main` (`d6c5eb9`), Vercel prod deploy READY on www.majorcycle.com. Pre-merge typecheck/lint/build green;
        both F2 migrations confirmed present in the prod DB (Supabase MCP + REST check) before deploy.
        **Live-verified via Claude-in-Chrome** on `nibrasctg@gmail.com` (an email/password account; owner typed the
        password at each sign-in, Claude drove the DB via Supabase MCP and read sends via Resend MCP):
        (i) **all 6 subscription-status renders** — set `subscription_status`/`plan`/`trial_ends_at` in the DB, reload
        /account: null="Free Trial", trialing="Trial Active + runs until <date>", active·monthly/annual="Active + You're
        on the Monthly/Annual plan", past_due="Payment Due" (amber), canceled="Cancelled" (muted); country-lock ON for
        active/trialing/past_due; delete-card reassurance copy correct per state.
        (ii) **refer-a-friend** — real invite delivered (Resend) and landed in the Gmail **inbox** with name + quoted note;
        `referrals` row written then cleaned up.
        (iii) **delete + all three deletion-email variants fired live and body-verified via Resend `get-email`** — paid
        ("stays valid until the end of the period you've already paid for — doesn't cut it short or extend it"), trial
        ("free trial — the days you have left are saved"), none (no subscription line); each set `deletion_scheduled_at`
        to exactly +30d and delivered with the real hosted logo + en-AU date + disclaimer.
        (iv) **flows** — reactivate-by-signin → confined to /reactivate → "Reactivate my account" cleared the flag → back
        in the app; **sign-out on /reactivate logs out AND leaves the deletion scheduled** (correct — only reactivate
        cancels). Account restored to a clean baseline afterward. **Email spam audit: all 19 Resend sends `delivered`, zero
        bounces; the connected Gmail shows every MajorCycle email in INBOX (mostly IMPORTANT) and the spam folder empty.**
  - [x] **Part B (delete account) — BUILT + LIVE-VERIFIED 2026-07-11 (not yet merged).**
        Soft-delete + 30-day grace + reactivation + purge cron + two branded emails (owner-approved copy).
        Migration `20260711000000_account_deletion.sql` (applied via MCP): `universe_log.added_by_user` FK
        `NO ACTION`→`ON DELETE SET NULL` (the last blocker to a hard delete — profiles→auth.users is already
        CASCADE, analysis_runs CASCADE, ticker_requests SET NULL) + `profiles.deletion_scheduled_at timestamptz`
        (service-role-only — excluded from the F0.5 authenticated UPDATE grant, verified). New: server actions
        `web/app/(app)/account/actions.ts` (`requestAccountDeletion` = set flag + email + sign out + →/deletion-requested;
        `reactivateAccount` = clear flag + →/results), `web/lib/account.ts` (`ACCOUNT_DELETION_GRACE_DAYS=30`; a
        plain module because a `'use server'` file can only export async fns), `web/lib/email/{send.ts,accountEmails.ts}`
        (Resend REST via `renderBrandEmail`, from **noreply@**; greeting falls back to "Hi there,"),
        `web/components/account/DeleteAccountCard.tsx` (danger zone, two-step confirm gated on a checkbox),
        `web/app/(public)/reactivate/page.tsx` (reactivation gate), `web/app/(public)/deletion-requested/page.tsx`
        (public post-request confirmation), `web/app/api/cron/purge-accounts/route.ts` (CRON_SECRET-guarded GET;
        emails + `admin.auth.admin.deleteUser` for rows past `deletion_scheduled_at`). Edited: `web/app/(app)/layout.tsx`
        (confine scheduled accounts → /reactivate), `web/proxy.ts` (PUBLIC_PATHS += `/deletion-requested`, `/api/cron`
        — the cron sends a Bearer secret, not cookies, so it must bypass the auth redirect; **this was a real bug the
        live test caught — without it the middleware 307-redirected the cron to /login**), `web/vercel.json` (daily
        cron `0 3 * * *`), `.env.example` (CRON_SECRET + RESEND_FROM_EMAIL now used). **Verified live in
        the Claude preview:** danger-zone confirm gating; setting the flag → confinement redirect to /reactivate →
        one-click reactivate clears it (DB-confirmed); purge route returns 401 (no/blank secret) and
        `{"purged":0}` (valid secret); typecheck/lint/build green, **e2e 25/25** (added a non-destructive
        delete-gating test — never submits against the shared test account). Emails send via the same proven
        Resend path as /contact; the two templates were owner-approved as an Artifact before building.
  - [x] **Part B follow-ups (2026-07-12, not yet merged).** Delete card + deletion email now show a **status-aware
        reassurance BEFORE confirming** (`DeleteAccountCard` takes `subscriptionStatus`; the email takes
        `subscriptionKind: 'paid'|'trial'|null`): a paying subscriber reads "your subscription **stays valid until the
        end of the period you've already paid for — deleting won't cut it short or extend it**"; a trial user reads
        "your free trial's remaining days are saved, and you get them back". Hidden for free/no-sub users. (Earlier
        "paused, not cancelled — resumes with no gap" wording was removed: it implied a delete-and-restore loophole to
        gain paid time.) Both live-verified in the Claude preview (test account temporarily
        flipped to `trialing` then `active`, screenshotted, restored to null). SPGI phantom split re-appeared as
        expected (nightly cron runs `main`, which lacks the `_MIN_SPLIT_DEVIATION` guard on the unmerged branch) —
        left in place; self-heals at the Layer-F merge. The delete/danger buttons (`Button` `destructive` variant)
        now lift on hover like the primary CTA (shadow-grow + 1px rise, red-tinted) instead of just fading, matching
        the app's interaction language. The reworded deletion email (paid + trial variants) was **owner-approved via
        an Artifact preview 2026-07-12** → **F2 = Part A + Part B complete; only Part C (refer-a-friend) remains.**
  - **F3 subscription/deletion mechanics (decided now so the on-card + email copy is honest — TODO markers in code):**
      **(a) Deletion never grants extra paid time — trial and paid differ:**
      · **Paid** — on delete, set `cancel_at_period_end` (NOT pause). The subscription stays valid through the period
        the user already paid for, then stops with no renewal/charge. Deleting must **not** cut it short **or** extend
        it — a delete-and-restore cycle must not buy more paid time (this is the loophole the owner flagged 2026-07-12;
        the earlier "pause + push-out renewal" idea was wrong and has been removed from the copy). Reactivating within
        grace clears `cancel_at_period_end` so it renews normally again; the user keeps only the paid-through time they
        already had.
      · **Trial** — cancel-at-trial-end (**Step 6 final decision 2026-07-19**, superseding the earlier freeze/restore
        idea): on delete set `cancel_at_period_end` so the trial simply runs to its normal end with no charge;
        reactivating before then un-cancels it, otherwise the user returns as a lapsed free account. A trial is free, so
        there's no paid-time loophole — and this makes trial + paid deletion one identical mechanism (`frozen_trial_ms`
        now unused). **(b) Trial-abuse guard (built Step 7 — see below) = deterministic email tombstone (Stripe Radar's
      Free-trial-abuse control was the intended card-vector backstop, but was later left OFF — see Step 7).** The owner's later "no surprise charges" requirement (2026-07-19) replaced the original
      "card fingerprint → end trial at the webhook" idea (that charged by surprise): the email signal is enforced with
      know-before-pay copy. The same-card-across-different-emails vector was meant for Stripe Radar's Free-trial-abuse
      control (a Dashboard toggle), but that control was **left off** (per-signup fee; owner decision 2026-07-20) —
      it's an accepted gap now (see the Step 7 record below). The hashed tombstone still survives account deletion. **(c) EDGE CASES — plan thoroughly WITH the owner before coding (owner's ask 2026-07-12).** The grace
      window and the billing clock are independent, so their timings cross in several ways that each need a defined
      behaviour, e.g.: paid period (or trial) **ends during the 30-day grace**, then the user reactivates **after** it
      lapsed — is the account restored as a lapsed/free user prompted to resubscribe, or something else? Payment fails
      mid-grace; a `past_due` account requests deletion; reactivation exactly on the boundary date; trial ends mid-grace
      then reactivate. Enumerate every timing combination and its outcome as a table before implementation — do NOT
      code the deletion↔Stripe wiring until that plan is agreed.
  - **F3 carry-over findings from the F2 live verification (2026-07-13) — ✅ ALL RESOLVED in the F3 build (see progress below):**
      · **Sidebar licence badge** (`web/components/Sidebar.tsx`) only mapped `active`→"Active" and `trialing`→"Trial
        Active"; `past_due`/`canceled`/null fell through to "Free Trial." **✅ FIXED (F3 step 1):** full mapping
        (active/trialing/past_due/canceled/null→"No plan"). Live-confirmed the badge reads "No plan" for the E2E user.
      · **Deletion-date display timezone.** The 30-day grace *length* was always timezone-safe (absolute +30×24h
        `timestamptz`); only the *displayed* string was UTC-formatted. **✅ RESOLVED (F3, commit `6fe6d5a`) — but by a
        BETTER approach than originally suggested:** dates render in the user's **DEVICE timezone** (`LocalDate.tsx`, and
        device-zone captured at action time for user-triggered emails), NEVER `profiles.country`. Country = currency only.
        Rationale: someone travelling/relocated should see the date where their device actually is. See coding-standards §16.
      · **SPGI phantom split** — **✅ VERIFIED RESOLVED (2026-07-16):** the Daily Data Refresh cron ran 2026-07-16 00:03
        UTC *after* the stale pending row was deleted, and did NOT recreate it (`split_events`: 0 SPGI rows, 0 pending). The
        `_MIN_SPLIT_DEVIATION` guard is proven in production.
  - **F3 product decisions (owner, 2026-07-13):**
      · **Account creation ≠ trial start.** A user can register a FREE account with no card and no trial (already the DB
        behaviour — `handle_new_user` sets no status/trial; the "Free Trial" label is just the null-status fallback).
        Starting the 7-day trial (card required upfront) is an explicit opt-in later. Card-upfront + trial-abuse guard fire
        at the trial-START moment, not signup. Needs a distinct "No active plan" state (not "Free Trial") — folds into the
        sidebar-badge fix. **The paywall/gate is the FINAL F3 step, built LAST after all Stripe plumbing works. What exactly
        gets gated for a free/no-trial account is an OPEN owner decision (owner rejected the Results/Run/Stocks assumption) —
        do NOT presume; ASK the owner to define the gated scope before building the gate.**
      · **Global signups allowed; non-AU/CA billed in USD.** Anyone worldwide can sign up and subscribe; currency rule
        extends to AU→AUD, CA→CAD, everyone-else→USD (US$15/mo, US$126/yr). Add **Stripe Tax** for VAT/GST regions. Stock
        coverage stays US/AU/CA (still useful globally). The /account country dropdown already lists all countries.
**F3 BUILD PROGRESS** — branch `feat/f3-stripe` (NOT merged to `main` until F3 is complete + owner-approved).
Full plan: `~/.claude/plans/moonlit-prancing-lantern.md`. Verification is done entirely in Stripe **TEST mode**
(test cards/clocks, never real money).
- [x] **Step 1 — migration + carry-over fixes + secret-scan hook** (`1138090`). 8 service-role-only billing columns
      on `profiles` + `stripe_events` (webhook idempotency) + `trial_tombstones` (abuse guard, survives deletion);
      Sidebar badge mapping fixed; `.githooks/pre-commit` blocks `sk_`/`rk_`/`whsec_` in staged diffs.
- [x] **Device-timezone rework** (`6fe6d5a`) — on-screen + emailed dates in the viewer's device zone, not country.
- [x] **Step 2 — `web/lib/stripe.ts`** (`6a7fdf6`): pinned API version `2026-06-24.dahlia`, `resolvePriceId` by
      lookup_key, `currencyForCountry` (AU→aud/CA→cad/else usd), `mapStripeStatus`, `TRIAL_PERIOD_DAYS=7`.
- [x] **Step 3 — Checkout + `/pricing` + `/account` wiring** (`4d087a9`): auth-gated `POST /api/checkout` (hosted
      Checkout, 7-day trial applied in code, currency forced by country, `automatic_tax:false`); public `/pricing`
      (monthly/annual toggle, region currency from profile.country→geo→USD); `/account` "Start free trial" → /pricing.
      **Live-verified in Stripe TEST via preview**: CTA → `checkout.stripe.com` sandbox, 7-day trial, correct price
      ($15/mo)/currency (USD)/email-prefill.
- [x] **Account-save flake fix** (`991db2d`): profile save moved to a **server action** (the cold browser client
      could fire the UPDATE pre-auth → 0-row RLS no-op → a *false* "Saved"); browser Supabase client made a true
      singleton; e2e helpers re-auth + bounded-wait through transient middleware bounces + slow dev renders.
- [x] **Step 4 — Stripe webhook** (`ec0b441`): `web/app/api/stripe/webhook/route.ts` — the ONE writer of the billing
      columns (service-role; entitlement = server-derived Stripe truth). Signature-verified (bad sig → 400), idempotent
      (`stripe_events`; dup → 200 skip; handler throw → release claim → Stripe retries). Handlers re-derive from the
      event object (no live retrieves): subscription.created/updated → full sync; deleted → canceled; invoice.paid/
      payment_succeeded → active+clear grace; payment_failed → past_due+3-day grace; checkout.session.completed → link
      customer. **Contract tests** `web/e2e/stripe-webhook.spec.ts` (plan §14): 8/8 — sign events → POST → assert the
      `profiles` row + idempotency + bad-sig 400, no network to Stripe; run in the existing CI e2e job, self-skip until
      `STRIPE_TEST_SECRET_KEY`+`STRIPE_TEST_WEBHOOK_SECRET`+`SUPABASE_SERVICE_ROLE_KEY` secrets set.
- **Owner setup done (2026-07-16):** GitHub Secret `STRIPE_TEST_SECRET_KEY` ✅; Vercel **Preview** env
      `STRIPE_SECRET_KEY`=`sk_test_…` ✅ (Sensitive, Preview-only). Stripe **test-mode** product + 2 prices built
      (mirror live, same lookup_keys).
- [x] **Step 4 real end-to-end verified (2026-07-17) — via Stripe CLI, and it caught a real bug.** The preview URL is
      behind **Vercel Deployment Protection** (`vercel_auth_enabled:true`) → Stripe's server-to-server POST gets 401 and
      never reaches the route, so the "register webhook at preview URL" plan can't work without exposing previews. Instead
      tested the canonical way: **Stripe CLI** (`stripe login` → main account **test mode**; owner-interactive) +
      `stripe listen --forward-to localhost:3000/api/stripe/webhook` (its `whsec_` written to `web/.env.local`, gitignored,
      never displayed). Created a throwaway product/price (`lookup_key=majorcycle_monthly`) + customer (`pm_card_visa`) +
      trialing subscription with `metadata.user_id`=e2e profile. Real events forwarded → route returned **200** for all →
      DB written (plan=monthly, currency=aud, customer/sub ids, trial-end). **BUG FOUND + FIXED:** a 7-day trial's **$0
      invoice is marked paid instantly**, so `invoice.paid`/`payment_succeeded` fired and the handler's unconditional
      `status='active'` **clobbered `trialing`** → a real trial user would show as a paying "active" sub. Fix
      (`web/app/api/stripe/webhook/route.ts`): a paid invoice now **only clears grace + recovers `past_due`→active**
      (atomic guarded update, `.eq('subscription_status','past_due')`) — never downgrades `trialing`/resurrects `canceled`;
      `customer.subscription.*` stays the authoritative status writer. Re-tested with a fresh trial sub → status=**trialing** ✅.
      Added regression test (`stripe-webhook.spec.ts`: "a trial's paid $0 invoice must NOT downgrade trialing → active").
      Suite now **35/35 green**. Stripe test data cleaned up (customers deleted, price/product archived, `stripe_events` cleared,
      profile reset). Note: the whsec in `.env.local` is a real **test-mode CLI** secret (local only).
- [x] **CI webhook tests enabled (2026-07-17).** GitHub secret `STRIPE_TEST_WEBHOOK_SECRET` set (a transparent
      non-sensitive offline-signing value — the contract tests sign+verify with the same string, so it need not match a
      real endpoint). All three CI secrets now present. NOTE: CI only runs on **push to `main`** / **PRs to `main`**
      (`ci.yml`), not on feature-branch pushes — so these first execute in CI on the **F3 PR**. Proven green locally (35/35).
- [ ] **Production webhook (at F3 merge):** register the LIVE endpoint at `majorcycle.com/api/stripe/webhook` (prod is
      NOT auth-walled and is LIVE mode) → put its `whsec_` in Vercel **Production** `STRIPE_WEBHOOK_SECRET`. (The preview
      URL can't be used — it's behind Vercel Deployment Protection; Stripe gets 401.)
- [x] **Auth-middleware / session consistency (done 2026-07-17).** The `getClaims()`-hiccup theory was WRONG (JWTs
      live ~1h, so no refresh race during a test). Real root cause: the e2e account + auth suites share ONE test user,
      and the app's Sign-out used the Supabase default **`scope: 'global'`** — which revokes the user's sessions on
      EVERY device. Run concurrently, the auth suite's sign-out revoked the account suite's session mid-test → bounce
      to `/login`. Fix (at the source, not a test crutch): `auth/signout` → **`scope: 'local'`** (one device only; also
      correct product behaviour + explains the rare prod "Session not found") and account-deletion → explicit
      `scope: 'global'`. Also gave the Stripe webhook contract tests their **own throwaway user** (was sharing the login
      row → country-lock collision) and dropped the account suite's re-auth crutch. Full auth+account+webhook suite:
      34/34 green ×3 under 3 parallel workers. Broader auth audit found no other issues (singleton browser client, no
      `getSession()` footgun, careful recovery confinement). The exploratory middleware `getUser()` fallback was reverted.
- [x] **Step 5 — Customer Portal + full clickable demo (DONE + LIVE-VERIFIED 2026-07-18).** New `web/app/api/portal/route.ts`
      (auth-gated POST → `billingPortal.sessions.create` → 303 redirect; no customer → `?billing=none`, error → log +
      `?billing=error`); `SubscriptionCard` disabled placeholder → real "Manage billing" form-POST button + inline notice;
      account page reads `?billing=` and passes the notice. Gates green; committed. **Env aligned to the sandbox** (app key +
      prices already there); created the sandbox Customer Portal config `bpc_1TuR6R…` (update/cancel/payment/invoice, Terms +
      Privacy URLs) and ran `stripe listen` against the sandbox. **Full demo driven in the browser (Claude preview, TEST):**
      magic-link login (AU demo user) → `/pricing` shows A$19 → Start trial → Stripe Checkout (7 days free, A$19, card 4242) →
      webhooks forwarded [200] → `/account` flipped to **Trial Active** (trial-status fix re-proven: the $0 trial invoice did
      NOT downgrade to "active") + country locked → **Manage billing → Stripe Customer Portal** (trial ends Jul 25, $19/mo,
      update/cancel, Visa ••4242) → Return → `/account`. All demo data cleaned up (sub cancelled, customer deleted, throwaway
      user + 12 stripe_events rows removed). Prod webhook endpoint still deferred to F3 merge (Vercel preview is auth-walled).
- [x] **Audit pass — Stripe + Supabase best practices (2026-07-18, commits `907b948` + `93a681c`).** (a) Webhook
      idempotency: `web/app/api/stripe/webhook/route.ts` now claims the event id via an **ON CONFLICT DO NOTHING** upsert
      (`.upsert({id,type},{onConflict:'id',ignoreDuplicates:true}).select('id')`; empty result = duplicate) instead of
      insert-then-catch-23505 — identical semantics, but a Stripe redelivery no longer spams the Postgres log with
      `duplicate key … stripe_events_pkey`. (b) `web/lib/stripe.ts` client now sets **`maxNetworkRetries: 2`** (SDK
      default is 0). (c) `web/app/api/checkout/route.ts` — the two silent `catch {}` now `console.error` the real cause
      (owner can't debug a blank 500/502) while still returning clean user copy. (d) Supabase: **referrals RLS** policies
      rewritten to `(select auth.uid())` (migration `20260718000000_referrals_rls_initplan.sql`) → advisor
      `auth_rls_initplan` cleared; **pg_trgm moved `public`→`extensions`** (migration
      `20260718010000_move_pg_trgm_out_of_public.sql`; verified search_listings still uses the trigram index) → advisor
      `extension_in_public` cleared. (e) Owner enabled **leaked-password protection** in the Supabase dashboard (UI already
      surfaces it via `friendlyAuthError`, no code change). Remaining advisors are intentional/non-issues (9× server-only
      `rls_enabled_no_policy` = correct lockdown; `unused_index` = pre-launch false positives, revisit at live-Stripe;
      `auth_db_connections_absolute` INFO = scale-time knob, N/A on current compute). All verified: typecheck+lint clean,
      webhook e2e 9/9, account e2e 5/5.
- [x] **Profile-save Back-nav bug FIXED (2026-07-18, commit `9029762`).** `updateProfile` (account/actions.ts) persisted
      correctly but didn't invalidate the client Router Cache, so save → `/pricing` → Back re-showed `/account` from the
      stale pre-save snapshot (country looked unsaved though the DB was right). Fix = `revalidatePath('/account')` after a
      successful update. Verified live (set AU, saved, soft-nav to /pricing, Back → shows Australia).
- [x] **PUNCH-LIST (owner-agreed 2026-07-18) — WORKED 2026-07-18/19, branch `feat/f3-stripe`:**
      1. [x] **DB-write sweep DONE** (commit `cc9c0a5`). Audited every mutating server action + write API route:
         the profile-save `revalidatePath` gap was the ONLY real staleness bug — everything else is already safe
         (deletion signs out globally; reactivation redirects → fresh layout; referrals/contact display nothing back;
         request-ticker manages its own client list; password/onboarding use `router.refresh`). **Bonus fix:**
         `OnboardingModal` was the last client-side Supabase write (same silent-no-op-under-RLS risk as the old profile
         bug) → **converted to a server action** `web/app/(app)/actions.ts` `acknowledgeDisclaimer` (derives user from
         session, `revalidatePath('/','layout')`, surfaces a retry error instead of getting stuck). **NEXT SESSION: verify
         the onboarding change with a real login** (couldn't exercise the first-login modal locally — DEV_BYPASS_AUTH skips
         it; compile + typecheck clean).
      2. [x] **Local webhook forwarder DONE** (commits `120501d`, `0122f4d`). `pnpm stripe:listen`
         (`web/scripts/stripe-listen.mjs`) forces the SANDBOX account via `STRIPE_API_KEY` read from `web/.env.local`
         (never printed / not in argv), sidestepping the CLI-default-account gotcha. Verified: connects to "MajorCycle
         sandbox" `acct_1TrdbFGc5r0QcK9U`, reaches Ready, and the CLI signing secret **already matches**
         `STRIPE_WEBHOOK_SECRET` in `.env.local` (loop works with zero manual step). **DONE + owner-verified
         2026-07-19** — live 4242 checkout drove `[200]` webhooks and `/account` flipped to "Trial Active". (Owner
         hit a stale-PATH `'pnpm' not recognized` in an old terminal → fix = open a fresh terminal.)
      3. [x] (dotted zero — left as-is, JetBrains Mono trait. No change, as agreed.)
      4. [x] **Country IP auto-fill + currency consistency DONE** (commit `e30c7aa`). `web/lib/countries.ts` audited =
         the FULL correct ISO-3166-1 alpha-2 list (same codes Stripe + Vercel use), **NOT a dummy list**; only AU/CA
         affect currency and both correct; every other country → USD safely. Explained to owner: Stripe **locks a
         subscription's currency permanently** (verified in Stripe docs), we set it explicitly from country so *shown
         price == charged price* (that's why country is locked once subscribed). **Bug found + fixed:** the trial modal
         DISPLAYED price via saved→IP→USD but checkout CHARGED via saved-only → new resolver `effectiveBillingCountry`
         (`web/lib/stripe.ts`) now shared by /pricing, the account trial modal, and `/api/checkout`; checkout also
         **persists the resolved country** before the sub locks the currency, so stored country == charged currency.
         Autofill = pre-fill dropdown from `x-vercel-ip-country` as a changeable default; `ProfileForm.suggestedCountry`
         keeps the saved baseline empty so it's savable in one click; saved only on user action. **NEXT SESSION: verify
         autofill ON THE LIVE/PREVIEW SITE — the edge header is empty on localhost, so the IP path can't be exercised
         locally** (the Save-enabled-with-suggestion behaviour WAS verified in the dev-fixtures gallery).
      5. [x] **Trial entry styled like the Methodology modal DONE** (commit `767c9da`). New `StartTrialModal` +
         `StartTrialButton` (`web/components/account/`): the Account "Start free trial" button now opens an in-app modal
         reusing the Methodology modal's shell (blurred backdrop, gradient header + icon, disclaimer footer) with the plan
         chooser + `/api/checkout` hand-off — instead of jumping to `/pricing`. Public `/pricing` page unchanged (owner
         chose "Account button only"). Verified in dev-fixtures: AUD price + annual toggle correct, no console/a11y errors.
- [x] **LOCAL VERIFY SESSION (2026-07-19) — owner drove the browser, agent drove servers + DB; verification only, no code
      changes committed.** Two of the three deferred punch-list checks passed:
      - **Local Stripe trial loop VERIFIED.** `pnpm dev` + `pnpm stripe:listen` (sandbox, signing secret already matched
        `.env.local`); owner paid test card 4242 on `e2e@majorcycle.com` → **every webhook `[200]`** → DB confirmed
        `subscription_status=trialing`, `subscription_currency=usd` (no edge header locally → USD, correct),
        `trial_ends_at=2026-07-25 15:18:56Z`, `country=null` (checkout persists a country only when it can resolve one;
        empty edge header locally → nothing persisted → correct). Manage billing opened the sandbox Customer Portal; the
        portal **Cancel** fired `customer.subscription.updated` `[200]`. Owner's four "is this a bug?" questions all
        resolved as working-as-designed: trial "25th" (portal shows UTC; our app shows the local 26th via `<LocalDate>`;
        exactly 7 days), cancel-at-period-end keeps access (decision #21), portal stays on Stripe after cancel (its UX;
        Return uses our `return_url`→/account), `$0.00 Paid` trial invoice (zero-dollar trial-start invoice, no money).
      - **OnboardingModal server-action VERIFIED with a real login.** Reset `acknowledged_disclaimer_at=null` on the e2e
        account → owner saw the "Welcome to MajorCycle" modal → ticked ack + Continue → DB showed a fresh timestamp →
        proves `acknowledgeDisclaimer()` writes reliably (old browser-client write could silently no-op under RLS).
        Original timestamp restored; e2e account reset to a clean never-subscribed baseline afterward.
      - **Country autofill VERIFIED on preview (2026-07-19).** On the `feat/f3-stripe` preview alias, signed into the
        `country=null` e2e account from Australia: `/account` Country pre-filled to "Australia" (savable in one click),
        `/pricing` + the trial modal showed **A$19 AUD** — the `x-vercel-ip-country` edge path works end-to-end (it's
        just empty on localhost, which is why it needed a real deploy).
      - **⚠ REAL STEP-6 FINDING — read `cancel_at`, not `cancel_at_period_end`.** In API `2026-06-24.dahlia` a portal
        cancel-at-period-end leaves `cancel_at_period_end=false` and instead sets `cancel_at` (= period/trial end) +
        `cancellation_details.reason`. `syncSubscription` reads only the old boolean, so the DB never records that a sub is
        *scheduled* to cancel (the eventual `subscription.deleted`→`markCanceled` still works, so nothing gets stuck — only
        the interim "scheduled" state is invisible). Fold the fix into Step 6 (capture `cancel_at`; derive "will cancel"
        from it; then surface a "Cancels on <date>" line on the SubscriptionCard, which is also currently missing).
- [x] **Step 6 — delete↔billing wiring + `cancel_at` fix + traceability (2026-07-19, branch `feat/f3-stripe`).**
      Owner chose the **simpler trial path** (cancel-at-trial-end via `cancel_at_period_end`, not freeze/recreate), so
      trial + paid delete are one mechanism; `frozen_trial_ms` is now unused. Changes: (A) webhook derives
      `cancel_at_period_end` from `sub.cancel_at` (the dahlia signal; the old boolean stays false); (B) SubscriptionCard
      shows a "…cancels on <date>, won't renew" line; (C) `requestAccountDeletion` sets `cancel_at_period_end=true` on
      the live sub (trial cancels at trial end, no charge; paid runs out the paid period); (D) `reactivateAccount` clears
      it if the sub is still live (else lapsed free user); (E) purge cron hard-cancels the sub (+ list-by-customer
      fallback for the pre-sync-id race); (G, owner-requested) `stripe_events` gains `user_id`/customer/subscription
      traceability columns (migration `20260719000000`), stamped after each handled event. E7: trial deletion-email copy
      corrected (no more "days saved/restored"). **Verified:** typecheck/lint/build green; webhook contract tests 10/10
      (incl. new cancel_at + ledger-enrichment case); the delete/reactivate/purge Stripe ops driven against the real
      sandbox (8/8 — cancel_at set==trial_end, cleared, list-fallback, hard-cancel); advisors show no new warnings;
      `stripe_events` test rows purged. **Owner-live-verified 2026-07-19** — owner drove the login; delete→reactivate
      confirmed in the DB + Stripe sandbox (deletion scheduled with no charge, then un-cancelled on reactivate) and
      Part G traceability confirmed on the real events. The in-app `DeleteAccountCard` trial copy still described the
      old freeze model — caught during the live drive and fixed (commit `ba56c31`). NOT merged.
- [x] **Step 7 — trial-abuse guard (email tombstone + Stripe Radar) (2026-07-19, branch `feat/f3-stripe`, commit
      `ff461ab`; column drop `ee67042`).** Owner requirement **no surprise charges — the user is told before paying**
      overrode the original email+card-fingerprint-end-trial-at-webhook plan (which charged by surprise). Design:
      deterministic **email tombstone** (`trial_tombstones.email_hash` = sha256 lower+trim; new `web/lib/trialGuard.ts`),
      written once a sub goes trialing (`syncSubscription`) + at purge; read at checkout (omit `trial_period_days` for a
      repeat email) and on the account trial modal + signed-in `/pricing` (honest "already used your free trial — billed
      today, no free week" copy + dynamic price BEFORE checkout; button → "Subscribe"). Dead `frozen_trial_ms` column dropped
      (`20260719120000`). Gates green; webhook contract tests **11/11** (incl. tombstone write); honest modal verified
      in-browser (monthly + annual pre-pay callout). NOT merged.
      **Radar review + fraud settings (redone live 2026-07-20 via Claude-in-Chrome, LIVE acct — supersedes the 07-19
      "private preview" finding):** the managed **"Free trials"** control is now **available** (out of preview), but its
      prerequisite *"Radar on payment methods saved for future use"* **bills a per-SetupIntent fee** (~A$0.05–0.07 on
      every trial signup, converting or not). **Owner decision: leave it OFF and rely on the free email guard**; enable
      later only if real card-based trial abuse appears. So the same-card-across-different-emails vector is an **accepted
      gap**, covered only by base Radar's always-on high-risk blocking. Free wins we DID enable (backtest = 0 legit
      blocks): the built-in **CVC-fail** and **postal-fail** "block based on risk score" Radar rules. Adaptive 3DS +
      editing the risk dial (left at "Balance risk and revenue") both require **paid Radar for Fraud Teams** → skipped;
      the free "request 3DS on all cards" stand-in was declined (signup friction). The now-dead
      `trial_tombstones.card_fingerprint` column + index were dropped
      (`20260720120000_drop_trial_tombstones_card_fingerprint`).
      **Step 7 live end-to-end verified 2026-07-20 (owner-driven, localhost + Stripe sandbox, Claude-in-Chrome):**
      fresh email → "Start free trial" → sandbox checkout "7 days free" → DB `trialing`/monthly/AUD + `trial_ends_at`
      + **email tombstone written, hash == sha256(email)** + UI "Trial Active" + country-lock engaged. Repeat
      (tombstoned) email → button "Subscribe" → honest modal ("Subscribe to MajorCycle / your free trial has already
      been used / charged A$19 today, no free week") → sandbox checkout shows "A$19.00/month" with **no free-trial
      line** (proves the backend omit-trial enforcement). Currency: USD on localhost (no Vercel geo header), AU$19
      once `country=AU` — geo-currency only runs on the deployed site, so this is correct, not a bug. Sandbox sub
      canceled + test customer deleted + DB/tombstones/`stripe_events` reset to baseline. NOTE: the checkout route's
      `getUser()` is a network call that cold-connect-stalled locally ("Not signed in"); same client-side IPv6 stall
      (see [[reference-local-dev-ipv6-connect-fix]]) — not a live issue (Vercel↔Supabase), fixed for the test with a
      keep-warm pinger.
- [x] **Step 8 — trial reminders + billing emails + dispute handling (built 2026-07-20; branch
      `feat/f3-stripe`, NOT merged).** New `web/lib/email/billingEmails.ts` (4 branded senders:
      trial-**started** welcome, trial-ending, payment-failed dunning, payment-recovered) + optional Resend `Idempotency-Key`
      on `send.ts`. Webhook now: `trial_will_end` → branded reminder (skipped if `cancel_at` set) +
      `trial_reminder_sent`; `invoice.payment_failed` (renewals only) → single-owner `grace_until`
      anchor + dunning email once; paid/succeeded → guarded recover + recovery email; `charge.dispute.*`
      → `billing_blocked` (real chargeback only) + cancel-on-lost. `grace_until` made single-owner
      (removed the healthy-sync clear) → ordering-proof, dedup-safe. Email previews 05–08 in
      `reference/email-templates.html`.
      **Audit-driven additions (2026-07-22, this session):** full re-audit vs the *latest* Stripe docs +
      the live account (all 3 MCP connectors verified). Findings: (a) no unhandled event can error — the
      webhook no-ops unknown types; (b) collection works (card_payments/charges/payouts all active), and
      subscription-mode Checkout auto-filters to recurring-capable methods (cards + wallets + Link), so the
      account's active BNPL capabilities simply don't show — no error; (c) two **notification** gaps closed:
      **(1) trial-started welcome email** — new `sendTrialStartedEmail`, fired from `subscription.created`
      only when `trialing` (repeat/no-trial customers get the Stripe receipt instead); **(2) receipts/invoices**
      = Stripe's built-in **"Successful payments"** Dashboard toggle (owner-approved) — auto-emails a branded
      receipt + invoice-PDF link on every real charge, no $0-trial spam; folded into the Part C dashboard pass.
      Also per owner: trial-ending body reworded "ends in a few days" → **"ends soon"** (robust across the
      reactivation path). Added a contract test for the non-trial `created` path (no welcome). Tests **21/21**.
      **Sandbox drive DONE (2026-07-21, agent self-check):** trial reminder / dunning / recovery /
      dispute (created→won→lost) all verified live against the Stripe sandbox + a test clock; every
      webhook 200, zero errors; sandbox + DB reset to baseline. (CLI `stripe listen` drops test-clock
      event bursts on its ~60–90s session-reconnect → resend the missed event via `stripe events
      resend`; local-only artifact, prod uses a registered endpoint + Stripe retries.)
      **Cancellation edge cases + 2 fixes:** cancel-during-trial (reminder suppressed, no charge) and
      cancel-paid (no Step-8 email) verified; (1) **reactivation reminder gap-fill** — `reactivateAccount`
      sends the trial-ending email if a member cancels then reactivates inside the last 3 trial days
      (Stripe's one-time signal already passed); (2) **stale `subscription.deleted` guard** (only lapse
      the sub on file).
      **Full audit vs official Stripe + Supabase docs + 2 fixes:** (3) `invoice.payment_failed`
      **and** `invoice.payment_action_required` (3-D Secure) now share the dunning path, both guarded on
      the current sub (recovery guarded the same way) — a late/out-of-order failure can't lock a
      cancelled or newer account. Contract tests **20/20**; gates green.
      **Part C dashboard toggles — DONE 2026-07-22 (owner-driven via Claude-in-Chrome, LIVE mode).**
      **"Successful payments" receipts turned ON** (Settings → Emails; verified persisted) → branded
      receipt + invoice-PDF link on every real charge. Verified already-correct (no change needed):
      Stripe's own **trial-ending + failed-payment** customer emails all **OFF** (Settings → Billing →
      Subscriptions and emails) so they don't collide with our branded ones; **Smart Retries ON** (8 tries
      / 2 weeks); **"if all retries fail" = cancel the subscription**. Deferred by owner: **payouts kept
      MANUAL** (no customers yet — switch to Automatic later; how-to goes in the **F-layer payments
      monitoring checklist**); **branding (logo/navy) = Step 9** (receipts valid but plain until then).
      **Guided live check together — DONE 2026-07-24 (owner present, Stripe sandbox + real inbox).**
      All five billing-lifecycle paths driven end-to-end via test clocks + the `sk_test` harness (NOT the
      LIVE-scoped Stripe MCP), every branded email verified in `ayaatnibrasaziz@gmail.com` via the Gmail
      connector: (1) trial-started welcome (AU$19/mo copy, name, approved wording); (2) trial-ending
      "ends soon" + `trial_reminder_sent` marker; (3) cancelled-trial → **zero** emails (welcome + reminder
      both suppressed); (4) payment failed → `past_due` + `grace_until` + "update your card", then good-card
      pay → `active` + grace cleared + "you're all set"; (5) disputes: create → `billing_blocked=true`,
      won → false, lost → stays true + sub cancelled + `stripe_subscription_id` nulled. Sandbox (test clocks)
      + all touched DB rows / tombstones / `stripe_events` reset to the exact 0/0/0 baseline afterward.
      **Webhook event-subscription policy decided + documented** (architecture §7): the LIVE endpoint
      subscribes to **only the 13 handled event types** (Stripe best practice — don't ingest events you
      don't act on); `stripe_events` is for idempotency + our-actions attribution only, NOT a copy of
      Stripe's raw stream (that's Workbench → Event deliveries, 30-day retention). Null-attribution rows
      seen locally are a `stripe listen` firehose artifact; disputes legitimately have no subscription id.
      **Still remaining for Step 8:** at merge, create the LIVE webhook endpoint subscribed to the **13
      event types** (incl. `invoice.payment_action_required`).
- [x] **Step 9 — Stripe branding — DONE + LIVE-VERIFIED 2026-07-25 (owner-driven via Claude-in-Chrome,
      LIVE account `acct_1Trdax…`; no code — pure Dashboard config).** Confirmed against current Stripe docs
      + the live account (`GET /v1/accounts`). All customer-facing Stripe surfaces now read as MajorCycle:
      **Branding** (`settings/branding`) — icon `web/public/logo.png` (512²) + a logo (owner also uploaded one,
      "prefer logo over icon" ON); **brand + accent colour both `#04163e`** (owner chose monochrome navy after
      previewing — the mid-blue `#1E5CB3` muddied against the icon's own blue). **Public details** — support
      email `support@majorcycle.com`, support URL `…/contact`, Privacy `…/privacy` + Terms `…/terms`;
      **support address left BLANK** (owner: no address on receipts — Stripe accepted it; only a bare
      `country:AU` lingers, no street/city, home address never shown). **Checkout settings** — Legal-policy
      links + "agree to legal terms" + Contact-info display ON; Refund/return OFF (no-refund SaaS). **Invoice
      template** — memo "Thanks for subscribing to MajorCycle." + footer "ABN 60 469 571 324 · MajorCycle
      provides educational information only — not financial advice." **Customer Portal** already on-brand
      (header "Manage your MajorCycle subscription and billing.", redirect `/account`). Left as-is: statement
      descriptors (`WWW.MAJORCYCLE.COM` / prefix `MAJORCYCLE`), business name, Product (all already clean).
      **EXCLUDED (researched):** custom domain (paid ~US$10/mo, not free); custom email domain (free but owner
      prefers the `stripe.com` receipt as a trust signal); wordmark-only logo; return/refund UI; product image.
      **Checkout font/shape polish declined** (owner kept the clean default look). **GOTCHA: the Branding page
      does NOT auto-save — the "Save changes" button is mandatory** (verified branding was still null in the API
      until Save clicked). Icon upload can't be automated (Stripe native file picker) — owner picks the file.
      **VERIFIED:** re-`GET /v1/accounts` shows branding populated; **real branded test receipt landed in
      `ayaatnibrasaziz@gmail.com`** (read via Gmail connector) — navy `#04163e` header, M icon, support
      email+URL, **no address**, Stripe trust-signal footer; Checkout + Portal previews on-brand.
- [~] **Step 10 — paywall gate + free tier (owner-approved plan, 2026-07-26).** Code COMPLETE and
      self-verified; **NOT merged**. Scope agreed with the owner: a signed-in FREE tier (no card)
      keeps browse, the price chart, the drawdown overlay + cycle bands and every
      fundamentals/sentiment section; PREMIUM is our judgement (Overall Rating, Health Score,
      verdict, scorecard/radar, rating badges), the report, and the whole screener. See
      architecture §7.1 for the rule, the seam and the two cache traps.
      - Built: `lib/entitlement.ts` (+13 contract tests) · `lib/entitlement.server.ts` (React
        `cache()` so layout+page share one query) · `CycleAnalysisFree`/`CycleAnalysis` split ·
        `/api/cycle` internal-secret + `entitled` query param + `private, no-store` ·
        `/api/analyze` 402 + secret injection · locked-state UI · sidebar DISCOVER/SCREEN ·
        header account menu · home moved Results→Browse via the `POST_AUTH_HOME` choke point ·
        honest signup copy (signing up never did start a trial) · CI paywall tripwire.
      - Gates green: typecheck, lint, build, report-parity, entitlement-guard, ruff, mypy,
        pytest 86, Playwright 60/60.
      - [x] **`CYCLE_INTERNAL_SECRET` set in Vercel — DONE 2026-07-26** (owner-driven via
        Claude-in-Chrome; owner typed the value blind, I never saw it). **Sensitive**, scoped
        **Production + Preview**, with a rotation note. Development deliberately excluded —
        locally `next dev` computes the cycle by spawning `cycle.py` as a CLI, so it never makes
        the HTTP call the secret guards. Vercel injects env vars at BUILD time, so it takes
        effect on the next deployment (i.e. when this branch deploys — no action needed).
      - [x] **All three migrations APPLIED to production — DONE 2026-07-26** (owner approved the
        DDL; applied via the Supabase connector, each verified against the live DB afterwards).
        - `20260726000000` drop `idx_bars_ticker_date` — a DESC-only duplicate of the PK.
          **Database went 1,211 MB → 910 MB**, so it now fits inside the Micro instance's 1 GB
          RAM and the US$15/mo compute upgrade stays unnecessary. One fewer index per cron upsert.
        - `20260726010000` `free_views_date` + `free_views_tickers` on `profiles`.
        - `20260726020000` **`record_free_view()`** — added during the build, not in the original
          plan. The plan's read-append-write in TypeScript was **wrong**: two round-trips over a
          whole array lose count under concurrency, and the array overwrite means N parallel
          requests each write "their" single ticker and clobber each other — a scraper (the exact
          thing the fence exists to stop) would get N pages recorded as one. The function does the
          check and the append under `select … for update`, so it cannot be raced. Service-role
          EXECUTE only; `search_path` pinned. Verified live: first view, repeat view (free, no
          increment), at-cap, over-cap denial, already-seen-still-allowed-at-cap, UTC-day reset,
          unknown-user fail-open, and that neither `anon` nor `authenticated` may execute it.
      - [x] **Free-tier daily view counter — BUILT 2026-07-26.** `lib/freeViews.ts` +
        `FREE_VIEW_DAILY_LIMIT = 25` distinct tickers per **UTC** day, enforced in the Stock
        Detail page *after* `notFound()` (a typo'd ticker never costs a view) and skipped
        entirely for subscribers (locked decision #18 — no usage limits). Over the cap, a new
        stock renders an honest "daily browsing limit reached" notice; stocks opened earlier the
        same day still load. **Fails OPEN** on a DB error, the deliberate opposite of the
        entitlement gate — the premium fields are already stripped upstream, so over-throttling a
        free reader would cost goodwill for no security gain. `prefetch={false}` added to the
        Browse stock links (finding B5): `next/link` prefetch RUNS the server component, so
        scrolling the list would otherwise have burned quota silently.
      - **GRANT finding (2026-07-26, from the live DB — not visible in the migration text).**
        The counter migration's column-level `REVOKE` does **not** do what its comment claimed:
        Postgres cannot subtract a column from a table-level GRANT, and `authenticated` does hold
        table-level SELECT/INSERT on `profiles`. What actually protects the counter is that
        **`authenticated` has no table-level UPDATE at all** — its UPDATE is granted per column
        (`display_name`, `country`, `acknowledged_disclaimer_at`), so a new column is unwritable
        the moment it is added. The migration comment was corrected to say so, and
        `check-entitlement-gates.mjs` gained a check that fails CI if any migration ever issues
        table-level `grant update on profiles to authenticated`. (`anon` does hold table-level
        UPDATE, inherited from Supabase defaults — not exploitable, since the RLS policy requires
        `auth.uid() = id` and an anonymous caller has none. Tightening it is still open.)
      - [x] **Behavioural matrix BUILT 2026-07-26** — `web/e2e/entitlement-routes.spec.ts`, 23
        tests. This was specified in the approved plan (§9.3) and had **not** been built; the
        gap was found by the owner asking why the guided check came before full self-checking.
        It creates its own throwaway auth user, signs in, and walks **all seven** subscription
        states against real pages and the real API, then deletes the account (verified: zero
        DB residue). Covers `/run` + `/results` + the report page (render vs
        `/pricing?reason=…`), `POST /api/analyze` (past-the-gate vs **402** with the right
        reason), `/api/cycle` (**401** without the secret and never a redirect; accepted with
        it), deletion-scheduled → `/reactivate` outranking `/pricing`, the free-tier cap
        (blocked on a NEW ticker, allowed on one already seen, never applied to a subscriber),
        and that a signed-in user **cannot** write their own counter or `subscription_status`
        while **can** still write `display_name`/`country`. The decisive one: a free viewer's
        Stock Detail markup contains no `NN/100` anywhere, and the same page for an `active`
        account does — proving the bytes are withheld, not hidden.
        **Mutation-tested:** forcing `hasAccess` to return true makes the suite fail
        immediately; `lib/entitlement.ts` restored byte-identical afterwards (empty git diff).
        Wired into the CI `e2e` job (self-skips without the service-role key).
        **Playwright now 83 tests, all passing** (was 60).
      - Guard now at **8 checks**; both new checks proven to fail on a deliberately broken input
        and to pass on the correct column-scoped form. Supabase security advisors re-run after
        the migrations: same 9 INFO `rls_enabled_no_policy` notices as before, no new findings,
        and no `function_search_path_mutable` warning for the new function.
      - **Owner actions still outstanding:** (1) upgrade Vercel to **Pro** — Hobby forbids
        commercial use and the site takes payments (**plan badge visually confirmed as Hobby
        2026-07-26**); owner has scheduled this for **the end of Phase 1, at official launch**;
        (2) create the LIVE Stripe webhook endpoint (13 events) at merge; (3) add a LIVE
        `STRIPE_SECRET_KEY` to Production (below).
      - [x] **LIVE `STRIPE_SECRET_KEY` set in Vercel Production — DONE 2026-07-26**
        (owner-driven Claude-in-Chrome; owner revealed and pasted the value, I never saw it).
        A **restricted** key (`rk_live_`) named `MajorCycle web app - production`, created with
        exactly **6** permissions — deliberately NOT Stripe's "Recurring subscriptions and
        billing" template, which grants 40. Scoped **Production only**, *Sensitive*; the
        pre-existing Preview entry (test key) was left untouched. Permissions verified twice:
        once before saving and once by re-reading the key's own edit page.
        - Mapping to real call sites (Stripe's rule: GET → read, POST/DELETE → write, and
          **write implies read**): Checkout Sessions **write** (`POST /v1/checkout/sessions`) ·
          Customer Portal **write** (`POST /v1/billing_portal/sessions`) · Subscriptions
          **write** (`POST`/`DELETE /v1/subscriptions`; `list` covered by write→read) · Prices
          **read** (`GET /v1/prices`) · Charges and Refunds **read** (`GET /v1/charges/:id`,
          dispute attribution). No `Products`, `Invoices` or `Payment Intents` permission is
          needed — the webhook reads invoice/dispute data from the **event payload**, and
          `webhooks.constructEvent` is local crypto with no API call.
        - **Open, deliberately not yet tightened:** `Customers` was granted **write** but **no
          `/v1/customers` request exists anywhere in the code**. Passing `customer` /
          `customer_email` to a Checkout Session is a field on *that* resource. Verify in the
          **sandbox** with an identically-scoped test key set to Customers = None; if checkout
          and portal still work, drop it live. Stripe returns an `invalid_request_error` naming
          the missing permission, so a failure would be self-diagnosing.
        - Also found: an **unnamed, never-used restricted key from 10 Jul with broad write
          scopes** still exists on the live account. Left alone; recommend expiring it.
      - 🔴 **WEBHOOK FINDINGS (2026-07-26) — both must be handled at merge:**
        1. **The endpoint URL must use `www`:** `https://www.majorcycle.com/api/stripe/webhook`.
           Verified by request: the apex `majorcycle.com` answers **307 → www**, and Stripe's
           docs are explicit — *"We consider redirect responses to webhook requests as
           failures."* Pointing it at the apex would fail **every** delivery, silently, with no
           app-side error to see.
        2. **`STRIPE_WEBHOOK_SECRET` is not set in Vercel at all** — not Production *and not
           Preview* (verified by reading the live env-var list; only 11 vars exist and it isn't
           among them). Webhook contract testing has only ever run locally via `stripe listen`,
           which is why this went unnoticed. Preview deployments therefore cannot verify a
           Stripe signature today.
        Creating the live endpoint is deliberately **deferred to merge** rather than done now:
        `main` has no Stripe code, so that URL currently 307s to `/login`, which means a
        Stripe test-send would fail and the endpoint could not be verified. Do it as ONE atomic
        step — create endpoint (13 events) → copy signing secret into Vercel **Production** →
        redeploy → send a test event → confirm 200.
      - **Secret record:** `SECRETS.local.md` at the repo root — gitignored by name *and* by a
        `*.local.md` pattern, verified with `git check-ignore`. Documents every key, what it does
        in plain English, and which Vercel environments it belongs in. `.env.example` points at it.
      - [x] **VISUAL browser pass — DONE 2026-07-27 (`cc501c6`).** The owner's standing rule:
        code gates prove logic, not that a page *looks* right, so a self-driven browser pass
        with screenshots now precedes any live check. **Nine defects, every one of which had
        passed typecheck, lint, both guards, pytest 86 and Playwright 83** — because all nine
        were wording, an affordance, or a whitespace rule.
        - `/pricing` **ignored `?reason=` entirely** — `requireEntitled()` had always sent it and
          the page never read `searchParams`, so every locked-out customer saw the same generic
          shop-window. Now an allow-listed banner, **signed-in only**.
        - The pricing **headline was hard-coded to the trial pitch** — offering a free week both
          to a past-due customer (directly under a banner saying they don't need a new plan) and
          to someone the Step 7 tombstone bills on day one. Headline, closing bullet and CTA now
          vary by reader.
        - Free "Download Report" reported a **402 as a transient fault** ("try again in a
          moment") — telling a prospective subscriber the app is broken.
        - `PremiumLockCard` had **no `id`**, so the subnav's Scorecard pill was a silently dead
          click for exactly the viewers being sold to.
        - A bare **"Buy" chip** sat where our rating badge had been, attribution in a hover
          `title` only → reads as *our* call (CLAUDE.md #2). Now visibly "Analysts: Buy".
        - **Owner-caught:** signup said *"No card required. Start a 7-day free trial"*, which
          parses as "the trial needs no card" — the opposite of decision #19. Same false promise
          in the refer-a-friend card **and email**, and the signup `<title>` still read "Start
          Free Trial".
        - `"You've opened 25different stocks"` — JSX trims the leading space off a text segment
          following an interpolation.
        - Verified with screenshots: free vs entitled Stock Detail A/B, **no premium key and no
          `NN/100` anywhere in free HTML**, the fence at the cap, `/api/cycle` 401, every denial
          banner. **Not** verifiable locally and still open: geo currency, real Checkout,
          CDN cache behaviour.
          *(Correction, 2026-07-28: this line previously also claimed true 375px was not
          verifiable because "the browser pane clamps to 566px". That was wrong — the pane
          reports a true `innerWidth: 375`. See the Layer H entry for what the measurement
          actually found.)*
      - [x] **Locks explain themselves in place — DONE 2026-07-27 (`cf61908`, `03d5161`).**
        Owner feedback. Every lock now opens `UpgradeDialog` (Methodology-modal shell, blurred
        backdrop) instead of navigating to `/pricing`, so the reader keeps the stock they were
        deciding about; each of the seven surfaces explains **what that feature is**, then hands
        off to `StartTrialModal` — the same in-app checkout entry `/account` uses, which is what
        keeps every subscription rule in one place. New `GET /api/billing-context` labels the CTA
        only and is explicitly not authoritative. Also: sidebar Account row and header Run
        Analysis button removed (each duplicated a nav row); the signed-out trial CTA now carries
        the chosen plan through signup and the confirmation email (`?next=/pricing?start=…`,
        working for email/password **and** both Google paths) instead of dead-ending; onboarding
        acknowledgement no longer squeezed into three lines.
        **Edge cases re-verified after the rewiring:** one dialog at a time (no stacking), scroll
        lock and `pointer-events` restored on close, no orphaned `data-aria-hidden`, tombstoned
        email → "Subscribe … charged today, no free week", `billing_blocked` subscriber →
        "Manage your plan" and **no trial offered**, `/api/billing-context` 307s a signed-out
        caller.
      - [x] **Onboarding made a real gate — DONE 2026-07-27 (`c4264fd`).** Fixes a React
        hydration warning on first login that was **not** a regression of the Layer C portal fix
        (`74a17ab`) — different component, different cause. Radix writes `aria-hidden` onto
        sibling DOM nodes when a modal opens; App Router hydrates progressively, so the write hit
        the 862-stock Browse subtree mid-hydration and React discarded and re-rendered it — a
        real production cost, not just dev noise. Upstream
        [radix-ui/primitives#1386](https://github.com/radix-ui/primitives/issues/1386), still
        open; `dynamic(ssr:false)`, `useSyncExternalStore`, `requestAnimationFrame` and upgrading
        `@radix-ui/react-dialog` 1.1.15 → **1.1.23** all failed. Fix: when the disclaimer is
        unacknowledged the layout returns the modal **alone** and never renders the page behind
        it — nothing to race, and first login stops paying for a universe fetch plus a 120-row
        client component nobody sees. Verified in a clean tab: modal shows, console clean,
        acknowledging still lands on Browse. See architecture §7.3.
      - **Known non-issue:** `pytest` prints one `DeprecationWarning` about the `gotrue` package.
        It originates inside the installed `supabase` library (`supabase/_async/auth_client.py`
        does `from gotrue import …`); our code never imports it. The local env has supabase 2.7.4
        while `web/requirements.txt` pins `supabase>=2.4.0`, so CI and Vercel resolve a current
        release that has already migrated to `supabase_auth`. No action. (Open, minor: that pin
        is open-ended, so a future 2.x could reach production unreviewed.)
      - [x] **OWNER-DRIVEN LIVE CHECK on the deployed preview — 2026-07-28 (`ea84d01`).**
        Run against the `feat/f3-stripe` preview with a throwaway account signed in via an
        admin-generated one-time token aimed at the preview's own `/auth/confirm` (no password
        typed, no dependence on `NEXT_PUBLIC_SITE_URL`, which points at production and would
        otherwise bounce a preview sign-in). Billing states driven by flipping columns directly.
        - **Baseline captured first:** production `/api/cycle` today answers an anonymous,
          session-less, secret-less `curl` with **HTTP 200, `Cache-Control: public`, and the
          complete paid payload** (`overall_rating 60`, `financial_health_score 81.0`). That is
          §2.2 + B1 reproduced in the wild. Merging Step 10 strictly *reduces* exposure.
        - **M4 is narrower than recorded.** The audit said neither local dev nor a preview
          exercises the new HTTP gate, because `baseUrl()` sends SSR to production. True for the
          SSR path — but calling `/api/cycle` **directly from the preview page** reaches the
          preview's own function. It returned **401 `{"error":"unauthorized"}`** from a fully
          authenticated browser with no internal secret. So B2's edge gate IS verifiable before
          merge, and it works.
        - **Passed:** `/api/analyze` → 402; `/run` + `/results` → `/pricing?reason=…`;
          `billing_blocked` overriding an `active` subscription (locked, correct banner, Contact
          support link); a subscriber rendering the full page (rating, verdict, radar, report,
          no upsell); the free-view fence at 25 with the "already-seen stocks still open"
          promise verified true rather than assumed; `UpgradeDialog` explaining each feature in
          place; the nav rework (locks, no sidebar Account, no header Run Analysis).
        - **Found + fixed (`ea84d01`):** the four premium surfaces were not equally defended —
          Verdict and Scorecard require `!entitled` **and** the type guard, while the Overall
          Rating tile, Health Score tile and header chips required only the type guard, trusting
          the API strip as their single control. Now all four require both. Surfaced *because*
          of M4: fed unstripped production data, the preview rendered 60/100 and 81/100 to a
          free viewer.
        - **Found + fixed (`686fdd9`):** the middleware's own refusals carried
          `Cache-Control: public, max-age=0, must-revalidate` (NextResponse.json's default) —
          the 401 on `/api/cycle` and, worse, the 402 on `/api/analyze`, whose body names the
          caller's denial reason from their billing columns. Not exploitable (`max-age=0` +
          `must-revalidate` stop reuse), but `public` on a viewer-dependent response is the
          directive that made B1 an authorisation bypass, and it left both refusals safe only
          because of a modifier a later edit could delete. Both now send `private, no-store`.
          Guard check 9 added and **mutation-tested**. Verified on the deployed preview:
          401 → `private, no-store`, 402 → `private, no-store`.
        - **Found + fixed (`10d8ff6`) — the sharpest finding of the session.** `ea84d01` stopped
          an unentitled viewer *seeing* the scores; it did not stop them being *sent*. The cycle
          object reaches client components, so React serialises it into the RSC payload embedded
          in the HTML — the page showed "🔒 Unlock" while the source carried
          `"overallRating":60,"overallLabel":"Neutral","financialHealthScore":81`. The M4 artifact
          again (preview → production's ungated endpoint), so not shipping, but it proved
          `api/cycle.py`'s strip was the **only** control on the payload: a regression there
          would leave the UI looking locked while quietly shipping the data — the failure mode
          that looks safe. `fetchCycleAnalysis` now strips premium keys on the way in at both
          parse seams whenever `entitled` is false. Side benefit: previews stop being silently
          more permissive than production, which is what let this hide in the first place.
        - **Not a defect:** `?reason=no_subscription` deliberately renders no banner (a
          first-time free user shouldn't be scolded); every other reason does. The silent case
          only occurs on direct navigation — the sidebar path opens the dialog.
        - **Geo currency — verified.** Saved country and edge header made to disagree so the
          result is discriminating: profile `country='US'` → **US$15/USD** (the saved country
          wins, which is the billing-currency lock); `country=null` → **A$19/AUD** read from
          `x-vercel-ip-country`. Without the header it would have fallen back to USD, so this
          is the edge geo path, not a default.
        - **Still open after this session:** real Stripe Checkout/Portal in sandbox, and the
          at-merge items.
        - **Tooling note (superseded for Stripe):** use the stable branch alias
          `majorcycle-git-feat-f3-stripe-…vercel.app`, not per-deployment URLs — it follows the
          latest build, so a session survives each redeploy (cookies are per-host, so a new
          deployment URL means signing in again). Preview deployment protection is bypassed for
          non-browser clients with the Vercel MCP's shareable `_vercel_share` link.
      - [x] **SANDBOX CHECKOUT + PORTAL, END TO END — 2026-07-28 (`f8374d0`, `09f1885`,
        `7ff5abe`).** Run on **localhost**, not the preview, and deliberately so: the paying
        half of the loop is the webhook, and a preview cannot receive one — `STRIPE_WEBHOOK_SECRET`
        exists in no Vercel environment, and preview SSO would bounce Stripe's POST before it
        reached the function. `pnpm stripe:listen` forwards real sandbox events with a matching
        secret, which is the only place the full chain runs today. Sandbox account
        `acct_1TrdbF…` (≠ LIVE `acct_1Trdax…`); the forwarder and every harness script refuse a
        live key outright.
        - **The whole loop, verified in order:** free viewer → both scores locked and **zero
          premium keys in 3.29 MB of HTML** → lock opens `UpgradeDialog` → `StartTrialModal` at
          **A$19 AUD** (profile country AU) → real Stripe Checkout, sandbox-badged, *"7 days
          free, then A$19.00 per month starting August 4, 2026"* → card `4242` → **11 webhooks,
          all 200** → `subscription_status='trialing'`, `plan=monthly`, `currency=aud`,
          `trial_ends_at=2026-08-04`, **tombstone written with `email_hash = sha256(email)`** →
          Account shows "TRIAL ACTIVE · runs until August 4, 2026" → sidebar locks gone, `/run`
          open, scores render, **premium keys now present**. Free/entitled symmetry is the proof
          the strip is entitlement-driven and not incidental.
        - **Portal:** opened on `billing.stripe.com` with the trial badge, A$19/month, the 4242
          card. Cancelling set `cancel_at_period_end=true` while status **stayed `trialing`** —
          access is preserved to the end of the paid period, never revoked early — and the card
          switched to *"ends August 4, 2026 and won't renew."* Confirmed still entitled after.
        - **Found + fixed (`f8374d0`) — `UpgradeDialog` offered the wrong door while loading.**
          `ctx === null` meant both "billing context in flight" and "the fetch failed", and both
          rendered a live `<Link href="/pricing">See plans</Link>`. Every reader who opened a lock
          got a real, clickable escape hatch out of the in-place dialog for as long as the request
          took. Loading is now an inert disabled button; only a genuine failure routes to
          `/pricing`. Proven by stalling the fetch: `disabled: true`, click changes nothing, and
          no `/pricing` link exists in the dialog at any point. **Owner-reported.**
        - **Found + fixed (`7ff5abe`) — the analyst chip lost its attribution when entitled.**
          The "Analysts:" prefix was conditional on our own label being *absent*, so a subscriber
          saw "Neutral · Stretched · **Buy**" — a bare Wall Street verb sitting in a row of our
          own judgements, which is exactly what CLAUDE.md #2 forbids. Colour and a `title` were
          carrying the distinction alone, and a tooltip is invisible on touch. Now unconditional.
          **Only a subscriber ever saw this**, which is why the free-tier visual pass on
          2026-07-27 could not have caught it — a standing lesson for paywalled UI: every
          conditional branch needs a viewer who actually lands on it.
        - **Found + fixed (`09f1885`) — three account-surface issues, all owner-reported.** The
          subscription status pill is a flex child, so on a narrow column it shrank and wrapped
          its own label to two lines *inside* the rounded border; it now refuses to shrink and the
          row top-aligns. Sidebar licence status uppercased (in CSS, not in `LICENCE_LABELS`, so
          the strings stay prose for screen readers). Refer-a-friend dropped "— they can create a
          free account, no card needed": a free account is what every visitor already gets, so
          framing it as part of an invite reads as an offer when it is not. The referral **email**
          keeps the line deliberately — it goes to someone who has never heard of MajorCycle.
        - **Gates after:** typecheck, lint, entitlement guard (9), report sections (22),
          **Playwright 83/83**. Sandbox reset to 0 customers / 0 live subscriptions; DB reset to
          0 tombstones / 0 `stripe_events` / no subscribed profile.
        - **Noted, no action:** Stripe Checkout now renders an **"I am an AI agent acting on
          behalf of someone else"** disclosure control. It is genuine Stripe UI (agentic
          commerce), not injected content, and it appears on the live checkout too.
        - **Gotcha — self-inflicted, worth recording.** Ad-hoc scratchpad scripts hit
          `UND_ERR_CONNECT_TIMEOUT` against `api.stripe.com` and Supabase. This *is* the known AAAA
          stall, and the repo already fixes it: `web/scripts/prefer-ipv4.mjs` (`preferIPv4()`,
          `family: 4`) is wired into `instrumentation.ts`, `stripe-listen.mjs` and
          `playwright.config.ts` — which is why `pnpm stripe:listen` worked all session while the
          throwaway scripts beside it did not. **One-off tooling must import `preferIPv4()` too.**
          Note the AAAA *query* stalls even when there is no AAAA record to return, so "the host is
          IPv4-only" does not rule this out — and `--dns-result-order=ipv4first` still doesn't help,
          because it reorders results *after* resolution.
      - [x] **DISPUTE LIFECYCLE, END TO END — 2026-07-28 (`aabc865`).** Owner asked whether the
        dispute path had ever been checked *against the paywall*. It had not, and the reason is
        a timing trap: disputes were live-checked on **2026-07-24**, at Step 8, when the paywall
        did not yet exist (Step 10 landed on the 26th). So "dispute → `billing_blocked`" was
        proven, and "`billing_blocked` → locked" was proven separately by e2e and the preview
        check — but **always by setting the column directly**. No run had ever crossed the seam,
        which is where `resolveUserIdFromDispute` lives: a dispute carries a charge id, not a
        customer, so the webhook does its one live Stripe retrieve there **and swallows failure**.
        If that retrieve breaks, both halves still pass their own tests and the chargebacker keeps
        full access.
        - **Seam proven.** A real `pm_card_createDispute` charge fired `dispute.created` +
          `funds_withdrawn` → attributed to the right profile → `billing_blocked=true` with
          `subscription_status` untouched at `active` → the page lost both scores, **premium keys
          left the wire entirely**, `/api/analyze` answered **402 `billing_blocked`** (not
          "no_subscription" — a chargeback must not be reported as "update your card"), and
          `/run`, `/results` and the report all redirected to `/pricing?reason=billing_blocked`.
          Stripe test mode then auto-resolved the dispute ~2 min later, which incidentally proved
          the other half live: `funds_reinstated` + `closed(won)` → access restored.
        - **🔴 The money bug.** Losing a chargeback cancels the subscription, so a lost dispute
          lands on **`canceled` + `billing_blocked`** — and `canceled` is precisely the status
          allowed to re-subscribe. `/api/checkout` never checked `billing_blocked`, so the blocked
          user could **pay again and still be denied**, because the block outranks any status.
          Money taken for access we then refuse. Checkout now **403s** a held account.
        - **🟡 The honesty bugs.** `billing_blocked` is orthogonal to `subscription_status` (a
          disputed account keeps its Stripe status), and both status displays read the status
          alone: the sidebar badge announced **ACTIVE**, and the account card said **"ACTIVE —
          You're on the Monthly plan"**, to someone locked out of everything, with no mention of
          a hold anywhere. Both now read **"On hold"** with the reason; the card's action becomes
          support rather than a plan button.
        - **UX, owner-directed.** A lock now explains the hold instead of pitching a subscription
          (an upsell there is an offer checkout refuses). Support opens **in place** as a dialog
          — same treatment as the upgrade dialog, reusing the same form and server action,
          prefilled — rather than throwing a signed-in reader onto public `/contact`.
        - **Flash fixed.** Billing context is fetched **once per page at mount** and shared by
          every lock, not per dialog-open. Fetching on open meant the answer landed after the
          dialog was already on screen, so a held reader saw the upsell for a beat before it
          corrected itself. Same failure as the `See plans` flash: a placeholder that *asserts*
          something about the reader.
        - **Also verified this pass:** Supabase advisors re-run — 9 INFO `rls_enabled_no_policy`,
          identical to the M1 baseline, all service-role-only tables where deny-by-default is
          intended. **Playwright 88** (3 new dispute tests). Sandbox + DB reset to baseline.
        - **Flake noted:** a first full run had 2 failures that did not reproduce (a webhook route
          answering 404, a free-tier redirect) — first-hit route compilation under `next dev`,
          not a regression. Worth watching if it recurs in CI.
      - [x] **PAYWALL UX REWORK — signed-in users never leave the app (2026-07-29, `ba3a6f2`).**
        Owner challenge: *"why do you always create a public page for all this? everything is
        happening for the logged-in user."* They were right, and the audit found it was worse
        than the original complaint.
        - **What was wrong.** `/run`, `/results` and the report `redirect()`ed an unentitled
          viewer to the public `/pricing` page — sidebar, header and account menu gone, landing
          on a page that reads as signed-out. A dispute-held reader was then sent *onward* to
          `/contact` to retype a name and email we already hold. That second jump was a defect I
          had introduced two commits earlier while fixing the P2 pricing hole.
        - **Fix.** `requireEntitled()` → **`requirePremiumPage()`**, which REPORTS entitlement
          instead of redirecting on it; each page returns the new `PremiumLockPage` in place.
          Still redirects signed-out→`/login` and mid-deletion→`/reactivate`. Because the gate
          no longer enforces, **the page's early return IS the enforcement** — it sits before any
          premium fetch, and `check:entitlement-gates` now asserts *both* halves.
        - **`/pricing` is signed-out-only.** A signed-in visitor redirects to `/account`. That
          let the page drop six branches (`?reason=`, `billing_blocked`, `hasSubscription`,
          `trialUsed`, `?start=`, the support dialog) that no reachable reader could hit any
          more. Owner also rejected an interim plan-preselect + "pick up where you left off"
          banner as over-complex — **nothing is carried across; `/account` says the right thing
          on its own.** Four other exits to `/pricing` repointed (mid-run alert, daily-fence
          notice, UpgradeDialog fallback, Stripe `cancel_url`).
        - **Report preview page DELETED.** Nothing had ever linked to it — Download Report builds
          the file client-side from `/report/data` + the offline bundle — yet it rendered the full
          scorecard server-side and had to be gated, cached and kept in step with `ReportDocument`
          forever. `ReportDocument`, `report-data.ts` and the `.report-page`/`.report-doc` CSS all
          STAY: the CSS is the downloaded file's `<body>` class, not dead.
        - 🔴 **REAL BUG found by the e2e written to replace that page's coverage:**
          `/report/data` sent **no `Cache-Control` at all**, on any branch, on a full-scorecard
          payload. Its safety rested on Vercel happening not to cache an uncacheable-*looking*
          response. Now `private, no-store` everywhere + guarded. Second occurrence of the
          CLAUDE.md 11a class; the rule was updated to say the missing header is itself the bug.
        - **Verified:** 33/33 entitlement e2e, typecheck, lint, build, both static guards, plus
          browser checks of free / dispute-held / active on `/run` and `/results`.
      - [x] **CHECKOUT→WEBHOOK RACE CLOSED (2026-07-29, `b2d2343`).** Found while grounding the
        live-check plan in the Stripe docs, *before* it could bite in production.
        - **The gap.** Stripe sends `checkout.session.completed` BEFORE redirecting and holds the
          redirect for our 2xx — **but only 10 seconds**, then redirects regardless. Our
          `success_url` carried no session id and `/account` ignored `?checkout` entirely, so a
          slow/failed/misconfigured webhook put someone who had just paid on a page reading
          **"No plan"**, beside a button inviting them to subscribe again.
        - **Fix (Stripe's documented belt-and-braces).** Webhook stays the guarantee (runs even
          if they close the tab; retried 3 days). `success_url` now carries
          `{CHECKOUT_SESSION_ID}` and `/account` runs `reconcileCheckoutSession()` before it reads
          the profile. `/account` also finally *says* something: "Payment received", or after
          cancelling, "You haven't been charged."
        - **Not a second source of truth.** It re-retrieves the subscription from Stripe and runs
          the SAME `syncSubscription()` the webhook runs — which is why that function + helpers
          moved to `web/lib/billing/sync.ts` instead of being copied. Two derivations of "who has
          paid" would drift. The webhook contract tests (**21/21**) are what proved the extraction
          was behaviour-preserving.
        - **Security.** `session_id` comes from the URL bar, so it is never proof: the session is
          fetched from Stripe and refused unless its own `client_reference_id` matches the caller.
          Two e2e cases assert a forged id grants nothing and still renders. Re-retrieving the
          subscription (not the session's embedded copy) also stops a stale session overwriting
          newer state. Note `payment_status` is `no_payment_required` for a 7-day trial — treating
          that as unpaid would refuse exactly the flow we sell.
        - **Verified:** entitlement e2e 35/35, webhook 21/21, typecheck, lint, guards.
          ⚠ **The happy path is NOT yet proven live** — that is a next-session check, deliberately
          run with the webhook forwarder OFF so only the reconciler can provision.
      - [x] **LIVE-CHECK SESSION 1 — static + identity surfaces (2026-07-30, `66c46f2` + `2f4f98b`).**
        First of the multi-session Layer F live-check plan (`~/.claude/plans/lovely-napping-neumann.md`).
        Gates first: typecheck, lint, build, both guards, **pytest 86**, **Playwright 95 → 99**.
        - **Passed:** all 7 public pages 200 with the disclaimer, every gated route 307 → `/login`
          with `next` preserved; `/pricing` signed-out is a plain shop window (**US$126/yr is
          exactly 30% off** $180) and signed-in redirects to `/account`; `/login` + `/signup`
          redirect to `/stocks`; recovery confinement holds and self-heals on fresh login;
          deletion-scheduled sends **both** `/account` and `/run` to `/reactivate` (deletion
          outranks billing); contact honeypot accepts silently with **zero** emails sent while a
          real submission is **delivered** with `reply_to` set to the sender; self-referral blocked.
        - 🔴 **TWO DEFECTS FOUND + FIXED (`66c46f2`)** — both the same shape as the dispute-hold
          bug: *a surface reading one dimension when the truth needs two.*
          1. **A lapsed `past_due` account was told its access was intact.** The status is identical
             either side of the 3-day grace window while the access is opposite, but `/account`
             never selected `grace_until` — so a reader whose grace had closed got "update your
             card to **keep access**". The sidebar said PAYMENT DUE in both states too, while the
             lock icons beside it (same `entitled` it already had) said otherwise. Both now split
             on entitlement via the shared `hasAccess`; lapsed reads **"Access paused"**.
          2. **"Payment received — your plan is set up below" printed above "No plan".** The banner
             came from the URL param before reconciliation ran, and `reconcileCheckoutSession`'s
             return value was **discarded** — so it made that claim in precisely the slow-webhook
             case the reconciler exists for. Now chosen after the fact, with an honest
             "still setting your plan up" when nothing is provisioned yet.
          Neither was a security hole (the paywall locked all these readers correctly) — both were
          honesty bugs on the paid surface. **4 new e2e cases assert BOTH halves of each fix**, so
          an over-correction fails too.
        - **Paywall re-verified live after the fixes:** free Stock Detail = **3.16 MB of HTML with
          zero premium keys and zero `NN/100`**, free data intact; an `active` viewer gets all four
          premium keys and the scores render (59/100, 81/100) — proving the strip is
          entitlement-driven, not blanket. `/run` locked in-place for free and for lapsed
          `past_due`, open for `active`. `/api/analyze-dev` **402 `payment_failed`**, `/api/cycle`
          without the secret **401**, `/report/data` **402** — all `private, no-store`.
        - **Stripe dashboard read (live + sandbox, identical)** — see data-contracts for the
          durable record: failed-payment terminal state is **`cancel the subscription`** (so
          `canceled`, never `unpaid` — our rule already denies both), and **all five Stripe
          customer emails are OFF**, which is what makes our branded Resend senders the single
          voice. Owner decision 2026-07-30: leave the one-time "trial over" statement-descriptor
          message **off** — the descriptor already names the site.
        - **Still open from Session 1:** nothing. Sessions 2–5 (paywall/wire-level, billing
          lifecycle on a test clock, fix sweep, merge day) remain.
      - [x] **LIVE-CHECK SESSION 2 — the paywall at the wire (2026-07-30).**
        Gates first: typecheck, lint, build, both guards, **pytest 86**, **Playwright 99**.
        Every Layer F app surface driven across **all twelve viewer states**, asserting on the
        raw body and the response headers rather than on what renders.
        - **The paywall holds, and it is entitlement-driven rather than blanket.** Free Stock
          Detail = **3.16 MB of HTML, zero premium keys, zero `NN/100`**; an entitled viewer at
          the same URL gets **7** score readings and `/report/data` returns all **nine** premium
          keys. The same probe proves both, so "safe" cannot be an artifact of the data simply
          being absent.
        - **Denied states are refused honestly and in place.** `/run` and `/results` return the
          locked panel **at the same URL inside the app shell**, each carrying the caller's own
          reason — lapsed `past_due` → "We couldn't take your last payment", `canceled` → "Your
          subscription has ended", `billing_blocked` → "Your account is on hold" — and a
          first-time free reader correctly gets **no** warning banner at all. `/api/analyze-dev`
          and `/report/data` both 402 with the matching `reason` in the body
          (`no_subscription` / `payment_failed` / `canceled` / `billing_blocked`), all
          `private, no-store`.
        - **Signed out, every gated surface 307s to `/login`** with `next` preserved — pages,
          route handlers and both POST endpoints alike. `/api/cycle`: **401** for anonymous and
          **401** for a wrong secret (both `private, no-store`), while the correct secret passes
          the proxy gate. `/api/stripe/webhook` unsigned → **400**, the merge-day liveness probe.
        - **Also confirmed:** the free 25-ticker fence stops a **new** stock while still serving
          an **already-seen** one; `/api/portal` gives all three outcomes (`?billing=none`,
          `?billing=blocked`, `?billing=error`); `/api/checkout` 409s a double-subscribe and
          403s a held account; `/request` stays free for everyone; bad market/ticker on
          `/report/data` → **404 `private, no-store`** (refusals carry the header too);
          deletion-scheduled really is confined to `/reactivate`; the onboarding modal blocks
          the page for an unacknowledged reader; and a **free** viewer keeps the drawdown
          overlay **with its cycle bands** plus all 22 sections.
        - 🟡 **Three findings, none a leak — all deferred to the Session 4 fix sweep.**
          1. **`api/analyze.py` is the one premium route with no header guard.** It sends
             `Cache-Control: no-store` on every branch, which Vercel honours, but the house rule
             (11a) is `private, no-store` and `check:entitlement-gates` asserts that for
             `api/cycle.py`, `proxy.ts` and `/report/data` — not for the route returning the
             full screener payload. Align the header and add a 10th static check.
          2. **Nothing rejects a *second* completed Checkout Session.** Three concurrent POSTs
             each returned a distinct session; the 409 guard runs at session *creation*, while
             `customer.subscription.created` overwrites `stripe_subscription_id` unconditionally
             at *completion*. Abandon-then-retry-then-complete-both would leave two live Stripe
             subscriptions billing with only the second on file, and decision #21 means no
             refund. **Not yet reproduced end to end** — confirm in Session 3, which already owns
             the checkout race.
          3. **`pnpm build` and the dev/e2e servers share `web/.next`.** A stale production build
             makes real routes return HTML 404s; it cost time in Session 1 and again here, where
             it made a *paywalled* route look like a broken gate. A false security signal during
             the checks meant to find real ones deserves more than the anti-pattern note it has:
             give the dev/e2e server its own `distDir`.
        - **A "200" is not proof the guard failed.** `/run` and `/stocks` returned 200 for a
          deletion-scheduled account, which reads as confinement broken — but the bodies carry
          `NEXT_REDIRECT` to `/reactivate`: Next emits a server-component `redirect()` inside a
          streaming 200 once the shell has flushed. Check the body for the marker, not the status.
        - **Two probe markers were worthless and nearly produced false findings** — "reactivate"
          and "Run Analysis" both appear in every page's nav, and the onboarding modal is
          client-rendered so it is absent from the SSR HTML entirely. Grep for copy unique to the
          state, and confirm anything client-rendered in a real browser.
      - [x] **SESSION 2 FIX SWEEP — all three findings closed (2026-07-30).** Brought forward
        from Session 4 at the owner's request; each fix is proven, not merely written.
        - **A — `api/analyze.py` now sends `private, no-store`** on every branch, matching
          `cycle.py`, plus a **10th static check** in `check:entitlement-gates` asserting both the
          header and the absence of `s-maxage`/`stale-while-revalidate`. The guard was verified to
          actually fail: weakening the header to bare `no-store` and, separately, injecting
          `s-maxage=60` each turned CI red, then the file was restored. `/api/analyze-dev` got the
          same header on all four branches — a dev stand-in that answers differently from
          production is a test that lies, and its silence is why the local checks could never have
          caught this.
        - **B — a second completed Checkout Session is now refused.** `rejectDuplicateSubscription`
          in `lib/billing/sync.ts` runs inside `syncSubscription`, so it covers **both** writers
          (the webhook and the checkout landing page's reconciler). If a *different* subscription is
          already on file, it **retrieves that one from Stripe** before judging — our column can name
          a subscription that is already dead, because event order isn't guaranteed, and cancelling a
          real plan in error would be far worse than the duplicate. Live states are
          `active`/`trialing`/`past_due`/`unpaid`; **`incomplete` is excluded** so a retry after a
          declined card is never mistaken for a duplicate. On a confirmed duplicate the **incoming**
          subscription is cancelled (the incumbent owns the billing anchor and consumed any trial)
          and the profile is left untouched. If the retrieve fails, it falls through and writes
          normally — never cancel on a guess.
          **Proven in the Stripe sandbox with two REAL subscriptions on one customer:** the duplicate
          came back `canceled` while the profile stayed on the first; and with the incumbent genuinely
          cancelled, a re-subscribe was still accepted and recorded. A committed e2e pins the
          fail-safe half (synthetic ids ⇒ unverifiable incumbent ⇒ must fall through, never cancel).
          **Cancelling does not refund** — a duplicate caught while `trialing` was never charged, but
          a charged one needs a manual refund, so the guard logs both ids loudly. Worth an alerting
          path once Sentry lands in Layer H.
        - **C — dev and build no longer share `web/.next`.** `next.config.ts` sets
          `distDir = '.next-dev'` under `NODE_ENV=development`; `next dev` and `next build` set that
          themselves, so nothing has to be passed or remembered. Verified: a production build sits in
          `.next` with its `BUILD_ID` intact while the dev server runs from `.next-dev`. Needed
          `.next-dev/**` added to the eslint ignores and both `.gitignore`s.
        - **Owner-requested rename: `/report/data` → `/report`.** The `data` segment only ever existed
          to sit beside an on-screen `/report` preview page, deleted 2026-07-29 when nothing was found
          linking to it — so the suffix named a distinction that no longer existed. Verified signed-in:
          `/report` → **402 `no_subscription`** free / **200, 3.2 MB, `private, no-store`** subscribed,
          and the old path is cleanly **404**. Callers, the CI guard path, the e2e constant and every
          doc updated. **Trade-off accepted:** Next.js forbids a `page.tsx` and a `route.ts` in one
          segment, so this forecloses ever re-adding a `/report` page — intended, as the download is
          now the report's only form.
      - **Deferred:** SEO/public pages; the arrays-instead-of-objects RPC encoding; Supabase Auth
        percentage-based connections; revoking `anon`'s table-level UPDATE on `profiles`;
        **375px mobile — pre-existing, already triaged to Layer H, now measured there.**
      - No merge to `main` until the owner-driven live guided check passes and the owner approves.

**F1 — Public methodology + contact, CI e2e, Google One Tap polish (shipped 2026-07-07).**
- [x] `/methodology` — public, pre-sign-up plain-English explainer (cycle position, financial
      health, valuation, overall rating + the five compliant tiers, **no formulas**); disclaimer
      above the fold; CTA into the trial. `web/app/(public)/methodology/page.tsx`.
- [x] `/contact` — form → Resend via a server action (`useActionState`); honeypot, input
      validation, `reply-to` = sender; **brand-styled HTML email** (navy header + signature,
      user input HTML-escaped); fails safe to an "email `support@`" fallback when the key is
      absent. `web/app/(public)/contact/{page,ContactForm,actions}.tsx`.
- [x] **Support email:** all public pages point to `support@majorcycle.com` (contact, terms,
      disclaimer, privacy, methodology). `support@` set up as a second Cloudflare Email-Routing
      inbox + Gmail "Send mail as" (Resend SMTP) with its own branded signature + a
      `MajorCycle/Support` label filter — verified live via the Resend + Gmail MCPs.
- [x] **Contact form live:** `RESEND_API_KEY` added to the Vercel project env (+ redeploy); the
      form now sends and the fallback disappears. (`RESEND_FROM_EMAIL` was already present; a
      Resend key is domain-scoped, so the same key serves every `@majorcycle.com` sender.)
- [x] **CI Auth E2E enabled** — repo Variables `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + Secrets
      `E2E_EMAIL/E2E_PASSWORD` set, so the Playwright job runs (was skipping). Suite is now 20
      tests incl. the logged-in flow (dedicated email/password test account).
- [x] **e2e robustness** (`web/e2e/auth.spec.ts`) — wait for the async-mounted onboarding modal,
      poll the idempotent ack-checkbox through hydration, and keyboard-activate Sign out (the
      Next.js dev-overlay portal intercepts pointer events at that corner in dev).
- [x] **Sign-out a11y** — `aria-hidden` on the decorative `LogOut` icon so the button exposes a
      proper accessible name (`web/components/SignOutButton.tsx`).
- [x] **Google One Tap + clean console** — `GoogleSignIn.tsx` initialises GIS exactly once
      (latest handler/label held in refs → no re-init `AbortError` churn), keeps One Tap
      (`api.prompt()`), and installs a narrowly-scoped filter that drops **only** the benign
      `[GSI_LOGGER] … FedCM get() rejects` lines (emitted when there's no eligible Google
      session) while forwarding every other `console.error`. CSP already allows the FedCM
      endpoints (`connect-src`/`frame-src` include `accounts.google.com`).

**F1 email-branding follow-ups.**
- [x] **Unify the contact-form email with the transactional brand** (— F1). Extracted a shared
      wrapper `web/lib/email/brandEmail.ts` (slim gradient header `#010F2C→#063A80` + `email-icon.png`
      + Sora wordmark + grey `#f8fafc` disclaimer footer — design-system.md §17); `/contact`
      (`actions.ts`) now renders through it via `renderBrandEmail()`, replacing the old flat `#1A3A6E`
      header. Table + inline-style only (Gmail/Outlook-safe), gradient has a solid `#04163E` fallback.
      Owner reviewed the before/after markup in-chat. Future app-sent emails reuse the same wrapper.
      Tweaks (owner review): dropped the "reply directly…" line; footer is one `©`-prefixed disclaimer
      line. **Sender changed to `support@majorcycle.com`** (was `noreply@`) via `CONTACT_FROM_EMAIL`,
      since these are messages you actually reply to (reply-to stays the submitter). (PRs #69, #70+.)
- [x] **Sender profile image / BIMI — DROPPED (owner decision 2026-07-08).** The "logo next to the
      sender in the recipient's inbox" = BIMI (one domain-wide logo). Not worth it now: **Gmail** needs a
      paid **VMC** (~US$1k+/yr + a registered trademark) to show it (Apple Mail/Yahoo are free), and it
      requires a simplified ≤32KB **SVG Tiny-PS** (the owner's 1.7MB traced `reference/email-logo.svg`
      is too large/complex). Revisit only with a trademark + revenue. **Email-hosting review done:**
      staying on the free Cloudflare Routing + Resend + Gmail send-as stack (Workspace/private hosting
      not worth it pre-revenue). **Resend Return-Path verified aligned** (custom `send.majorcycle.com`
      bounce subdomain + DKIM `d=majorcycle.com`) → no "via resend". DMARC aggregate reports arriving =
      healthy (`p=reject` working).

**F1 sign-in performance.**
- [x] **Cut auth round-trips + fix the Google/One-Tap bounce** (— F1). Middleware (`proxy.ts`) and
      the app layout (`(app)/layout.tsx`) now verify the session with `getClaims()` (local WebCrypto
      + cached JWKS — the project already uses an ES256 asymmetric signing key) instead of `getUser()`,
      which had made an Auth-server round-trip on **every** request (twice per protected page). After
      an id-token / password sign-in the forms now do a hard `window.location.assign(next)` instead of
      `router.push()+refresh()`, so the freshly-set cookies are sent with the request and middleware
      sees the session first try — eliminating the "goes back to sign-in, waits, then logs in" bounce.
      Added `<link rel="preconnect">` to Google GIS + the Supabase origin on the auth pages to warm the
      TLS handshake. Auth e2e suite 20/20 (incl. login→results→signout→re-gate). Files: `proxy.ts`,
      `(app)/layout.tsx`, `components/GoogleSignIn.tsx`, `(public)/login/LoginForm.tsx`,
      `(public)/layout.tsx`. (PR #69.)
- [x] **iOS One Tap + "Signing you in…" polish** (— F1, PR #70). Added `itp_support:true` to the GIS
      init so One Tap surfaces on Safari/iOS (ITP browsers otherwise suppress it); added a
      "Signing you in…" state (lucide `Loader2`) shown the moment a Google credential arrives (One Tap
      or button) until the redirect, so the token-exchange wait no longer reads as an idle sign-in page.
      **Owner live-verified 2026-07-08:** email + Google sign-in fast, One Tap popup shows for a
      non-cooled-down session, console clean. (A "skipped" One Tap moment on the owner's device was
      Google's post-dismissal cooldown, not a defect — confirmed via the GIS moment API.)

**Verification:**
- Full signup → trial → paid conversion flow tested with Stripe test mode
- Payment failure → grace period → hard lock tested
- All static pages render correctly, content reviewed by owner
- Cancellation flow works without dark patterns

### Layer G: SEO + Performance (target: 3-4 days)

Goal: Lighthouse 90+ on per-ticker pages, all SEO essentials live.

- [ ] Dynamic `/sitemap.ts` — every ticker page included
- [ ] Dynamic `/robots.ts` — public pages allowed, private blocked
- [ ] Per-page metadata (title, description, OG tags) — dynamic per ticker
- [ ] JSON-LD structured data — `Article` + `FinancialProduct` schemas
- [ ] Dynamic OG images via `@vercel/og` per ticker
- [ ] Canonical URL tags
- [ ] Submit sitemap to Google Search Console
- [ ] Image optimisation pass (next/image everywhere)
- [ ] Bundle size audit — remove any unused deps
- [ ] Lighthouse pass — score 90+ on at least 5 sample ticker pages

**Verification:**
- Lighthouse CI runs in `.github/workflows/ci.yml`
- Test URL via Google's Rich Results test
- Test OG images via Twitter/LinkedIn debuggers
- Sitemap accessible at `/sitemap.xml`

### Layer H: Pre-launch Hardening (Phase 1.5, target: 1 week)

- [ ] Mobile responsive audit on every page
  - **Measured 2026-07-28** (F3 Step 10 live check, deployed preview, real 375×812 viewport —
    the long-standing "can't test this locally" note was wrong). Signed-in app shell:
    `scrollWidth 505` vs `clientWidth 375` — **130px of horizontal overflow on every page
    inside `(app)`**, which is CLAUDE.md #3. Root cause is the shell, not any one page:
    `Header` is `fixed … left-[var(--sidebar-w)] right-0` and `Sidebar` never collapses, so
    the sidebar keeps its desktop width (~215px of a 375px screen). Body copy wraps one word
    per line and the Browse table's STOCK / MARKET CAP columns overlap.
  - **Public pages measured clean** at 375px (`/pricing` → `scrollWidth 375`, no overflow), so
    the fix is scoped to the `(app)` layout + `Sidebar` + `Header`, not a site-wide sweep.
  - Likely shape: a `md:` breakpoint that collapses the sidebar behind a hamburger and drops
    the header's left offset below it. Re-measure with the same probe afterwards.
- [ ] Accessibility audit (axe-core)
- [ ] Cross-browser test (Chrome, Safari, Firefox, mobile Safari)
- [ ] Disclaimer copy review (ideally by AU fintech lawyer — owner's decision)
- [ ] Beta with 5-10 friendly testers
- [ ] Fix all P0 / P1 issues from beta
- [ ] Final design review against reference HTML
- [ ] Set up basic error monitoring (Sentry free tier)
  - **Alert on the money paths first.** Layer F ships several conditions that are handled
    correctly in code but only ever announced to a `console.error` nobody reads — the owner
    cannot watch Vercel logs, so today these are silent. Each already logs a distinctive
    message; Sentry's job is to turn them into something that arrives:
    - **`billing sync: DUPLICATE SUBSCRIPTION`** — the highest-value alert. The guard
      (2026-07-30, finding B) cancels the duplicate, but **cancelling does not refund**, so a
      duplicate that was already charged needs a manual Dashboard refund. Nobody currently
      finds out. The log names both subscription ids.
    - **`billing sync: could not verify existing subscription`** — the guard's fail-open path.
      Rare, but it means the duplicate check was skipped for that event.
    - **`stripe webhook: no profile for …`** — a paid event that couldn't be attributed to an
      account, i.e. someone may have paid and not been provisioned.
    - **`portal: could not create billing portal session`** and checkout's `502` branch — a
      customer unable to pay or manage their plan.
    - **`[freeViews] record_free_view failed`** — the anti-scraping fence has stopped counting
      (fails open by design, so the only symptom is a quiet bandwidth bill).
  - Also worth a Sentry breadcrumb: `CYCLE_INTERNAL_SECRET` mismatches render every Stock
    Detail page **200 with empty cycle sections and no error at all** (see `.env.example`),
    which is the one failure mode that would otherwise never surface.

---

## 3. Phase 1 Success Criteria (Launch Gate)

The product is "ready to launch" when ALL of these are true:

### Functionality
- [ ] Every Stock Detail section works with real data for every ticker in S&P 500, ASX 200, S&P/TSX 60. **Don't hard-code the count** — it read "19" here, "14" in CLAUDE.md decision #29 and "22" from `pnpm check:report-sections` on the same day (2026-07-30). The first two are frozen planning-era numbers; the guard reports the live figure and also proves the downloadable report mirrors the page, so **treat `check:report-sections` as the source of truth**
- [ ] All three Run Analysis presets + Custom produce correct results
- [ ] Universe auto-expansion works for arbitrary US/AU/CA tickers
- [ ] Signup → trial → paid flow works end-to-end with real cards
- [ ] Trial-end + payment-failure grace period works
- [ ] Daily cron has run successfully for 7 consecutive days

### Quality
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] Zero Python type errors
- [ ] All tests passing in CI
- [ ] Lighthouse Performance 90+, SEO 100, Accessibility 95+ on 5 sample ticker pages
- [ ] Mobile responsive at 375px width

### Content
- [ ] Methodology page complete and owner-approved
- [ ] Disclaimers visible on every rating-displaying page
- [ ] Terms, Privacy, Disclaimer pages live and reviewed
- [ ] All neutral labels used consistently — zero "BUY"/"SELL"/"AVOID" in our scoring outputs

### Infrastructure
- [ ] All accounts billing configured
- [ ] Domain DNS verified, SSL cert active
- [ ] Index-membership seed present in repo migration (`index_membership` table); universe recoverable from the `stocks` table + nightly ETF refresh
- [ ] Stripe in live mode with real prices
- [ ] Cron monitoring alert tested (force a failure, confirm email received)

---

## 4. Phase 2 — Post-launch Expansion (timing TBD)

Order of priority TBD based on user feedback. Candidate features:

| Feature | Notes |
|---|---|
| **Smart Money Activity UI** | Insider buying/selling timeline, institutional holders table, analyst upgrades/downgrades feed. **Data already collected in Phase 1** (`insider_transactions`, `top_holders`, `analyst_upgrades_downgrades` columns in `stocks`). Phase 2 is UI-only. |
| **Earnings Calendar** | Calendar view of upcoming earnings dates across the universe. **Data already collected in Phase 1** (`next_earnings_date` column in `stocks`, populated by `t.calendar` from yfinance). Phase 2 is UI-only. |
| **Watchlists** | Saved ticker collections per user. Supabase table + UI. |
| **Alerts** | Email when stock enters a tier or crosses a threshold. Daily cron checks + Resend send. |
| **Sector heatmap** | Aggregate view by sector, treemap or grid visualisation. |
| **FMP migration** | Swap yfinance for FMP. Single-file change to `analytics/config.py` once `fmp_provider.py` is implemented. Already stubbed and ready. |
| **Sector-relative Financial Health** | Score each FH pillar against its sector's peer median (reusing the median plumbing from `web/lib/medians.server.ts`) instead of global thresholds, so banks/REITs aren't penalised by inapplicable cut-offs. Deferred from S3 (where "Option C" — withholding inapplicable pillars — shipped instead). Needs sector medians available to the Python engine + a peer-count floor → fallback for the thin CA universe. See `docs/methodology-audit.md` P2c. |
| **News feed upgrade** | Replace yfinance news with NewsAPI or Polygon for better quality. |
| **Improved earnings data** | Enhanced beat/miss history. **Earnings history already collected** (`earnings_history` JSONB column). Phase 2 is about richer display and data sourcing. |
| **Portfolios** | User-defined portfolios with weighted aggregate scores. |
| **Backtesting** | Simulate what entering at typical drawdown would have returned. |
| **Mobile app (React Native)** | If web product validates. |
| **CI / Actions-minutes budget (if repo goes private)** | Public repo = unlimited GitHub Actions minutes; **private = a monthly allowance** (~2,000 min GitHub Free / ~3,000 Pro), then pay-per-minute. Measured usage (2026-07-13) ≈ **900–1,100 min/month, dominated by the daily-refresh cron** (`daily-refresh.yml`, ~25–35 min/day); CI + e2e jobs are trivial (~1–3 min/run). Under the Free cap today (~2× headroom) but the daily cron **grows as the universe auto-expands**, and each manual full-refresh (`weekly-enriched-refresh.yml`, up to 6 h) eats a big chunk. Steps if it nears the cap: monitor **Settings → Billing → Actions**; then **GitHub Pro (~US$4/mo → 3,000 min)**; then **optimise/shard the daily cron**; then a **self-hosted runner / external scheduler** for the heavy job (Vercel Python's 300 s cap rules it out). Keep the full refresh manual + sparing. *(Repo was made public in Layer A specifically for unlimited minutes for this cron.)* |

---

## 5. Explicit Non-Goals (Don't Build These)

- ❌ Real-time / intraday data — daily close only
- ❌ Trading execution / brokerage integration
- ❌ Crypto, forex, futures, options
- ❌ International markets beyond US/AU/CA in Phase 1
- ❌ Personalised investment advice or robo-advisor features
- ❌ Social features (comments, sharing, following users)
- ❌ Educational courses, video content
- ❌ White-label / B2B / API resale

---

## 6. Build Order Summary (Single Source of Truth)

```
✅ Phase 0: Setup (accounts, repo, naming, MCP)
   ↓
✅ Phase 1 Layer A: Data Pipeline (smart refresh + enriched data)
   ↓
✅ Phase 1 Layer B: Frontend Foundation (auth, design system, layout)
   ↓
🔁 Phase 1 Layer C: Stock Detail Tab    ← NOW (round-2 re-audit reopened)
   ↓
✅ Phase 1 Layer D: Run Analysis Tab     (built + audited + live)
   ↓
✅ Phase 1 Layer E: Results Tab          (built + audited E1–E11 + live)
   ↓
   Phase 1 Layer F: Static Pages + Subscription
   ↓
   Phase 1 Layer G: SEO + Performance
   ↓
   Phase 1 Layer H: Hardening (Phase 1.5)
   ↓
🚀 LAUNCH
   ↓
Phase 2: Smart Money UI + earnings calendar + watchlists + alerts + FMP
```

Layers A and B are complete. Remaining build is C through H.

---

**End of roadmap.md.**
