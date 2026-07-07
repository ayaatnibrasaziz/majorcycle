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
- [ ] `/account` — profile, subscription status, cancel/upgrade
- [ ] Stripe Checkout integration
- [ ] Stripe webhook handler with all subscription events
- [ ] 3-day grace period flow on payment failure
- [ ] Trial-ending email reminders (day 5, day 7)

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
- [ ] **Deliverability / trust polish (BIMI + workflow audit).** The "verified badge + logo" the
      owner sees on Cloudflare mail = **BIMI** (avatar logo) + a **VMC/CMC** paid cert (the blue
      check). Needs: DMARC enforced (already `p=reject` ✅) + `default._bimi.majorcycle.com` TXT →
      an **SVG Tiny-PS** logo; the blue check additionally needs a VMC/CMC from DigiCert/Entrust
      (~US$1k+/yr, requires a registered trademark). Decide BIMI-logo-now vs defer-paid-cert. Also
      audit every outbound touchpoint for gaps: From-name consistency, footer disclaimer, plain-text
      part, `List-Unsubscribe` on any bulk mail, and logo rendering across Gmail/Apple/Outlook.
      (Email-hosting review done: staying on the free Cloudflare Routing + Resend + Gmail send-as
      stack — Workspace/private hosting not worth it pre-revenue for a solo owner.)

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
      `(public)/layout.tsx`.

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
- [ ] Accessibility audit (axe-core)
- [ ] Cross-browser test (Chrome, Safari, Firefox, mobile Safari)
- [ ] Disclaimer copy review (ideally by AU fintech lawyer — owner's decision)
- [ ] Beta with 5-10 friendly testers
- [ ] Fix all P0 / P1 issues from beta
- [ ] Final design review against reference HTML
- [ ] Set up basic error monitoring (Sentry free tier)

---

## 3. Phase 1 Success Criteria (Launch Gate)

The product is "ready to launch" when ALL of these are true:

### Functionality
- [ ] All 19 Stock Detail sections work with real data for every ticker in S&P 500, ASX 200, S&P/TSX 60
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
