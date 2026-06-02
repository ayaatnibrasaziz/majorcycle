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
| 9 | DrawdownOverlay | Cycle | S7 | ⬜ | Recompute drawdown %; pivot markers; synced axis. |
| 10 | AnalystTargetTrack | Cycle | S7 | ⬜ | Recompute marker positions + implied upside. |
| 11 | RelativePerformance | Cycle | S7 | ⬜ | Recompute alpha vs home-market index. |
| 12 | EarningsHistory | Fundamentals | S8 | ⬜ | Recompute beat/miss + surprise %. |
| 13 | QuarterlyFinancials | Fundamentals | S8 | ⬜ | Rev/GP/OpInc/FCF; annual/quarterly toggle. |
| 14 | ValuationHistory | Fundamentals | S8 | ⬜ | PE history; empty state <4 pts. |
| 15 | BalanceSheet | Fundamentals | S8 | ⬜ | Recompute net cash; stacked bars + debt line. |
| 16 | DividendHistory | Fundamentals | S8 | ⬜ | Annual totals; non-payer empty state. |
| 17 | MetricsTable (Key Metrics) | Fundamentals | rebuilt (S0) | ✅ | Rebuilt as sector/market comparison; data verified vs SQL. **S1: re-verified** — 12 rows, columns Metric/Value/vs Sector/vs {market} (localised US market/ASX/TSX), green/red/gray color-coding correct, tooltips correct, table contains own horizontal scroll at 375px (`.km-scroll`). 🔧 Fixed: sector header now names the sector (`vs Technology`, was generic `vs Sector`). PENDING: beginner-clarity softening (S5). |
| 18 | SmartMoneyActivity | Sentiment | S6 | ⬜ | 548 lines; flagged as built without full design-system adherence. Kept despite Phase-2 spec. |
| 19 | OwnershipStructure | Sentiment | S6 | ⬜ | Recompute donut %; verify holders table. |
| 20 | ShortInterest | Sentiment | S6 | ⬜ | Recompute short %/days-to-cover; null AU handling. |
| 21 | NewsFeed | Sentiment | S6 | ⚠️ | Decoupled to daily refresh. **S1: news now populating** (refresh run after PR #9 merge); empty-state + populated cards render correctly. 🔧 **Critical prod-crash fixed**: NewsFeed is a Server Component but had `onMouseEnter`/`onMouseLeave` handlers → "Event handlers cannot be passed to Client Component props" → "Something went wrong" on every news-bearing ticker in production (PR #11; replaced with `.news-row:hover` CSS; verified clean in prod logs). Full design-system/parity audit still pending in S6. |

## Cross-cutting items (apply site-wide)

- ⬜ Insufficient-data states (replace fabricated "neutral 50"; no fake scores). — S2/S3/S9
- ⬜ Sanity-bounds on absurd values ($0.08-class). — S9
- ⬜ "via Yahoo Finance, may be delayed/estimated" source labels. — S9
- ⬜ Beginner explainers/tooltips/onboarding on jargon. — S5
- ⬜ Stock search + curated landing (fix /stocks 404). — S4
- ⬜ Methodology page (heuristic framing, ASIC-honest). — S10

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

### S2 — Methodology proposal (next, no code)
See the continuation prompt / plan. Write `docs/methodology-audit.md` with proposed engine changes for owner sign-off before any code.
