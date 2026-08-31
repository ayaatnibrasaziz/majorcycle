import { expect, test } from '@playwright/test';

import landingSnapshot from '../app/landing-snapshot.json';
import mag7Snapshot from '../app/mag7-snapshot.json';
import { mag7Facts, type Mag7Snapshot } from '../lib/mag7';

/**
 * The landing page.
 *
 * ⚠️ Read the first test before changing anything here. The landing page was
 * recorded COMPLETE in G2 while missing twelve of its sixteen approved sections,
 * and its only guard at the time asserted SEO tags and that gated routes stayed
 * gated — both of which passed, correctly, the whole time. **A missing section
 * renders perfectly.** There is no error, no blank space and no failing
 * assertion; the page simply stops earlier than it should and looks deliberate.
 *
 * That is why the inventory below names things instead of counting them. A count
 * survives a section being dropped and another being duplicated; a name does not.
 * (CLAUDE.md 11j.)
 */

const MAG7 = mag7Snapshot as Mag7Snapshot;

/**
 * The eight approved sections, each identified by something a reader would
 * actually miss. Headings where there is one; otherwise the piece of furniture
 * that IS the section — the strip, the table, the map.
 */
const SECTIONS: { name: string; find: (p: import('@playwright/test').Page) => unknown }[] = [
  {
    name: '① the hook — headline, briefing card and the fold disclaimer',
    find: (p) => p.getByRole('heading', { level: 1, name: /Which ones are actually on sale/ }),
  },
  { name: '② the proof strip', find: (p) => p.locator('.lp .strip .cell').nth(3) },
  {
    name: '③ how a scan works — three steps',
    find: (p) => p.getByRole('heading', { name: 'Three decisions, then a ranked list.' }),
  },
  { name: '④ the worked run — ranked results table', find: (p) => p.locator('.lp .results-table') },
  {
    name: '⑤ what a Major Cycle is — the two rulers',
    find: (p) => p.getByRole('heading', { name: /Shares don.t fall in a straight line/ }),
  },
  {
    name: '⑥ cheap isn’t enough — opportunity map and rating weights',
    find: (p) => p.getByRole('heading', { name: 'A falling price is not the same as a bargain.' }),
  },
  {
    name: '⑦ free vs paid',
    find: (p) => p.getByRole('heading', { name: 'The data is free. Our judgement is the paid part.' }),
  },
  {
    name: '⑧ before you use it — the honesty band',
    find: (p) => p.getByRole('heading', { name: /What this is, and what it isn.t/ }),
  },
];

/**
 * The same eight sections as literal substrings, for asserting against the raw
 * server bytes rather than the hydrated DOM. Deliberately duplicated from
 * SECTIONS rather than derived: a locator cannot be run against a string, and
 * the point of this list is to be checkable before any JavaScript exists.
 * Entities are how Next serialises them — `'` becomes `&#x27;`.
 */
const SERVER_MARKERS = [
  'Which ones are actually on sale?',
  'Three decisions, then a ranked list.',
  'results-table',
  'Shares don',
  'A falling price is not the same as a bargain.',
  'The data is free. Our judgement is the paid part.',
  'What this is, and what it isn',
];

test.describe('the landing page has every approved section', () => {
  for (const s of SECTIONS) {
    test(`renders ${s.name}`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(
        s.find(page) as ReturnType<typeof page.locator>,
        `the landing page is missing section ${s.name} — it renders perfectly without it`,
      ).toBeVisible();
    });
  }

  test('the two rulers and the map both draw', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // Named separately from section ⑤/⑥ above: the heading can be present while
    // the instrument beneath it fails to render, which is the same class of
    // silent loss one level down.
    await expect(page.locator('.lp .ruler')).toHaveCount(2);
    await expect(page.locator('.lp .map .dot')).toHaveCount(MAG7.rows.length);
  });
});

/**
 * The scroll-reveal motion must never be the thing that HIDES content.
 *
 * `LandingMotion` sets `data-motion` on the `.lp` root, and every "hidden" rule
 * in landing.css is scoped behind that attribute. So the server's markup is the
 * FINAL state and JavaScript only ever *arms* the starting one. Built the usual
 * way — hidden in CSS, revealed by JS — any failure of the script strands the
 * whole page, with nothing red on either side.
 *
 * ⚠️ **These tests do NOT use `javaScriptEnabled: false`, and the reason is a
 * finding in its own right.** That was the first version, and it failed — but
 * not for this reason. `app/loading.tsx` puts a Suspense boundary around every
 * route, and React streams any page whose HTML overruns the first flush into a
 * `<div hidden>` that an inline `$RC` script swaps into place. With scripting
 * off that swap never happens, so `/` (108 KB), `/terms`, `/privacy` and
 * `/disclaimer` (42–46 KB) all show the "Loading…" fallback forever, while the
 * four AuthCard pages (25–28 KB) render normally. Measured on a production
 * build, deterministic over three runs. That is a platform-level behaviour of
 * OUR OWN root loading boundary, not a fault in this page's motion — and a
 * no-JS assertion here would have blamed the motion for it forever.
 *
 * So these assert the CSS contract directly: with the flag ABSENT — which is
 * exactly the state the server ships and the state a stalled script leaves
 * behind — nothing on the page may be hidden.
 */
test.describe('the motion arms the page, it does not gate it', () => {
  test('the server ships the final state — no armed flag in the payload', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    const html = (await res!.text()) as string;

    // Every section is in the SERVER's bytes, not merely in the hydrated DOM.
    for (const marker of SERVER_MARKERS) {
      expect(html, `section marker missing from the server HTML: ${marker}`).toContain(marker);
    }

    // `data-motion` is added by the client on mount. If it ever ships from the
    // server, every `:not(.in)` rule engages before there is anything to add
    // the class, and the page arrives permanently armed.
    expect(html, 'the server rendered data-motion — the page ships pre-hidden').not.toContain(
      'data-motion',
    );
  });

  test('with the flag stripped, every section is still visible at full size', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // ⚠️ Wait for the flag to APPEAR before stripping it. `networkidle` says the
    // network went quiet, not that React hydrated and ran the effect — so a
    // strip issued too early is simply undone a moment later when LandingMotion
    // mounts, re-arms the root, and reveals only what is currently on screen.
    // Everything below the fold then measures opacity 0 and the failure reads as
    // a CSS defect. That is exactly what made this flaky: it passed alone on a
    // warm build and failed in a full suite, and the first "fix" (killing
    // transitions) was real but treated a second symptom of the same race.
    // A precondition has to cover what the measurement depends on, not merely
    // something that correlates with readiness (coding-standards §14 item 8).
    await page.waitForFunction(() => document.querySelector('.lp')?.hasAttribute('data-motion'), undefined, {
      timeout: 10_000,
    });

    // Reproduce the no-script CSS state: no flag, and no reveal classes to
    // stand in for one. Anything the motion hides will collapse here.
    //
    // ⚠️ Transitions are killed FIRST, and that is not tidiness — it is what
    // makes this measurable. Sections below the fold have not been revealed
    // yet, so stripping the flag starts them TRANSITIONING toward the final
    // state rather than arriving at it. Measured immediately, they return
    // whatever value the animation happens to be passing through. That is
    // exactly what made this test flaky — green alone, red in a full run — and
    // it is why the deliberate break first reported `opacity 0.0155657`
    // instead of a clean 0. We are asserting the STATIC end state the CSS
    // computes, so the animation has to be out of the way.
    await page.addStyleTag({
      content: '.lp, .lp * { transition: none !important; animation: none !important; }',
    });
    await page.evaluate(() => {
      const root = document.querySelector('.lp');
      root?.removeAttribute('data-motion');
      root?.querySelectorAll('.in').forEach((el) => el.classList.remove('in'));
    });

    for (const s of SECTIONS) {
      await expect(
        s.find(page) as ReturnType<typeof page.locator>,
        `${s.name} disappears when the motion flag is absent — it is gating content, not animating it`,
      ).toBeVisible();
    }

    // ⚠️ `toBeVisible()` alone CANNOT catch this, and proving that is why the
    // break-on-purpose ran: Playwright treats `opacity: 0` as visible — it
    // checks the box and `visibility`/`display`, nothing else. Unscoping the
    // armed rule (`.lp[data-motion] [data-rise]` → `.lp [data-rise]`) hides
    // every section behind `opacity: 0` and the eight assertions above stayed
    // green twice. The armed state IS opacity and transform, so that is what
    // has to be measured.
    const armed = await page.evaluate(() =>
      [...document.querySelectorAll('.lp [data-rise]')].map((el, i) => {
        const s = getComputedStyle(el);
        return { i, opacity: s.opacity, transform: s.transform };
      }),
    );
    expect(armed.length, 'no [data-rise] sections found at all').toBeGreaterThan(0);
    for (const a of armed) {
      expect(
        Number(a.opacity),
        `section ${a.i} computes opacity ${a.opacity} with no motion flag — the reveal is gating content`,
      ).toBe(1);
      expect(
        a.transform,
        `section ${a.i} is still offset (${a.transform}) with no motion flag`,
      ).toBe('none');
    }

    // Present-but-zero-width is the failure this page actually had: the ruler
    // fills once animated from their final value to their final value because
    // an inline `style` out-specified the armed rule. Assert real geometry.
    const fills = page.locator('.lp .ruler-fill');
    const n = await fills.count();
    expect(n, 'no ruler fills found at all').toBeGreaterThan(0);
    for (let i = 0; i < n; i += 1) {
      const box = await fills.nth(i).boundingBox();
      expect(box?.width ?? 0, `ruler fill ${i} is zero-width with the flag absent`).toBeGreaterThan(1);
    }
  });
});

test.describe('the landing page tells the truth about its own run', () => {
  /**
   * Pure — no browser, no network. The page states counts and rankings in
   * PROSE ("4 rate Constructive or better", "still comes seventh"). The approved
   * artifact's copy said five and sixth; regenerating the run made both false, and
   * nothing anywhere would have gone red. These assert the derivation, so the
   * sentences cannot drift from the table printed directly above them.
   */
  test('mag7Facts agrees with the rows it derives from', () => {
    const f = mag7Facts(MAG7);

    expect(f.total).toBe(MAG7.rows.length);
    expect(f.constructiveOrBetter).toBe(MAG7.rows.filter((r) => r.overallRating >= 65).length);
    expect(f.cautiousOrWorse).toBe(MAG7.rows.filter((r) => r.overallRating < 50).length);

    // The standout really is the highest-rated row.
    expect(f.top.overallRating).toBe(Math.max(...MAG7.rows.map((r) => r.overallRating)));
    // The stock said to have "fallen furthest" really has.
    expect(f.deepestFall.currentDrawdownPct).toBe(
      Math.min(...MAG7.rows.map((r) => r.currentDrawdownPct)),
    );
    // The business the callout calls weakest really is.
    expect(f.weakest.healthScore).toBe(Math.min(...MAG7.rows.map((r) => r.healthScore)));
    expect(f.healthiest.healthScore).toBe(Math.max(...MAG7.rows.map((r) => r.healthScore)));

    // The rank word is a word, and it points at the right row.
    const ranked = [...MAG7.rows].sort((a, b) => b.overallRating - a.overallRating);
    const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
    expect(f.deepestFallRank).toBe(words[ranked.indexOf(f.deepestFall)]);
  });

  /**
   * ⚠️ Two snapshots describe the same Apple on the same page — section ⑤ from
   * `landing-snapshot.json`, section ④'s table row from `mag7-snapshot.json`. They
   * are built by two scripts on two schedules, and on 2026-08-15 they were a day
   * apart: the rulers said Apple was 12.2% below its high while the table three
   * screens up said 11.3%. Both figures were real; only one could be current, and
   * a reader who noticed would be right to stop trusting the page.
   */
  test('both snapshots agree about Apple, on one date', () => {
    const row = MAG7.rows.find((r) => r.ticker === 'AAPL');
    expect(row, 'AAPL is the landing page’s worked example — it must be in the Mag 7 run').toBeDefined();

    expect(landingSnapshot.asOf, 'the two snapshots are from different days').toBe(MAG7.asOf);
    expect(landingSnapshot.currentDrawdownPct).toBe(row!.currentDrawdownPct);
    expect(landingSnapshot.typicalDrawdownPct).toBe(row!.typicalDrawdownPct);
    expect(landingSnapshot.deepestDrawdownPct).toBe(row!.lowerBoundPct);
    expect(landingSnapshot.pullbackEvents).toBe(row!.pullbackEvents);
  });

  test('the briefing card prints the derived counts, not typed ones', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const f = mag7Facts(MAG7);
    const briefing = page.locator('.lp .briefing');

    await expect(briefing).toContainText(
      `Of ${f.total} stocks analysed, ${f.constructiveOrBetter} rate Constructive or better`,
    );
    await expect(briefing).toContainText(f.top.ticker);
    // The ring's number and the sentence's number are the same claim rendered
    // twice; they were allowed to disagree in the artifact.
    await expect(briefing.locator('.briefing-ring-num')).toHaveText(String(f.constructiveOrBetter));
  });

  /**
   * How many companies we cover, in five places, from the database.
   *
   * ⚠️ This was FIVE TYPED LITERALS until 2026-08-19, and they were already
   * wrong: the page said **863** while the database held **866**. The universe
   * auto-expands on every reader's ticker request (CLAUDE.md #16), so the copy
   * was a claim the product actively works to falsify — and it drifts silently,
   * because a stale count is still a fluent, specific, plausible sentence.
   *
   * The assertion is built FROM the snapshot rather than from a number typed
   * here, or this test would be a sixth copy to drift (11c-v). The control
   * below proves it is value-sensitive rather than merely finding some digits.
   *
   * ⚠️ And it asserts whole PHRASES, spaces included, on purpose. All five
   * sites are `text {EXPR} text` — the exact arrangement that silently swallowed
   * a space in the drawdown article on this same day. A number-only assertion
   * would pass on "all866 companies".
   */
  test('every companies-covered figure comes from the snapshot, spaces and all', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const n = landingSnapshot.universeCount;
    const shown = n.toLocaleString('en-AU');
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');

    // The hero, the free-tier list and the honesty block — each as a full phrase.
    expect(body, 'the hero headline').toContain(`${shown} companies.`);
    expect(body, 'the free-tier list').toContain(`Browse all ${shown} companies across three markets`);
    expect(body, 'the honesty block').toContain(`narrows ${shown} companies down to`);

    // The stats band renders the bare figure in its own cell.
    await expect(page.locator('.strip .cell', { hasText: 'companies covered' }).locator('.v')).toHaveText(
      shown,
    );

    // And the meta description, which no reader sees and every search engine does.
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      new RegExp(`ranks ${shown} US, Australian and Canadian companies`),
    );

    // CONTROL — an off-by-one must NOT be found, or the assertions above would
    // pass on any page that happens to contain the digits somewhere.
    expect(body, 'a neighbouring value also matches — the check is not value-sensitive').not.toContain(
      `${(n + 1).toLocaleString('en-AU')} companies`,
    );
  });
});

test.describe('the landing page’s layout holds', () => {
  test('the dark band bleeds to both edges of the window', async ({ page }) => {
    // The landing cancels the public layout's own `main` padding with negative
    // margins — a coupling between two files that inspection will not catch. The
    // first attempt wrote it in px against a 14px root and left the band 2.5px off
    // the left edge, which is invisible until you measure it.
    await page.goto('/', { waitUntil: 'networkidle' });
    const box = await page.evaluate(() => {
      const el = document.querySelector('.lp .dark');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, width: r.width, viewport: document.documentElement.clientWidth };
    });
    expect(box, 'no dark honesty band on the page at all').not.toBeNull();
    // Bounded on BOTH sides: `left <= 0` alone passes for a band hanging a mile
    // off-screen, which is the "bound on one side only" trap from CLAUDE.md 11i.
    expect(Math.abs(box!.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.width - box!.viewport)).toBeLessThanOrEqual(1);
  });

  test('no horizontal scroll at 375px', async ({ page }) => {
    // CLAUDE.md #3. The bleed means an overflowing child now overflows the
    // WINDOW rather than a padded box, so this is the guard that makes the
    // negative margins safe. The ten-column table is deliberately wider than a
    // phone and scrolls inside its own wrapper.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const { doc, win } = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: document.documentElement.clientWidth,
    }));
    expect(doc, `the page scrolls sideways at 375px (${doc}px wide in a ${win}px window)`).toBeLessThanOrEqual(win);
  });

  test('the disclaimer is visible without scrolling', async ({ page }) => {
    // CLAUDE.md #4/#12/#24 — a page showing ratings must carry it above the fold.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const disc = page.locator('.lp .disc').first();
    await expect(disc).toBeVisible();
    const top = await disc.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(top, 'the fold disclaimer is below the fold').toBeLessThanOrEqual(800);
  });

  test('no map label collides with another label or a quadrant caption', async ({ page }) => {
    // The label sides are layout tuned to ONE set of coordinates and they expire
    // when the snapshot is regenerated — Amazon's moved into Apple's the first
    // time the run was rebuilt. Two short labels touching at a corner is not
    // something a screenshot review catches.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const hits = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('.lp .dlab, .lp .quad .ql')].map((e) => ({
        t: (e.textContent ?? '').trim(),
        r: e.getBoundingClientRect(),
      }));
      const out: string[] = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!.r;
          const b = boxes[j]!.r;
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
            out.push(`${boxes[i]!.t} ↔ ${boxes[j]!.t}`);
        }
      return out;
    });
    expect(hits, `overlapping labels on the Opportunity Map: ${hits.join(', ')}`).toEqual([]);
    // The control: if the selector ever stops matching, the loop above compares
    // nothing and passes. Seven tickers plus four captions.
    const drawn = await page.locator('.lp .dlab, .lp .quad .ql').count();
    expect(drawn, 'nothing was measured — the overlap check was vacuous').toBe(11);
  });

  test('every ruler label keeps real clearance inside its card, down to 360px', async ({ page }) => {
    // ⚠️ Two things here were learned by breaking this test on purpose and
    // watching it stay GREEN.
    //
    // 1. **360px, not 375px.** Removing the clamp this guards leaves 375px
    //    clearing by 1.1px — still technically inside, so a "does it overflow?"
    //    check at our stated 375px floor passes and proves nothing. At 360px
    //    (a common Android width) the same label goes 0.1px out, and at 320px,
    //    3.2px. The guard has to be run where the defect actually appears.
    // 2. **A margin, not a boundary.** `>= 0` treats a 1.1px accident as a pass.
    //    With the clamp every label clears by 7px at every width, so requiring 2px
    //    asserts the design instead of the edge case.
    const MIN_CLEARANCE = 2;
    for (const width of [360, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });
      const tight = await page.evaluate((min) => {
        const out: string[] = [];
        for (const mk of document.querySelectorAll<HTMLElement>('.lp .mk')) {
          const card = mk.closest('.card-body')!.getBoundingClientRect();
          const a = getComputedStyle(mk, '::after');
          // Derived from what the browser COMPUTED, never from what the rule was
          // meant to say. An earlier version assumed every label was centred and
          // reported an already-fixed label as still broken — the measurement was
          // wrong, not the code.
          const w =
            parseFloat(a.width) + parseFloat(a.paddingLeft) + parseFloat(a.paddingRight) + 2;
          const tx = a.transform === 'none' ? 0 : parseFloat(a.transform.split(',')[4] ?? '0');
          const left = mk.getBoundingClientRect().left + parseFloat(a.left) + tx;
          const clearance = Math.min(left - card.left, card.right - (left + w));
          if (clearance < min)
            out.push(`${mk.dataset['l'] ?? '?'} (${clearance.toFixed(1)}px)`);
        }
        return out;
      }, MIN_CLEARANCE);
      expect(
        tight,
        `ruler labels have under ${MIN_CLEARANCE}px clearance inside their card at ${width}px`,
      ).toEqual([]);
      // The control. If the selector stops matching, the loop above measures
      // nothing and passes — six marks, two rulers.
      expect(await page.locator('.lp .mk').count(), 'nothing was measured').toBe(6);
    }
  });
});

test.describe('the landing page publishes only what it is allowed to', () => {
  /**
   * The one bounded exception to "nothing premium on a public page": seven
   * allow-listed tickers, frozen (docs/architecture.md §7.1). The risk is not that
   * this file is wrong today — it is that the generator's ticker list is editable
   * and the boundary would move silently.
   */
  test('exactly the seven allow-listed tickers carry ratings', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const html = await page.content();

    const ALLOWED = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
    expect([...MAG7.rows.map((r) => r.ticker)].sort()).toEqual([...ALLOWED].sort());

    // Every ticker cell on the page is one of the seven.
    const shown = await page.locator('.lp .results-table .ticker-cell').allTextContents();
    expect(shown.map((t) => t.trim()).sort()).toEqual([...ALLOWED].sort());

    // And the page carries no screener output for anything else: the snapshot is a
    // static import, so an eighth stock could only arrive via a live read.
    expect(html).not.toContain('/api/analyze');
    expect(html).not.toContain('/api/cycle');
  });

  test('stays gated for everyone else', async ({ page }) => {
    // The control this whole layer rests on. A public landing page must not have
    // opened anything up behind it.
    for (const gated of ['/stocks', '/run', '/results', '/account']) {
      const res = await page.goto(gated, { waitUntil: 'domcontentloaded' });
      expect(res, `no response from ${gated}`).not.toBeNull();
      expect(page.url(), `${gated} did not bounce a signed-out reader to /login`).toContain('/login');
    }
  });
});

/**
 * GA-1: the public pages render WITHOUT JavaScript.
 *
 * ⚠️ These four used to show the word "Loading…" and nothing else with scripting
 * off. The cause was the root `app/loading.tsx`: it wrapped every route in a
 * Suspense boundary, and React streams any page whose HTML overruns the first
 * flush into a `<div hidden>` that an inline `$RC` script swaps into place. No
 * script, no swap — so `/` (108 KB) and the three legal pages (42–46 KB) stalled
 * on the fallback forever, while the smaller AuthCard pages (25–28 KB) were fine.
 * Size-dependent, which is why it looked arbitrary.
 *
 * Deleting that file (owner approved 2026-08-18) fixed it and the soft-404 in one
 * move. This is the half that proves the reader-facing symptom is gone; the
 * status-code half lives in `learn.spec.ts`.
 *
 * ⚠️ A no-JS test needs its own browser context — `javaScriptEnabled` is a
 * context option, not something a page can be told after the fact.
 */
test.describe('the public pages survive without JavaScript', () => {
  for (const path of ['/', '/terms', '/privacy', '/disclaimer', '/learn']) {
    test(`${path} renders real content with scripting off`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();

      // The symptom, named exactly: the page must not BE the fallback.
      expect(text, `${path} is still showing only the loading fallback`).not.toMatch(
        /^Loading[….]*$/,
      );
      // And it must carry a real page's worth of words, so "not exactly
      // 'Loading…'" cannot be satisfied by some other near-empty render.
      expect(text.length, `${path} rendered almost nothing without JS`).toBeGreaterThan(400);
      // The heading is the positive signal — content, not just bytes.
      await expect(page.locator('h1')).toBeVisible();

      await context.close();
    });
  }
});
