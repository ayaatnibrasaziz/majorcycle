#!/usr/bin/env node
/**
 * Which public pages are PRERENDERED, and which must never be.
 *
 * ── Why this check exists ────────────────────────────────────────────────────
 * Until 2026-08-18 every page on this site rendered on demand, and the cause was
 * one line nobody would connect to it: `app/not-found.tsx` was an async component
 * calling `supabase.auth.getUser()`. The root not-found boundary sits in **every
 * route's tree**, so that single session read made the entire site dynamic.
 *
 * It matters because of how Next prefetches — *"Static Route: the full route is
 * prefetched. Dynamic Route: prefetching is skipped."* Measured on our own pages,
 * the prefetch payload for `/learn` was **210 bytes dynamic against 667 static**,
 * and the click that follows **674ms against 109ms** on Fast 3G.
 *
 * ⚠️ **The regression is silent in both directions, which is the whole point.**
 *   • Add a session read (or `cookies()`, or `headers()`) anywhere in the shared
 *     tree and the public site quietly stops being prerendered. Every page still
 *     renders perfectly. Nothing errors. It just gets slower for everyone.
 *   • Let a page become static that should not be, and it starts advertising
 *     `Cache-Control: s-maxage=31536000` — a SHARED cache directive — where it
 *     used to say `private, no-store`. That is the CLAUDE.md 11a family, which has
 *     bitten this codebase four times. It really happened during this very change:
 *     `/deletion-requested`, the page that tells one person their account is being
 *     deleted, was prerendered by accident and measured sending `s-maxage` on the
 *     wire. Nothing was exposed — `proxy.ts` gates it before the cache — but that
 *     is safety inherited from someone else's ordering rather than stated.
 *
 * ── It reads the ARTIFACT, not the source ───────────────────────────────────
 * Next writes a `.html` file under `.next/server/app/` for each prerendered
 * route, so that directory IS the answer. Grepping the source for
 * `force-dynamic` would prove only that somebody typed it, not that the build
 * agreed (CLAUDE.md 11d — a second build of the same source is a second product).
 *
 * Run AFTER `pnpm build`.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usesNonce, NONCE_ROUTES } from '../lib/csp.ts';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(WEB, '.next', 'server', 'app');

/**
 * Prerendered on purpose: the public reading path. Every one of these is the same
 * bytes for every visitor — the header and footer are session-unaware by design
 * (see PublicHeader.tsx) and none of these pages reads a session or a cookie.
 */
const MUST_BE_STATIC = [
  ['/', 'index.html'],
  ['/learn', 'learn.html'],
  ['/terms', 'terms.html'],
  ['/privacy', 'privacy.html'],
  ['/disclaimer', 'disclaimer.html'],
  ['/contact', 'contact.html'],
  ['/learn/what-is-a-drawdown', join('learn', 'what-is-a-drawdown.html')],
];

/**
 * Must render per request. Each of these either varies by viewer, asserts
 * something true of ONE reader, or runs a check at request time that
 * prerendering would freeze into a file at build time.
 */
const MUST_BE_DYNAMIC = [
  ['/deletion-requested', 'deletion-requested.html', 'asserts one reader’s account is being deleted (11f)'],
  ['/account/update-password', join('account', 'update-password.html'), 'the page a recovery session is confined to'],
  ['/reset-password', 'reset-password.html', 'auth surface — parity with /login and /signup'],
  // ⚠️ `/dev-fixtures` is deliberately NOT asserted here, even though it is also
  // `force-dynamic`. That page is gitignored and local-only, so on CI the file
  // does not exist — and this check would then pass because the route is ABSENT
  // rather than because it is dynamic. A check that reports success precisely
  // when it cannot see its subject is the 14g failure, and it is worse than no
  // check at all. It keeps its own `force-dynamic` for local runs.
  ['/pricing', 'pricing.html', 'redirects a signed-in reader to /account'],
  ['/login', 'login.html', 'reads ?next= and ?error= per request'],
  ['/signup', 'signup.html', 'reads ?next= per request'],
];

/**
 * The nonce invariant — the one that would take the site down rather than slow it.
 *
 * A per-request nonce can only be stamped onto HTML that is generated per request.
 * Send a nonce policy alongside a PREBUILT file and the browser refuses every
 * script in it: the page renders and then does nothing. So `usesNonce()` in
 * `lib/csp.ts` and this directory of `.html` files must never overlap.
 *
 * Asserted against the ARTIFACT and in BOTH directions, because the two failures
 * are opposite and only one of them is loud:
 *
 *   • A prerendered route that takes a nonce → a dead page in production.
 *   • A dynamic route that does NOT → nothing breaks, it just quietly ships the
 *     weaker `'unsafe-inline'` policy on a page holding somebody's session. That
 *     is the one nobody would ever notice (14g).
 *
 * `lib/csp.ts` is IMPORTED rather than re-read, so there is one list (11c). Node
 * strips the types; the file deliberately has no imports of its own.
 */
function routesWithPrerenderedHtml() {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) {
        const rel = relative(APP, full).split(sep).join('/').replace(/\.html$/, '');
        // `_not-found` and `_global-error` are Next's own fallbacks, served for a
        // path that matches no route. They are exactly why `usesNonce()` is an
        // ALLOW-list: an unrecognised path gets the inline policy and they work.
        if (rel.startsWith('_')) continue;
        found.push(rel === 'index' ? '/' : `/${rel}`);
      }
    }
  };
  walk(APP);
  return found.sort();
}

const problems = [];

if (!existsSync(APP)) {
  console.error(
    `✗ ${APP} does not exist.\n  This check reads the build output — run \`pnpm build\` first.`,
  );
  process.exit(1);
}

for (const [route, file] of MUST_BE_STATIC) {
  if (!existsSync(join(APP, file))) {
    problems.push(
      `${route} is NOT prerendered (expected .next/server/app/${file}).\n` +
        `    Something in the shared tree went dynamic — a session read, cookies() or\n` +
        `    headers(). The usual culprit is app/not-found.tsx, which sits in every\n` +
        `    route's tree. The site still works; it is just slower for everybody, and\n` +
        `    clicks stop being prefetched.`,
    );
  }
}

for (const [route, file, why] of MUST_BE_DYNAMIC) {
  if (existsSync(join(APP, file))) {
    problems.push(
      `${route} IS prerendered and must not be — ${why}.\n` +
        `    A prerendered page is served with \`Cache-Control: s-maxage=...\`, a SHARED\n` +
        `    cache directive, in place of \`private, no-store\`. Add\n` +
        `    \`export const dynamic = 'force-dynamic'\` to that page (CLAUDE.md 11a).`,
    );
  }
}

const prerendered = routesWithPrerenderedHtml();

for (const route of prerendered) {
  if (usesNonce(route)) {
    problems.push(
      `${route} is PRERENDERED and \`usesNonce()\` says it gets a nonce.\n` +
        `    Its .html was written at build time, so its script tags carry no nonce\n` +
        `    and the browser would refuse every one of them: the page renders and\n` +
        `    then does nothing. Remove it from NONCE_ROUTES in lib/csp.ts, or make\n` +
        `    the route dynamic — but read why it is prerendered first.`,
    );
  }
}

for (const [route] of MUST_BE_DYNAMIC) {
  if (!usesNonce(route)) {
    problems.push(
      `${route} renders per request but \`usesNonce()\` says no, so it ships the\n` +
        `    weaker 'unsafe-inline' policy on a page that could carry a nonce.\n` +
        `    Nothing breaks — which is the problem. Add it to NONCE_ROUTES.`,
    );
  }
}

const total = MUST_BE_STATIC.length + MUST_BE_DYNAMIC.length;
if (problems.length) {
  console.error(`\n✗ check:render-modes — ${problems.length} of ${total} routes wrong:\n`);
  for (const p of problems) console.error(`  • ${p}\n`);
  process.exit(1);
}

// Print the count, never just a tick — a check that silently stops checking
// looks exactly like a check that passes.
console.log(
  `✓ check:render-modes — ${MUST_BE_STATIC.length} routes prerendered, ` +
    `${MUST_BE_DYNAMIC.length} correctly dynamic (${total} asserted)`,
);
console.log(
  `✓ check:render-modes — CSP nonce invariant: ${prerendered.length} prerendered ` +
    `routes take no nonce, ${NONCE_ROUTES.length} nonce routes declared`,
);
