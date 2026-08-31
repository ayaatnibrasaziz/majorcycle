#!/usr/bin/env node
/**
 * Does the Content-Security-Policy we think we ship actually reach the browser,
 * and does the browser then run the page?
 *
 * ── Why this is a script and not a spec ──────────────────────────────────────
 * The e2e suite boots `next dev`, and in development the policy deliberately
 * carries `'unsafe-eval'` — Turbopack compiles modules with `eval` for hot
 * reloading and refusing it would break the dev server while proving nothing
 * about what ships. So the one thing worth asserting here cannot be asserted
 * there. `e2e/csp.spec.ts` keeps the half that IS invariant: that every response
 * carries an enforcing policy at all, on every route class.
 *
 * ── What it checks, and why each one exists ──────────────────────────────────
 * 1. **Enforcing, not Report-Only.** The policy reported for months and blocked
 *    nothing. A Report-Only policy that is wrong is not harmless — it is a trap
 *    primed for whoever flips it, and ours was wrong (`style-src` was missing
 *    Google, which would have killed the sign-in button).
 * 2. **The right form per route.** A prerendered route must carry
 *    `'unsafe-inline'` and no nonce; a per-request route must carry a nonce and
 *    no `'unsafe-inline'`. `pnpm check:render-modes` already asserts the two sets
 *    cannot overlap; this asserts the server agrees.
 * 3. **The nonce is in the HTML.** ⚠️ This is the check that matters. A header
 *    naming a nonce no script carries is *worse* than no policy: every script is
 *    refused and the page renders, looks finished, and does nothing. Reading the
 *    header alone cannot tell those apart — so this parses the document and
 *    requires every `<script>` to carry that exact value.
 * 4. **The nonce changes.** A constant nonce is decoration; an attacker who can
 *    read one page can then write a script that passes.
 * 5. **No `'unsafe-eval'` in production**, which is what stops the dev-only
 *    concession from ever shipping.
 * 6. **A real browser reports zero violations**, on a sweep including the signed-in
 *    product. The other five checks are about strings; this one is about whether
 *    the site works. It listens for `securitypolicyviolation` — the browser's own
 *    event — rather than scraping the console, and it counts the page's scripts so
 *    a page that failed to load cannot pass by being empty (14g).
 *
 * Usage:  pnpm check:csp        (needs a production server: `pnpm start:fresh --port 3200`)
 */
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

function loadE2ECredsFromEnvLocal() {
  if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) return;
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(E2E_EMAIL|E2E_PASSWORD)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadE2ECredsFromEnvLocal();

const ORIGIN = process.env.LH_ORIGIN ?? 'http://localhost:3200';

/** path, expects a nonce, needs a session, why this route is in the sample. */
const ROUTES = [
  ['/', false, false, 'the landing — prerendered, the first page a stranger meets'],
  ['/learn', false, false, 'the library index — prerendered'],
  ['/learn/pe-ratio', false, false, 'an article — prerendered, and it embeds JSON-LD'],
  /**
   * ⚠️ **Added 2026-08-31 by the Layer G delta audit. `/articles` was absent from
   * this list, and of everything absent from it these two matter most.**
   *
   * Every other public page gets the same policy, so a sibling route standing in
   * for it is a fair approximation. These are the ONLY routes on the site whose
   * policy can legitimately differ: `lib/preferredSource.ts` can add
   * `https://news.google.com` to `script-src` AND `frame-src`, and `proxy.ts`
   * passes that origin in **only** when `usesPreferredSource(pathname)` is true.
   * So the one page whose CSP is allowed to change was the one page this guard
   * never read the CSP from.
   *
   * It is switched off today (`PREFERRED_SOURCE.enabled === false`), which bounds
   * the exposure without closing it — and is exactly the state in which an absent
   * check is easiest to keep. When the owner flips it on, these two rows are what
   * turn "we widened the policy on some pages" into a measured fact: the index
   * must stay narrow, and an article page must gain those origins and nothing
   * else. Both are prerendered, so both take `'unsafe-inline'` and NO nonce — a
   * nonce on a prerendered page kills every script on it (G7, measured).
   */
  ['/articles', false, false, 'the articles index — prerendered'],
  ['/articles/how-far-do-asx-shares-fall', false, false, 'an article — prerendered, embeds JSON-LD, and the only page family whose policy can gain Google News origins'],
  ['/terms', false, false, 'a legal page — prerendered'],
  ['/contact', false, false, 'prerendered, and it posts a form'],
  ['/login', true, false, 'per-request, and it loads Google Identity Services'],
  ['/signup', true, false, 'per-request, the other Google surface'],
  ['/reset-password', true, false, 'per-request'],
  ['/pricing', true, false, 'per-request, and it starts Checkout'],
  ['/stocks', true, true, 'Browse — the signed-in entry point'],
  ['/stocks/us/AAPL', true, true, 'the heaviest page we ship, 57 inline scripts'],
  ['/account', true, true, 'the account page'],
];

const NONCE_IN_POLICY = /'nonce-([A-Za-z0-9+/_-]+={0,2})'/;

function scriptSrcOf(policy) {
  const directive = policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('script-src'));
  return directive ?? '';
}

const browser = await chromium.launch();
const problems = [];

/**
 * The browser's own verdict on every navigation, not a console scrape. Registered
 * on the CONTEXT and exactly once: added per-navigation inside the loop it would
 * stack a fresh listener each time and report one violation as six.
 */
const RECORD_VIOLATIONS = () => {
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__cspViolations.push(`${e.effectiveDirective} :: ${e.blockedURI || 'inline'}`);
  });
};

const publicCtx = await browser.newContext();
await publicCtx.addInitScript(RECORD_VIOLATIONS);
const publicPage = await publicCtx.newPage();

let appPage = null;
if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) {
  const appCtx = await browser.newContext();
  await appCtx.addInitScript(RECORD_VIOLATIONS);
  appPage = await appCtx.newPage();
  await appPage.goto(`${ORIGIN}/login`);
  await appPage.fill('input#email', process.env.E2E_EMAIL);
  await appPage.fill('input#password', process.env.E2E_PASSWORD);
  await appPage.getByRole('button', { name: /^sign in$/i }).click();
  await appPage.waitForURL(/\/stocks/, { timeout: 30_000 });
} else {
  // Not a warning to skim past: half this sample is gated, and a run that
  // silently drops it reports a clean site it never looked at.
  problems.push(
    'no E2E_EMAIL/E2E_PASSWORD — the signed-in routes could not be checked, ' +
      'and this run proves nothing about them',
  );
}

console.log(`content-security-policy on ${ORIGIN}\n`);

for (const [path, wantsNonce, needsAuth, why] of ROUTES) {
  if (needsAuth && !appPage) {
    console.log(`  ${path.padEnd(20)}  skipped (needs a session)`);
    continue;
  }
  const page = needsAuth ? appPage : publicPage;

  const response = await page.goto(ORIGIN + path, { waitUntil: 'load', timeout: 60_000 });
  const headers = response.headers();
  const landed = new URL(page.url()).pathname;

  if (landed !== path) {
    problems.push(`${path} redirected to ${landed} — that is not the route this row describes`);
    continue;
  }

  const policy = headers['content-security-policy'];
  const reportOnly = headers['content-security-policy-report-only'];

  if (!policy) {
    problems.push(`${path} sent NO Content-Security-Policy (${why})`);
    continue;
  }
  if (reportOnly) {
    problems.push(
      `${path} still sends Content-Security-Policy-Report-Only — a policy that ` +
        `reports and does not block is not a control`,
    );
  }

  const scriptSrc = scriptSrcOf(policy);
  const nonceMatch = scriptSrc.match(NONCE_IN_POLICY);

  if (scriptSrc.includes("'unsafe-eval'")) {
    problems.push(
      `${path} allows 'unsafe-eval'. That is the DEV-only concession for Turbopack ` +
        `and it must never reach a production build.`,
    );
  }

  if (wantsNonce) {
    if (!nonceMatch) {
      problems.push(
        `${path} renders per request but its script-src carries no nonce — it is ` +
          `shipping the weaker inline policy on a page holding a session (${why})`,
      );
    }
    if (scriptSrc.includes("'unsafe-inline'")) {
      problems.push(
        `${path} carries BOTH a nonce and 'unsafe-inline'. Browsers ignore ` +
          `'unsafe-inline' when a nonce is present, so this is not a hole — it is a ` +
          `policy that lies about what it enforces.`,
      );
    }
  } else {
    if (nonceMatch) {
      problems.push(
        `${path} is prerendered and its policy names a nonce. Its HTML was written ` +
          `at build time and carries none, so every script in it is refused: the page ` +
          `renders and then does nothing.`,
      );
    }
    if (!scriptSrc.includes("'unsafe-inline'")) {
      problems.push(`${path} is prerendered but its script-src has no 'unsafe-inline'`);
    }
  }

  // ── The header and the document must agree ────────────────────────────────
  const inDoc = await page.evaluate(() => {
    const tags = [...document.querySelectorAll('script')];
    // ⚠️ Only INLINE scripts are asked for a nonce, and finding that out cost a
    // false positive on `/login`. A script with a `src` is judged by its URL
    // against the allow-list (`'self'`, accounts.google.com) and needs no nonce
    // — Google Identity Services injects exactly such a tag, so the strict form
    // of this check failed intermittently depending on whether GIS had landed
    // before `load`. Flaky AND wrong. The 186 violations we actually measured
    // were all `script-src-elem :: inline`, which is what this now tracks.
    const inline = tags.filter((t) => !t.src);
    return {
      total: tags.length,
      inline: inline.length,
      nonces: [...new Set(inline.map((t) => t.nonce || t.getAttribute('nonce') || ''))],
      violations: window.__cspViolations ?? [],
    };
  });

  // A page that did not render has no scripts to refuse and would pass every
  // assertion above (14g).
  if (inDoc.inline < 3) {
    problems.push(
      `${path} has only ${inDoc.inline} inline script tags — it did not render, so ` +
        `nothing here was actually measured`,
    );
  }

  if (wantsNonce && nonceMatch) {
    const headerNonce = nonceMatch[1];
    const missing = inDoc.nonces.filter((n) => n !== headerNonce);
    if (missing.length) {
      problems.push(
        `${path}: the policy names nonce ${headerNonce} but ${missing.length} inline ` +
          `script value(s) do not carry it (${missing.map((n) => n || '«none»').join(', ')}). ` +
          `Those scripts are refused and the page will look finished and do nothing.`,
      );
    }

    // A nonce that repeats is not a nonce.
    const second = await page.context().request.get(ORIGIN + path);
    const secondPolicy = second.headers()['content-security-policy'] ?? '';
    const secondNonce = scriptSrcOf(secondPolicy).match(NONCE_IN_POLICY)?.[1];
    if (!secondNonce) {
      problems.push(`${path}: a second request came back with no nonce at all`);
    } else if (secondNonce === headerNonce) {
      problems.push(
        `${path}: two requests got the SAME nonce (${headerNonce}). A constant nonce ` +
          `is decoration — anyone who can read one page can write a script that passes.`,
      );
    }
  }

  if (inDoc.violations.length) {
    problems.push(
      `${path} reported ${inDoc.violations.length} CSP violation(s) in a real browser:\n` +
        `      ${[...new Set(inDoc.violations)].join('\n      ')}`,
    );
  }

  const form = wantsNonce
    ? `nonce ${nonceMatch ? nonceMatch[1].slice(0, 8) + '…' : 'MISSING '}`
    : 'inline         ';
  console.log(
    `  ${path.padEnd(20)} ${form}  ${String(inDoc.total).padStart(3)} scripts  ` +
      `${inDoc.violations.length} violations`,
  );
}

await browser.close();

if (problems.length) {
  console.error(`\n✗ check:csp — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  · ${p}\n`);
  process.exit(1);
}

// Print what was covered, never a bare tick: a check that quietly stops checking
// looks exactly like a check that passes.
console.log(
  `\n✓ check:csp — ${ROUTES.length} routes, ` +
    `${ROUTES.filter((r) => r[1]).length} with a per-request nonce, ` +
    `${ROUTES.filter((r) => !r[1]).length} prerendered, zero violations`,
);
