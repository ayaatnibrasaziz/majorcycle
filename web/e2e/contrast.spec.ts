import { expect, test } from '@playwright/test';

/**
 * WCAG contrast, measured in the real page.
 *
 * Layer G's design work fixed two ratios that had been wrong for the life of the
 * site: the rating tier badges at **2.38:1** — the product's entire vocabulary
 * set in the least readable text on the page — and the "Full disclaimer" link at
 * **2.69:1**, which CLAUDE.md #4/#12 make legally material. Neither was visible
 * to review. Both looked completely fine.
 *
 * A ratio nobody measures goes back to being wrong the first time somebody
 * reaches for `--text-muted` because it "looks lighter". So the measurement is
 * the guard, not a note in a document. Same doctrine as CLAUDE.md 11a: say it
 * AND guard it.
 *
 * Credential-free — no login, no network beyond the dev server — so it runs on a
 * fork PR and cannot self-skip.
 *
 * ⚠️ Measured on the RENDERED page, never computed from the token values. The
 * bug that produced the worst finding here was a specificity accident:
 * `.reading a { color }` outranked Tailwind's `.text-white` and painted the
 * call-to-action brand-blue on a brand-blue button (1.0:1, invisible). Every
 * token involved was correct. Only the composite was wrong.
 */

/** Pages whose text a reader is expected to actually read. */
const READING_PAGES = ['/methodology', '/disclaimer', '/terms', '/privacy'];

/**
 * The one element still under the floor, and it is deliberate: the 9px
 * "Financial Terminal" wordmark in the shared public header measures 2.69:1.
 * design-system.md §14 assigns it to Layer H with the rest of the sweep.
 *
 * It is listed BY TEXT rather than raised as a threshold, so the exemption
 * cannot quietly cover a second element. If the header is restyled and this
 * stops failing, the last assertion in this file turns red and says so — an
 * allow-list that is never checked for staleness becomes a blindfold.
 */
const KNOWN_DEFERRED = ['Financial Terminal'];

/** Serialised into the page; keep it dependency-free. */
const PROBE = `(() => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => {
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,\\s\\/]+/).filter((x) => x !== '').map(Number);
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  // Composite every translucent ancestor, outermost first. A tinted badge on a
  // white card is the whole reason the tier fix works, and a probe that stopped
  // at the first background would score it against nothing.
  const bgOf = (el) => {
    let n = el, acc = [255, 255, 255];
    const stack = [];
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) stack.push(c);
      n = n.parentElement;
    }
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };
  const ratio = (a, b) => {
    const L1 = lum(a), L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };

  const out = { measured: 0, sizes: [], fails: [] };
  const seen = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    // Own text only: an ancestor inherits colour but not necessarily background,
    // and counting it twice would score the wrong pairing.
    const txt = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!txt) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    const fs = parseFloat(cs.fontSize);
    seen.add(fs);
    const fg = parse(cs.color);
    if (!fg) return;
    const bg = bgOf(el);
    const r = ratio(over(fg, bg), bg);
    // WCAG "large text" = 24px, or 18.66px when bold.
    const need = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5;
    out.measured++;
    if (r < need) out.fails.push({ text: txt.slice(0, 60), fontSize: fs, ratio: +r.toFixed(2), need });
  });
  out.sizes = [...seen].sort((a, b) => a - b);
  return out;
})()`;

interface Fail {
  text: string;
  fontSize: number;
  ratio: number;
  need: number;
}
interface Probe {
  measured: number;
  sizes: number[];
  fails: Fail[];
}

async function measure(page: import('@playwright/test').Page, path: string): Promise<Probe> {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  // Prove we are on the page we think we are. A public route that starts
  // redirecting to /login would otherwise be measured as a clean pass, which is
  // exactly how "unmeasurable counted as clean" has bitten this repo before.
  expect(new URL(page.url()).pathname, `${path} did not stay put`).toBe(path);

  // ⚠️ WAIT FOR THE STYLESHEET, don't assume it. Without this the suite was
  // genuinely flaky: the same deliberate break reported "1 failed" on one run
  // and "4 failed" on the next, because on a cold dev-server compile the probe
  // could run before the reading stylesheet had been applied — and an unstyled
  // page has no low-contrast text to find, so it scores as PERFECT.
  //
  // A contrast guard that reports clean when it cannot see is the same failure
  // mode as check_invariants() finding zero violations over a universe missing
  // the field it inspects (CLAUDE.md 14g). The sentinel is a value that can only
  // be true once `.reading` is live: --rd-body, which nothing else sets.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.reading');
      return !!el && parseFloat(getComputedStyle(el).fontSize) === 17;
    },
    undefined,
    { timeout: 10_000 },
  );

  return page.evaluate(PROBE) as Promise<Probe>;
}

const unexpected = (p: Probe): Fail[] =>
  p.fails.filter((f) => !KNOWN_DEFERRED.some((k) => f.text.includes(k)));

for (const path of READING_PAGES) {
  test(`${path} — every readable element clears the WCAG floor`, async ({ page }) => {
    const probe = await measure(page, path);

    // The control. Negative assertions are vacuously true against an empty page,
    // so a blank render must not read as a perfect score.
    expect(probe.measured, `${path} rendered no text to measure`).toBeGreaterThan(20);

    expect(
      unexpected(probe),
      `Contrast failures on ${path}:\n${JSON.stringify(unexpected(probe), null, 2)}`,
    ).toEqual([]);
  });
}

test('/methodology — the five tier labels are legible', async ({ page }) => {
  // The specific regression this exists for. Asserting the page has no failures
  // would pass if the legend disappeared entirely, so name the five and count them.
  await page.goto('/methodology', { waitUntil: 'networkidle' });
  const badges = page.locator('.tier-legend .tier-badge');
  await expect(badges).toHaveCount(5);
  await expect(badges).toHaveText([
    'High Conviction',
    'Constructive',
    'Neutral',
    'Cautious',
    'Bearish',
  ]);
});

test('the reading scale holds its 12px floor on content pages', async ({ page }) => {
  // The leaked app scale put five 8px elements on /methodology. The public header
  // is shared chrome and still carries 9px / 10.5px (Layer H), so measure the
  // article only — the part Layer G actually rebuilt.
  const probe = (await measure(page, '/methodology')) as Probe;
  const inArticle = await page.evaluate(() => {
    const el = document.querySelector('article');
    if (!el) return null;
    const s = new Set<number>();
    el.querySelectorAll('*').forEach((n) => {
      const has = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim());
      if (has) s.add(parseFloat(getComputedStyle(n).fontSize));
    });
    return [...s].sort((a, b) => a - b);
  });
  expect(inArticle, 'no <article> on /methodology').not.toBeNull();
  expect(Math.min(...inArticle!), `sizes found: ${inArticle}`).toBeGreaterThanOrEqual(12);
  // Seven steps exist; a page need not use all of them, but nine distinct sizes
  // on one article is the thing that read as inconsistency rather than hierarchy.
  expect(inArticle!.length, `sizes found: ${inArticle}`).toBeLessThanOrEqual(7);
  expect(probe.measured).toBeGreaterThan(20);
});

test('the deferred exemption is still real, not stale', async ({ page }) => {
  // If the header gets fixed early, KNOWN_DEFERRED must shrink with it. An
  // allow-list nobody re-checks silently widens into a blindfold.
  const probe = await measure(page, '/methodology');
  const still = probe.fails.filter((f) => f.text.includes('Financial Terminal'));
  expect(
    still.length,
    'The 9px header wordmark now passes — delete it from KNOWN_DEFERRED.',
  ).toBe(1);
});
