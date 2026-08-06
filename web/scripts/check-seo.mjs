// CI guard: the SEO plumbing, which is invisible to every other check.
//
// Nothing here changes a pixel, so a regression cannot be seen by looking at the
// site. It also cannot be seen by the type checker: every defect in this class is a
// line that ISN'T there — a page with no canonical, a route missing from the
// sitemap, a public path the middleware still bounces. That is the same shape as
// every silent bug this project has shipped.
//
// This is the STATIC half of a pair. The other half (e2e/seo.spec.ts) asserts the
// real rendered HTML, because a source scan can pass while the deployed page emits
// nothing — "read the wire, not the source". Neither is sufficient:
//
//   • The wire test alone can go quiet. The whole e2e job is conditional on config
//     being present, and a suite that skips is also green.
//   • The source test alone can be satisfied by code that never runs.
//
// So: a static guard that can never skip, PLUS browser assertions on real HTML.
// "Say it AND guard it" (CLAUDE.md 11a).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
let checks = 0;
const fail = (msg) => failures.push(msg);
const check = () => { checks += 1; };

const read = (rel) => {
  const full = path.join(webRoot, rel);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
};

// ── 0. the registry itself ───────────────────────────────────────────────────
// Everything below is derived from lib/seo.ts, so if that file moves or is gutted
// every other check would vacuously pass. Assert it exists and is populated FIRST.

const seo = read('lib/seo.ts');
check();
if (!seo) {
  console.error('✗ lib/seo.ts is missing — it is the source of truth for every check here.');
  process.exit(1);
}

/** Pull `{ path: '/x', index: true|false, … }` entries out of the PUBLIC_PAGES block. */
function parsePublicPages(src) {
  const block = src.match(/export const PUBLIC_PAGES[\s\S]*?\n\] as const;/);
  if (!block) return null;
  const out = [];
  const re = /\{\s*path:\s*'([^']+)'\s*,\s*index:\s*(true|false)/g;
  let m;
  while ((m = re.exec(block[0])) !== null) out.push({ path: m[1], index: m[2] === 'true' });
  return out;
}

const pages = parsePublicPages(seo);
check();
if (!pages || pages.length === 0) {
  fail('lib/seo.ts: could not parse PUBLIC_PAGES. The registry drives proxy.ts, the sitemap and every canonical tag.');
}

// A floor, so a parse that silently matches nothing can never report success. This
// is the failure mode that made check-data-integrity's first break-test misleading:
// the scan "passed" while covering two thirds of the code.
const PAGE_FLOOR = 10;
check();
if (pages && pages.length < PAGE_FLOOR) {
  fail(`lib/seo.ts: only ${pages.length} public pages parsed, expected >= ${PAGE_FLOOR}. Either the list shrank or the parser stopped matching.`);
}

const indexable = (pages ?? []).filter((p) => p.index);
check();
if (indexable.length === 0) {
  fail('lib/seo.ts: no page is marked `index: true`, so sitemap.xml would be empty and nothing could ever rank.');
}

// ⚠️ Named pages, not just a count. A break that flipped /pricing to `index: false`
// passed every other check here AND every e2e assertion — because both derive the
// expected set from this same list, so the list and its test moved together. That
// is the shape of an unfalsifiable test: it asserts the code agrees with itself.
// These four are pinned independently, so dropping one has to be a deliberate edit
// in two places rather than a one-character slip nobody sees.
const MUST_BE_INDEXABLE = ['/pricing', '/methodology', '/terms', '/privacy'];
for (const required of MUST_BE_INDEXABLE) {
  check();
  const page = (pages ?? []).find((p) => p.path === required);
  if (!page) {
    fail(`lib/seo.ts: ${required} has disappeared from PUBLIC_PAGES entirely.`);
  } else if (!page.index) {
    fail(`lib/seo.ts: ${required} must stay indexable. Flipping it to noindex drops it from the sitemap silently — the page keeps working, so nothing looks wrong, and it simply stops being findable.`);
  }
}

// Conversely, the sign-in pages must NEVER become indexable. A sign-in form ranking
// for the brand name is a bad first result, and /deletion-requested asserts
// something true of exactly one reader at one moment.
const MUST_BE_NOINDEX = ['/login', '/signup', '/reset-password', '/deletion-requested'];
for (const required of MUST_BE_NOINDEX) {
  check();
  const page = (pages ?? []).find((p) => p.path === required);
  if (page?.index) {
    fail(`lib/seo.ts: ${required} must stay noindex.`);
  }
}

// ── 1. robots.txt and sitemap.xml exist and DERIVE from the registry ─────────

// ⚠️ Each rule below names the EXPRESSION, not just the identifier. The first
// version of this check tested `/PUBLIC_PAGES/` against the whole file, and a
// deliberate break that replaced the sitemap's `PUBLIC_PAGES.filter(...)` with
// `[].filter(...)` — emitting an EMPTY sitemap — still passed, because the unused
// `import { PUBLIC_PAGES }` line at the top satisfied the pattern. It was checking
// the import, not the use. Found by breaking it on purpose; reading it would never
// have shown this, and the guard would have sat there looking protective.
const DERIVATION = [
  [
    'app/sitemap.ts',
    /PUBLIC_PAGES\s*\.\s*filter\s*\(/,
    'must build its entries from PUBLIC_PAGES.filter(...) (lib/seo.ts). A hand-written second list drifts (11c), and it fails in the worst direction — a sitemap entry that answers Google with a redirect to /login.',
  ],
  [
    'app/robots.ts',
    /PUBLIC_PAGES\s*\.\s*filter\s*\(/,
    'must cross-check PUBLIC_PAGES against its own GATED list, so a public page can never also be disallowed. A blocked URL is never fetched, so its noindex is never read.',
  ],
];

for (const [file, pattern, why] of DERIVATION) {
  const src = read(file);
  check();
  if (!src) {
    fail(`${file} is missing — it is how a search engine is told this site exists.`);
    continue;
  }
  check();
  if (!pattern.test(src)) {
    fail(`${file}: ${why}`);
  }
}

// The sitemap must actually emit entries. An empty <urlset> is valid XML and a
// completely silent failure: nothing errors, nothing looks wrong on the site, and
// it is simply never crawled.
const sitemapSrc = read('app/sitemap.ts');
check();
if (sitemapSrc && !/\.map\s*\(\s*\(\s*page\s*\)/.test(sitemapSrc)) {
  fail('app/sitemap.ts: must map the filtered pages into entries. An empty urlset is valid XML and fails silently.');
}

// ── 2. the middleware actually lets them through ────────────────────────────
// The single most important check in this file. Creating app/robots.ts is NOT
// enough: /robots.txt matches the middleware matcher, so before Layer G the live
// site answered a crawler with 307 -> /login. Verified on the wire 2026-08-06.

for (const endpoint of ['/robots.txt', '/sitemap.xml']) {
  check();
  if (!new RegExp(`'${endpoint}'`).test(seo)) {
    fail(`lib/seo.ts: '${endpoint}' must be in PUBLIC_ENDPOINTS. Without it the middleware redirects the crawler to /login and the file is unreachable no matter how correct its contents are.`);
  }
}

const proxy = read('proxy.ts');
check();
if (!proxy) {
  fail('proxy.ts is missing.');
} else {
  // PUBLIC_PATHS must be BUILT from the registry, not re-typed. If someone pastes a
  // literal array back in, a page can be public here and absent there (or worse,
  // listed in the sitemap while the middleware bounces it) with nothing going red.
  check();
  if (!/PUBLIC_PATHS\s*=\s*\[\s*\.\.\.PUBLIC_PAGES/.test(proxy)) {
    fail('proxy.ts: PUBLIC_PATHS must spread PUBLIC_PAGES from lib/seo.ts rather than list paths literally.');
  }
  check();
  if (!/\.\.\.PUBLIC_ENDPOINTS/.test(proxy)) {
    fail('proxy.ts: PUBLIC_PATHS must also spread PUBLIC_ENDPOINTS, or robots.txt and sitemap.xml stay behind the login redirect.');
  }
}

// ── 3. every public page routes its metadata through pageMetadata() ─────────
// A page that hand-rolls `openGraph` gets whatever its author remembered that day.
// The helper is what guarantees canonical + OG + the noindex rule are stated the
// same way everywhere — and it throws at build time on an unregistered path.

const PAGE_FILE = {
  '/pricing': 'app/(public)/pricing/page.tsx',
  '/methodology': 'app/(public)/methodology/page.tsx',
  '/contact': 'app/(public)/contact/page.tsx',
  '/disclaimer': 'app/(public)/disclaimer/page.tsx',
  '/terms': 'app/(public)/terms/page.tsx',
  '/privacy': 'app/(public)/privacy/page.tsx',
  '/login': 'app/(public)/login/page.tsx',
  '/signup': 'app/(public)/signup/page.tsx',
  '/reset-password': 'app/(public)/reset-password/page.tsx',
  '/deletion-requested': 'app/(public)/deletion-requested/page.tsx',
};

for (const page of pages ?? []) {
  const rel = PAGE_FILE[page.path];
  check();
  if (!rel) {
    fail(`lib/seo.ts lists ${page.path} but scripts/check-seo.mjs has no file mapped for it. Add it to PAGE_FILE so the page is actually checked — an unmapped route is an unguarded one.`);
    continue;
  }
  const src = read(rel);
  check();
  if (!src) {
    fail(`${rel} is missing, but ${page.path} is registered as a public page.`);
    continue;
  }
  check();
  if (!/export const metadata: Metadata = pageMetadata\(\{/.test(src)) {
    fail(`${rel}: metadata must come from pageMetadata() (lib/seo.ts), so canonical, Open Graph and the noindex rule are stated once.`);
  }
  check();
  if (!new RegExp(`path:\\s*'${page.path.replace(/\//g, '\\/')}'`).test(src)) {
    fail(`${rel}: pageMetadata() must be called with path: '${page.path}' — a mismatched path yields a canonical URL pointing at a different page.`);
  }
  // A description is what a searcher reads under the blue link. Every page had a
  // title before G1; seven had no description at all.
  //
  // ⚠️ Anchored to the start of the line. The first version was `/description:/`,
  // and a break that renamed the key to `xdescription:` passed — because the typo
  // still CONTAINS the string being searched for. A substring match is not a field
  // check.
  check();
  if (!/\n\s*description:\s*\n?\s*'/.test(src)) {
    fail(`${rel}: pageMetadata() needs a description — it is the sentence shown under the result.`);
  }
}

// ── 4. one origin, one place ────────────────────────────────────────────────
// The literal lived in three files and one of them disagreed (apex vs www). It was
// unreachable because NEXT_PUBLIC_SITE_URL is set in production, which is exactly
// why nobody noticed. `www` is load-bearing: the LIVE Stripe webhook is registered
// there and Stripe counts a 3xx as a failed delivery.

const url = read('lib/url.ts');
check();
if (!url || !/export const SITE_ORIGIN = 'https:\/\/www\.majorcycle\.com'/.test(url)) {
  fail("lib/url.ts must export SITE_ORIGIN = 'https://www.majorcycle.com'. The `www` is not cosmetic — the live Stripe webhook is registered on it and a redirect counts as failed delivery.");
}

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'test-results', 'playwright-report', 'report-bundle']);
function walk(dir, exts, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

const tsFiles = [
  ...walk(path.join(webRoot, 'app'), ['.ts', '.tsx']),
  ...walk(path.join(webRoot, 'lib'), ['.ts', '.tsx']),
  ...walk(path.join(webRoot, 'components'), ['.ts', '.tsx']),
];
const FILE_FLOOR = 150;
check();
if (tsFiles.length < FILE_FLOOR) {
  fail(`only ${tsFiles.length} TS files walked, expected >= ${FILE_FLOOR}. The scan stopped looking — treat every check below as unproven.`);
}

// The origin may be written as a literal in exactly one place: lib/url.ts. Anywhere
// else is a fourth copy waiting to drift. Comments are stripped first so the many
// explanations of *why* www matters don't trip it.
const ALLOWED_ORIGIN_LITERAL = new Set([path.join(webRoot, 'lib', 'url.ts')]);
for (const file of tsFiles) {
  if (ALLOWED_ORIGIN_LITERAL.has(file)) continue;
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  check();
  if (/'https:\/\/(www\.)?majorcycle\.com/.test(src)) {
    fail(`${path.relative(webRoot, file)}: hard-codes the site origin. Import SITE_ORIGIN from lib/url.ts instead — this literal disagreed with itself across three files before G1.`);
  }
}

// ── 5. never Disallow and noindex the same URL ──────────────────────────────
// The easiest way to get robots.txt wrong. A blocked URL is never fetched, so its
// noindex is never read, and Google stays free to index a bare URL it found linked
// somewhere else. robots.ts asserts this at runtime too; this catches it earlier.

const robots = read('app/robots.ts');
if (robots && pages) {
  const gatedBlock = robots.match(/const GATED = \[([\s\S]*?)\];/);
  const gated = gatedBlock ? [...gatedBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  check();
  if (gated.length === 0) {
    fail('app/robots.ts: could not parse GATED. Every app surface must be explicitly disallowed — the product stays gated (owner decision, 2026-08-04).');
  }
  for (const page of pages) {
    check();
    if (gated.some((g) => page.path === g || page.path.startsWith(g))) {
      fail(`app/robots.ts: ${page.path} is a public page but matches the gated disallow list. A blocked page can never be read, so its noindex would never be seen.`);
    }
  }
  // The gated list must still actually cover the paid surfaces.
  for (const must of ['/stocks', '/run', '/results', '/account']) {
    check();
    if (!gated.includes(must)) {
      fail(`app/robots.ts: ${must} must be in GATED. It is a paid or private surface and must not be crawlable.`);
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────

console.log(
  `check-seo: ${checks} checks over ${pages?.length ?? 0} public pages ` +
  `(${indexable.length} indexable) and ${tsFiles.length} TS files`,
);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('check-seo: OK');
