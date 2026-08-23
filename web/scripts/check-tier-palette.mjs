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

// ── perceptual distance (CIEDE2000) and dichromat simulation ────────────────
// Contrast answers "can this be READ". It says nothing about "can these two be
// TOLD APART", which is a different question with a different answer — and it is
// the one that went wrong in 2026-08. See check 4.
const XYZ = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return [
    r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    r * 0.2126729 + g * 0.7151522 + b * 0.072175,
    r * 0.0193339 + g * 0.119192 + b * 0.9503041,
  ];
};
const LAB = (hex) => {
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [X, Y, Z] = XYZ(hex);
  const [fx, fy, fz] = [f(X / 0.95047), f(Y), f(Z / 1.08883)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const deltaE = (h1, h2) => {
  const [L1, a1, b1] = LAB(h1);
  const [L2, a2, b2] = LAB(h2);
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hp = (b, ap) => {
    if (b === 0 && ap === 0) return 0;
    const d = Math.atan2(b, ap) * deg;
    return d >= 0 ? d : d + 360;
  };
  const hp1 = hp(b1, ap1);
  const hp2 = hp(b2, ap2);
  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (Cp1 + Cp2) / 2;
  let hbp = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbp += hbp < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
};

// Brettel/Vienot dichromat simulation (LMS, D65).
const RGB2LMS = [[17.8824, 43.5161, 4.11935], [3.45565, 27.1554, 3.86714], [0.0299566, 0.184309, 1.46709]];
const LMS2RGB = [[0.080944, -0.130504, 0.116721], [-0.0102485, 0.0540194, -0.113615], [-0.000365294, -0.00412163, 0.693513]];
const SIM = {
  protan: [[0, 2.02344, -2.52581], [0, 1, 0], [0, 0, 1]],
  deutan: [[1, 0, 0], [0.494207, 0, 1.24827], [0, 0, 1]],
};
const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const simulate = (hex, kind) => {
  const lms = mul(RGB2LMS, rgb(hex));
  const key = kind === 'protan' ? 0 : 1;
  const out = mul(SIM[kind], lms);
  const merged = lms.map((v, i) => (i === key ? out[i] : v));
  return (
    '#' +
    mul(LMS2RGB, merged)
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
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
/*
 * ⚠️ ALL FIVE ARE CHECKABLE as of 2026-08-22, where three were that morning.
 * Tiers 1 and 5 were both excluded because each shared its hex with a DIRECTION
 * colour — the old Bearish red was also a down candle and a sell marker, the old
 * High Conviction green also a candle border and an insider-buy arrow — and a hex
 * that means two things cannot be policed as a copy of one of them. Both tiers
 * have since moved for reasons of their own, and each move severed the twin: the
 * direction colours stayed exactly where they were.
 *
 * ⚠️ Every continuation line here starts with `*` deliberately: the prose filter
 * below skips `//`, `*` and `/*`, and the first draft of this very comment was
 * reported as a stray copy because it named the new hex mid-paragraph. That is
 * the third time in this repo a guard has failed on the sentence documenting its
 * own subject (CLAUDE.md 11c-iv). Hexes are named in words here, not digits.
 */
const CHANGED = ['1', '2', '3', '4', '5'].map((t) => fromCss[t]).filter(Boolean);
/* ⚠️ lib/ink.ts is a SOURCE here, not a suspect. INK.warn deliberately holds the
   same value as tier 4 — a rating and a direction that agree today and must stay
   free to move apart — so a copy check cannot tell it from a stray paste. Its own
   values are policed by check 5, which is stricter about them than this walk. */
const INK_TS_PATH = join(ROOT, 'lib', 'ink.ts');
const SOURCES = new Set([CSS, TS, INK_TS_PATH].map((p) => relative(ROOT, p).replace(/\\/g, '/')));
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

// ── 4 · adjacent tiers stay TELLABLE APART ──────────────────────────────────
/*
 * ⚠️ THE CHECK THAT WOULD HAVE CAUGHT 2026-08-22's SECOND DEFECT. Darkening
 * Cautious out of orange and into red was correct in isolation, measured against
 * its own ground, and it left two neighbouring tiers 10.7 apart — the range where
 * most people call two colours "the same sort of colour". The owner saw it on
 * sight; nothing in this file could, because every assertion above judges one
 * colour at a time. **A colour fixed in isolation can break a set.**
 *
 * So these are RATCHETS, not targets. Each floor is what the pair measures today,
 * rounded down. A change that narrows a gap fails, and has to either back off or
 * move the number deliberately and say why. A uniform threshold would have been
 * dishonest: two pairs already sit below the one the owner objected to, and a
 * guard that fails on the day it is written gets loosened rather than obeyed.
 *
 * ⚠️ TWO WERE WEAK AND ARE NOW FIXED (2026-08-23, Layer G audit F-008). They read:
 *
 *   · 2 to 3 measured 2.8 to a protanope and 3 to 4 measured 5.9 to a
 *     deuteranope. Below about 2.3 two colours are indistinguishable, so the
 *     Constructive/Neutral boundary — the line between "our analysis likes this"
 *     and "our analysis is indifferent" — was effectively invisible to roughly
 *     one man in twelve.
 *
 * ⚠️ THE CAUSE WAS THE 2026-08-22 CONTRAST FIX ITSELF, and this is the lesson.
 * Darkening tiers 2, 3 and 4 each to just clear the 4.8 floor left all three at
 * almost identical LIGHTNESS (5.31 / 5.33 / 5.31). Under dichromacy hue collapses
 * and lightness is all that remains — so the fix removed the only channel those
 * pairs had left. Every colour was individually correct and the set got worse
 * (CLAUDE.md 11t, on a second axis). Worse, this ratchet was calibrated AFTER the
 * regression, so it faithfully locked the damage in as the floor.
 *
 * The fix: Neutral became a true grey. A near-grey has almost no colour to lose,
 * so it holds still under every simulation while its neighbours move around it —
 * and "Neutral is grey" is what the label meant anyway. Gold could not be saved:
 * all 15,866 golds clearing both floors were searched and the best scores 12.9,
 * only by becoming #3E301E, a near-black brown. A true yellow is worse still,
 * because the binding constraint is that this token is also used AS TEXT on the
 * light page (luminance ≤ 0.1479), and a yellow that dark has stopped being one.
 *
 * The greens WERE the third: 1 to 2 sat 8.2 apart, closer than the pair that
 * prompted all of this. Reported to the owner on 2026-08-22 and fixed the same
 * day — High Conviction moved to a pine green, 8.2 → 17.1 and 8.6 → 24.6 for a
 * colour-blind reader, which is why this pair's floors are the highest here.
 *
 * Not a WCAG failure: 1.4.1 forbids colour as the ONLY channel, and every chip
 * carries its score while every badge carries its word. It is a quality question,
 * and it belongs to the owner.
 */
const SEPARATION = [
  // pair, plain, protanope, deuteranope
  [['1', '2'], 17.0, 18.0, 24.0], // measured 2026-08-22
  [['2', '3'], 34.0, 25.0, 21.5], // re-based 2026-08-23 when Neutral became grey
  [['3', '4'], 28.0, 26.5, 24.0], // re-based 2026-08-23
  [['4', '5'], 16.0, 17.5, 16.0], // measured 2026-08-22
];
for (const [[a, b], minPlain, minProtan, minDeutan] of SEPARATION) {
  const [x, y] = [fromCss[a], fromCss[b]];
  if (!x || !y) continue;
  const plain = deltaE(x, y);
  const protan = deltaE(simulate(x, 'protan'), simulate(y, 'protan'));
  const deutan = deltaE(simulate(x, 'deutan'), simulate(y, 'deutan'));
  note.push(
    `  tier ${a}-${b}   apart ${plain.toFixed(1)}   protanope ${protan.toFixed(1)}   deuteranope ${deutan.toFixed(1)}`,
  );
  for (const [label, got, floor] of [
    ['', plain, minPlain],
    [' to a protanope', protan, minProtan],
    [' to a deuteranope', deutan, minDeutan],
  ]) {
    if (got < floor) {
      fail.push(
        `tiers ${a} and ${b} moved CLOSER together${label}: ${got.toFixed(1)}, floor ${floor}. ` +
          `Each colour may still be perfectly legible on its own — this is whether a reader can ` +
          `tell the two TIERS apart, which no per-colour check can see.`,
      );
    }
  }
}

// ── 5 · the ink layer: two copies in step, legible where it actually sits ───
/*
 * The text twins of the direction palette (`--c-*-ink` and `lib/ink.ts`). Same
 * two-copy arrangement and the same reason as the tiers: a Recharts fill prop is
 * an SVG attribute, where a CSS variable is not resolved.
 *
 * ⚠️ EACH GROUND IS THE DARKEST ONE THAT COLOUR WAS OBSERVED ON, dumped from a
 * live ENTITLED stock page with the computed colour AND its composited
 * background. Solving the green against white would have "passed" at 5.90 while
 * shipping 3.86 to the one place it sits on a green tint — which is exactly how
 * the tier inks went wrong the first time (CLAUDE.md 11l ii).
 */
const INK_GROUND = {
  up: ['#E9F3E9', 'a 10% green tint - the insight strength tag'],
  neutral: ['#F1F0F0', 'a 10% grey tint - the Smart Money consensus pill'],
  warn: ['#F0F4F8', '--bg-page - the KPI drawdown value'],
  down: ['#F0F4F8', '--bg-page - summary strip values'],
  brand: ['#EEF5FD', "the 50 DMA chip's own 8% tint"],
};

const inkTs = readFileSync(INK_TS_PATH, 'utf8');
const inkFromTs = {};
const inkBlock = inkTs.match(/export const INK\s*=\s*\{([\s\S]*?)\}\s*as const/);
if (!inkBlock) {
  fail.push(`INK not found in ${relative(ROOT, INK_TS_PATH)} — has it been renamed?`);
} else {
  for (const m of inkBlock[1].matchAll(/(\w+)\s*:\s*'(#[0-9A-Fa-f]{6})'/g)) {
    inkFromTs[m[1]] = m[2].toUpperCase();
  }
}
const inkFromCss = {};
for (const m of css.matchAll(/--c-([a-z]+)-ink\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
  if (!(m[1] in inkFromCss)) inkFromCss[m[1]] = m[2].toUpperCase();
}

for (const [role, [ground, where]] of Object.entries(INK_GROUND)) {
  const hex = inkFromTs[role];
  if (!hex) {
    fail.push(`INK.${role} is missing from lib/ink.ts`);
    continue;
  }
  const r = ratio(hex, ground);
  note.push(`  ink ${role.padEnd(8)} ${hex}   ${r.toFixed(2)} on ${ground}   (${where})`);
  if (r < FLOOR) {
    fail.push(`INK.${role} (${hex}) scores ${r.toFixed(2)} on ${ground}, under ${FLOOR} — ${where}.`);
  }
  /* ⚠️ `down` has no CSS twin ON PURPOSE, and this says so out loud rather than
     skipping quietly: it did not change, so no stylesheet rule needed rewriting.
     It exists in INK only so a call site writing `up ? … : down` imports both
     rather than hand-typing one of them (CLAUDE.md 11c). */
  if (role === 'down') continue;
  if (!(role in inkFromCss)) {
    fail.push(`--c-${role}-ink is missing from globals.css, but INK.${role} exists`);
  } else if (inkFromCss[role] !== hex) {
    fail.push(
      `ink "${role}" DISAGREES: globals.css says ${inkFromCss[role]}, lib/ink.ts says ${hex}. ` +
        `The stylesheet paints the headings and the TS copy paints the chart labels, so a ` +
        `reader would see two shades of one colour on one card.`,
    );
  }
}
for (const role of Object.keys(inkFromCss)) {
  // A tier ink is a RATING colour, covered by checks 1-2 rather than here.
  if (role.startsWith('tier') || role in INK_GROUND) continue;
  fail.push(`--c-${role}-ink exists in globals.css with no INK.${role} and no recorded ground`);
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
console.log(
  '\n✓ one palette, two copies in step, five tiers legible both ways round,\n' +
    '  every adjacent pair still tellable apart, and the ink layer in step with it',
);
