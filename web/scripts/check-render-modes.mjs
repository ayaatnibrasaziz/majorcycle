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
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
