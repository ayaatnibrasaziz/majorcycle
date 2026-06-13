# Design System

> **Purpose:** Defines every visual primitive — colours, fonts, spacing, components, chart standards, labels — used in `MajorCycle`. Read this before any UI task. Pair it with the visual parity rule from CLAUDE.md and the reference HTML.
>
> See also: `CLAUDE.md`, `/reference/original-design.html`.

---

## 1. The Visual Parity Rule (Repeat, Important)

Every UI section that has an equivalent in `/reference/original-design.html` MUST visually match it: same layout, same spacing, same hover behaviour, same tooltips, same colours. Before building any UI component:

1. Open `/reference/original-design.html`
2. Locate the equivalent section (search for distinctive text or class names)
3. Inspect its HTML structure, CSS values, and behaviour
4. Replicate in React + Tailwind

The new build's job is to **rebuild the same product on a modern foundation**, not to redesign it. Where reference exists, reference wins.

---

## 2. Brand Colours

```css
:root {
  /* Brand — primary identity */
  --brand-deep:    #1A3A6E;
  --brand-mid:     #1E5CB3;
  --brand-bright:  #2E7DE8;
  --brand-light:   #EBF3FF;

  /* Surfaces */
  --bg-page:       #F0F4F8;
  --bg-surface:    #FFFFFF;
  --bg-sidebar:    #FFFFFF;
  --bg-header:     #FFFFFF;
  --bg-hover:      #F5F8FF;
  --bg-stripe:     #F8FAFC;

  /* Text */
  --text-primary:   #0F1923;
  --text-secondary: #4A5568;
  --text-muted:     #8A97A8;
  --text-white:     #FFFFFF;

  /* Borders */
  --border:        #E2E8F0;
  --border-strong: #CBD5E1;
  --border-faint:        rgba(26,58,110,.08);
  --border-faint-strong: rgba(26,58,110,.10);

  /* Rating tier semantic colours (the underlying hex values do not change,
     only the label text changes — see section 4 below) */
  --c-tier-1:      #006400;  /* High Conviction */
  --c-tier-2:      #228B22;  /* Constructive */
  --c-tier-3:      #D4A017;  /* Neutral */
  --c-tier-4:      #FF4500;  /* Cautious */
  --c-tier-5:      #B22222;  /* Bearish */

  /* Ink shades — for text on tinted backgrounds */
  --c-tier-2-ink:  #0D5C0D;
  --c-tier-5-ink:  #8B1414;
  --c-tier-3-ink:  #8A6710;

  /* Tint scale — 10/12% alpha for pills, cells, hover states */
  --tint-tier-2:        rgba(34,139,34,.10);
  --tint-tier-2-strong: rgba(34,139,34,.12);
  --tint-tier-5:        rgba(178,34,34,.10);
  --tint-tier-5-strong: rgba(178,34,34,.12);
  --tint-tier-3:        rgba(212,160,23,.10);
  --tint-tier-3-strong: rgba(212,160,23,.12);
  --tint-brand:         rgba(46,125,232,.10);
}
```

These are exposed as Tailwind v4 theme tokens in `tailwind.config.ts`:

```ts
theme: {
  colors: {
    'brand-deep': 'var(--brand-deep)',
    'brand-mid': 'var(--brand-mid)',
    'brand-bright': 'var(--brand-bright)',
    'tier-1': 'var(--c-tier-1)',
    // ...
  }
}
```

---

## 3. Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

| Use | Font | Weight | Size |
|---|---|---|---|
| All UI text (body, labels, buttons) | Sora | 400 / 500 / 600 / 700 | 11px – 16px |
| Numbers, prices, scores, percentages, code | JetBrains Mono | 400 / 500 / 600 | 11px – 26px |
| Hero values (KPI cards, headline metrics) | JetBrains Mono | 600 | 26px (`--font-hero`) |
| Card titles | Sora | 600 | 13px |
| Tooltips | Sora | 400 (title 600) | 11px |
| Body small | Sora | 400 | 12px |
| Body | Sora | 400 | 14px |

**Rule:** Every numeric value uses JetBrains Mono. Every word uses Sora. No exceptions.

---

## 4. Rating Tier Labels — THE Most Important Spec

The five composite rating tiers display as **neutral, advice-free language**. The colours and score bands stay identical to the original; only the label words change.

| Score Range | Label (use exactly this text) | Colour Token | Semantic |
|---|---|---|---|
| 80–100 | **High Conviction** | `--c-tier-1` (#006400) | Best-in-class opportunity |
| 65–79 | **Constructive** | `--c-tier-2` (#228B22) | Favourable setup |
| 50–64 | **Neutral** | `--c-tier-3` (#D4A017) | Mixed signal |
| 35–49 | **Cautious** | `--c-tier-4` (#FF4500) | Elevated risk |
| 0–34 | **Bearish** | `--c-tier-5` (#B22222) | Significant concerns |

**Forbidden everywhere in our scoring outputs:** Buy, Sell, Strong Buy, Hold, Avoid, Recommend, Outperform, Underperform, Overweight, Underweight.

**Allowed verbatim from yfinance for the Analyst Consensus field only:** "Strong Buy / Buy / Hold / Underperform / Sell" — these are reported as third-party data, with an "Analyst consensus from Yahoo Finance" attribution underneath.

### Valuation Zone Labels (a separate dimension)

The Major Cycle valuation_zone is also re-labelled:

| Old | New |
|---|---|
| STRONG BUY | DEEP VALUE |
| BUY | VALUE |
| WATCH | FAIR |
| HOLD | STRETCHED |

---

## 5. Chart Colour Standards

Every chart MUST follow these. Hard rule.

| Direction / Meaning | Fill | Border |
|---|---|---|
| Positive / up / profit / good | `#228B22` | `#006400` |
| Negative / down / drawdown / bad | `#B22222` | `#8B0000` |
| Neutral / informational | `#1E5CB3` | `#1A3A6E` |
| Highlight / cursor / focus | `#2E7DE8` | `#1A3A6E` |
| Grid lines | `#E2E8F0` (10% alpha for major, 5% for minor) | — |
| Axis labels | `#8A97A8` | — |

### Candlestick colours (Lightweight Charts config)

```ts
{
  upColor: '#228B22',
  downColor: '#B22222',
  borderUpColor: '#006400',
  borderDownColor: '#8B0000',
  wickUpColor: '#006400',
  wickDownColor: '#8B0000',
}
```

### 50/200 DMA line colours

- 50 DMA: `#2E7DE8` (brand-bright), 1.5px solid
- 200 DMA: `#1A3A6E` (brand-deep), 1.5px dashed (`[6, 4]` dash pattern)

---

## 6. Spacing Scale

Tailwind defaults work but the reference uses these specific values for cards and content stacks:

| Token | Value | Use |
|---|---|---|
| `--space-stack-tight` | 8px | Header strip elements |
| `--space-stack-snug` | 14px | Paired/related cards |
| `--space-stack-base` | 18px | Distinct sections |
| Card padding (default) | 14–18px | Card body interior |
| Card padding (`--bleed`) | 0 | Full-width tables inside cards |
| Page outer padding | 20–24px | Main content area |
| Sidebar width | 220px | Fixed |
| Header height | 58px | Fixed |

---

## 7. Border Radius

| Token | Value | Use |
|---|---|---|
| `--radius` | 10px | Cards, modals, large surfaces |
| `--radius-sm` | 6px | Pills, buttons, badges, inputs |

---

## 8. Shadows

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
--shadow-md: 0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04);
--shadow-lg: 0 10px 30px rgba(0,0,0,.10), 0 4px 8px rgba(0,0,0,.06);
```

- `sm`: default for cards, sidebar
- `md`: hover state on cards, dropdowns
- `lg`: modals, popovers, tooltips

---

## 9. Component Vocabulary

These are the canonical components. Use them. Don't invent new variants without owner sign-off.

### Card

White surface, subtle border, slight shadow. Standard wrapper for any data section.

```
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.card-header {
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center;
}
.card-title {
  font: 600 13px Sora; color: var(--text-primary);
}
.card-body { padding: 14px 18px; }
```

### Stat Pill

Small inline chip showing label + value, used in stat rows.

```
.stat-pill {
  background: var(--bg-stripe);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  text-align: center;
}
.stat-pill-label {
  font: 600 9px Sora; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted);
}
.stat-pill-val {
  font: 600 15px JetBrains Mono; color: var(--text-primary);
}
```

### Tier Badge / Pill

The headline rating badge. Coloured by tier.

```
.tier-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  font: 600 11px Sora; letter-spacing: 0.3px;
}
.tier-badge--tier-1 { background: rgba(0,100,0,0.12); color: var(--c-tier-1); }
.tier-badge--tier-2 { background: var(--tint-tier-2-strong); color: var(--c-tier-2-ink); }
.tier-badge--tier-3 { background: var(--tint-tier-3-strong); color: var(--c-tier-3-ink); }
.tier-badge--tier-4 { background: rgba(255,69,0,0.10); color: #B23A00; }
.tier-badge--tier-5 { background: var(--tint-tier-5-strong); color: var(--c-tier-5-ink); }
```

### Tooltip

**Canonical primitive: `InfoTip` (`web/components/ui/InfoTip.tsx`).** A visible **ⓘ** affordance (Lucide `Info`) that reveals a plain-English explanation. Use it for any jargon, score, or section a beginner might not recognise.

- Opens on **hover (desktop), tap (mobile/touch), and keyboard focus** — native `title=` never fires on touch, so it is not acceptable for beginner-facing jargon (design-system §10 requires tap-to-reveal on mobile).
- The bubble is **portalled to `<body>` with `position: fixed`**, so it is never clipped by a card / `chart-canvas-wrap` / scrollable table `overflow`, and it **clamps to the viewport** (flips above the trigger when low on space).
- Accessible: `role="tooltip"`, `aria-label` / `aria-expanded`, `:focus-visible` ring. Closes on Escape / outside-pointerdown / scroll / resize.
- Type spec per §3: title 600 / body 400, 11px Sora, `shadow-lg`. Styles live in the `.info-tip-*` block in `globals.css`.

```tsx
<InfoTip title="Typical Drawdown">
  The average dip this stock has fallen through in its past cycles…
</InfoTip>
```

Pass a short bold `title` plus the explanation as `children`. Safe to render inside Server Components (children are plain strings — no event-handler props cross the RSC boundary).

> The reference HTML's vanilla-JS `data-tip="TITLE|body"` / `has-tip` pattern does **nothing** in React — it is superseded by `InfoTip`. Plain native `title=` is still fine for low-stakes, desktop-only affordances (e.g. chart toggle buttons).

### Table (zebra striping)

**Canonical mechanism: CSS-automatic `tbody tr:nth-child(even) { background: var(--bg-stripe); }`** (+ a `:nth-child(even):hover { background: var(--bg-hover); }` variant), scoped per table class. This is what `.km-table` (Key Metrics) and `.ownership-table` (Top Institutional Holders) use, so all data tables stripe identically with the same `--bg-stripe` (#F8FAFC) shade.

> **Deprecated:** the reference HTML's `.stripe` class (manually tagging odd rows + a global `tbody tr.stripe` rule) was **not** ported to the Next app. Do **not** add a `stripe` className in components — it has no CSS rule and renders unshaded. Use `:nth-child(even)` on the table's own class instead.

### Smart Money chart (event-marker chart)

The Smart Money Activity chart is the one **non-candlestick chart built on Lightweight Charts** instead of Recharts — a deliberate exception to decision #2, chosen for native pan/zoom + a reliable crosshair tooltip. Don't migrate it back to Recharts.

- Price = an LWC **area series**; insider/analyst events = LWC **markers** (`series.setMarkers`): ▲ buy (belowBar, `#006400`), ▼ sell (aboveBar, `#B22222`), ● award/gift/other (inBar, dot colour), ▮ analyst (square, grade colour). Default range **1Y**; 1Y/3Y/All presets via `.range-btn`.
- **Two-tier event view** (a tooltip can't be scrolled, and dense days overflow):
  - **Hover = quick preview** (`.smart-chart-tip`) — created imperatively on `<body>` (`position: fixed`) so the chart edge never clips it; capped at 4 events + a "+N more — click to see all" line. *(It is created with `document.createElement`, NOT a `typeof document` portal — that branch differs server vs client and throws a hydration mismatch.)*
  - **Click / tap a day = pinned panel** (`.smart-day-panel`) — portalled, viewport-clamped, `max-height: 50vh; overflow-y: auto`, lists *every* event that day with a close button. Gated on a `dayPanel` state (null until a click), so it renders nothing at hydration. Closes on Esc / outside-click / page-scroll / resize.

### Scorecard radar (`SnowflakeRadar`)

The Stock Scorecard plots the five Financial-Health pillars (Recharts `RadarChart`) plus a right-hand bar list. Conventions (S9):

- **Pillar colours are score-based, by the rating tiers** — this **deliberately deviates from the reference**, which used fixed per-axis identity colours (so "Shareholder" rendered red even at 100, falsely reading as "bad"). Each bar fill, score number, and radar vertex dot is coloured by `tierColor(score)`: ≥80 `#006400` · ≥65 `#228B22` · ≥50 `#D4A017` · ≥35 `#FF4500` · <35 `#B22222`. Colour now *means* "strong → weak". The connecting polygon stroke/fill stays brand blue (`#1E5CB3` / `rgba(30,92,179,.15)`) as the neutral "shape".
- **Full 0–100 radius scale** (a maxed pillar reaches the outer grid ring). The **angle-axis labels sit in the margin *outside* the grid ring** — the custom `AngleAxisTick` anchors each label *outward* (right→`start`, left→`end`, top/bottom→`middle`) with a small radial nudge. `outerRadius` is ~52% and the radar column is widened (`.radar-grid` `340px 1fr`) so the long names ("Balance Sheet", "Shareholder") clear without clipping.
- **A11y:** the chart wrapper carries `role="img"` + a dynamic `aria-label` summarising the plotted pillars (reflects only the real pillars, so a withheld-pillar stock reads fewer).
- **Weighting is explained, not shown per-bar:** the Health Score is the *weighted* mean (Profitability 30 / Balance Sheet 25 / Growth 20 / Cash Flow 15 / Shareholder 10); the weights live in the card-title `InfoTip` only (a per-bar weight column was tried and removed as too busy). Subtitle is just `Health Score N/100`.
- **Insufficient-data state:** pillars with no data are omitted (not a 0-spike); `< 3` pillars → the radar shows "Not enough fundamental data" and FH is withheld (see methodology-audit P3).

### Numeric display — sanity caps & distress flags

Real yfinance values can be absurd (a near-zero denominator gives P/E 3,500×, ROE 8,457%, operating margin −546,607%, payout 18,210%). **Never render the raw figure as a confident headline.** The pattern (S8/S9):

- **`MetricDef.cap`** (Key Metrics, `MetricsTable.tsx`): a per-metric cap. Beyond `±cap` the cell shows `>+cap` / `<−cap`, and the **true value goes in the hover tooltip** ("Actual … — capped for display"). Current caps: P/E 150x · EV/EBITDA 150x · PEG 25 · FCF Yield 100% · Op/Net Margin 300% · ROE 300% · ROA 300% · D/E 25 · Current Ratio 25 · Revenue/Earnings Growth 300%.
- **Median hygiene:** the same bounds are mirrored in `medians.server.ts` `OUTLIER_BOUND` so capped outliers don't skew the peer median (bump the cache key when you change them).
- **Distress flag (not a cap):** where a high number is *bad* (a trailing dividend yield > 20% almost always means a collapsed price / imminent cut), show the **real** value but recolour it amber (`#D4A017`, not reassuring green) + a ⚠ + a caution tooltip — capping it would read as "good".
- **`fmtCapped(value, cap, decimals)`** (`web/lib/format.ts`) is the shared helper for **prose** numbers — the same cap pattern for values interpolated into sentences rather than table cells. Used by the Thesis narrative (`VerdictCard` `bestStrength`/`topRisk`, `ThesisInsights` `buildAttractive`/`buildRisks`): ROE/margins/growth 300, FCF Yield 100, D/E & PEG 25. Beyond the cap it renders ">cap" inline (e.g. "an exceptional >300% return on equity").
- These are **display-only**: the cycle math and FH pillars already clamp their inputs, so ratings are untouched.

### Thesis narrative — quality-gated cheapness

The "Why Attractive" card (`ThesisInsights.buildAttractive`) must **not** list a deep dip as an attraction when the business is weak. Its *"trading at or below its historical average dip — historically attractive entry zone"* bullet is gated: **dropped when Financial Health is weak (`< 50`) or withheld (`null`)**. This mirrors the S3 valuation quality-gate (a value trap is cheap because the business is deteriorating, not because the market is wrong — see methodology-audit P1) and keeps the narrative consistent with the Verdict, which already calls such names "financial health is stressed". The raw cycle-position label (`DEEP VALUE`/Verdict sentence 1) is left as-is — it honestly states *where the price is*; the Verdict's financial-health + primary-risk sentences supply the counterweight.

### Statement engine — no contradictions (Thesis cards + Verdict)

"Why Attractive" / "Key Risks" (`ThesisInsights`) and the Verdict's three sentences (`VerdictCard` `sentence1`/`bestStrength`/`topRisk`) generate copy from threshold rules over the same cycle + fundamentals. **The two surfaces must never assert opposite things about one metric for one ticker.** Two rules guarantee this:

1. **Disjoint thresholds per metric.** The Attractive trigger and the Risk trigger for a metric must not overlap, and no fallback may bridge them. Current bands: revenue growth — *accelerating* `≥ 15` (Attractive) · *modest* `[0, 15)` (Risk) · *declining* `< 0` (Risk); D/E — fortress `< 0.5` vs elevated `≥ 1.5`; PEG — cheap `(0, 1.5)` vs stretched `> 3`; net margin — *strength* `≥ 10` (`bestStrength`) vs *thin* `< 5` (Risk); pullback events — `≥ 10` vs `< 8`. Cycle position: the "attractive entry zone" bullet requires `typicalDrawdown ≤ −5 && dd ≤ typicalDrawdown` (⇒ `dd ≤ −5`), so it is disjoint from the "near highs" risk (`dd > −5`).
2. **Fallbacks never assert a metric claim.** A fallback must be either *gated* to the range that makes it true, or a *tautological cycle caveat* that can't be wrong. The "Why Attractive" empty-state shows a factual cycle line ("Down X% from its N-day peak…"); the "Key Risks" empty-state shows the single caveat *"Cycle patterns are historical and may not repeat…"*; `topRisk`'s final fallback is *"the chief risk is the historical cycle pattern not repeating…"*. None is tagged Strong/Severe.

When you add or retune a rule, re-check the disjointness table and run the universe sweep (see `layer-c-audit.md` verification). FCF-yield-strong + thin-net-margin is an allowed *tension* (different quantities), not a contradiction.

### Verdict entry-zone band

The Verdict's three band tiles derive from the cycle stats + a back-solved peak (`peak = currentClose / (1 + currentDrawdown/100)`; `priceAt(dd) = peak·(1 + dd/100)`):

- **Entry Zone** = `priceAt(typicalDrawdown)` (top) → `priceAt(typicalDrawdown + 0.85·(lowerBound − typicalDrawdown))` (bottom) — i.e. from the typical-dip price down **85% of the distance** toward the worst-case low (not the full range).
- **Reload Level** = `priceAt(lowerBound)` (the worst historical drawdown — sits distinctly below the band).
- **Invalidation** = `reload × 0.95` (5% below reload).

### Price formatting (per-share $)

Use the shared helpers in `web/lib/format.ts` — **never** hand-roll `Intl`/`currencySymbol` in a component (that drifted into `C$` vs `CA$` and hardcoded `$`):

- **`fmtPrice(n, currency)`** — **uniform 2 dp for every price ≥ $1** (`$306.31`, `$120.00`, `$45.30`, `$1.50`); below $1 it adds decimals so a small price is never "$0" (`$0.135` · `$0.0135`). Used for **all per-share prices** — current quote, analyst targets, Verdict band levels, DMAs, 52W low/high. **One signature, no options.** *(This deliberately replaced an earlier magnitude-aware rule that used 0 dp ≥ $100 — it mixed precision within a group, e.g. a `$95.20` target next to a `$120` target. Uniform 2 dp is the finance-standard and never mixes. "Whole-dollar ≥ $1" was also rejected: it rounds low-priced stocks coarsely, e.g. a $4.30 DMA → "$4".)*
- **`fmtPerShare(n, currency)`** — always 2 dp, currency-aware. For **EPS / DPS** (conventionally 2 dp regardless of size).
- **`fmtCompact(value, currency?)`** — adaptive **K/M/B/T** for large **quantities** (market cap, balance-sheet/revenue totals, share counts). The mantissa is always ≥ 1, so a real small value **never collapses to "0.0M"/"0B"** (the bug: a small-cap's cash forced into billions → "$0B"). Pass `currency` for money; **omit it for counts** like shares. **Never** force a fixed unit (`/1e9 …'B'`) or pre-divide chart data by `1e9` — plot raw values and let the formatter drive the axis so the scale adapts to the company (M for small caps, B for large). Use this for **off-axis** spots (stat strips, tables, tooltips, Browse).
- **`makeCompactAxisFormatter(axisMax, currency?)`** — the **chart-axis** variant: same unit + same decimals on EVERY tick (per-value `fmtCompact` would mix "70.0M" beside "140M" on one axis, which looks wrong). 0 dp when the axis ticks are whole, a uniform 1 dp only when fractional. `axisMax` = the largest |value| *currently plotted* (react to legend toggles; account for stacked series). dp is decided from a **nice-rounded** step (recharts nices the top tick, so a raw `dataMax/4` is unreliable).
- **Never** hand-roll `Intl`/`currencySymbol`/hardcoded `$` in a component (that drifted into `C$` vs `CA$` and `$1.71` for AUD) — always use these helpers.

### Range Buttons

For chart timeframe selectors (1Y / 3Y / Max).

```
.range-btn {
  padding: 4px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: transparent;
  font: 500 11px JetBrains Mono; color: var(--text-muted);
  cursor: pointer; transition: all 0.15s;
}
.range-btn:hover { border-color: var(--brand-mid); color: var(--brand-mid); }
.range-btn.active {
  background: var(--brand-mid); border-color: var(--brand-mid); color: white;
}
```

### Provenance Bar

The "Major Cycle engine" status strip at the top of Results.

> **Do not name the third-party data provider in user-facing copy (S9, owner decision).** We don't advertise where the raw data comes from. Earlier copy said "via Yahoo Finance"; that name was removed everywhere it was visible (header analyst badge, Analyst Targets, News, Onboarding) while keeping the compliance-relevant "third-party data — not our rating" framing for analyst figures (decision #17). Internal code/comments and the Python provider name may stay; only user-visible copy must be generic. *(The Latest-News article links still resolve to the source's URLs — those are the real article destinations, not a label.)*

### Briefing Card

The "Analyst Briefing" callout at the top of Results. Has the icon-left, content-right layout.

### Empty State

Pattern: centered icon + bold heading + muted descriptive text + optional CTA link.

---

## 10. Responsive Breakpoints

Mobile-first. Tailwind defaults:

| Breakpoint | Width | Layout |
|---|---|---|
| Default (mobile) | < 768px | Single column, sidebar becomes drawer |
| `md` | ≥ 768px | Two-column where appropriate |
| `lg` | ≥ 1024px | Sidebar visible, full desktop layout |
| `xl` | ≥ 1280px | Wider content area, larger charts |

**Critical:** the existing reference HTML is desktop-only. Mobile layouts are NEW and must be designed during the build — see roadmap.md for which screens need mobile-specific treatment.

**Mobile patterns:**
- Sidebar nav becomes hamburger drawer
- Tables: horizontal scroll OR collapse to cards (case by case)
- Multi-column grids stack vertically
- Tooltips become tap-to-reveal popovers (not hover)

---

## 11. Loading & Empty States

### Loading

- **Page-level:** Skeleton shimmer matching the eventual content shape. Never a spinner blocking the whole viewport.
- **Chart-level:** Render an empty chart canvas with axis but no data, plus a small "Loading…" pill bottom-right.
- **Button-level:** Replace button text with spinner icon + disabled state.

### Empty (no data)

Pattern: icon (40px, muted stroke) + bold 14px title + muted 12px description + optional CTA.

Example from the reference:
> "No analysis run yet — Upload a CSV of tickers in the Run Analysis tab and your ranked results will appear here."

### Error

Pattern: red-tint card + 16px title + body explanation + CTA to retry or contact support.

---

## 12. Animations

Subtle, fast, purposeful. No bouncy easings.

| Transition | Duration | Easing |
|---|---|---|
| Hover state changes | 150ms | `ease-out` |
| Card fade-in on mount | 250ms | `ease-out` |
| Modal open/close | 200ms | `ease-in-out` |
| Tab switch | 0ms (instant) | — |
| Chart updates | 300ms | `ease-out` (built into chart libs) |

Use `prefers-reduced-motion` to disable on user request.

---

## 13. Iconography

Use **Lucide React** (`lucide-react`) exclusively. Stroke width 1.5 by default, 24px size for most uses, 16-18px inline with text.

Common icons used:
- `TrendingUp` / `TrendingDown` — direction
- `Info` — tooltips
- `ChevronDown` — dropdowns
- `Search` — search inputs
- `Upload` — file upload
- `RotateCw` — refresh
- `LogIn` / `LogOut` — auth
- `User` — account
- `Settings` — preferences

---

## 14. Accessibility Floor

Phase 1 minimums (not aspirations — requirements):

- All interactive elements have `:focus-visible` ring (2px brand-bright outline)
- Contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text
- All charts have a `aria-label` describing their data
- All form inputs have a visible `<label>`
- Keyboard navigable: Tab moves through everything in document order
- Screen-reader announces tier badges as "High Conviction rating" (via `aria-label`)

---

## 15. Disclaimers — Visual Treatment

Disclaimers are mandatory on any page showing a rating. Visual style:

- **Inline (under rating):** 11px italic muted text, brief: *"Information only — not financial advice."*
- **Footer (every page):** Full disclaimer block, 12px muted text, with link to `/disclaimer`.
- **First-login modal:** Modal with full methodology + disclaimer summary, "I understand and acknowledge" checkbox required to proceed.
- **Methodology modal (in-app):** The primary scoring explainer is a modal opened from the "Methodology" button in the Stock Detail subnav — visual parity with the reference methodology modal (`reference/original-design.html:794`), content corrected to the current engine, formula blocks included (it's behind sign-up). It carries its own footer disclaimer. See `web/components/stocks/MethodologyModal.tsx`.
- **Methodology page (public, deferred):** A separate **high-level, no-formula** public page for first-time visitors (before sign-up) is a later Layer F item — distinct from the in-app modal; do not expose the full formula detail publicly.

Wording must include: "Information only", "Not financial advice", "Past performance does not indicate future results", "Conduct your own research".

---

## 16. Where The Reference Diverges From This Doc

The reference HTML uses old labels (STRONG BUY etc.). The new build uses the labels defined in section 4. **Everything else** in the reference is canonical: layouts, sizes, colours, spacing, tooltips, hover behaviour.

If you find another conflict during build, surface it. Don't silently choose.

---

**End of design-system.md.**
