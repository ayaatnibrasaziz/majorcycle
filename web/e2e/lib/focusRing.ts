import type { Page } from '@playwright/test';

import { COLOUR_FNS } from './contrastProbe';

/**
 * Walk a page with the keyboard and measure every focus indicator — Layer H5.
 *
 * WCAG 1.4.11 asks that the indicator reach **3:1** against the colours next to it. An
 * element passes when ANY of its indicators does — an outline, a ring drawn with
 * `box-shadow` (Tailwind's `ring-*`), or a border that CHANGES on focus — each
 * composited over the ground it is actually seen against: the parent's for anything
 * drawn outside the box, the element's own for anything inset.
 *
 * ⚠️ **SETTLED OR NOT AT ALL (11ao).** Two sessions read the Stock Detail sub-nav pill
 * at t≈0 and reported its ring as white on white; `transition: all` animates
 * `outline-color` from `currentColor`, and it settles at 4.03:1 from 151ms. So each
 * reading waits for the element's own animations to finish AND for two readings 60ms
 * apart to agree, capped at 2s with `setTimeout` — never a frame wait, which headless
 * Firefox can withhold forever (`frames.ts`).
 *
 * ⚠️ A border counts only if it DIFFERS from the unfocused border, which is recorded
 * for every focusable element before the first Tab. A permanent grey border is not a
 * focus indicator, however dark.
 */
const SETUP = `(() => {
  ${COLOUR_FNS}
  const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  // The element AND its two nearest ancestors: a search box commonly draws its focus
  // on the WRAPPER (\`:focus-within\` turns the border brand blue) while the input
  // itself is borderless. The first run scored exactly that as "no indicator" on
  // /stocks and /request — the probe's blind spot, not the product's (11q).
  const before = new WeakMap();
  const remember = (el) => {
    if (!el || before.has(el)) return;
    const cs = getComputedStyle(el);
    before.set(el, { border: cs.borderTopColor, shadow: cs.boxShadow });
  };
  document.querySelectorAll(FOCUSABLE).forEach((el) => {
    remember(el);
    remember(el.parentElement);
    remember(el.parentElement && el.parentElement.parentElement);
  });

  // Split a computed box-shadow list on the commas BETWEEN shadows, not inside rgb().
  const shadows = (s) => {
    if (!s || s === 'none') return [];
    const out = []; let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.map((sh) => {
      const colour = sh.match(/rgba?\\([^)]+\\)/);
      const px = (sh.replace(/rgba?\\([^)]+\\)/, '').match(/-?[\\d.]+px/g) || []).map(parseFloat);
      return { colour: colour ? parse(colour[0]) : null, spread: px[3] || 0, blur: px[2] || 0, inset: /inset/.test(sh) };
    });
  };

  const read = (el) => {
    const cs = getComputedStyle(el);
    const outside = bgOf(el, el.parentElement || el);
    const inside = bgOf(el);
    const found = [];
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) {
      const c = parse(cs.outlineColor);
      const g = parseFloat(cs.outlineOffset) < 0 ? inside : outside;
      if (c) found.push({ kind: 'outline', ratio: ratio(over(c, g), g), colour: cs.outlineColor });
    }
    for (const sh of shadows(cs.boxShadow)) {
      if (!sh.colour || sh.colour.a === 0 || sh.spread < 1) continue;
      const g = sh.inset ? inside : outside;
      found.push({ kind: 'ring', ratio: ratio(over(sh.colour, g), g), colour: 'rgba(' + sh.colour.rgb.join(',') + ',' + sh.colour.a + ')' });
    }
    if (parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none' && before.has(el) && before.get(el).border !== cs.borderTopColor) {
      const c = parse(cs.borderTopColor);
      if (c) found.push({ kind: 'border', ratio: ratio(over(c, outside), outside), colour: cs.borderTopColor });
    }
    // A wrapper counts only for what CHANGED when focus arrived — a permanent border
    // or shadow on a card around a link is not that link's indicator.
    let a = el.parentElement;
    for (let depth = 0; depth < 2 && a; depth++, a = a.parentElement) {
      const was = before.get(a);
      if (!was) continue;
      const acs = getComputedStyle(a);
      const aOutside = bgOf(a, a.parentElement || a);
      if (parseFloat(acs.borderTopWidth) >= 1 && acs.borderTopStyle !== 'none' && was.border !== acs.borderTopColor) {
        const c = parse(acs.borderTopColor);
        if (c) found.push({ kind: 'wrapper-border', ratio: ratio(over(c, aOutside), aOutside), colour: acs.borderTopColor });
      }
      if (was.shadow !== acs.boxShadow) {
        for (const sh of shadows(acs.boxShadow)) {
          if (!sh.colour || sh.colour.a === 0 || sh.spread < 1 || sh.inset) continue;
          found.push({ kind: 'wrapper-ring', ratio: ratio(over(sh.colour, aOutside), aOutside), colour: 'rgba(' + sh.colour.rgb.join(',') + ',' + sh.colour.a + ')' });
        }
      }
    }
    return found;
  };

  // One id per ELEMENT, so the walk knows when Tab has come back round. A key built
  // from position did not: the sticky header sits at the same viewport y at any
  // scroll, and the first version walked the whole page twice.
  const ids = new WeakMap();
  let nextId = 0;
  window.__focusRing = async () => {
    const el = document.activeElement;
    // Focus is on NO control: either the walk has not reached the first one yet, or it
    // has gone past the last and left the page (Firefox moves it to the browser's own
    // toolbar and never brings it back — Chromium cycles straight back to the top).
    // \`after\` says whether any tabbable control follows the last one read, so the
    // caller can tell "the end" from "knocked off the page halfway".
    // ⚠️ Next's dev-only error overlay (NEXTJS-PORTAL) is appended LAST in <body> and
    // never ships. Chromium treats it as one Tab stop; Firefox walks the focusable parts
    // inside its shadow root one by one, so the walk used to run out of Tabs there on
    // every page. Reaching it therefore means the same as leaving the page: past the end.
    if (!el || el === document.body || el === document.documentElement || el.tagName === 'NEXTJS-PORTAL') {
      const last = window.__lastFocused;
      const after = !!last && [...document.querySelectorAll(FOCUSABLE)].some((c) =>
        (last.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        !last.contains(c) &&
        c.tabIndex >= 0 && !c.disabled && !c.closest('[inert],[aria-hidden="true"]') &&
        c.getClientRects().length > 0 && getComputedStyle(c).visibility !== 'hidden');
      return { left: true, after };
    }
    if (!ids.has(el)) ids.set(el, nextId++);
    window.__lastFocused = el;
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.id || '').trim().replace(/\\s+/g, ' ').slice(0, 50);
    const who = el.tagName.toLowerCase() + (name ? ' "' + name + '"' : '');
    if (r.width === 0 && r.height === 0) return { who, invisible: true, key: String(ids.get(el)) };
    const t0 = Date.now();
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    let last = '';
    let found = [];
    while (Date.now() - t0 < 2000) {
      // The wrapper's border transitions too (.15s on the search boxes).
      const moving = [el, el.parentElement, el.parentElement && el.parentElement.parentElement]
        .filter(Boolean)
        .some((n) => n.getAnimations().some((a) => a.playState === 'running'));
      found = read(el);
      const now = JSON.stringify(found);
      if (!moving && now === last) break;
      last = now;
      await sleep(60);
    }
    const best = found.reduce((m, f) => (f.ratio > m ? f.ratio : m), 0);

    // ⚠️ A RING THAT PASSES ON COLOUR CAN STILL BE CUT OFF (H5 audit). An outline sits
    // OUTSIDE the box, so an ancestor with overflow hidden/auto can clip it away while
    // every computed value above reads perfectly. Count the sides of the ring band that
    // a clipping ancestor cuts; four means nothing of an outside ring is left to see.
    const cs = getComputedStyle(el);
    const reach = cs.outlineStyle !== 'none'
      ? Math.max(0, parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth))
      : 0;
    let clippedSides = 0;
    if (reach > 0) {
      const ring = { l: r.left - reach, t: r.top - reach, r: r.right + reach, b: r.bottom + reach };
      const cut = { l: false, t: false, r: false, b: false };
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const acs = getComputedStyle(a);
        const clipsX = acs.overflowX !== 'visible';
        const clipsY = acs.overflowY !== 'visible';
        if (!clipsX && !clipsY) continue;
        const c = a.getBoundingClientRect();
        if (clipsX && c.left > ring.l + 0.5) cut.l = true;
        if (clipsX && c.right < ring.r - 0.5) cut.r = true;
        if (clipsY && c.top > ring.t + 0.5) cut.t = true;
        if (clipsY && c.bottom < ring.b - 0.5) cut.b = true;
      }
      clippedSides = [cut.l, cut.t, cut.r, cut.b].filter(Boolean).length;
    }
    // Whether the outside ring is what carried the pass — a clipped outline does not
    // matter when a border or wrapper change already reaches 3:1 on its own.
    const outlineCarries = !found.some((f) => f.kind !== 'outline' && f.ratio >= 3);
    return { who, key: String(ids.get(el)), best: +best.toFixed(2), found, clippedSides, outlineCarries, ms: Date.now() - t0 };
  };
  return true;
})()`;

/**
 * Why every focus walk is skipped in WebKit (and ONLY there). Layer H4 measured that
 * Playwright's WebKit on this machine cannot Tab to a link at all — Safari's own "Tab
 * to links" preference, off by default — so a walk there sees buttons and inputs only
 * and would report the links as missing. Chromium runs these on every push; Firefox
 * runs them in `pnpm e2e:browsers`.
 */
export const WEBKIT_SKIPS_LINKS =
  'WebKit cannot Tab to links (Safari "Tab to links" is off) — see focusRing.ts and Layer H4';

export interface RingReading {
  /** Focus is on no control (see `__focusRing`); `after` = a tabbable control remains. */
  left?: boolean;
  after?: boolean;
  who: string;
  key: string;
  invisible?: boolean;
  best?: number;
  found?: { kind: string; ratio: number; colour: string }[];
  clippedSides?: number;
  outlineCarries?: boolean;
  ms?: number;
}

/**
 * Tab from the top of the page until focus comes back round (or `maxTabs`), and
 * return one reading per element reached. Call after the page has rendered.
 */
export async function walkFocus(page: Page, maxTabs = 400): Promise<RingReading[]> {
  await page.evaluate(SETUP);
  // Start from the document, not from whatever a previous step left focused.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const readings: RingReading[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const r = (await page.evaluate('window.__focusRing()')) as RingReading | null;
    if (!r) continue;
    if (r.left) {
      if (readings.length === 0) continue; // not yet at the first control
      // Past the last control and out of the page — complete, PROVIDED nothing tabbable
      // follows the last one read. If something does, focus fell off mid-page and the
      // rest would silently go unmeasured (14g).
      if (r.after) throw new Error(`focus left the page after "${readings[readings.length - 1]!.who}" with controls still below it — the walk is incomplete`);
      return readings;
    }
    if (seen.has(r.key)) return readings;
    seen.add(r.key);
    readings.push(r);
  }
  // ⚠️ Running out of Tabs is NOT the end of the page (H5 audit): returning here would
  // report the first N controls as the whole page, and the rest as clean (14g).
  throw new Error(`the focus walk never came back round in ${maxTabs} Tabs — coverage is incomplete`);
}

/**
 * ⚠️ THE ONE EXEMPTION, and it is a limit of this probe rather than a pass (H5 audit).
 * In Firefox, Google's sign-in widget focuses a zero-size overlay `div` and draws the
 * ring INSIDE its cross-origin iframe, where no script of ours can read a style. Checked
 * by screenshot on 2026-09-20 with our own CSS left alone: Google's ring, rgb(0,99,155)
 * on white, is visible from 100ms. I first read an earlier screenshot as "no ring" and
 * added a second ring of our own, which only doubled it — reverted. Matched by Google's
 * exact label, so an invisible focus stop of OURS still fails.
 */
const GOOGLE_OVERLAY = /^div "Sign in with Google\. Opens in new tab"$/;

/**
 * The readings that fail: no indicator at all, none reaching 3:1, a ring clipped away on
 * three or more sides, or focus landing on something with no size at all — a keyboard reader
 * whose focus vanishes has lost their place (H5 audit). The one exemption is an IFRAME:
 * Google's sign-in draws a zero-size helper frame we do not own, and its visible button
 * is measured separately as the `div` that hosts it.
 */
export function ringFailures(readings: RingReading[]): string[] {
  const vanished = readings
    .filter((r) => r.invisible && !r.who.startsWith('iframe') && !GOOGLE_OVERLAY.test(r.who))
    .map((r) => `${r.who} — focus lands on an element with no size`);
  const clipped = readings
    // Three sides, not four: the toggles measured 3 — one short edge of ring left, which
    // nobody reads as focus. The header's buttons measure 1 and read fine.
    .filter((r) => !r.invisible && (r.clippedSides ?? 0) >= 3 && r.outlineCarries)
    .map((r) => `${r.who} — its focus ring is clipped away on ${r.clippedSides} sides`);
  return [...vanished, ...clipped, ...readings
    .filter((r) => !r.invisible && (r.best ?? 0) < 3)
    .map(
      (r) =>
        `${r.who} — best ${r.best}:1` +
        (r.found?.length ? ` (${r.found.map((f) => `${f.kind} ${f.colour} ${f.ratio.toFixed(2)}`).join('; ')})` : ' (no indicator)'),
    )];
}
