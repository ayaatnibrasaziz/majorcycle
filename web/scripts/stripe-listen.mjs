// Local Stripe webhook forwarder for MajorCycle.
//
// Runs `stripe listen` against the SANDBOX account that the app's
// STRIPE_SECRET_KEY belongs to, and forwards every webhook to the local dev
// server at /api/stripe/webhook. Run it in its own terminal alongside `pnpm dev`:
//
//     pnpm stripe:listen
//
// Why this wrapper (not a bare `stripe listen`): the Stripe CLI's saved login can
// point at a DIFFERENT Stripe account than the one the app talks to. If they
// disagree, `stripe listen` watches the wrong account and NO webhook ever arrives
// — a silent, confusing failure. This wrapper reads the key from web/.env.local
// and hands it to the CLI via the STRIPE_API_KEY env var (which the CLI honours
// and which overrides its saved login), so it ALWAYS listens on the right
// account. The key is never printed and never placed on the command line.
//
// Prereqs: the Stripe CLI (`stripe version`) and Node. Run via `pnpm stripe:listen`
// (from web/) with the dev server on the configured PORT.

import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { preferIPv4 } from './prefer-ipv4.mjs';

// Local dev: skip the stalling IPv6/AAAA DNS lookup so the preflight fetch below
// doesn't cold-connect time out. See prefer-ipv4.mjs.
preferIPv4();

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = join(scriptDir, '..', '.env.local'); // web/.env.local
const PORT = process.env.PORT || '3000';
if (!/^\d+$/.test(PORT)) {
  console.error(`\n✖ PORT must be a number (got "${PORT}").\n`);
  process.exit(1);
}
const FORWARD_TO = `localhost:${PORT}/api/stripe/webhook`;

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// Which key to hand the CLI. STRIPE_TEST_ADMIN_KEY wins when present.
//
// The app's STRIPE_SECRET_KEY is deliberately a RESTRICTED key scoped exactly like
// the live one (5 permissions, Customers = None) so local dev cannot do anything
// production cannot. The Stripe CLI is not the app: `stripe listen` opens a CLI
// session and this script reads GET /v1/account first, neither of which the app's
// five permissions cover. Pointing the forwarder at the restricted key would make
// `pnpm stripe:listen` fail with a permissions error that looks like a bug in our
// code. So the dev harness gets its own full sk_test — one key per use case, which
// is Stripe's own guidance.
//
// The fallback keeps this script working for anyone who has only ever set
// STRIPE_SECRET_KEY (and for the pre-split history in this repo).
const KEY_VARS = ['STRIPE_TEST_ADMIN_KEY', 'STRIPE_SECRET_KEY'];

function readSecretKey() {
  let text;
  try {
    text = readFileSync(envPath, 'utf8');
  } catch {
    fail(`Couldn't read ${envPath}. Are you running this from the web/ folder?`);
  }
  for (const name of KEY_VARS) {
    const m = text.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, 'm'));
    const key = m && m[1].trim().replace(/^["']|["']$/g, '');
    if (!key) continue;
    if (key.startsWith('sk_live') || key.startsWith('rk_live')) {
      fail(`${name} is a LIVE key — refusing to forward live events to localhost. Use the test/sandbox key.`);
    }
    return { key, name };
  }
  fail(`Neither ${KEY_VARS.join(' nor ')} is set in web/.env.local.`);
}

const { key, name: keyVar } = readSecretKey();

// Confirm (and show) which account we're about to watch — the account id is not a
// secret, and seeing "MajorCycle sandbox" is the owner's assurance it's test mode.
const res = await fetch('https://api.stripe.com/v1/account', {
  headers: { Authorization: `Bearer ${key}` },
}).catch((e) => fail(`Couldn't reach Stripe: ${e}`));
const acct = await res.json().catch(() => ({}));
if (!res.ok) {
  const why = acct.error?.message ?? `HTTP ${res.status}`;
  // A restricted key lacks the Account-read permission, so this is the expected
  // failure when someone has only STRIPE_SECRET_KEY set post-split. Say so, rather
  // than leaving the owner to read it as a broken key.
  const hint =
    keyVar === 'STRIPE_SECRET_KEY' && !key.startsWith('sk_')
      ? '\n  STRIPE_SECRET_KEY is a RESTRICTED key (rk_…), which cannot read the account.' +
        '\n  Set STRIPE_TEST_ADMIN_KEY in web/.env.local to your full sk_test_ key — the' +
        '\n  CLI needs powers the app deliberately does not have. See .env.example.'
      : '';
  fail(`Stripe rejected ${keyVar}: ${why}${hint}`);
}

const name = acct.settings?.dashboard?.display_name ?? acct.id;
console.log(`\n▶ Forwarding webhooks for: ${name} (${acct.id})`);
console.log(`  using ${keyVar}`);
console.log(`  → ${FORWARD_TO}`);
console.log('  Test mode — safe. Press Ctrl+C to stop.\n');
console.log('  NOTE: the "webhook signing secret" the CLI prints below must match');
console.log('  STRIPE_WEBHOOK_SECRET in web/.env.local. If it differs, paste it in');
console.log('  and restart `pnpm dev`.\n');

// Pass the key via STRIPE_API_KEY (env), NOT --api-key (which would put it in the
// process arg list). This forces the sandbox account regardless of `stripe login`.
// Run through the shell as a single command string (PORT is validated numeric
// above, so there's nothing to inject) — this also lets Windows resolve the
// `stripe` CLI on PATH without the args-array + shell deprecation warning.
const child = spawn(`stripe listen --forward-to ${FORWARD_TO}`, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, STRIPE_API_KEY: key },
});
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (e) => fail(`Couldn't start the Stripe CLI: ${e.message}. Is it installed? (stripe version)`));
