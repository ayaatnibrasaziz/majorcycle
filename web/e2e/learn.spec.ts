import { expect, test, type Page } from '@playwright/test';

import { LEARN_ARTICLES, LEARN_INDEX_PATH, LEARN_THEMES, learnPath } from '../lib/learn';

/**
 * The Learn library — `/learn` and `/learn/[slug]`.
 *
 * Credential-free browser tests: no login, no network beyond the dev server, so
 * they run on a fork PR and cannot self-skip.
 *
 * ── What is deliberately NOT here ────────────────────────────────────────────
 *
 * Canonical tags and sitemap membership are already covered, for free, by
 * `seo.spec.ts` — it loops over the indexable entries of `PUBLIC_PAGES`, and
 * every article path is derived into that list from the same registry this file
 * imports. Re-asserting them here would be a second copy of one check that can
 * only ever agree with itself.
 *
 * ── What IS here, and why each one is invisible ──────────────────────────────
 *
 * Every assertion below guards something that fails while looking completely
 * correct. That is the whole family of defects this repo keeps meeting:
 *
 *  1. **An article renders its shell and no body.** Heading, answer, disclaimer,
 *     footer — all present, and the middle simply missing. Nothing errors and it
 *     looks deliberate (CLAUDE.md 11j). Only enumerating the body can see it.
 *  2. **An unknown slug answers 200 with an empty page.** A soft-404 farm, which
 *     Google penalises harder than an honest 404, and which nobody browsing the
 *     site would ever encounter.
 *  3. **The disclaimer sinks below the fold.** CLAUDE.md #4/#12/#24 make this
 *     legal rather than aesthetic, and it is one over-long `answer` away from
 *     happening on any new article — written by somebody who will never run a
 *     375px viewport.
 *  4. **An article inherits the legal pages' 13px scale.** Both are documents in
 *     a card, so it would look plausible; it is simply the wrong decision copied
 *     from a page it was made for.
 */

const ARTICLE_PATHS = LEARN_ARTICLES.map((a) => learnPath(a.slug));

/** `.reading` computing to 17px proves the reading stylesheet has applied. */
async function ready(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const el = document.querySelector('.reading');
        return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
      }),
    )
    .toBe(17);
}

test.describe('the Learn library', () => {
  test('the registry is not empty', async () => {
    // The control for everything below. Every other test in this file loops over
    // ARTICLE_PATHS, so an empty registry would make all of them pass vacuously —
    // the shape of "unmeasurable counted as clean" (CLAUDE.md 14g).
    expect(LEARN_ARTICLES.length, 'no articles registered — every loop below is vacuous').toBeGreaterThan(0);
  });

  test('the index renders one band per NON-EMPTY topic, and names it', async ({ page }) => {
    // ⚠️ Named topics, not a count. This is the 11j failure mode: a band that
    // simply stops rendering leaves a page that looks entirely deliberate —
    // there is no gap, no error, nothing to notice. Only enumerating what
    // SHOULD be there can see it.
    //
    // The expectation is derived the same way the page derives it (topics with
    // at least one article), because an empty topic is filtered out ON PURPOSE:
    // a heading with nothing beneath it is a reader's first impression of an
    // abandoned site.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(LEARN_INDEX_PATH);
    await ready(page);

    const expected = LEARN_THEMES.filter((t) =>
      LEARN_ARTICLES.some((a) => a.theme === t.id),
    );
    const empty = LEARN_THEMES.filter((t) => !LEARN_ARTICLES.some((a) => a.theme === t.id));

    for (const theme of expected) {
      await expect(
        page.getByRole('heading', { name: theme.label, level: 2 }),
        `the "${theme.label}" band is missing`,
      ).toBeVisible();
    }
    for (const theme of empty) {
      await expect(
        page.getByRole('heading', { name: theme.label, level: 2 }),
        `"${theme.label}" has no articles and must not render an empty band`,
      ).toHaveCount(0);
    }

    // The control: without it, a page rendering NO bands would satisfy every
    // "must not be present" assertion above and pass.
    expect(expected.length, 'no topic has any article — the loop above is vacuous').toBeGreaterThan(0);
  });

  test('the reading time on the index matches the article that was written', async ({ page }) => {
    /**
     * ⚠️ `minutes` is a second copy of a fact about the body (CLAUDE.md 11k).
     * Edit the prose and the number stays put — still plausible, still specific,
     * quietly wrong, and nothing goes red. This is the only place the claim and
     * the thing it describes can be compared, because the bodies are React
     * components and there is no text to count until a browser renders them.
     *
     * ±2 minutes at 200 words per minute. Loose on purpose: reading speed is an
     * estimate and a tight bound would just teach the next person to edit the
     * assertion. What it catches is a body that doubled in length or was gutted.
     */
    for (const article of LEARN_ARTICLES) {
      await page.goto(learnPath(article.slug));
      await ready(page);

      const words = await page.evaluate(() => {
        const body = document.querySelector('[data-article-body]') as HTMLElement | null;
        return body ? body.innerText.trim().split(/\s+/).length : 0;
      });

      expect(words, `${article.slug}: no body text to measure`).toBeGreaterThan(0);
      const measured = Math.max(1, Math.round(words / 200));
      expect(
        Math.abs(measured - article.minutes),
        `${article.slug}: the index says ${article.minutes} min, the body measures ~${measured} min (${words} words)`,
      ).toBeLessThanOrEqual(2);
    }
  });

  test('the index links to every registered article, and nothing else', async ({ page }) => {
    await page.goto(LEARN_INDEX_PATH);
    await ready(page);

    const hrefs = await page
      .locator('main a[href^="/learn/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')!));

    for (const path of ARTICLE_PATHS) {
      expect(hrefs, `${path} is registered but the index does not link to it`).toContain(path);
    }
    // …and the reverse. A link to an article that no longer exists is a 404 the
    // owner would only find by clicking it.
    for (const href of hrefs) {
      expect(ARTICLE_PATHS, `the index links to ${href}, which is not in the registry`).toContain(href);
    }
  });

  for (const path of ARTICLE_PATHS) {
    test(`${path} renders a real body, not just the template`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} status`).toBe(200);
      await ready(page);

      // The heading, the answer and the disclaimer all come from the TEMPLATE —
      // they would render for an article whose body is missing entirely. The body
      // is the only thing that proves content exists, so it is what gets counted.
      const headings = page.locator('article h2');
      await expect(headings, `${path} has no body sections at all`).not.toHaveCount(0);

      const words = await page
        .locator('article p')
        .evaluateAll((els) => els.map((e) => e.textContent ?? '').join(' ').trim().split(/\s+/).length);
      // A floor, not a target. An article shorter than this is a stub, and a stub
      // that ranks is worse than no page — it teaches a reader we have nothing.
      expect(words, `${path} is only ${words} words — that is a stub, not an answer`).toBeGreaterThan(250);
    });

    test(`${path} has no words run together by a lost JSX space`, async ({ page }) => {
      /**
       * ⚠️ A real defect, found on this article and invisible to every other
       * check here. The rendered DOM read **"81.4%is not a company"** while the
       * source unambiguously had a space (verified with `od -c` before changing
       * anything). JSX drops whitespace between an expression and the following
       * text in some arrangements — and the *identical* construction two lines
       * above survived, so the rule is arrangement-sensitive and reading the
       * source proves nothing.
       *
       * This matters more here than anywhere else on the site: article bodies
       * interleave prose with `{…}` figures from the snapshot on almost every
       * line, so it is the one place the mistake is easy to make, and it lands
       * on the pages a stranger judges us by. It renders, it looks like a typo
       * rather than a bug, and nobody reports it.
       */
      await page.goto(path);
      await ready(page);

      const runOns = await page.evaluate(() => {
        // ⚠️ `innerText`, NOT `textContent`. `textContent` concatenates block
        // elements with no separator, so the end of the date line butts straight
        // against the start of the answer — "…15 August 2026A drawdown is…" —
        // and the scan reported three run-ons that no reader could ever see.
        // `innerText` inserts the line breaks layout actually produces, which is
        // the thing being asserted: what the page reads like, not how the nodes
        // happen to be nested.
        const text = (document.querySelector('article') as HTMLElement).innerText ?? '';
        const out: string[] = [];
        // A digit or % butted against a letter, or a letter against a digit —
        // the two shapes a swallowed space around an interpolated number makes.
        const re = /[0-9%](?=[A-Za-z])|[a-z](?=[0-9])/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          out.push(text.slice(Math.max(0, m.index - 30), m.index + 24));
        }
        return out;
      });

      expect(runOns, `${path}: words run together — ${runOns.join(' | ')}`).toEqual([]);
    });

    test(`${path} keeps the not-financial-advice notice above the fold`, async ({ page }) => {
      // 375px, where the fold is highest — if it clears here it clears everywhere.
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await ready(page);

      // Scoped to the article. The shared footer carries the SAME sentence on
      // every public page, and an unscoped match would find it at the bottom of
      // the document — precisely the placement this test forbids. A guard that
      // can be satisfied by the thing it guards against is worse than no guard.
      const notice = page.locator('article').getByText('Information only — not financial advice.');
      await expect(notice).toBeVisible();
      const box = (await notice.boundingBox())!;
      const vh = await page.evaluate(() => window.innerHeight);
      expect(box.y + box.height, `${path}: the disclaimer ends below the fold at 375px`).toBeLessThanOrEqual(vh);
    });
  }

  test('the index keeps its disclaimer above the fold too', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(LEARN_INDEX_PATH);
    await ready(page);

    const notice = page.getByText('Information only — not financial advice.').first();
    const box = (await notice.boundingBox())!;
    const vh = await page.evaluate(() => window.innerHeight);
    expect(box.y + box.height, 'the index disclaimer ends below the fold at 375px').toBeLessThanOrEqual(vh);
  });

  test('an unregistered slug shows the not-found page, never a blank article', async ({ page }) => {
    await page.goto('/learn/this-article-does-not-exist');
    // What the READER gets. This half is correct today and is the half that
    // matters for anyone who mistypes a URL or follows a stale link.
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    // A rendered article template with no content would look like a real page.
    await expect(page.locator('[data-article-body]')).toHaveCount(0);
  });

  test('an unregistered slug answers 404, not 200', async ({ page }) => {
    /**
     * ⚠️ **EXPECTED TO FAIL TODAY — this is a recorded defect, not a broken test.**
     *
     * `notFound()` runs, the not-found page renders, and the response is still
     * **200**. That is a soft-404: Google treats a 200 carrying "Page not found"
     * far more harshly than an honest 404, and on the layer whose entire purpose
     * is SEO it is the wrong way round.
     *
     * **Cause, established by control experiment on a production build
     * (2026-08-15) rather than guessed.** The root `app/loading.tsx` wraps every
     * route in a Suspense boundary, so the shell is flushed before the page
     * finishes — and once bytes are on the wire the status is already committed,
     * leaving Next to swap the not-found content in afterwards. Measured:
     *
     *     with    app/loading.tsx  → /learn/does-not-exist  200
     *     without app/loading.tsx  → /learn/does-not-exist  404   ← same build otherwise
     *
     * The control that makes it a real finding rather than a guess:
     * `/.well-known/nothing-here` returns a true **404** on the same server, so
     * 404s do survive the middleware. It is the streaming, not the proxy.
     *
     * ⚠️ **This is GA-1's second symptom, and it is worse than the first.** GA-1
     * was filed as low severity because Googlebot executes JavaScript, so the
     * "Loading…" problem does not affect indexing. This one does: it applies to
     * EVERY `notFound()` on the site, not only to Learn.
     *
     * **Left failing on purpose.** The fix — scoping `loading.tsx` to the `(app)`
     * group — changes how every page on the site loads, which GA-1 already
     * records as the owner's architectural call. Deleting this test would bury
     * the finding; asserting 200 would bless it. `test.fail()` keeps the real
     * expectation in the suite, keeps the run green, and turns RED the moment
     * somebody fixes it — at which point delete this annotation.
     */
    test.fail();
    const res = await page.goto('/learn/this-article-does-not-exist');
    expect(res?.status(), 'an unknown slug must 404, not answer 200 with an empty shell').toBe(404);
  });

  test('the answer stays short enough to be an answer', async () => {
    // ⚠️ This is an EDITORIAL rule enforced mechanically, and it exists because of
    // the test above it. The disclaimer sits directly under the answer, so the
    // only thing that can push it below a 375px fold is an answer that has grown
    // into an essay. Capping it here means a future article fails on the rule
    // itself with a clear message, rather than failing the fold test with a
    // geometry error that names nothing.
    for (const article of LEARN_ARTICLES) {
      expect(
        article.answer.length,
        `${article.slug}: the answer is ${article.answer.length} characters. It renders directly above the disclaimer, so it has to stay an answer — split the detail into the body.`,
      ).toBeLessThanOrEqual(320);
      // The other side. A one-line answer that restates the title answers nothing,
      // and a bound on one side only tests the direction that was never the risk.
      expect(article.answer.length, `${article.slug}: the answer is too short to be one`).toBeGreaterThan(80);
    }
  });

  test('the Learn pages share ONE type scale with every other public page', async ({ page }) => {
    /**
     * ⚠️ **This assertion is the REVERSE of the one it replaces, and the reversal
     * is the finding.** The first version asserted that an article uses
     * `.reading`'s 17px body while the legal documents stay at 13px — arguing an
     * article is read top to bottom and a legal page is scanned. Sound in the
     * abstract; measured on the built pages it had produced a **fourth type
     * scale** on the public site:
     *
     *     /learn, /learn/[slug]   h1 36  h2 26  lead 20
     *     /terms                  h1 24  h2 17  body 13
     *     /contact, /pricing      h1 24
     *     /                       h1 50  h2 34   ← marketing, deliberate
     *
     * Crossing from `/contact` into `/learn` was a 50% jump in heading size for
     * no reason a reader could perceive. Both Learn surfaces now wear
     * `doc-scale`, the class the legal documents use.
     *
     * Compared page-to-page rather than against hard-coded numbers: the point is
     * that these surfaces AGREE, so the test must fail if any one of them moves,
     * not merely if it stops matching a literal typed here.
     */
    await page.setViewportSize({ width: 1280, height: 900 });

    const h1 = () => page.evaluate(() => getComputedStyle(document.querySelector('main h1')!).fontSize);

    await page.goto('/terms');
    await ready(page);
    const legal = {
      h1: await h1(),
      h2: await page.evaluate(() => getComputedStyle(document.querySelector('article section h2')!).fontSize),
      body: await page.evaluate(() => getComputedStyle(document.querySelector('article section p')!).fontSize),
    };

    await page.goto(LEARN_INDEX_PATH);
    await ready(page);
    const index = {
      h1: await h1(),
      h2: await page.evaluate(() => getComputedStyle(document.querySelector('main h2')!).fontSize),
    };

    await page.goto(ARTICLE_PATHS[0]!);
    await ready(page);
    const article = {
      h1: await h1(),
      h2: await page.evaluate(() => getComputedStyle(document.querySelector('[data-article-body] h2')!).fontSize),
      body: await page.evaluate(() => getComputedStyle(document.querySelector('[data-article-body] p')!).fontSize),
    };

    await page.goto('/contact');
    const form = { h1: await h1() };

    expect(index.h1, 'the Learn index heading has drifted from /terms').toBe(legal.h1);
    expect(article.h1, 'the article heading has drifted from /terms').toBe(legal.h1);
    expect(form.h1, 'the auth card heading has drifted from /terms').toBe(legal.h1);
    expect(index.h2, 'the Learn index section heading has drifted').toBe(legal.h2);
    expect(article.h2, 'the article section heading has drifted').toBe(legal.h2);
    expect(article.body, 'the article body has drifted from /terms').toBe(legal.body);

    // The control. Four surfaces agreeing proves nothing if they agree because
    // the stylesheet never loaded and everything is the 16px UA default — the
    // exact "unmeasurable counted as clean" failure in CLAUDE.md 14g. These are
    // the real values, so a page rendering unstyled fails here rather than
    // sailing through a chain of equalities.
    expect(legal.h1, 'nothing is styled — every comparison above is vacuous').toBe('24px');
    expect(legal.body, 'nothing is styled — every comparison above is vacuous').toBe('13px');
  });

  test('Learn pages get the full public header, not the confinement chrome', async ({ page }) => {
    // `showsFullChrome()` asks `OPEN_TO_STRANGERS.has(pathname)` — an EXACT match
    // against PUBLIC_PAGES. An article path reaches that set only because
    // lib/seo.ts spreads the registry; drop that spread and every article
    // silently renders the logo-only header used for the two session-confined
    // pages. Nothing errors, and the page keeps working (CLAUDE.md 11c-iv is the
    // same defect in the footer).
    for (const path of [LEARN_INDEX_PATH, ARTICLE_PATHS[0]!]) {
      await page.goto(path);
      await ready(page);
      await expect(
        page.locator('[data-public-header] a[href="/pricing"]'),
        `${path} is missing the public nav — it fell back to the confinement chrome`,
      ).toBeVisible();
    }
  });
});
