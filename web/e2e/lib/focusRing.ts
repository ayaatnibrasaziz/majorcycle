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
  // Put focus back on the last element measured — used to re-measure a reading that
  // went stale while the page was still settling.
  window.__refocusLast = () => {
    const el = window.__lastFocused;
    if (!el || !el.isConnected) return false;
    el.focus();
    return document.activeElement === el;
  };
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
    let r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.id || '').trim().replace(/\\s+/g, ' ').slice(0, 50);
    const who = el.tagName.toLowerCase() + (name ? ' "' + name + '"' : '');
    if (r.width === 0 && r.height === 0) return { who, invisible: true, key: String(ids.get(el)) };
    const t0 = Date.now();
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    // ⚠️ WAIT FOR THE SCROLL. Focusing a control off screen scrolls it into view, and
    // that scroll is not instant — measuring straight away reported perfectly ordinary
    // footer links as "off screen", and sampled coverage at points outside the viewport
    // (where elementFromPoint returns null, i.e. "covered by nothing"). Poll until the
    // page has stopped moving, capped.
    let sy = -1;
    for (let i = 0; i < 20 && sy !== window.scrollY; i++) { sy = window.scrollY; await sleep(50); }
    r = el.getBoundingClientRect(); // where it ENDED UP, not where it was mid-scroll
    // ⚠️ WebKit does not always scroll a control into view when a SCRIPT focuses it,
    // where Tab always does — so a control below the fold measured "off screen" there
    // and nowhere else. Put it where Tab would have put it: just inside the edge
    // ('nearest', never centred), so "is the sticky header covering it?" stays a real
    // question.
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      sy = -1;
      for (let i = 0; i < 20 && sy !== window.scrollY; i++) { sy = window.scrollY; await sleep(50); }
      r = el.getBoundingClientRect();
    }
    let last = '';
    let found = [];
    while (Date.now() - t0 < 2000) {
      // The wrapper's border transitions too (.15s on the search boxes).
      const moving = [el, el.parentElement, el.parentElement && el.parentElement.parentElement]
        .filter(Boolean)
        .some((n) => n.getAnimations().some((a) => a.playState === 'running'));
      found = read(el);
      const now = JSON.stringify(found);
      // ⚠️ A MINIMUM as well as a stability test (11ao, again). The ring TRANSITIONS
      // from currentColor, and if the transition has not started yet the first two reads
      // agree perfectly — on a dark band that scored a white ring at 1.1:1 in Firefox
      // and WebKit while Chromium, a shade slower, read the settled brand blue. "Two
      // equal readings" is a plateau, not a finish.
      if (!moving && now === last && Date.now() - t0 >= 280) break;
      last = now;
      await sleep(60);
    }
    const best = found.reduce((m, f) => (f.ratio > m ? f.ratio : m), 0);
    // Reported on every failure: without it, "no indicator" cannot be told apart from
    // "the browser did not treat this as keyboard focus", which is a different bug in a
    // different place (the walk's modality, not the site's CSS).
    let focusVisible = false;
    try { focusVisible = el.matches(':focus-visible'); } catch { focusVisible = false; }
    // ⚠️ DID IT STAY FOCUSED? A page still hydrating REPLACES nodes, so the element
    // measured above can be detached — or simply no longer focused — by the time the
    // reading finishes. Its computed styles are then the UNFOCUSED ones, which reads as
    // "no indicator": a site defect, reported against a control that is perfectly fine.
    // The caller re-measures once rather than believing it.
    const stale = !el.isConnected || document.activeElement !== el;
    // ⚠️ AND DOES THE WINDOW ITSELF HAVE FOCUS? A browser draws no focus ring in a
    // window that is not focused, so a page that lost it reports every control as
    // "no indicator" — which is what Firefox and WebKit did under parallel load while
    // both were perfect run alone. Reported, and the caller re-takes the reading.
    const docFocus = document.hasFocus();

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
    // ⚠️ AND IS THE CONTROL STILL VISIBLE AT ALL? WCAG 2.4.11 (AA, 2.2): a focused
    // control must not be entirely hidden by other content — a sticky header is the
    // usual culprit, and this product has one at every width. Sample a grid inside the
    // element and ask what is actually on top at each point; if nothing of it is on top,
    // or its box is off screen, a keyboard reader is on a control they cannot see.
    // ⚠️ AFTER THE PREVIOUS CONTROL'S POPUP HAS GONE. InfoTip hides 100ms after blur
    // on purpose (so a pointer can travel onto the bubble), and sampling at t=0 caught
    // the PREVIOUS tip's bubble sitting over this trigger — 20 confident false findings
    // on Stock Detail, each naming a different metric's explanation (11q: when a
    // measurement disagrees with the screen, instrument the instrument).
    await sleep(200);
    let visiblePoints = 0;
    let coveredBy = '';
    const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    // ⚠️ PER LINE BOX, not per bounding rect. A link that wraps has a bounding rect
    // spanning the whole paragraph, so most sample points land on the text AROUND it
    // and hit the <p> — which read as "covered by its own paragraph" on one article.
    // Same trap as the overlap probe's invented 24 overlaps (11bh).
    // ⚠️ SAMPLE THE PART THAT IS ON SCREEN. Taking points at fractions of the element's
    // OWN height puts every sample outside the viewport for anything taller than the
    // screen — a chart, a table region, a big article card — and a point outside the
    // viewport returns nothing, which read as "covered by (nothing)". Six such false
    // findings in Firefox and WebKit; Chromium missed them only by scrolling elsewhere.
    const clamp = (b) => ({
      left: Math.max(b.left, 0),
      top: Math.max(b.top, 0),
      right: Math.min(b.right, innerWidth),
      bottom: Math.min(b.bottom, innerHeight),
    });
    const boxes = inView
      ? [...el.getClientRects()]
          .map(clamp)
          .filter((b) => b.right - b.left > 0.5 && b.bottom - b.top > 0.5)
      : [];
    for (const b of boxes) {
      const bw = b.right - b.left;
      const bh = b.bottom - b.top;
      for (let ix = 1; ix <= 5; ix++) {
        for (let iy = 1; iy <= 3; iy++) {
          const x = b.left + (bw * ix) / 6;
          const y = b.top + (bh * iy) / 4;
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
          const top = document.elementFromPoint(x, y);
          // NOT \`top.contains(el)\`: every element's ancestors end at <body>, so
          // accepting an ancestor made the check unable to fail — my own control,
          // a fixed bar over the header, went unreported until this line changed.
          if (top && (top === el || el.contains(top))) visiblePoints++;
          else if (top && !coveredBy) coveredBy = top.tagName.toLowerCase() + '.' + String(top.className).slice(0, 60) + ' [' + (top.textContent || '').trim().slice(0, 30) + ']';
        }
      }
    }

    // Whether the outside ring is what carried the pass — a clipped outline does not
    // matter when a border or wrapper change already reaches 3:1 on its own.
    const outlineCarries = !found.some((f) => f.kind !== 'outline' && f.ratio >= 3);
    return { who, key: String(ids.get(el)), best: +best.toFixed(2), found, clippedSides, outlineCarries, inView, visiblePoints, coveredBy, focusVisible, stale, docFocus, ms: Date.now() - t0 };
  };
  return true;
})()`;

/**
 * How the walk moves focus.
 *
 * `tab` presses Tab, which measures the ring AND the reading order in one pass. WebKit
 * cannot: that build never gives a LINK focus from Tab — Safari's own "Tab to links"
 * preference, off by default, which is real Safari behaviour and not ours to fix (H4).
 *
 * ⚠️ Skipping WebKit was the H5 audit's first answer, and it threw away the half that
 * IS ours: whether our CSS shows a visible ring. `direct` focuses each visible control
 * instead. **Measured before it was trusted** (2026-09-20, `/pricing` at 375px): with a
 * key press first, WebKit matches `:focus-visible` on programmatic focus for every
 * control and reports the same outline colours as Chromium, control for control. What
 * `direct` does NOT measure is the Tab ORDER — in Safari that is Safari's.
 */
export type WalkMode = 'tab' | 'direct';

/** Which mode an engine can use. Only WebKit differs. */
export const modeFor = (browserName: string): WalkMode =>
  browserName === 'webkit' ? 'direct' : 'tab';

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
  inView?: boolean;
  visiblePoints?: number;
  coveredBy?: string;
  focusVisible?: boolean;
  stale?: boolean;
  docFocus?: boolean;
  ms?: number;
}

/**
 * Tab from the top of the page until focus comes back round (or `maxTabs`), and
 * return one reading per element reached. Call after the page has rendered.
 */
/**
 * Wait until the page stops changing. A walk started mid-hydration measures elements
 * that are then REPLACED, and a replaced element reports its unfocused styles — which
 * looked exactly like "this control has no focus ring" on article pages and Stock
 * Detail, in Firefox and WebKit, only under parallel load (H5 audit, 2026-09-20).
 */
async function domQuiet(page: Page, quietMs = 500, capMs = 8000) {
  await page.evaluate(
    ([quiet, cap]) =>
      new Promise<void>((resolve) => {
        let t = setTimeout(done, quiet);
        const obs = new MutationObserver(() => {
          clearTimeout(t);
          t = setTimeout(done, quiet);
        });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true });
        const hard = setTimeout(done, cap);
        function done() {
          clearTimeout(t);
          clearTimeout(hard);
          obs.disconnect();
          resolve();
        }
      }),
    [quietMs, capMs] as const,
  );
}

export async function walkFocus(
  page: Page,
  opts: { maxTabs?: number; mode?: WalkMode } = {},
): Promise<RingReading[]> {
  const { maxTabs = 400, mode = 'tab' } = opts;
  // The page must own keyboard focus for any of this to mean anything.
  await page.bringToFront();
  await domQuiet(page);
  await page.evaluate(SETUP);
  if (mode === 'direct') return walkDirect(page);
  // Start from the document, not from whatever a previous step left focused.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const readings: RingReading[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const r = await measure(page);
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
 * One reading — re-taken once if the page moved under it (see `stale`). The retry
 * re-focuses the SAME element after a key press, so keyboard modality is restored too.
 */
async function measure(page: Page): Promise<RingReading | null> {
  const first = (await page.evaluate('window.__focusRing()')) as RingReading | null;
  if (!first || first.left) return first;
  // Re-take when the page moved under the reading, or when the browser did not treat
  // it as keyboard focus — the second happens when the WINDOW lost focus, and then
  // every control reads "no ring" however good the CSS is.
  if (!first.stale && first.focusVisible !== false) return first;
  await page.bringToFront();
  await page.keyboard.press(MODALITY_KEY);
  const back = await page.evaluate('window.__refocusLast()');
  if (!back) return first;
  const second = (await page.evaluate('window.__focusRing()')) as RingReading | null;
  return second ?? first;
}

/**
 * The key pressed to tell the browser "this reader is using a keyboard".
 *
 * ⚠️ IT MUST NOT BE A MODIFIER, and that cost four runs to find. A mouse click puts
 * WebKit into pointer modality, and from then on a script's `focus()` does NOT match
 * `:focus-visible` — so every control reads "no ring". Pressing **Shift** does not undo
 * it; measured, 2026-09-20, with the menu opened by a real click: Shift → `fv=false,
 * outline=none`, F1 / F6 / PageDown → `fv=true, outline=solid`. My first Safari
 * experiment only worked because that page had never been clicked, and an earlier
 * attempt to reproduce it hid the difference by pressing Escape in every arm.
 *
 * F1 is chosen because it does nothing to a page: no typing, no scrolling, no focus move.
 */
const MODALITY_KEY = 'F1';

/**
 * WebKit's walk: focus every visible control in document order.
 *
 * ⚠️ A KEY PRESS BEFORE EACH ONE. A browser treats a script's `focus()` as keyboard focus
 * only when the reader's last interaction was a key, so without this every control reads
 * "no ring" — a false finding the width of Safari.
 * ⚠️ And only VISIBLE controls: at phone width the collapsed menu's links cannot take
 * focus at all, and the first version of this experiment measured them and concluded the
 * rings were missing (11q — the instrument, not the product).
 */
async function walkDirect(page: Page): Promise<RingReading[]> {
  const count = await page.evaluate(() => {
    const w = window as unknown as { __mcControls: HTMLElement[] };
    w.__mcControls = [
      ...document.querySelectorAll(
        'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((e) => {
      const el = e as HTMLElement;
      return (
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== 'hidden' &&
        !(el as HTMLButtonElement).disabled &&
        // ⚠️ `tabindex="-1"` is NOT reachable by keyboard, and this walk must measure
        // what a keyboard reader meets. The two honeypot inputs (contact, refer a
        // friend) are exactly that: deliberately hidden from people, focusable only by
        // script. Tab skips them, so the other engines never saw them and WebKit's walk
        // reported both as defects.
        el.tabIndex >= 0
      );
    }) as HTMLElement[];
    return w.__mcControls.length;
  });
  const readings: RingReading[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(MODALITY_KEY); // keyboard modality — see above
    const focused = await page.evaluate((idx) => {
      const el = (window as unknown as { __mcControls: HTMLElement[] }).__mcControls[idx];
      if (!el || !el.isConnected) return false;
      el.focus();
      return document.activeElement === el;
    }, i);
    if (!focused) continue;
    const r = await measure(page);
    if (!r || r.left || seen.has(r.key)) continue;
    seen.add(r.key);
    readings.push(r);
  }
  return readings;
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
  const hidden = readings
    .filter((r) => !r.invisible && r.visiblePoints === 0)
    .map((r) => `${r.who} — focused but ${r.inView ? `covered by ${r.coveredBy}` : 'off screen'} (WCAG 2.4.11)`);
  const moved = readings
    .filter((r) => !r.invisible && (r.stale || r.focusVisible === false))
    .map((r) =>
      r.stale
        ? `${r.who} — the page replaced or unfocused it while it was being measured (re-measure failed)`
        : `${r.who} — the browser never treated this as keyboard focus (window focused: ${r.docFocus ? 'yes' : 'NO'}) — the walk could not measure it`,
    );
  const clipped = readings
    // Three sides, not four: the toggles measured 3 — one short edge of ring left, which
    // nobody reads as focus. The header's buttons measure 1 and read fine.
    .filter((r) => !r.invisible && (r.clippedSides ?? 0) >= 3 && r.outlineCarries)
    .map((r) => `${r.who} — its focus ring is clipped away on ${r.clippedSides} sides`);
  return [...vanished, ...hidden, ...moved, ...clipped, ...readings
    .filter((r) => !r.invisible && !r.stale && r.focusVisible !== false && (r.best ?? 0) < 3)
    .map(
      (r) =>
        `${r.who} — best ${r.best}:1 (:focus-visible ${r.focusVisible ? 'yes' : 'NO — the walk lost keyboard modality, not a site defect'})` +
        (r.found?.length ? ` (${r.found.map((f) => `${f.kind} ${f.colour} ${f.ratio.toFixed(2)}`).join('; ')})` : ' (no indicator)'),
    )];
}
