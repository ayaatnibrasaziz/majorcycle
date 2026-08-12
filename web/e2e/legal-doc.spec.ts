import { expect, test, type Page } from '@playwright/test';

import { LEGAL_DOCS } from '../lib/publicNav';

/**
 * The three legal documents and their contents rail.
 *
 * Credential-free browser tests — no login, no network beyond the dev server —
 * so they run on a fork PR and cannot self-skip.
 *
 * ⚠️ Every assertion here is for something that fails SILENTLY. The rail renders,
 * the links work and the page looks completely correct in all three failure modes
 * below; two of them were live in the first version and were found by measuring,
 * not by looking:
 *
 *  1. **The rail stops sticking.** A grid item stretches to the row height by
 *     default, and a sticky element as tall as its own scroll range never moves.
 *     Two things independently prevent that — `align-items: start` on
 *     `.legal-layout` and the rail's own `max-height` clamp — and the clamp is the
 *     load-bearing one (measured; see globals.css). This asserts the OUTCOME, that
 *     the rail is pinned, so it stays valid whichever protection is removed. It
 *     goes red only when both are, which is correct: either alone still holds it.
 *  2. **The measure blows out.** The frame is `wide` (1120px) for the rail's sake,
 *     and below 1024px `.legal-layout` is plain block flow. Measured before the
 *     fix: **973px at 1023px and 733px at 768px**, about 110 characters of 17px
 *     body copy per line against a 45–75 band. Perfectly legible in a screenshot;
 *     just exhausting to read.
 *  3. **The notice sinks below the fold.** CLAUDE.md #4/#12 require "not financial
 *     advice" visible without scrolling. It sits above the contents today, but it
 *     is one added masthead element away from not doing, and the requirement is
 *     legal rather than aesthetic.
 *
 * `LEGAL_DOCS` is imported rather than a hand-typed list of the three paths, so a
 * fourth document is covered here the moment it exists.
 */

const DOC_PATHS = LEGAL_DOCS.map((d) => d.href);

/** The rail (desktop) and the inline list (mobile) share this label. */
const CONTENTS = 'nav[aria-label="Contents"]';

/** The document's own body size (--doc-body) means the stylesheet has applied. */
async function ready(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => getComputedStyle(document.querySelector('article')!).fontSize),
    )
    .toBe('13px');
}

test.describe('the document layout', () => {
  for (const path of DOC_PATHS) {
    test(`${path} keeps its measure at every width`, async ({ page }) => {
      await page.goto(path);
      await ready(page);

      // 1023 is the one that mattered: the rail has gone and the grid is off, so
      // nothing but the article's own max-width is holding the column.
      for (const width of [375, 768, 1023, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const { artW, scrollW, clientW } = await page.evaluate(() => ({
          artW: Math.round(document.querySelector('article')!.getBoundingClientRect().width),
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        expect(artW, `${path} at ${width}px is ${artW}px wide`).toBeLessThanOrEqual(680);
        // CLAUDE.md #3 — no horizontal scroll on a phone.
        expect(scrollW, `${path} scrolls sideways at ${width}px`).toBeLessThanOrEqual(clientW);
      }
    });

    test(`${path} shows exactly one contents list at a time`, async ({ page }) => {
      await page.goto(path);
      await ready(page);

      // Both exist in the DOM at every width — the running order differs between
      // phone and desktop, so they cannot be one element moved by CSS. Exactly
      // one must ever be visible, or a reader meets the same list twice.
      await page.setViewportSize({ width: 1280, height: 900 });
      await expect(page.locator(`${CONTENTS}:visible`)).toHaveCount(1);

      await page.setViewportSize({ width: 1023, height: 900 });
      await expect(page.locator(`${CONTENTS}:visible`)).toHaveCount(1);
    });

    test(`${path} puts the not-financial-advice notice above the fold`, async ({ page }) => {
      // CLAUDE.md #4/#12/#24. Checked at 375px, where the fold is highest and the
      // masthead has the least room — if it clears here it clears everywhere.
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await ready(page);

      // Scoped to the article on purpose. The shared footer carries the SAME
      // sentence on every public page, so an unscoped match finds two — and the
      // footer one is at the bottom of a 2,000-word document, which is precisely
      // the placement this test exists to forbid. A guard that can be satisfied by
      // the thing it is guarding against is worse than no guard.
      const notice = page.locator('article').getByText('Information only — not financial advice.');
      await expect(notice).toBeVisible();
      const box = (await notice.boundingBox())!;
      const vh = await page.evaluate(() => window.innerHeight);
      expect(box.y + box.height, `${path}: the notice ends below the fold`).toBeLessThanOrEqual(vh);
    });
  }
});

test.describe('the contents rail', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('every entry points at a section that exists', async ({ page }) => {
    // The ids are derived from the headings (`sectionId`), never authored, so this
    // is really asking whether the derivation still agrees with itself after an
    // edit to the wording — the exact drift a hand-typed id would produce.
    for (const path of DOC_PATHS) {
      await page.goto(path);
      await ready(page);

      const rail = page.locator(CONTENTS).first();
      const hrefs = await rail.locator('ol a').evaluateAll((els) =>
        els.map((e) => e.getAttribute('href')!),
      );
      expect(hrefs.length, `${path} rail is empty`).toBeGreaterThan(3);

      for (const href of hrefs) {
        // `#the-service` is already a valid CSS id selector.
        await expect(page.locator(href), `${path} → ${href} matches no section`).toHaveCount(1);
      }
    }
  });

  test('it sticks to the viewport once the page scrolls', async ({ page }) => {
    await page.goto('/terms');
    await ready(page);

    const rail = page.locator(CONTENTS).first();
    const topAt = async (y: number) => {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      // Two frames: one for the scroll, one for the sticky position to settle.
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      return Math.round((await rail.boundingBox())!.y);
    };

    const parked = await topAt(400);
    const deeper = await topAt(900);

    // The header is 58px and the rail is pinned 24px below it, so ~82.
    //
    // ⚠️ Bounded on BOTH sides deliberately. This read `toBeLessThanOrEqual(90)`
    // alone, which an unstuck rail satisfies perfectly — when I broke it for real
    // the rail sat at **-317**, far above the viewport, and sailed through that
    // assertion. Only the second line caught it. An upper bound alone tests that
    // the rail is not too LOW, which was never the failure mode.
    expect(parked, 'the rail is not pinned just below the header').toBeGreaterThanOrEqual(58);
    expect(parked, 'the rail is not pinned just below the header').toBeLessThanOrEqual(90);
    // …and it must not move again. Broken on purpose (rail `max-height` removed
    // AND `align-items: start` removed — either alone still holds it): received
    // 500.
    expect(Math.abs(deeper - parked), 'the rail moved when it should be stuck').toBeLessThanOrEqual(2);
  });

  test('clicking an entry marks it current and never lands under the header', async ({ page }) => {
    await page.goto('/terms');
    await ready(page);

    const rail = page.locator(CONTENTS).first();
    const hrefs = await rail
      .locator('ol a')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')!));

    // ⚠️ Why this is not simply "the heading lands at ~82".
    //
    // It was, and it went FLAKY the moment the document was re-set at 13px: the
    // whole of /terms is now about 1.9 screens tall, so a jump to a late clause
    // hits the bottom of the page and stops. Measured at 1280×900 —
    // #the-service lands at 78, #acceptable-use at 131, #contact at 607, all
    // three correct. A clause that CANNOT reach the top is not a bug, and a test
    // that demands it will keep straddling its own bound as the wording changes.
    //
    // So: the invariant asserted for every entry is the one that must always
    // hold — the heading is never hidden UNDER the sticky header, which is what
    // `scroll-mt` exists to guarantee. Delete `scroll-mt` and an early clause
    // lands at ~0 and this goes red.
    const HEADER_H = 58;
    let landedNearTop = 0;

    for (const href of hrefs) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const link = rail.locator(`a[href="${href}"]`);
      await link.click();
      await page.waitForTimeout(450); // the smooth scroll settling

      // aria-current, not a colour: the highlight is the only thing telling a
      // reader where they are, and a class name is not what a screen reader
      // announces.
      await expect(link).toHaveAttribute('aria-current', 'true');

      const box = (await page.locator(`${href} h2`).boundingBox())!;
      expect(box.y, `${href} landed under the sticky header`).toBeGreaterThanOrEqual(HEADER_H);
      if (box.y <= 140) landedNearTop += 1;
    }

    // The control. Without it, a page that simply never scrolled would satisfy
    // every assertion above — each heading would sit somewhere below 58 and pass.
    // At least the reachable clauses must actually be brought to the top, which
    // is the thing the offset is for.
    expect(landedNearTop, 'no clause was actually scrolled to the top').toBeGreaterThanOrEqual(2);
  });

});
