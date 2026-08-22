import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Automated accessibility scan of the SIGNED-IN product — axe-core, WCAG 2.1 A + AA.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * `a11y.spec.ts` opens with the sentence *"Layer G MEASURES accessibility; Layer H
 * FIXES it"*, and scoped itself to public pages on the reasoning that the signed-in
 * shell's contrast debt was a product-wide repaint G was not authorised to make.
 *
 * That reasoning was sound and its consequence was not: it left Browse, Stock
 * Detail, Run, Results, Request and Account with **no accessibility scan of any
 * kind**, and "we have an accessibility test" quietly came to mean something it did
 * not (CLAUDE.md 14g — a guard scoped to one class of route is silent about the
 * rest, not clean about it). The owner authorised the whole-site sweep on
 * 2026-08-22; the contrast half found 258 failing elements on Browse alone, all of
 * them one token nobody had ever measured.
 *
 * ⚠️ Separate file from `a11y.spec.ts` for the same reason `app-contrast.spec.ts` is
 * separate from `contrast.spec.ts`: the public suites are deliberately
 * credential-free so they run on a fork PR and can never self-skip. This one needs
 * a login and therefore CAN skip. Check the COUNT, not the colour.
 *
 * ── What this does NOT cover, said out loud ─────────────────────────────────
 * axe finds roughly a third of real accessibility problems, and never judges
 * whether alt text is accurate, a focus order sensible, or an error message useful.
 * It catches the machine-checkable third every time — which is the third a human
 * review skips.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * The signed-in pages. `/run` and `/results` render the locked panel for this
 * account (it holds no subscription) — a real state, but not the screener. The
 * entitled table's CONTRAST is covered in `app-contrast.spec.ts`; extending this
 * scan to it is a follow-up, and saying so here is cheaper than letting the file
 * imply a coverage it does not have.
 */
const APP_PATHS = ['/stocks', '/stocks/us/AAPL', '/run', '/results', '/request', '/account'];

/** Pages carrying the deferred direction-colour debt. See the block at its use. */
const DEFERRED_CONTRAST_PAGES = new Set(['/stocks/us/AAPL']);
const DEFERRED_CONTRAST_CEILING = 45;

async function signIn(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', EMAIL!);
  await page.fill('input#password', PASSWORD!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/stocks/, { timeout: 30_000 });
}

async function scan(page: Page, path: string) {
  /* ⚠️ `page.emulateMedia`, NOT `test.use({ reducedMotion })` — the latter
     typechecks, runs, and silently does nothing at this Playwright version, which
     is the worst combination available. The public suite learned this the hard way
     when axe reported 175 phantom contrast violations against faded-in blocks. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path, { waitUntil: 'networkidle' });

  // Prove we are on the page we think we are: a signed-in route that started
  // bouncing to /login would otherwise scan clean and mean nothing.
  expect(new URL(page.url()).pathname, `${path} did not stay put`).toBe(path);

  // The app shell's own proof-of-stylesheet, matching app-contrast's sentinel:
  // <main> is offset by the sidebar width, which is 0 on an unstyled page.
  await page.waitForFunction(
    () => {
      const m = document.querySelector('main#main-content');
      return !!m && parseFloat(getComputedStyle(m).marginLeft) > 0;
    },
    undefined,
    { timeout: 30_000 },
  );

  return new AxeBuilder({ page }).withTags(TAGS).analyze();
}

test.describe('the signed-in product is accessible', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL + E2E_PASSWORD to run');
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const path of APP_PATHS) {
    test(`${path} has no axe violations`, async ({ page }) => {
      test.setTimeout(120_000);
      const results = await scan(page, path);

      // The control, first: a page that failed to render scores perfectly, so
      // prove the scan actually looked at something before believing it.
      expect(
        results.passes.length,
        `axe checked nothing on ${path} — the page did not render`,
      ).toBeGreaterThan(10);

      /* ⚠️ ONE bounded exemption, and it is a pending owner decision rather than a
         defect this suite may fix. The Stock Detail page renders the DIRECTION
         palette as text — "up" green and "neutral" gold on beat/miss, bullish and
         insider rows — which the owner explicitly scoped out of the 2026-08-22
         contrast work, because green-for-up is the convention every trading tool
         follows. `app-contrast.spec.ts` carries the same debt with the same
         reasoning and its own ceiling; see its DEFERRED_DIRECTION_COLOURS block for
         the argument and the two honest ways to retire it.

         Excluded from pass/fail but COUNTED, so it can neither grow silently nor
         quietly stop excusing anything (CLAUDE.md 14g). */
      const deferredHere = DEFERRED_CONTRAST_PAGES.has(path);
      const found = results.violations
        .filter((v) => !(deferredHere && v.id === 'color-contrast'))
        .map((v) => `[${v.impact}] ${v.id} — ${v.nodes.length} node(s): ${v.help}`);
      expect(found, `${path}:\n${found.join('\n')}`).toEqual([]);

      const contrast = results.violations.find((v) => v.id === 'color-contrast');
      if (deferredHere) {
        expect(
          contrast?.nodes.length ?? 0,
          `${path} has no deferred colour-contrast nodes left — delete the exemption`,
        ).toBeGreaterThan(0);
        expect(
          contrast!.nodes.length,
          `deferred colour-contrast nodes grew to ${contrast!.nodes.length} on ${path}`,
        ).toBeLessThanOrEqual(DEFERRED_CONTRAST_CEILING);
      }
    });
  }
});
