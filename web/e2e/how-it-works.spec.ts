import { expect, test } from '@playwright/test';

/**
 * `/methodology` retired into the landing page's `#how-it-works` section.
 *
 * Three things have to be true for that to work for a real reader, and all three
 * fail SILENTLY — no error, no log, nothing red:
 *
 *  1. **The redirect has to win the race with the middleware.** `proxy.ts` bounces
 *     anything outside PUBLIC_PATHS to `/login`, and `/methodology` has just been
 *     removed from that list. If Next's config redirects ran *after* the
 *     middleware, every reader arriving from Google — and every old bookmark —
 *     would land on a sign-in form instead of the content. Vercel's documentation
 *     does not state the ordering plainly (searched twice while planning), so it
 *     is MEASURED here rather than remembered.
 *
 *  2. **The fragment has to survive into the `Location` header.** Without it the
 *     redirect still "works": 308, right page, no error — and the reader is
 *     dropped at the top of a long landing page with no idea what they were sent
 *     to see. A redirect that lands on the wrong part of the right page looks
 *     exactly like a working one.
 *
 *  3. **The anchor has to land clear of the sticky header.** `position: sticky`
 *     means the browser scrolls the section to y=0 and the header then covers it,
 *     so the reader arrives at a section whose heading is invisible. This is
 *     bounded on BOTH sides on purpose — CLAUDE.md 11i: a one-sided bound only
 *     tests the direction that was never the failure mode. A rail assertion in
 *     this repo once passed at −317px, i.e. scrolled clean off the top.
 *
 * Credential-free — no login, no secrets — so it runs on a fork PR and cannot
 * self-skip.
 */

const RETIRED = '/methodology';
const FRAGMENT = 'how-it-works';

test.describe('the retired /methodology route', () => {
  test('answers 308 with the fragment intact, not a login bounce', async ({ request }) => {
    const res = await request.get(RETIRED, { maxRedirects: 0 });

    // 308, not 307 and not 302: permanent, so a search engine transfers the
    // page's accumulated credit rather than holding both addresses.
    expect(res.status(), `${RETIRED} should 308; a 307 to /login means proxy.ts won the race`).toBe(
      308,
    );

    const location = res.headers()['location'];
    expect(location, `${RETIRED} sent no Location header`).toBeTruthy();

    // The whole point of the redirect. Asserted as its own fact rather than
    // folded into a regex over the URL, so a failure says *which* half broke.
    expect(location, `Location was "${location}" — the fragment is what puts the reader on the right section`).toContain(
      `#${FRAGMENT}`,
    );
    expect(location).not.toContain('/login');
  });

  test('a browser following it ends up on the landing page section', async ({ page }) => {
    // The request test above proves the header. This proves the OUTCOME — that a
    // real browser, applying that header, shows the reader the content. The two
    // are not the same claim: a correct Location with a broken target still ends
    // with a reader looking at nothing.
    await page.goto(RETIRED);
    await expect(page).toHaveURL(new RegExp(`/#${FRAGMENT}$`));
    await expect(page.locator(`#${FRAGMENT}`)).toBeVisible();
  });
});

test.describe('the #how-it-works anchor', () => {
  test('carries the content the retired page used to hold', async ({ page }) => {
    await page.goto(`/#${FRAGMENT}`, { waitUntil: 'networkidle' });
    const section = page.locator(`#${FRAGMENT}`);

    // Named content, not a count. "The section exists" would pass against an
    // empty <section id="how-it-works" />, which is precisely how a fold-one-page-
    // into-another loses its substance without anything going red.
    for (const heading of [
      'Cycle Position',
      'Financial Health Score',
      'Valuation',
      'Overall Rating',
      'What MajorCycle is not',
    ]) {
      await expect(
        section.getByRole('heading', { name: heading, exact: true }),
        `#${FRAGMENT} lost "${heading}" — it was on /methodology before the fold`,
      ).toBeVisible();
    }
  });

  test('lands below the sticky header, and not past it', async ({ page }) => {
    await page.goto(`/#${FRAGMENT}`, { waitUntil: 'networkidle' });

    // ⚠️ Measure the SECTION, not the heading. `scroll-mt` positions the scroll
    // target — the section box — and the h2 sits 56px further down behind the
    // section's own `py-14` padding. The first version of this test measured the
    // heading and failed at 95px against a bound of 80, which looked like an
    // overshooting anchor and was in fact correct padding. The number was real;
    // the thing it was a number ABOUT was wrong.
    const box = await page.evaluate((frag) => {
      const header = document.querySelector('[data-public-header]');
      const section = document.getElementById(frag);
      const heading = section?.querySelector('h2');
      if (!header || !section || !heading) return null;
      const h = heading.getBoundingClientRect();
      return {
        headerBottom: header.getBoundingClientRect().bottom,
        sectionTop: section.getBoundingClientRect().top,
        headingTop: h.top,
        headingBottom: h.bottom,
        viewport: window.innerHeight,
        scrolled: (document.scrollingElement || document.documentElement).scrollTop,
      };
    }, FRAGMENT);

    expect(box, 'no sticky header, no section, or no <h2> inside it').not.toBeNull();
    const { headerBottom, sectionTop, headingTop, headingBottom, viewport, scrolled } = box!;

    // The control. If the page never scrolled at all, the bounds below could still
    // both hold on a tall viewport — so prove the jump happened before judging
    // where it landed.
    expect(scrolled, 'the fragment did not scroll the page at all').toBeGreaterThan(100);

    // Lower bound: the section is not hidden underneath the sticky header. This is
    // the failure `scroll-mt` exists to prevent.
    expect(
      sectionTop,
      `section top ${sectionTop}px is above the header bottom ${headerBottom}px — the sticky header covers it`,
    ).toBeGreaterThanOrEqual(headerBottom);

    // Upper bound — the half that catches the OTHER direction. A scroll-margin far
    // too large drops the reader below the section entirely, which reads as "the
    // link went somewhere random". 24px is the intended gap.
    expect(
      sectionTop,
      `section top sits ${Math.round(sectionTop - headerBottom)}px below the header — the anchor overshot its target`,
    ).toBeLessThanOrEqual(headerBottom + 48);

    // And the outcome the two bounds are a proxy for: the reader can actually READ
    // the heading they were sent to. Bounded on both sides again — fully below the
    // header, fully inside the viewport.
    expect(headingTop, 'the heading is behind the header').toBeGreaterThanOrEqual(headerBottom);
    expect(
      headingBottom,
      `the heading ends at ${Math.round(headingBottom)}px, past the ${viewport}px viewport — the reader lands on a section whose title is off-screen`,
    ).toBeLessThanOrEqual(viewport);
  });
});
