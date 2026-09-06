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
/*
 * ⚠️ 2026-09-02 — THE TWO NEUTRAL PAIRS WERE LOWERED ON PURPOSE, WHICH IS THE ONE
 * THING A RATCHET IS NOT SUPPOSED TO ALLOW. Read this before touching them again.
 *
 * The owner decided Neutral must be a traffic light's amber rather than a grey:
 * *"it is not about visibility, it's about common sense. Traffic lights are
 * typically used to say between good, neutral and bad… going from green, grey and
 * red doesn't make sense."* Grey scored so well here precisely BECAUSE it is a
 * grey — a near-neutral has almost no colour to lose, so it holds still under
 * every simulation while its neighbours move around it. Any colour at all in that
 * slot scores worse. Those floors were therefore not a safety bar that gold
 * happens to fail; they were a measurement of what grey costs the design.
 *
 * What the colour was chosen against instead, all measured before it was offered:
 *   · it clears both contrast floors (5.37 with white on it, 4.86 as text), where
 *     the ORIGINAL gold #D4A017 cleared neither (2.38 and 2.15)
 *   · L* 45.0 against its neighbours' 45.3 — it does not disturb the weight ramp
 *   · it is the most chromatic gold available under those constraints, and three
 *     attempts to buy the separation back all failed (a darker gold reaches 9.2
 *     only by becoming a chocolate brown, a lighter one loses the white text, and
 *     moving Constructive too reaches only 6.0 by turning it olive)
 *
 * Not a WCAG 1.4.1 failure — colour is never the sole channel on these surfaces:
 * every chip carries its score and every badge its word. It is a quality
 * trade-off, it belongs to the owner, and they took it on these numbers.
 *
 * ⚠️ THESE ARE STILL RATCHETS. They are today's measurement rounded down, so the
 * next well-meant nudge that narrows either pair fails exactly as before. Lowering
 * one again needs the same thing this needed: a measurement, a reason, and the
 * owner.
 *
 * ⚠️ THIS TABLE HELD ONLY ADJACENT PAIRS UNTIL 2026-09-03, AND THE SITE'S WEAKEST
 * PAIR WAS NOT IN IT. A results table, the landing's legend and the screener all put
 * all five tiers on screen at once, so every one of the ten pairs is a comparison a
 * reader actually makes — while four of them were the only ones ever measured. All
 * ten are now here.
 *
 * ⚠️ AND THE FINDING THAT PROMPTED IT NAMED THE WRONG DEFICIENCY. 5A-097 recorded
 * Constructive vs Cautious as "3.9 to a protanope". Measured: to a protanope they are
 * 15.1 apart, and it is a DEUTERANOPE who sees 3.9. Both are described loosely as
 * "red-green colour blindness" and they are not the same simulation; deuteranopia is
 * also the commoner of the two. The number was right and the reader it described was
 * not — which would have sent anyone trying to fix it at the wrong axis.
 *
 * ⚠️ WHY THE NEW ROWS ARE TODAY'S NUMBERS AND NOT AN INVENTED FLOOR. 2-4 sits at
 * 3.9 and 3-4 at 5.3 to a deuteranope. A guard that fails on the day it is written
 * gets loosened rather than obeyed (CLAUDE.md 11t), and repainting an owner-approved
 * rating colour is not mine to do (11l). So every floor below is the measurement,
 * rounded down — which changes no pixel and buys the one thing that was missing:
 * these six pairs can no longer get quietly WORSE, and the weak ones are now printed
 * on every run instead of living in a document. Improving 2-4 is a colour decision
 * for the owner, with these numbers in front of them.
 */
const SEPARATION = [
  // pair, plain, protanope, deuteranope
  [['1', '2'], 17.0, 18.0, 24.0], // measured 2026-08-22
  [['2', '3'], 40.0, 5.5, 7.0], // re-based 2026-09-02 when Neutral became gold
  [['3', '4'], 16.5, 9.5, 5.0], // re-based 2026-09-02
  [['4', '5'], 16.0, 17.5, 16.0], // measured 2026-08-22
  // the six non-adjacent pairs, ratcheted at their 2026-09-03 measurement
  [['1', '3'], 39.5, 17.0, 29.5],
  [['1', '4'], 54.0, 14.5, 26.5],
  [['1', '5'], 53.0, 16.5, 19.0],
  [['2', '4'], 60.0, 14.5, 3.5], // ⚠️ 3.9 to a deuteranope — the site's weakest pair
  [['2', '5'], 62.0, 30.0, 14.0],
  [['3', '5'], 24.5, 26.5, 20.5],
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
  /* ⚠️ `down` DID get its CSS twin, on 2026-09-02, and this check exists because
     it had none for the life of the product. Four of the five direction inks had
     a token and this one did not, so every stylesheet and component needing "a
     loss, in words" hand-typed `#B22222` — in 20 places (audit 5A-058). That made
     the one direction colour carrying the most weight in a finance product the
     only member of the set a palette change could not reach by editing one line.
     It is now checked like its four siblings; the old "no CSS twin on purpose"
     note here is what made the gap look deliberate. */
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


// ── 6 · the domains that are NOT ratings ────────────────────────────────────
/*
 * ⚠️ EVERY ASSERTION ABOVE JUDGES THE RATING PALETTE, and for most of 2026 that
 * was the only palette anything checked. The P2 sweep found one palette doing
 * twelve unrelated jobs (5A-070) and four groups of tokens holding the same value
 * with nothing able to tell a wrong choice from a right one (5A-057). The fix was
 * to give each domain its own names; this is what stops them rotting.
 *
 * Each row is a colour that is NOT our judgement about a stock, with the ground it
 * really sits on. They were measured when they were introduced — this is what
 * makes the measurement outlive the session that took it.
 */
const DOMAIN = [
  // token, ground, floor, what it is
  ['--status-warning', '#F0F4F8', 3.0, 'a warning border/icon on the page (non-text)'],
  ['--status-warning-ink', '#F0F4F8', FLOOR, '"Payment due" / "Access paused" as words'],
  ['--analyst-positive', '#F0F4F8', FLOOR, "a third party's Buy, as words"],
  ['--analyst-neutral', '#F0F4F8', FLOOR, "a third party's Hold, as words"],
  ['--analyst-negative', '#F0F4F8', FLOOR, "a third party's Sell, as words"],
  ['--data-missing', '#F0F4F8', FLOOR, 'the em dash where we have no value'],
  ['--c-down-ink', '#F0F4F8', FLOOR, 'a loss, in words'],
];
const domainVal = {};
for (const [token, ground, floor, what] of DOMAIN) {
  const m = css.match(new RegExp(`${token}\\s*:\\s*(#[0-9A-Fa-f]{6})\\s*;`));
  if (!m) {
    fail.push(`${token} is missing from globals.css — check 6 cannot measure it, and an unmeasurable token reads as a clean one.`);
    continue;
  }
  const hex = m[1].toUpperCase();
  domainVal[token] = hex;
  const r = ratio(hex, ground);
  note.push(`  ${token.padEnd(22)} ${hex}   ${r.toFixed(2)} on ${ground}   (${what})`);
  if (r < floor) fail.push(`${token} (${hex}) scores ${r.toFixed(2)} on ${ground}, under ${floor} — ${what}.`);
}

/*
 * ⚠️ AND THE POINT OF SEPARATE NAMES IS THAT THEY LOOK SEPARATE. A third party's
 * *Sell* wearing our Bearish colour reads as OUR conclusion (5A-045), which is
 * what shipped until 2026-09-02. Distance is the only thing that can assert it —
 * two tokens with different names and the same value are indistinguishable to
 * every other kind of check.
 */
const SEPARATE_FROM_RATING = [
  ['--analyst-positive', '2', 12.0],
  ['--analyst-negative', '5', 10.0],
  ['--analyst-negative', '4', 12.0],
];
for (const [token, tier, floorD] of SEPARATE_FROM_RATING) {
  const a = domainVal[token];
  const b = fromCss[tier];
  if (!a || !b) continue;
  const d = Math.min(
    deltaE(a, b),
    deltaE(simulate(a, 'protan'), simulate(b, 'protan')),
    deltaE(simulate(a, 'deutan'), simulate(b, 'deutan')),
  );
  note.push(`  ${token} vs tier ${tier}   ${d.toFixed(1)} apart (floor ${floorD})`);
  if (d < floorD) {
    fail.push(
      `${token} (${a}) has moved to within ${d.toFixed(1)} of rating tier ${tier} (${b}), floor ${floorD}. ` +
        `Third-party opinion must not look like our verdict — that is the whole reason these tokens exist.`,
    );
  }
}

// ── 7 · the badge ink measured where the badge actually draws it ────────
/*
 * Every check above measures an ink against a FLAT ground. A rating badge does not
 * sit on one: `.tier-badge--N` paints `--tint-tier-N-strong`, an alpha wash, and the
 * ink lands on whatever that composites to — which differs on a card and on the page.
 *
 * ⚠️ THAT GAP SHIPPED. Audit 5A-096: the grey Neutral badge scored 4.59 composited
 * on `--bg-page` while `globals.css` claimed 4.82 for the same pairing, and Cautious
 * sat at 4.81, i.e. exactly on this repo's floor. Both readings were invisible here,
 * because check 3 measured those inks on the plain page and passed. **A guard that
 * measures the right colour against the wrong ground reports a clean page it has not
 * looked at** — the same shape as 11l (ii), one layer down.
 *
 * Two grounds, because a badge appears on both and the page is the darker:
 * `--bg-page` behind a badge in a table row, white behind one on a card.
 *
 * ⚠️ Tier 1 is deliberately the only row reading `--c-tier-N` rather than
 * `--c-tier-N-ink`: `.tier-badge--1` is written that way in globals.css, and this
 * table must describe the rule that ships, not the one it would be tidier to have.
 * If that rule changes, this row has to change with it — which is why the token name
 * is read from the stylesheet below rather than assumed.
 */
const BADGE_INK = { 1: '--c-tier-1', 2: '--c-tier-2-ink', 3: '--c-tier-3-ink', 4: '--c-tier-4-ink', 5: '--c-tier-5-ink' };
const BADGE_GROUNDS = [[DARKEST_GROUND, 'a table row'], [WHITE, 'a card']];

/* The declared value of a token, as a hex or as an rgba(). Deliberately line-based
   rather than one clever expression: `--tint-tier-3` and `--tint-tier-3-strong` are
   prefixes of one another, so a loose match reads the wrong one and every number
   after it is confidently wrong. */
const rawDeclaration = (token) => {
  for (const line of css.split('\n')) {
    const at = line.indexOf(token + ':');
    if (at === -1) continue;
    return line.slice(at + token.length + 1);
  }
  return null;
};
/*
 * ⚠️ THIS FOLLOWS ALIASES, AND IT HAS TO. The surface tokens became a two-layer
 * ramp on 2026-09-03 — `--bg-page: var(--elev-sunken)` — which is the point of
 * the whole exercise, and the first version of this reader skipped any
 * declaration containing `var()`. Check 8b went red immediately with "could not
 * be read", which is the RIGHT failure and the reason it says that instead of
 * quietly passing: a reader that cannot see through the architecture goes blind
 * exactly as the architecture improves (CLAUDE.md 14g). Depth-limited so a
 * circular alias stops rather than hangs.
 */
const declaration = (token, depth = 0) => {
  const raw = rawDeclaration(token);
  if (raw === null || depth > 4) return raw;
  const alias = raw.match(/var\((--[a-z0-9-]+)/);
  return alias ? declaration(alias[1], depth + 1) : raw;
};
const readToken = (token) => {
  const d = declaration(token);
  const m = d && d.match(/#[0-9A-Fa-f]{6}/);
  return m ? m[0].toUpperCase() : null;
};
const readAlpha = (token) => {
  const d = declaration(token);
  const m = d && d.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] : null;
};
/* Source-over: what an alpha wash actually becomes once the ground shows through it.
   This is the whole point of check 7 — the tint is never the colour behind the ink. */
const composite = ([r, g, b, a], groundHex) => {
  const back = rgb(groundHex);
  const mix = [r, g, b].map((c, i) => Math.round(c * a + back[i] * (1 - a)));
  return '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
};

/* Read the ink token each `.tier-badge--N` rule really names, so a change to that
   rule cannot leave this check measuring a colour the badge stopped using. */
for (const t of ['1', '2', '3', '4', '5']) {
  const rule = css.match(new RegExp('\\.tier-badge--' + t + '\\s*\\{([^}]*)\\}'));
  if (!rule) {
    fail.push(`.tier-badge--${t} is not in globals.css — check 7 cannot measure it, and an unmeasurable badge reads as a clean one.`);
    continue;
  }
  const colour = rule[1].match(/color:\s*var\((--[a-z0-9-]+)\)/);
  if (!colour) {
    fail.push(`.tier-badge--${t} no longer takes its colour from a token — check 7 can only follow a var().`);
    continue;
  }
  if (colour[1] !== BADGE_INK[t]) {
    fail.push(
      `.tier-badge--${t} now draws its ink from ${colour[1]}, but check 7 is measuring ${BADGE_INK[t]}. ` +
        `Update BADGE_INK deliberately — silently measuring the old token is how 5A-096 stayed invisible.`,
    );
    continue;
  }
  const inkHex = readToken(colour[1]);
  const tint = readAlpha(`--tint-tier-${t}-strong`);
  if (!inkHex || !tint) {
    fail.push(`tier ${t}: could not read ${colour[1]} or --tint-tier-${t}-strong as a value check 7 can composite.`);
    continue;
  }
  for (const [ground, where] of BADGE_GROUNDS) {
    const behind = composite(tint, ground);
    const r = ratio(inkHex, behind);
    note.push(`  .tier-badge--${t}  ${inkHex} on ${behind}  ${r.toFixed(2)}  (tint over ${ground} — ${where})`);
    if (r < FLOOR) {
      fail.push(
        `.tier-badge--${t} scores ${r.toFixed(2)} where it actually draws — ${inkHex} on ${behind}, ` +
          `the tint composited over ${ground} (${where}). Floor ${FLOOR}. ` +
          `Measuring that ink on the plain ground instead would have passed, which is the defect this check exists for.`,
      );
    }
  }
}

// ── 8 · the Opportunity-Map zones: one hue, three consumers ─────────────────
/*
 * `--zone-*-rgb` in globals.css feeds `landing.css` (the still's quadrant washes)
 * and the legend swatches; `OPPORTUNITY_ZONES` in `lib/chartTheme.ts` feeds the
 * real chart's Recharts props. Same arrangement as `INK` / `--c-*-ink`, and the
 * same reason: CSS cannot be imported into TypeScript, so there must be two
 * copies and they must be unable to drift.
 *
 * ⚠️ There were THREE hand-typed copies before 2026-09-03 and nothing linked any
 * of them, so retuning the paid chart would have repainted one and left a
 * marketing page illustrating a chart that no longer looked like that.
 */
const ZONE_PAIRS = [
  ['--zone-good-rgb', 'zoneGood'],
  ['--zone-priced-rgb', 'zonePricedWash'],
  ['--zone-cheap-rgb', 'zoneCheapWash'],
  ['--zone-worst-rgb', 'zoneWorstWash'],
];
const chartThemeSrc = readFileSync(join(ROOT, 'lib', 'chartTheme.ts'), 'utf8');
const zonesBlock = chartThemeSrc.match(/OPPORTUNITY_ZONES\s*=\s*\{([\s\S]*?)\}\s*as const/);
if (!zonesBlock) {
  fail.push('OPPORTUNITY_ZONES is gone from lib/chartTheme.ts — check 8 cannot compare the two copies, and an unmeasurable pair reads as a clean one.');
} else {
  for (const [token, key] of ZONE_PAIRS) {
    const triplet = declaration(token);
    const nums = triplet && triplet.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    const tsHex = zonesBlock[1].match(new RegExp(key + ":\\s*'(#[0-9A-Fa-f]{6})'"));
    if (!nums || !tsHex) {
      fail.push(`zone ${key}: could not read ${token} from globals.css or ${key} from chartTheme.ts — check 8 needs both.`);
      continue;
    }
    const fromTriplet = '#' + [1, 2, 3].map((i) => Number(nums[i]).toString(16).padStart(2, '0')).join('').toUpperCase();
    const fromChart = tsHex[1].toUpperCase();
    note.push(`  zone ${key.padEnd(15)} ${fromChart}   ${token} = ${nums[1]},${nums[2]},${nums[3]}`);
    if (fromTriplet !== fromChart) {
      fail.push(
        `zone ${key} disagrees between its two copies: ${token} is ${fromTriplet}, chartTheme.ts says ${fromChart}. ` +
          `The paid Opportunity Map and the landing page's still of it would draw different colours, and both would look deliberate.`,
      );
    }
  }
}

// ── 8b · the canvas mirrors: every TS copy still equals its token ───────────
/*
 * `BRAND` and `CHART_CHROME` in `lib/chartTheme.ts` are the values Lightweight
 * Charts needs, and that library paints to a `<canvas>` where a CSS variable is
 * simply an unparseable colour. So they must be literals, and a literal that
 * mirrors a token is a copy — the same arrangement as `INK` / `--c-*-ink`,
 * and it needs the same protection.
 *
 * ⚠️ THE COST OF NOT HAVING THIS IS ALREADY IN THE FILE'S OWN HISTORY: when
 * `--text-muted` was darkened in August, 29 hand-typed chart literals stayed on
 * the old value, so every axis label kept the exact 2.97:1 defect the token
 * change had just fixed — while looking entirely deliberate.
 */
const MIRRORS = [
  ['BRAND', 'deep', '--brand-deep'],
  ['BRAND', 'mid', '--brand-mid'],
  ['BRAND', 'bright', '--brand-bright'],
  ['CHART_CHROME', 'grid', '--bg-page'],
  ['CHART_CHROME', 'crosshairLabel', '--brand-deep'],
  ['CHART_CHROME', 'axis', '--border'],
];
const objectBody = (name) => {
  const m = chartThemeSrc.match(new RegExp('export const ' + name + '\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const'));
  return m ? m[1] : null;
};
for (const [obj, key, token] of MIRRORS) {
  const body = objectBody(obj);
  if (body === null) {
    fail.push(`${obj} is gone from lib/chartTheme.ts — check 8b cannot compare it with ${token}.`);
    continue;
  }
  const tsm = body.match(new RegExp(key + ":\\s*'(#[0-9A-Fa-f]{6})'"));
  const cssHex = readToken(token);
  if (!tsm || !cssHex) {
    fail.push(`${obj}.${key} or ${token} could not be read — check 8b needs both, and an unmeasurable pair reads as a clean one.`);
    continue;
  }
  const tsHex = tsm[1].toUpperCase();
  if (tsHex !== cssHex) {
    fail.push(
      `${obj}.${key} is ${tsHex} but ${token} is ${cssHex}. The canvas charts would draw one colour and every CSS surface the other, ` +
        `and both would look deliberate — this is the 29-literal drift of 2026-08, one library along.`,
    );
  }
}
note.push(`  chartTheme mirrors: ${MIRRORS.length} canvas literals checked against their tokens`);

// ── 9 · the forced-colors block only names things that exist ────────────────
/*
 * Windows High Contrast support is a block of selectors nobody on this project
 * can see working. That makes it the easiest kind of rule to get wrong and the
 * hardest to notice: **a CSS selector matching nothing is completely silent.**
 * The stylesheet stays valid, the build stays green, and the element the rule was
 * written to protect is simply not protected.
 *
 * ⚠️ This is not hypothetical. The first draft of that block, written 2026-09-03,
 * listed `.wk-track` for the 52-week gauge. There is no such class — the gauge is
 * Tailwind utilities and an inline gradient — so the one chart element that most
 * needed the opt-out was the one that did not get it, and every other check in
 * this repo agreed the work was done. Found by reading the rule back off a
 * running browser, which is the only place the difference shows.
 *
 * So: every class and attribute named inside `@media (forced-colors: active)`
 * must appear somewhere else in the codebase. Not proof the rule is CORRECT —
 * only a real Windows machine can say that — but proof it is aimed at something.
 */
const fcBlock = css.match(/@media \(forced-colors: active\) \{([\s\S]*)\n\}/);
if (!fcBlock) {
  fail.push('The @media (forced-colors: active) block is gone from globals.css — audit 5A-082 is reopened, silently.');
} else {
  const named = new Set();
  for (const m of fcBlock[1].matchAll(/(?:^|[\s,])(\.[a-z][a-z0-9-]*|\[data-[a-z-]+\])/gim)) named.add(m[1]);
  const haystack = files
    .filter((p) => /\.(tsx|ts|css)$/.test(p) && !p.endsWith('globals.css'))
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n');
  const orphans = [];
  for (const sel of named) {
    const bare = sel.startsWith('[') ? sel.slice(1, -1) : sel.slice(1);
    // globals.css may style it; something else must USE it.
    if (!haystack.includes(bare)) orphans.push(sel);
  }
  note.push(`  forced-colors: ${named.size} selectors named, ${named.size - orphans.length} reachable`);
  if (orphans.length) {
    fail.push(
      `the forced-colors block names ${orphans.join(', ')}, which nothing in the codebase uses. ` +
        `A selector matching nothing is silent — the stylesheet stays valid and the element stays unprotected, ` +
        `which is exactly how .wk-track shipped. Point it at a real class, or use [data-keep-colors].`,
    );
  }
}

// ── 10 · the design doc quotes the real values ──────────────────────────────
/*
 * `design-system.md` §2 reproduces the token block as a code fence. That fence is
 * a COPY of `globals.css`, maintained by hand beside it, and it drifts.
 *
 * ⚠️ Audit 5A-048 found five stale values in it; **two were still stale six weeks
 * later**, on 2026-09-03, including `--text-muted` — documented `#8A97A8` when the
 * real token had been `#626B77` since August. That is not a trivia error: #8A97A8
 * is the value that measured 2.97:1 and produced 258 failing elements on one page,
 * so the doc was recommending, in a code fence, the exact colour the product had
 * just been fixed to stop using. Anyone reading the design system to pick a muted
 * grey would have picked the broken one.
 *
 * Reading the fence and comparing is the cheapest possible fix, and it makes the
 * doc's §2 unable to lie about a value again (CLAUDE.md 11c — a rule in two places
 * drifts; where the second copy must exist, check it rather than trust it).
 */
const DOC = join(ROOT, '..', 'docs', 'design-system.md');
let docSrc = null;
try {
  docSrc = readFileSync(DOC, 'utf8');
} catch {
  fail.push('docs/design-system.md could not be read — check 10 cannot compare the documented palette with the real one.');
}
if (docSrc) {
  const documented = new Map();
  for (const m of docSrc.matchAll(/^\s*(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/gm)) {
    if (!documented.has(m[1])) documented.set(m[1], m[2].toUpperCase());
  }
  const drifted = [];
  let compared = 0;
  for (const [token, docHex] of documented) {
    const realHex = readToken(token);
    if (!realHex) continue; // documented but not a plain hex in globals.css — check 6/8b territory
    compared++;
    if (realHex !== docHex) drifted.push(`${token}: the doc says ${docHex}, globals.css says ${realHex}`);
  }
  note.push(`  design-system.md §2: ${compared} documented token values compared`);
  // The control. Without it this passes on a doc whose code fence has been deleted.
  if (compared < 20) {
    fail.push(
      `check 10 compared only ${compared} token values against docs/design-system.md — it expects at least 20. ` +
        `Either the doc's palette fence has moved or its format changed, and the check is now measuring almost nothing.`,
    );
  }
  if (drifted.length) {
    fail.push(
      `docs/design-system.md quotes ${drifted.length} value(s) the stylesheet disagrees with:\n    ` +
        drifted.join('\n    ') +
        `\n  The doc is what a person reads before picking a colour, so a stale value there is a recommendation to use the wrong one.`,
    );
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
console.log(
  '\n✓ one palette, two copies in step, five tiers legible both ways round,\n' +
    '  every adjacent pair still tellable apart, and the ink layer in step with it',
);
