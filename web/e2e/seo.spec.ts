import { expect, test } from '@playwright/test';

import { PUBLIC_PAGES } from '@/lib/seo';
import { SITE_ORIGIN } from '@/lib/url';

/**
 * The SEO plumbing, asserted on the WIRE.
 *
 * The companion static guard (`pnpm check:seo`) proves the code says the right
 * thing. This proves the server actually emits it — the distinction that CLAUDE.md
 * 11a was written in blood over: "only 3 of 15 route handlers said anything" was
 * discovered by reading responses, not source, and three separate cache-header bugs
 * survived code review because the defect was a line that wasn't there.
 *
 * Credential-free on purpose, so it runs on a fork PR with no secrets and can never
 * self-skip. It drives the real dev server with middleware enforced (the Playwright
 * config does not set DEV_BYPASS_AUTH), which is the only way to catch the defect
 * that made this whole session necessary: /robots.txt answering 307 -> /login.
 */

const INDEXABLE = PUBLIC_PAGES.filter((p) => p.index);
const NOINDEX = PUBLIC_PAGES.filter((p) => !p.index);

test.describe('robots.txt', () => {
  test('is served, not redirected to the login page', async ({ request }) => {
    // maxRedirects: 0 is the whole point. Following redirects would return the
    // login page with a 200 and this test would pass while the file was
    // unreachable — which is exactly how the live site looked until Layer G.
    const res = await request.get('/robots.txt', { maxRedirects: 0 });

    expect(res.status(), 'robots.txt must be 200, not a 307 to /login').toBe(200);
    expect(res.headers()['content-type']).toContain('text/plain');
  });

  test('points at the sitemap and blocks every paid surface', async ({ request }) => {
    const body = await (await request.get('/robots.txt', { maxRedirects: 0 })).text();

    expect(body).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);

    // The product is gated (owner decision, 2026-08-04). If this ever passes with
    // one of these missing, a paid surface has become crawlable.
    for (const gated of ['/stocks', '/run', '/results', '/account', '/api/']) {
      expect(body, `${gated} must be disallowed`).toContain(`Disallow: ${gated}`);
    }
  });

  test('allows AI search engines and refuses AI training crawlers', async ({ request }) => {
    const body = await (await request.get('/robots.txt', { maxRedirects: 0 })).text();

    // Split by what the bot DOES with the page, not by vendor: OpenAI and Anthropic
    // each run one of each, and the two are treated differently on purpose.
    for (const bot of ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot']) {
      expect(body, `${bot} should be allowed — it cites us and sends readers back`)
        .toContain(`User-Agent: ${bot}`);
    }

    for (const bot of ['GPTBot', 'ClaudeBot', 'Google-Extended']) {
      // Each training bot gets its own stanza ending in a total block. Asserting
      // the agent appears is not enough — it must be followed by `Disallow: /`.
      const stanza = new RegExp(`User-Agent: ${bot}\\s*\\nDisallow: /\\s*(\\n|$)`);
      expect(body, `${bot} must be blocked entirely`).toMatch(stanza);
    }
  });
});

test.describe('sitemap.xml', () => {
  test('is served, not redirected', async ({ request }) => {
    const res = await request.get('/sitemap.xml', { maxRedirects: 0 });

    expect(res.status(), 'sitemap.xml must be 200, not a 307 to /login').toBe(200);
    expect(res.headers()['content-type']).toContain('xml');
  });

  test('lists every indexable page at the canonical www origin', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml', { maxRedirects: 0 })).text();

    for (const page of INDEXABLE) {
      expect(body, `${page.path} is indexable and must be listed`)
        .toContain(`<loc>${SITE_ORIGIN}${page.path}</loc>`);
    }
  });

  test('never lists a noindex page or a gated one', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml', { maxRedirects: 0 })).text();

    // Telling Google to crawl a page and then telling it not to index the page is
    // a contradiction that wastes crawl budget and looks like a mistake.
    for (const page of NOINDEX) {
      expect(body, `${page.path} is noindex and must NOT be in the sitemap`)
        .not.toContain(`<loc>${SITE_ORIGIN}${page.path}</loc>`);
    }
    for (const gated of ['/stocks', '/run', '/results', '/account']) {
      expect(body, `${gated} is gated and must never appear`).not.toContain(gated);
    }
  });

  test('the apex origin never appears — the www form is load-bearing', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml', { maxRedirects: 0 })).text();

    // https://majorcycle.com (no www) 307s. A sitemap full of redirects is a
    // sitemap Google distrusts, and the same origin constant feeds the Stripe
    // webhook URL, where a 3xx counts as a FAILED delivery.
    expect(body).not.toMatch(/https:\/\/majorcycle\.com/);
  });
});

test.describe('page metadata on the rendered HTML', () => {
  for (const page of INDEXABLE) {
    test(`${page.path} carries a canonical and an Open Graph card`, async ({ page: pw }) => {
      await pw.goto(page.path);

      const canonical = pw.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', `${SITE_ORIGIN}${page.path}`);

      // og:title is stated explicitly by pageMetadata() rather than relying on the
      // root layout's title template reaching it — a framework detail that would
      // fail silently as an untitled share card.
      await expect(pw.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        /MajorCycle/,
      );
      await expect(pw.locator('meta[property="og:url"]')).toHaveAttribute(
        'content',
        `${SITE_ORIGIN}${page.path}`,
      );
      const ogDesc = await pw
        .locator('meta[property="og:description"]')
        .getAttribute('content');
      expect(ogDesc?.length ?? 0).toBeGreaterThan(30);

      // An indexable page must NOT carry a noindex. This is the assertion that
      // catches the copy-paste error of pasting a sign-in page's metadata.
      await expect(pw.locator('meta[name="robots"]')).toHaveCount(0);
    });
  }
});

test.describe('noindex pages', () => {
  for (const page of NOINDEX) {
    test(`${page.path} says noindex, and is NOT blocked in robots.txt`, async ({
      page: pw,
      request,
    }) => {
      await pw.goto(page.path);

      const robots = await pw.locator('meta[name="robots"]').getAttribute('content');
      expect(robots, `${page.path} must declare noindex`).toContain('noindex');

      // The trap this guards: a Disallow would stop Google FETCHING the page, so it
      // would never read the noindex above, and could still index a bare URL found
      // linked elsewhere. Blocked and noindex are mutually exclusive, not additive.
      const txt = await (await request.get('/robots.txt', { maxRedirects: 0 })).text();
      expect(
        txt,
        `${page.path} is noindex, so robots.txt must NOT also disallow it`,
      ).not.toContain(`Disallow: ${page.path}`);
    });
  }
});

test.describe('the site is still gated — control', () => {
  // This suite changed PUBLIC_PATHS, the list that decides who gets in. These
  // assertions exist to prove that change opened NOTHING beyond the two files it
  // was meant to. Run them first without the change and they pass too; that is the
  // point — they are the control, not the experiment.
  for (const gated of ['/stocks', '/stocks/us/AAPL', '/run', '/results', '/account', '/request']) {
    test(`${gated} still bounces a signed-out visitor to /login`, async ({ request }) => {
      const res = await request.get(gated, { maxRedirects: 0 });

      expect(res.status(), `${gated} must stay gated`).toBe(307);
      expect(res.headers()['location']).toContain('/login');
    });
  }
});
