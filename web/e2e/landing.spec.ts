import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import landingSnapshot from '../app/landing-snapshot.json';
import universeCountFile from '../app/universe-count.json';
import mag7Snapshot from '../app/mag7-snapshot.json';
import { FILM_LINES, FILM_SECONDS } from '../lib/landingFilm';
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
 * The six approved sections (rebuilt around the landing film, November 2026), each
 * identified by something a reader would actually miss. Headings where there is
 * one; otherwise the piece of furniture that IS the section: the film, the strip,
 * the table.
 */
const SECTIONS: { name: string; find: (p: import('@playwright/test').Page) => unknown }[] = [
  {
    name: '① the hook — headline and the fold disclaimer',
    find: (p) => p.getByRole('heading', { level: 1, name: /Which ones are worth your time/ }),
  },
  { name: '① the film', find: (p) => p.locator('.lp [data-film] video') },
  { name: '② the proof strip', find: (p) => p.locator('.lp .strip .cell').nth(3) },
  {
    name: '③ the three checks',
    find: (p) => p.getByRole('heading', { name: 'Every company gets the same three checks.' }),
  },
  { name: '④ the worked run — ranked results table', find: (p) => p.locator('.lp .results-table') },
  {
    name: '⑤ free vs paid',
    find: (p) => p.getByRole('heading', { name: 'The data is free. Our judgement is the paid part.' }),
  },
  {
    name: '⑥ before you use it — the honesty band',
    find: (p) => p.getByRole('heading', { name: /What this is, and what it isn.t/ }),
  },
];

/**
 * The same sections as literal substrings, for asserting against the raw server
 * bytes rather than the hydrated DOM. Deliberately duplicated from SECTIONS rather
 * than derived: a locator cannot be run against a string, and the point of this
 * list is to be checkable before any JavaScript exists.
 */
const SERVER_MARKERS = [
  'Which ones are worth your time?',
  'data-film',
  'Every company gets the same three checks.',
  'results-table',
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

  test('the three check cards each carry their picture', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.lp #how-it-works .steps .check-icon')).toHaveCount(3);
  });
});

/**
 * The landing film.
 *
 * The words are real text beside the video, timed from `lib/landingFilm.ts`. That
 * file is a COPY of the scene starts in the film's source, so a re-cut film would
 * leave the lines changing at the wrong moments with nothing red anywhere.
 */
test.describe('the landing film', () => {
  const film = '.lp [data-film]';
  const FILES = [
    '/film/majorcycle-1080.webm',
    '/film/majorcycle-1080.mp4',
    '/film/majorcycle-720.webm',
    '/film/majorcycle-720.mp4',
  ];

  test('the lines are timed to the video file itself', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const duration = await page.evaluate(async (sel) => {
      const v = document.querySelector<HTMLVideoElement>(`${sel} video`)!;
      if (!(v.duration > 0)) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
      return v.duration;
    }, film);
    // An audio track can run a few hundredths past the last picture.
    expect(
      Math.abs(duration - FILM_SECONDS),
      `the video is ${duration}s, the lines assume ${FILM_SECONDS}s`,
    ).toBeLessThan(0.25);
    // Starts rise, begin at zero and end inside the film.
    expect(FILM_LINES[0]!.at).toBe(0);
    for (let i = 1; i < FILM_LINES.length; i++) {
      expect(FILM_LINES[i]!.at).toBeGreaterThan(FILM_LINES[i - 1]!.at);
    }
    expect(FILM_LINES.at(-1)!.at).toBeLessThan(duration);
  });

  test('all nine lines are in the document, in order', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const titles = await page.locator(`${film} .film-line-title`).allTextContents();
    expect(titles.map((t) => t.replace(/^\d/, '').trim())).toEqual(FILM_LINES.map((l) => l.title));
  });

  test('the line follows the picture', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    for (const i of [1, 4, 8, 0]) {
      const at = FILM_LINES[i]!.at + 0.6;
      await page.evaluate(
        ([sel, t]) => {
          const v = document.querySelector<HTMLVideoElement>(`${sel} video`)!;
          v.pause();
          v.currentTime = t;
        },
        [film, at] as const,
      );
      await expect(page.locator(`${film} .film-line[data-on] .film-line-title`)).toContainText(
        FILM_LINES[i]!.title,
      );
    }
    // CONTROL: exactly one line is on at a time, or the loop above passes on a film showing them all.
    await expect(page.locator(`${film} .film-line[data-on]`)).toHaveCount(1);
  });

  test('it starts by itself, silent, and the voice is the reader’s choice', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const state = () =>
      page.evaluate((sel) => {
        const v = document.querySelector<HTMLVideoElement>(`${sel} video`)!;
        return { paused: v.paused, muted: v.muted, autoplay: v.autoplay };
      }, film);
    await expect.poll(async () => (await state()).paused).toBe(false);
    expect(await state()).toMatchObject({ muted: true, autoplay: false });

    const sound = page.getByRole('button', { name: /Voice-over/ });
    // No "AI voice" label anywhere on the film (owner, 15 Nov 2026).
    await expect(page.locator(film)).not.toContainText('AI voice');
    await expect(sound).toHaveAttribute('aria-pressed', 'false');

    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    expect((await state()).muted).toBe(false);
    await expect(page.locator(film)).not.toContainText('AI voice');

    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    expect((await state()).muted).toBe(true);
  });

  test('every video file really carries a voice track', () => {
    // A sound button over a silent file works perfectly and says nothing. Read off
    // the files rather than a browser: the test browser ships without the MP4
    // decoder, and the MP4 is what Safari plays. Each container names its audio
    // codec in plain bytes.
    for (const f of FILES) {
      const bytes = readFileSync(path.join(process.cwd(), 'public', f)).toString('latin1');
      const marker = f.endsWith('.webm') ? 'A_OPUS' : 'mp4a';
      expect(bytes.includes(marker), `${f} has no audio track (${marker} not found)`).toBe(true);
    }
  });

  test('the voice track is decoded when the film plays', async ({ page }) => {
    // The control on the test above for the format this browser can play: a
    // codec named in the file is not yet sound coming out.
    await page.goto('/', { waitUntil: 'networkidle' });
    const decoded = await page.evaluate(async (url) => {
      const v = document.createElement('video');
      v.muted = true;
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.addEventListener('loadeddata', () => resolve(), { once: true });
        v.addEventListener('error', () => reject(new Error('cannot load ' + url)), { once: true });
      });
      await v.play();
      await new Promise((r) => setTimeout(r, 1500));
      return (v as HTMLVideoElement & { webkitAudioDecodedByteCount?: number }).webkitAudioDecodedByteCount ?? -1;
    }, FILES[2]!);
    test.skip(decoded === -1, 'this engine does not report decoded audio bytes');
    expect(decoded, 'no audio was decoded from the 720p WebM').toBeGreaterThan(0);
  });

  test('a paused film that is asked for its voice plays', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const paused = () =>
      page.evaluate((sel) => document.querySelector<HTMLVideoElement>(`${sel} video`)!.paused, film);
    await expect.poll(paused).toBe(false);
    await page.getByRole('button', { name: 'Pause the film' }).click();
    await expect.poll(paused).toBe(true);
    await page.getByRole('button', { name: /Voice-over/ }).click();
    await expect.poll(paused).toBe(false);
  });

  test('a reader who asked for less motion gets the still, and can still press play', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'networkidle' });
    const paused = () =>
      page.evaluate((sel) => document.querySelector<HTMLVideoElement>(`${sel} video`)!.paused, film);
    expect(await paused()).toBe(true);
    await expect(page.locator(`${film} .film-still`)).toBeVisible();
    await expect(page.locator(`${film} .film-line`).last()).toHaveCSS('opacity', '1');
    await page.getByRole('button', { name: 'Play the film' }).click();
    await expect.poll(paused).toBe(false);
    await expect(page.locator(`${film} .film-still`)).toBeHidden();
    await context.close();
  });

  test('the controls and the lines stay inside the film at every width', async ({ page }) => {
    for (const width of [320, 375, 600, 768, 1024, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Voice-over/ }).click();
      const out = await page.evaluate((sel) => {
        const frame = document.querySelector(`${sel} .film-frame`)!.getBoundingClientRect();
        const fig = document.querySelector(sel)!.getBoundingClientRect();
        const bad: string[] = [];
        const boxes = [...document.querySelectorAll(`${sel} .film-toggle`)].map(
          (e) => e.getBoundingClientRect(),
        );
        boxes.forEach((r, i) => {
          if (r.left < frame.left + 2 || r.right > frame.right - 2 || r.top < frame.top + 2 || r.bottom > frame.bottom - 2)
            bad.push(`control ${i} leaves the frame`);
          for (const q of boxes.slice(i + 1))
            if (r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom)
              bad.push(`control ${i} overlaps another`);
        });
        // Every line, not only the one showing: the longest is the one that reaches
        // the controls, and it is on screen for four seconds in thirty-five.
        for (const line of document.querySelectorAll(`${sel} .film-line:not([data-in-picture])`)) {
          for (const part of line.children) {
            const r = part.getBoundingClientRect();
            if (r.left < fig.left - 1 || r.right > fig.right + 1) bad.push('a line is wider than the film');
            for (const q of boxes)
              if (r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom)
                bad.push(`"${(part.textContent ?? '').slice(0, 24)}" runs under a control`);
          }
        }
        return { bad, controls: boxes.length };
      }, film);
      expect(out.bad, `at ${width}px`).toEqual([]);
      expect(out.controls, 'nothing was measured').toBe(2);
    }
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

    // ⚠️ The count moved OUT of landing-snapshot.json on 2026-09-01 (finding
    // 5A-013): it is a live fact on its own nightly lifecycle, while the
    // snapshot beside it is a frozen worked example. Same rule as before —
    // built FROM the file, never typed here.
    const n = universeCountFile.universeCount;
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
