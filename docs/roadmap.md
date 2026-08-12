# Roadmap

> **Purpose:** Defines what is in scope for launch, in what order it gets built, how we know it's done, and what's explicitly deferred. Read this before starting any new task. If a task isn't in the current phase, **stop and ask**.
>
> See also: `CLAUDE.md`, `architecture.md`.

---

## 0. Phase Definitions

- **Phase 0** — Setup. Accounts, repo scaffolding, foundational docs. ✅ **COMPLETE**
- **Phase 1** — Launch. Everything currently in `/reference/original-design.html` minus Smart Money Activity, plus auth, payments, static content pages. ⬅️ **YOU ARE HERE — Layers A–F all built, merged, live and audited (C, D, E and now F — `docs/layer-f-audit.md`). Layer G in progress: G1 (SEO plumbing), G2 (design foundations) and G3 (public chrome) built and audited; PR #89 open and deliberately unmerged until the layer is done. The legal pages are NOT yet accepted by the owner.**
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
- [x] Stripe — done in Layer F. Live account `acct_1TrdaxK8OQZXQEmi`, charges + payouts enabled,
      CBA account linked, two multi-currency prices (`majorcycle_monthly` US$15/A$19/C$20,
      `majorcycle_annual` US$126/A$159/C$168). Payouts deliberately left **manual**
- [x] Resend — done in Layer F. Sending on the verified `majorcycle.com` domain (DKIM
      `d=majorcycle.com`, custom `send.` Return-Path, DMARC `p=reject`), and doubling as the SMTP
      credential for Supabase auth email

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
- [x] Set up daily GitHub Actions workflow `.github/workflows/daily-refresh.yml` — smart mode, 60 min timeout. *(Shipped as one 23:00 UTC run; **split 2026-08-04** into AU 08:00 UTC + US+CA 22:30 UTC, because 23:00 UTC is inside the ASX pre-open — see `architecture.md` §8.)*
- [x] Set up manual full-refresh workflow `.github/workflows/weekly-enriched-refresh.yml` — `workflow_dispatch` only, `--mode full`, 360 min timeout
- [x] Add `next_earnings_date DATE` and `enriched_updated_at TIMESTAMPTZ` columns to `stocks` table
- [x] Add cron failure email via Resend
- [x] Write unit tests for cycle math + scoring against known fixtures (28 at the time; the suite
      has since grown to **86** as later layers added contract tests)
- [x] Upgrade all GitHub Actions to v6 (Node.js 24 native, no deprecation warnings)
- [x] Repo made public — unlimited GitHub Actions minutes

**Verification:** ✅ *(re-read from the live DB 2026-08-02 — the original figures were from the
seeding era and had drifted, because the universe auto-expands)*
- **867 rows in `stocks`** — 863 equities across S&P 500 / ASX 200 / S&P/TSX 60 plus 4 price-only
  benchmark indices — with **6,575,807 price bars** and **0 weekend-dated bars** (2026-08-04)
- ⚠️ **The old "latest bar is a Friday, so no weekend gap" line has been removed — it was unsound
  and it actively hid a bug.** It reasoned from a single global `max(date)` across all markets, so
  one healthy US ticker satisfied it while **every ASX bar sat on the wrong date**: 0 Fridays and
  273,700 Sundays, from inception until 2026-08-04. Freshness must be checked **per market**
  (`min(max(date))` grouped by market), never from one global maximum. Worked example on
  2026-08-04: global max was `2026-08-04`, but per market the oldest was **CA at 2026-07-31** —
  correct (the TSX was shut on 3 August for the civic holiday and the US+CA run hadn't fired yet),
  and a check that can *explain* its laggard is worth more than one that only reports a maximum
- `pytest analytics/` — **121 passed** (28 at Layer A; the rest added by later layers)
- `mypy analytics/ --ignore-missing-imports --explicit-package-bases` — no issues
- CI green on `main`
- **Daily refresh has succeeded 10 consecutive days** (2026-07-24 → 2026-08-02), which also
  satisfies the §3 launch-gate row asking for 7

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

### Layer C: Stock Detail Tab ✅ BUILT + AUDITED (round 1 S1–S10 · round 2 C-R1…C-R9) + MERGED + LIVE

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
19. [x] **Synced crosshair** — crosshair on the Price chart mirrors onto the Drawdown overlay (both share the trading-day axis) via Lightweight Charts `subscribeCrosshairMove`/`setCrosshairPosition` with loop guards (`chartSync.ts`). Implemented + non-breaking (no freeze); the Recharts charts use incompatible axes so are intentionally out of scope. *(Shipped. The one thing never confirmed is **interactive mirror smoothness under a real hover on a deploy** — a pointer-device feel judgement, not a correctness question, so it now belongs to **Layer H**'s cross-browser pass rather than sitting here as a permanently half-ticked build item.)*
20. [x] **Why Attractive / Key Risks** insight grid — Thesis-section card (reference has it; was missing from this list). `ThesisInsights.tsx`, ports `buildAttractive`/`buildRisks`/`riskInvalidation` with Strong/Severe tags + invalidation callout.
21. [x] **Company Overview** — Thesis-section business-summary card. `CompanyOverview.tsx`.
22. [x] **Browse & Search landing (`/stocks`)** — fixes the `/stocks` 404 (no landing route existed). Search by ticker + company name, market (US/ASX/TSX) + sector filters, market-cap-descending list over the then-~720-stock universe (**863 as of 2026-08-06** — it auto-expands, so this figure is a snapshot of the build, not a spec); links to the detail pages. Loads a lightweight index (`web/lib/universe.server.ts`, `unstable_cache` daily) — never ships the `fundamentals` JSONB to the client. Hosts the **Cycle horizon selector** (Short/Medium/Long, default Medium, persisted; carried into the opened stock via `?preset=`). `StockBrowser.tsx` + `web/app/(app)/stocks/page.tsx`. Sidebar nav renamed `Stock Detail` → `Browse`. *(S4. Live-add of unknown tickers deferred; `Custom` horizon deferred to Layer D.)*
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
> **Round-2 session 3 (2026-06-30) — MERGED + LIVE (PR #50, main `ed2ecf9`, prod `dpl_Ceyi6…`):** **C-R2** null-data render sweep (consistent hide/empty-state across every Stock-Detail section + a "Major Cycle unavailable at this horizon" notice on both page and report; edge cases verified with fake data via a local-only `/dev-fixtures` gallery); **C-R3** deep keyboard-a11y (chart range buttons `aria-pressed`+`role=group`, dialog `aria-haspopup`, gauge `role=img`, table `aria-label`, day-panel focus); **C-R4** formal perf/compliance/#15 checks (PASS — disclaimer above the fold, 5 compliant tiers, 0/44 `analysis_runs.results` persisted); **split false-positive fix** (FDX — require a *persistent* cliff). See `docs/layer-c-audit.md`.
>
> **Round-2 session 4 (2026-06-30) — C-R8:** full 10-check audit of the Browse `/stocks` tab.
>
> **Round-2 session 5 (2026-07-01) — C-R5 deploy-gated live tail — ✅ ROUND 2 DONE.** Every round-2
> deliverable (C-R1/2/3/4/6/7/8/9 + the report cycle-null notice + the FDX split fix) verified on
> production: the report route renders with its logo from the Vercel lambda; CAD/AUD/USD each shown
> in the stock's home currency (#13); analyst consensus verbatim (#17) beside our five compliant
> tiers (#16); disclaimer above the fold as the first `<main>` child. **Follow-up the same day
> closed both loose ends** — the FDX `split_events` false positive self-healed on the first nightly
> cron after the persistence fix (zero `pending`/`failed` rows), and `/api/cycle`'s
> "history too short for this horizon" case moved from a misleading **500 → 422**
> (`insufficient_history`), which is log hygiene only: the page already degraded gracefully.
> **Engine untouched across the entire round.**

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
- [x] **Universe expansion handler** — **queue model** (owner-approved, Layer E fast-follow): unknown tickers go to `unavailable[]`; the user requests them from the **Request a Ticker** page (choose-only over the `listings` menu) → `ticker_requests` queue → the daily cron fetches them via the yfinance `DataProvider`. No synchronous `/api/fetch-ticker`. See `architecture.md` §8 Tier 4. *(Shipped in Layer E and audited there as **E9**; live today — `listings` holds **9,081** selectable symbols and `ticker_requests` **9** rows. Marked done 2026-08-02: it was left `[~]` only because it was handed to Layer E, and Layer E delivered it.)*
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
> **Build status — historical, superseded by the audit note above (2026-06-17):** built on
> `feat/layer-e-results` off `main` (PR #38, CI green, then awaiting owner merge; commit
> `10b4ccf`). *That branch was merged as part of PR #44 — Layer E has been live since
> 2026-06-26; nothing here is outstanding.* Reads the SAME in-memory
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

### Layer F: Static Pages + Subscription ✅ BUILT + AUDITED (F-A1…F-A5) + MERGED + LIVE

Goal: every non-app page live, and the subscription flow working end to end — signed-in free
tier, 7-day trial, paid conversion, and the paywall that separates them.

> **Status: live in production since 2026-08-01.** `feat/f3-stripe` → `main` via **PR #72**
> (merge `cd6b014`, 98 commits), deployed and verified at the wire *and* on a real free account.
> The last two open items — rolling the live Stripe key and scoping the CI key — closed
> **2026-08-02** (`ab11e18`). Nothing in Layer F is outstanding.

> **Audit: `docs/layer-f-audit.md`.** That file is now the home for Layer F's detail — the full
> build record (F0–F3, the ten F3 steps, the five live-check sessions, the go/no-go table, merge
> day, key hygiene) **and** the production-readiness audit tracker, in the same 11-check ×
> surface-matrix format as Layers C, D and E. What lives here is the summary.
>
> Note what the live-check sessions were and were not: they were a **security and billing**
> audit — the paywall cannot be bypassed, the money moves correctly, proven at the wire across
> twelve viewer states and a full test-clock lifecycle. They never asked whether the pages are
> accessible, on-brand or well written. Those axes are the audit F-A1…F-A5.
>
> **Audit COMPLETE (2026-08-02) — F-A1 … F-A5 including the live tail on `www.majorcycle.com`.**
> Nine findings, **none a security or compliance breach**; seven were copy or presentation, and
> the two found only on the live site were real behaviour:
>
> - `/pricing` no longer advertises the free tier back to a prospective subscriber, and names the
>   screener, the report and the free account; `/methodology` names **Cycle Payoff**;
>   `--brand-light-border` is a token instead of a hex written out 13 times.
> - **F-A4-b** — the **trial modal**, the last screen before payment, listed three benefits a free
>   account already had. Its list was a private copy that had drifted from the (correct) one in the
>   upgrade dialog; both now import one `PREMIUM_UNLOCKS` constant, so they cannot disagree again.
> - **F-A4-c** — `/deletion-requested` told **any** signed-in reader their account was scheduled
>   for permanent deletion. The "signed-out readers only" rule lived in two places with two
>   memberships, so the page opted out by omission; it is now one `SIGNED_OUT_ONLY_PATHS` list in
>   `proxy.ts`, guarded by an e2e assertion proven to fail without it.
>
> Live tail also confirmed: **zero console messages** across 18 production routes (instrument
> proven with a probe first), all eight `PREMIUM_FIELDS` absent from a free account's raw HTML,
> `/report` 402 `private, no-store`, and AUD pricing correct to the cent. Auth surfaces and the
> paywall lock copy passed with no findings.
>
> **F-A6 — subscription-state matrix on LIVE, 14/14 pass (2026-08-02).** The paid states had only
> ever been exercised in the Stripe sandbox; this drove them on production by writing the owner's
> own `profiles` row (**no Stripe call, no money**) and reading every premium surface back. Covers
> monthly/annual, trial, both scheduled-cancel variants, **both sides of the grace window**, the
> dispute lock outranking a live subscription, "no second free week", deletion confinement, and
> two fail-closed cases (unknown status, missing grace marker). Account restored to byte-identical
> (`0 rows differing`) with the injected trial tombstone removed.

**F0 — Auth branding / de-Supabase-ification.** Every auth touchpoint reads as `majorcycle.com`.
- [x] Native Google sign-in (Google Identity Services + `signInWithIdToken`) — kills the
      `*.supabase.co` address-bar flash. `web/components/GoogleSignIn.tsx`
- [x] Token-hash email verification route `web/app/auth/confirm/route.ts` — branded links
- [x] `/account/update-password` page (fixed the broken reset-flow 404)
- [x] `getSiteURL()` + friendly auth-error copy — `web/lib/url.ts`, `web/lib/authErrors.ts`
- [x] Google consent-screen branding, Authorized JS origins, published

**F0.5 — Auth hardening & security pass** (shipped + live-verified 2026-07-05, **PR #61**).
- [x] **Recovery-session confinement (HIGH)** — a reset link no longer grants roam-the-app access
      before a new password is set (`mc_pw_recovery` marker + `web/proxy.ts` guard)
- [x] Sign-out route + button · open-redirect guard (`safeNextPath()`)
- [x] **`profiles` billing-column lockdown** — migration `20260705032433`: subscription/Stripe
      columns are client-immutable, verified via `column_privileges`
- [x] FK covering indexes (`20260705032503`); advisor WARNs cleared
- [x] Security headers + **CSP report-only** (`web/next.config.ts`) — the flip to enforcing is a
      tracked launch decision, carried in the audit doc
- [x] DMARC `p=none` → `p=reject`, verified live
- [x] `/disclaimer`, `/terms`, `/privacy` — baseline legal pages

**F1 — Public methodology, contact, CI e2e, sign-in performance** (shipped 2026-07-07).
- [x] `/methodology` — public, pre-sign-up plain-English explainer, **no formulas**, disclaimer
      above the fold, CTA into the trial
- [x] `/contact` — form → Resend via a server action; honeypot, validation, `reply-to` = sender,
      brand-styled HTML email, safe fallback to `support@` when the key is absent
- [x] `support@majorcycle.com` inbox (Cloudflare Routing + Gmail send-as) wired across every
      public page; `RESEND_API_KEY` in Vercel so the form sends for real
- [x] **CI auth e2e enabled** — repo Variables + Secrets set, so the Playwright job stopped
      skipping
- [x] Shared branded email wrapper `web/lib/email/brandEmail.ts` (design-system §17); contact
      sender moved `noreply@` → `support@`, since those are messages you actually reply to
- [x] **BIMI dropped** (owner decision 2026-07-08) — Gmail needs a paid VMC (~US$1k+/yr plus a
      registered trademark). Revisit only with a trademark and revenue
- [x] **Sign-in performance** — `getClaims()` (local WebCrypto + cached JWKS) replaces
      `getUser()`'s Auth round-trip on every request; hard redirect after sign-in kills the
      "bounces back to sign-in" stutter; One Tap on iOS (`itp_support`) + a "Signing you in…"
      state. Owner live-verified. (PRs #69, #70.)

**F2 — `/account`** (merged live + fully verified 2026-07-13, `d6c5eb9`).
- [x] **Part A — core:** edit display name + country (country locks once subscribed, because
      Stripe fixes the currency); change password
- [x] **Part B — delete account:** 30-day grace, deletion confinement, nightly purge cron
      (`/api/cron/purge-accounts`), branded scheduled/deleted emails
- [x] **Part C — refer a friend:** invite by email, self-referral blocked, 10/day per user

**F3 — Stripe subscriptions, 7-day trial, and the paywall** (**PR #72**, live 2026-08-01).
- [x] **Step 1** migration + carry-over fixes + a secret-scan pre-commit hook — 8 service-role-only
      billing columns
- [x] **Step 2** `web/lib/stripe.ts` — pinned API version `2026-06-24.dahlia`, prices resolved by
      **`lookup_key`** so identical code works in test and live
- [x] **Step 3** `POST /api/checkout` + **`/pricing`** (monthly/annual, region-aware currency) +
      `/account` wiring
- [x] **Step 4** `POST /api/stripe/webhook` — the **one** writer of billing state; idempotent via
      the `stripe_events` ledger. Verified end-to-end through the Stripe CLI, which caught a real bug
- [x] **Step 5** Customer Portal (`/api/portal`) — manage card, invoices, cancel
- [x] **Step 6** delete ↔ billing wiring, `cancel_at` fix, event traceability
- [x] **Step 7** trial-abuse guard — an email **tombstone** that survives account deletion, so a
      repeat email subscribes with no free week (never hard-blocked), plus Stripe Radar
- [x] **Step 8** trial reminders, branded billing emails, dispute handling (an *inquiry* must not
      lock; a real chargeback must)
- [x] **Step 9** Stripe branding — Checkout appearance, invoice template, portal configuration
- [x] **Step 10** **paywall + free tier** — the data is free, our judgement is paid. Free keeps
      Browse, the price chart, the drawdown overlay *with its cycle bands* and every
      fundamentals/sentiment section; premium is the Overall Rating, Health Score, Verdict,
      scorecard, rating badges, the downloadable report and the whole screener. Rule lives in
      `web/lib/entitlement.ts`
- [x] **Live Stripe wiring** — live webhook `we_1TzaT1K8OQZXQEminyKXmO3M` (livemode, 13 events,
      `www` URL), `STRIPE_WEBHOOK_SECRET` in Production, restricted `rk_live_` key with five
      permissions and **Customers = None**

**Verification:** ✅
- Full trial → convert → renew → decline → grace → hard-lock → recover lifecycle driven on Stripe
  **test clocks**, plus 3DS, dispute-inquiry-vs-chargeback, and the checkout reconciler proven
  with the webhook forwarder **killed**
- Paywall proven at the wire across **all twelve viewer states**; premium keys absent from the raw
  HTML for a free viewer, not merely hidden on screen
- **105** Playwright tests, 2 static CI guards (entitlement gates, report sections), 86 pytest
- Live production check on a real free account: Stock Detail 200 with "Current Drawdown" present,
  zero premium keys in the HTML, `/run` locked at the same URL, `/report` 402
- **Cannot be executed, by rule:** a real-card purchase. Stripe's ToS forbid testing in live mode;
  the live evidence is a `cs_live_` Checkout Session reaching the hosted payment page with the
  correct trial and price, then abandoned

### Data-integrity fixes — 2026-08-04 ✅ SHIPPED (PRs #73, #74, #75)

Unplanned, done before Layer G G1 at the owner's direction. All three merged and
live-verified the same day.

1. **ASX bars were stored one day early, from inception** (PR #73). `tz_convert(None)`
   computes a date via **UTC**, which is only right for exchanges west of Greenwich —
   Sydney midnight is 13:00–14:00 UTC the *previous* day. 1,413,737 rows across 251
   tickers: **0 Fridays, 273,700 Sundays**, while US/CA looked perfect. Fixed to
   `tz_localize(None)`; data corrected by a two-phase date shift (row count identical
   before and after); verified against a fresh Yahoo pull at **offset 0**, with US/CA
   as untouched controls. **Ratings were unaffected** — measured, not assumed: same
   closes under both date sets, 3 tickers × 3 presets, only `as_of` differs.
   Real impact was on **date-joined** surfaces: Relative Performance matched only
   199/252 days against the S&P 500 (and matched the *wrong* days); now 248/252.
2. **TSX Venture `.V` classified as US** (PR #74). The ticker→market rule lived in
   four places; two knew only `.AX`/`.TO`. Consolidated to one `MARKET_SUFFIXES`
   table. Latent only — venture listings are off by owner choice.
3. **The nightly cron ran inside the ASX pre-open** (PR #75). No single UTC time is
   after every close, so it is now two runs: **AU 08:00 UTC**, **US+CA 22:30 UTC**.
   Proven by a manual run: 6/6 partial pre-open bars replaced with the real close
   (Macquarie had been out by **$5.52/share**).

Test suite: Python **86 → 121**, Playwright **105 → 115**. Every new guard broken on
purpose first.

### Data-format & long-term-safety audit — 2026-08-05 ✅ MERGED + LIVE-VERIFIED (PR #77, `e4237fa`) → `docs/data-audit.md`

Owner-requested before Layer G G1, after the previous session found three defects
that had all been live for months and were all invisible to code review. The real
question was not "find three more" but **why did those survive, and what would have
caught them** — and that had the better answer.

**10 findings. 7 fixed, 3 documented-not-changed. 6 new guards, each broken on purpose
first — and one, `check_field_units`, broken in *both* directions.**

1. **A bank's `0.0` gross margin was scored as a real 0%** — yfinance's
   "not reported" sentinel. **71 stocks**, 36 changed rating, and **4 changed the
   label a customer reads** (C, WFC, SYF Neutral→Constructive; EQB.TO
   Cautious→Neutral). It also dragged the Financial Services peer median from
   47.34% to 35.81%. Fixed at the data layer, on write *and* read; 72 rows
   backfilled.
2. **Five unbounded reads that silently truncate at 1000 rows** — including the
   nightly refresh. `stocks` was 133 rows from the cliff on a table that grows by
   design. `listings` is *already* truncated at 1000 of 8,964.
3. **`financialCurrency` was never read** — statements rendered `A$` in front of
   US dollars for **79 of 863** stocks (a third of the Canadian universe), and
   `fcf_yield_pct` divided USD by AUD into the Health score.
4. **The cron installed whatever yfinance was newest, every night** — an
   unreviewed deploy of the thing that defines what our numbers mean. Now pinned,
   with a nightly **cohort-median tripwire** that emails the owner if a field's
   units move.

Documented, not changed: 52-week high/low sit on a different price basis from the
chart (owner's call — D5); 46 bars carry Yahoo's own impossible OHLC (D6);
`rel_strength_vs_sp500` compares ASX stocks to the S&P 500 but is never rendered
(D7).

**Three further findings came out of verifying the fix, not of reading code:**

5. **D3c — a rule enforced in one runtime is not enforced.** `normalise_fundamentals()`
   runs on write and on the Python read path; the Key Metrics table renders from
   **TypeScript**, so 73 rows kept a cross-currency FCF yield *on screen* after the fix
   was written, tested, guarded and pushed. Fixed by asserting the invariant **on the
   data** (nightly), not by porting the rule into a second language — that is 11c's
   drift trap.
6. **D3d — the database fixes expire nightly until the code is merged.** The refresh
   replaces the whole `fundamentals` object per ticker, and a `schedule`-triggered
   `actions/checkout` takes the **default branch** — so **608 of 863 rows** were reverted
   fourteen hours after being fixed. ⚠️ Worse, `check_invariants()` reported *zero*
   violations over that broken universe, because the reverted rows had lost the field the
   test reads: **unmeasurable counted as clean.** Third invariant added (>5% missing
   `financial_currency` is itself a breach), and the nightly log now prints invariant
   **names**, never a count.
7. **The P/E chart needed a second control.** `ValuationHistory` consulted the
   currency reason *only* when the series ran short, so a stale cross-currency series
   would have drawn as an ordinary chart. Now gated on `!unavailableReason` first.

**✅ MERGED `e4237fa` 2026-08-05 04:00Z.** Both crons then re-run via GitHub
`workflow_dispatch` **on `main`** — never locally and never before the merge, since a
scheduled workflow checks out the default branch. Live result: **au 250/250 · ca 79/79 ·
us 534/534** carry `financial_currency`, **zero** 0.0-margin rows, all **79**
cross-currency stocks withhold `pe_history`. Production tripwire logged
`39 field(s) checked across 863 stocks; invariants: … — OK`. Verified signed-in on
`www.majorcycle.com`: browse, stock detail (ABX/BHP/JPM/AAPL), report payload, screener,
CSV (blank cells, not zeros) and Excel.

### Downloaded report was blank — 2026-08-05 ✅ SHIPPED (PR #78, `5bf4a87`)

Found because the **owner asked whether the downloaded report worked** — a different
artifact from the report *route*, which returns JSON and was fine. `Download Report`
produced a well-formed 4 MB `.html` that threw `ReferenceError: process is not defined`
and rendered **nothing**, for every stock, from **2026-08-01 to 2026-08-05**.

Cause (esbuild metafile, not guesswork): `KpiStrip → PremiumLock → UpgradeDialog →
next/link` pulled Next's client router into the offline bundle, whose module scope reads
`process.env.__NEXT_ROUTER_BASEPATH`. Fixed with a `process` shim in the bundle banner —
a shim, not more `define` entries, so the next stray import degrades rather than blanks.
Guarded by **`e2e/report-download.spec.ts`** (downloads the real file, opens it over
`file://`, asserts it mounts and draws). ⚠️ CI also had to *build* the bundle: `next dev`
never runs `prebuild`, which is why the download had never been exercised in CI at all.
Recorded as **CLAUDE.md 11d**.

Test suite: Python **121 → 153**; Playwright **115 → 116**;
`pnpm check:data-integrity` **55 checks**; `_engine` drift check now **derives** its file
list instead of hardcoding six paths.

#### Open follow-ups from this audit (owner's call — none are emergencies)

| # | Item | Why it matters |
|---|---|---|
> ✅ **1, 3 and 4 were closed on 2026-08-06** against production, and item 3
> found a real defect (D8 — the CSV and the Excel of one run disagreed by a
> cent). Item 2 is owner-deferred with a full design written up. Item 5 remains.
> Everything was then **re-walked with the owner driving their own browser** the
> same day, including all **seven** reporting currencies and all ten subscription
> states. Details in `docs/data-audit.md` § *Follow-up session*.

| 1 | ~~**Verify every surface as a FREE account**~~ ✅ **DONE 2026-08-06** — 9 surfaces, zero premium fields in the HTML, plus an 11-state subscription matrix | Everything on 2026-08-05 was checked as a *subscriber*. The paywall and the data changes interact, and only one side has been seen. Highest-value gap. |
| 2 | **Per-stock cross-check** — compare our figure against the provider's own independently-derived one (our P/E vs `trailingPE`, etc.) — ⏸ **DEFERRED by owner 2026-08-06 to after the remaining layers.** Full design written up in `docs/data-audit.md` § *Deferred — the per-stock number check* so it can be picked up cold | The cohort tripwire catches a unit change affecting **all** stocks and is blind to **one** stock being wrong. This is the check that exposed Barrick — but by hand, once, not nightly. Needs a tolerance tuned against live data (honest same-currency drift ran 1–17%; the real defect was 90%). |
| 3 | ~~**Open the exported `.xlsx` and read its cells**~~ ✅ **DONE 2026-08-06 — found D8**, fixed, guarded, and re-verified on production with all 152 cells compared | Confirmed only as a valid file built from verified rows; its cells were never parsed. |
| 4 | ~~**Eyeball the remaining screens**~~ ✅ **DONE 2026-08-06** — `/account` in every state, `/request`, the Sentiment section, all five detail sections. One item raised for the owner: the Results table shows a bare `$` for US, AU and CA prices alike | Untouched on 2026-08-05. |
| 5 | **`ci.yml` still installs unpinned `yfinance>=…`** for the test job | Listed, not changed. A green CI therefore does not prove the *pinned* pipeline works, and an upstream release can redden untouched code. |

> 🔴 **The reason this list exists.** Four defects on 2026-08-05 were invisible to
> typecheck, lint and every guard, and surfaced only when the finished thing was opened
> and looked at — three by rendering pages, and the blank report **by the owner asking the
> right question**. The automated checks are good at guarding *known* failures and poor at
> finding *new* ones. Plan verification accordingly.

### Layer G: SEO + Performance (target: 3-4 days)

Goal: Lighthouse 90+ on per-ticker pages, all SEO essentials live.

> **🔴 READ THIS BEFORE PLANNING G — the checklist below rests on an assumption that is false
> today, verified against production on 2026-08-02.**
>
> 1. **Ticker pages are not crawlable at all.** `GET /stocks/us/AAPL` signed-out returns
>    **`307 → /login?next=…`**, as does `/stocks`. A sitemap "with every ticker page included"
>    would therefore publish ~863 URLs that all redirect to a login screen — worse than no
>    sitemap, because Google reads that as a soft-404 farm. **Whether ticker pages become
>    publicly crawlable is a product decision for the owner, not an implementation detail,
>    and it is the first thing Layer G must settle.** The machinery to do it safely already
>    exists — `stripPremium()` already produces the exact free-tier payload — but it touches
>    the free-vs-premium contract (§7.1), the 25/day free-view fence, and decision #33.
> 2. **`/robots.txt` and `/sitemap.xml` are themselves 307ing to `/login`.** They are not in
>    `PUBLIC_PATHS`, so adding `app/robots.ts` and `app/sitemap.ts` is *necessary but not
>    sufficient* — the proxy will redirect the crawler before Next ever renders them. Add both
>    paths to `PUBLIC_PATHS` in the same change, and assert it on the wire (200 + correct
>    `content-type`), not in the source.
> 3. **Only `/stocks/[market]/[ticker]` has `generateMetadata`.** 19 files export static
>    `metadata`; nothing else is dynamic. No `app/opengraph-image`, no OG image route.
> 4. **The framework is Next 16.2.6 / React 19.2.4** (not 15, as this doc long claimed) — so
>    Cache Components / `use cache` / PPR are available and are the right lever for the
>    Lighthouse target. Confirm against current Vercel docs before designing around them.

- [x] **DECISION MADE 2026-08-04:** nothing the product sells is crawlable. Search traffic comes
      from written content, not from ticker data. **Do not re-propose indexing stock pages.**
- [x] `/sitemap.ts` — the 6 indexable public pages, derived from `PUBLIC_PAGES` (`lib/seo.ts`)
- [x] `/robots.ts` — public pages allowed, every app surface explicitly disallowed, plus the
      AI-crawler split (allow search bots that cite us; block training crawlers)
- [x] **Added `/robots.txt` + `/sitemap.xml` to `PUBLIC_PATHS`** — they 307'd to `/login`
      without it, which no amount of correctness inside either file would have fixed
- [x] Per-page metadata — canonical + Open Graph on all 10 public pages via one helper;
      `noindex` (but crawlable) on the four sign-in pages
- [x] Canonical URL — **one `SITE_ORIGIN`**, `www`. The literal was in FIVE files and one
      disagreed; it never fired because `NEXT_PUBLIC_SITE_URL` is set in production, which is
      why nobody saw it. `check:seo` now fails the build on a sixth copy.
- [x] **Google Search Console verified 2026-08-06** — Domain property (covers apex + `www`),
      DNS TXT on the root. See `architecture.md` §11 for the record and the warning about it.

> ### ✅ G1 COMPLETE — 2026-08-07. PR #89 open, deliberately unmerged for the whole layer.
>
> Audited twice at the owner's request, then re-checked against the primary sources
> (RFC 9309, Google's robots/canonical/sitemap docs, the Next metadata reference, each
> vendor's crawler docs). **No defects found in G1 itself.** 21 deliberate breaks all
> caught; `check:seo` 287 checks; Playwright **152** green three consecutive local runs
> and in CI.
>
> **Verified signed-out on a production BUILD** (`next start`, no cookies), calibrated
> first against pages already confirmed on the Vercel preview: `/pricing` indexable with
> a canonical; the four sign-in pages `noindex, follow`, all **200 and not disallowed**;
> none of them in the sitemap; every canonical and `og:url` naming `www.majorcycle.com`.
> Control: 7 gated paths all 307 → the reader does detect redirects, so those 200s are real.
>
> ⚠️ **A Vercel PREVIEW cannot show you the signed-out view.** Its access cookie and the
> app session share one jar, so dropping one drops the other. Worse, a *signed-in* reading
> silently measures a different page — `/pricing` bounces to `/account`, `/login` to
> `/stocks` — which produced five clean-looking rows for pages nobody asked about. **Print
> the landed URL beside every reading and never follow redirects when measuring.**
>
> Also fixed in this session, though not SEO: `fetchStockDetail` answering **"Stock not
> found" on a failed database read** (CLAUDE.md 11e) — found *because* it was corrupting
> the test suite's evidence.

> ### ✅ G2 (design) — COMPLETE 2026-08-08 (all five approved steps built and verified)
>
> Full briefs in **`docs/layer-g-page-briefs.md`**; measured gap analysis and the tool
> decision in **`docs/layer-g-design-strategy.md`**. Both approved by the owner.
>
> **Done.** Claude Design project *"MajorCycle Design System"* created (the owner's
> first) and the **foundations captured** — colour, typography, spacing, radius, shadow.
> ⚠️ **Generated, never hand-written**: `pnpm build:design-system` parses the real
> `web/app/globals.css`, so a colour that is not shipped cannot appear in the gallery.
> Output `web/design-system-build/` is **gitignored** — a rendering, never a source of
> truth. Components are captured as **screenshots of the running product** rather than
> re-implemented, for the same reason. Real product screenshots taken on live across the
> free *and* paid states (owner authorised flipping their own entitlement; recorded,
> restored and verified — Stripe never touched).
>
> **Intent locked by the owner (5 decisions).** Demonstrate the method before naming it ·
> the landing page shows a **fixed** stock (Apple), not a rotating one · the About trust
> list is sufficient without a name · `/learn` articles target the **newcomer**, not the
> paying buyer · the weekly note gets its **own `/notes` section**, one permanent page per
> week with an archive. **Audience = both, served in LAYERS not averaged** — this
> corrected the plan's "a complete beginner", which contradicted a $15/mo terminal.
>
> **Tool decision — spend $0, and specifically NO Figma.** A design file is a second
> description of the design sitting beside the code: the exact drift shape 11c exists for,
> which has already bitten this project four times. **The site is the design file**; the
> owner reviews the real page on a preview. Stack is what is already owned (shadcn +
> Tailwind + Lucide + locked tokens) plus Excalidraw for the cycle diagram, `next/og` for
> the share image, Squoosh for image weight, and contrast measurement promoted into a
> Playwright test. Tailwind Plus (~US$299 once) considered and **deferred**, to be
> revisited only if the landing page stalls on layout rather than content.
>
> **All five approved steps BUILT 2026-08-08.** Deviation from the tool list, flagged
> rather than silent: the cycle diagram is an **inline SVG built from the real tokens**,
> not Excalidraw — a hand-drawn asset would be a second source of truth for the palette,
> and it could not be responsive. The share image is a **committed PNG generated by a
> script**, not runtime `next/og`: an ImageResponse puts a font fetch and a satori parse
> between a social crawler and a card, and the owner cannot debug a serverless font
> failure from outside.
>
> | Step | Built | Guard |
> |---|---|---|
> | 1. Reading type scale | 7 tokens + `.reading`, `PageFrame` widths | `contrast.spec.ts` 12px floor |
> | 1. Two contrast fixes | tier badges **2.38 → 4.73:1**, disclaimer **2.69 → 6.8:1** | `contrast.spec.ts`, 5 pages |
> | 2. Page frame | narrow / prose / wide; header+footer once | — |
> | 3. Cycle diagram | inline SVG, HTML labels, 375–1440 | — |
> | 4. Share image | one sitewide 1200×630 PNG | `seo.spec.ts` ×3 |
> | 5. Landing at `/` | real Apple figures, nightly snapshot | `seo.spec.ts`, gated-route control |
>
> **Measured outcome on `/methodology`: 8 contrast failures → 1** (the 9px header
> wordmark, deferred to H). Playwright **152 → 163**, all green in CI.
>
> **Three defects found by the guards, all written the same session** — the token
> `--text-muted` reached for twice more (2.97:1 both times), `.reading a` outranking
> `.text-white` on a brand-blue button (**1.0:1, invisible**), and the sitemap
> advertising `.../` for the homepage while its own canonical said `...` with no slash.
>
> ⚠️ **And one the PR caught that no local run did**: 7 mypy errors in the new cron
> script. Layer F's lesson held again — open the PR early.
>
> ⚠️ **A push created no workflow run at all.** GitHub did not fire the `pull_request`
> event for `9ae0599`, so `gh pr checks` showed only Vercel and the newest verdict on
> record was the previous commit's FAILURE. An empty commit forced it. **"No red" is not
> "green" — check that a run exists for the SHA you are looking at.**

> ### ✅ G3 (public chrome) — COMPLETE 2026-08-12. Still inside PR #89, still unmerged.
>
> The thirteen public routes wore two design languages: the landing had a nav, the other
> twelve had a logo and a "Markets · Live" pill, so a reader on `/terms` could neither
> reach pricing nor sign in. The card was a 12px radius over a 60px ambient blur,
> hand-typed in four files.
>
> **Built.** One `PublicHeader` + one `PublicFooter`, both reading one list
> (`lib/publicNav.ts`); `--shadow-lift` named as the third shadow role; `PricingPlans`
> folded onto `AuthCard`; `not-found.tsx` restyled; the legal pages given
> `/methodology`'s furniture plus a contents list and numbered clauses.
>
> **Contrast: 21 failures across the 11 public pages → 11**, all of which are the one
> deferred 9px wordmark; **zero at 375px**. Six were real and pre-existing, on the
> sign-in and payment path — see `design-system.md` §14.
>
> **Three defects found by measuring rather than looking**, all recorded in CLAUDE.md:
> the footer that never got the rule its header had (11c-iv); `/deletion-requested`
> readable by any stranger (11f); and `seo.spec.ts` about to go green against `/login`
> because both pages are `noindex`.
>
> ⚠️ **Owner has NOT accepted the legal pages.** `/terms`, `/privacy` and `/disclaimer`
> are functionally correct and measured clean, but read as a different product from the
> auth pages. **Measured cause, 2026-08-12:** two deliberate type scales meeting with no
> transition — h1 **24 → 36px**, body **13 → 17px**, column **440 → 680px** between
> `/contact` and `/terms`. Wording, sizes and layout are the FIRST item of the next
> session; do not treat these three pages as signed off.
>
> **Still to come in Layer G:** the approved landing page, removing `/methodology` (it
> becomes the `#how-it-works` anchor), and `/learn`.

- [x] **Fix the two material contrast failures INSIDE Layer G** (not H): the rating tier
      badges **2.38 → 4.73:1** (the page now renders the REAL `.tier-badge`, so no locked
      tier colour was touched) and the "Full disclaimer" link **2.69 → 6.8:1**. The
      remaining six stay with the Layer H sweep. Guarded by `e2e/contrast.spec.ts`.
- [x] **Define the reading type scale.** Seven tokens (`--rd-micro` … `--rd-display`),
      applied once through `.reading`; three `--measure-*` widths behind `PageFrame`.
      Table in `design-system.md` §3.

**Found during the G1 spec review (2026-08-07) — filed here, not silently changed:**

- [ ] **`majorcycle.com` → `www` is a 307 TEMPORARY redirect.** Google consolidates ranking
      onto one address only via a **permanent** redirect; temporary explicitly means "do not
      consolidate". G1 just declared `www` canonical in ten places and the server contradicts
      it. **Owner approval required; do it AT MERGE.** Zero billing risk — Stripe points at
      `www` directly, and http→https is already correctly 308. *(Highest-value item in Layer G.)*
- [ ] **No `og:image` anywhere** — every shared link renders a bare card. A single
      `app/opengraph-image.png` + `opengraph-image.alt.txt` covers the whole site and Next
      emits the url/type/width/height itself. **→ G2**, because it is branding and the owner
      approves branding before it ships. Pair with `twitter:card: summary_large_image`.
- [ ] **`llms.txt` — RECOMMEND DROPPING. Owner decision, to be re-asked when the content
      sessions begin (plan session G4), not now.** The Layer G plan said "it costs twenty
      minutes so I'll ship it". Checking the sources changed that advice: Google's John
      Mueller confirmed **no Google Search system reads or acts on it**, and as of Q1 2026 no
      major AI company — Google, OpenAI, Anthropic, Meta, Mistral — reads it in their search
      or answer engines. Adoption is ~10% of domains. It is a **hand-maintained second index
      of the site**: today it would list six legal pages (no value), and once `/learn` exists
      it becomes a file that must be updated on every publish or it silently goes stale —
      exactly the drift CLAUDE.md 11c is about, for a reader that may not exist. **Re-ask
      then, when the trade is real**, i.e. when there is content worth listing.
- [ ] **Every public page is `ƒ` (server-rendered per request)**, including pure-text legal
      pages; only robots/sitemap/icon are prebuilt. Hurts TTFB and the 90+ target. **Cause not
      yet identified** — `/terms` uses no dynamic API and has no `force-dynamic`. **→ G6.**
- [ ] Four descriptions exceed ~155 chars (Disclaimer 176, Methodology 175, Terms 159,
      Privacy 156). Google truncates the display; **no penalty**. Cosmetic. **→ G6.**
- [ ] JSON-LD — `Organization`, `WebSite`, `Article`, `DefinedTerm`. **NOT `FinancialProduct`**
      and no rating markup: that asserts an investment claim in machine-readable form,
      against compliance posture #24.
- [ ] OG images via **`next/og`** — ships with the App Router; `@vercel/og` is NOT a
      dependency we need (this doc claimed otherwise for months). Waits on G2's design.
- [ ] **Submit the sitemap in Search Console — AT MERGE, not before.** `/sitemap.xml` 404s on
      production until Layer G is live, and submitting a 404 teaches Google to distrust it.
      *(Google retired the "ping on deploy" endpoint in 2023; it now 404s. The mechanism is
      the `Sitemap:` line in robots.txt plus one manual submission.)*
- [ ] Image optimisation pass (next/image everywhere)
- [ ] Bundle size audit — remove any unused deps
- [ ] Lighthouse pass — score 90+ on at least 5 sample ticker pages
- [ ] **Config review** (`web/next.config.ts`): CSP is still `Report-Only`; no `images`
      config; `poweredByHeader` not disabled. Decide each deliberately.

**Verification:**
- Lighthouse CI runs in `.github/workflows/ci.yml`
- Test URL via Google's Rich Results test
- Test OG images via Twitter/LinkedIn debuggers
- `curl` proves `/sitemap.xml` and `/robots.txt` answer **200 signed-out**, not 307

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

The product is "ready to launch" when ALL of these are true. **Every row cites a reading, not a
memory** — re-verified 2026-08-02. ✅ proven · 🟡 partly proven, with what's missing named ·
⬜ not started, with the layer that owns it.

### Functionality
| | Criterion | Evidence |
|---|---|---|
| 🟡 | Every Stock Detail section works with real data for every covered ticker | `pnpm check:report-sections` green — **22 sections**, and it also proves the downloadable report mirrors the page. **Don't hard-code the count**: it read "19" here and "14" in CLAUDE.md #29 on the same day the guard said 22; the first two are frozen planning-era numbers, so **the guard is the source of truth**. *Missing:* "every ticker" is unprovable by exhaustion — the mitigation is C-R2's null-data render sweep, which gives every section a defined empty state |
| ✅ | All three Run Analysis presets + Custom produce correct results | Layer D audit: `analyze.py` output **byte-identical** to `/api/cycle` on AAPL / BHP.AX / SHOP.TO plus custom −7/+7/300, all 21 keys |
| ✅ | Universe auto-expansion works for arbitrary US/AU/CA tickers | Live in production: `ticker_requests` = **8 `fetched`**, 1 `unsupported`. Real requests, drained by the nightly cron |
| 🟡 | Signup → trial → paid flow works end-to-end with real cards | **Cannot be executed, by rule** — Stripe's ToS forbid testing in live mode. Evidence instead: the full trial→convert→renew→decline→grace→lock→recover lifecycle on Stripe **test clocks** (incl. 3DS), plus a live `cs_live_` Checkout Session reaching the hosted page at the correct trial and price. *Missing:* the first real customer, which is a launch event, not a test |
| ✅ | Trial-end + payment-failure grace period works | Live-check S3 on a test clock: `invoice.payment_failed` → `past_due` + `grace_until` = +3d **still entitled**, then hard lock at +3d, then `invoice.paid` restores access |
| ✅ | Daily cron has run successfully for 7 consecutive days | **10 consecutive successes**, 2026-07-24 → 2026-08-02 |

### Quality
| | Criterion | Evidence |
|---|---|---|
| ✅ | Zero TypeScript errors | `pnpm typecheck` clean |
| ✅ | Zero ESLint errors | `pnpm lint` clean |
| ✅ | Zero Python type errors | `mypy analytics/` — no issues in **33 source files** |
| ✅ | All tests passing in CI | Run on `ab11e18`: Python ✅ · Frontend ✅ · E2E **105/105** · `pytest` **86** |
| ⬜ | Lighthouse Performance 90+, SEO 100, Accessibility 95+ on 5 sample ticker pages | **Layer G** — SEO plumbing **done** (G1: `robots.ts`, `sitemap.ts`, canonicals, Search Console). Lighthouse itself not yet measured; the instrument lands in the final Layer G session. Accessibility is **measured in G, fixed in Layer H** — otherwise G is blocked by work it isn't allowed to do. |
| ⬜ | Mobile responsive at 375px width | **Layer H** — already triaged and measured there: ~130px overflow, root-caused to the `(app)` shell sidebar, not to page components |

### Content
| | Criterion | Evidence |
|---|---|---|
| 🟡 | Methodology page complete and owner-approved | `/methodology` is live, public, formula-free, disclaimer above the fold. *Missing:* a recorded owner sign-off on the copy — folded into the Layer F audit's copy pass (F-A5) |
| ✅ | Disclaimers visible on every rating-displaying page | C-R5 live tail: the disclaimer is the first `<main>` child (top ≈ 79px) on every page and at 375px; re-confirmed for the paywalled states in live-check S2 |
| 🟡 | Terms, Privacy, Disclaimer pages live and reviewed | All three live since F0.5. *Missing:* they are **baseline content the owner has not yet reviewed**, and §"Explicit Non-Goals" defers a lawyer review to the owner's judgement |
| ✅ | Zero "BUY"/"SELL"/"AVOID" in our scoring outputs | Our labels are the five tiers only (`analytics/scoring/overall.py`, `web/lib/ratings.ts`). The Buy/Sell strings in `ratings.ts` are the **third-party analyst consensus map**, displayed verbatim by decision #17 — a different thing, and deliberate |

### Infrastructure
| | Criterion | Evidence |
|---|---|---|
| 🟡 | All accounts billing configured | Stripe live with payouts to the linked CBA account; Resend, Supabase and Cloudflare all on free tiers that suit the load. *Missing, and it is the **launch blocker**:* **Vercel is still Hobby, whose terms forbid commercial use.** Hobby → Pro is the owner's scheduled call at official launch |
| ✅ | Domain DNS verified, SSL cert active | `https://www.majorcycle.com` serving on a valid certificate; the apex 307s to `www` |
| ✅ | Index-membership seed present in repo migration | `supabase/migrations/20260624000000_index_membership.sql`; **774 rows** live, refreshed nightly from SPY/IOZ/XIU holdings. Universe recoverable from `stocks` + that refresh |
| ✅ | Stripe in live mode with real prices | Two multi-currency prices resolved by `lookup_key`; today's live Checkout Session priced **A$19.00/month after a 7-day trial** |
| ⬜ | Cron monitoring alert tested (force a failure, confirm email received) | The alert is **built** (Resend on cron failure) but has **never been fired on purpose**. Untested alerting is indistinguishable from no alerting — worth doing before launch |

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
✅ Phase 1 Layer C: Stock Detail Tab      (built + audited round 1 S1–S10 + round 2 C-R1…C-R9 + live)
   ↓
✅ Phase 1 Layer D: Run Analysis Tab      (built + audited D1–D4 + live)
   ↓
✅ Phase 1 Layer E: Results Tab           (built + audited E1–E11 + live)
   ↓
✅ Phase 1 Layer F: Static Pages + Subscription  (built + merged PR #72 + live 2026-08-01)
   ✅  └─ production-readiness audit F-A1…F-A6 COMPLETE 2026-08-02 → docs/layer-f-audit.md
   ↓
🔨 Phase 1 Layer G: SEO + Performance      ← NOW (G1+G2+G3 done; PR #89 open, unmerged)
   ↓
   Phase 1 Layer H: Hardening (Phase 1.5)  — owns 375px, a11y, cross-browser, Sentry
   ↓
🚀 LAUNCH                                   — gated on Vercel Hobby → Pro (Hobby forbids commercial use)
   ↓
Phase 2: Smart Money UI + earnings calendar + watchlists + alerts + FMP
```

**A through F are built, live and audited.** Remaining build is **G and H**. Layer F closed on
2026-08-02 when its audit finished (F-A1…F-A6, nine findings, all fixed); nothing is open against
it. Exactly one `← NOW` marker should ever exist in this diagram; two were present on 2026-08-02
(Layer C's was stale) and that is what this section is for.

---

**End of roadmap.md.**
