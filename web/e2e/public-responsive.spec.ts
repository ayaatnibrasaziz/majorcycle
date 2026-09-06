import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  test('the header keeps room to spare at 320px', async ({ page }) => {
    /**
     * ⚠️ THE MARGIN, not the boundary — CLAUDE.md 11i-b. The test above passes the
     * moment the header fits exactly, and "exactly" is the state the site was
     * already in: at 375px the header row measured 375.0px against a 375px window.
     * Nothing was red, and a two-word change to the call-to-action would have
     * pushed it over on the most common phone in the world. This asserts the
     * header's own content leaves real room, so a copy change goes red here rather
     * than shipping.
     */
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto('/');
    await settled(page);

    const slack = await page.evaluate(() => {
      const header = document.querySelector('[data-public-header]')!;
      const row = header.firstElementChild as HTMLElement;
      const cs = getComputedStyle(row);
      const inner =
        row.getBoundingClientRect().width -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      const used = [...row.children]
        .map((c) => c.getBoundingClientRect().width)
        .reduce((a, b) => a + b, 0);
      return Math.round(inner - used);
    });

    expect(slack, `the header has only ${slack}px of slack at 320px`).toBeGreaterThanOrEqual(
      MIN_HEADER_SLACK_PX,
    );
  });
});

test.describe('the public forms do not zoom an iPhone', () => {
  /**
   * ⚠️ AUDIT 5A-155. iOS Safari zooms the page in when a focused control computes
   * under 16px and does not zoom back out, so a reader tapping "Email" is thrown
   * into a magnified page in the middle of the sign-up funnel. Eleven controls
   * across five pages were at 13–14px.
   *
   * ⚠️ Asserted on the RENDERED page, not on the stylesheet. The rule is unlayered
   * CSS beating a Tailwind utility, which is a cascade question no amount of
   * reading the source settles (CLAUDE.md 14d: source-correct and screen-wrong is
   * a real state).
   */
  const FORM_PAGES = ['/login', '/signup', '/reset-password', '/contact'] as const;

  test('every public text control is at least 16px on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const small: string[] = [];
    let seen = 0;

    for (const path of FORM_PAGES) {
      await page.goto(path);
      await settled(page);
      const controls = await page.evaluate(() =>
        [...document.querySelectorAll('input, textarea, select')]
          .filter((el) => {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            const type = (el as HTMLInputElement).type;
            return (
              cs.display !== 'none' &&
              cs.visibility !== 'hidden' &&
              r.width > 8 &&
              r.height > 8 &&
              type !== 'checkbox' &&
              type !== 'radio'
            );
          })
          .map((el) => ({
            id: el.id || el.tagName,
            px: parseFloat(getComputedStyle(el).fontSize),
          })),
      );
      seen += controls.length;
      for (const c of controls) {
        if (c.px < 16) small.push(`${path} #${c.id} is ${c.px}px`);
      }
    }

    // The control: "no control under 16px" is satisfied perfectly by a page with
    // no controls on it, which is what a broken selector or a failed navigation
    // produces.
    expect(seen, 'no form controls were measured — the sweep proves nothing').toBeGreaterThanOrEqual(
      7,
    );
    expect(small, `these zoom an iPhone on focus:\n  ${small.join('\n  ')}`).toEqual([]);
  });

  test('the signed-in terminal is deliberately NOT changed by that rule', async ({ page }) => {
    /**
     * ⚠️ The rule is scoped to `[data-public-site]` because `components/ui/input.tsx`
     * is shared with the paid product, and a public-pages pass does not get to
     * repaint a paid surface (CLAUDE.md 11l). That scoping is invisible in the CSS
     * unless something asserts it, and a scope nobody checks is a scope that widens
     * on the next edit.
     */
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await settled(page);
    const px = await page.evaluate(() => {
      // Deliberately appended to <body>, i.e. OUTSIDE [data-public-site], which is
      // body's child.
      const el = document.createElement('input');
      el.className = 'w-full h-11 text-[14px]';
      document.body.appendChild(el);
      const size = parseFloat(getComputedStyle(el).fontSize);
      el.remove();
      return size;
    });
    expect(px, 'the 16px rule escaped its [data-public-site] scope').toBe(14);
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
    // Under 520px the two actions live in here too, because the header row cannot
    // hold the lockup, a menu control and a 178px call-to-action on a 375px screen.
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
    // Inside the PANEL, not inside the nav: under 520px the two actions are the
    // panel's first focusable children and sit above the link list, so naming the
    // nav's first link asserted the wrong element and failed for a reason that had
    // nothing to do with what this test is about.
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

test.describe('the landing worked run says it scrolls', () => {
  /**
   * ⚠️ AUDIT 5A-157. The table is 1,055px wide inside a 341px box at 375px, so two
   * thirds of it is off-screen — including three columns the caption underneath
   * explains by name. It always scrolled; nothing said so.
   */
  test('the hint appears on a phone and not on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await settled(page);

    const wrap = page.locator('.lp-swipe');
    await expect(wrap).toBeVisible();

    // The control: the hint must be claiming something TRUE. If the table did not
    // actually overflow, a hint saying "swipe for more" would be a lie, and this
    // whole test would be asserting the lie is present.
    const over = await wrap.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(over, 'the table does not overflow, so the hint should not exist').toBeGreaterThan(2);

    await expect(page.locator('.lp-swipe-hint')).toBeVisible();

    // …and it gets out of the way once the reader has done the thing.
    await wrap.evaluate((el) => el.scrollTo({ left: 200 }));
    await expect(page.locator('.lp-swipe-hint')).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await settled(page);
    await expect(page.locator('.lp-swipe-hint')).toBeHidden();
  });

  test('the screener keeps its own wrapper untouched', () => {
    /**
     * ⚠️ `.results-table-wrap` is ALSO `components/results/ResultsTable.tsx`, which
     * is the paid screener. The hint hangs on an extra class so the landing can
     * gain an affordance without the paid surface gaining one unasked (11l). This
     * asserts the separation in the source, because the screener needs a
     * subscription to render and no browser check here can reach it.
     */
    const src = readFileSync(
      join(__dirname, '..', 'components', 'results', 'ResultsTable.tsx'),
      'utf8',
    );
    expect(src, 'the swipe hint leaked onto the paid screener').not.toContain('lp-swipe');
    expect(src, 'the screener no longer renders the wrapper this rule is about').toContain(
      'results-table-wrap',
    );
  });
});
