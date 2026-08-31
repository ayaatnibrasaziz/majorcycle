#!/usr/bin/env node
/**
 * The WIRE SWEEP — does any paid value reach a viewer who has not paid for it?
 *
 * ⚠️ **NOT A CI GATE, and deliberately not in `pnpm gates`.** This is an audit tool the
 * owner runs by hand against a DEPLOYED preview. It WRITES to the live `profiles` row of
 * the E2E account to drive each billing state, and restores it in a `finally`. Nothing
 * that mutates a real account belongs in an automatic gate.
 *
 *   pnpm audit:wire-sweep
 *     SWEEP_ORIGIN=https://<preview>.vercel.app
 *     SWEEP_SHARE=<the _vercel_share token, for an SSO-gated preview>
 *
 * ── Why this file exists at all ─────────────────────────────────────────────
 * It was written for Layer 3 of the Layer G audit on 2026-08-24, run once, and thrown
 * away because it was a scratch script. On 2026-08-31 the sweep had to be re-run — the
 * entitlement reader had been rewritten — and the whole harness had to be rebuilt from
 * the PROSE in docs/layer-g-audit.md. It is committed now so that a third rebuild is not
 * the price of a third run. Owner approved 2026-08-31.
 *
 * ── The five protections, each bought by a defect (audit F-023) ─────────────
 *   1. REFUSES localhost. `/api/cycle` is a Vercel PYTHON function and `next start` does
 *      not serve it, so on a local production build no page carries a paid payload for
 *      ANYONE — a leak sweep then finds nothing because there is nothing to find, and
 *      reports exactly what a clean system reports (CLAUDE.md 14g).
 *   2. Needles are PARSED OUT of `lib/cycle.ts` at run time, never restated here, so the
 *      list cannot drift from the real `PREMIUM_FIELDS`.
 *   3. Searches BOTH `"key"` and `\"key\"`. In the RSC payload the JSON sits inside a
 *      JavaScript string literal with every quote backslash-escaped; the first version of
 *      this search matched nothing anywhere and pronounced the site clean.
 *   4. A POSITIVE CONTROL. An entitled viewer's ticker page MUST contain the premium
 *      keys; if it does not, the search is broken and every clean row above it is
 *      meaningless. The run says so in those words and fails.
 *   5. Restores the account in a `finally` — which has already earned itself once, on a
 *      run that crashed at sign-in.
 *
 * ⚠️ **The METHOD is part of the surface.** On 2026-08-31 this sent GET to `/api/analyze`,
 * which implements only `do_POST`; the request reached Python's BaseHTTPRequestHandler
 * default, which answers **501** with `public, max-age=0, must-revalidate` — a header our
 * code never wrote — and the sweep reported six confident findings about a `public` cache
 * directive on the screener. **A red run is not automatically red for your reason**, and
 * the tell was a status code this codebase never returns.
 *
 * ⚠️ **Verify the restore independently.** The script prints what it restored to; that is
 * the one claim it cannot check about itself. Read the row back through the Supabase
 * connector afterwards.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^['"]|['"]$/g, '');
}

if (process.env.CI) {
  console.error(
    'REFUSING to run in CI. This sweep WRITES to the billing state of a real account ' +
      'to drive each case. It is a hand-run audit tool, not a gate — see the header.',
  );
  process.exit(2);
}

const ORIGIN = process.env.SWEEP_ORIGIN;
const SHARE = process.env.SWEEP_SHARE ?? '';
if (!ORIGIN) throw new Error('SWEEP_ORIGIN is required');
if (/localhost|127\.0\.0\.1/.test(ORIGIN)) {
  console.error(
    'REFUSING to run against localhost. /api/cycle is a Vercel Python function that\n' +
      '`next start` does not serve, so no page carries a paid payload for anyone and a\n' +
      'clean result would prove nothing (audit F-023).',
  );
  process.exit(2);
}

// ── The needles, parsed from the real source ────────────────────────────────
const cycleSrc = readFileSync('lib/cycle.ts', 'utf8');
const block = cycleSrc.match(/const PREMIUM_FIELDS = \[([\s\S]*?)\] as const;/);
if (!block) throw new Error('could not parse PREMIUM_FIELDS out of lib/cycle.ts');
const FIELDS = [...block[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
if (FIELDS.length < 5) throw new Error(`parsed only ${FIELDS.length} premium fields — parser broke`);

/** Both spellings: raw JSON, and JSON escaped inside a JS string literal. */
function findLeaks(body) {
  const hits = [];
  for (const f of FIELDS) {
    if (body.includes(`"${f}"`) || body.includes(`\\"${f}\\"`)) hits.push(f);
  }
  return hits;
}

// ── The billing states, from lib/entitlement.ts ─────────────────────────────
const NOW = Date.now();
const IN_GRACE = new Date(NOW + 2 * 864e5).toISOString();
const PAST_GRACE = new Date(NOW - 2 * 864e5).toISOString();

const STATES = [
  ['active', { subscription_status: 'active', grace_until: null, billing_blocked: false }, true],
  ['trialing', { subscription_status: 'trialing', grace_until: null, billing_blocked: false }, true],
  ['past_due (in grace)', { subscription_status: 'past_due', grace_until: IN_GRACE, billing_blocked: false }, true],
  ['past_due (grace over)', { subscription_status: 'past_due', grace_until: PAST_GRACE, billing_blocked: false }, false],
  ['canceled', { subscription_status: 'canceled', grace_until: null, billing_blocked: false }, false],
  ['unpaid', { subscription_status: 'unpaid', grace_until: null, billing_blocked: false }, false],
  ['incomplete', { subscription_status: 'incomplete', grace_until: null, billing_blocked: false }, false],
  ['incomplete_expired', { subscription_status: 'incomplete_expired', grace_until: null, billing_blocked: false }, false],
  ['paused', { subscription_status: 'paused', grace_until: null, billing_blocked: false }, false],
  ['no subscription (free)', { subscription_status: null, grace_until: null, billing_blocked: false }, false],
  ['billing_blocked (dispute)', { subscription_status: 'active', grace_until: null, billing_blocked: true }, false],
];

/**
 * ⚠️ The METHOD is part of the surface, and getting it wrong produced six confident
 * false findings on the first run of this sweep. `/api/analyze` implements only
 * `do_POST`; a GET reaches Python's BaseHTTPRequestHandler default, which answers
 * **501 with `public, max-age=0, must-revalidate`** — a header our code never wrote,
 * on a response that never carries data. Reported as-is it would have read as a
 * `public` cache directive on the screener endpoint. **A red run is not automatically
 * red for your reason.**
 */
const SURFACES = [
  ['page   /stocks/us/AAPL', '/stocks/us/AAPL', 'GET'],
  ['report /stocks/us/AAPL/report', '/stocks/us/AAPL/report', 'GET'],
  ['api    /api/analyze', '/api/analyze', 'POST'],
  ['api    /api/cycle', '/api/cycle?ticker=AAPL&market=us', 'GET'],
  ['page   /run', '/run', 'GET'],
];

// ── The account under test ──────────────────────────────────────────────────
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
if (!SUPA || !SRK || !EMAIL || !PASSWORD) throw new Error('missing env for the sweep');

async function readProfile() {
  const r = await fetch(
    `${SUPA}/rest/v1/profiles?email=eq.${encodeURIComponent(EMAIL)}&select=subscription_status,grace_until,billing_blocked`,
    { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } },
  );
  if (!r.ok) throw new Error(`profile read failed: ${r.status}`);
  const rows = await r.json();
  if (rows.length !== 1) throw new Error(`expected 1 profile row, got ${rows.length}`);
  return rows[0];
}

async function setProfile(patch) {
  const r = await fetch(`${SUPA}/rest/v1/profiles?email=eq.${encodeURIComponent(EMAIL)}`, {
    method: 'PATCH',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`profile write failed: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  if (rows.length !== 1) throw new Error(`patch touched ${rows.length} rows, expected 1`);
  return rows[0];
}

const ORIGINAL = await readProfile();
console.log('sweep target :', ORIGIN);
console.log('needles      :', FIELDS.length, 'premium fields parsed from lib/cycle.ts');
console.log('account      :', EMAIL.replace(/(.{3}).*(@.*)/, '$1…$2'));
console.log('original     :', JSON.stringify(ORIGINAL), '(restored at the end)\n');

const rows = [];
let controlFields = null;
const browser = await chromium.launch();

try {
  for (const [label, patch, expectEntitled] of STATES) {
    await setProfile(patch);

    // A fresh context per state: a cached RSC payload from the previous state would
    // be the single easiest way to fake either a leak or a clean result.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    if (SHARE) await page.goto(`${ORIGIN}/?_vercel_share=${SHARE}`, { waitUntil: 'domcontentloaded' });

    // ⚠️ Retried once, deliberately. The first attempt of the first state failed on a
    // COLD preview deployment — the auth route had never been invoked, and the sign-in
    // POST timed out. Read as a finding that would have been wrong; the probe that
    // followed signed in fine against the now-warm deployment. `commit` rather than
    // `load` because /stocks is the heaviest page we ship and we only need the URL.
    let signedIn = false;
    for (let attempt = 1; attempt <= 2 && !signedIn; attempt++) {
      try {
        await page.goto(`${ORIGIN}/login`, { waitUntil: 'domcontentloaded' });
        await page.fill('input#email', EMAIL);
        await page.fill('input#password', PASSWORD);
        await page.getByRole('button', { name: /^sign in$/i }).click();
        await page.waitForURL(/\/(stocks|account|reactivate|pricing)/, {
          timeout: 60_000,
          waitUntil: 'commit',
        });
        signedIn = true;
      } catch (e) {
        if (attempt === 2) throw e;
        console.log(`  (sign-in attempt ${attempt} failed for "${label}", retrying)`);
      }
    }

    for (const [surface, path, method] of SURFACES) {
      let status = 0;
      let cache = '(NONE)';
      let body = '';
      try {
        const opts = { maxRedirects: 0 };
        if (method === 'POST') {
          opts.data = { tickers: ['AAPL'], preset: 'medium' };
          opts.headers = { 'Content-Type': 'application/json' };
        }
        const res =
          method === 'POST'
            ? await page.request.post(`${ORIGIN}${path}`, opts)
            : await page.request.get(`${ORIGIN}${path}`, opts);
        status = res.status();
        cache = res.headers()['cache-control'] ?? '(NONE)';
        body = await res.text();
      } catch (e) {
        cache = `ERROR ${String(e).slice(0, 60)}`;
      }
      const leaks = findLeaks(body);
      if (expectEntitled && surface.startsWith('page   /stocks') && leaks.length) {
        controlFields = leaks;
      }
      rows.push({ state: label, expectEntitled, surface, status, cache, bytes: body.length, leaks });
      console.log(
        `  ${label.padEnd(26)} ${surface.padEnd(30)} ${String(status).padEnd(4)} ` +
          `${String(body.length).padStart(7)}B  ${leaks.length ? 'LEAK ' + leaks.join(',') : '—'}  ${cache}`,
      );
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  const back = await setProfile({
    subscription_status: ORIGINAL.subscription_status,
    grace_until: ORIGINAL.grace_until,
    billing_blocked: ORIGINAL.billing_blocked,
  });
  console.log('\nrestored     :', JSON.stringify({
    subscription_status: back.subscription_status,
    grace_until: back.grace_until,
    billing_blocked: back.billing_blocked,
  }));
}

writeFileSync(process.env.SWEEP_OUT ?? '../sweep-result.json', JSON.stringify(rows, null, 2));

// ── The verdict ─────────────────────────────────────────────────────────────
const problems = [];

if (!controlFields) {
  problems.push(
    'THE SEARCH IS BROKEN — ignore every row above. An ENTITLED viewer\'s ticker page\n' +
      '    contained none of the premium fields, so a clean result for the denied states is\n' +
      '    the result a broken needle also produces (audit F-023 / CLAUDE.md 14g).',
  );
} else {
  console.log(`\ncontrol      : entitled page carries ${controlFields.length} premium fields — the search works`);
}

const leaked = rows.filter((r) => !r.expectEntitled && r.leaks.length);
for (const r of leaked) {
  problems.push(`LEAK: ${r.state} saw ${r.leaks.join(', ')} on ${r.surface}`);
}

const badCache = rows.filter(
  (r) => r.status !== 0 && !/private/.test(r.cache) ,
);
for (const r of badCache) {
  problems.push(`CACHE: ${r.state} / ${r.surface} sent "${r.cache}" — every per-viewer response must say private`);
}

const shared = rows.filter((r) => /public|s-maxage|stale-while-revalidate/.test(r.cache));
for (const r of shared) problems.push(`SHARED CACHE: ${r.state} / ${r.surface} sent "${r.cache}"`);

console.log(`\n${rows.length} checks · ${STATES.length} billing states × ${SURFACES.length} surfaces`);
if (problems.length) {
  console.error('\n✗ wire sweep — ' + problems.length + ' problem(s):\n');
  for (const p of problems) console.error('  · ' + p + '\n');
  process.exit(1);
}
console.log('✓ wire sweep — zero premium keys in any denied state, every response private');
