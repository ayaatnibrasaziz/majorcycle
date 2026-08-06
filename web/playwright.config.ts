import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Local dev: force IPv4-only DNS in the test process so its Supabase admin calls
// don't cold-connect time out. The spawned `next dev` webServer gets the same fix
// via web/instrumentation.ts. See scripts/prefer-ipv4.mjs.
import { preferIPv4 } from './scripts/prefer-ipv4.mjs';
preferIPv4();

/**
 * E2E config for the auth/routing regression suite (`e2e/`). Boots a real Next
 * dev server (middleware enforced — DEV_BYPASS_AUTH is NOT set) on an isolated
 * port and drives it with Chromium. Credential-free tests always run; the
 * authenticated matrix runs only when E2E_EMAIL + E2E_PASSWORD are provided.
 */

// Load local env files into the TEST process so `pnpm e2e` picks up E2E_EMAIL /
// E2E_PASSWORD without shell fiddling. `.env.e2e` wins over `.env.local`; neither
// overrides a value already in the environment (so CI's real env vars take
// precedence). Both files are gitignored (`.env*`). Next loads its own copy for
// the dev server; this is only so the spec's process.env sees the creds.
for (const file of ['.env.local', '.env.e2e']) {
  try {
    // Resolved against cwd, which is `web/` when run via `pnpm e2e`.
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trimStart().startsWith('#')) continue;
      const key = m[1]!;
      let val = (m[2] ?? '').trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // File absent — fine; CI supplies these via real env vars.
  }
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // One retry EVERYWHERE, not just CI. This was `process.env.CI ? 1 : 0`, which made
  // a local run strictly LESS reliable than CI and produced exactly one bad outcome:
  // a full run aborting with a single failure nobody could explain, while CI — same
  // code — went green. A harness that disagrees with CI about whether the suite
  // passed is a harness you cannot cite as evidence.
  //
  // The failure is infrastructure, not product, and it PREDATES Layer G. Measured on
  // the pre-G1 commit: 2 of 4 full runs failed, one with `read ECONNRESET` on
  // `POST /api/analyze-dev`. That route is correct — it consumes the request body
  // before replying — so this is the classic keep-alive race: `next dev` closes an
  // idle socket at the instant Playwright reuses it, and the client sees a reset
  // instead of the 400 it was about to receive. Neither real browsers nor Vercel's
  // edge behave this way, so nothing here reaches production.
  //
  // ⚠️ This hides NOTHING. Playwright reports a retried pass as **flaky** on its own
  // line: "142 passed, 2 flaky" reads differently from "144 passed", and a flaky
  // count is a signal to investigate, never noise to skip. Read the whole summary
  // line, not the colour — same rule as always, one level further in.
  retries: 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    navigationTimeout: 45_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
