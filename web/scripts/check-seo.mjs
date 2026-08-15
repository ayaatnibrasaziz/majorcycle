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
// ⚠️ '/' replaced '/methodology' here when that page was folded into the landing.
// The slot was not left empty: this list is the independent half of the pair, so
// shrinking it is how the guard quietly loses the coverage it was written for.
const MUST_BE_INDEXABLE = ['/', '/pricing', '/terms', '/privacy'];
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

// The most tempting wrong "improvement" in this file, guarded because it looks like
// diligence rather than a mistake: `lastModified: new Date()` tells Google every page
// changed on every deploy. A sitemap that cries wolf teaches it to ignore the field,
// so it is worse than the omission it replaces. A REAL content date (G4's articles)
// is fine — a BUILD-TIME date never is.
if (sitemapSrc) {
  const sitemapCode = sitemapSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  check();
  if (/lastModified\s*:\s*new Date\(\s*\)/.test(sitemapCode)) {
    fail('app/sitemap.ts: `lastModified: new Date()` claims every page changed on every deploy. Use a real content date or omit the field.');
  }
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
  '/': 'app/(public)/page.tsx',
  '/pricing': 'app/(public)/pricing/page.tsx',
  '/contact': 'app/(public)/contact/page.tsx',
  '/learn': 'app/(public)/learn/page.tsx',
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

// ── 3a. the DYNAMIC public route, which every check above is blind to ───────
//
// `/learn/[slug]` is the first public page whose path is not a literal. Two
// consequences, and both are the kind that report success:
//
//  • `parsePublicPages()` reads the PUBLIC_PAGES block as TEXT, so the spread
//    `...LEARN_ARTICLES.map(...)` is invisible to it. The loop above therefore
//    never reaches an article, and would happily pass with the route deleted.
//  • The `export const metadata: Metadata = pageMetadata({` pattern cannot match
//    a route that must use `generateMetadata` — the path is only known per
//    request.
//
// So the route is named here explicitly. The e2e suite covers the rendered
// outcome (canonical, sitemap membership, 404 on an unknown slug); this catches
// the same thing one step earlier, at build time, where the owner can see it.
// ⚠️ Read COMMENT-STRIPPED. Both rules below were broken on purpose and the
// `notFound()` one passed with every real call deleted — because the route's own
// doc comment explains that an unknown slug must call `notFound()`, and the guard
// was reading the explanation instead of the code. That is the same defect as the
// `allow: '/'` check tripping over the comment describing its own absence, and the
// `PUBLIC_PAGES` spread matching the line somebody had just commented out.
// **A guard that reads prose is testing the documentation.**
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const LEARN_ROUTE = 'app/(public)/learn/[slug]/page.tsx';
const learnRouteRaw = read(LEARN_ROUTE);
const learnRoute = learnRouteRaw ? stripComments(learnRouteRaw) : learnRouteRaw;
check();
if (!learnRoute) {
  fail(`${LEARN_ROUTE} is missing, but lib/learn.ts registers articles that derive their public paths from it.`);
} else {
  check();
  if (!/pageMetadata\(\{/.test(learnRoute)) {
    fail(`${LEARN_ROUTE}: metadata must come from pageMetadata() like every other public page, or articles ship with no canonical and no Open Graph — on the pages whose entire job is to be found.`);
  }
  check();
  if (!/generateStaticParams/.test(learnRoute)) {
    fail(`${LEARN_ROUTE}: must export generateStaticParams so every registered article is pre-rendered rather than built on first request.`);
  }
  // The soft-404 guard. A dynamic route that answers 200 with an empty shell for
  // any URL typed at it is read far more harshly by Google than an honest 404,
  // and it is completely silent — the page looks fine, it just says nothing.
  check();
  if (!/notFound\(\)/.test(learnRoute)) {
    fail(`${LEARN_ROUTE}: an unregistered slug must call notFound(). A dynamic route that renders a blank page for any URL is a soft-404 farm.`);
  }
}

// The registry itself must stay free of React, because lib/seo.ts imports it and
// proxy.ts imports lib/seo.ts — so anything pulled in here is pulled into the
// MIDDLEWARE bundle, which runs on every request to the site.
const learnLibRaw = read('lib/learn.ts');
const learnLib = learnLibRaw ? stripComments(learnLibRaw) : learnLibRaw;
check();
if (!learnLib) {
  fail('lib/learn.ts is missing — it is the source PUBLIC_PAGES derives every article path from.');
} else {
  check();
  if (/from\s+'react'|\.tsx'|next\/link/.test(learnLib)) {
    fail('lib/learn.ts must stay free of React and component imports. lib/seo.ts imports it and proxy.ts imports lib/seo.ts, so a component here joins the middleware bundle that runs on every request.');
  }
  // `satisfies`, not an annotation — an explicit `: readonly LearnArticle[]`
  // widens every slug to `string`, which silently destroys the compile-time
  // check that every registered article has a body in content.tsx.
  check();
  if (!/\]\s*as const satisfies readonly LearnArticle\[\]/.test(learnLib)) {
    fail('lib/learn.ts: LEARN_ARTICLES must end `] as const satisfies readonly LearnArticle[]`. An explicit type annotation widens slug to `string`, and the Record<LearnSlug, …> body map then stops requiring a body per article — the guard evaporates and the first symptom is a blank page.');
  }
}

// ⚠️ COMMENTS STRIPPED FIRST, and this is the fourth time in this file that the
// omission produced a hollow check. Breaking it on purpose is what caught it: I
// commented the spread out with `//`, which is precisely how somebody disables it
// in real life, and the guard reported **OK** — it was matching the disabled line.
// Meanwhile `pageMetadata()` threw at request time, so the app failed loudly and
// the check that exists to catch it earlier said nothing.
const seoCode = stripComments(seo);

check();
if (!/\.\.\.LEARN_ARTICLES\.map\(/.test(seoCode)) {
  fail('lib/seo.ts: PUBLIC_PAGES must spread the Learn registry. Typed out by hand, an article can be live and absent from the sitemap, absent from the middleware allow-list, and rejected by pageMetadata() — while rendering perfectly.');
}

// ── 3b. a retired route still answers ───────────────────────────────────────
// `/methodology` was a real, indexed page. It is now the `#how-it-works` section
// of the landing page, and four things have to hold together for that to be true
// for a reader. Any ONE of them failing is silent: the page still builds, nothing
// throws, and the only symptom is a link that dead-ends — for a stranger arriving
// from Google, or from a bookmark, months later.
//
//   (a) the redirect exists and is permanent;
//   (b) the old path is NOT in PUBLIC_PAGES — the middleware matches before the
//       redirect is reached, so leaving it listed would silently disable (a);
//   (c) the route file is really gone, or the redirect shadows a live page;
//   (d) nothing in the app still LINKS to the old path. A working 308 makes a
//       stale internal link invisible — it resolves, so nobody notices we are
//       sending our own readers through a redirect.

const RETIRED = { from: '/methodology', to: '/#how-it-works' };
const nextConfig = read('next.config.ts');

check();
if (!nextConfig) {
  fail('next.config.ts is missing — it carries the redirect for every retired route.');
} else {
  const redirectRe = new RegExp(
    `source:\\s*'${RETIRED.from}'[\\s\\S]{0,120}?destination:\\s*'${RETIRED.to.replace('#', '#')}'[\\s\\S]{0,80}?permanent:\\s*true`,
  );
  check();
  if (!redirectRe.test(nextConfig)) {
    fail(`next.config.ts: ${RETIRED.from} must redirect to '${RETIRED.to}' with permanent: true. Without it the path 404s for everyone Google already sent there, and the fragment is what puts them on the right section rather than the top of a long page.`);
  }
}

check();
if ((pages ?? []).some((p) => p.path === RETIRED.from)) {
  fail(`lib/seo.ts: ${RETIRED.from} is retired and must NOT be in PUBLIC_PAGES. proxy.ts matches PUBLIC_PATHS before next.config's redirect is reached, so listing it here disables the redirect with nothing going red.`);
}

check();
if (existsSync(path.join(webRoot, 'app/(public)/methodology/page.tsx'))) {
  fail(`app/(public)/methodology/page.tsx still exists, but ${RETIRED.from} is registered as a redirect. One of the two is wrong, and a redirect that shadows a real page is the harder of the two to diagnose.`);
}

// (d) is checked below, once the file walk exists — see "no stale link to a
// retired route", after FILE_FLOOR.

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

// ── 3b (d). no stale link to a retired route ────────────────────────────────
// Deferred to here because it needs the walk above; the other three parts of this
// check sit with the registry, where they read in context.
//
// Comments are stripped first. This file's own history is the argument: the
// `xdescription:` substring bug and the `allow: '/'` guard that failed on the very
// comment explaining why the line is absent. The prose describing a retirement
// necessarily names the retired path.
for (const file of tsFiles) {
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  check();
  if (new RegExp(`['"\`]${RETIRED.from}['"\`]`).test(src)) {
    fail(`${path.relative(webRoot, file)}: still links to ${RETIRED.from}, which is retired. The 308 makes this WORK, which is why it would never be noticed — we would simply be sending our own readers through a redirect. Use HOW_IT_WORKS_HREF from lib/publicNav.ts.`);
  }
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

  // No bare `allow: '/'`. Correct parsers resolve Allow-vs-Disallow by longest path,
  // so this was safe — but a naive first-match parser would read it and crawl the
  // entire paid product. Omitting it loses nothing (unlisted = allowed) and makes the
  // policy true by construction instead of by precedence rules.
  // ⚠️ Comments stripped first. The first version tested the raw file and failed on
  // the COMMENT explaining why the line is absent — a guard tripping over its own
  // documentation. Same family as the `xdescription:` substring bug: matching text,
  // not code.
  const robotsCode = robots
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  //
  // ⚠️ `\ballow:` with a word boundary, NOT `allow:`. The word **dis**allow CONTAINS
  // "allow", so the naive pattern matched `disallow: '/'` — the line that blocks the
  // training crawlers, which must stay. The guard therefore reported a failure for
  // entirely the wrong reason, and would have kept failing no matter what the code
  // said. A red check is not automatically red for the reason you think.
  //
  // Third instance of this exact class in one session (`xdescription` contains
  // `description`; a stray import satisfied `PUBLIC_PAGES`). Substring != token.
  check();
  if (/\ballow:\s*'\/'/.test(robotsCode)) {
    fail("app/robots.ts: remove `allow: '/'`. Anything not disallowed is already allowed, and a bare Allow is the only rule that can conflict with a Disallow — a naive crawler taking the first match would crawl the whole paid product.");
  }

  // The AI policy is an owner decision (2026-08-04) and every token was verified
  // against the vendor's own documentation. Pinned by name so a rename or a deletion
  // is a deliberate edit rather than a silent drift.
  //
  // ⚠️ Groups do NOT inherit: a crawler matching a named group ignores `*` entirely.
  // That is why the allowed agents are named at all — so tightening `*` later cannot
  // silently cut them off — and it is why each must appear here.
  const AI_ALLOWED = [
    'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot',
    'ChatGPT-User', 'Claude-User', 'Perplexity-User',
  ];
  const AI_BLOCKED = ['GPTBot', 'ClaudeBot', 'Google-Extended'];

  /**
   * Pull the string members of a named array literal.
   *
   * ⚠️ Membership of the RIGHT array, not "appears somewhere in the file". The first
   * version asked `robots.includes("'Claude-User'")`, and a break-test that moved the
   * name into an unrelated `const _unused = ['Claude-User']` sailed straight through
   * — the guard was satisfied by a string with no effect on the output. Third time
   * this session that matching text instead of structure produced a hollow check.
   */
  const arrayOf = (name) => {
    const m = robots.match(new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`));
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
  };

  const searchAllowed = arrayOf('AI_SEARCH_ALLOWED');
  const userAllowed = arrayOf('AI_USER_TRIGGERED_ALLOWED');
  const trainingBlocked = arrayOf('AI_TRAINING_BLOCKED');

  check();
  if (!searchAllowed?.length || !userAllowed?.length || !trainingBlocked?.length) {
    fail('app/robots.ts: could not parse the three AI agent arrays. Every check below would pass vacuously, so this is a failure in itself.');
  } else {
    const allowedInFile = [...searchAllowed, ...userAllowed];
    for (const bot of AI_ALLOWED) {
      check();
      if (!allowedInFile.includes(bot)) {
        fail(`app/robots.ts: '${bot}' must be a member of AI_SEARCH_ALLOWED or AI_USER_TRIGGERED_ALLOWED. Search bots cite us and send readers back; the *-User agents fetch because a real person asked about the page — a potential customer, not a crawler.`);
      }
      check();
      if (trainingBlocked.includes(bot)) {
        fail(`app/robots.ts: '${bot}' is in AI_TRAINING_BLOCKED but must be allowed.`);
      }
    }
    for (const bot of AI_BLOCKED) {
      check();
      if (!trainingBlocked.includes(bot)) {
        fail(`app/robots.ts: '${bot}' must stay in AI_TRAINING_BLOCKED — it copies the writing into a model and returns nothing.`);
      }
      check();
      if (allowedInFile.includes(bot)) {
        fail(`app/robots.ts: '${bot}' is both allowed and blocked.`);
      }
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
