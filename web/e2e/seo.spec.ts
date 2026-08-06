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

/**
 * Fetch a generated file and PROVE it arrived before asserting anything about its
 * contents.
 *
 * Every "must not contain" assertion below is vacuously true against an empty body,
 * so without this an unreachable file reads as a perfect result. Not hypothetical:
 * breaking robots.txt on purpose (dropping it from PUBLIC_ENDPOINTS so it answered
 * 307) left FOUR of these tests green — 3 failed instead of 7. It is the same
 * failure that had check_invariants() reporting zero cross-currency violations over
 * a universe that had lost the very field it inspects: unmeasurable counted as
 * clean. A negative assertion means nothing until you have proved you are looking
 * at the real thing.
 */
async function readOrFail(
  request: {
    get: (u: string, o: object) => Promise<{ status: () => number; text: () => Promise<string> }>;
  },
  path: string,
): Promise<string> {
  const res = await request.get(path, { maxRedirects: 0 });
  expect(
    res.status(),
    `${path} must be readable before any assertion about it means anything`,
  ).toBe(200);
  const body = await res.text();
  expect(body.length, `${path} must not be empty`).toBeGreaterThan(50);
  return body;
}

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
    const body = await readOrFail(request, '/robots.txt');

    expect(body).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);

    // The product is gated (owner decision, 2026-08-04). If this ever passes with
    // one of these missing, a paid surface has become crawlable.
    for (const gated of ['/stocks', '/run', '/results', '/account', '/api/']) {
      expect(body, `${gated} must be disallowed`).toContain(`Disallow: ${gated}`);
    }
  });

  test('allows AI search engines and refuses AI training crawlers', async ({ request }) => {
    const body = await readOrFail(request, '/robots.txt');

    // Split by what the agent DOES with the page, not by vendor: OpenAI, Anthropic
    // and Perplexity each run several, and they are treated differently on purpose.
    // Every name here was checked against that vendor's own bot documentation.
    const allowed = [
      // Indexes to cite us in AI answers.
      'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot',
      // Fetches because a real person asked about the page — a potential customer.
      'ChatGPT-User', 'Claude-User', 'Perplexity-User',
    ];

    for (const bot of allowed) {
      // Present AND not totally blocked. Asserting only that the name appears would
      // pass even if the stanza said `Disallow: /`, which is the opposite policy.
      expect(body, `${bot} must have its own stanza`).toContain(`User-Agent: ${bot}`);
      const stanza = new RegExp(`User-Agent: ${bot}\\n(?!Disallow: /\\n)`);
      expect(body, `${bot} must NOT be blocked outright`).toMatch(stanza);
    }

    for (const bot of ['GPTBot', 'ClaudeBot', 'Google-Extended']) {
      // Each training bot gets its own stanza ending in a total block. Asserting
      // the agent appears is not enough — it must be followed by `Disallow: /`.
      const stanza = new RegExp(`User-Agent: ${bot}\\s*\\nDisallow: /\\s*(\\n|$)`);
      expect(body, `${bot} must be blocked entirely`).toMatch(stanza);
    }
  });

  test('never says a bare "Allow: /" — it cannot conflict with a Disallow', async ({
    request,
  }) => {
    const body = await readOrFail(request, '/robots.txt');

    // Correct parsers resolve Allow-vs-Disallow by longest path (RFC 9309), so
    // `Allow: /` alongside `Disallow: /stocks` was in fact safe. A naive parser that
    // takes the first match instead would read `Allow: /` and crawl the whole paid
    // product. Omitting the line removes the conflict entirely: anything not
    // disallowed is already allowed, so the rule loses nothing and stops depending
    // on a precedence subtlety.
    expect(body).not.toMatch(/^Allow: \/$/m);
  });
});

test.describe('sitemap.xml', () => {
  test('is served, not redirected', async ({ request }) => {
    const res = await request.get('/sitemap.xml', { maxRedirects: 0 });

    expect(res.status(), 'sitemap.xml must be 200, not a 307 to /login').toBe(200);
    expect(res.headers()['content-type']).toContain('xml');
  });

  test('lists every indexable page at the canonical www origin', async ({ request }) => {
    const body = await readOrFail(request, '/sitemap.xml');

    for (const page of INDEXABLE) {
      expect(body, `${page.path} is indexable and must be listed`)
        .toContain(`<loc>${SITE_ORIGIN}${page.path}</loc>`);
    }
  });

  test('never lists a noindex page or a gated one', async ({ request }) => {
    const body = await readOrFail(request, '/sitemap.xml');

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
    const body = await readOrFail(request, '/sitemap.xml');

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
      const txt = await readOrFail(request, '/robots.txt');
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
