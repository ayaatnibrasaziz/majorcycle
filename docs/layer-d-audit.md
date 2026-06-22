# Layer D — Run Analysis Audit Tracker

> Living checklist for the multi-session production-readiness audit of the **Run
> Analysis** tab (`/run`). Mirrors `docs/layer-c-audit.md`. Update this file in the
> same PR as each session's fixes. Layer E (Results) gets its own audit later.
>
> Layer D was **built** across PRs #35/#36 (+ branch work) and is **live in
> production**. This audit takes it from "built" to "production-ready for a
> mass-retail beginner", exactly as Layer C did — audit-then-fix.

## Definition of "audited" (10 checks)

Each surface must pass all ten, verified on **AAPL (US) + BHP.AX (AU) + SHOP.TO
(CA)** and across baskets (**Magnificent Seven / an S&P 500 subset / a By-industry
group / a mixed known-unknown CSV**), on **Medium + Custom** horizons:

1. **Functional correctness** — each input path (basket / search-add / CSV /
   horizon presets / Custom-Advanced) produces the right selection + params, which
   produce the right results.
2. **Calc parity** — `analyze.py` output == `/api/cycle` for the same ticker+params
   (engine single-sourced via `_engine`); only compliant tier labels appear (#2,
   analyst verbatim #17).
3. **Input validation** — §7 per-field bounds (red border + clear inline error,
   clears instantly when valid); empty selection; ≤ 60-cap; de-dupe; CSV column
   split (known vs unknown passthrough).
4. **Reliability** — a real ~100-ticker deploy run skips ≈ 0 (pre-warm + per-chunk
   retry + warm-retry + single-ticker reconciliation); a partial-chunk failure keeps
   the good results; only genuine unknown / short-history → `unavailable`.
5. **Progress honesty + cancel** — real-chunk Processed/Scored/Skipped/ETA (no fake
   clock); clean AbortController cancel + an honest "Run Cancelled" card (never the
   green "Analysis Complete").
6. **Persistence #15** — `analysis_runs` stores **INPUTS ONLY** (SQL-verify the
   `results` column is NULL); Last-Analysis + Re-run re-derive ratings client-side;
   a NAMED preset resolves its thresholds before insert (NOT NULL columns).
7. **Parity / visual** — design-system §16 (the owner-approved beginner-first
   deviation) + tier/brand tokens + the preset-active brand gradient; no clipping
   at desktop + a 375px check (Layer-H global sidebar overflow is out of scope).
8. **Tooltips + beginner clarity** — an `InfoTip` on every jargon term; the
   "Build your analysis" flow is understandable by a non-finance user.
9. **Empty / edge** — no selection, all-unknown, dataless, cancelled-empty,
   full-index selection — graceful, no crash.
10. **A11y** — keyboard nav (search dropdown / chips / baskets / run button /
    progress), `aria-label`s, `:focus-visible`.

Status key: ✅ pass · ⚠️ issue logged · ❌ fail · ⬜ not yet audited · 🔧 fixed this round

## Verification method

- **The real `/api/analyze` runs only on Vercel** (Next dev doesn't serve Vercel
  Python fns). Use the `web/app/api/analyze-dev/route.ts` shim + Claude Preview for
  the UI/flow; confirm **true skip-count + speed on a deploy** (owner-gated,
  logged-in). Mirrors the `cycle.py` verification constraint.
- **Calc parity:** `analyze.py` CLI (`echo '{"tickers":[…],"preset":…}' | python
  web/api/analyze.py`) vs `web/api/cycle.py` CLI for the same ticker+params.
- **Persistence:** Supabase `execute_sql` on `analysis_runs` (project
  `gurrrlogycxawududtyv` MajorCycle, us-east-1) — confirm `results` IS NULL.
- **Validation / dedupe / cap:** `analyze.py` CLI edge cases.
- **CI gate per session:** `pnpm typecheck && pnpm lint && pnpm build`; if Python
  touched → `ruff` / `mypy` / `pytest` + `_engine` drift check.
- Local auth bypass: `DEV_BYPASS_AUTH=true` in gitignored `web/.env.local` (remove
  after); free port 3000 before `preview_start`; `rm -rf web/.next` after any prod
  build (§12 CSS-cache gotcha).

## Surface matrix

Grouped into audit sessions D1–D4. Each surface gets all 10 checks where they apply.

| # | Surface | File | Session | Status | Notes |
|---|---|---|---|---|---|
| 1 | RunAnalysis (orchestrator) | `web/components/run/RunAnalysis.tsx` | D1 | ✅ | D1: flow wiring correct — addTickers dedupes/uppercases; `canRun` gates empty/invalid/running; Re-run re-derives via `run()` (never reads stored results); buildRequest only sends custom fields for custom. |
| 2 | analyze.py (batch engine) | `web/api/analyze.py` | D1 | ✅ | D1: **calc parity IDENTICAL** vs cycle.py (AAPL/BHP.AX/SHOP.TO + custom −7/7/300, all 21 keys); compliant labels; analyst verbatim. Validation 400s all clean (empty/bad-preset/custom-OOB/missing-field/61-cap); dedupe+normalize+unknown→unavailable. |
| 3 | analysis.tsx (provider/batching) | `web/lib/analysis.tsx` | D1 | 🔧 | D1: chunking/pre-warm/retry/warm-retry/reconcile/cancel/writeRun/fetchLastRun all sound. 🔧 **FINDING D1-a fixed (owner-approved light fix):** added `phase: 'analysing' \| 'reconciling'` to the progress state; the warm-retry + reconcile passes now set `'reconciling'` so RunProgress reads "Double-checking skipped tickers…" at 100% instead of "Analysing…"; and the reconcile pass shows `reconcileInput − recovered` so the Skipped count is **monotonic** (starts full, only shrinks) instead of dipping→climbing. **Reliability logic untouched** — pure presentation. |
| 4 | presets.ts (bounds) | `web/lib/presets.ts` | D1 | ✅ | D1: §7 bounds (pullback −30..−1, profit 1..30, lookback 21..5040) match analyze.py `_CUSTOM_BOUNDS` exactly; `boundError` shared with Browse + HorizonSettings. |
| 5 | baskets.ts (registry) | `web/lib/baskets.ts` | D1 | ✅ | D1: index = by-market; Top-50/100 = slice of the market-cap-desc universe (`universe.server.ts` orders `market_cap` desc, nullsFirst:false — confirmed); Mag7 intersected with known (drops uncovered); industry/sector grouping correct. |
| 6 | HorizonSettings | `web/components/run/HorizonSettings.tsx` | D2 | 🔧 | D2: presets set fields from PRESETS; custom opens Advanced; any edit → custom; per-field `boundError` + collapsed-Advanced fallback prompt; InfoTip per field; `aria-pressed` on preset cards, `aria-invalid` on inputs. 🔧 **D2-a fixed:** added `aria-label={label}` to the 3 Advanced number inputs. **Verified live** (soft-nav /run): inputs read "Pullback Threshold %" / "Profit Threshold %" / "Rolling Lookback (bars)", `aria-invalid=false`; preset `aria-pressed` reflects Medium. |
| 7 | BasketPicker | `web/components/run/BasketPicker.tsx` | D2 | 🔧 | D2: QUICK_BASKETS resolve correctly; sector + industry (`<optgroup>`) dropdowns add on change; `aria-label` on both selects. 🔧 **D2-b fixed:** chip `aria-label="{label} — {description}"` (kept `title` for mouse; an InfoTip *inside* the action button would nest interactives, so aria-label is the correct fix). 🔧 **D2-c fixed:** sector/industry selects reset to the placeholder after adding (one-shot action, re-pickable). **Verified live:** chip aria-label present; picking "Basic Materials" added 58 chips and the select reset to "". |
| 8 | TickerSearchAdd | `web/components/run/TickerSearchAdd.tsx` | D2 | 🔧 | D2: debounced (180ms) `/api/search`; pick adds + clears; already-selected → disabled "Added"; outside-click closes. 🔧 **D2-d fixed:** full combobox — `role=combobox` + `aria-expanded`/`aria-controls`/`aria-autocomplete` on the input, `role=listbox`/`option` + `aria-selected` on the list, `activeIndex` state with ↓/↑ navigation, `aria-activedescendant`, `.run-search-opt--active` highlight (= hover), Enter-to-add, Esc-to-close, mouse still works. **Verified live:** ArrowDown highlights opt-0 (RY · Royal Bank of Canada), moves to opt-1, active class + activedescendant track, Escape closes; 0 console errors. |
| 9 | SelectedTickers | `web/components/run/SelectedTickers.tsx` | D2 | ✅ | D2: live count; per-chip remove (`aria-label="Remove X"`); Clear all; empty state; symbols stripped of .AX/.TO. Renders all chips (723 worked live — no virtualization needed). |
| 10 | CsvImport | `web/components/run/CsvImport.tsx` | D2 | 🔧 | D2: header-or-headerless parse, dedupe, known/unknown split, **both added (unknown passthrough)**, re-upload reset, sample download, empty/no-ticker/non-csv error states. 🔧 **D2-e fixed:** drop-zone now `role=button` + `tabIndex=0` + `aria-label` + an Enter/Space `onKeyDown` that opens the picker (same path as click) + a `focus-visible` ring. **Verified live:** zone renders `role=button`, `tabindex=0`, aria-label present. |
| 11 | search route | `web/app/api/search/route.ts` | D2 | ✅ | D2: ranks ticker-prefix > ticker-contains > name-contains, limit 10, market-cap-stable; light index only; `force-dynamic`, auth via proxy.ts; empty q → []. |
| 12 | analyze-dev shim | `web/app/api/analyze-dev/route.ts` | D2 | ✅ | D2: 404 in production; spawns the same analyze.py CLI via stdin; 200 on exit 0 else 400; parse-fail → 500. Dev-only infra, not user-facing. |
| 13 | RunProgress | `web/components/run/RunProgress.tsx` | D3 | 🔧 | D3: honest chunk-driven pct; live Elapsed; ETA from done chunks; Processed `min(done·CHUNK, count)`; Scored (green) / Skipped (amber, >0 only); Cancel; D1-a phase label. 🔧 **D3-a fixed:** the bar wrap now has `role="progressbar"` + `aria-valuenow={pct}`/`valuemin=0`/`valuemax=100` + `aria-label`. 🔧 **D3-b fixed:** the status span is `aria-live="polite"` so SR users hear "Analysing…" → "Double-checking…". (Static ARIA; typecheck-validated. RunProgress only mounts mid-run, so its live render is confirmed on the deploy run — same constraint as the D1-a phase label.) |
| 14 | RunComplete | `web/components/run/RunComplete.tsx` | D3 | ✅ | D3: compliant labels; "Constructive or Better" = HC+Constructive; top pick is a `next/link`; honest "Run Cancelled" badge + "Stopped early"/"Scored So Far"/"View Partial Results"; ratings computed client-side (never DB, #15); empty + cancelled-empty states. |
| 15 | LastAnalysisCard | `web/components/run/LastAnalysisCard.tsx` | D3 | ✅ | D3: renders the persisted `AnalysisRunRecord` (inputs only — count/preset/rel-time); `canView={false}` is deliberate (returning-session results aren't in memory → Re-run re-derives via `run()`); buttons accessible; survives reload via DB row. |
| 16 | run/page.tsx + layout | `web/app/(app)/run/page.tsx`, `(app)/layout.tsx` | D3 | ✅ | D3: `force-dynamic` server shell loads the light universe index; `AnalysisProvider` wraps `(app)` children; disclaimer strip in BOTH layout branches; `DEV_BYPASS_AUTH` guarded by `NODE_ENV !== production`. |

**Session plan:** D1 = correctness/reliability core (checks 1–6 on surfaces 1–5).
D2 = input surfaces (baskets/search/CSV/horizon UI, checks 1/3/7/8/9/10). D3 =
progress/complete/persistence UI (checks 5/6/7/8/9/10). D4 = cross-cutting sweep +
visual/a11y/375px + final live deploy verification.

## Cross-cutting items (apply tab-wide)

- ✅ **Compliant labels only** (#2) — D1: analyze.py outputs the 5 tiers + DEEP
  VALUE…STRETCHED zones; `analyst_recommendation` is the only Wall-St word and is
  passed verbatim (#17). RunComplete "Constructive or Better" = High Conviction +
  Constructive. No Buy/Sell in our outputs.
- ✅ **Disclaimer presence** (#4/#12) — D1: `(app)/layout.tsx` renders a global
  "⚠ For educational and research purposes only. Not financial advice." strip on all
  authenticated pages, wrapping the Run tab. (Confirm "without scrolling" visually in D4.)
- ✅ **Persistence inputs-only** (#15) — D1: SQL-verified live — 28 rows, **0 with
  `results`**, 0 missing thresholds, 0 bad presets; named presets resolve thresholds
  before insert; statuses complete/partial correct.
- ✅ **375px / Layer-H** — D4: with the fixed sidebar neutralised, `/run` fits a true
  375px with **docOverflow false + 0 overflowing cards**; baskets wrap to a tidy grid,
  the Last-Analysis card fits one line. The mobile squeeze is 100% the global
  non-responsive sidebar (Layer H, no drawer yet) — the Run components add no overflow.
- ✅ **Live deploy skip-count — PROVEN (2026-06-22).** `analysis_runs` status is set
  client-side *after* the reconcile pass, so `complete` ⇒ `unavailable` was empty.
  TWO full-universe runs scored every stock with **0 skips**: medium 723 `complete`
  (211.6s) + custom 723 `complete` (224.5s); also medium 719 `complete`. The only
  `partial` non-test run is long-100 → **1 skip = GEV (GE Vernova)**, 559 bars ≈ 2.2y
  (Apr-2024 spinoff), correctly < the long-preset minimum 776 (`lookback 756 + pivot·2
  + 10`); GEV scores fine on medium (the 06-19 medium-100 run was `complete`). The
  16/17-ticker `partial` runs are the owner's CSV mixed known+unknown tests. Speed:
  ~0.2–0.3s/ticker warm on the full-universe runs.

## Known carry-over (from Layer D build)

- The real `/api/analyze` is **deploy-only** to exercise; the dev shim overstates
  latency (per-chunk python spawn + this machine's flaky cross-Pacific link).
- Unknown tickers → `unavailable[]` → Results "couldn't be scored" → Request a
  Ticker tie-in (Layer E). CSV is the only input path that can carry an unknown.
- Region: prod runs iad1 (US-East), co-located with the us-east-1 Supabase DB.

## Session log

### D0 — Tracker created (2026-06-22)
- Branch `audit/layer-d-run-analysis` off main `6289700` (PR #39 merged, tree clean).
- Read CLAUDE.md, `layer-c-audit.md` (template), design-system §16/§7-bounds,
  data-contracts §5/§11, memories `project-layer-d-progress` + `project-layer-e-progress`.
- Created this tracker; pre-filled the 16-surface matrix at ⬜.

### D1 — Correctness / reliability core (2026-06-22) — verified, 1 polish item to confirm
Audited surfaces 1–5 against checks 1–6. **No code changed yet** — read + live
verification first (standing directive: explain-before-build). Env from
`web/.env.local` (us-east MajorCycle `gurrrlogycxawududtyv`), Python 3.14 CLIs.
- **Check 2 calc parity — PASS (strongest evidence).** `analyze.py` CLI vs
  `cycle.py` CLI, all 21 CycleAnalysis keys **IDENTICAL** on AAPL (62 Neutral),
  BHP.AX (65 Constructive), SHOP.TO medium (81 High Conviction) **and** custom
  −7/7/300 (80). Both call the same `_engine.major_cycle.analyze_ticker`; loaders
  and `_resolve_params` are byte-equivalent. Labels compliant (#2); the 15-field
  screener `fundamentals` subset attaches only to analyze.py; `analyst_recommendation`
  = `'buy'` verbatim (#17).
- **Check 3 input validation (backend) — PASS.** empty→400, bad-preset→400,
  custom-OOB (pullback −99)→400 with the §7 range in the message, custom
  missing-field→400, 61 tickers→400 "max 60 — chunk the list". Dedupe+normalize:
  `aapl`/`AAPL`/` aapl ` → one `AAPL`; `ZZZZ` → `unavailable`. (Client chunks at 10,
  so the 60-cap is a defensive backstop.)
- **Check 6 persistence #15 — PASS.** SQL on `analysis_runs`: 28 rows, **0 with
  `results`** (always NULL), 0 missing thresholds, 0 bad presets. Named medium/long
  rows carry resolved −5/5/252 & −8/8/756; custom rows carry their raw values;
  statuses complete/partial set correctly; 723- & 719-ticker runs recorded complete.
- **Check 1 functional correctness — PASS** (code-level): orchestrator wiring,
  dedupe, `canRun` gating (no selection / invalid horizon / running → disabled),
  Re-run re-derives via `run()`. Per-input-path UI exercise is D2.
- **Check 4 reliability — PASS, live-proven (owner re-ran 2026-06-22).** pre-warm →
  pool 3 → per-chunk retry → warm-retry → single-ticker reconcile. `analysis_runs`
  status `complete` ⇒ 0 unavailable. TWO full-universe runs (medium 723, custom 723)
  came back `complete` = **0 skips across all 723**; medium 719 likewise. Owner's
  long-100 = 1 skip = **GEV** (559 bars ≈ 2.2y Apr-2024 spinoff < the 776 long-preset
  minimum) — a genuine short-history skip, confirmed via SQL bar-count; GEV scores on
  medium. False-skip class is closed.
- **Check 5 progress honesty + cancel — cancel PASS, 1 polish item (FINDING D1-a).**
  Cancel: clean AbortController abort, guarded bumps, honest "Run Cancelled" card,
  no history row written. **D1-a:** the warm-retry + reconcile passes don't advance
  `progress.done` → the bar reaches 100% while the header still reads "Analysing your
  selection…", and `setUnavailable([...stillOut])` during reconcile shows only the
  so-far-failed subset (Skipped chip dips then climbs). The Scored/Skipped chips do
  update live so it isn't *dishonest*, but on a run with many stragglers/unknowns the
  100%-pinned bar can read as stuck. Also `: 'Finishing up…'` is effectively dead
  (RunProgress only mounts while `running`). **Proposed light fix (await owner):** a
  phase label ("Double-checking skipped tickers…") during retry/reconcile + keep the
  Skipped count monotonic. No change to the tuned reliability logic.
- Cross-cutting: compliant labels ✅, disclaimer strip ✅, persistence ✅ (above).
- **D1-a fix applied (owner chose the light cosmetic fix).** `analysis.tsx`: progress
  state gains `phase`; warm-retry + reconcile set `'reconciling'`; reconcile Skipped
  count is now monotonic (`reconcileInput − recovered`). `RunProgress.tsx`: header
  reads "Double-checking skipped tickers…" when `phase === 'reconciling'` (also
  retires the dead `: 'Finishing up…'` branch). Reliability counters/passes unchanged.
  **CI:** `pnpm typecheck` / `lint` / `build` all green; `web/.next` cleared post-build
  (§12). No Python touched (no ruff/mypy/pytest/drift needed).
- **Verification note:** the `'reconciling'` label only appears when a run has
  stragglers/unknowns to recheck — that path can't be reproduced under `next dev`
  (the shim has no cross-region transient skips), so its live appearance is confirmed
  on a deploy run alongside the check-4 skip-count proof (owner-gated). The happy path
  (no stragglers) keeps phase `'analysing'` and the block is skipped, so nothing
  flashes. Static checks + code review cover the change; it's pure presentation.
- **Next: D2** (input surfaces — baskets/search/CSV/horizon UI, checks 1/3/7/8/9/10).

### D2 — Input surfaces (2026-06-22) — read complete, a11y findings pending owner scope
Audited surfaces 6–12 (HorizonSettings, BasketPicker, TickerSearchAdd, SelectedTickers,
CsvImport, search route, analyze-dev shim) against checks 1/3/7/8/9/10. **Functional
correctness, validation, unknown-passthrough, dedupe, tooltips, empty/edge states, and
the search-rank/dev-shim routes all PASS.** All findings are a11y / minor UX:
- **D2-a (a11y, HorizonSettings):** the 3 Advanced number inputs have no accessible
  name (label is a `<div>`, no `aria-label`/`htmlFor`). → add `aria-label={label}`.
- **D2-e (a11y, CsvImport):** drop-zone is a non-focusable `<div onClick>` + the file
  input is `display:none` → keyboard users can't open the picker. → make the zone a
  focusable button (or add `role="button"` + `tabIndex=0` + key handler).
- **D2-d (a11y, TickerSearchAdd):** the autocomplete isn't a true combobox (no role /
  arrow-key nav / `aria-expanded` / Esc). Tab reaches the option buttons so it WORKS,
  but it's not an ideal SR experience. Larger fix than a/e.
- **D2-b (minor, BasketPicker):** chips use native `title=` (invisible on touch/kbd) —
  inconsistent with the InfoTip-over-title standard; chips have visible labels (low pri).
- **D2-c (minor UX, BasketPicker):** sector/industry selects don't reset after adding,
  reading as persistent filters; can't re-trigger the same value.
- **PASS, no change:** SelectedTickers (aria-labels, empty state), search route (rank +
  light index + auth), analyze-dev (404 in prod). Checks 7 (visual parity) + 8 (tooltips)
  read clean; final visual/375px confirm in D4.
- Verification: code read; no code changed yet (explain-before-build). **Scope question
  to owner: which a11y items to fix this round.**
- **Owner chose "Everything: a–e".** All five fixed (files: `HorizonSettings.tsx`,
  `CsvImport.tsx`, `TickerSearchAdd.tsx` + `cn` import, `BasketPicker.tsx`,
  `globals.css` `.run-search-opt--active`). **CI green** (`pnpm typecheck`/`lint`/`build`
  exit 0; build "Compiled successfully"; no Python touched). **Verified live in Claude
  Preview** (soft-nav `/run` from `/stocks`, `DEV_BYPASS_AUTH` in gitignored
  `.env.local`, removed after; `.next` cleared post-build): D2-a input aria-labels,
  D2-b chip aria-label, D2-c sector-reset + 58 chips, D2-d combobox arrow-nav /
  activedescendant / active-highlight / Esc, D2-e zone role/tabindex/aria-label; the
  preset `aria-pressed` confirms hydration; **0 console errors**. (Hard-nav to `/run`
  is the known un-hydrated dev quirk — soft-nav from a hydrated page works.)
- **Next: D3** (progress/complete/persistence UI — RunProgress, RunComplete,
  LastAnalysisCard, run/page+layout; checks 5/6/7/8/9/10).

### D3 — Progress / complete / persistence UI (2026-06-22) — read complete, 2 a11y items pending scope
Audited surfaces 13–16 against checks 5/6/7/8/9/10. **Check 5 (progress honesty +
cancel), 6 (persistence #15), 8 (clarity), 9 (empty/edge) all PASS.** RunProgress is
honest (real chunk pct, live elapsed, ETA, Processed/Scored/Skipped, Cancel) + carries
the D1-a phase label; RunComplete handles complete / cancelled / empty / cancelled-empty
with compliant labels + a linked top pick + client-side ratings; LastAnalysisCard renders
inputs-only and Re-run re-derives; the page/layout are a clean server shell with the
disclaimer strip in both branches. Findings (a11y only):
- **D3-a (a11y, RunProgress):** the bar is a plain `<div>` pair — add
  `role="progressbar"` + `aria-valuenow`/`valuemin`/`valuemax` + `aria-label`.
- **D3-b (a11y minor, RunProgress):** wrap the status line in `aria-live="polite"` so SR
  users hear "Analysing…" → "Double-checking…" → done.
- No code changed yet (explain-before-build). Both are tiny, same spirit as the D2 a11y
  pass. **Scope confirm to owner, then apply + D4.**
- **Owner chose "Apply both."** Done in `RunProgress.tsx`: `role="progressbar"` +
  `aria-valuenow/min/max` + `aria-label` on the bar; `aria-live="polite"` on the status
  span. **CI green** (typecheck/lint/build exit 0, "Compiled successfully"; no Python).
  `.next` cleared post-build. Verification: typecheck validates the prop types; the bar
  only mounts during an active run, so its live render rides on the deploy run with the
  D1-a phase label (the dev shim's run path is the slow/flaky one). No visual change.
- **Next: D4** — cross-cutting sweep: visual parity (§16) + 375px (Layer-H sidebar out
  of scope) + a full a11y pass + the final live-deploy confirmation of the run flow
  (progress phases, skip-count already proven).

### D4 — Cross-cutting sweep (2026-06-22) — visual + 375px + a11y verified
Live sweep in Claude Preview (soft-nav `/run` from `/stocks`, `DEV_BYPASS_AUTH`
removed after; `.next` cleared post-build). **No code changed in D4** — verification of
the prior fixes + the tab-wide checks.
- **Check 7 visual parity (§16) — PASS.** Desktop `/run` matches the beginner-first
  layout: disclaimer strip visible without scrolling, Last-Analysis card (17 · medium ·
  1d ago · Re-run), "Choose what to analyse" (6 quick baskets + By sector/By industry +
  Search & add + demoted CSV + sample download + empty-selection state), "Investing
  horizon" with the 4 preset cards and the **Medium-Term active brand gradient** (the key
  §16 look), plain-English description, Advanced disclosure, and a correctly-disabled Run
  button when nothing is selected. Tokens/typography consistent with Browse + Detail.
- **Check 7 / 375px — PASS (Layer-H isolated).** At mobile the global fixed sidebar
  squeezes the column (pre-existing, out of scope); neutralising it shows the Run UI fits
  a true 375px with zero overflow/clipping (baskets wrap, card one line).
- **Check 10 a11y — PASS.** Full keyboard tab order enumerated and logical: Re-run →
  6 baskets (each `aria-label` "{label} — {description}") → sector select → industry
  select → search **combobox** → CSV **role=button** zone → Download sample → Clear all →
  7 "Remove {ticker}" buttons → 4 preset cards → Advanced toggle → 3 InfoTip "What is …?"
  triggers + 3 labelled inputs → "Run Analysis · 7" (enabled once 7 selected). Every
  interactive element is reachable with an accessible name; 0 `tabindex=-1` traps in the
  flow; 0 console errors.
- **Check 8 tooltips — PASS.** InfoTips on the Advanced jargon (pullback/profit/lookback);
  preset descriptions in plain English; basket descriptions via aria-label/title.
- **Selection → Run enable (check 1) re-confirmed live:** Mag7 → 7 chips → Run button
  enabled; empty → disabled.

### Layer D audit — COMPLETE (2026-06-22)
All 10 checks pass across the 16 surfaces + cross-cutting items. **Fixes this audit
(8 files, all CI-green, no engine/Python touched):** D1-a progress phase label + monotonic
skipped count (`analysis.tsx`, `RunProgress.tsx`); D2 a11y a–e (`HorizonSettings.tsx`,
`CsvImport.tsx`, `TickerSearchAdd.tsx`, `BasketPicker.tsx`, `globals.css`); D3 a11y
(progressbar role + aria-live in `RunProgress.tsx`). Calc parity exact, persistence
inputs-only (#15), reliability 0-skips proven on two full-universe live runs, labels
compliant, disclaimer present, visual parity + a11y + 375px all clean.
- **Deploy-gated tail (rides the owner's next live run, both already low-risk):** the
  D1-a "Double-checking…" phase label and the D3 progressbar ARIA only render while
  RunProgress is mounted (mid-run) — confirmed by static checks + code; their live render
  appears on any real run. Skip-count + speed already proven (2026-06-22).
- **PAUSE-BEFORE-MERGE:** changes are committed-pending on `audit/layer-d-run-analysis`;
  owner merges (the whole Layer-D audit goes together per owner's instruction). **Layer E
  audit = separate later session.**
