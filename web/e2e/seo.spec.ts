import { expect, test } from '@playwright/test';

import { OG_IMAGE, PUBLIC_PAGES, pageUrl } from '@/lib/seo';
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
        .toContain(`<loc>${pageUrl(page.path)}</loc>`);
    }
  });

  test('never lists a noindex page or a gated one', async ({ request }) => {
    const body = await readOrFail(request, '/sitemap.xml');

    // Telling Google to crawl a page and then telling it not to index the page is
    // a contradiction that wastes crawl budget and looks like a mistake.
    for (const page of NOINDEX) {
      expect(body, `${page.path} is noindex and must NOT be in the sitemap`)
        .not.toContain(`<loc>${pageUrl(page.path)}</loc>`);
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
      await expect(canonical).toHaveAttribute('href', pageUrl(page.path));

      // og:title is stated explicitly by pageMetadata() rather than relying on the
      // root layout's title template reaching it — a framework detail that would
      // fail silently as an untitled share card.
      await expect(pw.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        /MajorCycle/,
      );
      await expect(pw.locator('meta[property="og:url"]')).toHaveAttribute(
        'content',
        pageUrl(page.path),
      );
      const ogDesc = await pw
        .locator('meta[property="og:description"]')
        .getAttribute('content');
      expect(ogDesc?.length ?? 0).toBeGreaterThan(30);

      // The share card must be NAMED on the page, not merely present on disk.
      // Found on the wire 2026-08-08: app/opengraph-image.png existed and served
      // 200, twitter:card claimed `summary_large_image`, and NOT ONE page carried
      // an og:image — because a route exporting its own `openGraph` replaces the
      // one Next's file convention would have inherited down. A large card with
      // no image renders broken rather than gracefully small.
      await expect(pw.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        OG_IMAGE.url,
      );
      await expect(pw.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image',
      );

      // An indexable page must NOT carry a noindex. This is the assertion that
      // catches the copy-paste error of pasting a sign-in page's metadata.
      await expect(pw.locator('meta[name="robots"]')).toHaveCount(0);
    });
  }

  test('the share card itself is a real 1200x630 PNG, not a 404', async ({ request }) => {
    // Naming the image proves nothing if the file is missing: every assertion
    // above would still pass against a dead URL. Fetch the bytes.
    //
    // ⚠️ Retried, because this asset is the one route in the suite that races the
    // DEV SERVER rather than the product. Next compiles routes on demand under
    // `next dev`, so the first request for a file-convention asset can be answered
    // before it exists — observed in CI as a 67ms failure followed by a 72ms pass.
    // In production it is prerendered (`○ /opengraph-image.png` in the build
    // output), so the flake is the harness, not the site.
    //
    // This tolerates a cold compile and NOTHING else: a genuinely missing or
    // wrong-sized card still fails, it just takes 10 seconds to say so. A retry
    // that hid a real 404 would be worse than the flake.
    let res!: Awaited<ReturnType<typeof request.get>>;
    await expect(async () => {
      res = await request.get('/opengraph-image.png');
      expect(res.status()).toBe(200);
    }).toPass({ timeout: 10_000 });

    expect(res.headers()['content-type']).toContain('image/png');
    const body = await res.body();
    expect(body.byteLength).toBeGreaterThan(20_000);
    // PNG magic, then the IHDR width/height as big-endian uint32s. A card at the
    // wrong dimensions is cropped by every platform that shows it.
    expect(body.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(body.readUInt32BE(16)).toBe(OG_IMAGE.width);
    expect(body.readUInt32BE(20)).toBe(OG_IMAGE.height);
  });

  test('no page ships a SECOND, per-page share card', async ({ page: pw }) => {
    // A per-stock or per-page card is fetched by anonymous crawlers and cached
    // publicly, so one carrying a rating would publish paid output on a CDN
    // (CLAUDE.md 11a/11b). One image sitewide, and this is what keeps it one.
    for (const p of INDEXABLE) {
      await pw.goto(p.path);
      const urls = await pw.locator('meta[property="og:image"]').all();
      expect(urls.length, `${p.path} declares ${urls.length} og:image tags`).toBe(1);
      expect(await urls[0]!.getAttribute('content')).toBe(OG_IMAGE.url);
    }
  });
});

test.describe('noindex pages', () => {
  for (const page of NOINDEX) {
    test(`${page.path} says noindex, and is NOT blocked in robots.txt`, async ({
      context,
      page: pw,
      request,
    }) => {
      // /deletion-requested is gated on the marker its own flow sets
      // (lib/account.ts). Without it this navigates to /login — which is ALSO
      // noindex, so the assertion below would pass against the wrong document.
      // That is precisely the failure this file's header warns about, and it is
      // why the "did not stay put" check underneath it is not optional.
      if (page.path === '/deletion-requested') {
        await context.addCookies([
          { name: 'mc_deletion_notice', value: '1', domain: 'localhost', path: page.path },
        ]);
      }
      await pw.goto(page.path);
      expect(
        new URL(pw.url()).pathname,
        `${page.path} redirected — every assertion below would be about another page`,
      ).toBe(page.path);

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

test.describe('every public page carries a usable search snippet', () => {
  /**
   * ⚠️ **A meta description is the only sentence most people read before
   * deciding whether to click**, and both ways of getting it wrong are silent:
   * too long and Google cuts it mid-clause, too short and the result looks
   * abandoned. Neither errors, neither shows up on the page, and nothing else in
   * this repo could see it — which is why ten pages had drifted over the limit
   * and `/contact` sat at 38 characters, found only by measuring the built HTML.
   *
   * ⚠️ **Measured on the RENDERED page, not on the source literal** (CLAUDE.md
   * 11d). The landing's description is a template string with a live count
   * interpolated into it, the article descriptions come from the registry, and
   * the four sign-in pages inherit the root layout's fallback — three different
   * routes to one tag, and only the wire sees all of them.
   */
  const MAX = 155;
  const MIN = 70;

  for (const page_ of PUBLIC_PAGES) {
    test(`${page_.path} has a description between ${MIN} and ${MAX} characters`, async ({
      page,
    }) => {
      await page.goto(page_.path);
      const content = await page
        .locator('meta[name="description"]')
        .first()
        .getAttribute('content');

      expect(content, `${page_.path} has no meta description at all`).toBeTruthy();
      const n = (content ?? '').length;
      expect(
        n,
        `${page_.path}: ${n} chars — Google truncates near ${MAX}: "${content}"`,
      ).toBeLessThanOrEqual(MAX);

      /* ⚠️ The FLOOR applies only where a snippet is actually shown. The four
         sign-in pages are `noindex, follow`, so Google never renders a snippet
         for them and a 35-character description costs nothing — demanding 70
         there would be inventing work to satisfy a rule that does not reach
         them. The ceiling still applies everywhere, because a description that
         is too long is a defect wherever it renders. The tag must exist on all
         of them regardless: a missing one is a different bug from a short one. */
      if (page_.index) {
        expect(
          n,
          `${page_.path}: only ${n} chars — too thin to earn a click: "${content}"`,
        ).toBeGreaterThanOrEqual(MIN);
      }
    });
  }
});
