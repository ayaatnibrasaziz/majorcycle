import { expect, test, type Page } from '@playwright/test';

import { LEGAL_DOCS } from '../lib/publicNav';

/**
 * The three legal documents and their contents rail.
 *
 * Credential-free browser tests — no login, no network beyond the dev server —
 * so they run on a fork PR and cannot self-skip.
 *
 * ⚠️ Every assertion here is for something that fails SILENTLY. The rail renders,
 * the links work and the page looks completely correct in all four of the failure
 * modes below; three of them were live in the first version of this component and
 * were found by measuring, not by looking:
 *
 *  1. **The rail stops sticking.** `align-items: start` on `.legal-layout` is the
 *     only reason it can move: a grid item stretches to the row height by default,
 *     so without it the rail is as tall as the document and `position: sticky` has
 *     nothing to travel within. Delete that one line and the rail simply scrolls
 *     away with the page — no error, nothing red, and a screenshot of the top of
 *     the page looks identical.
 *  2. **The measure blows out.** The frame is `wide` (1120px) for the rail's sake,
 *     and below 1024px `.legal-layout` is plain block flow. Measured at 1023px
 *     before the fix: the document ran to **973px**, about 110 characters of 17px
 *     body copy per line against a 45–75 band. Perfectly legible in a screenshot;
 *     just exhausting to read.
 *  3. **The notice sinks below the fold.** CLAUDE.md #4/#12 require "not financial
 *     advice" visible without scrolling. It sits above the contents today, but it
 *     is one added masthead element away from not doing, and the requirement is
 *     legal rather than aesthetic.
 *  4. **The shelf drifts.** The rail's "other documents" and the footer's legal
 *     links both come from `LEGAL_DOCS`. A hand-typed copy in either place would
 *     look right until one of them was edited (CLAUDE.md 11c).
 */

const DOC_PATHS = LEGAL_DOCS.map((d) => d.href);

/** The rail (desktop) and the inline list (mobile) share this label. */
const CONTENTS = 'nav[aria-label="Contents"]';

/** `.reading` computing to 17px means the stylesheet has actually applied. */
async function ready(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => getComputedStyle(document.querySelector('article')!).fontSize),
    )
    .toBe('17px');
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
      await expect(page.getByText('Other documents')).toBeVisible();

      await page.setViewportSize({ width: 1023, height: 900 });
      await expect(page.locator(`${CONTENTS}:visible`)).toHaveCount(1);
      // The rail's extras are desktop-only, so this proves it is the INLINE list
      // that survived rather than the rail having merely lost its width.
      await expect(page.getByText('Other documents')).toBeHidden();
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

  test('clicking an entry marks it current and lands clear of the header', async ({ page }) => {
    await page.goto('/terms');
    await ready(page);

    const link = page.locator(CONTENTS).first().locator('a[href="#acceptable-use"]');
    await link.click();

    // aria-current, not a colour: the highlight is the only thing telling a reader
    // where they are, and a class name is not what a screen reader announces.
    await expect(link).toHaveAttribute('aria-current', 'true');

    const heading = page.locator('#acceptable-use h2');
    const box = (await heading.boundingBox())!;
    // Must clear the 58px sticky header — otherwise the anchor jump parks the
    // heading UNDER the bar and the reader sees the following clause.
    expect(box.y, 'the target heading landed under the sticky header').toBeGreaterThanOrEqual(58);
    expect(box.y, 'the target heading landed too far down').toBeLessThanOrEqual(140);
  });

  test('the shelf offers the other two documents and never the current one', async ({ page }) => {
    for (const doc of LEGAL_DOCS) {
      await page.goto(doc.href);
      await ready(page);

      const shelf = page.locator(CONTENTS).first().locator('a[href^="/"]');
      const hrefs = await shelf.evaluateAll((els) => els.map((e) => e.getAttribute('href')!));

      expect(hrefs.sort()).toEqual(
        LEGAL_DOCS.filter((d) => d.href !== doc.href)
          .map((d) => d.href)
          .sort(),
      );
      // The control: without this, a shelf that rendered NOTHING would satisfy a
      // "does not contain the current page" assertion on every one of the three.
      expect(hrefs.length, `${doc.href} shelf is empty`).toBe(LEGAL_DOCS.length - 1);
    }
  });
});
