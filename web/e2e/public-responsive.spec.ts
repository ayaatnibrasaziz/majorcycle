import { expect, test, type Page } from '@playwright/test';

import { ARTICLES, articlePath, ARTICLES_INDEX_PATH } from '../lib/articles';
import { LEARN_ARTICLES, learnPath } from '../lib/learn';
import { PUBLIC_PAGES } from '../lib/seo';

/**
 * Non-negotiable #3 on the PUBLIC site, at every width a phone actually has.
 *
 * ⚠️ AUDIT 5A-158, and the finding is the shape of the guard rather than a line of
 * CSS. Before this file, "no horizontal scroll at 375px" was asserted by FOUR
 * hand-written lists in four spec files — `landing.spec.ts` for `/`,
 * `articles.spec.ts` for the five articles and their index, `learn.spec.ts` for the
 * twelve Learn articles, `legal-doc.spec.ts` for the three legal pages. Between
 * them they covered 21 of the 30 public URLs and were silent about the other nine:
 * `/pricing`, `/contact`, `/learn` (the index), `/login`, `/signup`,
 * `/reset-password`, `/deletion-requested`, `/reactivate` and
 * `/account/update-password` — every form on the site, and the two pages a
 * distressed reader sees. A guard's scope is a claim about what it can see (14g),
 * and four lists that each cover their own author's page add up to a claim nobody
 * made.
 *
 * ⚠️ AND THE COVERAGE THAT EXISTED LOOKED AT THE WRONG THING at the widths that
 * mattered. `learn.spec.ts` already swept 375 / 360 / **320** — but it measures
 * `[data-article-body]`, the prose column, so it was structurally unable to see the
 * defect this file was written for: a header 18px too wide for a 320px screen, on
 * every one of the 30 pages, including the twelve that sweep was walking.
 *
 * ⚠️ THE LIST IS DERIVED, never typed. `PUBLIC_PAGES` plus both content registries,
 * so a page added tomorrow is covered the day it is added rather than the day
 * somebody remembers this file. The two confinement pages are named separately and
 * for a stated reason — they are not in `PUBLIC_PAGES` (a signed-out reader may not
 * open them), so a derived list cannot reach them.
 */

/** Every URL a stranger can open, derived from the registries. */
const PUBLIC_PATHS: readonly string[] = [
  ...PUBLIC_PAGES.map((p) => p.path),
  ARTICLES_INDEX_PATH,
  ...ARTICLES.map((a) => articlePath(a.slug)),
  ...LEARN_ARTICLES.map((a) => learnPath(a.slug)),
];

/**
 * ⚠️ 320px is BELOW the stated 375px floor, and it is in this list on purpose.
 * CLAUDE.md 11i-b: the last defect of exactly this class cleared 375px by 1.1px
 * and overflowed at 360 and 320, so "our floor is 375" was the one width that
 * could not see it. The same thing happened again here — 5A-154 measured 375.0px
 * of header content in a 375px window, i.e. passing with zero slack, while 320px
 * overflowed by 18px on all thirty pages.
 */
const WIDTHS = [375, 360, 320] as const;

/** How much room the header must have left over. A boundary is not a margin. */
const MIN_HEADER_SLACK_PX = 12;

async function settled(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('[data-public-header]')).toBeVisible();
  // The landing streams its sections in; measuring before they land describes a
  // page that is still half-built.
  await page.waitForTimeout(400);
}

test.describe('the public site fits a phone', () => {
  test('no public page scrolls sideways at 375, 360 or 320px', async ({ page }) => {
    test.setTimeout(300_000);

    const failures: string[] = [];
    let measured = 0;

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 812 });
      for (const path of PUBLIC_PATHS) {
        await page.goto(path);
        await settled(page);

        const m = await page.evaluate(() => {
          const de = document.documentElement;
          // Name the offender. "18px of overflow" sends you hunting; "a 178px
          // button in a 280px row" is a fix.
          const vw = de.clientWidth;
          const widest = [...document.querySelectorAll('body *')]
            .map((n) => {
              const r = n.getBoundingClientRect();
              return {
                tag: n.tagName,
                cls: String(n.className || '').slice(0, 40),
                right: Math.round(r.right),
              };
            })
            .filter((x) => x.right > vw + 1)
            .slice(0, 3);
          return { over: de.scrollWidth - de.clientWidth, widest };
        });

        measured += 1;
        if (m.over > 0) {
          failures.push(
            `${path} at ${width}px overflows by ${m.over}px — ${JSON.stringify(m.widest)}`,
          );
        }
      }
    }

    // ⚠️ The control. Without it a stale registry, a failed navigation or a
    // viewport call that silently did nothing reports a clean sweep having
    // measured nothing (14g).
    expect(PUBLIC_PATHS.length, 'the derived path list collapsed').toBeGreaterThanOrEqual(28);
    expect(measured, 'no page/width combination was measured').toBe(
      WIDTHS.length * PUBLIC_PATHS.length,
    );

    expect(failures, `these overflow a phone:\n  ${failures.join('\n  ')}`).toEqual([]);
  });

  test('the two confinement pages are clean at 320px too', async ({ page }) => {
    // They are not in PUBLIC_PAGES, so the derived sweep above cannot reach them.
    // Signed out they redirect; this asserts the page a reader actually LANDS on is
    // itself within the rule, so the redirect can never be the thing hiding an
    // overflow. Reaching them in their real state needs a recovery session and a
    // deletion-scheduled account respectively — stated, not implied (14g).
    await page.setViewportSize({ width: 320, height: 812 });
    for (const path of ['/reactivate', '/account/update-password']) {
      await page.goto(path);
      await settled(page);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over, `${path} (or where it redirects to) overflows at 320px`).toBeLessThanOrEqual(0);
    }
  });

  test('the header keeps room to spare at every width from 320 to 900', async ({ page }) => {
    /**
     * ⚠️ THE MARGIN, not the boundary — CLAUDE.md 11i-b. The sweep above passes the
     * moment the header fits exactly, and "exactly" is the state the site was
     * already in: at 375px the header row measured 375.0px against a 375px window.
     * Nothing was red, and a two-word change to the call-to-action would have
     * pushed it over on the most common phone in the world.
     *
     * ⚠️ AND IT SWEEPS A RANGE RATHER THAN THREE PHONE WIDTHS, which cost a real
     * defect to learn. The first version checked 320px only. Adding the menu
     * control then pushed the row over at **exactly the width where the two
     * buttons reappear** — 506px of content in 480px of room — so `/learn` and `/`
     * scrolled sideways by 6px from **520 to 525**, menu open or closed. A
     * five-pixel band, between every width anything sampled. A header whose
     * contents change at breakpoints cannot be certified by sampling: the defect
     * lives AT the breakpoint, which is exactly the width nobody picks.
     *
     * So this walks the whole range in 4px steps and asserts the invariant rather
     * than any particular breakpoint — the three `min-[600px]` literals in
     * PublicHeader.tsx can move without this file being edited, and if they move
     * somewhere that does not fit, this goes red naming the width. Proven by
     * putting them back to 520: it fails naming 520 through 544.
     *
     * ⚠️ SAY WHAT IT DOES NOT COVER (14g). One page, because the header is shared
     * chrome and its contents do not vary by route beyond the two confinement
     * pages, which carry no actions at all. It therefore says nothing about a
     * PAGE BODY at an intermediate width — those are covered at 375 / 360 / 320 by
     * the sweep above, and more widely by `learn.spec.ts` and `articles.spec.ts`
     * for the two long-form sections. A body that overflows only at, say, 700px
     * would still get past everything here.
     */
    const failures: string[] = [];
    let checked = 0;

    await page.goto('/learn');
    await settled(page);

    for (let width = 320; width <= 900; width += 4) {
      await page.setViewportSize({ width, height: 812 });
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const row = document.querySelector('[data-public-header]')!.firstElementChild as HTMLElement;
        const cs = getComputedStyle(row);
        const inner =
          row.getBoundingClientRect().width -
          parseFloat(cs.paddingLeft) -
          parseFloat(cs.paddingRight);
        const kids = [...row.children].filter((c) => c.getBoundingClientRect().width > 0);
        const used = kids.reduce((a, c) => a + c.getBoundingClientRect().width, 0);
        const gaps = (kids.length - 1) * parseFloat(cs.columnGap || cs.gap || '0');
        return {
          slack: Math.round(inner - used - gaps),
          overflow: de.scrollWidth - de.clientWidth,
        };
      });
      checked += 1;
      if (m.overflow > 0) failures.push(`${width}px: the page overflows by ${m.overflow}px`);
      else if (m.slack < MIN_HEADER_SLACK_PX) {
        failures.push(`${width}px: the header has only ${m.slack}px of slack`);
      }
    }

    // The control: a viewport call that silently did nothing would report a clean
    // sweep having measured one width 146 times (14g).
    expect(checked, 'the width sweep did not run').toBe(146);
    expect(failures, `the header runs out of room:\n  ${failures.join('\n  ')}`).toEqual([]);
  });
});

test.describe('the phone menu', () => {
  /**
   * ⚠️ AUDIT 5A-156. Below 900px `nav[aria-label="Main"]` is hidden, so the public
   * site had no navigation on a phone at all — the footer was the only way to reach
   * Pricing, Learn, Articles or Contact, at the bottom of documents up to 9,300px
   * tall.
   */
  test('a phone reader can reach every section from the header', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/learn');
    await settled(page);

    // The control: the desktop nav really is unreachable here, or the menu is
    // solving a problem that does not exist and this test proves nothing.
    await expect(page.locator('nav[aria-label="Main"]')).toBeHidden();

    const toggle = page.getByRole('button', { name: /open menu/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(page.getByRole('button', { name: /close menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    const menu = page.locator('nav[aria-label="Menu"]');
    await expect(menu).toBeVisible();
    for (const label of ['How it works', 'Articles', 'Learn', 'Pricing', 'Contact']) {
      await expect(menu.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    // Under 520px the two actions live in here too — below the links, owner's call
    // — because the header row cannot hold the lockup, a menu control and a 178px
    // call-to-action on a 375px screen.
    await expect(page.getByRole('link', { name: /create free account/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^sign in$/i }).first()).toBeVisible();

    /**
     * ⚠️ **MOVE FOCUS INTO THE PANEL FIRST, and this is not a detail.** Escape must
     * return focus to the control that opened the panel (the WAI-ARIA disclosure
     * pattern) or a keyboard reader who dismisses the menu is dropped at the top of
     * the document — the defect `dialog.tsx` already had to fix once (5A-118).
     *
     * The first version of this assertion pressed Escape immediately after clicking
     * the toggle, and **passed with the focus-restoring line deleted**: the click
     * had left focus on the toggle already, so there was nothing to restore and the
     * check could not tell a working implementation from a missing one. A break that
     * fails to break is a finding about the test (CLAUDE.md 11i/11u). Tabbing into
     * the panel first is what makes the assertion mean anything — verified by
     * deleting the line again and watching this go red.
     */
    await page.keyboard.press('Tab');
    // Inside the PANEL, not inside the nav. The two account buttons and the five
    // links have swapped places once already (owner, 2026-09-06 — links first), and
    // an assertion naming whichever happens to be first today fails the next time
    // somebody reorders them, for a reason with nothing to do with focus. Asserting
    // "focus moved into the panel" is the thing this test is actually about.
    const panelId = await page
      .getByRole('button', { name: /close menu/i })
      .getAttribute('aria-controls');
    expect(
      await page.evaluate(
        (id) => !!document.activeElement?.closest(`[id="${CSS.escape(id!)}"]`),
        panelId,
      ),
      'Tab did not move focus into the open panel',
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.getByRole('button', { name: /open menu/i })).toBeFocused();
  });

  test('the menu is not there on a desktop', async ({ page }) => {
    // The mirror control. Without it, a menu that rendered at every width would
    // pass the test above while duplicating the nav on a 1280px screen.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/learn');
    await settled(page);
    await expect(page.locator('nav[aria-label="Main"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /open menu/i })).toBeHidden();
  });
});
