# Roadmap

> **Purpose:** Defines what is in scope for launch, in what order it gets built, how we know it's done, and what's explicitly deferred. Read this before starting any new task. If a task isn't in the current phase, **stop and ask**.
>
> See also: `CLAUDE.md`, `architecture.md`.

---

## 0. Phase Definitions

- **Phase 0** — Setup. Accounts, repo scaffolding, foundational docs. ✅ **COMPLETE**
- **Phase 1** — Launch. Everything currently in `/reference/original-design.html` minus Smart Money Activity, plus auth, payments, static content pages. ⬅️ **YOU ARE HERE — Layers A–F all built, merged, live and audited. Layer G is in its last stretch, all of it inside PR #89, deliberately unmerged until the layer is finished.** Done: **G1** SEO plumbing · **G2** design foundations · **G3** public chrome · **G3.5** the auth net · **G3.7** the legal documents (owner-accepted 2026-08-13; their TEXT is still `BASELINE CONTENT` awaiting professional review before wide launch) · the **legal compliance audit**, all 7 findings applied · **G3.8** the landing page rebuilt to the approved storyboard and `/methodology` folded into it · **G3.9** the render-mode fix (every public page now prerendered) · **G4** the twelve-article `/learn` library, **all three topics read through and approved by the owner** (2026-08-21/22) · **G5** Lighthouse, accessibility, structured data and the config review · **G6** the colour review (the ink layer, two rating colours, three faded-text defects, and the reference HTML demoted from contract to mock-up). · **G7** the CSP flip — enforcing at last, with a per-request nonce wherever a session lives. **Remaining in Layer G, as of 2026-08-29:** (1) ~~`/articles`~~ — **BUILT 2026-08-29**: `/articles` (the approved direction A) and `/articles/[slug]` (reusing `ArticleDoc`), the first article ported, 15 new Playwright tests, and both routes prerendered. ⚠️ **UPDATED 2026-08-30 — the remaining four articles are written, owner-approved and WIRED UP**, so the section now carries five pieces: the opening measurement, a recovery study, and one ranked piece per market, all sharing one as-at date (27 August 2026) and one frozen input file. "Coming next" is down to one row and the two it lost were both kept. The lead is now **declared** (`FEATURED_SLUG`) rather than "whichever is newest" — owner: *"keep the featured article as is"* — which is also structurally right, because the lead card is the only place a figure is drawn and only the first piece has one. ⚠️ **Wiring them exposed a defect in the article ALREADY SHIPPED**: a bare `td` selector in `globals.css`, written for the signed-in screener, was setting every article data cell to **11.5px mono — under the public site's own 12px reading floor** — beside a row header at 13px. Invisible for the section's whole life because the first article has no text columns for the inherited `nowrap` to break. ⚠️ **And the number audit the owner asked for found something much larger than the articles**: our stored prices were never re-adjusted for dividends, so every drawdown on the site read up to two points too deep (see `Stale prices + dead tickers` above and `architecture.md` §4a). Fixed at source, the whole universe re-pulled, and **81 of the 464 asserted figures moved** — the articles were re-derived from the corrected data before the owner's review, and the "our prices lag" disclosure was deleted from all four fact-check sheets because there is no longer anything to disclose. ✅ **THE OWNER READ ALL FIVE AND APPROVED THEM, 2026-08-30**, subject to three fixes, all applied: the last column of each ranked table **right-aligned** so the table has one clean right edge; the Canadian table's columns **re-allocated** after *"it looks very squished"*; and the title corrected to **S&P/TSX 60**, which the article's own body already used nine times against five. ⚠️ Two of the three were invisible to every guard in the suite, because **a cramped column and a ragged edge are not errors** — the table renders, scrolls, clips nothing and passes everything. Only a human reading the page found them. Both are now asserted, on the rendered line count and the computed alignment respectively. **This item is CLOSED.** The plan and the design were settled on 2026-08-26. ⚠️ **Two previously "locked" decisions changed on 2026-08-26 and both came from the owner.** The **weekly cadence is dropped** (*"the articles doesn't need to be per week"*) — publish when there is something worth publishing; nothing becomes automated, which is the half that keeps us outside Google's scaled-content policy. And the section is **not one genre**: it carries measurements, market commentary *and* how-to pieces, so the design has to hold all three. Settled with it: Australia leads every piece with the US and Canada inside it as the comparison; `/articles/<topic-slug>` with **no date in the path**; four articles in the first 30 days, limited by the owner's review time rather than drafting; and the workflow is I draft → I fact-check → **I hand over 8–10 spot-checks with public links** → owner cross-checks → owner publishes. That last part solves the wrinkle flagged on 2026-08-25: our own figures have no URL to cite, and the answer is not to link every number but to publish the method and hand over ten checks a human can actually do. ⚠️ **The running order changed because the site is DARK** — `majorcycle.com` still serves the login page, so nothing written now can be indexed and an event piece written today is worthless by the time we launch. **Evergreen first; event-driven once live.** ⚠️ **And the competitors' pattern is the wrong one for us**: Simply Wall St and Motley Fool AU both run a flat list with no featured item and a thumbnail per row, which is right at 40 articles a day and reads as abandoned at four a month — the same trap `/learn` documented. The index is therefore a **featured article + list**, with numbers rather than pictures doing the work, and the featured block **reuses the landing page's analyst briefing components** rather than resembling them (owner's call, verified identical in the browser). Direction A of three drawn in `claude.ai/code/artifact/fd8cbcdc`; B and C deleted. **The article page itself needs no design** — the live Learn pages already show it, so `/articles/[slug]` reuses `ArticleDoc` and `LegalNotice`. **Next session: the owner reviews the article and the index, gives feedback, then we build.** The 2026-08-25 storyboard (`claude.ai/code/artifact/24903b9d`) drew the OLD weekly-note template and is superseded — it carries a banner saying so, because an artifact that looks approved is exactly how a stale design gets built (CLAUDE.md 11j). (2) ~~a **bundle-size audit** — unused dependencies, never done~~ ✅ **DONE 2026-08-30: nothing to remove.** All 30 declared packages (17 runtime, 13 dev) are genuinely used. ⚠️ The probe was proven able to fail before its result was believed — a fake package added to `package.json` was correctly reported unused, and `package.json` restored unchanged; a clean sweep from an unproven probe is what a broken probe also returns (CLAUDE.md 11p). ⚠️ It deliberately searches config files, workflows and `scripts` as well as imports, because four kinds of real usage are invisible to an import grep — subpath imports, PostCSS/ESLint/Tailwind plugin strings, CLI binaries (`playwright`, `lighthouse`, `esbuild`, `tsc`), and framework-implicit packages (`react-dom`, `@types/*`) — and each would have produced a confident false 'unused' on something load-bearing. The *shipped* half of bundle size is separately covered by `check:page-weight`, already ratcheted 1400 → 1250 → 1150 KB. Then (3) finishing the Layer G audit before merge — **which, as of 2026-08-30, is the ONLY thing left in Layer G**: items (1) and (2) are both closed. ⚠️ **The ticker page's 84 → 90 is no longer on this list, and it was not dropped — it is BLOCKED.** Attempted 2026-08-24: `/api/benchmarks` took a third off the document with **no score movement** (F-019); splitting hydration made it **worse** and was reverted (F-020); and measuring the deployed preview — to test the theory that the local number was unfairly penalised by Australia→`us-east-1` latency — returned **64**, disproving it (F-021). Neither available measurement is trustworthy, and no external lab tool can reach a page behind sign-in. It waits on **real-user monitoring, which the owner deferred on 2026-08-24**; the merge-gate row stays red. The byte counts, which ARE reliable, improved twice and are ratcheted into `check:page-weight`. **Audit progress:** step zero, Layers 0, 1, 2, 3 (the wire sweep — 50 checks, clean) and 3b (the platform sweep) are done, and **F-024 + F-025 were both applied and guarded on 2026-08-25** (Playwright 597 → **617**). F-024 revoked `anon`'s write grants on `profiles` — it had held `UPDATE`/`INSERT`/`DELETE` on all 20 columns for a year, blocked only by row-level security, and the fix's real value is that the refusal became *visible* (`200`/0 rows → `permission denied`), which is what made it testable at all. F-025 ties `PRICE_TABLE` to Stripe's actual prices, **for test mode only** — CI holds no live key, so the six live figures are re-read by hand at merge, which is now a row in the merge-gate table rather than a memory. **A new finding came out of F-024: F-026** — the same Supabase default grants sit on all 12 tables and `authenticated` still holds `DELETE`/`TRUNCATE`; unreachable today, recorded rather than fixed because the approved scope was `anon` on `profiles`. **Owner's call.** **Layer 4 — the data sweep — is also done (2026-08-25)**, against the live database and the rendered page. The bulk is clean: the three nightly invariants pass and were proven able to fail (with a control showing the coverage one is a proportion), all seven reporting currencies are present and the "figures reported in…" note was verified **on screen** for USD-in-AUD, USD-in-CAD, NZD, EUR, SGD and TWD with two same-currency controls showing none — the check that once shipped inert. Zero weekend bars across all 6.6M price rows. 🟠 **The one serious finding, F-027: the ASX listings source has returned NOTHING for a month, and the failure wears an HTTP 200** — the ASX now sits behind bot protection that answers 200 with an HTML rejection page, the parser finds no rows, and the nightly job treats an empty pull as a soft failure, so the workflow goes green and nothing alerts. The cost is in the owner's own market: any ASX ticker outside the 250 already covered is refused as "not a known listed stock". **Owner chose "fix both" and it shipped the same day.** New source live (AU listings 1,981 → 1,999 active), and the alarm wired all the way through — which mattered, because the obvious fix would have done nothing: the workflow step runs `continue-on-error`, so a non-zero exit is *recorded and ignored*. There were three stacked silences, not two. ⚠️ **And a dry run before writing anything caught that the fix would have caused a worse bug**: the replacement source is not a superset, and the delisting sweep would have marked 158 live companies "not a known listing", including Qube Holdings (ASX 200) which we actively cover. The sweep now refuses to retire more than 2% of a market in one night — leaving a delisted company in the menu costs one failed request; removing a live one tells a customer their real stock does not exist. **All four owner decisions were answered the same day and applied:** **F-028** TSX Venture is on (Canada's requestable menu 1,235 → **2,692**, and the `.V` code path finally has data behind it); **F-029** insider values on **Stock Detail** now carry the stock's own currency — owner explicitly kept the Results table's bare `$` as it is — and a *second* hard-coded `$` turned up in the same component's chart tooltip while fixing the first; **F-026** both public database roles now hold exactly the verbs their row policies allow and nothing on the nine server-only tables, which removes `TRUNCATE`, the one verb row-level security never governed. ⚠️ **A correction:** I first reported that insider values "may not be in the stock's currency", generalising from BHP. Measured across **4,539** AU and CA transactions, the implied price sits inside the stock's own 52-week range **94.7%** and **97.0%** of the time — the local currency is right for nearly all of them, and BHP is the dual-listed exception. That correction is what made labelling the right fix rather than stripping the figure. **F-030** (five index members are not fetchable companies) remains recorded, no action. **Next: 5a (my visual sweep), then 5b (the owner's judgement sweep).** **At merge, and only the owner can do them:** flip the apex→`www` redirect from **307 to 308** (re-measured 2026-08-23, still 307 — the highest-value SEO item in the layer), and submit the sitemap in Search Console *after* deploy (`/sitemap.xml` still answers 307 on production, and submitting a redirect teaches Google to distrust it). **One decision is genuinely still open:** whether to lift the public documents' 13px body size — it moves the legal pages, the auth cards and the articles together, so no page opts out alone. 🔴 **Two live defects were reported by the OWNER on 2026-08-28, and both were in merged production code with a green suite.** **F-031:** a failed `profiles` read was presented to the customer as *"you have never agreed"*, showing the first-login disclaimer gate to an account that acknowledged in June — and the gate's only button then **overwrote the June date**, destroying a compliance record under #23/#24. Fixed in three places (unreadable is now its own state; the gate needs the row to have been read; the acknowledgement is write-once), with entitlement still failing CLOSED as the control. The owner's date was reconstructed to the account's creation instant and is documented as a reconstruction, not a measurement. **F-032:** the nightly refresh **deleted** `market_cap` for 15 of 863 companies because yfinance's `info` omitted the key that night — a null is not an error, so nothing went red, and the loss was silent: those companies drop out of every size-ranked cohort and lose `fcf_yield_pct` with them. It surfaced three days later only because the article's verification workbook produced a figure that would not reproduce. ⚠️ **The identical rule was already in that function ten lines below, guarding `news`** — 11c-iv at its shortest possible range. Fixed at the source (`fast_info` fallback), in the data (a nightly invariant, whose floor had to be re-tuned from 2% to 0.5% because the real event was 1.7% and the first threshold would have passed it) — and at the write, **where the owner reversed my first fix on 2026-08-29 and was right to.** I had the writer OMIT the column so the stored figure survived a bad night; that also survives a bad MONTH, serving a months-old market cap as though it were current. *"I don't want to manipulate anything. Just show what the provider give to us."* **Of two ways to be wrong, prefer the visible one:** a null is an empty cell a reader can see and an alarm can fire on; a stale number is a plausible one nobody can see. The writer now passes the provider's answer through, null included, and the fallback plus the invariant are what make that safe. ⚠️ **The incident then recurred on 2026-08-28 — 13 companies blanked — because a scheduled workflow checks out the DEFAULT branch and the fix is on `feat/layer-g`** (14g). Both endpoints carried a cap for all 13 when checked by hand, which is the evidence the omission is transient and per-run rather than per-company. All repaired; **they revert nightly until merge.** ✅ **2026-08-30, later the same day — the owner asked for the stale-price / dead-ticker work ("Item 4") and for corporate actions to be split by kind, and both are BUILT**: `check_stale_tickers.py` (three-source delisting test, session-relative staleness, a 2%-per-market retire cap), a second retry pass in `daily_refresh.run`, `stocks.is_active` (marked, never deleted) wired through the cron universe, the screener and the peer medians, a `dividend_events` table separate from `split_events`, and one step + one gate in each nightly workflow so there is still exactly one email. Migration applied to the live database and verified (871 active, 0 inactive, new table empty, RLS on, no public grants). Playwright unchanged; pytest 230. **Three things building it found that the plan did not**: the Stooq fallback is measured **dead** in every market and widening it as planned would have re-created the dividend defect; my first two staleness designs were each wrong in a way unit tests could not see, the second producing a **247-ticker false alarm on the ASX** that only the live database exposed; and a documented claim in the plan — *"BK survives the three-source test"* — is **no longer true**, with the real evidence for unanimity turning out to be three live S&P 500 companies (`EA`, `EQR`, `AVB`) that both reference tables mark inactive. Two open items were added for the owner (replace the Stooq source? what to do with 120 `split_events` rows the dividend catch-up created?). ⛔ `/about` and `/glossary` are **dropped** (owner, 2026-08-22) — About may return later, the glossary is permanently cancelled; `llms.txt` dropped on the same day.
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
      tracked launch decision, carried in the audit doc.
      ✅ **Flipped 2026-08-23 (Layer G, G7)** — enforcing, with a per-request nonce on the
      routes that already render per request. The policy now lives in `proxy.ts` / `lib/csp.ts`,
      not `next.config.ts`.
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

### Stale prices + dead tickers — 2026-08-30 ✅ BUILT

> Designed with the owner on 2026-08-30 while the dividend re-adjustment was being fixed,
> and **built the same day** on the owner's instruction ("Do Item 4"). The dividend fix
> (`_recent_dividends`, `--repull-prices`) is a separate thing — it corrects prices we
> HAVE; this is about prices we stopped getting.
>
> **Where it lives:** `analytics/cron/check_stale_tickers.py` (new),
> `daily_refresh.run` (the second pass), `_load_universe` (skips retired),
> `web/lib/universe.server.ts` + `medians.server.ts` (leave the screener),
> both nightly workflows (one step, one gate, one email),
> `supabase/migrations/20260830000000_dividend_events_and_delisting.sql`,
> `analytics/tests/test_stale_tickers.py` (20 tests, six sabotages).
> Documented in `architecture.md` §4b.

**How it surfaced.** I reported that the 28 August refresh had "stopped halfway, 260
companies missing". ⚠️ **That was wrong** — the run log says `617 succeeded, 3 failed`, and
what I had measured was a timing accident: I looked before the American session had been
stored. Checking properly, by asking every one of the 871 tickers for its newest bar, found
a real and smaller problem: **11 companies are stale, one by four months**, and every night
the job logs them as failed and exits 0.

**The header shows `stocks.updated_at` — when we last RAN, not the date of the bar shown.**
So Equity Residential reads a green *"Updated Aug 30"* above a price from **21 August**.

⚠️ **I proposed changing this to the price's own date and the owner rejected it, with a
better argument than mine (2026-08-30).** The badge says the *snapshot* was generated then,
and that is **true** — we did run, the provider simply returned no newer bar. It is also not
only about price: fundamentals are refreshed in the same pass and may genuinely have moved
while the price did not, so the price's date would be the wrong label for the thing being
stamped. Owner's words: *"We are being honest here as we try to do it and nothing changed in
terms of price; however, the financials might change… it's not that important if some of
them are wrong due to staleness. Our provider is slow, not us."*

**Decision: the header stays exactly as it is.** Recorded because the reasoning is the
valuable part — my framing ("the page claims the stale price is current") was an
overstatement, and the distinction that settles it is *what the timestamp is a claim about*.
Do not re-propose this without new evidence that a reader is actually misled.

**⚠️ "Stale" does NOT mean "delisted", and the owner was right to insist on checking.**
Measured against yfinance, the `listings` directory and `index_membership`:

| | n | Which |
|---|---|---|
| Gone from all three sources | 3 | Insignia Financial, Coterra, Australian Unity Office |
| **Renamed — the company is alive** | 1 | `BK` → **`BNY`**, trading at $162.50 |
| Mixed signals | 1 | EchoStar — no quote, `listings.is_active=false`, still in the S&P 500 file |
| Still listed, the provider is not serving bars | 5 | Electronic Arts, Qube, Equity Residential, AvalonBay, Clearview |
| Not actually stale | 1 | Teck — our data was simply behind |

**⚠️ `BK` — THE CASE THAT MOTIVATED THE DESIGN.** *(Read the correction below before
citing this: the two other sources have since followed the rename, so BK no longer
survives the three-source test — correctly, and the real evidence for unanimity turned
out to be EA/EQR/AVB.)* Yahoo answers `404 Quote not found` for
Bank of New York Mellon — one of the largest banks in America — because it changed its
ticker. A symbol that has *never existed* returns the **identical** answer (verified with
`ZZQQ9`), so "the provider has no data" cannot tell *delisted* from *renamed* from *typo*.
Auto-deleting on that signal would have destroyed 54 years of history for a live S&P 500
company. We currently hold it **twice**: `BNY` 1973 → 28 Aug 2026 (current, already fetched
by the index-membership job), and `BK` 1972 → 17 Jul 2026 (frozen, still on the site).

**The agreed design — four parts (one of the original five was rejected). ALL FOUR BUILT.**

1. **Retry properly.** ✅ **Confirmed by the owner, 2026-08-30**, after they had already
   approved it once — worth re-stating because the same message that rejected part 4 read as
   though it might drop this too, and the reasoning in it was entirely about the DISPLAY. A
   failed price fetch is retried, and the **Stooq fallback already sitting in
   `yfinance_provider.py`** is actually used for it instead of being decorative.
   ⚠️ **Evidence it is worth having, from that same evening's re-pull:** `ASK.AX` failed once
   in the catch-up and is otherwise perfectly current — a transient miss, indistinguishable
   from a delisting to anything that only looks at one night. It would also have quietly put
   that company's history on a mixed adjustment basis had the run been the nightly one.
2. **Decide dead from THREE sources agreeing** — no quote from the provider, absent from the
   exchange symbol directory, absent from every index we track. All three are already
   fetched nightly, so this needs no new source and **no waiting period**. One source alone
   is what would have killed `BK`.
3. **Mark, never delete.** ⚠️ Once a ticker 404s its history cannot be re-fetched from
   anywhere — four delisted tickers already cost 30,784 unrecoverable bars (`project_asx_friday_date_bug`).
   A marked company stops being refreshed, leaves the screener, and keeps its data.
4. ~~**Show the price's own date.**~~ ❌ **REJECTED by the owner, 2026-08-30** — see above.
   The header keeps `updated_at`. Nothing to build.
5. **ONE email.** ⚠️ There is **no app-sent nightly email to merge into** — the Resend alert
   was proven dead and removed on 2026-08-06, and GitHub's failed-workflow notification is
   the only channel. It fires **once per failed run regardless of how many steps failed**,
   so the staleness check becomes one more step in the same workflow: one email when
   something is wrong, none when it is not, no new service, no cost.

**Open, for the owner** (unchanged by the build — the mechanism exists, these are
judgement calls it deliberately does not make):

- **Whether to replace the Stooq fallback source** now that it is measured dead.
~~**Whether `CTRA` (Coterra) is really gone**~~ — ✅ **CHECKED AGAINST THE OUTSIDE WORLD,
2026-08-30, and every stale name turned out to be explainable.** The owner asked for this
to be verified rather than assumed, and it was worth doing: **all five retirement
candidates are real corporate events, and three are renames or mergers with a LIVE
successor** — the exact shape that makes a delisting sweep dangerous.

| Ticker | What actually happened | Our last bar | Sweep verdict | Right? |
|---|---|---|---|---|
| `CTRA` | Merged into **Devon Energy**, delisted from NYSE **7 May 2026** | 2026-05-07 | retire | ✅ our last bar IS the delisting date |
| `BK` | Renamed **BNY** | 2026-07-17 | retire | ✅ ticker gone |
| `SATS` | Renamed **ECHO**, 24 Jun 2026 | 2026-07-17 | retire | ✅ ticker gone |
| `EA` | Taken private ($55bn PIF/Silver Lake/Affinity), delisted **4 Aug 2026** | 2026-08-10 | **keep** | ⚠️ see below |
| `EQR` / `AVB` | Merged with each other, closed ~17 Aug 2026; EQR survives | 21 / 24 Aug | keep | ✅ still quoted, in transition |

**⚠️ The check that mattered was not "is it dead?" but "do we still cover the company?"**
A rename destroys nothing if the successor is in the universe, and every one of them is,
current to 28 August: **DVN, ECHO, BNY and EQR are all held and refreshing.** No customer
loses a company. That happens automatically because each successor is an S&P 500 member
and the nightly index-membership job fetches constituents we do not yet have.

**⚠️ `EA` is the informative failure, and it fails in the RIGHT direction.** It was
genuinely delisted on 4 August, yet yfinance still answers with a quote — our stored
history even runs to 10 August, *after* the delisting. So the provider serves phantom data
for a company that no longer trades, and the sweep therefore **keeps** EA rather than
retiring it. That is the conservative error the unanimity rule exists to produce: we hold
a dead ticker one cycle too long instead of destroying a live one. It also shows the
three-source test cannot be tightened by trusting the provider more.

**⚠️ AND A DOCUMENTED CLAIM IN THIS SECTION TURNED OUT TO BE FALSE — corrected.** The
note above said *"`BK` IS THE CASE THAT DECIDES THE DESIGN"* because the exchange
directory and the S&P 500 file still carried it while Yahoo did not. **They no longer
do.** Re-measured on the live database while dry-running the sweep: `BK` is absent from
`listings` and absent from `index_membership`, both of which now carry `BNY` instead —
the rename has propagated. So all three sources agree, and the sweep retires `BK`, which
is **correct**: the ticker genuinely does not trade. Nothing is lost — its 13,485 bars
are kept and we separately hold `BNY` complete, 13,444 bars from 1973 to current.

**The rule is right; the reason given for it was wrong**, and the real evidence is
stronger: **`EA`, `EQR` and `AVB` — three trading S&P 500 companies — are
`is_active = false` in `listings` AND `false` in `index_membership`.** Two of three
sources call them dead. Only the live quote keeps them, so a two-of-three rule would have
retired three live large caps on its first night. That is why the test is unanimous. The
protection for the BK case is part 3 (mark, never delete), not part 2 — attributing it to
the three-source test is CLAUDE.md 14f, a mechanism that is present but not the one
responsible.

**⚠️ WHAT THE FIRST REAL RUN WILL DO — dry-run against the live database, 2026-08-30,
nothing written.** 871 tickers checked in 347 seconds; **9 stale (AU 3 of 250 = 1.2%,
US 6 of 538 = 1.1%)**, both under the 5% alarm line, so the run is **green** and simply
lists them:

| Ticker | Newest bar | Behind | Verdict |
|---|---|---|---|
| `IFL.AX` Insignia Financial | 2026-04-29 | 60 sessions | **retire** — gone from all three |
| `AOF.AX` Australian Unity Office | 2026-06-10 | 56 | **retire** — gone from all three |
| `CTRA` Coterra | 2026-05-07 | 60 | **retire** — gone from all three (see above) |
| `SATS` EchoStar | 2026-07-17 | 30 | **retire** — gone from all three |
| `BK` → BNY | 2026-07-17 | 30 | **retire** — renamed; `BNY` held complete |
| `QUB.AX` Qube | 2026-08-18 | 7 | **keep** — still quoted + listed |
| `EA` | 2026-08-10 | 14 | **keep** — quote only |
| `EQR` | 2026-08-21 | 5 | **keep** — quote only |
| `AVB` | 2026-08-24 | 4 | **keep** — quote only |

5 retirements against a US cap of 10 and an AU cap of 5, so the safety cap is not hit.
⚠️ `QUB.AX` is the ASX 200 name the F-027 dry run nearly retired; it survives here for
the right reason, from a different mechanism, which is the check worth keeping.

**⚠️ WHAT BUILDING IT FOUND — four things the plan did not anticipate.**

**(1) The Stooq fallback the plan wanted to "actually use" is dead, and widening it would
have been a defect.** Part 1 read *"the Stooq fallback already sitting in
`yfinance_provider.py` is actually used for it instead of being decorative."* Driven
through our own `_download_stooq`, it returns None for **every ticker in every market**,
AAPL included: Stooq now answers **404 with no User-Agent — which is exactly what our
code sends — and HTTP 200 with a 796-byte "this site requires JavaScript" challenge page
with one.** F-027's shape in a second source. ⚠️ **And measuring changed the design.** The
plan assumed the fix was to let it fire on the nightly incremental path; it is the
opposite. Stooq's bars are not on Yahoo's `auto_adjust` basis, so splicing them into a
Yahoo series would put one company's history on **two adjustment bases** — the exact
defect fixed hours earlier (11ae), deliberately reintroduced. It stays restricted to full
pulls, now logs the difference between "the source refused us" and "this ticker isn't on
Stooq", and the real answer to a transient miss is the second pass. **Open for the owner:
whether to replace the fallback source at all.** One stated limit: measured from one
machine in Australia, and a block can be IP-dependent, so GitHub's US runners may see
something else.

**(2) My first calendar design was blind in the only case that matters.** Ranking
staleness needs a session calendar, and the first version derived one from the newest-bar
dates of the tickers being checked. With 869 companies current and one straggler, that
produces exactly **two** dates, so the straggler ranks *one session behind* and passes.
The check would have been blindest in the ordinary case. Fixed by reading the market's
benchmark index (`^GSPC`/`^AXJO`/`^GSPTSE`), which has a bar for every session.

**(3) And the fix had its own bug, which only LIVE DATA found — a whole-market false
alarm.** Ranking by looking each date up in the calendar reported **247 ASX stocks as "60
sessions behind"** because they hold a bar for 28 August while `^AXJO` reaches only the
27th: being one day *more* current than the benchmark scored as maximally stale. Every
unit test passed. It is now asked as *"how many sessions are strictly newer than this
bar?"*, which needs no special case and fails in the safe direction — a lagging benchmark
makes the check lenient, never falsely alarming. **Two tests were added for it, and both
go red when the old ranking is put back.**

**(5) ⚠️ AND RUNNING THE PIPELINE FOR REAL CAUGHT A DEFECT MY OWN UNIT TESTS HAD
BLESSED.** The retry pass carries a time-budget guard: skip the second pass if too much
failed, because re-fetching hundreds of tickers cannot fit in the workflow's remaining
minutes and the job would die mid-write. I expressed it purely as a **share** (>25% of the
run) — and wrote a unit test asserting that a one-ticker run therefore gets no retry, with
a paragraph explaining why that was fine. Driving the real pipeline with
`--only AAPL,ZZQQ9` showed it is not: one failure in two is 50%, so the guard **refused to
retry a single ticker** — the cheapest possible retry, on exactly the kind of hand-run
somebody is sitting and watching. **A time budget depends on how many tickers must be
re-fetched, not on what fraction of the run they were.** Fixed with an absolute floor
(`_RETRY_MIN_ALWAYS = 25`); the share still governs above it. ⚠️ The lesson is not the
threshold, it is that **a unit test written by the same person who wrote the rule can only
confirm the rule, never the reasoning behind it** — the test was green, well-commented and
wrong, and only an end-to-end run disagreed.

**(4) ⚠️ A LIVE FINDING NOT IN THIS PLAN — found, reported, and CLOSED the same day on
the owner's instruction.** `split_events` held **8 rows** until 2026-08-30, because only
splits inside the nightly one-month window were ever detected. `--repull-prices` asked for
`period="max"` on all 871 tickers, so every split any company has ever had — back to
1962 — arrived as a fresh detection: **1,754 rows in one evening.** 1,634 verified clean
immediately. **120 did not**, and would have re-pulled a whole company history every night
for 30 days before flipping to `failed`. 116 of the 120 have ratios between 0.79 and 1.29,
where `_verify_split_resolved`'s cliff tolerance overlaps ordinary daily volatility — the
same false-positive mechanism `_MIN_SPLIT_DEVIATION` guards against, one notch above its
0.10 threshold. Nothing was wrong with the prices; the cost was needless work and 120 rows
that would read as "broken" in a month.

**Owner: *"could you please manually delete all of them?"* — done, 2026-08-30.** All
**1,754** rows removed (120 pending + 1,634 resolved), scoped by `detected_at::date =
'2026-08-30'`. ⚠️ **Scoped by detection date, not by status or ratio**, because one of the
8 genuine pre-existing rows is `resolved` exactly like 1,634 of the deleted ones — status
could not have separated them. The 8 survivors are every case the docs name: `DD`, `FDX`,
`MNST`, `HON`, `KLAC`, `CRWD`, `AVB`, `PDI.AX`. Backed up first to
`reference/split-events-backup-2026-08-30.json` (776 KB) even though these are derived
rows a re-pull would regenerate — "probably regenerable" is not "reversible". Verified
after: 8 rows remain, **0 pending**, `price_bars` unchanged at 6,605,410 and `stocks` at
871 active — the control being that deleting a *log* must leave the data it describes
untouched. ⚠️ Safe to delete outright because **no deleted row's `split_date` falls inside
the nightly detection window** — the newest is 2026-05-08, 114 days back — so nothing
re-appears tonight.

**And the CAUSE is now closed, which the deletion alone would not have done.** A second
`--repull-prices` would have recreated all 1,754 and the same 120 stuck rows. The dividend
side already had the right rule ("only nightly detections are recorded"); splits did not,
and that asymmetry was the whole defect. Both now consume one named, tested predicate,
`_should_record_corporate_actions(first_fetch, repull_prices)` — CLAUDE.md 11c, one rule
in one place with both consumers actually consuming it. Nothing is lost by skipping: a
`max` pull is already fully re-adjusted, so there is no discontinuity to record, and a
carried-over `pending` split is still verified during a re-pull because `pending` is
loaded from the table rather than from the fetched window. Guarded by four tests in
`test_dividend_readjust.py`, with **each half of the condition broken separately** and
each failing its own test. ⚠️ The underlying `_verify_split_resolved` tolerance is
**untouched** — it is a change to a working pipeline that nothing now depends on, since no
historical split is ever recorded again.

**⚠️ What this section is NOT.** The dividend re-adjustment (`_recent_dividends`,
`--repull-prices`) was designed and shipped in the same conversation and is **already
built** — see `architecture.md` §4a and CLAUDE.md 11ae. It corrects prices we HAVE. Nothing
in this section is written yet; it is about prices we stopped RECEIVING. Two neighbouring
problems with the same symptom (a wrong-looking number that nothing flags) and completely
different fixes.

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
> week with an archive. ⚠️ **That last decision was re-scoped twice** — see G8 below. On
> 2026-08-25 it became `/articles` with **no fixed template**, aimed at search visibility;
> on **2026-08-26 the owner dropped the weekly cadence entirely** (*"the articles doesn't
> need to be per week"*) and widened the section from one genre to three — measurements,
> market commentary and how-to pieces. Its own section, one permanent page each, and
> **human-written, never automated** all still stand. **Audience = both, served in LAYERS not averaged** — this
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
> ⚠️ **The legal pages were rejected here and rebuilt in G3.7 below** — see that block
> rather than treating the description above as current. Measured cause, 2026-08-12: two
> deliberate type scales meeting with no transition — h1 **24 → 36px**, body **13 → 17px**,
> column **440 → 680px** between `/contact` and `/terms`.
>
> **Still to come in Layer G:** the approved landing page, removing `/methodology` (it
> becomes the `#how-it-works` anchor), and `/learn`. *(`/methodology` done 2026-08-13 —
> see G3.8 below. The landing page turned out to be far larger than this line implies.)*

> ### ✅ G3.5 (the auth net) — COMPLETE 2026-08-12. Owner-requested, still inside PR #89.
>
> G3's verification drove nine auth form edge cases **by hand** and reported them as
> passing. The owner's instruction: *everything must be checked by the automatic tests.*
> Correct — a manual pass expires with the next commit, and the plan they came from had
> already claimed the suite covered them when it did not.
>
> **Playwright 180 → 260 (+80), 0 skipped, 0 flaky, CI green on the exact SHA.** Three new
> files, all detailed in `architecture.md` §12(h): `auth-contracts.spec.ts` (pure, **38**),
> `auth-forms.spec.ts` (credential-free browser, **30**), `recovery-confinement.spec.ts`
> (throwaway account, **7**), plus 4 tests added to `auth.spec.ts` (**29**) and one page to
> `contrast.spec.ts` (**15**). Local and CI agree on the count.
>
> **Two real defects fell out of writing them**, both in `friendlyAuthError`, both shown
> to a real reader as raw Supabase English: `"…already BEEN registered"` does not contain
> `"already registered"`, and the 60-second reset cooldown says neither "rate limit" nor
> "too many". Fixed. **Every new guard was broken on purpose first** — the open-redirect
> guard, the `httpOnly` flag, the disabled-button state, both request counters (each
> observed returning 1, so `toBe(0)` is not vacuous) and the confinement itself.
>
> **Three of my own claims were wrong and corrected by running them:** a bare
> `[role="alert"]` also matches Next's route announcer (so `toHaveCount(1)` was asserting
> the announcer); asserting a rejected `?next=` is absent from `page.content()` is wrong
> because Next echoes the URL into the RSC payload — the right assertion is that no
> `href`/`action` carries it; and a `signIn` helper that does not wait races LoginForm's
> hard `window.location.assign`, so the caller's own `goto` is discarded.
>
> **✅ The dead-link notice — owner approved and built, same day.** `/auth/callback` and
> `/auth/confirm` had always redirected to `/login?error=…` and `LoginForm` had never
> read it, so an expired or already-used link landed the reader on a blank sign-in form.
> It now says: *"That link has expired or has already been used. Enter your email to get
> a new one."*
>
> - **Allow-listed codes; the provider's own words are never echoed.** Anyone can send a
>   target `…/login#error_description=Your+account+is+locked,+call+1-800-…`. React
>   escapes the markup so it is not XSS — which is exactly what makes it dangerous: a
>   stranger's sentence in our error styling on our sign-in page looks legitimate. Four
>   known codes map to our one sentence; everything else renders nothing.
> - **The HASH is read as well as the query string**, per Supabase's documented error
>   handling — GoTrue returns failures as URL fragments, which never reach the server, so
>   middleware and route handlers are structurally blind to them.
> - **The end-to-end test is the one that matters.** Nine tests supply the URL by hand and
>   all stayed green when `auth_confirm_failed` was renamed in the route; only the test
>   that drives a forged token through the real redirect caught it. Two halves can each be
>   perfect and never meet.
> - **It also closed a contrast blind spot.** The auth error banner had never been
>   measured by anything, because it does not exist in the DOM until something fails and a
>   page is only measured in the state it loads in. `/login?error=auth_confirm_failed` is
>   now in `contrast.spec.ts`'s FORM_PAGES — the first URL that renders the banner on load
>   — and washing its text out to #c9c9c9 makes the guard name it at 1.4:1, so it is
>   genuinely measured. Its real colours pass. ⚠️ `measure()`'s "did not stay put"
>   assertion compared a pathname against the whole path string and had to be fixed to
>   accept a query string; it was right to refuse rather than measure the wrong page.
>
> **Google sign-in on a Vercel preview — `Error 400: origin_mismatch`. NOT a code defect;
> the preview origin is not registered with Google (2026-08-12).**
>
> The owner clicked the button and Google answered *"Access blocked: Authorization Error …
> register the JavaScript origin in the Google Cloud Console. Error 400:
> origin_mismatch."* Google allows **no wildcards** in authorised JavaScript origins, and
> every Vercel preview is its own origin, so no preview will ever work until its exact
> origin is added by hand.
>
> 🔴 **THE VERIFICATION LESSON, and it is the valuable part.** I had reported the opposite
> an hour earlier — "the preview origin IS authorised" — on the evidence that the GSI
> button rendered from an `accounts.google.com` iframe with **no console error**. That
> inference is wrong: **`renderButton` never validates the origin.** It draws an iframe;
> Google checks the origin only when the popup opens, server-side. So the button renders
> perfectly on an unregistered origin and says nothing. **An absent error is not a
> passing check** — the same shape as `check_invariants()` reporting zero violations over
> a universe missing the field it reads (14g), and the reason this repo insists a guard be
> broken on purpose before it is trusted.
>
> It also explains One Tap: `prompt()` reported `skipped / "unknown_reason"`, which is
> FedCM masking what is almost certainly `unregistered_origin`. **Two symptoms, one
> cause** — and I had written them up as two unrelated tooling limits.
>
> ✅ **Google auth itself demonstrably works.** The owner's own account carries
> `app_metadata.providers: ["google"]`, i.e. it was created BY a Google sign-in — so the
> client ID, the Supabase Google provider and the token exchange are all sound.
>
> ✅ **This PR cannot have broken it.** Across `094f95a..HEAD`, every changed line in
> `GoogleSignIn.tsx` draws the **button** (`renderButton`, width clamp, `ResizeObserver`);
> not one touches `signInWithIdToken`, `initialize()`, the nonce, the callback or
> `signInWithOAuth`.
>
> ✅ **RESOLVED the same day — owner verified on the LIVE site: Google sign-in works, BOTH
> the button AND One Tap.** So `https://www.majorcycle.com` IS a registered JavaScript
> origin and the GSI `signInWithIdToken` path — not merely the redirect fallback —
> completes end to end in production. The failure is confined to Vercel **preview** origins,
> which are unregistered *by design*. Nothing to fix; optionally register a stable
> branch-alias origin if previews ever need to exercise Google sign-in (one entry per
> branch, and per-deployment URLs can never be covered).
>
> 🔴 **The click-through cannot be completed by tooling.** Google's chooser opens as a
> separate browser window outside the MCP tab group — not visible, not drivable. The owner
> has to click it, which is exactly how the wrong conclusion above got caught.
>
> ⚠️ **And the docs already knew half of it.** `layer-f-audit.md` recorded on **2026-07-08**
> that a "skipped" One Tap moment on the owner's device was *Google's post-dismissal
> cooldown, confirmed via the GIS moment API* — the same finding I re-derived from scratch
> today via `g_state` and FedCM. **Grep the audit docs before re-deriving a diagnosis.**
>
> ⚠️ **OPEN, dated, needs the owner — Supabase legacy API keys expire END OF 2026.** The
> docs now say the `anon` / `service_role` keys "will work until the end of 2026" and
> strongly encourage moving to publishable (`sb_publishable_…`) and secret (`sb_secret_…`)
> keys. We use the legacy pair (`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
> `SUPABASE_SERVICE_ROLE_KEY`) in Vercel, GitHub Actions and `.env.local`. Roughly four
> months of runway from 2026-08-12, and it is a dashboard + secrets rotation, not a code
> change. Do it deliberately, not on the deadline.
>
> ✅ **Confirmed correct against the current docs, not assumed:** `proxy.ts` calls
> `getClaims()`, which the Supabase Next.js guide now names as *the* method for protecting
> pages (local WebCrypto + cached JWKS verification), with no code between
> `createServerClient` and the call — which our file already states as a rule and obeys.
> Every route that acts on a user or their money (`/api/checkout`, `/api/portal`,
> `account/actions.ts`) uses `getUser()` instead, the live network check, which is the
> stricter side of the documented split. The Layer G plan had recorded `getClaims` as a
> deviation to justify; it is the recommendation.

> ### 🔨 G3.8 (commit group 2) — `/methodology` DONE, the landing page IN PROGRESS. 2026-08-13.
>
> **Done — `/methodology` is folded into the landing page** (`7e6fb4a`). The route is
> deleted and answers **308 → `/#how-it-works`**; its whole substance moved rather than
> being summarised away (the four measures, the five-tier legend still rendered with the
> real badge component, and "What MajorCycle is not"). Playwright **277 → 278**, reconciled
> as +4 new −3 for the page that no longer exists.
>
> ⚠️ **The ordering question the plan flagged is now SETTLED BY MEASUREMENT**, not by
> memory: Next's `redirects()` in `next.config.ts` fires **ahead of `proxy.ts`**. Proven on
> the wire against the production build, signed out — `HTTP/1.1 308` with
> `location: /#how-it-works`. Vercel's docs never state this plainly, and had it gone the
> other way every reader arriving from Google would have met a sign-in form.
>
> New guards, each broken on purpose first: a **retired-route section** in `check-seo.mjs`
> (6 breaks, 6 red — including "the old path is back in `PUBLIC_PAGES`", which would
> silently disable the redirect because the middleware matches first, and "a source file
> still links to it", which a working 308 makes *invisible*); **fragment awareness** in
> `public-chrome.spec.ts` (3 breaks — base path public, id exists, target carries
> `scroll-mt`); and `e2e/how-it-works.spec.ts` (4 tests, bounded on **both** sides per 11i).
>
> **In progress — the landing page, and it is much bigger than anyone had recorded.**
> The owner said on 2026-08-13 that `/` "doesn't look like the one I approved". Correct.
> ⚠️ **I first checked `layer-g-page-briefs.md` and reported a two-section gap; against the
> actual approved artifact — the landing page storyboard — it is TWELVE sections.** See
> CLAUDE.md **11j**: the roadmap's own G2 row said this was complete, and it was true about
> what it measured (SEO tags, gated routes) and silent about everything else, because **a
> missing section renders perfectly.**
>
> Missing: the real hero headline ("863 companies. Which ones are actually on sale?"), the
> Analyst Briefing, the stats band, the three-step "How a scan works", the ranked results
> table, both distribution bars, the fall-vs-deepest and recovery-vs-largest pairs, the
> "what this run is telling you" commentary, the Opportunity Map, the rating weights, the
> free-vs-paid columns, and the three "Before you use it" honesty blocks.
>
> **Owner decisions, 2026-08-13:** no screenshots — reuse the product's own components
> (`ResultsTable`, `OpportunityMap`) so the landing looks consistent with the terminal ·
> the run is **frozen and dated**, not nightly, because the page writes sentences *about*
> it · landing first, **`/learn` after**.
>
> ### ✅ COMPLETE 2026-08-15 — `8a25971` → `b2ea65b` → `4fce6cf`. Playwright 278 → **297**.
>
> All eight sections built and measured. Chrome comes from the *newer* "one design
> system" artifact (which settles the primary button as the navy gradient the site's
> `<Button variant="primary">` already is); content from the storyboard.
>
> **The Mag 7 generator ran, and its output contradicted the approved copy.** Four rate
> Constructive or better, not five; Tesla comes seventh, not sixth. Every figure the page
> states in words is now derived in `lib/mag7.ts` and asserted against the rows. See
> `architecture.md` §7.1 — regenerating that file is a **content** change.
>
> **Four defects found by measuring, none visible in review:** the bleed written in px
> against a 14px root (band hung 2.5px off-screen); Amazon's map label colliding with
> Apple's; the dark band reporting *every* line as a contrast failure because the
> `background` shorthand zeroes `background-color` (the `button.tsx` bug, second sighting);
> and the Neutral badge at 4.32:1 on `--bg-page` versus 4.73:1 on white.
>
> ⚠️ **And one the landing merely exposed: the SCREENER's score chips are white on
> 2.38:1 gold** (`b2ea65b`). Not a landing bug — `.score-num` has been `color:#fff` since
> it was written and the contrast guard only walks public routes, so a gated page's chips
> had never been measured.
>
> ❌ **This paragraph used to end "`scoreChipColor()` now serves both — owner may veto."
> The owner DID veto it, and the reversal is the more useful record.** I had introduced
> that function and applied it to the screener as well, repainting a paid surface, unasked,
> inside a landing-page commit. The instruction was *"whatever is present on the live site,
> the color should exactly match that."* Both surfaces are back on `scoreColor()`, the
> function is deleted, and the debt was carried in the open instead: a
> `[data-legacy-contrast]` marker on the table, excluded from pass/fail but **counted** and
> bounded at 42, with the marker required to sit on exactly one subtree.
> **A real defect does not entitle you to widen your scope.**
>
> ✅ **PAID OFF 2026-08-22.** The owner authorised the palette change on its own merits —
> not smuggled into a landing commit — and three of the five tier fills were darkened by the
> minimum factor that clears white text. The marker is deleted and no longer exists in any
> markup. The *right* shape for that defect turned out to be exactly this: record it, keep
> it counted, and wait to be authorised.
>
> ⚠️ **A deliberate break stayed green twice**, and the boring explanation was right the
> first time and wrong the second: `next dev` served a stale stylesheet from `.next-dev`,
> *and* the guard was genuinely weak. A width sweep settled it — removing the clamp leaves
> 375px clearing by 1.1px (passes, proves nothing) while 360px overflows. The guard now
> tests 360px and demands 2px clearance. The original "8px overflow at 375px" was an
> artefact of an approximate probe: **the measurement was wrong, not the code.**
>
> ### ✅ G3.8b — the owner's review round, 2026-08-15. `0170d35` → `c9f0b4a` → docs. Playwright 298 → **300**.
>
> The owner read the built page against the artifact and raised six things. All six were
> real; four were defects I had not seen, and one reversed a change I had made.
>
> 1. **Rating colours — reverted.** See the veto above. Both surfaces back on `scoreColor()`.
> 2. **Overall and Rating Tier belong in ONE column**, because that is what the product
>    does. That pulled three more mismatches out with it — Health was painted with
>    `scoreColor` (five tiers) instead of `healthColor` (**three**), both score cells had
>    lost their word (*Healthy*, *Reasonable*), and Current DD% was tinted red when the
>    product tints it **green for a deeper dip**, contradicting the page's own argument.
>    The table now reuses the product's real helpers, and the snapshot carries
>    `cyclePayoffScore` so the composition bar is not a second implementation of the
>    weighting. → **CLAUDE.md 11m**: the approved artifact was hand-drawn from a
>    screenshot; **the product's source is the only authority on what the product looks
>    like.**
> 3. **"the number to sit with before you decide how much you can stomach"** — reworded.
> 4. **Font sizes against the artifact.** Diffing *computed* styles turned up `.card-note`,
>    a class the markup asked for on every provenance line and `globals.css` had never
>    defined — so each one inherited 15px full-strength ink and read as a second title.
>    **An undefined CSS class is silence, not an error.**
> 5. **"The animations are not working."** They were wired correctly and losing a
>    specificity fight: an inline `style={{ width }}` is (1,0,0,0) and out-specified the
>    armed rule, so every ruler animated from its final value to its final value. Moving
>    the number to a `--w` custom property gave the stylesheet the property back.
> 6. **Opportunity Map alignment** — nudged down onto the body-text baseline.
>
> ⚠️ **Writing the guard for (5) cost more than the fix and found a separate open issue.**
> `toBeVisible()` counts an `opacity: 0` element as visible, so eight assertions stayed
> green through a deliberate break; and stripping the reveal class starts a *transition*
> rather than arriving at a state, which made the test flaky and made the break report
> `opacity 0.0155657` instead of `0`. Both fixed by measuring computed style with
> transitions disabled. The first version used `javaScriptEnabled: false` and failed for an
> unrelated reason that turned out to be real: **`/`, `/terms`, `/privacy` and
> `/disclaimer` render only "Loading…" without JavaScript** — `app/loading.tsx` wraps every
> route in a Suspense boundary and React defers any page whose HTML overruns the first
> flush. Recorded, not fixed — coding-standards §14 item 11. **Owner's call.**
>
> **Gates:** Playwright **300 passed, 0 failed, 0 skipped, 0 flaky** · typecheck · lint ·
> `check:entitlement-gates` (11) · `check:report-sections` (22) · `check:seo` (491) ·
> `check:data-integrity` (59) · pytest **153**.
>
> ### ✅ DONE — Legal compliance audit, proposed **and applied**, 2026-08-15. **`docs/legal-audit.md`**
>
> Owner asked for the three legal pages to be audited against what the system
> actually does, under the **Australian Privacy Act (APPs) + ASIC** standard they
> chose. Verified against **live** Supabase, Stripe, Resend and Vercel over MCP,
> plus the code — not read. Delivered propose-only; the owner then instructed
> **"apply all the 7 fixes"** in the same session's follow-up.
>
> **Seven findings, none a misrepresentation; all gaps between the machine and the
> disclosures.** Two were material: `referrals` collects and emails a **non-user's**
> address (APP 5), and personal data lives in **`us-east-1`** with no cross-border
> disclosure (APP 8). The rest: a hash that survives deletion, Google missing from
> the recipients list, an unstated 25/day free cap the Terms nonetheless enforced, no
> governing-law or tax clause, and an undocumented 3-day payment grace.
>
> **Shipped:** `privacy/page.tsx` (1–4) and `terms/page.tsx` (5–7), both dated
> **15 August 2026**. `/disclaimer` was audited, found accurate and left alone, so it
> correctly still reads 5 July 2026. Every insertion carries a comment naming its
> finding. **No existing wording was restyled or re-ordered** — the owner has said
> repeatedly they are happy with the content.
>
> **Two owner amendments, both recorded in the audit doc:**
> - **No ABN and no entity type** in the governing-law clause — *"operated by a
>   business based in Australia"*. An ABN on a public page is a live claim about a
>   registry that has to be kept current, and nothing depends on it. Don't reinstate.
> - **Cloudflare verified by hand in the signed-in dashboard** (it has no MCP
>   server): DNS Setup **Full**, 12 records, **all DNS-only** — so Cloudflare is
>   registrar + authoritative DNS and does *not* proxy site traffic — and Email
>   Routing **Enabled** with two active rules forwarding `support@` and `security@`.
>   The existing phrase *"DNS and email routing"* is accurate and was left unchanged.
>   The Resend *"receiving disabled"* reading was a true fact about the wrong system.
>
> **New guard, and it is the point of the exercise.** Three of the new sentences are
> promises about live constants (`FREE_VIEW_DAILY_LIMIT` 25, `ACCOUNT_DELETION_GRACE_DAYS`
> 30, `GRACE_DAYS` 3). Change a constant and the published page becomes a **false
> statement** with nothing going red — CLAUDE.md 11k on the worst possible surface.
> `e2e/legal-doc.spec.ts` now builds each assertion *from* the constant and checks it
> against the **rendered** page, each with an off-by-one control proving the match is
> value-sensitive.
>
> The technical facts it established — data residency, the personal-data table
> inventory, and what survives deletion — are in `architecture.md` §6.6.
>
> ### ✅ G4 (the Learn library) — `/learn` + `/learn/[slug]` BUILT 2026-08-15. Still inside PR #89.
>
> The last item in commit group 2. **Machinery complete; the library ships with one
> article and grows by adding registry entries.**
>
> **One registry is the source of everything.** `lib/learn.ts` holds the article
> metadata, and `PUBLIC_PAGES` **derives** its `/learn/<slug>` entries from it — so a
> single spread gives each article its sitemap entry, its canonical tag, the
> middleware allow-list, and the full public header (`showsFullChrome()` asks
> `OPEN_TO_STRANGERS.has(pathname)`, an exact match, which is why an article without
> the derivation silently renders the *confinement* chrome — 11c-iv's defect again).
> `seo.spec.ts` picked up canonical + sitemap coverage for the articles for free,
> because it already loops over the indexable entries of that list.
>
> **Three structural decisions worth not relitigating:**
> - **`lib/learn.ts` contains no React**, and `check:seo` enforces it. `lib/seo.ts`
>   imports it and `proxy.ts` imports `lib/seo.ts`, so a component here would join
>   the **middleware** bundle that runs on every request to the site.
> - **Bodies are `Record<LearnSlug, …>` in `content.tsx`**, so registering an article
>   without writing it is a **compile error**, not a blank page (11j). This depends on
>   `LEARN_ARTICLES` ending `as const satisfies readonly LearnArticle[]` — an explicit
>   type annotation widens `slug` to `string` and the check evaporates. Guarded.
> - **The answer is a required FIELD, not the first paragraph of the body.** The brief
>   asks for a direct answer before any prose; making it structural means an article
>   cannot be published without one, and it is capped at 320 characters — because the
>   disclaimer sits directly beneath it and an over-long answer is the only thing that
>   can push it below a 375px fold. An editorial rule enforced by a test.
>
> **Articles use the 17px reading scale, deliberately NOT the legal pages' 13px** —
> that was an owner instruction scoped explicitly to those three documents.
>
> **The disclaimer sentence is now ONE component** (`LegalNotice.tsx`), consumed by
> the legal documents and by the article template. It was about to be typed a second
> time, which for a compliance control is the worst instance of 11c there is: two
> disclaimers do not diverge loudly, one simply gets edited.
>
> **Numbers come from the nightly snapshot, never hand-typed** (11k) — the worked
> example reads the same `LANDING` file the landing page uses.
>
> **Playwright 314 → 329**, 0 failed, 0 skipped; `check:seo` 491 → **517**.
> **Five deliberate breaks, and two of them exposed defects in the guards themselves**
> — see `coding-standards.md` §14 item 13.
>
> ⚠️ **Content is the owner's, not mine.** One article shipped as the worked reference
> so the template is proven against real prose rather than a placeholder; the rest of
> the library waits on the owner's steer.
>
> #### The index design — chosen from three, 2026-08-15
>
> The first index (a plain themed list, no pictures) was **rejected by the owner**.
> Three directions were then drawn in the design artifact and the owner chose **A —
> theme bands**: one illustration per TOPIC, alternating left and right, with the
> article titles listed beside it. Heading is the owner's: **"Before you buy
> anything"**. The artifact now contains **only** the chosen direction — B and C were
> removed rather than kept "for reference", because a future session must not find
> three candidates and guess (11j).
>
> ⚠️ **Direction B — a picture per ARTICLE — is the better browsing experience and was
> deliberately deferred, not rejected.** A card grid needs ~9 articles before it stops
> looking abandoned; the library has one. Direction A never looks half-built. Revisit B
> at roughly a dozen articles — the data shape already supports it.
>
> **The index is `wide`, the articles are `prose`.** A browse page is not a reading
> page: at the 680px reading column the bands gave a 325px image, at `wide` they give
> 532px, and the pictures are the point of the design. The prose inside is still held
> to a 720px column — the frame is wide for the layout, not for the words.
>
> ✅ **The three topic images landed 2026-08-16 at 1600 × 1000 (16:10)** — see G4.1 below.
> They were **built twice on the same day.** First as hand-authored SVG, because neither
> Canva's generator nor any image model could hold the geometry. Then **regenerated on
> Gemini "Nano Banana Pro" at 4K**, because the owner wanted the register of their own
> reference image — populated, atmospheric, human — and precise geometry is exactly what
> that is not. The SVG set was accurate and lifeless. Masters (5056 × 3392) live in
> `reference/learn-masters/`, gitignored and irreplaceable. The owner's decision that these
> are **content rather than brand furniture** still stands; what changed is that the set
> turned out to need hard rules of its own (teal = price, navy = company; no green, no red,
> no arrows) to avoid contradicting the product. Spec: `design-system.md` §11.
>
> **No dashed placeholder was ever shipped**, deliberately — that is the kind of thing that
> reaches production because everyone assumed somebody else would spot it, on the one page
> whose job is to make strangers trust us. ⚠️ The intended graceful degradation was
> nevertheless **broken from the day it was written**: see G4.1.
>
> ⚠️ **The page showed ONE band until 2026-08-16**, because only one article is written and
> topics with no articles were filtered out. It now shows three, because an announced title
> earns a band too. **The library is still 1 written / 11 announced** — a merge decision,
> not a design one.
>
> #### The fourth type scale — found by the owner, fixed 2026-08-15
>
> The owner said the Learn pages looked inconsistent and asked for an audit against the
> other public pages. Measured at 1280px on the built pages, they were right and it was
> structural: `/learn` and `/learn/[slug]` ran **36/26/20** against **24/17/13** on every
> other non-landing public page — a **50% jump in heading size** crossing one link.
>
> Cause: the document scale was welded to `.legal-layout`, the class that also builds the
> legal contents-rail grid, so a document wanting the scale without the grid could not have
> it. Extracted as **`.doc-scale`**, now worn by `LegalDoc`, `ArticleDoc` and the Learn
> index. Full write-up: `design-system.md` §11 and `coding-standards.md` §14 item 14.
>
> ⚠️ **This reversed an earlier decision of mine** (that an article should keep the 17px
> reading scale because it is read rather than scanned). Defensible on its own terms;
> what it produced was a fourth scale.
>
> 🔶 **OPEN, owner's call: 13px is small for 900 words of newcomer prose.** Lifting it means
> changing `--pub-*`, which moves the legal pages, the auth cards and the articles together
> — one decision applied everywhere at once. An article page does not get to opt out on its
> own; that is exactly how the fourth scale appeared.
>
> #### ✅ G4.1 — the three topic illustrations + "Coming soon". 2026-08-16, still inside PR #89.
>
> `055295e` → `f955125` → `e468113` → `3aa91b0`. The page now shows its whole shape: three
> illustrated bands, twelve titles, one of them readable.
>
> ⚠️ **SUPERSEDED THE SAME DAY by G4.2 below — the pictures described here are gone.** They
> were hand-authored SVG, and the record of *why* is kept because it is the reason the
> replacements were briefed the way they were. Full current spec in `design-system.md` §11.
> Two things were tried before the SVG set and neither could do it:
>
> - **Canva's generator arranges layouts and cannot be handed geometry.** Four candidates
>   came back from a prompt carrying the exact hexes, the exact shape and "no text" four
>   times: two rising hills, a stacked area chart, and a stock photo of a laptop captioned
>   UNDERSTANDING FINANCE FOR A BETTER FUTURE. **None of the four showed a share price
>   falling** — the entire meaning of the picture.
> - **The owner generated image 2 with Google's image model and it beat mine**, because it
>   had **doors and windows** — which is what makes a shape a building rather than a stack
>   of slabs. The composition was adopted; the file could not ship (green-up/red-down
>   contradicts our own drawdown tinting and fails colour-blind readers; embedded text;
>   "PROFIT INCREASE" beside piles of coins, which is decision #24 rather than taste).
>
> ⚠️ **`upcoming` — announced titles are STRINGS, never registry entries.** A `LearnArticle`
> gains a URL, a sitemap row, a middleware allow-list entry and a canonical tag the moment
> it exists. A promise about a future article must cost none of that. Contract in
> `data-contracts.md` §7b; the count pill states what is **readable**, never what is promised.
>
> ⚠️ **The imageless band was half a page, for the life of the branch.** The two-column track
> was declared unconditionally, so a topic with no picture kept both columns and its text
> landed in the first — 532px of content beside 588px of empty page, at every desktop width,
> while `learn.ts` documented the opposite. Fixed and guarded twice; write-up in
> `design-system.md` §11 and `coding-standards.md` §14.
>
> ⚠️ **Two verification lessons, both from reporting something wrong first.** I told the
> owner a scaling change "had not applied", from eyeballing a downscaled screenshot; the ink
> bounding box measured 60.8% against 77.9% on disk, and 60.8/77.9 is exactly 1/1.28 — the
> scale I had applied. **The browser really was serving stale bytes**, for two reasons worth
> keeping: my own `rm -rf` targeted `.next-dev/cache/images`, a path that has never existed
> (the dev cache is `.next-dev/dev/cache/images`) and deleting nothing reports success; and
> Next's optimiser **keys its cache on the Accept header**, so a curl check receives PNG
> while every real viewer receives WebP from a separate entry. Order that works: kill the
> process, confirm the port is free, delete, confirm the directory is gone, then start.
>
> ⚠️ **`:3000` and `:3200` are different servers and only one updates itself.** The owner
> checked `localhost:3200/learn` and saw none of the work — correctly, because `web-prod`
> serves a compiled snapshot, and theirs was built the previous night. Nothing was broken.
> **`:3000` for reviewing work in progress; `:3200` only after an explicit rebuild.**
>
> ✅ **The two early reference pictures were DELETED on 2026-08-18, owner-approved** —
> `reference/Image 1 - Falls and Recovery.jfif` and `reference/Image 2 - Judging a
> Business.png`. Untracked, so they were not in git and are not recoverable; fully
> superseded by the shipped illustrations and by the 4K masters. ⚠️ **The masters in
> `reference/learn-masters/` were explicitly KEPT** — they are gitignored, irreplaceable
> (the same prompt returns a different picture), and on the very same day they were the
> only thing that made restoring image 3 possible.
>
> **Gates:** typecheck · lint · all four build guards (`check:seo` **517**) · Playwright
> **335 passed, 0 failed, 0 skipped, 0 flaky** (`learn.spec.ts` 13 → **16**).
>
> #### ✅ G4.2 — the illustrations regenerated at 4K. 2026-08-16, same day, still inside PR #89.
>
> `e7b1400` (all three) → `2f9ce9c` (image 3's colour). **The SVG set of G4.1 is gone.** The
> owner's brief was the register of their own reference image — populated, atmospheric,
> human — and precise hand-drawn geometry is the opposite of that. The SVGs were accurate
> and lifeless.
>
> **Route: Vercel AI Gateway.** One key, provider list price with **no markup** (their docs
> say so in as many words), pay-as-you-go with a spend cap. Drafts on
> `gemini-3.1-flash-image-lite` (**$0.034**, ~4s); finals on `gemini-3-pro-image` at **4K**
> (**$0.24**). Whole set, 15 drafts and 4 finals: **$1.58**. Masters are **5056 × 3392
> lossless PNG** in `reference/learn-masters/` — gitignored, ~47 MB, with the prompts beside
> them and a README saying why they must not be deleted.
>
> ⚠️ **Two dead ends, both worth not repeating.** The **built-in Hugging Face connector sets
> `gradio=none`**, which disables all generation while everything else works — fixed with a
> custom connector to `https://huggingface.co/mcp?login`, but its free ZeroGPU quota is about
> **one image per day**. And **Gemini's API has no free image tier at all** (`limit: 0` on
> every image model) even though the *website* generates free; a text model on the same key
> answering normally is what proved the key was fine.
>
> ⚠️ **Every claim these pictures make was measured, and three defects were caught that way.**
> Image 1's falls are **26.8 / 47.4 / 19.4%** of frame height (the topic is that falls vary).
> Image 2's two lines fall **810px each** (the topic is that they fell the *same*). Image 3
> has no seam: **Δ0.59** against a 0.25 baseline. Caught: Pro reframing image 2 so both lines
> ran off the top edge; a seam test that scored the seamless image 1 at 14.6 because it was
> finding skyline towers; a teal test that "confirmed" matched falls while matching the hills.
> **A pass means nothing until the test has been seen to fail** — each was re-run against a
> control.
>
> ⚠️ **Image 3's pale side was corrected, not regenerated** (`2f9ce9c`). At RGB distance
> **16–21** from `--bg-page` it read as a panel on the page; images 1 and 2 sit at 4–6 and
> 11–13. A lightness-weighted shift took the right edge to **1** while leaving navy and teal
> byte-identical. Re-rolling would have destroyed an approved, unreproducible composition to
> fix arithmetic.
>
> ✅ **Image 2 ships with a stepped plinth under the towers** — the brief asked for both
> "flat and plain, no steps" *and* "stepped bands", and the model built stairs. Owner has
> seen it and called it fine. *(Marker corrected 2026-08-23: this had carried an amber 🔶
> while its own last sentence recorded the approval. An open flag beside a closed decision
> is how a settled question gets re-asked — and it was, on 2026-08-23, when I listed it back
> to the owner as outstanding.)*
>
> **Gates:** typecheck · lint · `learn.spec.ts` **16/16** · all three confirmed loading in
> the browser at 1280px and 375px, no horizontal scroll.
>
> **Next session, owner's plan:** **audit the whole `/learn` page** — polish images 1 and 2
> the way image 3 was polished if they need it, check the UI — and *then* start writing the
> articles.
>
> ### 📋 LAYER G AUDIT — the deferred list. Owner instruction 2026-08-15: revisit these **after** Layer G is built, not during.
>
> Both were surfaced this session, both are real, and neither is urgent. They are parked
> here rather than fixed so that building does not keep stopping for them. **Do not action
> either one mid-build.**
>
> | # | Item | Owner's steer |
> |---|---|---|
> | **GA-1b** | 🔴 **ESCALATION — the same root cause makes EVERY `notFound()` on the site answer 200.** Found 2026-08-15 building `/learn`, and established by control experiment on a **production build**, not inferred: with `app/loading.tsx` present `/learn/does-not-exist` → **200**; with the file temporarily moved aside, same build otherwise → **404**. The control that makes it a finding rather than a guess: `/.well-known/nothing-here` returns a true 404 on the same server, so 404s do survive the middleware — it is the streaming, not the proxy. **Mechanism:** the root Suspense boundary flushes the shell before the page resolves, and once bytes are on the wire the status is already committed, so Next swaps the not-found content in afterwards. **This is a soft-404**, which Google treats far more harshly than an honest 404 — on the layer whose entire purpose is SEO. It applies sitewide, not just to Learn | ✅ **FIXED 2026-08-18 with GA-1 — one deletion closed both.** `app/loading.tsx` removed; `(app)` keeps its own. The `test.fail()` is now a real assertion carrying a *"a real article still answers 200"* control. Re-verified on a production build: `/learn/does-not-exist` → **404**, real pages → 200, `/.well-known/nothing-here` → 404 |
> | **GA-1** | **Four public pages render only "Loading…" with JavaScript disabled** — `/` (108 KB), `/terms` (46 KB), `/privacy`, `/disclaimer` (42 KB); the four AuthCard pages (25–29 KB) are fine. `app/loading.tsx` wraps every route in a Suspense boundary and React defers any page whose HTML overruns the first flush into a `<div hidden>` swapped in by an inline script. Measured on a production build, deterministic ×3. Full write-up: `coding-standards.md` §14 item 11 | ✅ **FIXED 2026-08-18, owner-approved.** Deleted rather than scoped — `(app)` already had its own `loading.tsx`, so only the public pages lost a route-level fallback, which is what Vercel's guidance describes anyway. ⚠️ **The deletion BROKE THE BUILD, and that is how the file's real purpose surfaced:** `/login` and `/signup` call `useSearchParams()`, which Next refuses to statically prerender — the boundary had been satisfying that **by accident, sitewide**, and nothing said so. ⚠️ Next's documented fix (wrap in `<Suspense>`) is the WRONG one here: a fallback renders server-side and fills in on the client, so a no-JS visitor would get the fallback and never the form, on the two pages that must work for everyone. Used `force-dynamic` instead — see `architecture.md` §7.2. Production HTML now carries the real form (`/login` 25,240 bytes with its email + password fields) and **zero** pages mention "Loading". Guarded by 5 no-JS tests in `landing.spec.ts`, each with a length floor. ⚠️ **Re-measured 2026-08-18 against the build that still had the file** — removing it did not cost perceived speed, it BOUGHT it: time to real content on a first load went 6.24s → 2.15s on Slow 3G (`/learn` 6.01 → 2.13, `/terms` 6.02 → 2.15), with `/pricing` unchanged at 2.14 as the internal control because it never suspended. Clicking a link is unchanged (2.31s vs 2.36s). See `architecture.md` §7.2 |
> | **GA-4** | **`legal-doc.spec.ts` → "/privacy keeps its lines inside the readable band" is still flaky on CI** (retried, passed; run `31867667881`). This is the character-count guard whose precondition problem is written up in `coding-standards.md` §14 item 7b — it polls until the article computes 13px, which proves the stylesheet applied and nothing about the column having taken its width or the real webfont having rendered, and font metrics are exactly what a character count depends on. Local (8 cores, warm) never hits the window; CI (2 cores, cold compile) does | ✅ **FIXED 2026-08-18.** `laidOut()` now polls three things instead of one: `document.fonts.ready`, the article actually clamped to `--measure-doc`, **and `document.fonts.check()` on the real face**. That last one is the addition — `fonts.ready` resolves when loading has SETTLED, which includes settling on a *fallback*, and a character count is a pure function of font metrics. ⚠️ Getting it right took a correction: passing the computed `font-family` straight to `check()` returns **false forever**, because `next/font` renders it as `Sora, "Sora Fallback", Sora, sans-serif`, which is not a parseable font shorthand. It failed CLOSED (all three pages timed out), which is the safe direction but still wrong. Use the first family, quoted |
> | **GA-3** | **An intermittent 404 on Stock Detail, seen locally.** `entitlement-routes.spec.ts` → *"a FREE viewer's Stock Detail HTML contains no scored value anywhere"* failed ~1 run in 3 against `/stocks/us/<TICKER>`, and the captured page was **"Page not found"** — i.e. `notFound()`, i.e. `fetchStockDetail` returned `null`. ⚠️ **Proved pre-existing, not caused by the Layer G polish**: stashing every change and re-running passed, then restoring them gave 1 fail / 2 passes, so the control's pass was luck and the defect is timing, not code. ⚠️ **This is the exact shape CLAUDE.md 11e is about** — `null` must mean "not in our universe" and read failures must throw so the route answers 503. An intermittent 404 says either a row really is intermittently absent, or some read path still folds a soft failure into `null` and 11e missed it | ✅ **RESOLVED 2026-08-18 — measured, and it was never a production defect.** The recorded next step was to time the pieces rather than touch the limit, and doing so found it in one pass: the page's BLOCKING work (stock row + medians + entitlement) is ~2s, while the cycle sections stream behind `<Suspense>` — and under `next dev` that means **spawning Python as a CLI** (`lib/cycle.ts`, dev-only), timed at **13.4 / 17.6 / 20.0s** across three runs. Of that, 4.6s is interpreter start plus the pandas+numpy imports and the rest is two Supabase round trips made **from Australia to a us-east-1 database**. `page.goto` defaulted to `waitUntil: `load`, which waits for that entire stream — producing the recorded 17.4 / 20.7 / 21.0 / 21.3s and, in the last full suite, **37.7s against the 45s `navigationTimeout`**. That 7.3s of headroom IS the flake. **None of it exists in production**, where `/api/cycle` is a warm serverless function ~10-20ms from the DB. Fixed by switching all five `page.goto(DETAIL)` calls to `domcontentloaded`: **37.7s → 16.3s**, headroom 7.3s → 28.7s. ⚠️ **Not a loosening, and the control proves it** — `Current Drawdown` is rendered by `KpiStrip` INSIDE the Suspense boundary, so every assertion still blocks until the streamed cycle content arrives (a positive signal naming what the test needs, CLAUDE.md 11q), and the sibling test *"an ACTIVE subscriber sees the scored values on the same page"* passes at 14.1s — if the stream had not landed, that one would fail, which is what stops the free-viewer test passing vacuously. Full file: 41/41. ⚠️ The original **404** symptom was never reproduced after `app/loading.tsx` was deleted; `readStockRow` is a plain `.eq().maybeSingle()` that throws on error, so it cannot intermittently report absence — the soft-404 (GA-1b) is the likeliest source and is now fixed |
> | **GA-5** | **The line-band guard measures ONE paragraph per page and stops — and two paragraphs on `/privacy` run 76 characters, one over the 75 bound.** Surfaced 2026-08-15 while applying the legal audit: a probe printing every qualifying paragraph returned **72, 74, 76, 76**, and the guard only ever looked at the first (74, green). One of the two 76s is pre-existing content, not new. ⚠️ Same family as 11j — a check that samples one instance is *silent* about the rest, not clean | ✅ **FIXED 2026-08-18 — and the premise above was wrong twice.** (i) `--measure-doc` is read by the legal documents **only**; the auth-card agreement test asserts the *type sizes* (24/13), not the measure. So this was never the multi-surface change it was filed as. (ii) Widening the guard to every paragraph found something worse than the recorded `/privacy` 76: **`/terms` runs 69, 70, 73, 81, 70, 73, 73, 70 — an 81.** A sample of one was hiding more than anyone knew. ⚠️ **The assertion is now the MEDIAN, deliberately, not the maximum.** 45–75 describes a *typical* line, and characters-per-line is not a property of the column alone — a word-dense paragraph legitimately fits more. Asserting the max makes the guard hostage to the unluckiest sentence, and the only way to satisfy it is to narrow the column until the typical line falls *below* the band. So: median ≤ 75, plus a max ≤ 85 that still catches a genuinely blown column (the original defect measured 91, and 110 before that, so both bounds still fail it). Broken on purpose at `--measure-doc: 900px` → 123 and 128.5, naming every paragraph. **No pixel of the approved design was changed** |
> | **GA-2** | **Seven design-hook findings in `globals.css`**, all pre-existing product CSS on **paid** surfaces. Three `side-tab` (a 2px accent on `.insight-invalidation`, 3px on `.card-header--accent-buy/hold`) — assessed as **false positives**: the colour is semantic, and it comes from `reference/original-design.html`, which non-negotiable #1 makes the locked source of truth. Two `layout-transition` (`transition: width` on `.radar-axis-bar-fill` and `.progress-bar-fill`) — correct in principle, negligible at 6–8px, and `scaleX` would stretch the gradient fill | ✅ **RESOLVED 2026-08-18, owner-approved: exception persisted, no product CSS touched.** `.impeccable/config.json` carries two file-scoped wildcard entries for `app/globals.css` — `side-tab` and `layout-transition` — each with its reasoning written into the `reason` field so the decision travels with the suppression. Gitignored alongside `.agents/` (the tool is not the product); this row is the committed record. ⚠️ **Verified with three controls, because a config that silently does nothing is the failure mode here:** without it the detector reports **7** findings on `globals.css` (matching the count in this row exactly), with it **0**, and a *different* file (`landing.css`) still reports **1** — proving the exception is genuinely file-scoped and has not blinded the rule globally. The sweep also surfaced two side-tab findings not in the original seven (`.kpi-card::before`, `.card--verdict::before`), both on paid surfaces and both covered | ⚠️ **BOTH ENTRIES WENT OBSOLETE ON 2026-08-22, and the control had stopped firing anyway.** (i) The `layout-transition` suppression is void because the defect is FIXED: `.radar-axis-bar-fill` now translates and `.progress-bar-fill` now scales, both measured pixel-identical to the old bars (commit `c9430bb`). Its stated reason — *"scaleX would stretch their gradient fills"* — was also simply **wrong**: scaleX squashes the painted gradient exactly as a short bar did, which is why it is the right shape for that one, and the solid-coloured radar bar uses translateX where the question never arises. A suppression is only as good as its reason, and this one had never been measured. (ii) The `side-tab` suppression rests on *"non-negotiable #1 makes the locked visual source of truth"*, and on 2026-08-22 the owner **removed that premise** — the reference HTML is a mock-up, not a contract. The stripes now need a decision on their own merits, not an appeal to the file. (iii) ⚠️ **And the suppression is not currently taking effect**: the design hook reported all three `side-tab` findings and both `layout-transition` findings on `app/globals.css` twice on 2026-08-22, which is exactly what the config says to silence. Either it stopped matching or it never covered the hook (only the audit) — unverifiable from here, because the tool is not runnable in a Claude Code session. **A control that was verified once and never re-checked is a control you no longer have.** **DELETED 2026-08-22 on owner instruction**, together with a ruling on the thing it was standing in for: **the accent stripes STAY**, and the reason is now written in `design-system.md` §1a — the stripe is the only thing that says which of two facing cards is the good news before a word is read, which is information rather than decoration. ⚠️ Consequence, stated because it is a real cost: with no config the three `side-tab` warnings will surface again on every edit to `globals.css`. That is the honest state — a deliberate decision the detector disagrees with — rather than a silenced warning resting on a premise that no longer exists. A fresh exception carrying the REAL reason can be filed on request; it was not filed unasked, because the last one was verified once, quietly stopped applying, and nobody noticed for four days.
>
> ⚠️ **All five GA items are now CLOSED** (GA-1, GA-1b, GA-2, GA-3, GA-4, GA-5). The
> line above once read "neither is a blocker for merging PR #89", written when two were
> still open; it is kept only as a record of that moment.
>
> ### ✅ 2026-08-18 — the speed session. `f7aa114` → `afdac6a` → `89c39cb` → `ddea633` → `53e48e9`
>
> Started as "did deleting `app/loading.tsx` cost anything?" and ended with the public
> site prerendered. **Playwright 343 → 348, 0 failed, 0 skipped, 0 flaky.**
>
> **1 · The deletion PAID.** Measured both builds under Chrome's Slow 3G: time to real
> content on a first load went **6.24s → 2.15s** (`/learn` 6.01 → 2.13, `/terms` 6.02 →
> 2.15), with `/pricing` unchanged at 2.14 as the internal control — it never suspended,
> so it never rendered the placeholder. Clicking a link was unchanged (2.31 vs 2.36s),
> and **no busy indicator appeared in either build**: the fallback never rendered on a
> client-side navigation at all, proven with a detector that DID catch it on a hard load.
>
> **2 · GA-3 closed, and it was never a production defect.** The page's blocking work is
> ~2s; the cycle sections stream behind Suspense, and under `next dev` that means
> spawning Python (13.4 / 17.6 / 20.0s, of which 4.6s is interpreter start plus
> pandas/numpy). `waitUntil: 'load'` waited for all of it — 37.7s against a 45s ceiling.
> Switched to `domcontentloaded`: **37.7s → 16.3s**, headroom 7.3s → 28.7s. Not a
> loosening: `Current Drawdown` renders inside the boundary, and the sibling test
> asserting a subscriber DOES see the scores passes, which is what stops the free-viewer
> test passing vacuously.
>
> **3 · A pending dot was built and rolled back.** `useLinkStatus` put a dot in each
> link, visible 190-235ms after a click. The owner rejected the look — and it had also
> inflated both header CTAs by **18px** each, its own margin stacked on `Button`'s flex
> gap. Removed entirely; chrome verified byte-identical to before it existed.
>
> **4 · The public pages are PRERENDERED.** One session read in `app/not-found.tsx` was
> making the entire site dynamic, because the root not-found boundary sits in every
> route's tree. Prefetch payload for `/learn` **210 → 667 bytes**; the click **674ms →
> 77ms**. No feature lost — the 404's single link to `/` is resolved by the middleware,
> which already sends a signed-in reader to `/stocks`. 🔴 **The security finding:** four
> pages came along by accident, including `/deletion-requested`, measured on the wire
> sending `s-maxage=31536000` where it had sent `private, no-store`. Nothing was exposed
> (the gate runs first) — **and that is the problem** (CLAUDE.md 11s). All four now state
> their own caching. Guarded by `pnpm check:render-modes`, which reads the build output
> and was broken three ways first.
>
> **5 · Image 3 is the untouched original.** Two edits were made to blend it with the
> page and both were wrong; the owner asked for the original and was right. The crop was
> recovered exactly from the 4K master (centred, 0.83/255 against 23.50 and 12.78). All
> three illustrations now ship as raw generated crops. Details: `design-system.md`.
>
> **6 · Two traps made structural rather than remembered.** `:3200` now runs
> `start:fresh` (`pnpm build && next start`) so it cannot serve a stale build — it had
> bitten the owner twice. And the one flaky test (`ECONNRESET`, no status at all, three
> hypotheses tested and all wrong) is now handled by `transportRetry`, which retries a
> dropped **connection** and never an HTTP **response** — with four pure tests of its
> own, two of them controls.
>
> **Owner-approved deletions:** the two early reference pictures (above). The 4K masters
> were explicitly kept, and earned it the same day.
>
> ### 📋 2026-08-19 — the post-Layer-G list. Owner instruction: **list, do not fix.**
>
> Surfaced while starting the Learn articles. Neither item touches the article work, and
> both are parked here by owner instruction so building does not keep stopping. **Do not
> action either one before Layer G is done.**
>
> **1 · GA-2 re-fired, and the product is not the reason.** The design hook reported the
> same seven `globals.css` findings that GA-2 closed on 2026-08-18. The exception was then
> **intact and correct** — `.impeccable/config.json` carried both file-scoped wildcard
> entries with their reasoning. What was stale is the hook's own cache:
> `hook.cache.json` was written at **00:01:57** and the config at **00:46:14**, so the
> cache predates the exception by 45 minutes and is replaying findings recorded before it
> existed (`"cleanAcked":true` is already set on the entry). ⚠️ **Nothing in the product
> changed** — `git status` was clean when it fired, and the turn that triggered it made no
> code edits at all. This is CLAUDE.md 11i one layer out: a stale cache producing a result
> that looks like a regression. The fix, when we get to it, is to invalidate the cache
> rather than to touch any CSS.
>
> ⚠️ **The cache did earn its keep once: it named the two findings the hook truncated.**
> The message showed five and said "and 2 more"; the cache holds the full seven, so they
> can be listed without re-running anything:
>
> | # | Rule | Selector | Surface |
> |---|---|---|---|
> | 1 | `side-tab` | `.insight-invalidation` (2px gold) | paid — thesis insights |
> | 2 | `side-tab` | `.card-header--accent-buy` (3px green) | paid |
> | 3 | `side-tab` | `.card-header--accent-hold` (3px gold) | paid |
> | 4 | `side-tab` | `.kpi-card::before` (3px top bar) | paid |
> | 5 | `side-tab` | `.card--verdict::before` (5px left bar) | paid |
> | 6 | `layout-transition` | `.radar-axis-bar-fill` — `transition: width .6s` | paid |
> | 7 | `layout-transition` | `.progress-bar-fill` — `transition: width .4s` | paid |
>
> All seven are on **gated** surfaces and all seven were covered by the two wildcard
> entries.
>
> ⚠️ **STATE AS OF 2026-08-22 — read this table with the row below, not on its own.**
> Findings 6 and 7 are **fixed** (the bars now transform; commit `c9430bb`), so they can
> never fire again. Findings 1–3 were **ruled on by the owner: the stripes stay**, for the
> reason in `design-system.md` §1a rather than an appeal to the mock-up. Finding 4
> (`.kpi-card::before`) is a **misread** — `left:0; right:0; height:3px` is a rule across
> the TOP of the card, not a stripe down its side; the rule's own description ("thick
> coloured border on ONE SIDE") does not describe it. Finding 5 (`.card--verdict::before`)
> is a genuine 5px left rail on the Verdict card and has **not** been separately ruled on;
> it was flagged to the owner rather than folded into their decision about the other two.
> The config that silenced all of this is deleted, so 1–5 now surface on every edit.
>
> **2 · NEW — two CSS class names use forbidden rating vocabulary.**
> `.card-header--accent-buy` and `.card-header--accent-hold` (`globals.css` 541–544) use
> **"buy"** and **"hold"**, which non-negotiable #2 forbids in our scoring outputs — the
> five tiers are High Conviction / Constructive / Neutral / Cautious / Bearish. ⚠️ **Not a
> compliance breach**, and that distinction is the whole reason this is parked rather than
> fixed: these are internal class names, never rendered, so no reader ever sees the words.
> The risk is second-order — a name is what the next person reaches for, and vocabulary
> that contradicts the tier list is how a forbidden word eventually reaches a label. Rename
> to `--accent-positive` / `--accent-caution` whenever that area is next opened, in the
> same commit as the markup that consumes it. Found by reading the file for an unrelated
> reason, which is the only way a naming smell is ever found.
>
> **3 · NEW — the public header overflows by 18px at 320px.** Measured 2026-08-19 while
> guarding the drawdown article's figures. At **375px and 360px the page is clean (0px)**;
> at **320px the document scrolls sideways by 18px**, and the two offending nodes are the
> header's CTA pair — `div.ml-auto flex items-center gap-[10px]` and the `Create free
> account` anchor inside it, which is `whitespace-nowrap` and measures 177.9px against a
> 320px viewport. ⚠️ **Below the stated floor**, so this is not a broken promise: #3 and
> decision #28 commit to 375px and the roadmap already defers the responsive pass to
> Layer H. It is recorded because it was measured, not because it is due. ⚠️ **How it
> surfaced is the reusable part:** the figure guard originally measured the whole
> document and went red for a component it does not own — and the reflex in that
> situation is to loosen the bound until it passes, which would also have blinded it to a
> real figure overflow. The guard was scoped to `[data-article-body]` instead and the
> finding written down here. Fold into the Layer H 375px sweep.
>
> **4 · ✅ RESOLVED same day — the landing's five `863` literals now come from the
> database.** Owner instruction: *"please automatically fetch the number from the
> database."* ⚠️ **They were already wrong when this was written**: the page said
> **863** while the database held **866**. The universe auto-expands on every reader's
> ticker request (#16), so the drift needs no commit and nothing goes red — a stale
> count is still a fluent, specific, plausible sentence.
>
> `build_landing_snapshot.py` now counts `stocks` where `market != 'index'` and writes
> `universeCount` into `landing-snapshot.json`, which the nightly workflow already
> commits back to the repo. The page renders `UNIVERSE_COUNT` from that file in all
> five places, so **the landing stays statically prerendered** — no database in the
> front door's critical path, and none of the 674ms→77ms click win from 11s is spent.
>
> ⚠️ Counted with `count="exact"`, not `len(rows)`: PostgREST caps a request at 1000
> rows silently (14c), so counting rows would be right today, drift as we grew, and
> then freeze at 1000 forever on the most public page we own. Guarded in
> `landing.spec.ts` against the snapshot with an off-by-one control, asserting whole
> phrases so a swallowed JSX space fails too. Broken on purpose two ways — a re-typed
> literal, and a deleted space — since bumping the snapshot alone *cannot* fail once
> the page derives from it (coding-standards §14 item 29).
>
> ⚠️ **SUPERSEDED 2026-08-22 — the stale-cache diagnosis no longer explains it.** The cache
> was rewritten on 2026-08-20, i.e. two days AFTER the config, and the hook still reported
> every suppressed finding twice on 2026-08-22. So the exception had genuinely stopped
> taking effect, by some mechanism not diagnosable from a Claude Code session (the tool is
> not runnable here). **A control verified once and never re-checked is a control you no
> longer have** — and note the shape of the near-miss: a plausible cause that was really
> present (a cache that really was stale, once) is the hardest kind of wrong explanation to
> catch, because nothing contradicts it (CLAUDE.md 14f). The config was deleted on owner
> instruction; see the GA-2 row.

>
> ### 📝 2026-08-19 — the Learn cluster, and one announced title the ENGINE cannot support
>
> **"How long do recoveries actually take?"** was announced on `/learn` and must not be
> written as titled. `calculate_cycle_metrics` returns **magnitudes only** — average fall,
> deepest fall, average recovery, largest recovery, event counts. There is **no duration
> anywhere**: no time-to-recovery, no per-event dates, nothing measuring elapsed time. Both
> published articles already tell readers that time is a real cost, so the topic is right;
> the title promises a number the product does not hold, with a sign-up button underneath
> it (CLAUDE.md 11m — a page that shows the product is a promise about the product).
>
> **Owner decision, 2026-08-19:** rather than add duration to the engine, the article shows
> **the recovery and drawdown plots to describe how a share usually MOVES** — how far it
> typically falls, how far it typically recovers, how many times it has done each. All of
> that is real data we already compute and already ship in `landing-snapshot.json`
> (`typicalRecoveryPct`, `largestRecoveryPct`, `recoveryEvents`). ⚠️ **The title must change
> with it** — anything containing "how long" re-makes the promise the data cannot keep.
>
> ⚠️ **Also parked: the retitled "Why your company's own history beats the market's
> average" has no search query behind it.** It is a thesis, not something anyone types into
> Google. Strong as a pillar page that other articles link to, weak as an SEO entry point —
> so it should be scheduled on its merits, not as the next cluster win.

> ### ✅ G3.7 (the legal documents) — COMPLETE 2026-08-13. Still inside PR #89, still unmerged.
>
> The three pages G3 left unaccepted. **Rebuilt twice in one day**, and the second round is
> the one the owner signed off. Full spec in `design-system.md` §9.
>
> **Round 1 — the layout.** Owner-approved direction: document layout with a sticky
> contents rail. The diagnosis was measured, not eyeballed: the card was **2,223px tall**
> (a page pretending to be a card, using 53% of a viewport whose header spans all of it,
> 600px empty beside it); `h2` at **26px** introduced clauses averaging **45 words**, so
> the page read as a stack of headlines; and **six pieces of furniture** stood before the
> first clause.
>
> **Round 2 — the sizes, the numerals, the wording, the duplication.** The owner looked at
> round 1 and it still ran larger than the rest of the site. Five pieces of feedback, all
> acted on:
>
> | # | Feedback | Outcome |
> |---|---|---|
> | 1 | Font sizes consistent, legal pages to match, "no need to make it bigger" | **24 / 17 / 13 / 12**, every one a size already on a live public page, as `--doc-*` |
> | 2 | Why are the numbers in a different font to the headings? | Sora, inheriting size, weight **and colour** — black beside a heading |
> | 3 | Dislike the trial-clause wording | Four short sentences in one paragraph; every term unchanged |
> | 4 | Links duplicated everywhere | The rail's "Other documents" shelf removed |
> | 5 | Show a header/footer alternative first | Two rounds of dummy mockups; **owner chose to keep the current chrome** |
>
> ⚠️ **The measurement reframed request #1 and is worth keeping.** Asked to make the public
> pages consistent, I measured all eleven first: `/pricing` renders **nine** distinct text
> sizes in `<main>` (9.5 · 11 · 11.5 · 12 · 12.5 · 13 · 14 · 24 · 38) and `/signup` eight,
> with steps a quarter-pixel apart. The legal pages were the **most disciplined** on the
> site at five. The inconsistency was never there — it is on the form pages, and it is
> still there, because the instruction was explicitly scoped to the legal pages.
>
> ✅ **Both follow-ups CLOSED the same day, owner-approved.**
>
> 1. **The column was ~91 characters per line.** 13px body in a box sized for 17px — the
>    width never changed, the letters got smaller. New `--measure-doc` (560px) brings it to
>    **67–74**, measured on all three pages. It could not reuse `--measure-prose`: that is
>    680px *because* it holds ~68 characters at 17px, and `/methodology` still needs it.
> 2. **`AuthCard` now consumes the tokens**, so 24px and 13px are written down once. Tokens
>    renamed `--doc-*` → **`--pub-*`**, because a token called "doc" that the sign-in card
>    reads is the misleading name this repo keeps getting caught by.
>
> ⚠️ **The refactor had a trap and the guard is what found it.** `AuthCard` rendered
> `text-[22px] sm:text-[24px]`; a straight swap to `--pub-title` (24px) would have **grown
> every form title on a phone by 2px** — invisible, unreported, unwatched. Hence
> `--pub-title-sm`. **When replacing a hand-typed value with a token, check first whether
> the value was responsive.**
>
> **Playwright 260 → 277** (`e2e/legal-doc.spec.ts`, 17 tests). Every guard broken on
> purpose, including all three new ones: widening the column back to 680 → *"runs 89 chars
> in a 608px column"*; a hand-typed 26px in `AuthCard` → *"the auth card title moved"*;
> dropping the phone step-down → 22px became **14px**, which is how badly an unguarded
> swap would have broken it.
>
> 🔴 **CI caught a flaky test that four local runs did not, and the count is what exposed
> it.** `13b2dee` came back **success** — local **277 passed**, CI **275 passed**. Two
> apart, on a green run. The reconciliation is `275 + 2 flaky = 277`: Playwright prints
> retried passes on their own line and I had read only the last `passed` line. The two were
> the character-count guards, added that hour, reporting **430 characters** — the whole
> paragraph on one line, i.e. the wrap search never found a wrap.
>
> **Cause:** the precondition was `ready()`, which polls until the article computes 13px.
> That proves the stylesheet applied and says nothing about the column having taken its
> width or the real webfont rendering — and font metrics are exactly what a character count
> depends on. Local (8 cores, warm cache) never hit the window; CI (2 cores, cold compile)
> hit it twice. Fixed with an explicit `laidOut()` gate: fonts ready **and** the article
> clamped to `--measure-doc`. The assertion is unchanged and still reports 89 at 680px.
> Full suite re-run cold and warm: **277 / 277, zero flaky.**
>
> 🔴 **Three verification traps, all now in CLAUDE.md 11i and `coding-standards.md` §14.**
> (i) A CSS-only edit was served **stale** on the first run after it — I deleted the rule I
> thought made the rail stick, the guard passed, and the honest-looking conclusion was "my
> guard is useless". The second run compiled the change and failed correctly. **This is the
> one failure mode that makes a working test look broken, so it invites you to delete it.**
> (ii) `railTop ≤ 90` **passed at −317** — the rail scrolled clean off the top — because a
> one-sided bound tests the direction that was never the failure mode. (iii) **A flaky test
> was a real defect, not flakiness** — see below.
>
> 🔴 **Smaller type made the page shorter, and that broke the rail.** One test went flaky;
> tracing all eight clauses instead of re-running it showed that clicking clauses **05, 06,
> 07 or 08 all highlighted "Contact"**, because at 13px the document is ~1.9 screens and
> those clauses sit where no scrolling reaches the offset line, so `useScrollSpy`'s
> bottom-of-page rule won. Fixed with an opt-in `keepClickedAtPageEnd`, leaving the Stock
> Detail subnav and the offline report byte-identical. **A second-order effect of a type
> change, in a shared hook, three files away.**
>
> 🔴 **And a claim of mine was wrong in the source comment.** I documented `align-items:
> start` as the reason the rail sticks. Measured: `start` + clamp → pinned at 82 ·
> `stretch` + clamp → **still** pinned · `stretch`, no clamp → −765. The rail's own
> `max-height` is load-bearing; either alone suffices. Both kept, comment fixed.
> **A mechanism you have not broken is a mechanism you are guessing at.**

- [x] **Fix the two material contrast failures INSIDE Layer G** (not H): the rating tier
      badges **2.38 → 4.73:1** (the page now renders the REAL `.tier-badge`, so no locked
      tier colour was touched) and the "Full disclaimer" link **2.69 → 6.8:1**. The
      remaining six stay with the Layer H sweep. Guarded by `e2e/contrast.spec.ts`.
      ✅ **Superseded 2026-08-22 — the owner brought the whole sweep forward** rather than
      leaving six known failures on a launching site. Public AND signed-in pages now measure
      zero failures with zero deferrals; the sweep found far more than six, including
      `--text-muted` at 2.97:1 (258 failing elements on Browse alone) and 57 pieces of
      direction-palette text on one stock page.
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
- [x] **Every public page is `ƒ`** — FIXED before this list was next read. The cause was one
      session read in `app/not-found.tsx`, which sits in every route's tree; see G3.9 /
      `architecture.md` §7.2c. 7 routes prerendered, 6 correctly dynamic, guarded by
      `pnpm check:render-modes`.
- [x] **Meta descriptions — ten were over, not four, and one was far too short.** Re-measured
      on the built HTML 2026-08-22: landing 221, root fallback 183, five Learn summaries
      157–177, Disclaimer 176, Terms 159, Privacy 156 — while `/contact` sat at **38**. All
      rewritten. Guarded by `e2e/seo.spec.ts`, which reads the RENDERED tag (the landing
      interpolates a live count, articles come from the registry, the sign-in pages inherit the
      root layout — three routes to one tag, and only the wire sees all three). The 70-char
      floor applies to indexable pages only: a `noindex` page never gets a snippet, so
      demanding one there would be inventing work.
- [x] **JSON-LD — `Organization` + `WebSite` on the landing, `Article` on each of the twelve
      Learn pages** (`lib/jsonld.ts`). No `FinancialProduct`, no `Rating`, no `AggregateRating`
      — a rich result reading "MajorCycle rates AAPL 72/100" is the single most damaging
      sentence this site could emit, and rating markup is how it happens by accident. No
      `SearchAction` either: we have no public search, and declaring one describes a feature
      that does not exist. `DefinedTerm` is moot — `/glossary` was dropped. Every value is
      derived from `SITE_ORIGIN`, `OG_IMAGE` and the article registry, so the block cannot
      drift from the page. ⚠️ Verified on the wire that `application/ld+json` costs **zero**
      CSP violations (injected one and counted: 14 before, 14 after) rather than assuming it.
- [x] **OG image — superseded and already shipped.** One sitewide committed PNG built by
      `scripts/build-og-image.mjs`, not runtime `next/og`: an ImageResponse puts a font fetch
      and a satori parse between a social crawler and a card, and the owner cannot debug a
      serverless font failure from outside. Done in G2 step 4.
- [ ] **Submit the sitemap in Search Console — AT MERGE, not before.** `/sitemap.xml` 404s on
      production until Layer G is live, and submitting a 404 teaches Google to distrust it.
      *(Google retired the "ping on deploy" endpoint in 2023; it now 404s. The mechanism is
      the `Sitemap:` line in robots.txt plus one manual submission.)*
- [x] **Image optimisation** — every image on the public site is local and served through
      `next/image`; the one raw `<img>` left is inside the offline report bundle, where
      `next/image` cannot run (it is an esbuild artifact opened over `file://`, CLAUDE.md 11d).
      Public pages score **100 on Lighthouse performance**, so there is nothing here to chase.
- [ ] Bundle size audit — remove any unused deps
- [~] **Lighthouse — MEASURED for the first time (2026-08-22), and it found real work.**
      `pnpm lighthouse` drives the PRODUCTION build on :3200 (never dev), signs in with real
      cookies for the gated routes, and prints the URL it LANDED on beside every reading so a
      redirect cannot pass for a measurement. **Public pages: 100 / 100 / 96 / 100.** The
      ticker page decision #33 actually names came in at a median of **61**, now **84** — the
      remaining 6 points are recorded below and are owner's call.
      ⚠️ **One run is not a number.** The same unchanged page scored 85, 81, 76, 63, 62 across
      five consecutive runs and drifts downward as the machine warms, so the tool now takes the
      MEDIAN of 3 and prints the raw scores beside it. I reported a 26-point gain from a single
      reading that was really 15.
      ⚠️ **SEO is not scored on the two gated routes.** They are `Disallow`ed on purpose, so
      Lighthouse hands them 58–66 for `is-crawlable`; reporting that as the site's worst score
      would be flagging correct behaviour as a defect.
- [x] **Config review — all three decided, and two of them stay at the default ON PURPOSE**,
      which is now written down: "nobody chose this" and "we chose the default" look identical
      from outside, and this repo has been bitten four times by the difference (11a).
      **(i)** `poweredByHeader: false` — `X-Powered-By: Next.js` was going out on every
      response, verified on the wire and now verified gone. **(ii)** No `images` block: every
      image is local, and an unset `remotePatterns` is precisely what stops our optimiser being
      an open proxy. **(iii)** CSP **stays Report-Only** — ✅ *superseded: flipped to enforcing
      on 2026-08-23, see G7 below; the paragraph is kept as the record of what was measured
      and why the flip was scoped rather than done that day* — measured on the production build,
      every page reports `script-src-elem :: inline` (14 on `/terms`, 28 on the landing,
      scaling with page complexity: Next's own hydration bootstraps). Enforcing needs a
      per-request nonce threaded from `proxy.ts`, whose failure mode is "the page loads but
      nothing works", on pages including sign-in. **→ Layer H, with its own verification.**
      ⚠️ **The other blocker was a real policy bug and is now fixed:** `style-src` was missing
      `https://accounts.google.com`, so `/login` and `/signup` each reported
      `style-src-elem :: .../gsi/style`. Harmless only because the policy reports rather than
      blocks — **a Report-Only policy that is wrong is a trap primed for whoever flips it.**

**Verification:**
- ~~Lighthouse CI runs in `.github/workflows/ci.yml`~~ ❌ **This was never true.** No
  workflow has ever mentioned Lighthouse — checked across all four on 2026-08-23. It is
  `pnpm lighthouse`, a **local** script driving the production build on `:3200`, and it is
  deliberately not in CI: it needs a production server, a real session for the gated routes,
  and the median of 3 runs (one run is not a number — the same page scored 85→62 across
  five). A plan line that describes an intention reads exactly like a line that describes a
  fact once the work is done.
- Test URL via Google's Rich Results test
- Test OG images via Twitter/LinkedIn debuggers
- `curl` proves `/sitemap.xml` and `/robots.txt` answer **200 signed-out**, not 307

> #### ✅ G4.3 — the library is written. 2026-08-20, still inside PR #89.
>
> **Twelve articles, zero "Coming soon" rows.** The eleven titles announced under the three
> topics have all been written, so the field that carried them is empty on every theme and a
> reader meets no promises. That closes the ratio question raised in G4.1 (one article beside
> eleven announcements) by writing them rather than by trimming the list.
>
> Four articles landed in this batch — `own-history-vs-market-average`,
> `how-long-do-recoveries-take`, `is-a-dividend-safe`, `what-majorcycle-doesnt-do` — each with
> its own figure built from derived geometry, and each figure guarded. Playwright **419 → 464**.
>
> ⚠️ **`How long do recoveries actually take?` was written as an honest "we don't know".** The
> engine holds magnitudes only — `typicalDrawdown`, `typicalProfit`, the event counts — and no
> durations anywhere. Rather than retitle away from a question people actually type, the article
> answers it truthfully and explains what is measured instead. Its figure is labelled
> illustrative in words, because a chart drawn in our house style otherwise implies it is a chart
> of our data.
>
> ⚠️ **`What the five tiers mean` was FOLDED into `how-to-read-a-majorcycle-rating`** rather than
> written separately — two articles about one rating would compete for the same search and repeat
> each other, which is the shape `learn.spec.ts` already polices between articles. Recorded in
> `lib/learn.ts` rather than silently dropped, and the rating article's own "will not do" list was
> trimmed to a link so the limits live in one place (11c).
>
> **Three findings from the audit, all fixed:**
>
> - **`.reading ul` was insetting every figure list by 17.55px** — see CLAUDE.md 11c (vii). The
>   limits figure's "today" rule missed the bar it marks by 17px and looked deliberate. Fixed with
>   a `.figure-list` opt-out; the other four figures had the same latent inset.
> - **Four of the eight published reading times were a minute out**, all inside the guard's ±2
>   tolerance, none of them edited since the last count. Every one of the twelve is now measured
>   and exact.
> - **The overflow guard existed for ONE article**, and the axis-collision guard for one figure.
>   Both now walk the registry. Proving the first cost a break: widening a figure to 420px on a
>   375px screen left `documentElement.scrollWidth` unchanged, because an ancestor clips — the
>   reader loses the right of the chart with no scrollbar to say so. The article body's own
>   `scrollWidth` sees it.
>
> ⚠️ **`lib/dividends.ts` is new, and it touched a paid surface.** The payout bands (60/80) and the
> 20% distress-yield flag were literals inside `components/stocks/DividendHistory.tsx`; the article
> states them, which makes the prose a second copy (11c-v). Extracted so both read one constant —
> behaviour and rendered text unchanged. `learn.spec.ts` builds its assertion from the constants and
> carries an off-by-one control.

> #### ✅ G4.4 — the visual audit of all twelve articles. 2026-08-20, still inside PR #89.
>
> Owner asked for every Learn page to be looked at rather than tested. **Sixteen figures
> screenshotted at 1280px and 375px and read as pictures**, then every measurable claim
> re-derived. Six defects and four improvements; Playwright **464 → 464** (three narrow
> guards folded into one broader one).
>
> **Defects, all invisible to the suite as it stood:**
>
> - 🔴 **The analyst figure's "Lowest $82" sat on the "$80" axis tick** — 12px of overlap at
>   **every width including 1280**, for the life of the figure. Three collision guards existed
>   and none compared a marker with a tick. Replaced by one guard that compares **every** piece
>   of text in every figure's drawing, on every article, at six widths, with a vacuity control.
>   The axis offset is now derived from the marker lift rather than hand-typed.
> - 🔴 **A lift that guarded nothing.** "Lowest" was pushed 52px below the bar to clear a
>   neighbour it could never collide with (80% of the plot away), which is what dropped it onto
>   the axis and forced ~90px of empty panel. Removed; the panel padding is derived too.
> - 🔴 **`8 yrs` wrapped to two lines** on the recovery axis, and `1 yrs` was about to print on
>   the next figure. One `yearTick()` now spells every year marker.
> - 🔴 **The dividend axis stopped at "4 yrs" under a caption promising six years** — 24 quarters
>   spans 5.75, so the 6-year tick was filtered off. Now 25.
> - 🔴 **24% of the bargain figure's chart box was empty**, reading as a break between the price
>   line and the five checks rather than one company described twice.
> - 🔴 **`1 yr ahead` was added to the limits axis and taken straight back out** — 2px of overlap
>   with "today" at 375px, 5px at 360px. The horizon moved into the analyst row's own note, which
>   has room for words. Shortening the label would have kept a collision class alive for a mark
>   nothing needed.
>
> **Improvements, where the picture was correct and did not explain itself:**
>
> - **The index-vs-average figure was four tangled lines.** Its caption asserted three depths and
>   that they happened in different years; the drawing showed neither. It now has a time axis, a
>   dot on each trough and its depth beside it — all read off the curves.
> - **The recovery figure's durations moved onto the chart** (dot at each return to peak), and its
>   three-row legend — every row reading "back to its old peak in …" — is gone.
> - **The dividend figure names its two events**: "dividend cut" on the upright, and a dot marking
>   where the payout ratio first passed the line. The caption's headline is "6 quarters earlier",
>   which is a DISTANCE, and only one end of it was on the chart.
> - **The correction/crash lines are labelled.** On the one page whose subject is which word goes
>   where, the figure drew two unnamed dashed rules.
>
> ⚠️ **One reported defect was my own measurement error, and it is the reason for the rule.** I
> read a downscaled 1× screenshot as showing the "$100" axis label struck through by a rule and
> was about to fix it; a 4× capture showed a clean gutter and a tick mark. **Derive the finding
> from a number, not from a picture of a picture** (11o) — the probe had said "none" and was right.

> #### ✅ G4.5 — owner's read-through, topic 01. 2026-08-21, still inside PR #89.
>
> Owner read the five "Falls and recoveries" articles and approved 1, 2 (after one edit) and 3.
> Playwright **464 → 465**; all five guards, `pnpm build` and pytest 153 green.
>
> - **Article 2** — the 52-week-high cross-reference moved to close the section, after "A more
>   useful sentence has the company's own history in it", rather than splitting that pair from
>   the "close to useless" paragraph it answers.
> - **Article 4** — the three curves are labelled **Company A / B / C** on the drawing. They were
>   already named A/B/C in the geometry and in two other articles' figures; only the trough
>   labels had dropped the name, so the caption asserted three depths with nothing on the picture
>   to attach them to. Names and depths both read off the curves.
> - **Article 5 — REWRITTEN, and the old version was answering the wrong question.** It said
>   "nobody can tell you, and we measure magnitudes only", which is true and stops one step short:
>   the stock page draws the price and the drawdown on **one shared time axis**, so a reader can
>   measure how long each of that company's past recoveries took. The article now teaches that
>   reading — the curve leaves zero when the price passes a high and touches zero when it gets
>   back, so the **width** of the shaded stretch is the duration — and covers the Profit Recovery
>   view as the same chart measured from the low. The honesty is kept where it belongs: depth does
>   not predict duration, three past falls is not a distribution, the company may not be the same
>   company, and the current stretch is unfinished by definition.
>   - New `PriceRecoveryFigure` + `priceRecoveryGeometry`: one price path, the drawdown **computed**
>     from its running peak, and every underwater stretch **found by scanning that curve** rather
>     than declared beside it — so the durations in the caption are readings off the drawing
>     (11c-iii). Three stretches, two finished and one still running.
>   - `RecoveryTimeFigure` + `recoveryGeometry` are now unreferenced. **Left in place pending the
>     owner's word** — nothing is deleted here without asking.
> - **Axis labels, every figure** — see `design-system.md`. The gap was 57px on nine figures and
>   12px on two; it is 8px on all of them, and the x-tick rows hang off the floor line rather than
>   the bottom of the box.
>
> ⚠️ **Three method notes from this round.** (i) A probe reported the "$100" axis label as
> struck through at 1280px — the same false positive as G4.4 — and this time the cause was found:
> `getBoundingClientRect()` includes **padding**, so an 8px gap held as padding reads as a label
> flush against the plot. The gap is now a margin, which makes the box honest for every future
> guard. (ii) A test of "all labels below, taller mobile panel" came back with *every* axis label
> overlapping — which was not the experiment failing but `aspect-[16/16]` not existing as a
> Tailwind class, collapsing the panel to zero height. **An undefined CSS class is silence, and
> silence looked like a result.** (iii) The label-side rule that got written, verified and then
> deleted is recorded in `indexGeometry.ts`: it worked, and it swapped one collision for a worse
> one, and the dull fix (a halo, and more height) was right.

> #### ✅ G4.6 — owner's second pass on topic 01. 2026-08-21, still inside PR #89.
>
> Four items, one of them a red CI. Playwright **465**, pytest 153, all five guards green.
>
> - **CI was red** on `no two labels overlap`: at 360px the dividend figure's `100%` axis
>   label sat **2px** over a chart label. It passed on Windows and failed on Linux, because
>   the same font renders a hair wider there — and the guard only failed *after* an overlap
>   existed. It now demands **2px of daylight** (11i-b); the library clears that by at least
>   3px everywhere, measured. Two lines of one label touch by design, so `data-label-group`
>   marks them as one — without it the stricter rule flags correct behaviour, which is how a
>   guard gets deleted.
> - **The y-axis gutter is now 44 PIXELS, not 15% of the panel.** See `design-system.md`. It
>   held a 29px number in 172px of margin at 1280px, so every chart on the site started a
>   sixth of the way in from its own card. Every drawing now sits in a `Plot` wrapper.
>   ⚠️ Which immediately produced 11c-iv for the fifth time: the dividend figure's shared
>   time axis is a *sibling* of its two panels, so it stayed at the card edge while they moved,
>   and every year marker pointed 44px left of the data it labels — rendering perfectly.
> - **The halo is gone and the labels moved instead**, at the owner's instruction, and they
>   were right: painting the panel's ground behind a label interrupts the curve, so
>   `dip-correction-crash` lost a length of the dashed rule the figure exists to explain. The
>   three companies in the index figure were **reshaped** so they fall at clearly separated
>   times and the deepest one owns the index's low — then nothing passes under any trough and
>   no placement rule is needed at all. Depths are now exactly −20 / −50 / −30 because every
>   keyframe x joins the sample grid; before that they were −49.4 and −30.5, printing numbers
>   nobody chose in a figure whose subject is comparing depths.
> - **Article 5's prose rewritten again.** Too many italics (5, against 0–3 everywhere else —
>   now 0) and it read as machine-written. The `answer` also assumed the reader had seen our
>   stock page; it now describes the idea, not our UI.
> - `RecoveryTimeFigure` + `recoveryGeometry` deleted at the owner's word.
>
> ⚠️ **CI went red a SECOND time on the same pair, and the second round is the lesson.**
> The 2px margin was the right rule and it still could not see this: "more than it earns" is
> anchored to a dot a third of the way across the plot and spends its width *leftwards*, so on
> a narrow screen it left the drawing entirely and landed in the axis gutter. On Windows it
> escaped by 3px and cleared the axis label by 5px — green. On Linux the same phrase is ~6px
> wider — a 3px collision. **A label leaving its own plot is wrong at any font size**, which is
> the assertion that holds everywhere, so `learn.spec.ts` now carries *"no chart label hangs
> outside its own plot"*. It bounds each side by its own allowance: **zero into the left gutter,
> `PLOT_RIGHT_PAD_PX` on the right, read off the element rather than hard-coded.**
> ⚠️ **Its first version allowed 4px of slack** so an end label could overhang, and 4px is
> exactly what let the defect through — it escaped by 3. The overhang turned out to be the same
> family of bug (a right margin measured as a percentage of the panel), so it was fixed at the
> source instead of tolerated in the guard. **A guard's slack is where its defects live.**
> ⚠️ And the right pad then shortened every plot through its aspect ratio, closing the price
> panel's four axis labels to 2px apart: **a change at one edge of a box is a change to its
> height.**
>
> ⚠️ **Method note.** A test of "all labels below, taller mobile panel" came back with
> *every* axis label overlapping — not the experiment failing, but `aspect-[16/16]` not
> existing as a Tailwind class, collapsing the panel to zero height. **An undefined CSS class
> is silence, and silence looked like a result.**

> #### ✅ G5 — Lighthouse, accessibility, structured data, config. 2026-08-22, still inside PR #89.
>
> The four measurement-and-plumbing items the owner asked for before the weekly note (now `/articles` — G8).
> Playwright **503** tests, pytest 153, five guards green, build clean.
>
> ⚠️ **Two tests fail LOCALLY in a long run and pass in isolation** — `/report` answering
> **404 where 402 is expected**, and the report download therefore never firing. They are the
> same pair the owner asked about, and the earlier hypothesis (a 52-week tooltip changed on
> the page but not in the report) is ruled out by evidence: that string exists in exactly one
> file, the report imports the same `StockHeader` that renders it, `check:report-sections`
> matches 22 sections, and neither test mentions the gauge. Not reproduced in isolation
> (46/46), and **CI is the authority** — it has run this suite green every time. Recorded
> here rather than explained away: a 404 from that route means `readStockRow` returned no
> row for AAPL with no error, which no code path in `stocks.ts` explains, so the cause is
> environmental to this machine rather than understood.
>
> **The one real defect, and it was costing every reader half a megabyte.**
> `prefetchReportBundle()` ran on mount for **every viewer**, pulling the 588 KB offline
> report bundle into the critical window of every ticker page — including free accounts,
> who see a lock where that button is and whose `/report` request would only ever answer
> 402. Note the shape: the sibling `warmReportData()` has always checked `entitled`. **The
> rule existed and one of its two consumers never received it** (CLAUDE.md 11c-iv, sixth
> instance). Now gated on entitlement *and* deferred to `requestIdleCallback`, because
> prefetching is a courtesy to the next click and must never compete with the page the
> reader is waiting on. Hover still warms it instantly, so a customer who goes straight for
> Download waits no longer. Measured, median of 5 runs each: performance **61 → 76**,
> blocking time **534ms → 286ms**, and the exact non-noisy fact — **588 KB on every load →
> 0 KB on every load**.
>
> **What is left on that page.** The median is **84** against decision #33's 90. The
> remaining drag is the page's own weight: a 655 KB document (the full price history
> inline), ~114 KB of unused JavaScript, and the chart libraries booting. Closing it means
> code-splitting the charts and deferring below-fold sections — real architectural work on a
> **paid** surface, which is not something to do unasked (11l).
>
> ✅ **ASKED AND ANSWERED 2026-08-22 — the owner authorised it**, verbatim: *"I am happy for
> you to proceed so that we have good score for lighthouse for the paid surface"*, and, on
> scope, *"We will need to do it for all pages and ensure the scores is as high as possible
> without compromising security. Always read latest docs for best practices."* Bounded by the
> standing constraint in the same message: *"security over anything. However, try to find
> ways to optimise it without hampering security."*
>
> ⚠️ **So this is OUTSTANDING WORK, not a pending decision**, and it was mis-filed as the
> latter on 2026-08-23 — I listed it back to the owner as "owner's call" when the call had
> been made the day before. **A line that says "owner's call" outlives the call unless
> someone edits it**, and the person most likely to read it next is the one who wrote it.
>
> **Accessibility — `e2e/a11y.spec.ts`, axe-core inside the existing Playwright runner** (no
> second test runner, ever). Every public page, WCAG 2.1 A + AA, credential-free. **All
> clean** except the one subtree then carrying `[data-legacy-contrast]`, which was excluded
> *and bounded*: a second test scanned with no exclusion and required every violating node
> to be inside that marker, and at least one to exist — so the exemption could neither grow
> nor sit there excusing nothing (14g).
>
> ✅ **2026-08-22: that exclusion is gone and the public scan is clean with none.** The same
> two instruments now also cover the SIGNED-IN product (`app-a11y.spec.ts`,
> `app-contrast.spec.ts`), which had no accessibility evidence of any kind before that date
> — including a second pass over the stock page on a throwaway PAID account, because the
> shared E2E account cannot see the Verdict card, the radar or the rating badges.
>
> ⚠️ **Three instrument failures in a row, and each one nearly became a finding.**
> **(i)** Axe composites `opacity`, so it read the landing's un-revealed scroll blocks as
> `#eaeff6 on #f1f4f8` — 175 "serious" contrast violations on a page whose colours are fine.
> That is CLAUDE.md 11q from the other side: our own probe once could not see opacity and
> scored invisible text as passing. The fix is to measure a state a reader is actually in —
> `reducedMotion: 'reduce'`, which the landing already honours by forcing every reveal open.
> **(ii)** `test.use({ reducedMotion })` **silently did nothing** — `matchMedia` still said
> `false` — so the scan kept failing and I spent a round believing the page was broken.
> `page.emulateMedia()` works. The control now asserts the media query is really on, because
> the failure mode of that setting is a scan that reports a clean page it never looked at.
> **(iii)** The first version went **flaky** on two article tests: `networkidle` is not "the
> page is finished", and an article's figures are positioned from the reading type scale. It
> now waits on the same `.reading` 17px sentinel `learn.spec.ts` uses — a positive signal the
> measurement depends on, not a proxy for readiness.
>
> ⚠️ **And a measurement error of my own, which is the one worth remembering.** `pkill -f
> "next start"` **silently failed**; the new server died with `EADDRINUSE` and the process
> still answering on :3200 was the OLD one, serving route modules from memory while the
> static chunks on disk had been overwritten by a rebuild. The result was a Frankenstein page
> — a 500 on a chunk that exists in no build — which I chased as a real defect, and a "58 →
> 84" improvement that was partly an artifact of a component whose JavaScript had failed to
> load. **A command that succeeded is not a state that is true** (11o). Kill by PID, confirm
> the port is free, then start. The honest numbers are the medians above.
>
> **Structured data** and the **config review**: see the two ticked items in the G list above.
> The short version — `Organization`/`WebSite`/`Article` only, nothing that asserts anything
> about a security; `poweredByHeader` off; no `images` block on purpose; CSP stays
> Report-Only with the reason and the remaining blocker written down, and the one genuine
> policy bug in it (`style-src` missing `accounts.google.com`) fixed.
> ✅ **The CSP half was superseded the next day — see G7.** What G5 contributed was the
> measurement that made the flip decidable: 22 pages, 186 violations, every one of them
> `script-src-elem :: inline`.
>
> ⚠️ **`tsconfig.json` no longer type-checks `.next-dev`.** `pnpm build` failed twice in this
> session on a truncated `.next-dev/dev/types/routes.d.ts` — a file the *dev server* owns and
> was rewriting. The production build's success must not depend on another process's scratch
> directory; `.next-dev` is now excluded.

> #### ✅ G4.7 — owner's read-through, topics 02 and 03. 2026-08-22, still inside PR #89.
>
> Playwright **466**, pytest 153, all five guards green, `pnpm build` clean.
>
> - **Articles 6, 7, 10 and 11 approved as written.** Article 8 renamed its two companies
>   C/D → **A/B** (there was no A or B in that article; the lettering had simply continued
>   from article 6's figure, which is a different article).
> - **Article 9's two above-bar labels now share one row**, at the owner's request. ⚠️ The
>   obvious fix was wrong and a guard caught it: widening the gap by raising the consensus
>   target 124 → 136 changed what the picture *claims* — consensus upside 24% → 36% against
>   an unchanged 96% spread, so it argued 2.7× where the prose argues 4×, and the spread
>   test (bounded at 3×, deliberately a margin) went red. **The room had to come from the
>   label, not the data**: "Average target" → "Average", 91px → 52px. Clearance is 80px at
>   1280 and **14px at 375**, measured.
> - **Article 9 contradicted the product** and the owner spotted it: it said we show the
>   consensus, the low, the high and the count, which reads as the complete list. Smart Money
>   Activity also plots **individual rating changes** against the price — firm, from-grade,
>   to-grade, date — and derives a consensus label from them. Two paragraphs added; the free
>   -tier closing line now matches.
> - **Article 12's figure was wrong about our own engine**, in the way that is hardest to see:
>   plausibly. The price-history bar was drawn from `PRESETS.long.lookbackBars` — 3 years —
>   and the owner corrected it twice over. **(i)** Custom runs reach
>   `CUSTOM_PARAM_BOUNDS.lookbackBars.max` = 5040 bars, **20 years**. **(ii)** More
>   fundamentally, the lookback is not "how far back we look" at all: in
>   `calculate_cycle_metrics` it is the width of the *rolling* window that defines a high,
>   while `pullback_list` — what `typical_drawdown` and `lower_bound` are built from, and
>   therefore what the valuation score rests on — is collected across the **whole** dataframe,
>   which the provider loads with `period="max"`. The bar now runs **off the left edge with no
>   end**, and the past tick sits well inside it so it cannot read as a beginning.
>   ⚠️ **A test was guarding the false claim**: it asserted the bar matched the long preset
>   exactly, and passed for the figure's whole life. Replaced by one asserting the *absence*
>   of an end, with both old values as controls.
> - **The dashed "today" rule no longer crosses text**, and each row's heading now sits with
>   its own note above the bar rather than split by it. Both owner calls, both right. The rule
>   is segmented per bar track — which creates a failure a single line could not have, so the
>   guard asserts the segments share one x *and* that none lands on a text rectangle. Broken
>   on purpose four ways; each named the real defect.
> - **The "verdict" paragraph was factually wrong.** It offered "a verdict that sounded like
>   an instruction" as something we could have built — but there *is* a Verdict card on every
>   stock page. Rewritten to say what it actually is: measured cycle position and price levels
>   back-solved from measured history, and nothing past that.
> - **Answered, not built:** forward P/E. It is collected and typed, and rendered nowhere —
>   and **no P/E of any kind feeds any score** (`analytics/scoring/` mentions none of
>   trailing, forward or PEG). Surfacing it is presentation-only. Still owner's call, still
>   Layer H.
>
> ⚠️ **The two tests reported failing did not fail here.** 46/46 in isolation, then 466/466 in
> the full run, and pytest 153. The owner's hypothesis — a 52-week tooltip changed on the page
> but not in the report — is ruled out by evidence rather than inference: that string exists in
> exactly one file, the report imports the same `StockHeader` that renders it, `check:report
> -sections` matches 22 sections, and **neither test mentions the gauge at all**. What they are
> is the two heaviest tests in the suite — the only ones that load a full stock page and wait
> on the local Python cycle spawn — and they previously failed together at the tail of an
> 11-minute single-worker run that then aborted (21 tests "did not run"). Not reproduced in
> three runs today.
>
> ✅ **DIAGNOSED 2026-08-23, and the cause is not the tests.** They failed again — the report
> route answering **404** where it should answer 402 — and this time reproducibly: three
> failures with a change applied, three passes with it stashed, then six more consistent
> bisect results. All of it was a **stale `.next-dev` cache**, which survives `git stash`, a
> server restart and `reuseExistingServer: false`, so it sat underneath *both arms* of the
> experiment and tracked the edits rather than the code. Moving `.next-dev` out of the repo
> and re-running gave **46/46** on the unmodified change, and the full suite **520 passed +
> 3 flaky = 523** locally against **523 passed** on CI. That closes the owner's *"Ensure the
> two tests pass on the machine. Investigate and fix it."* — the machine was the problem, and
> the fix is the habit: **clear the build cache between the arms of an A/B, not just before
> it.** The three flaky on the cold run were first-compile timeouts on `/stocks` and
> `/account`, not these two. Full account: CLAUDE.md 11i, fifth item.

> #### ✅ G6 — the colour review. 2026-08-22, still inside PR #89.
>
> Playwright **519** (518 + one added), pytest 153, all seven guards green, `pnpm build`
> clean, CI reconciling exactly. Four owner decisions and three defects found while
> implementing them. Commits `c9430bb`, `953445b`, `c304cd8`, `bd37d76`.
>
> **1 · The ink layer.** Measuring the signed-in pages for the first time showed the
> direction palette is not only fills and lines — it was **57 pieces of TEXT** on one stock
> page, worst **2.11:1**: the "Key Risks" heading, Current Drawdown, the analyst consensus
> figure, every earnings beat and dividend streak. Green-for-up is a convention the owner
> had explicitly scoped out, and it still is: **a rising candle is untouched.** Only the
> *sentence about it* deepens, via `--c-*-ink` / `lib/ink.ts`. Three near-miss golds
> (`#D4A017`, `#9A7010`, `#B58800`) collapsed into one. ⚠️ ONE exception is a Recharts
> fact rather than a choice — a legend entry is painted in its series' own colour, so for
> a series the mark and its label cannot diverge; the ASX 200 line and the Cash &
> Equivalents bar therefore carry ink.
>
> **2 · Bearish `#B22222` → `#8B1414`, and High Conviction `#006400` → `#065F46`.** Neither
> was a contrast failure. The morning's rating darkening had put **Cautious next to
> Bearish** (10.7 apart, 10.0 to a red-green colour-blind reader) and the owner spotted it
> on sight; fixing that exposed the same defect one row up, where the two greens sat at
> **8.2**. Constructive could not move — 4.80 as text is exactly the house floor — so both
> gaps had to be closed from the other side. The greens use a **pine**, which is as light
> as the old green (the ramp keeps its rhythm) while separating by hue as well as weight
> (colour-blind gap 8.6 → **24.6**; a plain darker green reached only 14.1). Weakest pair
> in the palette went **8.2 → 16.3**.
>
> ⚠️ **Both moves severed a double meaning.** `#B22222` was also the down candle and
> `#006400` the candle border and insider-buy marker; a hex that means two things cannot be
> policed as a copy of one of them. The direction colours stayed exactly where they were,
> so **all five tiers are now checkable** where three were.
>
> **3 · Three faded-text defects, one shape.** A colour correct at full strength, dimmed
> below the floor by something upstream (CLAUDE.md 11q):
>
> | | Was | Rendered | Found by |
> |---|---|---|---|
> | `.verdict-thesis-num` | white on green, `opacity: .85` | 5.31 → **4.31** | measuring the page as a PAYING customer for the first time |
> | `.insight-strength-label` | the new ink, `opacity: .75` | 5.90 → **3.55** | the guard, after the ink landed |
> | `.req-notice-x` | `--brand-mid`, `opacity: .7` | 6.49 → **3.40** | grep — it renders only after a reader adds a ticker, so nothing we own had ever seen it |
>
> A fourth (`MethodologyModal`, `opacity-95`) was never a failure but was spending 0.4 of
> the margin the palette work had just bought; removed.
>
> **4 · What the guards do now.** `check:tier-palette` gained two checks, each broken on
> purpose first: **adjacent-pair separation** (the check that would have caught defect 2 —
> ratchets rather than invented thresholds, in normal vision and two simulated colour
> blindnesses) and the **ink layer's two copies**. ⚠️ Breaking it caught a real mistake: the
> first version updated the comment claiming all five tiers were policed and left the array
> at four. **A comment is not a control.** `app-contrast.spec.ts` now measures the stock
> page a second time on a throwaway PAID account, because the shared E2E account cannot see
> the Verdict card, the radar or the rating badges — the busiest premium surface in the
> product had no evidence of any kind while a spec named after it passed on every run.
>
> **5 · Recorded, not fixed.** Neutral against Cautious measures **5.9** to a deuteranope
> and cannot be improved without costing about as much on Cautious/Bearish. A trade, not a
> win; owner decided to leave it. Nothing is unreadable — every chip carries its score and
> every badge its word, so 1.4.1 is satisfied by the text rather than the colour.
>
> **6 · Two process changes.** The reference HTML is now a **mock-up, not a contract**
> (CLAUDE.md #1 reversed at owner instruction), and `.impeccable/config.json` was deleted:
> both its entries were void and it had silently stopped applying. The accent stripes stay,
> now for a stated reason rather than an appeal to the file. See GA-2 and `design-system.md`
> §1a.
>
> ⚠️ **Traps hit and worth remembering.** (i) The dev server served a **stale compiled
> stylesheet** — `--c-up-ink` absent, `--c-tier-5` still the old red — from a cache at
> `.next-dev/dev/cache`, *not* `.next-dev/cache`, which is the path a previous session also
> got wrong. Compiled CSS **newer** than the source is not evidence it is current.
> (ii) Renaming that stale directory to `.next-dev.stale` left it inside `web/`, where it is
> not gitignored, so Tailwind scanned 6,915 compiled chunks and emitted garbage class names
> that broke the build. Move a stale build **out of the project**, not sideways within it.
> (iii) A 48-minute run with 267 failures was the machine thrashing, not a regression —
> the same tree ran clean in 8 minutes. **Re-run before diagnosing.**


> #### ✅ G7 — the CSP flip. 2026-08-23, still inside PR #89.
>
> The Content-Security-Policy has been `Report-Only` since F0.5 — seven weeks of a header
> that reported and blocked nothing. It now **enforces**, in the shape the owner chose from
> the three costed options (A/B/C in `architecture.md` §7): **option C**, a per-request
> nonce on the routes that already render per request, and A's `'unsafe-inline'` policy on
> the seven prerendered pages.
>
> **Why the split is a fact rather than a compromise.** A nonce must differ per visit, so it
> can only exist on HTML generated per visit. Seven public routes are prerendered on
> purpose — that is the 77ms click against ~674ms (11s) — and their HTML was written at
> build time with no token in it. Sending those a nonce policy does not weaken them, it
> **kills** them: every script refused, the page rendering and then doing nothing. Every
> route that holds a session already renders per request, so the nonce costs nothing
> exactly where it is worth most.
>
> **Built:** `lib/csp.ts` (both forms, `usesNonce()`, the nonce generator), `proxy.ts` (mints
> it, and puts the policy on **every** response it returns — the redirects and the refusals
> included, because a header applied by a helper every `return` passes through cannot
> quietly stop applying to one branch), `next.config.ts` reduced to the four flat headers.
> Measured after the change: prerendered routes still answer `x-nextjs-prerender: 1` with
> `s-maxage=31536000`, so nothing was traded away.
>
> **Guarded three ways, each broken on purpose first.** `check:render-modes` (in CI, reads
> the build output) asserts the nonce set and the prerendered set can never overlap, in both
> directions — the reverse error is silent, a per-request page quietly shipping the weaker
> policy. `e2e/csp.spec.ts` asserts the header is enforcing on every route class including a
> 307 and a 401. `pnpm check:csp` drives the production build on :3200, signs in, and checks
> 12 routes for the right form, the nonce reaching every inline script, the nonce changing
> between requests, `'unsafe-eval'` never appearing, and **zero** `securitypolicyviolation`
> events in a real browser.
>
> ⚠️ **Three findings from the breaks, and two were about my own instruments.**
> (i) Mis-listing `/terms` produced the predicted death exactly: header naming a nonce, zero
> nonce attributes in the document, **14 violations**. That is why `usesNonce` is an
> ALLOW-list — Next serves one prerendered `_not-found.html` for any unmatched path, and no
> middleware can predict that, so an unrecognised route must fall to the working form.
> (ii) **A sabotage that failed to break.** Giving the response a second, different nonce
> came back *matching* on the wire: Next's Node server copies every middleware response
> header onto the request before rendering, so locally the two can never be seen to
> disagree — and **Vercel's edge is not obliged to do that**. The code would have passed
> every local check and shipped a dead page in production only. Fixed structurally: one
> string, built once, used for both. (iii) The nonce check was **stricter than the rule**
> and went flaky — a script with a `src` is judged by its URL against the allow-list and
> needs no nonce, and Google Identity Services injects exactly such a tag.
>
> ⚠️ **A fourth finding, and it cost the most: a false regression that survived a
> controlled A/B.** The report route began answering 404 instead of 402. `git stash`, three
> runs each side, gave **3 failures with the change and 3 passes without** — then a bisect
> gave six more consistent results pinning it on the response header's NAME. All of it was
> the `.next-dev` cache, which persists across a stash, across `reuseExistingServer: false`
> and across a server restart, so it sat under *both* arms and tracked my edits rather than
> the code under test. Moving `.next-dev` out of the repo and re-running gave **46 passed**
> on the unmodified change. The tell was there and I did not take it: "the header's name
> breaks route resolution, but only on a dynamic route handler" is not a mechanism any
> reading of Next's source supports. **Clear the build cache between the arms of an A/B,
> and treat an implausible mechanism as evidence against the instrument.** CLAUDE.md 11i,
> fifth item.
>
> The dev server keeps `'unsafe-eval'` (Turbopack compiles with `eval` for hot reloading),
> gated on `NODE_ENV` and asserted absent in production by `check:csp`.

> **G8 — the Layer G audit. Sessions 1–2 of 8, 2026-08-23. Log: `docs/layer-g-audit.md`;
> coverage map: `docs/layer-g-coverage-map.md`.**
>
> Layers **step zero**, **0** (prove the instruments) and **1** (the coverage map) are done.
> Layer 2 onward is next session.
>
> **All eight `check:*` guards are now proven able to fail** — 13 sabotages, each with a
> control. The three that needed a production build on `:3200` (`render-modes`, `csp`,
> `page-weight`) ran here.
>
> **The coverage map enumerated what the suite does NOT cover**, route by route and state by
> state, from the production build's own route list rather than the `app/` directory. Owner
> approved acting on all eight gaps. **Playwright 523 → 589, pytest 153 → 170.**
>
> **Five real defects, none of which had a failing test, a log line or a visible symptom:**
>
> | | Defect | Now |
> |---|---|---|
> | **F-011** | An unknown ticker — and an unknown market — answered **200**. The 2026-08-18 soft-404 fix reached the public site and never the signed-in product | 404, **and the skeleton kept** (§7.2) |
> | **F-012** | `/api/request-ticker` treated a failed DB read as “not covered” and would **queue a request for a stock we already have**, which the nightly cron would re-fetch | 503 + `Retry-After` |
> | **F-005** | Four of Stripe's eight statuses told a customer they had no subscription when theirs was merely stuck | Each says what happened |
> | **F-009** | The score composition bar was painted in the **pre-2026-08-22** palette, in `r,g,b` form the hex-hunting guard could not see | Derived from `RATING_TIER_HEX` — the copy is deleted, not corrected |
> | **11a ×5** | Five gated API routes sent **no `Cache-Control` at all** on their signed-in responses | `private, no-store`, and the guard widened from 2 files to 7 |
>
> Plus two flaky tests fixed at the cause — one was a Learn figure genuinely **0.5px** from
> breaking at 360px, found by sweeping every article at every width and printing the tightest
> clearance rather than re-running. `analytics/cron/fix_insider_transactions.py` deleted
> (spent); the other two `fix_*` scripts **kept** — `architecture.md` names `fix_split_history`
> as the standing remedy for a corrupted ticker.
>
> ⚠️ **Three of my own diagnoses were confidently wrong and caught by measuring**: a webfont
> theory (blocked the fonts — no change), an image-loading theory (28.2s → 30.2s, no
> improvement), and a first 404 fix that left the status at 200. **A plausible cause that is
> genuinely present is the hardest kind of wrong explanation to catch** (14f).
>
> **Still open for the owner:** the 13px public document size, and the merge-day actions
> (apex 307→308, move off the free hosting tier, submit the sitemap).


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
  - **Deferred here by the owner on 2026-08-17, from the `/learn` audit.** Measured, not
    guessed, and none of it is overflow — every public page still clears 375px cleanly:
    - **The public site has NO navigation between 375px and 900px.** `PublicHeader`'s nav is
      `hidden min-[900px]:flex` and "Sign in" is `hidden min-[520px]:inline-flex`, so on a
      phone *and on a tablet* the footer is the only route to Learn or Pricing. There is no
      hamburger. Deliberate at the time; it is the gap this pass should close.
    - **`/learn` band rhythm at 768–1023px.** Above 1024 the bands are two columns; below it
      they stack, and each illustration then renders ~455px tall, so a tablet reader gets a
      page that is roughly 45% picture. The images are fine; the breakpoint is doing nothing
      between 768 and 1023.
    - **Article rows are 37px tall** on the Learn index (`py-[9px]` on a 13px line), under the
      44px touch guidance.
  - ✅ **Public-link navigation speed — CLOSED 2026-08-18, not deferred.** Raised here
    as a Layer H item and then fixed the same day, because the owner's framing was that
    a reader staring at an unchanged screen assumes the site is broken and leaves.
    Two attempts, one kept, both measured on the production build:
    - ⛔ **A pulsing dot inside each link was built and REMOVED the same day** — the
      owner rejected the look, and it had also inflated both header buttons by 18px
      (its own margin stacked on `Button`'s existing flex gap). Full account, and what
      to do instead if feedback is ever wanted, in `architecture.md` §7.2.
    - **The public pages are now prerendered**, which is the actual speed fix: a click
      on `Learn` fell from **674ms to 77ms** on Fast 3G once the route could be fully
      prefetched. Cause was one session read in `app/not-found.tsx`; see
      `architecture.md` §7.2c for the security review and the four pages that must
      stay dynamic. Guarded by `pnpm check:render-modes`.
    - ⚠️ **Residual, accepted:** on a genuinely bad connection (Slow 3G, ~50 KB/s) the
      click still costs ~2.4s, because the destination's JavaScript has not arrived
      yet, and there is now no indicator during that wait. That is a network floor
      rather than a code defect, and the owner has seen the alternative and declined
      it. If it is ever revisited, use a top progress bar, not anything inside the link.
  - ⚠️ **Owner decisions from that audit — do NOT re-propose:** the Learn index ships with one
    written article against eleven "Coming soon" rows, and the public document type size stays
    as it is. Both were raised, both were considered, both were settled.
- [ ] **Three fundamentals we store, score with, and never show.** Found 2026-08-20 while
      auditing the Learn articles against the running product — two drafts described figures
      the reader cannot actually find, because I had trusted `FundamentalsSnapshot` rather
      than the components. All three exist on every row and are rendered by **no** surface:
    - **`forwardPe`** — the market's expected P/E on next year's earnings. `pe` (trailing) is
      on the Key Metrics table; its sibling is not, on the page or in the report.
    - **`fcfMarginPct`** — free cash flow as a share of revenue. `fcfYieldPct` is shown; the
      margin, which is the one that says whether profit becomes cash, is not.
    - **`sharesChangeYoyPct`** — share count year on year, i.e. buybacks versus dilution. It
      **feeds the shareholder pillar of the Financial Health score**, so a customer can see
      the pillar move and cannot see what moved it.
      ⚠️ Note the shape: nothing is broken and nothing is red. The fields are populated, typed
      and scored — they simply have no JSX anywhere. That is CLAUDE.md 11j (an omission renders
      perfectly), and it was found only because the articles had to state what a reader would
      see. **Owner's call whether to surface them** — adding a row to a paid surface is a
      product change, not tidying (11l), so the articles were corrected around it instead.
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
| ✅ | All tests passing in CI | **Re-read 2026-08-25** from run `32847359890` on `bc7672e`: Python ✅ · Frontend ✅ · E2E **617 passed** · `pytest` **189**. No `flaky` and no `skipped` line in either summary — read the whole block, not the last line matching "passed" (CLAUDE.md 11i). ⚠️ This row said **105/105 and pytest 86** on `ab11e18` until today, a reading taken 2026-08-02 and three weeks stale; the suite had grown five-fold underneath it. **A cited SHA is what stops a number ageing invisibly** — without one, "all tests passing" stays true-looking forever. *Caveat at the time of writing:* the Layer G audit's own commits are local and unpushed, so CI has not seen them; this cites the last SHA it did run |
| 🟢 | Lighthouse Performance 90+, SEO 100, Accessibility 95+ | **MEASURED 2026-08-22** (`pnpm lighthouse`, median of 3, production build). **Public pages: 100 / 100 / 96 / 100.** The per-ticker page decision #33 names went **61 → 84** after the 588 KB report-bundle prefetch was gated and deferred (§ architecture 7.2d). ⚠️ SEO is not scored on the two gated routes — they are `Disallow`ed on purpose, so Lighthouse fails `is-crawlable` and scoring that would flag correct behaviour as a defect. **The last 6 points are owner's call**: a 655 KB document, ~114 KB unused JS and the chart libraries booting — code-splitting a **paid** surface, not something to do unasked. ✅ **Accessibility was measured in G and then FIXED in G**, the owner having brought the sweep forward rather than launch with known failures. `a11y.spec.ts` + `contrast.spec.ts` cover every public page and `app-a11y.spec.ts` + `app-contrast.spec.ts` the signed-in product — **zero violations, zero deferrals**, with one WCAG 1.4.3 logotype carve-out bounded to a single element. |
| ⬜ | Mobile responsive at 375px width | **Layer H** — already triaged and measured there: ~130px overflow, root-caused to the `(app)` shell sidebar, not to page components |

### Content
| | Criterion | Evidence |
|---|---|---|
| 🟡 | Methodology explainer complete and owner-approved | **No longer a page.** `/methodology` was retired 2026-08-13 and the explainer is now `/#how-it-works` (landing sections ⑤+⑥) — public, formula-free, disclaimer above the fold, old URL 308s with the fragment. *Missing:* a recorded owner sign-off on the copy — folded into the Layer F audit's copy pass (F-A5) |
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
| ✅ | Cron monitoring alert tested (force a failure, confirm email received) | **Done 2026-08-06, and the test is the reason the channel changed.** ⚠️ This row read "built but never fired on purpose" until 2026-08-22, long after that stopped being true. Both crons were broken on purpose; both went red with the correct message; **Resend recorded nothing.** Two independent faults: the `RESEND_API_KEY` secret held a key that no longer existed, and `_email()` never looked at the HTTP response, so `requests` returned normally on a rejected send. **The alert had never worked in the project's life** (verified against all 42 messages in the Resend history) and could not report either fault. Resend is gone from the crons; **GitHub's own failed-workflow email is the single channel**, to ayaatnibrasaziz@gmail.com, verified end to end. ⚠️ Still open and owner's call: a **partial** refresh failure is silent — see `project_cron_alerting_2026_08_06` |

---

## 4. Phase 2 — Post-launch Expansion (timing TBD)

Order of priority TBD based on user feedback. Candidate features:

| Feature | Notes |
|---|---|
| **Smart Money Activity UI** | ⚠️ **This row was stale and is corrected here (2026-08-24, audit Layer 2).** It said *"Phase 2 is UI-only"* — but the UI was **built in Phase 1 and ships today**: `SmartMoneyActivity.tsx`, added `3ab37e1` on 2026-05-30, rendered on the Stock Detail page in `#sec-sentiment` with the insider timeline and the analyst rating-change feed. Decision #29 excludes Smart Money from Phase 1 and decision #30 lists it under Phase 2, so **three documents disagreed with the running product** and only the product was right. Found while decomposing the ticker page's Lighthouse score — it is the largest client component on that page (33 KB) — and checked against `git log` before anything was proposed, because the obvious move from a stale doc would have been to *remove a shipped feature*. **What genuinely remains for Phase 2:** the institutional holders table beyond the current donut, and the upgrades/downgrades feed's history view. |
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
🔨 Phase 1 Layer G: SEO + Performance      ← NOW (G1–G7 and /articles done. The audit
                                              ran Layers 0-4 on 2026-08-25, then the
                                              branch moved 73 files, so 2026-08-31 added
                                              a DELTA audit: Layers 0-2 re-run and clean,
                                              4 findings all applied. Layers 3 / 3b / 4
                                              delta + 5a + 5b remain; PR #89 unmerged)
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
