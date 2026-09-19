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
  // ⚠️ The instability that prompted this was NOT a product bug and, as it turned
  // out, not really a test bug either: it was the reused dev server (see
  // `reuseExistingServer` below). With that fixed the suite ran 145/145 four times
  // in a row, zero flaky.
  //
  // I originally justified this line with a "control" run on the pre-G1 commit that
  // appeared to show the same failures. That experiment was WORTHLESS — the server it
  // talked to had been started from the Layer G branch and was never restarted, so it
  // measured the wrong code entirely. The conclusion it supported (`pre-existing, not
  // ours`) may or may not be true; it was not evidence either way. Recorded because a
  // plausible experiment that silently measures nothing is worse than no experiment.
  //
  // The retry is kept anyway, on its own merits: a local run should not be able to
  // disagree with CI about whether the suite passed.
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
  // ⚠️ Chromium only, unless `pnpm e2e:browsers` asks for all three (Layer H4).
  // Owner decision 4: the cross-browser run is local and on demand, NOT in CI, so a
  // push is not slowed. It is gated on an env var rather than always declaring three
  // projects because CI runs a bare `playwright test`, which would otherwise run all
  // of them. `scripts/e2e-browsers.mjs` runs each engine SEPARATELY and prints three
  // totals — see its header for why one combined total is not evidence.
  projects: process.env.MC_ALL_BROWSERS === '1'
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        // Longer limits for the two engines that are slower HERE, not for readers:
        // measured on the dev server, the ticker page loads ~1s later in Firefox and
        // every resize costs ~1.7x, so the first full run timed out on loads and on
        // the long sweeps — never on an assertion. A limit is a budget for the
        // machine; a wrong value would still fail.
        { name: 'firefox', timeout: 120_000, use: { ...devices['Desktop Firefox'], navigationTimeout: 90_000 } },
        { name: 'webkit', timeout: 120_000, use: { ...devices['Desktop Safari'], navigationTimeout: 90_000 } },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    // ⚠️ Turbopack's dev filesystem cache OFF for this server only — see the note
    // in `next.config.ts`. Sampled every 20s across a real run, it took this
    // machine from 11.47 GB free to 0.00 GB in eleven minutes and failed the suite
    // with ENOSPC three times, scattering red across unrelated specs that were
    // perfectly healthy. The cache buys a throwaway server nothing: it is never
    // reused (see `reuseExistingServer` below) and `.next-dev` is routinely
    // cleared. 83 MB against ~11 GB, measured.
    // ⚠️ AND THE HEAP, because turning the cache off MOVED the problem rather
    // than removing it. With no filesystem cache Turbopack holds more in memory,
    // and the next run died with `FATAL ERROR: Zone Allocation failed - process
    // out of memory` at ~4 GB — which is not this machine running out (16 GB
    // total, 8.5 free) but **Node's own default old-space cap**, which sits near
    // 4 GB on a 16 GB box. The dev server took 31 tests down with it and the run
    // reported no failures at all: "31 did not run, 678 passed", exit 1. A suite
    // that dies rather than fails is the most misreadable result there is, so the
    // two settings belong together and are commented together.
    env: { MC_E2E_NO_FS_CACHE: '1', NODE_OPTIONS: '--max-old-space-size=6144' },
    url: BASE_URL,
    // NEVER reuse. This was `!process.env.CI`, i.e. locally a run would attach to
    // whatever `next dev` already held port 3100 — no matter how old it was or which
    // branch it had been started from.
    //
    // That turned the suite into an instrument that lies, and it lied to me for an
    // entire session. A dev server left running across several `git checkout`s was
    // answering with a mix of stale and current code, and the results were spectacular
    // nonsense: the same report test failed 8 of 8 in isolation against the reused
    // server and passed 4 of 4 the moment it was killed. Worse, a "control" run I did
    // on the pre-G1 commit was served by a process started from the Layer G branch, so
    // it measured nothing at all — I nearly reported a pre-existing bug on that basis.
    //
    // Booting a server costs ~30 seconds. Being unable to trust a green run costs a
    // great deal more. `pnpm e2e` now always tests the working tree in front of it.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
