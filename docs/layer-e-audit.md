# Layer E — Results Tab Audit Tracker

> Living checklist for the multi-session production-readiness audit of the
> **Results** tab (`/results`). Mirrors `docs/layer-c-audit.md` and
> `docs/layer-d-audit.md`. Update this file in the same PR as each session's
> fixes.
>
> Layer E = the ranked table that reads the **in-memory** run (`useAnalysis()`
> → `AnalysisContext` + the `mc:analysis-snapshot-v1` sessionStorage snapshot)
> and DERIVES every rating in the browser — never read from / written to the DB
> (CLAUDE.md #15). It was *built* across PRs #38/#39 + the index-membership
> follow-ups (#41/#42/#43), all merged + live as of 2026-06-24. This audit takes
> it from "built" to "production-ready for a mass-retail beginner" — audit-then-fix.

## Definition of "audited" (10 checks)

Each surface passes all ten where they apply, verified on a seeded snapshot
spanning **US + AU + CA** tickers + an outlier (cap testing) + skipped (one
known, one unknown), and cross-checked against the matching `/stocks` detail pages:

1. **No-recompute / calc parity (#15)** — ratings DERIVED client-side from the
   in-memory run; nothing read from / written to the DB. Independently recompute
   `ratings.ts` (tier/label/colour, zone, cyclePosition, healthColor,
   valuationAppeal, briefing) + `columns.ts` `buildRows`/`formatValue` and match
   the snapshot **and** the same ticker's `/stocks` detail page. Display **caps
   are display-only** — sort/filter/CSV use raw `get()`.
2. **Ranking + column-sort correctness** — default Overall desc; every sortable
   column sorts right (numbers/scores desc-first, text asc-first); toggle flips;
   stable ties; header reflects direction (`aria-sort`).
3. **Filter correctness** — advanced multi-rule AND builder (numeric ≥/≤/between,
   categorical multi-select, text contains); quick filters ("Constructive or
   better", Cautious/Bearish), tier-badge click, briefing count pills — all
   narrow correctly + scroll-to-table; `result-count` matches rendered rows;
   clear-all resets.
4. **Skipped split + Request-a-Ticker tie-in** — `/api/listings/status` drives
   the 5 states (covered→"No data yet"+link; listed+requested→"Requested";
   listed+unsupported→"Not supported"; listed+not-requested→Request button;
   not-in-listings→"Not covered", no button); CSV-unknown passthrough lands
   here; Request POST queues + can't double-request.
5. **Compliance — labels (#16) + analyst verbatim (#17) + disclaimer (#4/#12)** —
   only the 5 tiers + zone/appeal words in OUR output (no Buy/Sell); the Analyst
   column is the ONLY Wall-St Buy/Hold/Sell, passed verbatim (`fmtAnalyst`); an
   "information only — not financial advice" disclaimer visible without scrolling.
6. **Parity / visual / colour** — matches the owner-approved reference-parity
   rework (3 view modes, 7 bands, Opportunity Map quadrants, tints, micro-bar,
   cycle gauge) + design-system §4/§5 tiers/zone/health colours; no desktop clipping.
7. **A11y** — table semantics (`thead`/`th scope`), `aria-sort` on sortable
   headers, keyboard (sort headers, view switch, search/filters, export dropdown,
   Opportunity-Map cluster popover, skipped Request buttons), live region on the
   result count, chart `aria-label`/`role=img`, focus-visible.
8. **Empty / edge states** — no run yet; all-skipped (rows=0 but ran); no
   filter match; sessionStorage hydration (reload re-hydrates); nav away→back
   keeps the run; partial/cancelled run; single-row run.
9. **Mobile 375px / no horizontal overflow (#3)** — mobile cards (`md:hidden`)
   render; Full-view table scroll is contained; briefing/provenance/map/skipped
   fit. Layer-H global sidebar overflow out of scope (noted).
10. **Perf on 700+ rows** — `buildRows`/`applyFilters`/`sortRows` snappy; **no
    `Math.max/min` over large arrays (#6)**; chart-instance rules (#5; #8 N/A —
    Recharts not LWC); Opportunity Map + cluster picker render 700+ bubbles
    without jank; full-set CSV export.

Status key: ✅ pass · ⚠️ issue logged · ❌ fail · ⬜ not yet audited · 🔧 fixed this round

## Verification method

- **Claude Preview sweep (observable behaviour):** `DEV_BYPASS_AUTH=true` in
  gitignored `web/.env.local` (guarded non-prod in `proxy.ts` + `(app)/layout.tsx`;
  **remove after**); free :3000 first; `preview_start` name "web"; `rm -rf
  web/.next` after any prod build (§12 CSS-cache gotcha). Seed `sessionStorage`
  `mc:analysis-snapshot-v1` (real US/AU/CA + an outlier + 2 unavailable
  known/unknown) → **reload** so `AnalysisProvider` hydrates on mount.
- **Calc parity (CLI/code):** recompute `ratings.ts`/`buildRows` by hand + cross-
  check a Results row against the same ticker's `/stocks/<m>/<t>` detail page;
  re-affirm analyze.py screener-fundamentals == cycle.py for the shared fields.
- **SQL (Supabase MCP) — the *negatives* + skipped states:** Layer E writes
  NOTHING (#15); SQL confirms no rating outputs are stored, and backs
  `/api/listings/status` against `listings`/`ticker_requests`/`stocks` (project
  `gurrrlogycxawududtyv`, us-east-1). Live-DB writes owner-approved per-action.
- **Deploy-gated tail:** real 700+ row run perf, live queue skipped states, the
  freshness dot — confirmed on `www.majorcycle.com` via Claude-in-Chrome (owner
  logged in), mirroring Layer D.
- **CI gate per session:** `pnpm typecheck && pnpm lint && pnpm build`; if Python
  touched (not expected) → `ruff`/`mypy`/`pytest` + `_engine` drift.

## Surface matrix

Grouped into audit sessions E1–E4. Each surface gets all 10 checks where they apply.

| # | Surface | File | Session | Status | Notes |
|---|---|---|---|---|---|
| 1 | Results (orchestrator) | `web/components/results/Results.tsx` | E1 | ✅ | E1: hydration on mount works (seed→reload→run renders); default sort Overall desc; quick-filter toggles (4→2→4); export wired; empty/scroll deferred to E3. a11y: result-count not a live region (E-a4). |
| 2 | columns.ts | `web/components/results/columns.ts` | E1 | ✅ | E1: `buildRows` enriches name/sector/market + cyclePos; **display caps proven display-only** (GME outlier P/E `>+150x`, ROE `>+300%`, PEG/D-E/CurRatio `>+25`, IntCov `>+100x`, FCF `>+100%`, RevGrw `>+300%`) while sort/filter/CSV use raw `get()`. Full view = 31 cols / 7 bands. |
| 3 | filters.ts | `web/components/results/filters.ts` | E1 | 🔧 | E1: `applyFilters` + `sortRows` correct (nulls last; numeric desc-first, text asc-first). 🔧 **E-f1 FIXED (E4):** numeric `gte`/`lte` with an empty value now returns true (no constraint) — matches `between`/categorical/text. Verified: adding a numeric rule no longer blanks the table (4 results until a value is typed). |
| 4 | ratings.ts | `web/lib/ratings.ts` | E1 | 🔧 | E1: pure helpers, no DB. `cyclePosition` verified (SHOP 44=−15/−34, BHP 18=−5/−28); `valuationAppealLabel`(72)=Attractive; `healthColor` 3-tier; `buildBriefing` top-pick via `reduce` (#6-safe); `fmtAnalyst` the only Buy/Sell, verbatim (#17). 🔧 **E-c1 FIXED (E4):** added `article()` helper → briefing reads "with **an** Attractive valuation". |
| 5 | results/page.tsx | `web/app/(app)/results/page.tsx` | E1 | ✅ | E1: `force-dynamic` server shell; supplies only the `lookup` (name/sector/market) — never ratings. Lookup enriches rows (Shopify Inc. / BHP Group Limited). #15 honoured. |
| 6 | analysis.tsx (read path) | `web/lib/analysis.tsx` | E1 | ✅ | E1: hydrates `results/unavailable/params/runMeta` from `mc:analysis-snapshot-v1` in a mount effect (SSR-safe, try/catch); `persist`→sessionStorage; `writeRun`/`analysis_runs` inputs-only (results NULL) — Layer D verified. No rating read from / written to the DB (#15). |
| 7 | BriefingCard | `web/components/results/BriefingCard.tsx` | E2 | ✅ | E2: built from in-memory rows (#15); disclaimer present; pills are `<button>`; `{{TICKER}}` link is `role=link`+`tabIndex`+Enter/Space (keyboard-OK); `.AX/.TO` stripped; compliant tier language. (Copy nit E-c1 "a Attractive".) |
| 8 | ProvenanceBar | `web/components/results/ProvenanceBar.tsx` | E2 | ✅ | E2: resolved horizon label (medium → −5%/+5%/252d verified; custom branch handled); no provider name (design-system S9); freshness dot decorative. Pure presentation, no a11y issue. |
| 9 | OpportunityMap | `web/components/results/OpportunityMap.tsx` | E2 | 🔧 | E2: quadrants/labels/SPLIT-65/tier colours correct, compliant; cluster picker solid a11y; perf O(n) (no #6; single chart #5; #8 N/A). 🔧 **E-a6 FIXED:** added an `sr-only` chart summary (stocks plotted, Opportunity-Zone count, "values in the table below") — chosen over `role=img` so the interactive legend stays exposed to AT. 🔧 **E-a7 FIXED:** legend tier toggles are now `<button aria-pressed aria-label>` (+ button-reset & focus-visible CSS), keyboard-operable. |
| 10 | ResultsToolbar | `web/components/results/ResultsToolbar.tsx` | E2 | 🔧 | E2: selects have `aria-label`; view-switch `role=group`+`aria-pressed`. 🔧 **E-a3 FIXED:** both quick-chips now have `aria-pressed` (Advanced also `aria-expanded`). 🔧 **E-a4 FIXED:** `.result-count` is now `role=status` + `aria-live="polite"`. 🔧 **E-a5 FIXED:** Export trigger gets `aria-haspopup="menu"`/`aria-expanded`, the menu `role=menu`/`menuitem`, and Esc-to-close. |
| 11 | ResultsTable | `web/components/results/ResultsTable.tsx` | E2 | 🔧 | E2: cells correct (score/health/cyclePos colours, micro-bar 40/35/25, tints, valuation-appeal, analyst verbatim #17); mobile cards keyboard-OK. 🔧 **E-a1 FIXED:** sortable `<th>` now `scope=col` + `aria-sort` + `tabIndex=0` + Enter/Space keydown (+ focus-visible) — keyboard sort verified (Enter → ascending). 🔧 **E-a2 FIXED:** the Ticker cell is now a real `<Link>` (keyboard-focusable, announced) with `stopPropagation`; the row's mouse onClick stays. |
| 12 | SkippedTickers | `web/components/results/SkippedTickers.tsx` | E3 | ✅ | E3: split correct live — AMD→"No data yet" (link /stocks/us/AMD), ZZZZ→"Not covered" (no Request). Summary `aria-expanded`; Request is a `<button>`; 5 states map cleanly. Request/Requested/Not-supported states need a listed-uncovered ticker → build-verified live + re-confirm on E4 deploy tail. |
| 13 | AdvancedFilters | `web/components/results/AdvancedFilters.tsx` | E3 | ✅ | E3: numeric (≥50→3, ≥70→1), categorical multi-select (one-rule-per-field guard), text contains, AND, clear-all, remove all work; field/op selects + cbd `aria-expanded` present. (E-f1 — the empty-numeric blank — fixed in `filters.ts`, row 3.) Component itself unchanged. |
| 14 | listings/status route | `web/app/api/listings/status/route.ts` | E3 | ✅ | E3: read-only batch over listings/stocks/ticker_requests (admin client), dedupe+uppercase, 200-cap, per-symbol {inListings,covered,requestStatus}. Backs the 5 states correctly. No writes. |
| 15 | globals.css (results block) | `web/app/globals.css` | E4 | 🔧 | E4: added focus-visible rings (sortable `th`, `a.ticker-cell`, `.opp-legend-item`), button-reset for the now-`<button>` legend item, and `a.ticker-cell` no-underline + hover/focus styles. No token/colour changes. |

**Session plan:** E1 = no-recompute/calc-parity + ranking/sort + filter logic
(checks 1,2,3). E2 = table/briefing/provenance/map — parity/colour/compliance/
perf/a11y (checks 5,6,7,10). E3 = skipped split + Request tie-in + advanced-filter
UI + empty/edge (checks 3,4,8). E4 = cross-cutting sweep + visual/a11y/375px +
deploy-gated tail.

## Cross-cutting items (apply tab-wide)

- ✅ **Compliant labels only** (#16) — 5 tiers + Compelling…Expensive / Deep
  Value…Stretched words; analyst verbatim (#17) the only Wall-St word (GME→"Sell").
- ✅ **Disclaimer presence** (#4/#12) — global strip + briefing disclaimer both
  visible without scrolling.
- ✅ **No-recompute / nothing persisted** (#15) — ratings derived in-browser;
  `page.tsx` supplies only the lookup; `writeRun`/`analysis_runs` inputs-only.
- ✅ **375px / Layer-H** — E4: at a true 375px every Results component overflows
  ONLY because the global fixed sidebar squeezes the column to ~112px; neutralising
  the sidebar gives **docOverflow=false + 0 overflowing components** (cards 350px,
  mobile cards shown, desktop table `display:none`). 100% the pre-existing Layer-H
  sidebar (no mobile drawer) — Results adds none.
- ⬜ **Deploy-gated tail** — 700+ row run perf + live Request/Requested/Not-supported
  skipped states on the live site (owner-gated, via Claude-in-Chrome).

## Findings summary (awaiting owner fix-scope)

All correctness/compliance/visual/perf/edge checks PASS. The open findings cluster
in **a11y** (the predicted shape, like Layer D) + one filter wart + one copy nit:

| ID | Severity | Surface | Finding | Fix |
|---|---|---|---|---|
| E-a1 | a11y (med) | ResultsTable | sortable `<th onClick>` not keyboard-operable; no `aria-sort`/`scope=col` | make the header a `<button>` (or `role=button`+tabIndex+keydown) inside `<th scope=col>`; add `aria-sort` |
| E-a2 | a11y (med) | ResultsTable | data `<tr onClick=open>` navigates but isn't keyboard-focusable / no link semantics | add `role`/`tabIndex`+Enter-key (mirror the mobile-card `<button>` pattern) |
| E-a3 | a11y (low) | ResultsToolbar | quick-chips (Constructive / Advanced) lack `aria-pressed` | add `aria-pressed` |
| E-a4 | a11y (low) | ResultsToolbar | `.result-count` not an `aria-live` region | wrap `aria-live="polite"` |
| E-a5 | a11y (low) | ResultsToolbar | Export trigger no `aria-expanded`/`aria-haspopup`; menu no Esc-close | add ARIA + Esc handler |
| E-a6 | a11y (med) | OpportunityMap | chart has no `role=img`/`aria-label` text alternative | add `role=img` + a summary (like the Layer C radar) |
| E-a7 | a11y (low) | OpportunityMap | legend tier toggles `<li onClick>` not keyboard-operable, no `aria-pressed` | make them `<button aria-pressed>` |
| E-f1 | UX (low) | filters.ts | numeric `gte`/`lte` with empty value → 0 rows (vs no-constraint elsewhere) | `if (rule.value==='') return true` for gte/lte |
| E-c1 | copy (low) | ratings.ts | briefing "a Attractive valuation" → "an Attractive" | article fix (a/an by vowel) |

No engine/Python change. All web-only, CI-gated, PAUSE-BEFORE-MERGE.

## Known carry-over (from Layer E build)

- `AnalysisProvider` hydrates from sessionStorage **only on mount** → to test,
  seed storage then RELOAD (soft-set after mount won't hydrate).
- Unknown tickers → `unavailable[]` → "couldn't be scored" strip → Request tie-in.
  CSV is the only input path that can carry an unknown into a run.
- Display caps (pe ≤150x, peg ≤25, roe/margins ≤300%, etc.) are DISPLAY-ONLY;
  sort/filter/CSV use raw `get()`.
- Layer H: 375px shell overflow is the pre-existing non-responsive global sidebar
  (no mobile drawer yet) — Results itself adds none.

## Session log

### E0 — Tracker created (2026-06-25)
- Branch `audit/layer-e-results` off main `4b3126b` (PR #43 merged, tree clean).
- Read CLAUDE.md, `layer-c-audit.md` + `layer-d-audit.md` (templates), the Results
  orchestrator, and memories `project-layer-e-progress` + `project-layer-d-progress`.
- Confirmed the surface inventory (8 components + 7 supporting) and that the only
  `Math.max/min` uses in `web/components/results/` are scalar (window dims in
  `OpportunityMap.tsx`, between-filter lo/hi in `filters.ts`) — none over large
  arrays (#6 looks clean; formalise in E1/E2).
- Created this tracker; pre-filled the 15-surface matrix at ⬜.
- **Next: E1** (calc-parity / sort / filter core — checks 1,2,3 on surfaces 1–6).

### E1 — calc-parity / sort / filter core (2026-06-25) — verified; findings logged, no code changed yet
Read surfaces 1–6 + a Claude-Preview sweep (`DEV_BYPASS_AUTH`, seeded a 4-row
US/AU/CA snapshot + GME outlier + 2 unavailable, reloaded so `AnalysisProvider`
hydrates). **Checks 1, 2, 3 PASS functionally.** No code changed (explain-before-build).
- **Check 1 (no-recompute / calc parity) — PASS.** `page.tsx` supplies only the
  enrichment `lookup`; ratings are derived in-browser by pure `ratings.ts`/
  `columns.ts` (verified `cyclePosition` SHOP 44 = −15/−34, BHP 18 = −5/−28;
  `valuationAppealLabel(72)` = Attractive; briefing Health-83→"financially
  healthy"). **Display caps are display-only** (GME outlier renders `>+150x` /
  `>+300%` / `>+25` / `>+100x` while sort/filter/CSV read raw `get()`). Nothing
  read from / written to the DB (#15) — `writeRun`/`analysis_runs` inputs-only.
- **Check 2 (ranking + column-sort) — PASS functionally.** Default Overall desc
  (SHOP 81 / BHP 65 / AAPL 62 / GME 31); clicking a `<th>` sorts — Overall asc →
  GME/AAPL/BHP/SHOP; Close numeric desc-first → AAPL/SHOP/BHP/GME; Ticker text
  asc-first → A/B/G/S. Nulls sort last. **a11y gap (E-a1):** the sort control is a
  `<th onClick>` (ResultsTable.tsx:104) with no `<button>`/`role`/`tabIndex`/key
  handler → **not keyboard-operable**, and no `aria-sort`/`scope="col"`.
- **Check 3 (filter) — PASS functionally.** Quick filter "Constructive or better"
  4→2 (SHOP+BHP)→4; tier dropdown + min-rating present. **Finding E-f1:** numeric
  `gte`/`lte` with empty value excludes all rows (vs between/categorical/text =
  no-constraint) — minor inconsistency, confirm UX in E3. Advanced builder full
  test in E3.
- **a11y findings (the predicted cluster, to scope with owner before fixing):**
  - **E-a1** — desktop sortable headers: `<th onClick>` not keyboard-operable;
    no `aria-sort`; no `scope="col"` (`ResultsTable.tsx`).
  - **E-a2** — desktop data rows: `<tr onClick={open}>` navigates to detail but
    isn't keyboard-focusable / has no link/button semantics (mobile cards ARE
    `<button>` — good pattern to mirror).
  - **E-a3** — quick-chip toggle uses `.active` class but no `aria-pressed`
    (`ResultsToolbar`).
  - **E-a4** — `.result-count` is not an `aria-live` region (SR users don't hear
    filter changes) — same spirit as Layer D's D3 `aria-live` fix.
  - **Copy nit** — briefing "a Attractive valuation" → "an Attractive".
- **Next: E2** (table/briefing/provenance/map — parity/colour/compliance/perf/a11y;
  chart `aria-label`, export-dropdown + cluster-popover keyboard).

### E2 — table / briefing / provenance / map (2026-06-25) — verified; findings logged, no code changed yet
Read surfaces 7–11 + continued the Preview sweep. **Checks 5 (compliance), 6
(visual/colour), 10 (perf) PASS; check 7 (a11y) has the predicted cluster of gaps.**
- **Check 5 (compliance) — PASS.** Only the 5 tiers + Compelling…Expensive /
  Deep Value…Stretched words appear in OUR output; the Analyst column is the sole
  Buy/Hold/Sell, verbatim via `fmtAnalyst` (#17, GME→"Sell"). Disclaimer present
  in the briefing + the global strip (#4/#12).
- **Check 6 (visual/colour) — PASS.** Score-num/tag colours via `scoreColor`;
  Health via 3-tier `healthColor`; Cycle Pos via `cyclePositionColor`; micro-bar
  40/35/25 `compositionRamp`; metric tints via `metricTintColor`; Opportunity Map
  quadrants/labels/SPLIT-65/tier legend correct. Matches the reference-parity rework.
- **Check 10 (perf) — PASS (code-level).** `buildRows`/`applyFilters`/`sortRows`
  O(n)/O(n log n); OpportunityMap cluster Map + per-tier filter O(n); no
  `Math.max/min` over arrays (only scalar clamp); one ScatterChart instance (#5);
  #8 N/A (Recharts, no CrosshairPlugin). 700+ row live perf → E4 deploy tail.
- **a11y findings (add to the cluster, confirmed in-DOM):**
  - **E-a6** — Opportunity Map has no `role="img"`/`aria-label` (svg defaults to
    `role="application"`, unlabelled) → add a text summary like the Layer C radar.
  - **E-a7** — legend tier toggles are `<li onClick>` — not keyboard-operable, no
    `aria-pressed`.
  - **E-a5** — Export trigger has no `aria-expanded`/`aria-haspopup`; the menu has
    no Esc-to-close / `role=menu`/`menuitem` (options are `<button>`, so tab works
    once open).
  - **E-a3** (refined) — both toolbar quick-chips lack `aria-pressed`.
- **Clean a11y (no change):** BriefingCard pills/link, toolbar selects + view-switch
  (`aria-pressed`), mobile cards (`<button>` + keyboard tier-badge), cluster picker
  (`role=dialog` + Esc/outside close + `<button>` rows).
- **Next: E3** (skipped split + Request tie-in + advanced-filter UI + empty/edge —
  checks 3,4,8; confirm E-f1's empty-numeric-rule UX).

### E3 — skipped split / Request / advanced filters / empty (2026-06-25) — verified; findings logged, no code changed yet
Read surfaces 12–14 + Preview verification. **Checks 3, 4, 8 PASS** (one minor
finding E-f1).
- **Check 4 (skipped split + Request) — PASS.** Live `/api/listings/status` drives
  the split: AMD→"No data yet" (covered, links /stocks/us/AMD); ZZZZ→"Not covered"
  (not listed, no Request button). Summary `aria-expanded`; Request is a `<button>`;
  status route is read-only + correct. The Request/Requested/Not-supported states
  require a listed-but-uncovered ticker (build-verified live; re-confirm on E4 tail).
- **Check 3 (filter) — PASS functionally.** Advanced numeric (Overall ≥50→AAPL/BHP/
  SHOP, ≥70→SHOP), categorical multi-select (one-rule-per-field guard + "(in use)"),
  text contains, AND-combination, remove + clear-all all correct. **E-f1 confirmed:**
  switching a rule to a numeric field blanks the table (0 results) until a value is
  typed — empty `gte`/`lte` returns false in `filters.ts:rulePasses` while
  `between`/categorical/text treat empty as no-constraint. Inconsistent; trivial fix.
- **Check 8 (empty / edge) — PASS.** No-run → "No analysis run yet"; all-skipped →
  "No stocks could be scored" + the skipped strip (no table/briefing); no-filter-match
  → "No stocks match your filters" + a `<button>` "clear all filters" that restores
  4 rows; sessionStorage hydration (E1) covers nav-away→back + reload; a partial run
  is the same code path with fewer results + unavailable.
- **Next: E4** — 375px (check 9), consolidate + scope the a11y cluster with the owner,
  then the deploy-gated tail (700+ row perf + live Request/Requested/Not-supported states).

### E4 — cross-cutting sweep (2026-06-25) — 375px verified; findings consolidated, awaiting owner fix-scope
- **Check 9 (375px / Layer-H) — PASS.** At a true 375px the doc overflows, but every
  Results component is squeezed to a ~112px column by the global fixed sidebar; with
  the sidebar neutralised, **docOverflow=false + 0 overflowing components** (cards
  350px, `.results-cards` flex shown, `.results-table-wrap` `display:none`). The
  overflow is 100% the pre-existing Layer-H sidebar (no mobile drawer), not Results.
- **Findings consolidated** into the table above (7 a11y + E-f1 + E-c1). All
  correctness/compliance/visual/perf/edge checks pass. No engine/Python change needed.
- **Deploy-gated tail (pending owner live run):** a genuine 700+ row run's perf +
  the live Request/Requested/Not-supported skipped states (need a listed-uncovered
  ticker in the real queue) — confirm on www.majorcycle.com via Claude-in-Chrome.
- **Next:** owner picks the fix scope (the a11y cluster ± E-f1/E-c1), then apply +
  re-verify + PAUSE-BEFORE-MERGE.
- **Owner chose "All 9."** Applied (6 files, web-only, no engine/Python):
  - `ResultsTable.tsx` — E-a1 (`scope=col`+`aria-sort`+`tabIndex`+Enter/Space on the
    sortable `<th>`), E-a2 (Ticker cell → `<Link>` + `stopPropagation`).
  - `ResultsToolbar.tsx` — E-a3 (`aria-pressed` on both quick-chips), E-a4
    (`role=status`+`aria-live` on the count), E-a5 (Export `aria-haspopup`/
    `aria-expanded` + `role=menu`/`menuitem` + Esc-close).
  - `OpportunityMap.tsx` — E-a6 (`sr-only` chart summary + `oppZoneCount`), E-a7
    (legend tier toggles → `<button aria-pressed aria-label>`).
  - `filters.ts` — E-f1 (empty `gte`/`lte` → no constraint).
  - `ratings.ts` — E-c1 (`article()` → "an Attractive").
  - `globals.css` — focus-visible rings + legend button-reset + `a.ticker-cell` styles.
- **Re-verified in Claude Preview (HMR):** every fix present in the DOM (sort `th`
  scope/aria-sort/tabindex; ticker `<a href>`; chips/export ARIA; count live region;
  legend `<button aria-pressed>`; sr-only summary; "an Attractive"). **Behavioural:**
  keyboard Enter on the focused header sorts (→ ascending, `aria-sort` flips); adding
  a numeric advanced rule no longer blanks the table (4 results until a value typed).
- **CI green:** `pnpm --dir web typecheck` + `lint` + `build` all exit 0 (build
  compiled, `/results` route present); `web/.next` cleared post-build; `DEV_BYPASS_AUTH`
  removed from `web/.env.local`. No Python touched (engine untouched, no drift/ruff/mypy).

### Layer E audit — E1–E4 done for in-app `/results`; **REOPENED for follow-ups (2026-06-25)**
The `/results` ranked-table audit (E1–E4) passed all 10 checks across the 15
surfaces + cross-cutting items. **Fixes (6 files, all CI-green, no engine/Python
touched):** the a11y cluster E-a1…E-a7 + E-f1 (filter) + E-c1 (copy). Calc-parity /
no-recompute (#15), display caps (display-only), compliant labels (#16), analyst
verbatim (#17), disclaimer (#4/#12), visual/colour, perf (#6 clean), empty/edge, and
375px (Layer-H isolated) all verified.
- **PAUSE-BEFORE-MERGE:** changes are pending on `audit/layer-e-results` (uncommitted
  until the owner asks); the whole Layer-E audit merges together (as with Layer C/D).

> **Owner REOPENED Layer E (2026-06-25)** — the audit isn't closed: the `/results`
> table is one surface of Layer E, and several Layer-E-scoped items remain. Tracked
> as sessions **E5–E11** below; the audit stays OPEN until they're done + verified.

## Reopened scope — E5–E11 (the next session's work)

| # | Session | Scope | Status |
|---|---|---|---|
| E5 | Briefing asset | Replace the "AI-looking" `TrendingUp` Lucide icon in the Analyst Briefing (`BriefingCard.tsx` `.briefing-icon`) with a custom, professional brand asset. Decide format with owner (inline SVG mark / `next/image` PNG/SVG in `web/public/` / a refined Lucide composition). Must match the brand palette (#1A3A6E/#1E5CB3/#2E7DE8) + design-system. | 🔧 |
| E6 | Missing-component overall score | **Correctness, cross-cutting (engine-adjacent).** Investigate which component scores can be `—`/null: `financialHealthScore` is withheld when <3 of 5 pillars are present (Layer C S3 / P3) → `calculate_overall_rating` falls back to a **cycle-only renormalised** Overall. A FH-withheld stock can then out-rank a fully-scored one → misleading on **both** `/results` AND the **Stock Detail** page (KpiStrip/VerdictCard). Determine the optimum fix (e.g. flag/segregate incomplete-data rows, a "data completeness" indicator, withhold or caveat the Overall, sort handling) and propose it. **Any change to how Overall is composed is a methodology change → propose FIRST (CLAUDE.md), engine untouched until signed off.** | 🔧 |
| E7 | Unknown-ticker detail page | `/stocks/[market]/[ticker]` for a ticker NOT in our universe (e.g. `/stocks/us/ZZZZ`) still references the old live-fetch-from-Run-Analysis flow (outdated). Fix it, then run the same 9/10-check audit on the **Stock Detail page's unknown-ticker / not-covered path** (this is part of Layer E). | 🔧 |
| E8 | Site-wide stale-info sweep | Enumerate any other outdated/stale on-site copy or flows like E7 (e.g. references to deprecated live-fetch, old provider names, dead routes) and list them for the owner to triage. | 🔧 |
| E9 | Request-a-Ticker audit | Run the same Layer-E production-readiness audit (10 checks) on the **Request a Ticker** tab (`web/app/(app)/request/*`, `/api/listings/search`, `/api/request-ticker`, `SkippedTickers` tie-in). | 🔧 |
| E10 | Download Excel export | The Export dropdown's **Download Excel** option (`ResultsToolbar.tsx` `ExportMenu`, `.export-opt.soon` + `aria-disabled` + "SOON" tag) is a disabled placeholder. Implement it: a colour-coded `.xlsx` of the current filtered+sorted rows with styled rating cells (reuse the `CSV_COLUMNS` set + tier colours; client-side download like the `downloadCsv` pattern in `ratings.ts`). Decide the library with owner (e.g. exceljs / SheetJS) — weigh bundle size. Remove the SOON tag + `aria-disabled` once live. **Depends on E6:** whatever E6 decides for missing-component Overall (withhold/caveat/flag/de-rank) MUST be reflected in BOTH the Excel export AND the existing CSV export (`CSV_COLUMNS`/`toCsv`) so exports match the table. | 🔧 |
| E11 | Deploy-gated tail | **LAST — after everything else is fixed + PR #44 merges.** Confirm on www.majorcycle.com (Claude-in-Chrome, owner logged in) a genuine 700+ row run's perf + the live Request/Requested/Not-supported skipped states (need a listed-but-uncovered ticker in the real queue). | ✅ |

**Next session = E5–E11.** A self-contained kickoff prompt for it lives in the
session handoff (and memory `project-layer-e-progress`). Everything (E1–E10) is fixed
first on DRAFT PR #44 (`audit/layer-e-results`); the deploy-gated **E11** runs live
ONLY after PR #44 merges (owner wants everything fixed before the one live check).

### E5–E10 — reopened-scope build (2026-06-26) — built + verified, on PR #44 (uncommitted until asked)

All web-only; **engine untouched** (no `analytics/`/`_engine/` edits; no Python). Owner
decisions this session: E5 = score-ring avatar + freshness dot; E6 = badge + de-rank;
E10 = ExcelJS. `pnpm --dir web typecheck` + `lint` green each round.

- **E5 (Briefing asset) 🔧** — Owner rejected the flat-glyph / gold / navy-hero / logo
  directions; converged on a **score-ring avatar** that reuses the Verdict score-ring
  language (brand-blue arc on a light track) showing `constructivePlus/n`, with the
  **live freshness dot after the "Analyst Briefing" text** (reuses `.pv-dot`/`metaPulse`,
  gated by `prefers-reduced-motion`) and the existing custom `InfoTip` kept. `BriefingCard.tsx`
  (`BriefingRing` + dot), `globals.css` (`.briefing-ring*`/`.briefing-live-dot`; dropped
  `.briefing-icon`). No logo/`next/image`/new asset. **Preview-verified**: ring `aria-label`
  "2 of 4 stocks rated Constructive or better", numbers `2`/`/4`, dot present, zero console errors.
- **E6 (FH-null Overall) 🔧 — badge + de-rank, web-only, engine untouched.** `financialHealthScore`
  is the ONLY nullable component (valuation/cyclePayoff always present; a fully-unscorable
  ticker is `unavailable`, not partial). Treatment recorded in `docs/methodology-audit.md`
  (composition unchanged per P3): **badge** "Cycle-only" on the Overall cell + mobile card
  (`ResultsTable.tsx`, `InfoTip`) and on Stock Detail (`KpiStrip` Overall note + `VerdictCard`
  eyebrow chip); **de-rank** in `sortRows` (key `overall`: fully-scored rows always group
  above FH-null, so they never top the table) ; **briefing** standout picks from fully-scored
  rows (`ratings.ts` `buildBriefing`); **exports** gain a "Data Completeness" column
  (`CSV_COLUMNS`) + the Excel mutes the FH-null Overall cell. **Preview-verified**: a seeded
  FH-null SHOP.TO (overall 78 — highest raw score) sorted **last** with the CYCLE-ONLY badge
  and Health "—", while the briefing standout was the fully-scored AAPL (72), not SHOP.TO.
- **E7 (Unknown-ticker detail) 🔧 + audited.** Fixed `web/app/(app)/stocks/[market]/[ticker]/not-found.tsx`:
  stale "upload it in Run Analysis — we'll fetch it live and cache it" + Run-Analysis CTA →
  current **queue model** "Not in our coverage yet · request it and we'll fetch it in our next
  daily update" with **Request a Ticker → `/request`** (primary) + **Browse stocks → `/stocks`**.
  **10-check audit of the not-covered path** (where applicable): no rating/score shown → disclaimer
  #4/#12 **N/A**; a11y OK (`<h1>`, decorative `aria-hidden` icon, real `<Link>` buttons);
  empty/not-covered state correct; 375px fits (centred `max-w-sm`, two buttons). **Preview-verified**
  on `/stocks/us/ZZZZ`: heading "Not in our coverage yet" + queue copy + the two CTAs.
- **E8 (stale-info sweep) 🔧.** Swept `web/`; the only user-facing stale-flow string beyond E7 was
  the **Browse empty-state** (`StockBrowser.tsx`) — "run it in Run Analysis — we'll fetch it live
  and add it" + Run CTA. Owner triaged → **fix like E7**: reworded to the queue model + the CTA
  now points to **Request a Ticker → `/request`** (rendered only when a search query is present).
  All `yfinance`/`FMP`/`Yahoo Finance` mentions are code comments / storage-format notes (not
  user-facing); `CompanyOverview` intentionally omits the source label — **no further action**.
- **E9 (Request-a-Ticker audit) 🔧.** 10-check audit of `/request` + the two API routes.
  Correctness: `search` sanitises the query, single `search_listings` RPC, graceful-empty;
  `request-ticker` POST validates a present symbol (400) / known active listing (404) /
  already-covered (409), upsert re-queues failed/unsupported→queued, GET filters
  `requested_by IS NOT NULL` (no cron leak) — all correct. Disclaimer **N/A** (no ratings shown).
  One a11y gap fixed: the live search-results list didn't announce updates → added an `sr-only`
  `role="status" aria-live="polite"` count/empty announcement in `RequestTicker.tsx`. Mobile/375px
  is the pre-existing global sidebar (Layer H), not this page.
- **E10 (Download Excel) 🔧 — depends on E6, done.** Added `exceljs@4.4.0`; new `web/lib/xlsx.ts`
  `downloadXlsx` (dynamic `import('exceljs')` on click → never in the initial bundle) builds a
  styled workbook from the filtered+sorted rows via `CSV_COLUMNS`: branded header, Overall/Valuation
  painted by 5-tier colour, Health by its 3-tier colour, frozen header; **FH-null rows' Overall cell
  muted** (mirrors the E6 badge), and the export carries the new "Data Completeness" column so it
  matches the table + CSV. `ResultsToolbar.tsx` ExportMenu: the **SOON placeholder is now an active
  `role="menuitem"` button** (`aria-disabled`/"SOON" tag removed); `Results.tsx` wires `onExportXlsx`
  off the same `sorted` set (so order matches the de-ranked table).

**Status:** E5–E10 built, typecheck/lint green; observable bits Preview-verified (E5/E6/E7;
E9/E10 download verified in the consolidated sweep). `DEV_BYPASS_AUTH` removed after; PR #44
stays a **draft**, uncommitted until the owner asks. **E11** is the only remaining item (post-merge).

### E5/E10 owner polish rounds (2026-06-26) — verified, still uncommitted on PR #44

All web-only, engine untouched; typecheck/lint/build green; Preview-verified; no console errors.

- **Export precision (CSV + Excel identical), per-column.** Blanket 2dp rounding → `ExportFmt`
  (`'int'|'num2'`) + `exportText` in `ratings.ts`; each `CSV_COLUMNS` entry carries `xf`. Whole:
  Overall / Valuation / Health / Cycle Payoff / Cycle Position / Pullbacks / Rallies. 2dp (trailing
  zeros, 1→"1.00"): Close / Target / Upside / the drawdown+profit %s / P/E…Days-to-Cover. CSV uses
  `toFixed`; Excel keeps the cell **numeric** + `numFmt` (`'0'`/`'0.00'`) so it displays identically.
- **Analyst Consensus** column proper-cased via `fmtAnalyst` (Strong Buy / Buy / Hold / Sell — no underscores).
- **Health Rating** column added to the exports (Healthy / Adequate / At Risk; blank when FH withheld) —
  sits beside Health Score, mirroring Valuation Score + Appeal. Shared `healthRatingLabel` in `ratings.ts`
  now used by both `columns.ts` and `ResultsTable.tsx` (removed the duplicate local helper).
- **Cycle Position Zone** column proper-cased via `ZONE_DISPLAY` (Deep Value / Value / Fair / Stretched).
- **Excel styling:** all populated cells get **automatic black borders** (`{ style: 'thin' }`, no colour);
  **column widths fit content** (max of header + every value's displayed text, via `exportText`);
  **auto-filter on by default** (`ws.autoFilter` A1→last col); header fill stays per-cell so it never bleeds
  past the data columns. Verified ExcelJS round-trips border(auto)/autoFilter/width/numFmt.
- **Briefing ring redesigned** (owner: a % is meaningless; the detail-page ring looks better). Now mirrors
  the `VerdictCard` score-ring (faint `--border-faint` track + `--brand-mid` arc, stroke 6, rotate-90), a big
  **count** of Constructive-or-better centred (font scales by digit count → robust to 1,000+), `OF {total}`
  caption beneath. **Green live dot removed entirely** (owner). `globals.css` `.briefing-ring-block/-bg/-fg/-num/-cap`.
- **Run-tab top-pick consistency:** `RunComplete.tsx` picks the top stock from fully-scored rows first
  (FH-null only if none are scored) — same rule as `buildBriefing`, so `/run` and `/results` agree.
- **Owner Q (no code): Cycle Payoff** = 50% events_score `((pullbacks+rallies)/20·100`, capped) + 50% rr_score
  (`typical_profit/|typical_drawdown|/3·100`, capped; neutral 50 if missing); averaged, 1dp. No price-trend term.

### MERGED + E11 deploy-gated tail DONE (2026-06-26) — Layer E audit CLOSED

**PR #44 merged to main** (merge commit `dad5091`) + Vercel **production deploy green**. Commit `f2ff017`
(E5–E10 + 3 polish rounds, 20 files) on `audit/layer-e-results` → squashed into the merge; branch deleted.
**E11 verified live on www.majorcycle.com via Claude-in-Chrome (owner logged in):**
- **700+ row run perf:** combined S&P 500 + ASX 200 + S&P/TSX 60 = **759 stocks → 759 scored, 0 skips**,
  runtime 243s (top pick **NEM** 96 High Conviction, 276/759 Constructive+). `/results` rendered 759 rows
  in <1s; Opportunity Map drew ~756 bubbles, no jank; **CSV export 15ms / Excel export 536ms** (full set,
  styled); a full re-sort ~1.6–2s (no freeze). No console errors.
- **This session's work confirmed live at scale:** E5 briefing ring shows "276 / OF 759" (count, no green
  dot); E6 **de-rank** — the 3 FH-null names (FISV, NAB, SGH) sit at the very bottom (rows 756–758) with the
  Cycle-only badge; top pick NEM is fully scored (top-pick-from-scored held).
- **Live Request/skipped states — all 5 confirmed:** Covered (AAPL·NASDAQ), Request-available (AAPL CDR·TSX),
  Available-now/fetched (TSM/ASML/ZS/SLC/AMD/ALAB), Not-supported/unsupported (SPCX), and **Requested/queued**
  — owner-approved live-DB write: requested **CRDO** (Credo Technology, NASDAQ) → flipped to "Requested" in
  the search row + recent panel + notice. CRDO is now in the global queue; the nightly cron will fetch it.

**Layer E (E1–E11) is COMPLETE + LIVE.** Engine never touched across the whole audit.

### Post-close follow-ups (2026-07-01) — horizon-in-links bug fix + table-combination re-verify

Owner-reported bug + a correctness confirmation, both on the (closed) `/results`
surface. Web-only; **engine untouched**; `pnpm typecheck`/`lint`/`build` green;
verified live in Claude Preview (`DEV_BYPASS_AUTH`, seeded snapshot, removed after).

- **BUG (horizon not carried into detail-page links) — FIXED.** Every link from a
  results/run surface built a **bare** `/stocks/<m>/<t>` path, so opening a stock
  always fell back to the Stock Detail page's **Medium** default — regardless of the
  horizon the run actually used (Short/Long/Custom). Root cause: the links used
  `tickerToPath(ticker)` with no `?preset=…` suffix. **Fix:** new shared helper
  `horizonQueryFromRequest(params)` in `web/lib/horizon.ts` (reuses `horizonQuery`
  so the custom-window validation + "Medium → clean URL" rule stay in one place),
  threaded through all six link sites:
  - `Results.tsx` — computes the suffix once from `useAnalysis().params` and passes
    it to the table/map/briefing/skipped children.
  - `ResultsTable.tsx` — row `open()` + the ticker `<Link>` + mobile card.
  - `OpportunityMap.tsx` — bubble click + cluster-picker rows.
  - `BriefingCard.tsx` — top-pick link.
  - `SkippedTickers.tsx` — covered ("No data yet") + fetched ("available") links.
  - `RunComplete.tsx` (Run tab) — reads `params` via `useAnalysis()`; top-pick link.
  `StockBrowser.tsx` already had its own `hrefFor` (Browse has its own horizon
  selector) and `RequestTicker.tsx` has no run horizon → both correctly left as-is.
  **Preview-verified:** Short run → `/stocks/us/AAPL?preset=short`; Medium run →
  clean `/stocks/us/AAPL` (no regression on the default); zero console errors.
- **Results-table combination matrix — verified correct, NO change.** Confirmed via
  the data contract (`CycleAnalysis`): `financialHealthScore` is the ONLY nullable
  score — `valuationScore`/`overallRating`/`overallLabel`/`valuationZone` are always
  present. So only two row-states can reach the table: **fully scored** (all cells)
  and **cycle-only** (Health "—" + "Cycle-only" badge, de-ranked below fully-scored
  via `sortRows`). "Overall+Valuation but no Health" = the cycle-only case (handled).
  "None scored" **never** appears as a row — an unscorable ticker is `unavailable`
  and shows in the "couldn't be scored" strip. All colour/label helpers null-safe;
  the composition micro-bar collapses the health segment to 0 (`?? 0` + `|| 1`
  divisor guard). Preview-confirmed the badge renders on exactly the null-health row.
