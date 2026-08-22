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
