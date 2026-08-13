import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
          expect(
            /scroll-mt-\[calc\(var\(--header-h\)/.test(src),
            `${path} has #${fragment} but no scroll-mt offset for the sticky header — the reader arrives with the heading hidden behind it.`,
          ).toBe(true);
        }
      }
    });
  }
});
