import { expect, test } from '@playwright/test';

import { NAV_LINKS } from '../lib/publicNav';

/**
 * The click feedback on public links — and why it needs a test at all.
 *
 * Public routes are dynamic with no `loading.tsx`, so a click costs a full server
 * round trip. Measured on the production build under Slow 3G, "Create free
 * account" left the page visibly unchanged for **5.7 seconds**. `LinkPending`
 * closes that with a dot that appears ~200ms after the click.
 *
 * ⚠️ **This breaks SILENTLY, which is the whole argument for the file.**
 * `useLinkStatus()` reads context that `<Link>` provides; called anywhere that is
 * not a descendant of a Link it returns `{ pending: false }` **forever**, with no
 * error, no warning and no visual difference from "the navigation was simply
 * fast". Proven by breaking it on purpose 2026-08-18: moving `<LinkPending />`
 * from inside the Link to just outside it still compiled, still typechecked, still
 * navigated in 702ms — and the dot never appeared, peak opacity 0.000.
 *
 * So the assertions are deliberately of two kinds, because either alone is weak:
 *
 *  • **Structural** — the hint is a DESCENDANT of every nav link. This is the
 *    check that catches the exact break above, and it needs no click.
 *  • **Behavioural** — on a throttled click the dot really does reach a visible
 *    opacity. Structure alone would pass even if the hook were stubbed out.
 *
 * Plus a **control**: at rest the same dots must compute to opacity 0. Without it
 * "opacity > 0.05" could be satisfied by a hint that is simply always on, which
 * would be a permanent smudge next to every link rather than a loading indicator.
 */

/** Chrome DevTools' own Fast 3G preset. */
const FAST_3G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 562.5,
};

test.describe('a clicked public link tells the reader it heard them', () => {
  test('every header nav link CONTAINS its own hint, not a sibling', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('header nav[aria-label="Main"]');
    await expect(nav).toBeVisible();

    for (const l of NAV_LINKS) {
      const link = nav.locator(`a[href="${l.href}"]`);
      await expect(link, `${l.label} should be in the header`).toHaveCount(1);
      // .link-hint INSIDE the anchor. `nav .link-hint` would also match a hint
      // that had drifted out of the link — the break this file exists for.
      await expect(
        link.locator('.link-hint'),
        `"${l.label}" must contain its hint — a hint outside the <Link> silently never fires`,
      ).toHaveCount(1);
    }
  });

  test('both call-to-action buttons carry one too', async ({ page }) => {
    // /login and /signup are force-dynamic and never prefetched, so these are the
    // slowest links on the site and the ones a lost signup goes through.
    await page.goto('/learn');
    for (const [href, label] of [
      ['/login', 'Sign in'],
      ['/signup', 'Create free account'],
    ]) {
      const link = page.locator(`header a[href="${href}"]`);
      await expect(link, `${label} should be in the header`).toHaveCount(1);
      await expect(link.locator('.link-hint'), `${label} must contain its hint`).toHaveCount(1);
    }
  });

  test('CONTROL — at rest every hint is invisible and takes no space of its own', async ({
    page,
  }) => {
    await page.goto('/');
    const resting = await page.evaluate(() =>
      [...document.querySelectorAll('.link-hint')].map((el) => {
        const s = getComputedStyle(el);
        return { opacity: parseFloat(s.opacity), visibility: s.visibility };
      }),
    );
    expect(resting.length, 'the hints should exist on the page at all').toBeGreaterThan(0);
    for (const r of resting) {
      // If this ever passes at opacity > 0, the "it became visible" assertion
      // below stops meaning anything.
      expect(r.opacity, 'a resting hint must be fully transparent').toBe(0);
      expect(r.visibility, 'and hidden, so it reserves space without showing').toBe('hidden');
    }
  });

  test('clicking a slow link makes the dot visible within half a second', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'network throttling is driven over CDP');

    // ⚠️ ORDER MATTERS, and getting it wrong does not look like a timing bug.
    // Throttling the FIRST load too made the click land before React had
    // hydrated, so the anchor behaved like a plain <a> and did a full page load —
    // surfacing as "Execution context was destroyed", which reads like a flaky
    // harness rather than "the test clicked too early". Load at full speed, wait
    // for hydration, and only then make the network slow. That is also the
    // realistic case: somebody who has been reading the page, then clicks.
    await page.goto('/', { waitUntil: 'load' });

    // React attaches a `__reactFiber$…` property to a DOM node when it hydrates
    // it, so this asks the element itself whether it is live — rather than
    // waiting a fixed time and hoping, which is what makes this kind of test
    // flaky on a cold CI machine.
    await page.waitForFunction(
      () => {
        const a = document.querySelector('header nav[aria-label="Main"] a[href="/learn"]');
        return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber$'));
      },
      undefined,
      { timeout: 30_000 },
    );

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    // Throttle deliberately. Against an unthrottled local server the navigation
    // can finish inside the 120ms debounce, in which case showing nothing is
    // CORRECT behaviour — so without this the test would be measuring luck.
    await cdp.send('Network.emulateNetworkConditions', FAST_3G);

    const before = (await page.locator('main h1').first().innerText()).trim();

    const link = page.locator('header nav[aria-label="Main"] a[href="/learn"]');
    await link.click({ noWaitAfter: true });

    // Poll the COMPUTED opacity, not the class. A class that is set while the
    // element paints at zero is not feedback, and the reduce-motion path reaches
    // the same opacity by an entirely different route (transition, not animation)
    // — so asking what the browser actually computed covers both.
    let peak = 0;
    let visibleAt: number | null = null;
    let hardNavigated = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 5_000 && visibleAt === null) {
      // A destroyed context means the browser did a FULL page load rather than a
      // client-side transition — a real defect (no client transition, so no
      // pending state can exist), not a harness hiccup. Record it and let the
      // assertion below name it, instead of throwing something unreadable.
      const op = await page
        .evaluate(() => {
          const el = document.querySelector('.link-hint.is-pending');
          return el ? parseFloat(getComputedStyle(el).opacity) || 0 : 0;
        })
        .catch(() => {
          hardNavigated = true;
          return 0;
        });
      if (hardNavigated) break;
      if (op > peak) peak = op;
      if (op > 0.05) visibleAt = Date.now() - t0;
      else await page.waitForTimeout(25);
    }

    expect(
      hardNavigated,
      'the click caused a FULL page load instead of a client-side transition — <Link> is not doing its job, so no pending state can ever show',
    ).toBe(false);

    expect(
      visibleAt,
      `the pending dot never became visible (peak opacity ${peak}). Either useLinkStatus is not firing — check <LinkPending /> is INSIDE the <Link> — or .link-hint lost its styles.`,
    ).not.toBeNull();
    // 500ms, against a measured ~200ms: loose enough not to flake on a cold CI
    // compile, tight enough that a regression to "no feedback at all" fails.
    expect(visibleAt!).toBeLessThan(500);

    // And the navigation still completes — the indicator must not have replaced
    // the thing it was reporting on.
    await expect
      .poll(async () => (await page.locator('main h1').first().innerText()).trim(), {
        timeout: 30_000,
      })
      .not.toBe(before);
  });
});
