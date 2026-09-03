/**
 * Chart ink — the literal colours the charting libraries need, in ONE place.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * Recharts takes colours as props (`fill`, `stroke`, `tick={{ fill }}`) and
 * Lightweight Charts takes them in an options object. Neither resolves a CSS
 * custom property, so chart code cannot say `var(--text-muted)` and has to write a
 * hex. Fine — but it was writing it **29 times across 12 files**, which is not a
 * limitation of the library, it is a copy of a design token (CLAUDE.md 11c).
 *
 * The cost came due on 2026-08-22. `--text-muted` was #8A97A8, measuring **2.97:1**
 * on white against a 4.5 floor, and it was darkened to #626B77 to fix 258 failing
 * elements on one signed-in page. Every one of those 29 chart literals stayed
 * behind at the old value — so every axis label, legend and watermark on the site
 * would have kept the exact defect the token change had just fixed, while looking
 * deliberate and matching nothing.
 *
 * ⚠️ These MUST equal their tokens. `pnpm check:tier-palette` asserts it, for the
 * same reason it asserts the rating palette: two copies of a colour drift, and the
 * drift is invisible — a slightly-too-light axis label is indistinguishable from a
 * design decision.
 *
 * ⚠️ And note WHY nobody noticed for so long: the contrast probe read
 * `getComputedStyle(el).color`, while SVG text takes its colour from `fill`. Every
 * chart label on the site was therefore unmeasurable, and unmeasurable reads as
 * clean (CLAUDE.md 14g). The probe now reads `fill` for SVG text.
 */

/** Axis ticks, legends, chart watermarks. Mirrors `--text-muted`. */
export const CHART_INK = '#626B77';

/** Body copy inside a chart — a summary strip value, a tooltip line. `--text-secondary`. */
export const CHART_INK_STRONG = '#4A5568';

/** Grid lines and axis rules. Mirrors `--border`. Decorative, never text. */
export const CHART_GRID = '#E2E8F0';

/**
 * The drawdown overlay's palette — the price line, the shaded fall, the average
 * rule and the lower-bound rule.
 *
 * ⚠️ IT EXISTED TWICE AND HAD ALREADY DRIFTED. `components/learn/chartPrimitives`
 * carried its own `DD_LINE / DD_FILL / AVG_LINE / LOW_LINE` under a comment that
 * named its source — *"the product's own drawdown palette"* — which is a copy by
 * construction (audit 5A-064). The audit recorded the three shared values as
 * still agreeing; checking the fourth showed they did not. The Learn figure drew
 * its average line in `#D4A017`, the pre-August gold, while the product draws it
 * in `INK.neutral` grey. So the article teaching a reader what a drawdown looks
 * like had stopped matching the thing it describes, and nothing could see it.
 *
 * One definition now, and the Learn primitives consume it rather than restating
 * it (CLAUDE.md 11c-x: make the second consumer derive from the first).
 */
export const DRAWDOWN = {
  /** The price line while the overlay is in drawdown mode. `--brand-mid`. */
  line: '#1E5CB3',
  /** The wash under a fall. */
  fill: 'rgba(178,34,34,.15)',
  /** The "typical drawdown" rule. Mirrors `INK.neutral`. */
  avg: '#6B6266',
  /** The lower-bound rule — the deepest confirmed fall. Mirrors `INK.down`. */
  bound: '#B22222',
} as const;

/**
 * The three brand blues, for canvas and for inline styles.
 *
 * ⚠️ NOT `INK.brand`, even though `BRAND.mid` is the same value today. `INK`
 * holds what a colour becomes as **words** — its docstring says so — and these are
 * drawn shapes: a marker dot, an area series, a crosshair label. The two are free
 * to move apart, and a shared name is exactly how they would silently stop being
 * (the note above `RATING_TIER_HEX` makes the same argument for ratings).
 *
 * Mirrors `--brand-deep / -mid / -bright`; `pnpm check:tier-palette` asserts it.
 */
export const BRAND = {
  deep: '#1A3A6E',
  mid: '#1E5CB3',
  bright: '#2E7DE8',
} as const;

/**
 * The furniture every Lightweight-Charts instance sets up: grid, crosshair, axis
 * borders. Identical in Price Chart, the drawdown overlay and Smart Money — and
 * hand-typed in all three, six values each (audit 5A-071).
 *
 * ⚠️ THIS ONE GENUINELY CANNOT BE A CSS VARIABLE. Lightweight Charts paints to a
 * `<canvas>`; a canvas takes a colour string with no stylesheet behind it, so
 * `var()` there is an unparseable colour rather than a token. Recharts is the
 * opposite case and `lib/ink.ts` now says so.
 *
 * ⚠️ The grid and the axis border are DIFFERENT values and always have been —
 * `#F0F4F8` for the ruled lines inside the plot, `#E2E8F0` for the axis edge.
 * Worth stating because they look like a typo for one another, and collapsing
 * them would flatten the plot's edge into its interior.
 */
export const CHART_CHROME = {
  /** Ruled lines inside the plot. Mirrors `--bg-page`, so they read as ground. */
  grid: '#F0F4F8',
  /** The dashed crosshair. `--text-secondary` at 60%. */
  crosshair: 'rgba(74,85,104,.6)',
  /** The dark chip carrying the crosshair's value on the axis. `--brand-deep`. */
  crosshairLabel: '#1A3A6E',
  /** The price/time axis edge. Mirrors `--border`, one step darker than the grid. */
  axis: '#E2E8F0',
} as const;

/**
 * The same overlay in PROFIT mode — the run up from a low rather than the fall
 * from a high. Same four roles, opposite direction.
 *
 * ⚠️ ONLY HALF OF THIS OVERLAY WAS NAMED. `DRAWDOWN` was extracted on 2026-09-02
 * so the Learn figures could not drift from the chart they illustrate; the four
 * values on the other branch of the same ternary, eight lines away in the same
 * function, stayed hand-typed. Nothing was wrong with them and nothing looked
 * odd — which is exactly why an extraction that stops at the case in front of you
 * is worth re-reading before you leave the file (CLAUDE.md 11c-x).
 */
export const PROFIT = {
  /** The price line while the overlay is in profit mode. */
  line: '#228B22',
  /** The wash over a rise. */
  fill: 'rgba(34,139,34,.15)',
  /** The near-invisible far edge of that wash. */
  fade: 'rgba(34,139,34,.01)',
  /** The upper-bound rule — the strongest confirmed run. */
  bound: '#006400',
} as const;

/**
 * The dark chart tooltip — the one surface on this site that inverts.
 *
 * ⚠️ AUDIT 5A-074 RECORDED THIS AS THE OPPORTUNITY MAP'S "PRIVATE PALETTE",
 * appearing "only there". Counted 2026-09-03: these four values are hand-typed
 * **34 times across 9 components** — Opportunity Map, Balance Sheet, Dividend
 * History, Earnings History, Ownership Structure, Quarterly Financials, Relative
 * Performance, Snowflake Radar and Valuation History. It was never one chart's
 * private palette; it is a site-wide surface that nine components each invented
 * separately and identically.
 *
 * That matters for the reason 5A-071 gives: a colour in no palette is a colour a
 * palette change can never reach. Retuning this tooltip meant nine edits in nine
 * files with nothing linking them, so the realistic outcome of any such change was
 * eight of nine — which is 11c-iv (the consumer that never received the rule), and
 * it renders perfectly either way.
 *
 * ⚠️ These are inline `style` on plain `<div>`s, where `var()` WOULD resolve. They
 * live here rather than in `globals.css` anyway, because a CSS token no rule reads
 * is a token nothing keeps honest — the `.tier-legend` block deleted on 2026-09-02
 * had been compiled into every stylesheet for a month with no consumer at all. One
 * definition, in the place its consumers can import.
 */
export const CHART_TOOLTIP = {
  /** The panel. Near-black, deliberately not `#000` — a pure black edge haloes. */
  bg: '#1A1A1B',
  /** Its 1px border, a step up from the panel so the corner reads on a dark chart. */
  border: '#2E3347',
  /** The heading line — a ticker, a date, a label. */
  text: '#E8EAF0',
  /** The value lines and the company name beside a ticker. */
  muted: '#94A3B8',
} as const;

/**
 * The Opportunity Map's four quadrants — the part of audit 5A-074 that really was
 * private to one chart, once the tooltip above turned out to be site-wide.
 *
 * Each quadrant is a WASH plus a LABEL, and they are different values on purpose:
 * the wash carries an alpha and is decoration with no contrast duty, the label is
 * text on the paid screener and owes 4.5:1. "Healthy, fully priced" is the pair
 * that shows why — the wash is the old gold, the ink is a much darker one, and a
 * single value could not have served both.
 *
 * ⚠️ TWO OF THESE ARE RETIRED RATING HUES. `zoneGood` is `#006400`, the green this
 * product used for *High Conviction* before 2026-08-22, and `zonePricedWash` is
 * `#D4A017`, the gold *Neutral* wore before the same date. They are not rating
 * chips and nothing is mislabelled — but they are the colours a palette change
 * silently leaves behind, which is 11c-viii exactly, and the stray-copy scan in
 * `check-tier-palette` cannot flag them because they stopped being tokens at all.
 *
 * ⚠️ THEY ARE NAMED HERE AND DELIBERATELY NOT REPAINTED. `/results` is a paid
 * surface, and a real defect does not entitle me to widen my scope on one
 * (CLAUDE.md 11l — the owner reversed exactly that once already). Naming them
 * makes the decision a one-line change whenever the owner wants it; today it
 * changes no pixel.
 *
 * ⚠️ ONLY THE FOUR WASH HUES AND THE SPLIT LIVE HERE, and the two labels that
 * BORROW another palette stay `var(--brand-deep)` / `var(--c-tier-5-ink)` in the
 * component. Copying those values in would have said "this label happens to be
 * #8B1414" where the truth is "this quadrant's label IS our Bearish ink" — and
 * the stray-copy scan in `check-tier-palette` caught it the moment it was tried,
 * which is the check working exactly as intended (11c-viii).
 *
 * ⚠️ And `var()` in a Recharts label fill genuinely resolves — measured in Chrome
 * on 2026-09-03, `fill="var(--brand-deep)"` computes to `rgb(26, 58, 110)`. See
 * the correction at the top of `lib/ink.ts`; the repo had said the opposite.
 */
export const OPPORTUNITY_ZONES = {
  /** Healthy AND cheap — the quadrant the product exists to point at. */
  zoneGood: '#006400',
  /** Healthy but expensive: a pale gold wash under a much darker gold label. */
  zonePricedWash: '#D4A017',
  /** This one is nobody else's colour, so it does live here. */
  zonePricedInk: '#7A5B0E',
  /** Weak but cheap. The label is `var(--brand-deep)`, in the component. */
  zoneCheapWash: '#1E5CB3',
  /** Weak and expensive. The label is `var(--c-tier-5-ink)`, in the component. */
  zoneWorstWash: '#B22222',
  /** The dashed cross-hairs splitting the four quadrants. */
  split: 'rgba(138,151,168,.45)',
} as const;

/**
 * Candle bodies, wicks and the up/down edges of a bar.
 *
 * ⚠️ A SECOND DIRECTION PAIR, AND IT IS DELIBERATE. `INK.up` / `INK.down` are the
 * values direction takes as **words**, chosen in August for contrast against a
 * tint. These are the values it takes as a **drawn shape** — a candle body, a
 * wick, a marker edge — where the rule is a 3:1 non-text floor and the convention
 * every trading tool follows. The owner scoped the drawn form out of that work on
 * purpose, and `lib/ink.ts` says so at the top of the file.
 *
 * What was NOT deliberate is that the drawn pair existed in no palette: 22
 * hand-typed copies across nine components (5A-071). So the pair that was
 * explicitly protected from change was also the pair nothing could have changed
 * consistently if the owner ever asked.
 */
export const CANDLE = {
  /** A rising candle, a beat, an increase. */
  up: '#006400',
  /** A falling candle, a miss, a cut. */
  down: '#8B0000',
} as const;
