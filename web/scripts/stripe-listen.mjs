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

function readSecretKey() {
  let text;
  try {
    text = readFileSync(envPath, 'utf8');
  } catch {
    fail(`Couldn't read ${envPath}. Are you running this from the web/ folder?`);
  }
  const m = text.match(/^\s*STRIPE_SECRET_KEY\s*=\s*(.*)$/m);
  const key = m && m[1].trim().replace(/^["']|["']$/g, '');
  if (!key) fail('STRIPE_SECRET_KEY is not set in web/.env.local.');
  if (key.startsWith('sk_live') || key.startsWith('rk_live')) {
    fail('STRIPE_SECRET_KEY is a LIVE key — refusing to forward live events to localhost. Use the test/sandbox key.');
  }
  return key;
}

const key = readSecretKey();

// Confirm (and show) which account we're about to watch — the account id is not a
// secret, and seeing "MajorCycle sandbox" is the owner's assurance it's test mode.
const res = await fetch('https://api.stripe.com/v1/account', {
  headers: { Authorization: `Bearer ${key}` },
}).catch((e) => fail(`Couldn't reach Stripe: ${e}`));
const acct = await res.json().catch(() => ({}));
if (!res.ok) fail(`Stripe rejected the key: ${acct.error?.message ?? `HTTP ${res.status}`}`);

const name = acct.settings?.dashboard?.display_name ?? acct.id;
console.log(`\n▶ Forwarding webhooks for: ${name} (${acct.id})`);
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
