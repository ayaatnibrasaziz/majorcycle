# Roadmap

> **Purpose:** Defines what is in scope for launch, in what order it gets built, how we know it's done, and what's explicitly deferred. Read this before starting any new task. If a task isn't in the current phase, **stop and ask**.
>
> See also: `CLAUDE.md`, `architecture.md`.

---

## 0. Phase Definitions

- **Phase 0** — Setup. Accounts, repo scaffolding, foundational docs. ✅ **COMPLETE**
- **Phase 1** — Launch. Everything currently in `/reference/original-design.html` minus Smart Money Activity, plus auth, payments, static content pages. ⬅️ **YOU ARE HERE (Layer C)**
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
- [x] Supabase MCP (project: Stock Project)
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
- [x] Build universe CSVs: `sp500.csv`, `asx200.csv`, `tsx60.csv` (~720 tickers total)
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
15. [x] **Ownership structure** — insider/institutional/public donut + colour legend + holders table, with working hover tooltips on all stat rows. `OwnershipStructure.tsx`.
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

**→ Layer C complete.** Next: Layer D (Run Analysis tab).

### Layer D: Run Analysis Tab (target: 1 week)

Goal: Users can upload tickers (or pick from universe), run analysis with presets/custom, get scored results.

- [ ] **Preset selector** — Short / Medium / Long / Custom segmented control
  - [x] **Horizon selector on the Browse page (`/stocks`), NOT the detail page** — the user picks a Major Cycle horizon **before** opening a stock; the choice is carried into the opened stock via a `?preset=` query param, and the Stock Detail page honours it (default **Medium**). **No selector/option on the Stock Detail page itself** (explicit owner decision — they did not want it there). Short / Medium / Long shipped in S4-follow-up (cycle path already supports those three); **Custom deferred to Layer D** (needs the custom-params panel + `/api/cycle` accepting explicit pullback/profit/lookback). Beginner-framed label + tooltip. The cycle cache is already keyed per ticker **and** preset, so each horizon caches independently. *(Decision + initial Short/Medium/Long build with owner, 2026-06-04.)*
- [ ] **Custom params panel** — three inputs with validation
- [ ] **Ticker upload zone** — drag-drop + click-to-upload CSV
- [ ] **Manual ticker entry** — paste/type tickers, autocomplete via `/api/search`
- [ ] **Run button** — calls `/api/analyze`, shows progress
- [ ] **Loading state** — skeleton results table during processing
- [ ] **Universe expansion handler** — new tickers get fetched via `/api/fetch-ticker`
- [ ] **Last Analysis card** — shows previous run, "Re-run" button
- [ ] **Error handling** — partial failures listed in `unavailable` array

**Verification:**
- Run with 50 tickers using each preset — results match Python script output
- Custom params validate correctly (negative pullback, positive profit, integer lookback)
- Universe expansion works: unknown ticker added on the fly
- All edge cases (empty list, duplicate tickers, invalid tickers) handled gracefully

### Layer E: Results Tab (target: 4-5 days)

Goal: The ranked Results view from reference HTML, fully functional.

- [ ] **Analyst Briefing card** — summary callout at top
- [ ] **Provenance bar** — data source + run timestamp
- [ ] **Opportunity Map** — Health vs Valuation bubble chart
- [ ] **Sortable / filterable / searchable results table** — all view modes (Verdict, Major Cycle, Identity, etc.)
- [ ] **Column groups** — toggleable group headers
- [ ] **Tier badge column** — clickable to filter by tier
- [ ] **Click-to-detail** — clicking a row opens that stock's detail page
- [ ] **Empty states** — "no analysis run yet" + "no results match filters"
- [ ] **Export to CSV** — download current results

**Verification:**
- All filters and sorts work correctly
- Bubble chart click navigation works
- Table is performant at 500 rows
- Mobile: table collapses to cards

### Layer F: Static Pages + Subscription (target: 1 week)

Goal: All non-app pages live, payment flow works end-to-end.

- [ ] `/methodology` — long-form content explaining Major Cycle (auto-generated draft, owner edits)
- [ ] `/disclaimer` — full disclaimer page (ASIC-compliant template)
- [ ] `/terms` — terms of service
- [ ] `/privacy` — privacy policy
- [ ] `/contact` — simple contact form (email via Resend)
- [ ] `/pricing` — monthly/annual plans, region-aware currency
- [ ] `/account` — profile, subscription status, cancel/upgrade
- [ ] Stripe Checkout integration
- [ ] Stripe webhook handler with all subscription events
- [ ] 3-day grace period flow on payment failure
- [ ] Trial-ending email reminders (day 5, day 7)

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
- [ ] Backup of universe CSVs in repo
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
⬅️ Phase 1 Layer C: Stock Detail Tab               ← NOW
   ↓
   Phase 1 Layer D: Run Analysis Tab
   ↓
   Phase 1 Layer E: Results Tab
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
