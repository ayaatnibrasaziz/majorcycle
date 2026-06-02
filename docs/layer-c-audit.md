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
| 1 | StockHeader | Thesis | done (S0) | ✅ | Analyst badge lowercase→Title-Case fixed (format.ts). Visual re-confirm pending in S1. |
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
| 17 | MetricsTable (Key Metrics) | Fundamentals | rebuilt (S0) | ⚠️ | Rebuilt as sector/market comparison; data verified vs SQL. PENDING: visual + 375px + sort/tooltips re-verify (S1); beginner-clarity softening (S5). |
| 18 | SmartMoneyActivity | Sentiment | S6 | ⬜ | 548 lines; flagged as built without full design-system adherence. Kept despite Phase-2 spec. |
| 19 | OwnershipStructure | Sentiment | S6 | ⬜ | Recompute donut %; verify holders table. |
| 20 | ShortInterest | Sentiment | S6 | ⬜ | Recompute short %/days-to-cover; null AU handling. |
| 21 | NewsFeed | Sentiment | S6 | ⚠️ | Decoupled to daily refresh (backend proven). PENDING: populate via merge + render re-verify (S1). |

## Cross-cutting items (apply site-wide)

- ⬜ Insufficient-data states (replace fabricated "neutral 50"; no fake scores). — S2/S3/S9
- ⬜ Sanity-bounds on absurd values ($0.08-class). — S9
- ⬜ "via Yahoo Finance, may be delayed/estimated" source labels. — S9
- ⬜ Beginner explainers/tooltips/onboarding on jargon. — S5
- ⬜ Stock search + curated landing (fix /stocks 404). — S4
- ⬜ Methodology page (heuristic framing, ASIC-honest). — S10

## Known data issues (carry-over)

- News column 0/720 until PR #9 merges to main + cron/manual refresh runs.
- Short interest null for some ASX tickers (yfinance limitation) — handle gracefully.
- CA universe ~67 stocks → some sector medians/scores will show "Insufficient data".
