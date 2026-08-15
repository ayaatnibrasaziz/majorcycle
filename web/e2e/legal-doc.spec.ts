import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

/** The document's own body size (--pub-body) means the stylesheet has applied. */
async function ready(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => getComputedStyle(document.querySelector('article')!).fontSize),
    )
    .toBe('13px');
}

/**
 * `ready()` is not enough to MEASURE TEXT. It proves the stylesheet applied; it
 * proves nothing about the two things a character count actually depends on —
 * that the column has taken its width, and that the real font is rendering.
 *
 * ⚠️ This exists because CI caught what four local runs did not. The character
 * count came back **430** on `/disclaimer` and `/terms` — the whole paragraph on
 * one line, i.e. the loop never found a wrap — and passed on retry. Green run, 2
 * flaky, and by this repo's own rule that is a finding rather than noise. Local
 * has 8 cores and a warm cache; CI has 2 and compiles cold, so the page was
 * being measured a beat earlier than anything here reproduces.
 *
 * So the precondition is stated explicitly rather than hoped for: fonts loaded
 * (metrics come from the real face, not the fallback) and the article actually
 * clamped to `--measure-doc`. Neither weakens the assertion — the guard still
 * reports 89 characters when the column is widened back to 680.
 */
async function laidOut(page: Page): Promise<void> {
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const article = document.querySelector('article');
        if (!article) return false;
        const max = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--measure-doc'),
        );
        return Math.round(article.getBoundingClientRect().width) <= max;
      }),
    )
    .toBe(true);
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
        // Against the TOKEN, not a literal — `--measure-doc` is where the column
        // is chosen, so this cannot drift from it.
        const measure = await page.evaluate(() =>
          parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--measure-doc')),
        );
        expect(artW, `${path} at ${width}px is ${artW}px wide`).toBeLessThanOrEqual(measure);
        // CLAUDE.md #3 — no horizontal scroll on a phone.
        expect(scrollW, `${path} scrolls sideways at ${width}px`).toBeLessThanOrEqual(clientW);
      }
    });

    test(`${path} keeps its lines inside the readable band`, async ({ page }) => {
      // ⚠️ The pixel width above is NOT this assertion. A column can be the right
      // number of pixels and the wrong number of CHARACTERS, which is what the
      // eye actually cares about — and that is exactly what happened here: the
      // 680px column was correct at 17px body and became **91 characters** the
      // moment the body dropped to 13px, because smaller letters mean more of
      // them per line. Nothing about the width had changed.
      //
      // So measure the real thing: how many characters fit on the first visual
      // line of a real paragraph. 45-75 is the long-established readable band.
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(path);
      await laidOut(page);

      const m = await page.evaluate(() => {
        const range = document.createRange();

        // ⚠️ THE MEASURED NODE MUST START A LINE. This is the precondition the
        // first version left implicit, and /privacy broke it on 2026-08-15 the
        // moment a clause opened with a bold lead-in:
        //
        //     <p><strong>Where your information is stored.</strong> These …</p>
        //
        // The old code took the first child text node over 60 characters — here
        // the run AFTER the </strong>, which begins **221px into** the paragraph.
        // Counting to the wrap from there measures what was left of line one, not
        // the line: it reported **39 characters in a 494px column** and failed the
        // lower bound. The column was never wrong. Every paragraph on that page
        // that does start at the left edge measured 72-76.
        //
        // So the requirement is stated and checked rather than assumed: a
        // characters-per-line count is only valid measured from a line start.
        // Candidates that begin mid-line are skipped, not measured — and if a
        // page ever offers nothing else, `startsLine` comes back false and the
        // assertion below names that instead of reporting a bogus number.
        const startsLine = (para: Element, node: ChildNode): boolean => {
          range.setStart(node, 0);
          range.setEnd(node, 1);
          const first = range.getBoundingClientRect();
          // The content-box left edge. `getBoundingClientRect()` on the <p>
          // includes padding, which is 0 here, but read the computed value
          // rather than relying on that staying true.
          const box = para.getBoundingClientRect();
          const padLeft = parseFloat(getComputedStyle(para).paddingLeft) || 0;
          return Math.abs(first.left - (box.left + padLeft)) <= 1;
        };

        let skippedMidLine = 0;

        for (const para of document.querySelectorAll('article section p')) {
          if ((para.textContent ?? '').trim().length <= 110) continue;

          for (const node of para.childNodes) {
            if (node.nodeType !== 3) continue;
            const text = node.textContent ?? '';
            if (text.trim().length <= 60) continue;
            if (!startsLine(para, node)) {
              skippedMidLine += 1;
              continue;
            }

            const width = Math.round(para.getBoundingClientRect().width);
            // Walk a Range one character at a time; the first index that produces
            // a second client rect is the first index that wrapped.
            for (let i = 1; i <= text.length; i++) {
              range.setStart(node, 0);
              range.setEnd(node, i);
              if (range.getClientRects().length > 1) {
                return { cpl: i - 1, wrapped: true, width, skippedMidLine };
              }
            }
            // Reaching here means the paragraph never wrapped at all. Reported as
            // its own fact rather than as "cpl = the whole paragraph": the two
            // have completely different causes, and the number alone sent me
            // looking for a column-width bug when the real answer was "measured
            // too early".
            return { cpl: text.length, wrapped: false, width, skippedMidLine };
          }
        }
        return null;
      });

      expect(
        m,
        `${path}: no paragraph both long enough AND starting at the column's left edge`,
      ).not.toBeNull();
      expect(
        m!.wrapped,
        `${path}: the paragraph never wrapped — ${m!.cpl} chars in a ${m!.width}px column, so it was measured before layout settled`,
      ).toBe(true);
      // The width is in the message on purpose. The first version reported only
      // "runs 430 characters per line", which names the symptom and hides the
      // cause; "430 chars in a 2000px column" would have been unambiguous.
      expect(m!.cpl, `${path} runs ${m!.cpl} chars in a ${m!.width}px column`).toBeLessThanOrEqual(75);
      // The control: a column so narrow that it breaks every few words would
      // satisfy the bound above, and is just as unreadable.
      expect(m!.cpl, `${path} runs only ${m!.cpl} chars in a ${m!.width}px column`).toBeGreaterThanOrEqual(45);
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

test.describe('the public pages share ONE set of sizes', () => {
  /**
   * ⚠️ This is the guard for a duplication, not for a look.
   *
   * `--pub-title` (24px) and `--pub-body` (13px) were hand-typed inside
   * `AuthCard.tsx` while the legal documents declared the same two numbers as
   * tokens. Both were correct, so nothing was visibly wrong — and that is the
   * failure mode: the day somebody edits one, the sign-in card and the terms
   * page quietly stop matching, each looking perfectly fine on its own. It is
   * the same shape as every 11c incident in CLAUDE.md.
   *
   * `AuthCard` now consumes the tokens, and this measures BOTH surfaces in a
   * real browser and fails if they disagree. Asserting the CSS variable alone
   * would prove nothing: a stray utility, a typo'd `var(--pub-bdy)` silently
   * resolving to nothing, or a specificity accident all leave the token correct
   * and the pixels wrong.
   */
  const authTypes = (page: Page) =>
    page.evaluate(() => {
      const h1 = document.querySelector('main h1')!;
      return {
        title: getComputedStyle(h1).fontSize,
        body: getComputedStyle(h1.parentElement!.querySelector('p')!).fontSize,
      };
    });

  const docTypes = (page: Page) =>
    page.evaluate(() => ({
      title: getComputedStyle(document.querySelector('article h1')!).fontSize,
      body: getComputedStyle(document.querySelector('article section p')!).fontSize,
    }));

  test('an auth card and a legal document agree on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/contact');
    const auth = await authTypes(page);
    await page.goto('/terms');
    await ready(page);
    const doc = await docTypes(page);

    expect(auth.title, 'the auth card title moved').toBe('24px');
    expect(doc.title, 'the document title moved').toBe(auth.title);
    expect(auth.body, 'the auth card body moved').toBe('13px');
    expect(doc.body, 'the document body moved').toBe(auth.body);
  });

  test('the auth card keeps its 22px step on a phone, and the document does not', async ({
    page,
  }) => {
    // The trap this exists for: `--pub-title` is 24px, and swapping AuthCard's
    // `text-[22px] sm:text-[24px]` for the token in one step would have GROWN
    // every form title on mobile by 2px. Nobody would have reported it and
    // nothing was watching. Hence `--pub-title-sm`, and hence this test.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/contact');
    expect((await authTypes(page)).title, 'the phone step-down is gone').toBe('22px');

    await page.goto('/terms');
    await ready(page);
    expect((await docTypes(page)).title, 'the document should not step down').toBe('24px');
  });
});

test.describe('the promises in the legal pages match the running code', () => {
  /**
   * ⚠️ These three numbers are LEGAL CLAIMS, and each of them now lives in two
   * places: a constant the product enforces, and a sentence a customer relies on.
   *
   *   FREE_VIEW_DAILY_LIMIT      25  → Terms, "Free accounts"
   *   ACCOUNT_DELETION_GRACE_DAYS 30 → Privacy, "Data retention"
   *   GRACE_DAYS                  3  → Terms, "Payment and refunds"
   *
   * They were written into the pages on 2026-08-15 (legal audit, findings 5, 3
   * and 7) precisely BECAUSE we were enforcing terms we had never stated. The
   * failure mode from here is the mirror image: someone tunes a constant, ships
   * it, and the published page becomes a false statement about what we do. No
   * test fails, no page errors, nothing looks wrong — the sentence is still
   * fluent and specific and simply no longer true. That is CLAUDE.md 11k, and a
   * legal page is the worst surface on the site to have it happen on.
   *
   * So the assertion is built FROM the constant and checked against the RENDERED
   * page — not against the source, which 14d taught us can be correct while the
   * screen is wrong.
   *
   * ⚠️ **Each constant is READ OUT OF ITS SOURCE FILE, never imported**, and that
   * is not laziness. The first version of this block did `import
   * { FREE_VIEW_DAILY_LIMIT } from '../lib/freeViews'`, which typechecked and
   * linted clean and then **took the whole suite down** — not this test, the
   * entire run — with `Cannot find module 'server-only'`, because `freeViews.ts`
   * is a server module and Playwright is plain Node:
   *
   *     Error: Cannot find module 'server-only'
   *     Require stack: … lib\freeViews.ts ← e2e\legal-doc.spec.ts
   *
   * These specs are required to be pure and credential-free so they run on a fork
   * PR (see the file header), and importing app code reaches straight past that.
   * `GRACE_DAYS` could not have been imported in any case — it is module-local
   * inside the Stripe webhook route.
   *
   * The cost of reading source text is that a rename becomes a silent no-match, so
   * every extraction asserts it actually matched. A guard that quietly stops
   * finding anything is worse than no guard (14g).
   */
  const constantFrom = (relPath: string, name: string): number => {
    const src = readFileSync(join(__dirname, '..', relPath), 'utf8');
    // ⚠️ The lookbehind is load-bearing, and it is here because breaking this on
    // purpose caught it. Renaming `GRACE_DAYS` → `DUNNING_GRACE_DAYS` should have
    // gone red and did NOT: a bare `GRACE_DAYS = (\d+)` is a **substring** of
    // `DUNNING_GRACE_DAYS = 3`, so the guard cheerfully matched the renamed
    // constant and reported success. `ACCOUNT_DELETION_GRACE_DAYS` would have
    // collided the same way had it lived in the same file.
    const m = new RegExp(`(?<![A-Za-z0-9_])${name} = (\\d+)`).exec(src);
    expect(m, `${name} was renamed or moved in ${relPath} — this guard is now blind`).not.toBeNull();
    return Number(m![1]);
  };

  const freeViewDailyLimit = () => constantFrom('lib/freeViews.ts', 'FREE_VIEW_DAILY_LIMIT');
  const deletionGraceDays = () => constantFrom('lib/account.ts', 'ACCOUNT_DELETION_GRACE_DAYS');
  const dunningGraceDays = () => constantFrom('app/api/stripe/webhook/route.ts', 'GRACE_DAYS');

  const bodyText = async (page: Page, path: string): Promise<string> => {
    await page.goto(path);
    await ready(page);
    return (await page.locator('article').innerText()).replace(/\s+/g, ' ');
  };

  test('the Terms state the free daily cap the product enforces', async ({ page }) => {
    const cap = freeViewDailyLimit();
    const text = await bodyText(page, '/terms');
    expect(text, `Terms do not state FREE_VIEW_DAILY_LIMIT = ${cap}`).toContain(
      `up to ${cap} new stocks per day`,
    );
    // The control. Without it a page that happened to contain any number would
    // look fine; this proves the match is sensitive to the VALUE, which is the
    // only part that can drift.
    expect(text, 'the cap sentence is not keyed to the constant').not.toContain(
      `up to ${cap + 1} new stocks per day`,
    );
  });

  test('the Terms state the payment-failure grace the webhook grants', async ({ page }) => {
    const days = dunningGraceDays();
    const text = await bodyText(page, '/terms');
    expect(text, `Terms do not state GRACE_DAYS = ${days}`).toContain(
      `keep your access open for ${days} days`,
    );
    expect(text, 'the grace sentence is not keyed to the constant').not.toContain(
      `keep your access open for ${days + 1} days`,
    );
  });

  test('the Privacy Policy states the deletion window the purge cron uses', async ({ page }) => {
    const days = deletionGraceDays();
    const text = await bodyText(page, '/privacy');
    expect(text, `Privacy does not state ACCOUNT_DELETION_GRACE_DAYS = ${days}`).toContain(
      `permanently delete it after ${days} days`,
    );
    expect(text, 'the deletion window is not keyed to the constant').not.toContain(
      `permanently delete it after ${days + 1} days`,
    );
  });

  test('the Privacy Policy discloses the third party whose email we collect', async ({ page }) => {
    // Finding 1. Not a number, but the same class of silent failure: delete this
    // bullet and nothing breaks — APP 5 is simply no longer discharged, on the
    // only personal information we hold about someone who never visited the site.
    const text = await bodyText(page, '/privacy');
    expect(text, 'the refer-a-friend collection disclosure is gone').toContain(
      'when you refer a friend',
    );
    // Finding 2 — APP 8. The single most likely point of a privacy complaint.
    expect(text, 'the cross-border storage disclosure is gone').toContain(
      'Where your information is stored',
    );
  });
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
