import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { LEARN_ARTICLES, learnPath } from '../lib/learn';

/**
 * Automated accessibility scan of the public site — axe-core, WCAG 2.1 A + AA.
 *
 * ⚠️ **Layer G MEASURES accessibility; Layer H FIXES it.** That split is
 * deliberate: the signed-in shell's contrast debt is a product-wide repaint that
 * G is not authorised to make (CLAUDE.md 11l — a real defect does not entitle
 * you to widen your scope). So this file scans the **public** pages, which Layer
 * G owns and has already brought to a clean state, and asserts they stay there.
 *
 * ⚠️ **A scan that reports without failing is not a guard.** The `[data-legacy-
 * contrast]` marker already in this repo is the pattern: known debt is excluded
 * from pass/fail but **counted**, so it can neither grow silently nor quietly
 * stop excusing anything. Here there is no debt to carry on the public pages —
 * the expected count is zero — which is the strongest form of the same rule.
 *
 * ⚠️ **Credential-free**, like the rest of the public specs: no login, so it
 * runs on a fork PR and cannot self-skip.
 *
 * ── What this does NOT cover, said out loud ─────────────────────────────────
 *
 * axe finds roughly a third of real accessibility problems. It cannot judge
 * whether alt text is *accurate*, whether a focus order is *sensible*, or
 * whether an error message is *useful*. It catches the machine-checkable third,
 * every time, which is exactly the third a human review skips.
 */

/** Every public page a signed-out reader can reach. */
const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/contact',
  '/learn',
  '/disclaimer',
  '/terms',
  '/privacy',
  '/login',
  '/signup',
  '/reset-password',
  // One article stands for the twelve — they share a template, and the sweep
  // below drives every one of them for the rules that CAN differ per page.
  learnPath(LEARN_ARTICLES[0]!.slug),
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * ⚠️ **Scanned with reduced motion, and that is a correctness decision rather
 * than a convenience.**
 *
 * The landing's below-fold blocks rest at `opacity: 0` until an
 * IntersectionObserver reveals them, and axe composites `opacity` — so it read
 * the three-step explainer as **#eaeff6 on #f1f4f8, a ratio of 1.04**, and
 * reported 20 serious contrast violations on a page whose colours are fine. No
 * reader ever meets that state: it is below the fold, it reveals on scroll, the
 * server renders the final state when JS never runs, and
 * `prefers-reduced-motion` forces `opacity: 1` outright.
 *
 * This is the mirror image of the defect in CLAUDE.md 11q, where our own probe
 * could not see `opacity` and scored invisible text as passing. Same lesson from
 * the other side: **measure the state a reader is actually in.** Reduced motion
 * is one of those states, it is the accessible one, and it is deterministic —
 * so it is the one the scan pins. The control below proves the text is really
 * on screen in that mode, rather than the scan passing because everything
 * vanished.
 *
 * ⚠️ **Set with `page.emulateMedia`, NOT `test.use({ reducedMotion })`.** The
 * `test.use` form silently did nothing here — `matchMedia('(prefers-reduced-
 * motion: reduce)')` still reported `false` — and a setting that fails silently
 * is worse than one that fails loudly: the scan kept reporting 175 contrast
 * violations and I spent a round believing the landing was broken. The control
 * asserts the media query is really on, so this can never quietly stop applying
 * again.
 */

async function scan(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  // ⚠️ Wait for something the PAGE promises, not for a timer: a scan that runs
  // against a half-rendered document reports a clean page it never looked at
  // (CLAUDE.md 11q — the contrast probe measured 47 elements of 291 this way).
  await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => {});

  /* ⚠️ **`networkidle` is not "the page is finished".** The first version of
     this file stopped there and went flaky: `/learn/what-is-a-drawdown` and the
     article sweep failed once and passed on the next run, which is the most
     ignorable result a suite can give and is exactly where real defects hide
     (CLAUDE.md 11i). The cause is that an article's figures are positioned from
     the reading type scale, so a scan that lands before the stylesheet computes
     measures labels at coordinates they will not keep.

     So wait on a POSITIVE signal the measurement itself depends on — the same
     `.reading` 17px sentinel `learn.spec.ts` uses — rather than on a proxy for
     readiness (11q). Pages without `.reading` skip it rather than time out. */
  const reading = page.locator('.reading').first();
  if (await reading.count()) {
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const el = document.querySelector('.reading');
            return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
          }),
        { message: 'the reading scale never computed, so figure geometry is not settled' },
      )
      .toBe(17);
  }

  /* ⚠️ NO EXCLUSIONS. There was one until 2026-08-22 — `[data-legacy-contrast]`,
     covering the landing's worked screener run, whose real score chips could not
     hold white text because three of the five tier colours were too light
     (Neutral at 2.38:1). It was correctly scoped as product-wide work rather than
     repainting a paid surface inside a landing-page change (CLAUDE.md 11l).

     The palette was fixed at its source with the owner's authorisation, so the
     exclusion is deleted rather than kept "just in case". Adding one back is a
     decision about what this guard is allowed to stop seeing — make it explicitly,
     with a control that proves it still covers exactly what it claims to, because
     an exemption that has outlived its defect excuses whatever moves under it
     next (14g). */
  return new AxeBuilder({ page }).withTags(TAGS).analyze();
}

test.describe('the public site is accessible', () => {
  for (const path of PUBLIC_PATHS) {
    test(`${path} has no axe violations`, async ({ page }) => {
      const results = await scan(page, path);

      // The control. A page that failed to render scores perfectly, so prove the
      // scan actually looked at something before believing a clean result.
      expect(
        results.passes.length,
        `${path}: axe checked almost nothing — the page probably did not render`,
      ).toBeGreaterThan(10);

      const detail = results.violations
        .map(
          (v) =>
            `  [${v.impact}] ${v.id}: ${v.help}\n` +
            v.nodes.slice(0, 3).map((n) => `      ${n.target.join(' ')}`).join('\n'),
        )
        .join('\n');
      expect(results.violations.map((v) => v.id), `${path}\n${detail}`).toEqual([]);
    });
  }

  test('the landing is genuinely VISIBLE in the mode this file scans', async ({ page }) => {
    /**
     * ⚠️ **The control for the reduced-motion scan, and it earns its place.**
     *
     * The landing arms a scroll reveal after hydration: eight sections drop to
     * `opacity: 0` and only come back as they enter the viewport. A scan that
     * never scrolls therefore measures text that is *legitimately* invisible,
     * and axe composites opacity — so it reports the whole page at ~1.0:1.
     * Reduced motion is what collapses that: `LandingMotion` marks every section
     * revealed immediately, so the scan sees the final state deterministically,
     * with no scrolling and no waiting on an observer.
     *
     * Which makes this file's result entirely dependent on the emulation being
     * ON. If it silently stopped applying, every element would go transparent,
     * axe would skip them as hidden, and this file would report a clean page it
     * had never looked at (CLAUDE.md 14g). That is not hypothetical — it is what
     * `test.use({ reducedMotion })` did here. So: assert the media query, assert
     * the reveals, and only then believe the scan.
     */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('main').first()).toBeVisible();
    await page.waitForLoadState('networkidle').catch(() => {});

    const state = await page.evaluate(() => {
      const rises = [...document.querySelectorAll('.lp [data-rise]')] as HTMLElement[];
      return {
        reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
        count: rises.length,
        faded: rises.filter((el) => parseFloat(getComputedStyle(el).opacity) < 1).length,
      };
    });

    expect(state.reduce, 'reduced-motion emulation is not applying — the scan above is blind').toBe(
      true,
    );
    expect(state.count, 'no reveal blocks found — the selector has drifted').toBeGreaterThan(3);
    expect(
      state.faded,
      `${state.faded} of ${state.count} sections are still transparent under reduced motion`,
    ).toBe(0);
  });

  test('the landing needs no exemption at all', async ({ page }) => {
    /**
     * ⚠️ This test used to assert the OPPOSITE — that the landing DOES violate,
     * and that every violating node sits inside `[data-legacy-contrast]`. That was
     * honest bookkeeping for a real, bounded debt: the worked screener run drew the
     * product's own score chips, three of the five tier colours could not hold
     * white text, and repainting a paid surface was not this layer's call.
     *
     * The palette was fixed on 2026-08-22, so the claim inverts. Keeping the old
     * assertion would have been worse than deleting it — it demanded that a
     * violation still exist, and would have gone red for the fix.
     *
     * ⚠️ Both halves still matter, which is why this is a test rather than nothing:
     * a clean scan proves the debt is paid, and a marker count of zero proves
     * nobody re-introduced the blindfold to make something else go quiet.
     */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('main').first()).toBeVisible();
    await page.waitForLoadState('networkidle').catch(() => {});

    const full = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const targets = full.violations.flatMap((v) =>
      v.nodes.map((n) => `${v.id} @ ${n.target.join(' ')}`),
    );
    expect(
      targets,
      'the landing has axe violations: ' + targets.join(' | '),
    ).toEqual([]);

    // The control: a scan that measured nothing also reports zero violations, so
    // prove it actually looked at the score chips this test exists for (14g).
    expect(
      full.passes.length,
      'axe found nothing to check — the page did not render',
    ).toBeGreaterThan(10);
    expect(
      await page.locator('.score-num, .score-tag').count(),
      'the worked screener run should still be drawing real score chips',
    ).toBeGreaterThan(20);

    expect(
      await page.locator('[data-legacy-contrast]').count(),
      'a contrast exemption marker is back — that is a new decision, not an inheritance',
    ).toBe(0);
  });

  test('every article passes, not just the one that stands for them', async ({ page }) => {
    test.setTimeout(300_000);
    const failures: string[] = [];
    for (const article of LEARN_ARTICLES) {
      const results = await scan(page, learnPath(article.slug));
      for (const v of results.violations) {
        failures.push(`${article.slug}: [${v.impact}] ${v.id} — ${v.nodes.length} node(s)`);
      }
    }
    expect(failures, `articles with axe violations:\n${failures.join('\n')}`).toEqual([]);
  });
});
