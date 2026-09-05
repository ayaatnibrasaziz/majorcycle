import { test, expect } from '@playwright/test';
import { ARTICLES, articlePath } from '@/lib/articles';
import { LEARN_ARTICLES, learnPath } from '@/lib/learn';

/**
 * What we tell a machine about a page, read off the page.
 *
 * ── Why this suite exists (audit P6, 2026-09-05) ────────────────────────────
 * Structured data, `og:type` and `<lastmod>` are the parts of this site that no
 * human ever sees. A defect in them renders perfectly, errors nowhere, and shows
 * up only inside somebody else's crawler — so the only way to find one is to read
 * the emitted page and ask what it actually says. Three did:
 *
 *   5A-139 🟡 Every article and Learn page named its `author` and `publisher` as
 *   `{"@id": ".../#organization"}` — a node emitted **only on the landing page**.
 *   JSON-LD `@id` resolution is per-document, so within each of those 17 pages
 *   both properties pointed at nothing.
 *
 *   5A-140 🟡 All 17 declared `og:type: website`. That is the tag that decides
 *   whether a URL is treated as a document with an author and a date or as a page
 *   of a site, and both dates already existed in the registries.
 *
 *   5A-141 🟡 The sitemap emitted `<loc>` and nothing else, while `sitemap.ts`
 *   stated that articles "carry their real publication dates". They never did.
 *
 * ⚠️ **Read from the rendered page, never from the source** (CLAUDE.md 11d/14d).
 * A metadata fix can be correct in `lib/seo.ts` and absent from the HTML — that
 * has happened here before, when a currency fix shipped inert because the field
 * it depended on was null on every row and only a screenshot caught it.
 *
 * ⚠️ **What it cannot see** (14g): whether Google *likes* the result. It asserts
 * the graph is internally resolvable and the tags are present and correct; it has
 * no opinion on a Rich Results verdict, which only Google can give.
 */

interface Graph {
  '@context': string;
  '@graph': Record<string, unknown>[];
}

/** Every JSON-LD graph embedded in a page. */
async function graphs(html: string): Promise<Graph[]> {
  const out: Graph[] = [];
  for (const m of html.matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    out.push(JSON.parse(m[1] ?? '{}') as Graph);
  }
  return out;
}

function meta(html: string, prop: string): string | null {
  const m = html.match(
    new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`),
  );
  return m?.[1] ?? null;
}

// One from each registry is enough to prove the shared helper is wired; the
// registries themselves are what make the other fifteen identical.
const SAMPLES = [
  { path: articlePath(ARTICLES[0]!.slug), reviewed: ARTICLES[0]!.reviewed, published: ARTICLES[0]!.published },
  { path: learnPath(LEARN_ARTICLES[0]!.slug), reviewed: LEARN_ARTICLES[0]!.reviewed, published: LEARN_ARTICLES[0]!.published },
];

test.describe('what we tell a machine about a page', () => {
  for (const s of SAMPLES) {
    test(`${s.path} names a publisher that exists in its own graph`, async ({ request }) => {
      const html = await (await request.get(s.path)).text();
      const [g] = await graphs(html);
      expect(g, `${s.path}: no JSON-LD at all`).toBeTruthy();

      const nodes = g!['@graph'];
      const ids = new Set(nodes.map((n) => n['@id']).filter(Boolean) as string[]);
      const types = nodes.map((n) => n['@type']);
      expect(types, `${s.path}: not an Article`).toContain('Article');
      // THE 5A-139 GUARD, stated generally: no reference in this graph may point
      // at an id the graph does not define. That catches the defect that
      // happened AND any future one of the same shape, rather than only
      // asserting that an Organization node is present.
      const article = nodes.find((n) => n['@type'] === 'Article')!;
      for (const key of ['author', 'publisher'] as const) {
        const ref = article[key] as { '@id'?: string } | undefined;
        expect(ref?.['@id'], `${s.path}: no ${key}`).toBeTruthy();
        expect(
          ids.has(ref!['@id']!),
          `${s.path}: ${key} points at ${ref!['@id']}, which nothing in this page's graph defines`,
        ).toBe(true);
      }
      // The control: an Organization that resolves but says nothing is no better.
      const org = nodes.find((n) => n['@type'] === 'Organization')!;
      expect(org['name'], 'the publisher has no name').toBe('MajorCycle');
      expect(org['logo'], 'the publisher has no logo').toBeTruthy();
    });

    test(`${s.path} declares itself an article, with its real dates`, async ({ request }) => {
      const html = await (await request.get(s.path)).text();
      // THE 5A-140 GUARD. Values BUILT from the registry, never restated here
      // (11c-v), with an off-by-one control so the match is value-sensitive.
      expect(meta(html, 'og:type'), 'still a generic website').toBe('article');
      expect(meta(html, 'article:published_time')).toBe(s.published);
      expect(meta(html, 'article:modified_time')).toBe(s.reviewed);
      expect(meta(html, 'article:published_time')).not.toBe(`${s.published}x`);
    });
  }

  test('the landing is a website, and is not accidentally an article', async ({ request }) => {
    // The reverse control. "og:type is article" would be satisfied everywhere by
    // a change that simply hard-coded it, which would be a different defect.
    const html = await (await request.get('/')).text();
    expect(meta(html, 'og:type')).toBe('website');
    expect(meta(html, 'article:published_time')).toBeNull();
  });

  test('the sitemap dates every written page and no others', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]!);
    expect(entries.length, 'the sitemap is empty — nothing below means anything')
      .toBeGreaterThanOrEqual(ARTICLES.length + LEARN_ARTICLES.length);

    const dated = entries.filter((e) => e.includes('<lastmod>'));
    // THE 5A-141 GUARD, both directions. Too FEW dates is the defect that
    // happened; too MANY is `new Date()` on every page, the cry-wolf sitemap the
    // original decision existed to avoid. Both must fail.
    // Proven in BOTH directions by sabotage: dropping the registry date gives 8,
    // and `new Date()` on every page gives 25. The message has to name which,
    // because a bare "expected 17" reads as one failure with two opposite causes.
    expect(
      dated.length,
      `${dated.length} of ${entries.length} urls carry a lastmod, expected ` +
        `${ARTICLES.length + LEARN_ARTICLES.length}. FEWER means the written pages are ` +
        `going out bare again (5A-141); MORE means every page is being stamped, which ` +
        `is the cry-wolf sitemap the field was originally omitted to avoid.`,
    ).toBe(ARTICLES.length + LEARN_ARTICLES.length);

    // Each dated entry must carry the registry's own date, not today's.
    const today = new Date().toISOString().slice(0, 10);
    const one = ARTICLES[0]!;
    const entry = entries.find((e) => e.includes(articlePath(one.slug)))!;
    expect(entry, 'the first article is missing from the sitemap').toBeTruthy();
    expect(entry, 'the article does not carry its own reviewed date').toContain(one.reviewed);
    if (one.reviewed !== today) {
      expect(entry, 'the sitemap is stamping today — the cry-wolf failure').not.toContain(today);
    }
  });
});
