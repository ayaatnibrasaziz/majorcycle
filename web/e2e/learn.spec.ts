import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

    // A topic earns a band if it has something to show — a written article OR an
    // announced one. Only a topic with neither is suppressed.
    const has = (t: (typeof LEARN_THEMES)[number]) =>
      LEARN_ARTICLES.some((a) => a.theme === t.id) || (t.upcoming?.length ?? 0) > 0;
    const expected = LEARN_THEMES.filter(has);
    const empty = LEARN_THEMES.filter((t) => !has(t));

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

  test('an announced article is named, but is not a link and has no page', async ({ page }) => {
    /**
     * "Coming soon" rows are a promise to a stranger, and the failure mode is
     * that a promise quietly becomes a URL. If one of these titles ever gains a
     * link — by being promoted into the registry, or by somebody wrapping the
     * row in an <a> to make it "consistent" — the reader gets a dead end, and
     * `robots`/`sitemap` get an entry for a page with nothing on it.
     *
     * ⚠️ The control matters as much as the assertion. `upcoming` being empty
     * would satisfy every "must not be a link" check in this test while proving
     * nothing at all (CLAUDE.md 14g), so the count is asserted first.
     */
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(LEARN_INDEX_PATH);
    await ready(page);

    const announced = LEARN_THEMES.flatMap((t) => t.upcoming ?? []);
    expect(announced.length, 'nothing is announced — every check below is vacuous').toBeGreaterThan(0);

    for (const title of announced) {
      // Named on the page, so the promise is actually being made…
      await expect(
        page.getByText(title, { exact: true }),
        `announced title "${title}" is not on the page`,
      ).toBeVisible();

      // …and inert. `getByRole('link')` finds it only if it is genuinely
      // reachable as a link, which is the thing that must never be true.
      await expect(
        page.getByRole('link', { name: title, exact: true }),
        `"${title}" has become a link, but no article exists behind it`,
      ).toHaveCount(0);

      // And it must not have leaked into the registry, which is what would give
      // it a route, a canonical tag and a sitemap row.
      expect(
        LEARN_ARTICLES.some((a) => a.title === title),
        `"${title}" is both announced and registered — it can only be one`,
      ).toBe(false);
    }

    // The count pill must never advertise more than a reader can actually read.
    for (const theme of LEARN_THEMES) {
      const written = LEARN_ARTICLES.filter((a) => a.theme === theme.id).length;
      if (written === 0) continue;
      await expect(
        page.getByText(`${written} ${written === 1 ? 'article' : 'articles'}`, { exact: true }).first(),
        `the "${theme.label}" pill does not state its ${written} readable article(s)`,
      ).toBeVisible();
    }
  });

  test('a band without a picture takes the whole column back', async ({ page }) => {
    /**
     * ⚠️ Found on 2026-08-16 by opening the page, after `learn.ts` had claimed
     * the opposite in a comment since the file was written.
     *
     * `image` is optional, and the intent is that a topic without one degrades
     * to a plain text block. It did not. The band declared its two-column track
     * unconditionally, so an imageless topic still got both columns and its text
     * landed in the FIRST: measured at 1280px, a 532px column with **588px of
     * empty page** beside it. Nothing errored, typecheck was green, and at any
     * width below 1024px it looked perfect — an absent grid child is not a
     * fault, it is a hole, and a hole renders.
     *
     * ⚠️ Note what this test can and cannot reach today, because pretending
     * otherwise is 14g. The defect needs a topic that has articles AND no
     * picture, and no such topic is currently rendered — so the measured half
     * below exercises only the WITH-picture case. The structural half is
     * therefore not decoration: it is the only thing standing between the fix
     * and a silent revert, until the second topic gets both its articles and its
     * artwork. Delete it then, not before.
     */
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(LEARN_INDEX_PATH);
    await ready(page);

    const bands = await page.evaluate(() =>
      [...document.querySelectorAll('section.grid')].map((s) => {
        const heading = s.querySelector('h2')?.textContent?.trim() ?? '(unnamed)';
        const band = s.getBoundingClientRect();
        const text = [...s.children].find((c) => c.querySelector('h2'))?.getBoundingClientRect();
        return {
          heading,
          hasImage: !!s.querySelector('img'),
          bandWidth: Math.round(band.width),
          textWidth: text ? Math.round(text.width) : 0,
          gapToRight: text ? Math.round(band.right - text.right) : 0,
        };
      }),
    );

    expect(bands.length, 'no bands rendered — every assertion below is vacuous').toBeGreaterThan(0);

    for (const b of bands) {
      if (b.hasImage) {
        // Two columns: the text is roughly half the band and the picture holds
        // the rest, so a gap on the right is correct here.
        expect(
          b.textWidth / b.bandWidth,
          `"${b.heading}" has a picture but its text is not sharing the band`,
        ).toBeLessThan(0.75);
      } else {
        // One column, held to the header's own 720px measure. The bound is the
        // measure plus slack, and the real assertion is the second one: an
        // imageless band must not strand half the page.
        expect(
          b.textWidth,
          `"${b.heading}" has no picture and should hold the 720px measure`,
        ).toBeLessThanOrEqual(760);
        expect(
          b.gapToRight,
          `"${b.heading}" has no picture but left ${b.gapToRight}px of empty column beside its text`,
        ).toBeLessThanOrEqual(b.bandWidth - b.textWidth - 340);
      }
    }
  });

  test('the two-column track is conditional on the picture, in the source', async () => {
    // The structural half of the test above, and the only half that can see the
    // defect while no imageless band is rendered. Comments are STRIPPED first:
    // the paragraph documenting this fix names the class it is about, and a
    // guard that passes on its own explanation guards nothing (CLAUDE.md 11c-iv).
    const src = readFileSync(join(__dirname, '..', 'app', '(public)', 'learn', 'page.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const uses = [...src.matchAll(/lg:grid-cols-/g)];
    expect(uses.length, 'the band no longer declares a multi-column track at all').toBeGreaterThan(0);

    for (const m of uses) {
      // Look back over the enclosing expression rather than matching an exact
      // shape — the rule is "the track is governed by the picture", and a guard
      // that names one spelling of it just breaks on the next refactor (11i-b).
      const before = src.slice(Math.max(0, m.index - 200), m.index);
      expect(
        before,
        'the two-column track is declared unconditionally — an imageless topic will keep the empty second column',
      ).toMatch(/theme\.image/);
    }
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

      /**
       * ⚠️ The regex above only knows the shape it was written for — a digit or
       * `%` butted against a letter, which is what a swallowed space around an
       * interpolated NUMBER looks like. On 2026-08-19 the owner found
       * **"normally fall?Its average"** on this page: a letter against a letter,
       * from a lost space after `</strong>`, and the guard was green the whole
       * time. Silent, not clean (CLAUDE.md 14g).
       *
       * So scan the boundary itself rather than guessing at the text. For every
       * inline element, look at the text node on each side and flag a join that
       * no punctuation explains — which is exactly what a dropped JSX space is,
       * and it holds whatever characters happen to sit either side of it.
       *
       * Note the source proves nothing here: `od -c` showed a real space, and
       * the *identical* construction in the sibling list item rendered fine.
       * Only the DOM can answer this.
       */
      const joined = await page.evaluate(() => {
        const root =
          document.querySelector('[data-article-body]') ?? document.querySelector('article');
        if (!root) return ['no article body found'];
        // Characters that may legitimately hug the element on either side.
        // ⚠️ An em or en DASH is not in this list, and that is a finding. It was,
        // as "punctuation may legitimately hug" — and on 2026-08-19 the owner's
        // screenshot showed **"an index— the S&P 500"**, a space dropped after
        // `</strong>` that this guard had explicitly permitted. In this house
        // style a dash is always spaced, so a dash against a word is exactly the
        // defect, never the intent. A guard's allow-list is a claim about the
        // design system, and this one was inherited from generic punctuation
        // rules rather than from ours.
        const okAfter = /^[\s.,;:!?)\]’”%/-]/;
        const okBefore = /[\s(\[‘“$£€/-]$/;
        const out: string[] = [];
        for (const el of root.querySelectorAll('strong,em,a,code,b,i,abbr')) {
          const next = el.nextSibling;
          const prev = el.previousSibling;
          if (next?.nodeType === 3 && next.textContent && !okAfter.test(next.textContent)) {
            out.push(`${el.textContent?.slice(-24)}❘${next.textContent.slice(0, 24)}`);
          }
          if (prev?.nodeType === 3 && prev.textContent && !okBefore.test(prev.textContent)) {
            out.push(`${prev.textContent.slice(-24)}❘${el.textContent?.slice(0, 24)}`);
          }
        }
        return out;
      });

      expect(
        joined,
        `${path}: an inline element is joined to its neighbour with no space — ${joined.join(' | ')}`,
      ).toEqual([]);
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
     * ⚠️ **This was `test.fail()` — a recorded soft-404 — until 2026-08-18.**
     *
     * `notFound()` ran, the not-found page rendered, and the response was still
     * **200**: Google treats a 200 carrying "Page not found" far more harshly
     * than an honest 404, and on the layer whose entire purpose is SEO that was
     * the wrong way round. It applied to EVERY `notFound()` on the site, not
     * only to Learn.
     *
     * The cause was established by control experiment on a production build
     * rather than guessed. The root `app/loading.tsx` wrapped every route in a
     * Suspense boundary, so the shell was flushed before the page finished —
     * and once bytes are on the wire the status is already committed:
     *
     *     with    app/loading.tsx  → /learn/does-not-exist  200
     *     without app/loading.tsx  → /learn/does-not-exist  404
     *
     * The control that made it a finding rather than a guess:
     * `/.well-known/nothing-here` returned a true 404 on the same server, so
     * 404s did survive the middleware. It was the streaming, not the proxy.
     *
     * Fixed by deleting that file (owner approved 2026-08-18). The `(app)`
     * group keeps its own `loading.tsx`, so the signed-in terminal still gets
     * its skeleton; the public pages now stream without a route-level fallback,
     * which is also what Vercel's own guidance describes — Suspense belongs
     * around the dynamic part INSIDE a page, not wrapped around every route.
     */
    const res = await page.goto('/learn/this-article-does-not-exist');
    expect(res?.status(), 'an unknown slug must 404, not answer 200 with an empty shell').toBe(404);

    // The control: a real page on the same server must still answer 200, or
    // "everything 404s" would satisfy the line above just as well.
    const ok = await page.goto(ARTICLE_PATHS[0]!);
    expect(ok?.status(), 'a real article must still answer 200').toBe(200);
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

/**
 * Vertical rhythm, and the ONE lockup.
 *
 * Both suites here exist because of defects introduced on 2026-08-17 while
 * IMPROVING the typography — which is the argument for them. A missing gap and a
 * ten-pixel misalignment both render perfectly, throw nothing and look
 * deliberate, so only something that measures the relationship can see them.
 */
test.describe('Learn typography and chrome', () => {
  test('a section heading gets more room above it than two paragraphs get', async ({ page }) => {
    await page.goto(ARTICLE_PATHS[0]!);
    await ready(page);

    const m = await page.evaluate(() => {
      const scope = document.querySelector('[data-article-body]')!;
      const kids = [...scope.querySelectorAll('h2, p')];
      const gap = (a: Element, b: Element) =>
        b.getBoundingClientRect().top - a.getBoundingClientRect().bottom;

      let paragraphGap: number | null = null;
      const headingGaps: number[] = [];
      for (let i = 1; i < kids.length; i++) {
        const prev = kids[i - 1]!;
        const cur = kids[i]!;
        if (cur.previousElementSibling !== prev) continue;
        if (cur.tagName === 'H2') headingGaps.push(gap(prev, cur));
        else if (prev.tagName === 'P' && paragraphGap === null) paragraphGap = gap(prev, cur);
      }
      return { paragraphGap, headingGaps };
    });

    // The control: if paragraphs are not spaced either, the stylesheet never
    // loaded and every comparison below would be vacuous.
    expect(m.paragraphGap, 'paragraphs are not spaced — nothing is styled').toBeGreaterThan(5);
    expect(m.headingGaps.length, 'no heading followed prose — nothing was measured').toBeGreaterThan(0);

    // A RELATIONSHIP, not a literal: this survives a type-scale change, which a
    // hard-coded 29.75px would not. Before the fix every one of these was 0 —
    // a heading had LESS room than two ordinary paragraphs.
    for (const g of m.headingGaps) {
      expect(g, `a heading has ${g}px above it vs ${m.paragraphGap}px between paragraphs`).toBeGreaterThan(
        m.paragraphGap! * 1.5,
      );
    }
  });

  test('each topic number stays centred on its heading', async ({ page }) => {
    await page.goto(LEARN_INDEX_PATH);
    await ready(page);

    const offsets = await page.evaluate(() =>
      [...document.querySelectorAll('section h2')].map((h) => {
        const num = h.parentElement!.firstElementChild!;
        const mid = (e: Element) => {
          const r = e.getBoundingClientRect();
          return (r.top + r.bottom) / 2;
        };
        return +(mid(num) - mid(h)).toFixed(1);
      }),
    );

    expect(offsets.length, 'no topic bands were measured').toBeGreaterThan(0);
    // Adding prose margins to `.reading h2` threw this to 10.6px, then 14.9px
    // when the opt-out lost a specificity contest to `:not(:first-child)`.
    // 2px of tolerance for sub-pixel layout; the real values are 0.
    for (const o of offsets) {
      expect(Math.abs(o), `the topic number sits ${o}px off its heading's centre`).toBeLessThanOrEqual(2);
    }
  });

  test('the brand lockup is ONE component, not two copies', async ({ page }) => {
    // CLAUDE.md 11c-iv: extracting the shared piece is only half the job — the
    // other half is that every consumer actually consumes it. The public header
    // and the signed-in sidebar drifted on `leading-none`, `flex-shrink-0` and
    // the gap precisely because each held its own copy.
    for (const file of ['components/PublicHeader.tsx', 'components/Sidebar.tsx']) {
      const src = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(src, `${file} should render <BrandLockup />`).toContain('BrandLockup');
      expect(
        src,
        `${file} still hard-codes the wordmark — it must come from BrandLockup`,
      ).not.toContain('Financial Terminal');
    }

    // And it really renders, on a real page — a source check alone would pass
    // against a component that throws.
    await page.goto(LEARN_INDEX_PATH);
    await ready(page);
    await expect(page.locator('[data-public-header] img[alt="MajorCycle logo"]')).toBeVisible();
  });
});

/**
 * The drawdown article's three figures.
 *
 * ⚠️ **A missing figure renders as nothing at all.** No error, no gap, no failing
 * assertion — the prose simply runs on and the page looks completely deliberate.
 * That is CLAUDE.md 11j, and the only thing that can see it is a test that names
 * what SHOULD be there. So these enumerate rather than count.
 *
 * ⚠️ **Contrast is NOT re-checked here.** `/learn/what-is-a-drawdown` is already
 * in `contrast.spec.ts`'s READING_PAGES, so every caption, legend and label these
 * figures add is measured there automatically. A second copy of that check could
 * only ever agree with itself.
 */
test.describe('the drawdown article figures', () => {
  const ARTICLE = learnPath('what-is-a-drawdown');

  /** What the article promises. Named, because a count cannot tell you WHICH one went. */
  const FIGURE_MARKERS = [
    { what: 'the price-and-drawdown schematic', needle: 'drawn the way MajorCycle draws it' },
    { what: 'the one-year drawdown chart', needle: 'the chart MajorCycle draws for every company' },
    { what: 'the real-record bars', needle: 'the honest shape of the' },
  ];

  test('all three figures render, each with a caption', async ({ page }) => {
    await page.goto(ARTICLE);
    await ready(page);

    const body = page.locator('[data-article-body]');
    await expect(body.locator('figure')).toHaveCount(FIGURE_MARKERS.length);

    // Every figure carries a figcaption, and none of them is empty. A caption is
    // how a reader who cannot see the drawing learns what it showed, so an empty
    // one is the accessibility failure that looks perfect in review.
    const captions = await body.locator('figure figcaption').allInnerTexts();
    expect(captions).toHaveLength(FIGURE_MARKERS.length);
    for (const c of captions) expect(c.trim().length).toBeGreaterThan(40);

    const text = (await body.innerText()).replace(/\s+/g, ' ');
    for (const f of FIGURE_MARKERS) {
      expect(text, `${f.what} is missing from the article`).toContain(f.needle);
    }
  });

  test('the two schematics carry accessible descriptions, not just pictures', async ({ page }) => {
    await page.goto(ARTICLE);
    await ready(page);

    // role="img" + aria-label. Without these an SVG is announced as nothing, and
    // the figure's whole argument is unavailable to a screen-reader user.
    //
    // ⚠️ THREE panels, not three figures. The first figure stacks a price panel
    // above a drawdown panel — the product's own layout — so it draws two, and
    // the third figure is HTML bars with no SVG at all. Naming the number here
    // rather than counting figures is deliberate: a panel that silently stopped
    // rendering would still leave three <figure> elements on the page.
    const PANELS = 3;
    const described = page.locator('[data-article-body] svg[role="img"]');
    await expect(described).toHaveCount(PANELS);

    for (let i = 0; i < PANELS; i += 1) {
      // Length, not a regex. The first version of this assertion used
      // `/\S{80,}/`, which asks for eighty consecutive NON-space characters —
      // something no English sentence contains, so it could only ever fail. A
      // guard that cannot pass is as useless as one that cannot fail.
      const label = (await described.nth(i).getAttribute('aria-label')) ?? '';
      expect(label.length, `schematic ${i + 1} has no usable aria-label`).toBeGreaterThan(80);
    }
  });

  test('the record figure prints the SNAPSHOT figures, not typed ones', async ({ page }) => {
    /**
     * ⚠️ CLAUDE.md 11k. These are real numbers about a real company, and the
     * failure mode is a hard-coded "11.3%" that stays fluent, specific and wrong
     * from the next nightly run. The expectation is BUILT FROM the snapshot file
     * rather than written here, so this test cannot drift with the data.
     *
     * It reads the JSON directly while the page reaches it through
     * `lib/landing.ts` — two different routes to the same fact, so a bug in the
     * module between them is visible rather than shared.
     */
    const snapshot = JSON.parse(
      readFileSync(join(__dirname, '..', 'app', 'landing-snapshot.json'), 'utf8'),
    ) as Record<string, number>;

    const expected = {
      today: snapshot.currentDrawdownPct,
      average: snapshot.typicalDrawdownPct,
      deepest: snapshot.deepestDrawdownPct,
    };

    await page.goto(ARTICLE);
    await ready(page);

    for (const [id, pct] of Object.entries(expected)) {
      const cell = page.locator(`[data-record-row="${id}"]`);
      await expect(cell, `the ${id} row is missing from the record figure`).toHaveCount(1);

      const shown = (await cell.innerText()).trim();
      const want = `${Math.abs(pct as number).toFixed(1)}%`;
      expect(shown, `the ${id} row shows ${shown}, snapshot says ${want}`).toBe(want);

      // CONTROL: the same assertion against a deliberately wrong value must FAIL.
      // Without this, a cell rendering some constant string would satisfy the
      // check above if that constant happened to match — and, more importantly,
      // this proves the comparison is value-sensitive rather than merely finding
      // a percent sign (CLAUDE.md 11c-v).
      const offByOne = `${(Math.abs(pct as number) + 0.1).toFixed(1)}%`;
      expect(shown, `the ${id} control is not value-sensitive`).not.toBe(offByOne);
    }
  });

  test('realistic detail cannot move a landmark', async () => {
    /**
     * The two schematics are drawn with small movement so they read as price
     * series rather than zigzags. ⚠️ **That detail is a RENDERING concern and must
     * never become a source of truth** — every percentage the captions quote is
     * computed from the plain landmark path, and added wiggle that invented a new
     * high would silently change what the figure claims while still looking
     * completely plausible.
     *
     * `detailed()` clamps each inserted point inside its own segment and tapers
     * the amplitude to zero at both ends, so no vertex moves and no segment can
     * overshoot. This asserts that rather than trusting the comment saying so —
     * a pure check, no browser needed.
     */
    const { FULL_PATH, detailed, recentView, WINDOW_START } = await import(
      '../components/learn/drawdownGeometry'
    );

    for (const [name, base] of [
      ['the three-year path', FULL_PATH],
      ['the zoomed path', recentView(WINDOW_START.medium).path],
    ] as const) {
      const dense = detailed(base);

      expect(dense.length, `${name}: no detail was added at all`).toBeGreaterThan(base.length * 3);

      const ys = (p: readonly (readonly [number, number])[]) => p.map((q) => q[1]);
      expect(Math.min(...ys(dense)), `${name}: detail invented a NEW HIGH`).toBeGreaterThanOrEqual(
        Math.min(...ys(base)) - 1e-9,
      );
      expect(Math.max(...ys(dense)), `${name}: detail invented a NEW LOW`).toBeLessThanOrEqual(
        Math.max(...ys(base)) + 1e-9,
      );

      // Every landmark vertex must survive untouched — the peaks and the trough
      // ARE the argument, so a smoothed-away vertex is a changed claim.
      for (const [x, y] of base) {
        const kept = dense.some((q) => Math.abs(q[0] - x) < 1e-9 && Math.abs(q[1] - y) < 1e-9);
        expect(kept, `${name}: landmark (${x}, ${y}) was smoothed away`).toBe(true);
      }
    }

    // Deterministic: a figure that redraws differently per build is a diff nobody
    // can review and a test nobody can pin. Seeded LCG, never Math.random().
    expect(detailed(FULL_PATH)).toEqual(detailed(FULL_PATH));
  });

  test('every marker sits ON the curve it marks', async ({ page }) => {
    /**
     * ⚠️ **The defect this exists for shipped, and the owner found it by looking.**
     * Figure 1's drawdown marker was placed from `drawdownFromPeakY(...)` — a
     * correct number, reached by a route that had nothing to do with the drawn
     * line — while the curve itself was computed from a rescaled path priced with
     * the WRONG calibration. The two disagreed by 11.8 percentage points: the dot
     * floated well off its own curve and the axis bottomed at −48% where it should
     * have said −30%.
     *
     * Nothing errored. Both numbers were plausible. It looked like a chart.
     *
     * So the check is geometric rather than arithmetic: whatever the maths says,
     * the dot must land on the line. That is the only assertion that would have
     * caught it, because each number was individually defensible.
     */
    await page.goto(ARTICLE);
    await ready(page);

    const findings = await page.evaluate(() => {
      const out: { figure: number; gap: number; dotY: number; curveY: number }[] = [];
      const figs = [...document.querySelectorAll('[data-article-body] figure')];

      figs.forEach((fig, fi) => {
        fig.querySelectorAll('svg').forEach((svg) => {
          const curve = svg.querySelector('polyline');
          const box = svg.getBoundingClientRect();
          if (!curve || box.height === 0) return;

          // Where the curve ends, in page pixels.
          const pts = (curve.getAttribute('points') ?? '').trim().split(/\s+/);
          const last = pts[pts.length - 1]?.split(',').map(Number);
          if (!last || last.length < 2) return;
          const curveY = box.top + (last[1]! / 100) * box.height;

          // The round marker inside the same panel, if there is one.
          const dot = [...(svg.parentElement?.querySelectorAll('span[style]') ?? [])].find(
            (s) => getComputedStyle(s).borderRadius.includes('9999px')
              || parseFloat(getComputedStyle(s).borderRadius) > 5,
          );
          if (!dot) return;
          const r = dot.getBoundingClientRect();
          const dotY = r.top + r.height / 2;

          out.push({ figure: fi, gap: Math.abs(dotY - curveY), dotY, curveY });
        });
      });
      return out;
    });

    expect(findings.length, 'no marker/curve pairs were found — the probe is blind').toBeGreaterThan(0);

    for (const f of findings) {
      expect(
        f.gap,
        `figure ${f.figure}: the marker sits ${f.gap.toFixed(1)}px off the end of its own curve ` +
          `(marker ${f.dotY.toFixed(0)}, curve ${f.curveY.toFixed(0)}). It is being positioned ` +
          'from a number derived separately from the line it marks.',
      ).toBeLessThanOrEqual(3);
    }
  });

  test('the drawn curve reports the same fall the prose does', async ({ page }) => {
    /**
     * ⚠️ **The arithmetic half, and it exists because the geometric half could not
     * see this.** The shipped defect was a drawdown curve computed from a rescaled
     * path priced with the WRONG calibration: it ended at −31.8% while the
     * article's prose said −20%, and its axis bottomed at −48% instead of −30%.
     *
     * The marker-on-curve test above cannot catch that. Once the marker is
     * positioned by reading its value OFF the curve — which is the right fix — the
     * two move together, so the invariant holds perfectly while both are wrong.
     * **A guard made structurally true by a fix stops being evidence about that
     * fix.** Proven, not assumed: reintroducing the exact bug left it green.
     *
     * So this compares the PICTURE against the TEXT. They are produced by
     * genuinely different routes — the curve by a rolling-peak series, the prose
     * by `drawdownFromPeakY` — and a miscalibration moves one and not the other.
     */
    await page.goto(ARTICLE);
    await ready(page);

    const body = await page.locator('[data-article-body]').innerText();

    // What the article says in words, taken from the article itself.
    const prose = body.match(/(\d+(?:\.\d+)?)% under its high for the year/);
    expect(prose, 'the prose no longer states the one-year fall — update this guard').not.toBeNull();
    const stated = Math.round(Number(prose?.[1]));

    // What the two charts print beside their own curves.
    // ⚠️ `[data-fall-marker]`, not "every span that looks like a percentage". The
    // first version matched on text and swept up the AXIS TICKS — it failed
    // reporting 15% against 20%, where 15 was simply the midpoint label on the
    // scale. A probe that cannot tell a marker from an axis is measuring the
    // wrong thing, however plausible its error message reads.
    const drawn = await page
      .locator('[data-article-body] [data-fall-marker]')
      .evaluateAll((els) =>
        els.map((e) => Math.abs(Number((e.textContent ?? '').replace('%', '').trim()))),
      );

    expect(drawn.length, 'no percentage markers were found on either chart').toBeGreaterThan(0);

    for (const value of drawn) {
      expect(
        value,
        `a chart marks the fall as ${value}% while the article's prose says ${stated}%. ` +
          'The curve and the sentence are derived by different routes, so they disagree ' +
          'only when one of them is computed in the wrong coordinate space.',
      ).toBe(stated);
    }
  });

  test('a subsection heading is visibly smaller than a section heading', async ({ page }) => {
    /**
     * ⚠️ **The document scale collapsed h2 and h3 onto one size, and no test could
     * see it.** Both rendered at 17px with the same colour and the same 29.75px
     * above, separated only by 700 vs 600 weight — so eight sections and four
     * subsections read as one flat list. Every size was still on the 24/17/13/12
     * scale, so the type-scale guard passed; the page simply had no hierarchy.
     * The owner read it and said the sizes looked wrong.
     *
     * It survived because **no `.doc-scale` page had ever used an h3** — all three
     * legal pages are h2-only — so the article was the first consumer of a rule
     * written for a document that never had subsections (CLAUDE.md 11c-iv).
     *
     * This asserts the RELATIONSHIP rather than either number, so it keeps working
     * if the scale is ever retuned, and it checks the rhythm as well as the size:
     * a subsection should sit nearer the section it divides than a new section does.
     */
    await page.goto(ARTICLE);
    await ready(page);

    const heads = await page.evaluate(() =>
      [...document.querySelectorAll('[data-article-body] h2, [data-article-body] h3')].map((h) => {
        const cs = getComputedStyle(h);
        return {
          tag: h.tagName.toLowerCase(),
          size: parseFloat(cs.fontSize),
          marginTop: parseFloat(cs.marginTop),
          text: (h.textContent ?? '').slice(0, 40),
        };
      }),
    );

    const h2s = heads.filter((h) => h.tag === 'h2');
    const h3s = heads.filter((h) => h.tag === 'h3');

    // Controls: the assertion below is vacuous if either level is absent.
    expect(h2s.length, 'the article has no h2 — this guard would pass vacuously').toBeGreaterThan(0);
    expect(h3s.length, 'the article has no h3 — this guard would pass vacuously').toBeGreaterThan(0);

    const smallestH2 = Math.min(...h2s.map((h) => h.size));
    const largestH3 = Math.max(...h3s.map((h) => h.size));
    expect(
      largestH3,
      `subsection headings render at ${largestH3}px and section headings at ${smallestH2}px. ` +
        'They must differ, or a reader cannot tell a subsection from a new section — ' +
        'weight alone is not enough to carry document structure.',
    ).toBeLessThan(smallestH2);

    // And the spacing must step the same way.
    const h2Gap = Math.max(...h2s.filter((h) => h.marginTop > 0).map((h) => h.marginTop));
    const h3Gap = Math.max(...h3s.map((h) => h.marginTop));
    expect(
      h3Gap,
      `a subsection opens with ${h3Gap}px above it and a section with ${h2Gap}px. ` +
        'A subsection belongs to the section above it and should sit closer to it.',
    ).toBeLessThan(h2Gap);
  });

  test('the record figure READS its numbers, in the source', async () => {
    /**
     * ⚠️ **The structural half, and it exists because the rendered half has a
     * blind spot I found by breaking it.** The test above compares what the page
     * prints against the snapshot file — which cannot fail while a hard-coded
     * number happens to equal today's value. Proven, not assumed: replacing
     * `LANDING.currentDrawdownPct` with the literal `-11.3` left that test GREEN,
     * because `depth()` rounds both to "11.3%". Only when the literal was changed
     * to `-22.2` did it go red.
     *
     * That is the whole defect this pair guards: a typed number is correct on the
     * day it is typed and silently wrong from the next nightly run (CLAUDE.md
     * 11k). The rendered test catches it a day late; this one catches it now.
     *
     * Comments are STRIPPED first — the paragraph above names the very field it
     * asserts, and a guard that passes on its own explanation guards nothing
     * (CLAUDE.md 11c-iv).
     */
    const src = readFileSync(
      join(__dirname, '..', 'components', 'learn', 'DrawdownFigures.tsx'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const rows = [...src.matchAll(/pct:[ 	]*(.*)/g)].map((m) =>
      (m[1] ?? '').trim().replace(/,$/, ''),
    );
    expect(rows.length, 'no `pct:` rows found — the figure was restructured').toBeGreaterThanOrEqual(3);

    const literals = rows.filter((v) => /^-?\d/.test(v));
    expect(
      literals,
      `these figures are typed rather than read: ${literals.join(', ')} — every real ` +
        'number must come from the snapshot, or it is right today and wrong tomorrow',
    ).toEqual([]);

    // The control: the three record rows must actually name the snapshot fields.
    // Without this, deleting the rows entirely would satisfy the check above (14g).
    for (const field of ['currentDrawdownPct', 'typicalDrawdownPct', 'deepestDrawdownPct']) {
      expect(src, `the record figure no longer reads LANDING.${field}`).toContain(`LANDING.${field}`);
    }
  });

  test('both schematics agree about the one-year fall', async ({ page }) => {
    /**
     * The two figures are drawn from ONE path, and the second is derived from the
     * first — so the one-year number must be identical in both. Typing it twice
     * is exactly the drift CLAUDE.md 11c-iii describes: two captions that share a
     * spec and quietly stop agreeing, both still perfectly readable.
     */
    await page.goto(ARTICLE);
    await ready(page);

    const captions = await page.locator('[data-article-body] figure figcaption').allInnerTexts();
    const [whichPeak, windows] = captions;

    const pct = /(\d+)%/g;
    const inFirst = [...(whichPeak ?? '').matchAll(pct)].map((m) => m[1]);
    const inSecond = [...(windows ?? '').matchAll(pct)].map((m) => m[1]);

    expect(inFirst.length, 'the which-peak caption quotes no percentages').toBeGreaterThan(0);
    const shared = inFirst.filter((v) => inSecond.includes(v));
    expect(
      shared.length,
      `no percentage is shared between the two captions (${inFirst} vs ${inSecond}) — ` +
        'the figures are drawn from one path and must agree on the one-year fall',
    ).toBeGreaterThan(0);
  });

  test('the article body does not scroll sideways on a phone', async ({ page }) => {
    /**
     * ⚠️ **Scoped to the ARTICLE BODY, and that is a finding rather than a
     * convenience.** The first version measured the whole document and failed at
     * 320px by 18px — which turned out to be the public header's two CTA buttons
     * (`Create free account` / `Sign in`), not anything in this article. The
     * figures contribute **0px** of overflow at 375, 360 and 320.
     *
     * Measuring the document here would make this test go red for a pre-existing
     * defect in a component it does not own, and the usual response to that is to
     * loosen the bound until it passes — which would also stop it seeing a real
     * figure overflow. So it measures the thing under test, at every width, and
     * the header defect is recorded in the roadmap's deferred list instead
     * (CLAUDE.md 11l: record a defect you are not authorised to fix).
     *
     * ⚠️ A MARGIN, not a boundary (CLAUDE.md 11i-b). `<= 0` scores a 1px accident
     * as a pass; the design clears this by the full width, so a real regression
     * breaks it and a rounding artefact does not.
     *
     * Swept rather than checked at one width, because the stated 375px floor was
     * once the single width at which a real overflow happened to clear.
     */
    for (const width of [375, 360, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(ARTICLE);
      await ready(page);

      const over = await page.evaluate(() => {
        const el = document.querySelector('[data-article-body]');
        return el ? el.scrollWidth - el.clientWidth : -1;
      });
      expect(over, 'the article body was not found').toBeGreaterThanOrEqual(0);
      expect(
        over,
        `the article body overflows horizontally by ${over}px at ${width}px`,
      ).toBeLessThanOrEqual(2);
    }
  });

  test('the page itself does not scroll sideways at the supported floor', async ({ page }) => {
    /**
     * The document-level contract, asserted at the width the project actually
     * supports (375px — decision #3 / non-negotiable #3). Kept separate from the
     * test above so that if this one ever fails it names a PAGE problem rather
     * than being read as a figure problem.
     */
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(ARTICLE);
    await ready(page);

    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over, `${ARTICLE} overflows horizontally by ${over}px at 375px`).toBeLessThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "Dip, correction, crash" — its two figures
// ─────────────────────────────────────────────────────────────────────────────

test.describe('the dip/correction/crash figures', () => {
  const ARTICLE = learnPath('dip-correction-crash');

  test('both figures render, each with a caption', async ({ page }) => {
    /**
     * CLAUDE.md 11j: a missing section renders perfectly. Nothing errors, nothing
     * looks blank — the page simply stops earlier than it should and reads as
     * deliberate. Only something that names what SHOULD be there can see it.
     */
    await page.goto(ARTICLE);
    await ready(page);

    const figures = page.locator('[data-article-body] figure');
    await expect(figures).toHaveCount(2);
    for (let i = 0; i < 2; i += 1) {
      await expect(figures.nth(i).locator('figcaption')).not.toBeEmpty();
    }
    // Named, not counted — two of the wrong figure would satisfy a count.
    await expect(page.locator('[data-record-panel="routine"]')).toBeVisible();
    await expect(page.locator('[data-record-panel="quiet"]')).toBeVisible();
  });

  test('both panels mark the SAME depth, on one shared scale', async ({ page }) => {
    /**
     * ⚠️ **This is the whole figure.** The article's claim is that one percentage
     * means opposite things in two records, which only works if the two markers
     * are at the same depth. Give each panel its own y-scale — the obvious thing
     * to do, and what "make each chart fill its box" would produce — and the dots
     * land at different heights, the reader sees two unrelated charts, and the
     * argument silently evaporates while both panels still render beautifully.
     *
     * ⚠️ Measured on the DOT, never the printed label: the label is positioned
     * differently below `sm`, and an element that is `display:none` reports a
     * zero-sized rect at the origin — a confident number about nothing.
     */
    await page.goto(ARTICLE);
    await ready(page);

    const depths = await page.evaluate(() =>
      [...document.querySelectorAll('[data-record-panel]')].map((p) => {
        const box = p.getBoundingClientRect();
        const dot = p.querySelector('[data-today-dot]')?.getBoundingClientRect();
        const label = p.querySelector('[data-panel-today]');
        return {
          id: p.getAttribute('data-record-panel'),
          depth: dot ? dot.top + dot.height / 2 - box.top : NaN,
          text: label?.textContent?.trim() ?? '',
        };
      }),
    );

    expect(depths, 'expected exactly two record panels').toHaveLength(2);
    const [a, b] = depths;
    expect(Number.isNaN(a!.depth), `${a!.id}: no today dot to measure`).toBe(false);
    expect(Number.isNaN(b!.depth), `${b!.id}: no today dot to measure`).toBe(false);

    expect(
      Math.abs(a!.depth - b!.depth),
      `the two panels mark today at different depths (${a!.id} ${a!.depth.toFixed(1)}px vs ` +
        `${b!.id} ${b!.depth.toFixed(1)}px) — they are not on one shared scale, so the ` +
        'figure no longer shows the same fall in two records',
    ).toBeLessThanOrEqual(1);

    // And the printed values agree with each other.
    expect(a!.text, 'the two markers print different numbers').toBe(b!.text);
    expect(a!.text, 'the marker prints no percentage').toMatch(/-?\d+%/);
  });

  test('each panel agrees with the number the caption states', async ({ page }) => {
    /**
     * Picture versus prose. The version of this guard that only checked the
     * marker sat on its own curve went green on a reintroduced calibration bug,
     * because the fix had made that relationship structurally true — a guard the
     * fix guarantees is no guard (coding-standards §14 item 29). So this compares
     * two things that are computed by different routes and could disagree: the
     * depth the panels DRAW, and the depth the caption SAYS.
     */
    await page.goto(ARTICLE);
    await ready(page);

    const marker = (await page.locator('[data-panel-today]').first().textContent()) ?? '';
    const drawn = Math.abs(parseInt(marker.replace(/[^\d-]/g, ''), 10));
    expect(Number.isNaN(drawn), `could not read a number from the marker "${marker}"`).toBe(false);

    const caption = (await page.locator('[data-article-body] figure figcaption').nth(1).innerText()) ?? '';
    expect(
      caption,
      `the panels draw a fall of ${drawn}% but the caption beside them does not mention it: ${caption}`,
    ).toContain(`${drawn}%`);

    // The body makes the same claim in words, three paragraphs earlier.
    const body = await page.locator('[data-article-body]').innerText();
    expect(
      body,
      `the article's prose never states the ${drawn}% both panels are drawn at`,
    ).toContain(`${drawn}%`);
  });

  test('the market figure rules sit where the prose says they do', async ({ page }) => {
    /**
     * The two conventional thresholds are the only literals in this article's
     * figures — they are journalistic convention, not a constant the product
     * owns, so there is nothing to derive them from. That makes them exactly the
     * kind of number that can be edited in one place and not the other.
     */
    await page.goto(ARTICLE);
    await ready(page);

    const axis = await page
      .locator('[data-article-body] figure')
      .first()
      .locator('span')
      .allInnerTexts();
    const levels = axis.filter((t) => /^-?\d+%$/.test(t.trim()));

    for (const wanted of ['0%', '-10%', '-20%']) {
      expect(
        levels.map((t) => t.trim()),
        `the market figure's axis does not label ${wanted} — the article's prose does`,
      ).toContain(wanted);
    }
  });
});
