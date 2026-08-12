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
 *     only when someone clicks it. `/methodology` is folded into the landing page
 *     in the next commit, and both lists name it today.
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
        // A link to a gated route would render fine and then bounce the reader to
        // /login — a broken link that never 404s and so never gets reported.
        expect(publicPaths.has(l.href), `${name} link ${l.href} is not in PUBLIC_PAGES`).toBe(
          true,
        );
        expect(existsSync(routeFile(l.href)), `${name} link ${l.href} has no page.tsx`).toBe(
          true,
        );
      }
    });
  }
});
