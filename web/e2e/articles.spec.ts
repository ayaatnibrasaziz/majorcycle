import { expect, test, type Page } from '@playwright/test';

import {
  ARTICLES,
  ARTICLES_INDEX_PATH,
  FEATURED_SLUG,
  PLANNED_ARTICLES,
  articlePath,
  featuredArticle,
  richText,
} from '../lib/articles';
import { PREFERRED_SOURCE } from '../lib/preferredSource';
import { expectNoLostSpaces } from './lib/proseSpacing';

/**
 * The Articles section — `/articles` and `/articles/[slug]`.
 *
 * Credential-free browser tests: no login, no network beyond the dev server, so
 * they run on a fork PR and cannot self-skip.
 *
 * ── What is deliberately NOT here ────────────────────────────────────────────
 *
 * Canonical tags and sitemap membership are already covered by `seo.spec.ts`,
 * which loops over the indexable entries of `PUBLIC_PAGES` — and every article
 * path is derived into that list from the same registry this file imports.
 * Re-asserting them here would be a second copy of one check that can only ever
 * agree with itself.
 *
 * ── What IS here, and why each one is invisible ──────────────────────────────
 *
 *  1. **A planned row that has become a link.** It looks identical until
 *     somebody clicks it and lands nowhere.
 *  2. **A figure whose labels overlap.** 1.2 units of overlap is invisible in a
 *     screenshot and obvious to `getBoundingClientRect`. The two closest series
 *     are 0.6 of a percentage point apart, so the scale is what decides it.
 *  3. **Chart text below the reading floor.** The approved artifact drew this
 *     figure with 8px and 9px labels, in its own preview scale. On the live
 *     site that is unreadable, and no existing guard walks this page.
 *  4. **The featured card drifting away from the product's briefing.** The
 *     owner asked for the landing page's card. A lookalike renders perfectly
 *     while diverging (CLAUDE.md 11c).
 *  5. **A table widening the page.** At 375px a five-column table is wider than
 *     the column, and a table that widens the document pushes every paragraph
 *     sideways — the one layout failure a reader cannot work around.
 *  6. **The disclaimer sinking below the fold**, which is a compliance
 *     requirement (#4/#12/#24) and one over-long `answer` away on any new piece.
 */

const PATHS = ARTICLES.map((a) => articlePath(a.slug));

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

test.describe('the Articles section', () => {
  test('the registry is not empty', async () => {
    // The control for everything below. Every other test loops over PATHS, so an
    // empty registry would make all of them pass having measured nothing — the
    // shape of "unmeasurable counted as clean" (CLAUDE.md 14g).
    expect(
      ARTICLES.length,
      'no articles registered — every loop below is vacuous',
    ).toBeGreaterThan(0);
  });

  test('the index leads with the DECLARED article, and that slug is real', async ({ page }) => {
    await page.goto(ARTICLES_INDEX_PATH);
    await ready(page);

    const featured = featuredArticle()!;
    const card = page.locator('.briefing.art-brief');
    await expect(card).toHaveCount(1);
    await expect(card.locator('.art-h')).toHaveText(featured.title);

    // ⚠️ THE CONTROL, and it is the whole point of this assertion. `featuredArticle()`
    // falls back to the newest piece when `FEATURED_SLUG` matches nothing — so a
    // slug renamed in one place and not the other produces a perfectly good index
    // page leading with the wrong article, and every other test here still passes.
    // Only checking that the declared slug RESOLVES can tell the two apart.
    expect(
      ARTICLES.some((a) => a.slug === FEATURED_SLUG),
      `FEATURED_SLUG is "${FEATURED_SLUG}", which is not a registered article — the index is silently leading with whatever is newest`,
    ).toBe(true);
    expect(featured.slug).toBe(FEATURED_SLUG);

    // And the rows are the rest, newest first — the lead is chosen, the list is dated.
    const rows = await page.locator('a.art-row .art-t').allInnerTexts();
    const expected = [...ARTICLES]
      .filter((a) => a.slug !== FEATURED_SLUG)
      .sort((a, b) => b.published.localeCompare(a.published))
      .map((a) => a.title);
    expect(rows).toEqual(expected);
  });

  test('the featured card IS the product briefing, not a lookalike', async ({ page }) => {
    // The owner asked for "the same vibe like the analyst briefing in the landing
    // page". The only way that stays true is to render the same component, so
    // this compares the computed result on both pages rather than checking that
    // a class name is present — a copied class list would pass that and still
    // drift the moment `globals.css` changed.
    const read = async (path: string) => {
      await page.goto(path);
      await page.waitForSelector('.briefing');
      return page.evaluate(() => {
        const el = document.querySelector('.briefing')!;
        const s = getComputedStyle(el);
        return {
          backgroundImage: s.backgroundImage,
          borderTopColor: s.borderTopColor,
          borderRadius: s.borderRadius,
          padding: s.padding,
          boxShadow: s.boxShadow,
          display: s.display,
          gap: s.gap,
        };
      });
    };
    const landing = await read('/');
    const articles = await read(ARTICLES_INDEX_PATH);
    expect(articles).toEqual(landing);
  });

  test('a planned row is never a link, and never recedes by opacity', async ({ page }) => {
    await page.goto(ARTICLES_INDEX_PATH);
    await ready(page);

    const soon = page.locator('.art-row.art-soon');
    await expect(soon).toHaveCount(PLANNED_ARTICLES.length);

    // ⚠️ A promise that looks clickable is worse than no promise: the reader
    // clicks, nothing happens, and the section stops being believable.
    //
    // ⚠️ THE ROW ITSELF COUNTS. The first version of this asserted
    // `soon.locator('a').count() === 0`, which only sees a link INSIDE the row —
    // and the way this actually breaks is the whole row becoming an `<a>`, since
    // that is one character away from the published rows right below it. Proven:
    // that sabotage passed the narrower check. Both are asserted now.
    const linkish = await soon.evaluateAll((els) =>
      els.flatMap((el) => [
        el.tagName,
        ...[...el.querySelectorAll('a')].map((a) => a.tagName),
      ]),
    );
    expect(linkish, 'a planned row is, or contains, a link').not.toContain('A');

    // ⚠️ Recede with colour and weight, never transparency. The Learn "coming
    // soon" rows were `--text-secondary` at 70% opacity and rendered at 3.38:1
    // against a 4.5 floor — while the contrast guard scored them 6.81, because
    // it could not see `opacity` at all (CLAUDE.md 11q).
    const opacities = await soon.evaluateAll((els) =>
      els.flatMap((el) => [
        parseFloat(getComputedStyle(el).opacity),
        ...[...el.querySelectorAll('*')].map((n) => parseFloat(getComputedStyle(n).opacity)),
      ]),
    );
    expect(Math.min(...opacities), 'a planned row is fading with opacity').toBe(1);
  });

  test('the date and reading time are separated by real space', async ({ page }) => {
    // ⚠️ THE OWNER ASKED FOR THIS SPACING AND IT WAS SILENTLY NOT APPLIED. The
    // separator span was called `.art-dot` — the same class as the chart's
    // end-point dots — so it inherited `position:absolute; width:7px; height:7px;
    // border-radius:50%` and rendered as a positioned circle contributing nothing
    // to layout. The `·` still painted roughly where a reader expects one, so
    // nothing looked wrong.
    //
    // Asserted as a CONTROLLED EXPERIMENT rather than a geometry read: three
    // different measurements disagreed with each other, and the only one that
    // settled it was removing the padding and watching the width. If the
    // separator is laid out at all, taking its padding away must make the line
    // narrower.
    await page.goto(ARTICLES_INDEX_PATH);
    await ready(page);

    const result = await page.evaluate(() => {
      const wrap = document.querySelector('.art-when') as HTMLElement;
      const sep = wrap?.querySelector('.art-sep') as HTMLElement;
      if (!wrap || !sep) return null;
      const withPad = wrap.getBoundingClientRect().width;
      sep.style.setProperty('padding', '0', 'important');
      const without = wrap.getBoundingClientRect().width;
      sep.style.removeProperty('padding');
      return {
        contributes: withPad - without,
        position: getComputedStyle(sep).position,
      };
    });

    expect(result, 'no date/reading-time separator on the featured card').not.toBeNull();
    // It must be in the flow, not positioned out of it.
    expect(result!.position, 'the separator is positioned out of the text flow').toBe('static');
    // 7px each side. A separator that is laid out cannot contribute nothing.
    expect(
      result!.contributes,
      'the separator has no horizontal padding in the rendered page',
    ).toBeGreaterThanOrEqual(12);
  });

  test('every published article has a row carrying its FINDING', async ({ page }) => {
    await page.goto(ARTICLES_INDEX_PATH);
    await ready(page);

    const featured = featuredArticle()!;
    for (const a of ARTICLES) {
      if (a.slug === featured.slug) continue;
      const row = page.locator(`a.art-row[href="${articlePath(a.slug)}"]`);
      await expect(row).toHaveCount(1);
      // The finding, not the summary — the design's whole argument for having no
      // thumbnails is that the number does the work a picture does elsewhere.
      await expect(row.locator('.art-f')).toContainText(richText(a.finding).slice(0, 40));
    }
  });

  test('the featured figure stays short, and the link stays put', async ({ page }) => {
    // Owner, 2026-08-29, in two passes. The drawing hung 100px below the card's
    // own call to action. My first fix stretched the text column and pushed the
    // link down to meet it; the owner reversed that — the call to action is the
    // one thing on the card that should not move — and asked for a shorter plot
    // instead.
    //
    // ⚠️ A RATCHET, not a target. Today's height is the ceiling, so the figure
    // can get shorter and can never quietly grow back.
    //
    // ⚠️ And the link's position is asserted from the OTHER side: it must sit
    // directly under the pills, not at the bottom of a stretched column. Only
    // that distinguishes "the figure got shorter" from "the text got taller",
    // which is the change that was reversed.
    for (const width of [1280, 900, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ARTICLES_INDEX_PATH);
      await ready(page);
      const m = await page.evaluate(() => {
        const card = document.querySelector('.briefing.art-brief')!;
        const plot = card.querySelector('.art-plot')!.getBoundingClientRect();
        const pills = card.querySelector('.briefing-pills')!.getBoundingClientRect();
        const read = card.querySelector('.art-read')!.getBoundingClientRect();
        return { plotH: plot.height, gap: read.top - pills.bottom };
      });
      expect(m.plotH, `at ${width}px the plot is ${m.plotH}px tall`).toBeLessThanOrEqual(120);
      expect(
        m.gap,
        `at ${width}px the link sits ${m.gap.toFixed(1)}px under the pills — it has been pushed down`,
      ).toBeLessThanOrEqual(20);
    }

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(ARTICLES_INDEX_PATH);
    await ready(page);
    const stacked = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      column: getComputedStyle(document.querySelector('.briefing.art-brief')!).flexDirection,
    }));
    expect(stacked.column, 'the card should stack on a phone').toBe('column');
    expect(stacked.scrollW, 'the card widened the page at 375px').toBeLessThanOrEqual(
      stacked.clientW,
    );
  });

  test('a label never wanders far from the point it names', async ({ page }) => {
    // The figure spaces colliding labels apart so the plot can be short enough
    // for the card (`declutter` in FallByMarketFigure.tsx). That buys clearance
    // by moving a label off its own dot, which is fine at a few pixels and a
    // LIE at twenty — the reader would read the wrong number against the wrong
    // line, on a page whose whole argument is those numbers.
    //
    // Today the worst offset is 5.3px. 10 is the bound: enough that the data
    // may move a little, tight enough that a label always sits on its point.
    // Nothing else can see this — the figure looks perfectly tidy either way,
    // which is exactly why the crowding was allowed to be fixed this way.
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ARTICLES_INDEX_PATH);
      await ready(page);

      const offsets = await page.evaluate(() => {
        const plot = document.querySelector('.art-plot')!;
        const pb = plot.getBoundingClientRect();
        const mid = (r: DOMRect) => r.y + r.height / 2 - pb.y;
        const dots = [...plot.querySelectorAll('.art-dot')].map((d) => {
          const r = d.getBoundingClientRect();
          return { x: r.x + r.width / 2 - pb.x, y: mid(r) };
        });
        return [...plot.querySelectorAll('.art-lab')].map((l) => {
          const r = l.getBoundingClientRect();
          const right = l.classList.contains('art-lab-r');
          const side = dots.filter((d) => (right ? d.x > pb.width / 2 : d.x < pb.width / 2));
          const near = side.reduce((a, b) =>
            Math.abs(b.y - mid(r)) < Math.abs(a.y - mid(r)) ? b : a,
          );
          return { text: (l.textContent ?? '').trim(), off: Math.abs(mid(r) - near.y) };
        });
      });

      // The control: six labels, or the loop below proves nothing (14g).
      expect(offsets.length, `no labels found at ${width}px`).toBeGreaterThanOrEqual(5);
      for (const o of offsets) {
        expect(o.off, `at ${width}px "${o.text}" sits ${o.off.toFixed(1)}px from its dot`)
          .toBeLessThanOrEqual(10);
      }
    }
  });

  test('no two labels in the featured figure overlap', async ({ page }) => {
    // ⚠️ A MARGIN, not the absence of a collision. `> 0` scores a 1px near-miss
    // as a pass and proves nothing about the next figure (CLAUDE.md 11i-b).
    //
    // Three real collisions were found here by measuring, every one invisible on
    // screen: the two closest end labels cleared by 1.2px, the two axis captions
    // by 0.5px, and the deepest left-hand label sat 2.1px above the caption
    // under it. All three were the artifact's own geometry, reasoned for 9px
    // labels and no longer true at 12px.
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ARTICLES_INDEX_PATH);
      await page.waitForSelector('.art-lab');

      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll('.art-lab, .art-cap')].map((n) => {
          const r = n.getBoundingClientRect();
          return { text: n.textContent ?? '', x: r.x, y: r.y, w: r.width, h: r.height };
        }),
      );
      expect(boxes.length, `no figure labels found at ${width}px`).toBeGreaterThan(4);

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
          const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
          expect(
            Math.max(gapX, gapY),
            `at ${width}px "${a.text}" and "${b.text}" clear by less than 3px`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  test('the figure holds the 12px reading floor at every width', async ({ page }) => {
    // ⚠️ THIS IS WHY THE LABELS ARE HTML. The first build set them inside the
    // viewBox, which is 12.5px on a desktop and — measured — 10.78px at 375px,
    // where the card's padding leaves the block 258.6px against a 300-unit box.
    // A floor that holds on one screen and not another is not a floor, and
    // nothing else would have caught it: the contrast guard measures colour, and
    // the 12px floor test only ever walks `/terms`.
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ARTICLES_INDEX_PATH);
      await page.waitForSelector('.art-lab');

      // ⚠️ EVERY SELECTOR MUST STILL MATCH SOMETHING. `.art-fignote` was in this
      // list until the caption was removed on 2026-08-29, and a selector that
      // matches nothing does not fail — it quietly shrinks what the guard looks
      // at while the total stays above the floor. Same shape as 14g: a check
      // that cannot see a thing reports what a clean system reports.
      const SELECTORS = ['.art-lab', '.art-cap'];
      const counts = await page.evaluate(
        (sels) => sels.map((s) => document.querySelectorAll(s).length),
        SELECTORS,
      );
      SELECTORS.forEach((s, i) => {
        expect(counts[i], `${s} matched nothing at ${width}px — the guard is not looking at it`)
          .toBeGreaterThan(0);
      });

      const sizes = await page.evaluate(
        (sels) =>
          [...document.querySelectorAll(sels.join(', '))].map((n) => ({
            text: (n.textContent ?? '').slice(0, 30),
            px: parseFloat(getComputedStyle(n).fontSize),
          })),
        SELECTORS,
      );
      expect(sizes.length, `no figure text at ${width}px`).toBeGreaterThan(4);
      for (const size of sizes) {
        expect(
          size.px,
          `at ${width}px "${size.text}" renders at ${size.px}px`,
        ).toBeGreaterThanOrEqual(12);
      }
    }
  });

  test('every article renders a body, not just its shell', async ({ page }) => {
    // ⚠️ The 11j failure: heading, answer, disclaimer and footer all present and
    // the middle simply missing. Nothing errors and it looks entirely deliberate.
    for (const path of PATHS) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} did not answer 200`).toBe(200);
      await ready(page);
      const words = await page.locator('[data-article-body]').innerText();
      expect(words.split(/\s+/).length, `${path} has almost no body`).toBeGreaterThan(300);
    }
  });

  test('no word runs into a bold one', async ({ page }) => {
    // The owner found two of these by reading the page. Both were present in
    // the source and destroyed by the compiler — see `lib/proseSpacing.ts` for
    // the measurement. Nothing else on this page can see it: the paragraph
    // renders, wraps and measures normally, and only the boundary between the
    // element and the text beside it is wrong.
    for (const path of PATHS) {
      await page.goto(path);
      await ready(page);
      await expectNoLostSpaces(page, '[data-article-body]', path);
    }
  });

  test('every article closes with the account offer', async ({ page }) => {
    for (const path of PATHS) {
      await page.goto(path);
      await ready(page);

      const cta = page.locator('[data-article-cta]');
      await expect(cta, `${path} has no closing call to action`).toHaveCount(1);
      await expect(cta.locator('a[href="/signup"]')).toHaveCount(1);

      // ⚠️ OUTSIDE the body container, and this is the assertion that keeps it
      // there. Inside, the reading-time check would count its words on every
      // article and the duplicate-prose check would see every pair of articles
      // sharing a long identical run — both would be measuring furniture. It
      // renders in the same place on screen either way, so nothing but this can
      // tell the difference.
      const inside = await page.evaluate(() => {
        const body = document.querySelector('[data-article-body]');
        const el = document.querySelector('[data-article-cta]');
        return !!(body && el && body.contains(el));
      });
      expect(inside, `${path}: the CTA is inside [data-article-body]`).toBe(false);
    }
  });

  test('the Preferred Sources button ships nothing while it is switched off', async ({
    page,
  }) => {
    // ⚠️ A DISABLED FEATURE MUST COST NOTHING, and "nothing" here has two halves
    // that fail independently: the markup, and the Content-Security-Policy.
    // Granting `news.google.com` while no page draws the button would be an
    // exemption outliving its reason (CLAUDE.md 11t), and nothing would ever go
    // red for it. Both are asserted against the same flag, so whichever way this
    // is next edited, the two cannot drift apart.
    const path = PATHS[0]!;
    const res = await page.goto(path);
    const csp = res?.headers()['content-security-policy'] ?? '';
    expect(csp, 'no CSP on an article page').not.toBe('');

    const thirdParty = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')]
        .map((s) => (s as HTMLScriptElement).src)
        .filter((src) => !src.includes('/_next/')),
    );
    const slot = await page.locator('[data-preferred-source-slot]').count();

    if (PREFERRED_SOURCE.enabled) {
      expect(slot, 'enabled, but no slot rendered').toBe(1);
      expect(thirdParty.join(' '), 'enabled, but the script is absent').toContain(
        'news.google.com',
      );
      // Both directives, because the script loads and is then refused at the
      // iframe — measured, see `lib/preferredSource.ts`.
      expect(csp).toContain(`script-src`);
      for (const directive of ['script-src', 'frame-src']) {
        const part = csp.split(';').find((d) => d.trim().startsWith(directive)) ?? '';
        expect(part, `${directive} does not allow the button's origin`).toContain(
          PREFERRED_SOURCE.origin,
        );
      }
    } else {
      expect(slot, 'switched off, but the slot is in the page').toBe(0);
      expect(thirdParty.join(' '), 'switched off, but the script is loaded').not.toContain(
        'news.google.com',
      );
      expect(csp, 'switched off, but the policy still grants the origin').not.toContain(
        PREFERRED_SOURCE.origin,
      );
    }
  });

  test('the bank and miner tables line up column for column', async ({ page }) => {
    // The prose says "And then the miners, on the same scale". A browser sizes
    // columns to their content, so the two tables sized themselves separately
    // and put Typical fall 43.6px apart — because "Mineral Resources — median"
    // is longer than "Bendigo & Adelaide". Each table is individually perfect,
    // which is why nothing looked wrong; the eye just cannot run down the two
    // columns. Found by the owner reading the page.
    //
    // ⚠️ Asserted at 375px too. The alignment comes from percentage widths, and
    // percentages are exactly where two tables can agree at one width and part
    // company at another.
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(articlePath('how-far-do-asx-shares-fall'));
      await ready(page);

      const cols = await page.evaluate(() => {
        const pick = (needle: string) =>
          [...document.querySelectorAll('table.art-table')].find((t) =>
            (t.querySelector('caption')?.textContent ?? '').startsWith(needle),
          );
        const xs = (t: Element | undefined) =>
          t ? [...t.querySelectorAll('thead th')].map((h) => h.getBoundingClientRect().x) : [];
        return { banks: xs(pick('Australian banks')), miners: xs(pick('Australian miners')) };
      });

      // The control: three columns each. Without it, two empty lists compare
      // equal and the test passes having looked at nothing (CLAUDE.md 14g).
      expect(cols.banks.length, `banks table not found at ${width}px`).toBe(3);
      expect(cols.miners.length, `miners table not found at ${width}px`).toBe(3);

      for (let i = 0; i < 3; i++) {
        const delta = Math.abs(cols.banks[i]! - cols.miners[i]!);
        expect(delta, `at ${width}px column ${i + 1} is ${delta.toFixed(1)}px out`).toBeLessThan(1);
      }
    }
  });

  test('an unknown slug is an honest 404', async ({ page }) => {
    const res = await page.goto(`${ARTICLES_INDEX_PATH}/not-a-real-article`);
    expect(res?.status()).toBe(404);
  });

  test('the stated reading time matches the body', async ({ page }) => {
    // ⚠️ `minutes` is a claim ABOUT the prose, so it drifts silently the moment
    // anyone edits a paragraph — still plausible, still rendering. This is the
    // only place the two can be compared. 200 wpm, ±2 minutes.
    for (const a of ARTICLES) {
      await page.goto(articlePath(a.slug));
      await ready(page);
      const text = await page.locator('[data-article-body]').innerText();
      const measured = Math.round(text.split(/\s+/).filter(Boolean).length / 200);
      expect(
        Math.abs(measured - a.minutes),
        `${a.slug}: registry says ${a.minutes} min, the body measures ${measured}`,
      ).toBeLessThanOrEqual(2);
    }
  });

  test('the disclaimer is visible without scrolling at 375px', async ({ page }) => {
    // Compliance, not aesthetics (#4 / #12 / #24). The only thing that can push
    // it down is an over-long `answer`, so this is really a guard on the
    // editorial rule "answer immediately, do not clear your throat".
    //
    // ⚠️ Scoped INSIDE `<article>`. The site footer carries the same sentence
    // 6,877px down the page, and a looser selector finds that one instead —
    // failing on a page that is entirely correct.
    await page.setViewportSize({ width: 375, height: 667 });
    for (const path of PATHS) {
      await page.goto(path);
      await ready(page);
      const box = await page
        .locator('article')
        .getByText(/not financial advice/i)
        .first()
        .boundingBox();
      expect(box, `${path}: no disclaimer inside the article`).not.toBeNull();
      expect(
        box!.y + box!.height,
        `${path}: the disclaimer sits below the fold`,
      ).toBeLessThanOrEqual(667);
    }
  });

  test('the answer stays short enough to be an answer', async () => {
    // The same editorial rule `learn.spec.ts` enforces, and for the same reason:
    // the disclaimer renders directly under the answer, so the ONLY thing that
    // can push it below a 375px fold is an answer that has grown into an essay.
    // Capping it here means a future piece fails on the rule itself with a clear
    // message, instead of failing the fold test with a geometry error that names
    // nothing. Bounded on both sides — a one-line answer that restates the title
    // answers nothing, and a bound on one side only tests the direction that was
    // never the risk (CLAUDE.md 11i).
    for (const a of ARTICLES) {
      expect(
        a.answer.length,
        `${a.slug}: the answer is ${a.answer.length} characters. It renders directly above the disclaimer, so it has to stay an answer — move the detail into the body.`,
      ).toBeLessThanOrEqual(320);
      expect(a.answer.length, `${a.slug}: the answer is too short to be one`).toBeGreaterThan(80);
    }
  });

  test('a column declared alignRight really is right-aligned on screen', async ({ page }) => {
    // ⚠️ THE MEASUREMENT IS THE POINT, not the declaration. `.art-table td` sets
    // `text-align: left` and this file already records the identical specificity
    // trap costing a half-fix that LOOKED like a fix: `.art-table--wrapth thead
    // th` loses to `.art-num` on class count, so two headers silently stayed
    // nowrap and the table still ran off the page while rendering perfectly
    // ordinarily. Counting selectors twice is what produced that. So this reads
    // the COMPUTED value off a rendered page instead.
    //
    // Owner review, 2026-08-30: the last column of each ranked table — peak dates
    // in the AU and US pieces, sector names in the Canadian one — sits
    // right-aligned like the percentages beside it.
    const measured = new Map<string, number>();
    for (const path of PATHS) {
      await page.goto(path);
      await ready(page);
      const cells = await page.evaluate(() =>
        [...document.querySelectorAll('.art-table .art-right')].map((el) => ({
          text: (el.textContent ?? '').trim().slice(0, 24),
          align: getComputedStyle(el).textAlign,
          // The face must stay Sora: `numeric` would have set dates and sector
          // names in the mono FIGURE face, which is the thing alignRight exists
          // to avoid.
          mono: getComputedStyle(el).fontFamily.toLowerCase().includes('mono'),
        })),
      );
      for (const c of cells) {
        expect(c.align, `${path}: "${c.text}" is ${c.align}, not right`).toBe('right');
        expect(c.mono, `${path}: "${c.text}" is set in the mono figure face`).toBe(false);
      }
      measured.set(path, cells.length);
    }

    // ⚠️ THE CONTROL, and my first version of it was a nullity. It asserted the
    // registry still holds three ranked articles — which says nothing about
    // whether any column is aligned. Delete every `alignRight: true` and the loop
    // above measures ZERO cells, passes, and that check passes too: a green run
    // having looked at nothing (CLAUDE.md 14g).
    //
    // So the floor is asserted on what was actually MEASURED, per page. Each
    // ranked table has fifteen rows plus its header; ten is clear of the header
    // count without being a restatement of the row count, which would then need
    // editing every time a row moved.
    const ranked = ARTICLES.filter((a) => a.slug.includes('furthest-below-their-highs'));
    expect(ranked.length, 'no ranked articles matched — the filter is stale').toBe(3);
    for (const a of ranked) {
      expect(
        measured.get(articlePath(a.slug)) ?? 0,
        `${a.slug}: no right-aligned cells were measured, so the assertions above proved nothing`,
      ).toBeGreaterThanOrEqual(10);
    }
  });


  test('no ranked-table cell wraps at the reading width', async ({ page }) => {
    // ⚠️ Owner review, 2026-08-30: "it looks very squished". The Canadian table's
    // last column holds sector NAMES where the AU and US tables hold dates —
    // "Communication Services" needs 165px against "Nov 2024"'s 76px — so the
    // shared 20% width broke TELUS's label over two lines and pushed "Consumer
    // Cyclical" against the edge.
    //
    // ⚠️ A wrapped cell is not an ERROR, which is why nothing caught it: the table
    // renders, scrolls correctly, clips nothing, and passes every other assertion
    // in this file. It just looks cramped. So the assertion has to be on the
    // rendered LINE COUNT, and it is measured on content height rather than box
    // height — a cell carries 9px of padding top and bottom, so measuring the box
    // scores every single-line cell as two and reports a defect on every table.
    await page.setViewportSize({ width: 1280, height: 1000 });
    let checked = 0;
    for (const path of PATHS.filter((p) => p.includes('furthest-below-their-highs'))) {
      await page.goto(path);
      await ready(page);
      const wrapped = await page.evaluate(() => {
        const t = [...document.querySelectorAll('.art-table')].find((x) =>
          x.querySelector('.art-right'),
        );
        if (!t) return null;
        const lines = (el: HTMLElement) => {
          const cs = getComputedStyle(el);
          const inner =
            el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          return Math.round(inner / parseFloat(cs.lineHeight));
        };
        return [...t.querySelectorAll('tbody th, tbody td')]
          .filter((c) => lines(c as HTMLElement) > 1)
          .map((c) => (c.textContent ?? '').trim());
      });
      expect(wrapped, `${path}: no table carries an alignRight column`).not.toBeNull();
      expect(
        wrapped,
        `${path}: these cells wrap onto a second line at the reading width — the column is too narrow`,
      ).toEqual([]);
      checked += 1;
    }
    // The control: three ranked articles, three tables measured. Without it, a
    // renamed slug would empty the filter and this would pass having checked
    // nothing (CLAUDE.md 14g).
    expect(checked, 'no ranked tables were measured — the slug filter is stale').toBe(3);
  });

  test('a table scrolls inside its own box — the page never does', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of [ARTICLES_INDEX_PATH, ...PATHS]) {
      await page.goto(path);
      await ready(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} scrolls sideways at 375px`).toBeLessThanOrEqual(1);
    }
  });

  test('an article body carries no italic text', async ({ page }) => {
    // Owner instruction, 2026-08-29: long runs of italic prose read as
    // machine-written. Emphasis is carried by <strong> and by sentence
    // construction. Asserted on the COMPUTED style, because `<em>` is only one of
    // several ways to arrive at italics.
    for (const path of PATHS) {
      await page.goto(path);
      await ready(page);
      const italics = await page.evaluate(() =>
        [...document.querySelectorAll('[data-article-body] *')]
          .filter((n) => getComputedStyle(n).fontStyle === 'italic')
          .map((n) => (n.textContent ?? '').slice(0, 60)),
      );
      expect(italics, `${path} renders italic text`).toEqual([]);
    }
  });

  test('the article page uses the document scale, same as a legal page', async ({ page }) => {
    // The owner's decision was that the article page gets NO new design — the
    // Learn article pages already show it. So the two must measure the same.
    const measure = async (path: string) => {
      await page.goto(path);
      await ready(page);
      return page.evaluate(() => {
        const el = document.querySelector('[data-article-body] p') ?? document.querySelector('article p');
        const h1 = document.querySelector('article h1');
        return {
          body: el ? getComputedStyle(el).fontSize : null,
          h1: h1 ? getComputedStyle(h1).fontSize : null,
        };
      });
    };
    const article = await measure(PATHS[0]!);
    const learn = await measure('/learn/what-is-a-drawdown');
    expect(article).toEqual(learn);
  });

  test('the JSON-LD points at the page it is on', async ({ page }) => {
    // ⚠️ `articleJsonLd` templated `/learn/${slug}` until this section existed,
    // which would have published a URL pointing at a 404 and disagreeing with the
    // canonical tag on the same page — while rendering perfectly (11c-iv).
    for (const a of ARTICLES) {
      await page.goto(articlePath(a.slug));
      const [ld, canonical] = await Promise.all([
        page.locator('script[type="application/ld+json"]').first().textContent(),
        page.locator('link[rel="canonical"]').getAttribute('href'),
      ]);
      expect(ld, 'no JSON-LD on the article page').toBeTruthy();
      const graph = JSON.parse(ld!)['@graph'] as Record<string, unknown>[];
      const node = graph.find((n) => n['@type'] === 'Article');
      expect(node, 'no Article node in the graph').toBeTruthy();
      expect(node!.url).toBe(canonical);
    }
  });
});
