#!/usr/bin/env node
/**
 * The five rating-tier colours: one palette, and every one of them legible.
 *
 * ── Why this check exists ────────────────────────────────────────────────────
 * Until 2026-08-22 those five hexes were typed out by hand **247 times across 26
 * files** — the stylesheet, the screener table, the KPI strip, the radar, the
 * verdict card, the Excel export, the landing page. Three of them could not carry
 * white text (Neutral at **2.38:1** against a 4.5 floor), and `.score-num` is
 * white numerals on a solid tier colour, so the product shipped an accessibility
 * failure on every ranked row and in every downloaded workbook.
 *
 * It survived because contrast and axe only ever walked PUBLIC routes and the
 * chips live on the gated screener. Nothing measured them for the life of the
 * product. That gap is closed separately; this guard closes the two ways it could
 * come back.
 *
 * ── The two invariants ───────────────────────────────────────────────────────
 *
 * 1. **The two copies agree.** `app/globals.css` holds the CSS custom properties
 *    and `lib/ratings.ts` holds `RATING_TIER_HEX`. There must be two, and neither
 *    can be derived from the other at runtime: CSS cannot be imported into
 *    TypeScript, and the `.xlsx` workbook is generated with no DOM to resolve a
 *    variable against. So the drift is made impossible rather than discouraged.
 *
 * 2. **Every tier is legible where it is actually used** — and this is the half
 *    that would have caught the original defect on the day it was written. Each
 *    colour must clear the WCAG AA floor BOTH as a background under white text
 *    (`.score-num`, the workbook fill) and as text on the darkest ground the site
 *    puts it on (`.score-tag`, `--kpi-value-color`).
 *
 *    ⚠️ The floor here is **4.8, not 4.5**, deliberately. The first attempt at
 *    this fix solved against #FFFFFF, which cleared 4.5 comfortably and still
 *    shipped **4.41** to the probe — because the results table's rows are #F8FAFC
 *    and the page ground is #F0F4F8, and for dark text a lighter ground is the
 *    EASY case. Measuring on white measures the one place the colour was never in
 *    trouble (CLAUDE.md 11l ii). The margin absorbs the next surface's ground
 *    without another round of this (11i-b: assert a margin, not a boundary).
 *
 * 3. **The palette is not copied back out.** The three colours that CHANGED are
 *    distinctive, so any file other than the two sources containing one of them is
 *    a fresh copy. (Tiers 1 and 5 were already legible and are unchanged, so they
 *    still legitimately appear as direction colours — a candlestick's green, a
 *    beat/miss red — and cannot be policed this way. Two of three is the part that
 *    is checkable, and it is the part that regresses.)
 *
 * ⚠️ RATING colours only. The direction colours — price up/down, beat/miss,
 * bullish/bearish, buy/sell — are a SEPARATE rule that merely shares a hue, and
 * the owner scoped the 2026-08-22 change to ratings. Do not "unify" them here.
 *
 * Broken on purpose four ways before being trusted: a digit changed in each source
 * in turn (→ mismatch), a tier lightened back toward #D4A017 (→ contrast), and the
 * palette pasted into a component (→ copy).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = join(ROOT, 'app', 'globals.css');
const TS = join(ROOT, 'lib', 'ratings.ts');

/** The floor, and the grounds a tier colour is really drawn against. */
const FLOOR = 4.8;
const WHITE = '#FFFFFF';
/** Darkest ground the site puts tier-coloured TEXT on (--bg-page). */
const DARKEST_GROUND = '#F0F4F8';

const fail = [];
const note = [];

// ── contrast maths (WCAG 2.1 relative luminance) ────────────────────────────
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// ── 1 · read both copies ────────────────────────────────────────────────────
const css = readFileSync(CSS, 'utf8');
const ts = readFileSync(TS, 'utf8');

const fromCss = {};
for (const m of css.matchAll(/--c-tier-([1-5])\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
  // The first occurrence wins: `@theme` aliases (--color-tier-N) reference these
  // rather than redeclaring them, but a future dark-mode block might redeclare,
  // and the light palette is the one every ratio here is computed against.
  if (!(m[1] in fromCss)) fromCss[m[1]] = m[2].toUpperCase();
}

const tsBlock = ts.match(/RATING_TIER_HEX[^=]*=\s*\{([^}]*)\}/s);
const fromTs = {};
if (!tsBlock) {
  fail.push(`RATING_TIER_HEX not found in ${relative(ROOT, TS)} — has it been renamed?`);
} else {
  for (const m of tsBlock[1].matchAll(/([1-5])\s*:\s*'(#[0-9A-Fa-f]{6})'/g)) {
    fromTs[m[1]] = m[2].toUpperCase();
  }
}

for (const t of ['1', '2', '3', '4', '5']) {
  if (!fromCss[t]) fail.push(`--c-tier-${t} is missing from globals.css`);
  if (!fromTs[t]) fail.push(`RATING_TIER_HEX[${t}] is missing from lib/ratings.ts`);
  if (fromCss[t] && fromTs[t] && fromCss[t] !== fromTs[t]) {
    fail.push(
      `tier ${t} DISAGREES: globals.css says ${fromCss[t]}, lib/ratings.ts says ${fromTs[t]}. ` +
        `The workbook and the Recharts fills read the TS copy; the page reads the CSS one. ` +
        `A customer would see two different colours for one score.`,
    );
  }
}

// ── 2 · every tier legible, both ways round ─────────────────────────────────
for (const t of ['1', '2', '3', '4', '5']) {
  const hex = fromCss[t];
  if (!hex) continue;
  const asBackground = ratio(WHITE, hex); // white numerals ON the tier (.score-num, xlsx)
  const asText = ratio(hex, DARKEST_GROUND); // the tier AS text (.score-tag, kpi value)
  note.push(
    `  tier ${t}  ${hex}   white-on-it ${asBackground.toFixed(2)}   as-text ${asText.toFixed(2)}`,
  );
  if (asBackground < FLOOR) {
    fail.push(
      `tier ${t} (${hex}) scores ${asBackground.toFixed(2)} with WHITE TEXT on it, under ${FLOOR}. ` +
        `.score-num and the .xlsx fills both put white numerals on this colour.`,
    );
  }
  if (asText < FLOOR) {
    fail.push(
      `tier ${t} (${hex}) scores ${asText.toFixed(2)} as TEXT on ${DARKEST_GROUND}, under ${FLOOR}. ` +
        `.score-tag and --kpi-value-color both render this colour as text.`,
    );
  }
}

// ── 3 · no third copy of a changed tier ─────────────────────────────────────
const CHANGED = ['2', '3', '4'].map((t) => fromCss[t]).filter(Boolean);
const SOURCES = new Set([CSS, TS].map((p) => relative(ROOT, p).replace(/\\/g, '/')));
const SKIP_DIRS = new Set(['node_modules', '.next', '.next-dev', '.git', 'lighthouse-report', 'design-system-build', 'report-bundle', 'test-results', 'playwright-report']);

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css|mjs|js)$/.test(entry)) out.push(p);
  }
  return out;
};

const files = walk(ROOT);
// A floor on the walk itself: an empty or mis-rooted scan finds no copies and
// reports success (CLAUDE.md 14g — unmeasurable counted as clean).
if (files.length < 150) {
  fail.push(`the file walk found only ${files.length} files — it is not looking where it thinks it is`);
}

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  if (SOURCES.has(rel)) continue;
  const body = readFileSync(f, 'utf8');
  for (const hex of CHANGED) {
    // Ignore prose: a comment recording the value is documentation, not a copy.
    const lines = body.split('\n');
    const hits = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.toUpperCase().includes(hex) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    for (const { i } of hits) {
      fail.push(
        `${rel}:${i + 1} holds the tier colour ${hex} as a literal. ` +
          `Use tierColorVar()/scoreColor() where CSS can reach, or RATING_TIER_HEX where it cannot.`,
      );
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log('Rating tier palette');
console.log(note.join('\n'));
console.log(`\n${files.length} files scanned for stray copies · floor ${FLOOR}:1 · ground ${DARKEST_GROUND}`);

if (fail.length) {
  console.error(`\n✗ ${fail.length} problem${fail.length === 1 ? '' : 's'}:\n`);
  for (const f of fail) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('\n✓ one palette, two copies in step, all five tiers legible both ways round');
