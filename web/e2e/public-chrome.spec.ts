import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';

import { PUBLIC_PAGES } from '../lib/seo';
import { FOOTER_LINKS, NAV_LINKS, showsFullChrome } from '../lib/publicNav';

/**
 * The public site's chrome, checked as LOGIC rather than as pixels.
 *
 * Two things here cannot be seen in a screenshot and cannot be reached by a
 * credential-free browser test:
 *
 *  1. **The logo-only header.** It appears on exactly two pages, and both require
 *     a session that this suite does not have — a recovery session mid-password-
 *     reset, and an account scheduled for deletion. Those are also the two pages a
 *     distressed reader sees, so "I could not check it" is not good enough. The
 *     rule is a pure function of the path, so drive the function.
 *  2. **Dead links in the chrome.** A header or footer entry pointing at a route
 *     that no longer exists renders perfectly and 404s (or worse, 307s to /login)
 *     only when someone clicks it. That is not hypothetical here: `/methodology`
 *     was named by BOTH lists, and has since been folded into the landing page —
 *     so both now point at the `#how-it-works` fragment instead.
 *
 * Pure and credential-free — no browser, no network, no secrets — so it runs on a
 * fork PR and can never self-skip (CLAUDE.md, testing row).
 */

const WEB = join(__dirname, '..');

/** Route path → the file Next would render. `/` is app/(public)/page.tsx. */
function routeFile(path: string): string {
  const dir = path === '/' ? '' : path;
  return join(WEB, 'app', '(public)', dir, 'page.tsx');
}

test.describe('the header knows which pages belong to strangers', () => {
  test('every public page gets the full header', () => {
    for (const p of PUBLIC_PAGES) {
      expect(showsFullChrome(p.path), `${p.path} should offer sign-in`).toBe(true);
    }
    // The control. `() => true` would pass the loop above and every assertion in
    // this file that says "yes"; the two below are what make it mean something.
    expect(PUBLIC_PAGES.length).toBeGreaterThan(5);
  });

  test('the two confined pages get the logo only', () => {
    for (const path of ['/account/update-password', '/reactivate']) {
      expect(showsFullChrome(path), `${path} must not offer sign-in`).toBe(false);
      // …and they must still EXIST. An allow-list that drifts off a renamed route
      // silently starts asserting nothing, which is how "unmeasurable counted as
      // clean" has bitten this repo before (CLAUDE.md 14g).
      expect(existsSync(routeFile(path)), `${path} has no page.tsx`).toBe(true);
    }
  });

  test('an unknown path does not get the full header', () => {
    // `showsFullChrome` matches exactly, never by prefix. If it ever grew a
    // `startsWith`, `/login/anything` would inherit the sign-in chrome from
    // `/login` — and proxy.ts already treats that prefix as public.
    expect(showsFullChrome('/login/__nope__')).toBe(false);
    expect(showsFullChrome('/account')).toBe(false);
  });
});

test('the header and the footer both ask the same function', () => {
  // The rule is only "one rule, one place" while both consumers actually consume
  // it (CLAUDE.md 11c). A private copy of the path list inside either component
  // would keep every assertion above green while the two drifted apart — which is
  // very nearly what happened: the header collapsed correctly on
  // /account/update-password while the footer below it still offered seven links,
  // because on the first pass only ONE of them had been given the rule.
  for (const file of ['components/PublicHeader.tsx', 'components/PublicFooter.tsx']) {
    // ⚠️ Read CODE, not prose. Both files explain the rule in a comment, and the
    // comment names the two paths — so a raw substring search fails on the very
    // sentence documenting the fix. This guard did exactly that on its first run,
    // which is the second time this project has written a check that trips on its
    // own documentation. A guard that cries wolf about a comment gets deleted.
    // Both assertions read the stripped source, so a comment can neither fail this
    // test nor satisfy it.
    const code = readFileSync(join(WEB, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code, `${file} must call showsFullChrome`).toContain('showsFullChrome(pathname)');
    for (const literal of ['/reactivate', '/account/update-password']) {
      expect(code.includes(literal), `${file} hard-codes ${literal} in code`).toBe(false);
    }
  }
});

test.describe('no dead links in the chrome', () => {
  const publicPaths = new Set(PUBLIC_PAGES.map((p) => p.path));

  for (const [name, links] of [
    ['header', NAV_LINKS],
    ['footer', FOOTER_LINKS],
  ] as const) {
    test(`every ${name} link points at a page that exists and is public`, () => {
      expect(links.length).toBeGreaterThan(0);
      for (const l of links) {
        // ⚠️ Fragments. "How it works" is `/#how-it-works` — a place on a page, not
        // a page — so the path and the fragment have to be judged separately. The
        // first version of this guard predated that and would simply have failed;
        // the interesting half is the SECOND assertion below.
        const hash = l.href.indexOf('#');
        const base = hash === -1 ? l.href : l.href.slice(0, hash);
        const fragment = hash === -1 ? '' : l.href.slice(hash + 1);
        const path = base === '' ? '/' : base;

        // A link to a gated route would render fine and then bounce the reader to
        // /login — a broken link that never 404s and so never gets reported.
        expect(publicPaths.has(path), `${name} link ${l.href} is not in PUBLIC_PAGES`).toBe(
          true,
        );
        expect(existsSync(routeFile(path)), `${name} link ${l.href} has no page.tsx`).toBe(
          true,
        );

        if (fragment) {
          // The failure a fragment link has that a path link does not: nothing
          // 404s, nothing redirects, the page loads perfectly — and the reader
          // simply stays at the top, having pressed a control that did nothing.
          // There is no error anywhere to notice. This is the same shape as the
          // footer that never got its rule (11c-iv): correct-looking, silent, and
          // only visible if you actually go and look.
          const src = readFileSync(routeFile(path), 'utf8');
          expect(
            src.includes(`id="${fragment}"`),
            `${name} link ${l.href} points at #${fragment}, but nothing in ${path} declares that id — the link would load the page and go nowhere.`,
          ).toBe(true);

          // …and the target must be scroll-safe. The header is `position: sticky`,
          // so an anchor with no scroll-margin puts the heading UNDERNEATH it: the
          // reader lands on the right section and cannot see its title. Checked in
          // source here and measured in the real browser by how-it-works.spec.ts —
          // the static half can never skip, the browser half proves the pixels.
          //
          // ⚠️ Look for the OFFSET, not for one spelling of it. This asserted the
          // literal Tailwind class `scroll-mt-[calc(var(--header-h)…]` and went red
          // when the landing page moved the identical rule into a co-located
          // stylesheet as `scroll-margin-top: calc(var(--header-h) + 20px)` —
          // nothing about the reader's experience had changed. A guard that names
          // an implementation rather than a behaviour fails on refactors and
          // teaches you to loosen it, which is how a real one gets weakened.
          const stylesheets = readdirSync(dirname(routeFile(path)))
            .filter((f) => f.endsWith('.css'))
            .map((f) => readFileSync(join(dirname(routeFile(path)), f), 'utf8'));
          const declaresOffset = [src, ...stylesheets].some(
            (text) =>
              /scroll-mt-\[calc\(var\(--header-h\)/.test(text) ||
              /scroll-margin-top:\s*calc\(var\(--header-h\)/.test(text),
          );
          expect(
            declaresOffset,
            `${path} has #${fragment} but no scroll offset for the sticky header — the reader arrives with the heading hidden behind it.`,
          ).toBe(true);
        }
      }
    });
  }
});

/**
 * The chrome's GEOMETRY, measured in a real browser against the approved design
 * system (artifact fd8cbcdc, "every public page, one design system").
 *
 * ⚠️ Why measured rather than read: every gap in this header was written as a
 * Tailwind step, and this project's root font-size is **14px**, so the rem scale
 * lands at 0.875× the number you expect. `gap-5` is 17.5px, not 20. `px-3 py-1.5`
 * is 10.5/5.25, not 12/6. Read as source it all looked deliberate; measured, the
 * whole bar was short on every axis at once. Numbers here are the artifact's.
 */
test.describe('the public chrome matches the approved design system', () => {
  const GEOMETRY: [string, string, string, string][] = [
    ['header height', 'header', 'height', '58px'],
    ['header inner gap', 'header > div', 'gap', '22px'],
    ['header side padding', 'header > div', 'padding-left', '20px'],
    ['lockup gap', 'header a', 'gap', '10px'],
    ['nav gap', 'header nav', 'gap', '2px'],
    ['nav link padding', 'header nav a', 'padding', '7px 11px'],
    ['footer padding', 'footer', 'padding', '30px 20px 36px'],
  ];

  for (const [name, selector, prop, expected] of GEOMETRY) {
    test(`${name} is ${expected}`, async ({ page }) => {
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-public-header]');
      const got = await page.evaluate(
        ([s, p]) => {
          const el = document.querySelector(s!);
          return el ? getComputedStyle(el).getPropertyValue(p!).trim() : 'NOT FOUND';
        },
        [selector, prop] as const,
      );
      expect(got, `${name}: the design system specifies ${expected}`).toBe(expected);
    });
  }

  /**
   * ⚠️ This one guards a defect class, not a number.
   *
   * `cn()` runs tailwind-merge, which files `font-semibold` and `font-[…]` in the
   * SAME conflict group — it cannot tell an arbitrary font value's family from a
   * weight. `Button` carried both, so the family silently deleted the weight and
   * EVERY button on the site rendered at 400 while button.tsx said 600 and the
   * reference design said 600. No error, no lint warning, and the class list in
   * source looked correct; only the computed style disagreed.
   *
   * Asserting the computed weight is the only thing that can see it, and it will
   * catch the next `font-*` class added to that component too.
   */
  test('buttons really render at the weight the component declares', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-public-header]');

    // ⚠️ Matched on the Button component's own family class, NOT on a rounding
    // utility. The first version of this test selected anything carrying
    // `rounded-[var(--radius-sm)]` and caught the NAV LINKS, which are correctly
    // weight 400 — the design system gives `.nav a` no weight and reserves 600
    // for the current page. That failure was the test being wrong, not the page.
    const weights = await page.evaluate(() =>
      [...document.querySelectorAll('header a, main button, main a, footer a')]
        .filter((el) => el.className.includes('[font-family:var(--font-sans)]'))
        .map((el) => ({
          text: (el.textContent ?? '').trim().slice(0, 28),
          weight: getComputedStyle(el).fontWeight,
          family: getComputedStyle(el).fontFamily.split(',')[0]!.replace(/["']/g, ''),
        })),
    );

    // Non-zero is itself an assertion, not a sanity check: the selector keys on
    // the exact class whose loss IS the defect, so "found none" means either the
    // family class was renamed or it has been merged away again. Reverting the
    // fix on purpose lands here rather than on the weight check below.
    expect(
      weights.length,
      'no Button matched `[font-family:var(--font-sans)]` — the family class was renamed or tailwind-merge has eaten it again',
    ).toBeGreaterThan(0);
    for (const w of weights) {
      expect(w.weight, `"${w.text}" renders at ${w.weight}; the component declares 600`).toBe('600');
      // The family must survive the same merge — losing it is the mirror defect.
      expect(w.family, `"${w.text}" lost its font family`).toBe('Sora');
    }
  });
});

/**
 * The two card families must agree on the geometry they share.
 *
 * ⚠️ Written as a COMPARISON, not as two copies of "30px 32px". A pair of
 * hard-coded numbers is two facts free to be edited apart — the same shape as
 * the three roundings of one analyst target (CLAUDE.md 11c iii). What actually
 * matters to a reader is that `/login` and `/terms` feel like one product, so
 * that is what is asserted: whatever the auth card's padding is, the legal
 * document's must equal it.
 *
 * This drifted for real. The auth card was corrected to the design system's
 * 30/32 and 24/20 while the legal document stayed on Tailwind steps computing to
 * 35/35 and 28/21 against the 14px root — so one click moved you between two
 * subtly different boxes, and nothing was red.
 *
 * Shadows are deliberately NOT compared: the auth card floats (`--shadow-lift`)
 * and the document rests (`--shadow-sm`). Two weights of one system.
 */
test.describe('the auth card and the legal document are one family', () => {
  for (const width of [1280, 375]) {
    test(`padding and radius agree at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      const read = async (path: string, kind: 'auth' | 'legal') => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-public-header]');
        // The stylesheet must be live before anything is measured — an unstyled
        // page reports plausible defaults and would pass this by accident.
        await page.waitForFunction(() =>
          getComputedStyle(document.body).fontFamily.includes('Sora'),
        );
        return page.evaluate((k) => {
          const el =
            k === 'auth'
              ? [...document.querySelectorAll('main div')].find(
                  (d) => getComputedStyle(d).borderRadius === '10px',
                )
              : document.querySelector('article');
          if (!el) return null;
          const inner = el.querySelector('div');
          return {
            padding: inner ? getComputedStyle(inner).padding : 'NO INNER',
            radius: getComputedStyle(el).borderRadius,
          };
        }, kind);
      };

      const auth = await read('/login', 'auth');
      const legal = await read('/terms', 'legal');

      expect(auth, 'no auth card found on /login').not.toBeNull();
      expect(legal, 'no document card found on /terms').not.toBeNull();
      // Guards the guard: if the selector ever stops finding a padded element,
      // 'NO INNER' === 'NO INNER' would satisfy the comparison below.
      expect(auth!.padding).toMatch(/^\d/);

      expect(legal!.padding, `/terms padding must match /login's (${auth!.padding})`).toBe(
        auth!.padding,
      );
      expect(legal!.radius, 'both card families share one corner radius').toBe(auth!.radius);
    });
  }
});
