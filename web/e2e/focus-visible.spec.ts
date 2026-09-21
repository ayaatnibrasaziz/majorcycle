import { expect, test, type Page } from '@playwright/test';

import { ARTICLES, articlePath, ARTICLES_INDEX_PATH } from '../lib/articles';
import { LEARN_ARTICLES, learnPath } from '../lib/learn';
import { PUBLIC_PAGES } from '../lib/seo';
import { modeFor, ringFailures, walkFocus, type RingReading } from './lib/focusRing';

/**
 * Layer H5 — a keyboard reader on a PHONE can see where they are.
 *
 * Every control a keyboard reaches at 375px must show a focus indicator of at least 3:1
 * against what surrounds it (WCAG 1.4.11), read only once it has stopped animating
 * (11ao). The mechanism lives in `lib/focusRing.ts`; this file decides where to walk.
 *
 * ⚠️ PUBLIC and credential-free, like `contrast.spec.ts`, so it can never self-skip.
 * The signed-in walk is in `app-a11y.spec.ts`, beside the scans that need a session.
 *
 * ⚠️ The list is DERIVED from the registries, as `public-responsive.spec.ts` does, so
 * a page added tomorrow is walked the day it is added.
 */
// A Set: `PUBLIC_PAGES` already carries some of the registry pages, and a duplicate
// path is a duplicate test title, which Playwright refuses outright.
const PUBLIC_PATHS: readonly string[] = [
  ...new Set([
    ...PUBLIC_PAGES.map((p) => p.path),
    ARTICLES_INDEX_PATH,
    ...ARTICLES.map((a) => articlePath(a.slug)),
    ...LEARN_ARTICLES.map((a) => learnPath(a.slug)),
  ]),
];

/**
 * ⚠️ THREE WIDTHS, not one. H5 began as a phone job, and whether a ring can be SEEN
 * depends on the container it is drawn in — which is what changes with width (the header
 * collapses below 900, the app shell below 768, cards stack). The clipped rings this
 * layer found were clipped at EVERY width, so a 375-only walk found them by luck rather
 * than by design; 768 is a boundary this repo has been caught at before (11i-b, 11bf).
 * ⚠️ And 320 because that is the width this product actually supports — the responsive
 * guards sweep it, the screener was fixed to clear it, and a ring is clipped by the
 * container it sits in, which is tightest there.
 */
const WIDTHS = [320, 375, 768, 1280] as const;

async function ready(page: Page, path: string, width: number = 375) {
  await page.setViewportSize({ width, height: 812 });
  await page.goto(path);
  await expect(page.locator('[data-public-header]')).toBeVisible();
  await page.waitForLoadState('load');
}

/** A walk that reached almost nothing proves nothing (11q): every page has the header. */
function assertWalked(readings: RingReading[], label: string) {
  expect(readings.length, `${label}: the walk reached ${readings.length} controls — it did not run`).toBeGreaterThanOrEqual(3);
}

test.describe('every public control shows its focus', () => {
  for (const width of WIDTHS) {
    for (const path of PUBLIC_PATHS) {
      test(`${path} at ${width}px`, async ({ page, browserName }) => {
        test.setTimeout(240_000);
        await ready(page, path, width);
        const readings = await walkFocus(page, { mode: modeFor(browserName) });
        assertWalked(readings, `${path} at ${width}px`);
        const fails = ringFailures(readings);
        expect(fails, `${path} at ${width}px:\n${fails.join('\n')}`).toEqual([]);
      });
    }
  }

  test('the OPEN phone menu', async ({ page, browserName }) => {
    test.setTimeout(180_000);
    // A closed control is outside every walk (11ax): the menu's links exist only
    // once it is open, and it is the only way a phone reader reaches most pages.
    await ready(page, '/learn');
    await page.getByRole('button', { name: /open menu|menu/i }).first().click();
    await expect(page.locator('nav[aria-label="Menu"]')).toBeVisible();
    const readings = await walkFocus(page, { mode: modeFor(browserName) });
    const inMenu = readings.filter((r) => /Pricing|Learn|Articles|Contact/.test(r.who));
    expect(inMenu.length, 'the walk never reached the menu links — it measured the closed page').toBeGreaterThan(0);
    const fails = ringFailures(readings);
    expect(fails, `/learn with the menu open:\n${fails.join('\n')}`).toEqual([]);
  });

  /**
   * WCAG 2.4.11 (AA, WCAG 2.2): a focused control must not be entirely hidden. This
   * product has a sticky header at every width, which is the usual way it happens.
   *
   * ⚠️ The check's first run produced TWENTY confident false findings on Stock Detail —
   * every "What is …?" trigger "covered", each naming a DIFFERENT metric's explanation.
   * `InfoTip` hides 100ms after blur on purpose, so the sample was catching the previous
   * trigger's bubble. The probe waits for it now (11q).
   */
  test('CONTROL: a control hidden behind fixed content is caught', async ({ page, browserName }) => {
    test.setTimeout(180_000);
    await ready(page, '/pricing');
    await page.addStyleTag({
      content: `body::after { content: ''; position: fixed; inset: 0 0 auto 0; height: 200px;
        background: white; z-index: 99999; }`,
    });
    const fails = ringFailures(await walkFocus(page, { mode: modeFor(browserName) }));
    expect(fails.join('\n'), 'a control buried under fixed content was not reported').toMatch(/covered by/);
  });

  /**
   * ⚠️ A RING OVER A GRADIENT IS MEASURED FROM PIXELS, and this proves that path can
   * fail. Colour arithmetic cannot answer it: `background: linear-gradient(...)` leaves
   * `background-color` transparent, so compositing reads through a painted band to the
   * page behind it (11l iii) — a ring that vanishes into a dark band would be scored
   * against white and pass. Here the band is dark AND the ring is painted the same
   * colour as the band, so only a pixel read can see it.
   */
  test('CONTROL: a ring that vanishes into a dark band is caught', async ({ page, browserName }) => {
    test.setTimeout(180_000);
    await ready(page, '/pricing');
    const target = await page.evaluate(() => {
      const a = document.querySelector('main a[href], main button') as HTMLElement;
      a.setAttribute('data-sabotage', '');
      return (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ');
    });
    // ⚠️ The gradient must be the ground THIS control's ring is drawn on. The first
    // version painted `main`, and the chosen link sat on a white card inside it — so the
    // ring was still on white, the measurement was right, and the control failed for the
    // correct reason. Paint the control's own parent instead.
    await page.addStyleTag({
      content: `*:has(> [data-sabotage]) {
          background: linear-gradient(180deg, #0B1F3A 0%, #143260 100%) !important;
          background-color: transparent !important; padding: 8px !important; }
        [data-sabotage]:focus-visible { outline-color: #0E2545 !important; }`,
    });
    const fails = ringFailures(await walkFocus(page, { mode: modeFor(browserName) }));
    expect(fails.join('\n'), 'a ring painted the same colour as its band was not caught').toContain('measured in pixels');
    expect(fails.length, `expected only the sabotaged control:\n${fails.join('\n')}`).toBe(1);
    expect(fails[0], 'the failure named a different control').toContain(target.slice(0, 16));
  });

  test('CONTROL: a control with its indicator removed is caught', async ({ page, browserName }) => {
    test.setTimeout(180_000);
    // Without this, a probe that scored every element 21:1 would pass every test
    // above. It must see a real removal, and ONLY that one (11p).
    await ready(page, '/pricing');
    // Exactly ONE element, marked by hand: a CSS selector matched two logos on the
    // first attempt, which proved the probe right and the control ambiguous.
    const target = await page.evaluate(() => {
      const a = document.querySelector('[data-public-header] a[href]') as HTMLElement;
      a.setAttribute('data-sabotage', '');
      return (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ');
    });
    await page.addStyleTag({
      content: `[data-sabotage]:focus, [data-sabotage]:focus-visible {
        outline: none !important; box-shadow: none !important; border-color: transparent !important; }`,
    });
    const fails = ringFailures(await walkFocus(page, { mode: modeFor(browserName) }));
    expect(fails.length, `expected exactly the sabotaged control to fail:\n${fails.join('\n')}`).toBe(1);
    expect(fails[0], 'the failure named a different control').toContain(target.slice(0, 20));
  });
});
