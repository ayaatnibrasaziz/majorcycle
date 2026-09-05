import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The downloaded report must actually RENDER when opened from disk.
 *
 * This suite exists because that file was blank in production for four days and
 * nothing went red. `Download Report` produced a well-formed 4 MB .html — correct
 * title, a 2.6 MB JSON payload, a 1.09 MB script — that threw
 * `ReferenceError: process is not defined` on load and mounted nothing.
 *
 * WHY EVERY OTHER CHECK MISSED IT. The bundle is a SECOND build of the same
 * components (esbuild, not Next), so typecheck and lint see healthy source; the
 * paywall and report-section guards read source too. The e2e suite exercised the
 * report ROUTE — which returns JSON and was perfectly fine — and never opened the
 * file the customer receives. And the cause was not in the report code at all: a
 * paywall component three imports away began pulling in `next/link`, whose module
 * scope reads `process.env.__NEXT_ROUTER_BASEPATH`.
 *
 * So this asserts the OUTCOME (the file mounts and shows its sections) rather than
 * any mechanism. A `process` shim lives in `scripts/build-report-bundle.mjs`, but
 * the next breakage will be some other stray import, and this test does not care
 * which — it only cares that the artifact still works.
 *
 * It must open the file over `file://`. A blob URL in an iframe inherits the
 * site's CSP, which blocks the inline script and produces a blank page for a
 * reason that has nothing to do with the bundle — a false positive that cost an
 * hour to see through.
 *
 * Self-skips without Supabase service credentials, like the other account suites.
 */

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const RUN = Date.now();
const EMAIL = `report-dl-e2e-${RUN}@example.com`;
const PASSWORD = `E2e!reportdl-${RUN}`;

test.describe('downloaded report renders from disk', () => {
  let admin: SupabaseClient;
  let userId: string;

  test.skip(
    !SERVICE_KEY || !SUPABASE_URL,
    'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to run',
  );

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      email_confirm: true,
      password: PASSWORD,
    });
    if (error || !data?.user) throw new Error(`could not create user: ${error?.message}`);
    userId = data.user.id;

    // An ACTIVE subscription: the report is a premium artifact, and a free
    // account is refused at the route before any file is built.
    await admin.from('profiles').upsert(
      {
        id: userId,
        email: EMAIL,
        acknowledged_disclaimer_at: new Date().toISOString(),
        subscription_status: 'active',
      },
      { onConflict: 'id' },
    );
  });

  test.afterAll(async () => {
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  test('the .html mounts, throws nothing, and carries its sections', async ({ page, context }) => {
    test.setTimeout(180_000);

    await page.goto('/login');
    await page.fill('input#email', EMAIL);
    await page.fill('input#password', PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/stocks/, { timeout: 30_000 });

    // The download handler fetches these two at click time. They are produced by
    // `prebuild`, which does NOT run for `next dev` — so without an explicit
    // build step the click fetches a 404 and simply never fires a download,
    // which surfaces as an inscrutable 2-minute timeout. Say so instead.
    // ⚠️ POLLED, not a single request, and the reason is a false accusation.
    // On 2026-08-24 this went flaky under full-suite parallel load and reported
    // `/report-bundle/report.js is missing — run pnpm build:report-bundle` — while
    // both files sat on disk, 1.09 MB and 438 KB, built minutes earlier. The
    // dev server had simply not answered that one request; the precondition then
    // blamed the developer for something they had already done.
    //
    // A check that misstates its own failure is worse than no check: it sends you
    // to rebuild an artifact that is already correct. Polling separates "not there"
    // from "not there YET", and only the first is the developer's problem.
    for (const asset of ['/report-bundle/report.js', '/report-bundle/report.css']) {
      await expect
        .poll(async () => (await page.request.get(asset)).status(), {
          message: `${asset} never answered 200 — if this persists, run \`pnpm build:report-bundle\` (next dev does not)`,
          timeout: 15_000,
        })
        .toBe(200);
    }

    /* Registered BEFORE the navigation, deliberately. The idle prefetch can land
       during page load, and a `waitForResponse` set up afterwards would sit
       waiting for a response that had already happened — turning a race into a
       guaranteed one-minute stall. A flag set by a listener cannot miss it. */
    let bundleFetched = false;
    page.on('response', (r) => {
      if (/report-bundle\/report\.js/.test(r.url()) && r.ok()) bundleFetched = true;
    });

    await page.goto('/stocks/us/AAPL');
    await expect(page.getByRole('button', { name: /download report/i })).toBeVisible({
      timeout: 30_000,
    });
    // The button paints before React hydrates, so a click here can land on markup
    // with no handler attached and silently do nothing. Wait for the page to go
    // quiet first — the handler also fetches the 1 MB bundle on click.
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});

    /* ⚠️ WAIT FOR THE BUNDLE TO BE IN HAND, rather than sleeping and hoping.
       This was `waitForTimeout(3_000)` and it went intermittently red in long
       runs while passing every time in isolation — the shape that gets written
       off as "environmental". It was not environmental, and the cause was a
       deliberate change to the PRODUCT made one commit earlier: the offline
       report bundle used to be prefetched eagerly on mount, so by the time this
       test clicked, 588 KB was already cached. It is now deferred to
       `requestIdleCallback` (up to 5s) and fired only for an entitled viewer,
       precisely so it stops competing with the page a reader is waiting for.
       Correct for customers, and it means a fixed 3-second sleep is now a race:
       on a loaded machine the click lands first and the download has to fetch
       the bundle inside the handler, blowing the test's budget.

       Hovering is what a real reader does and what the product optimises for —
       `warmReportData` on `mouseenter` starts the same fetch immediately. So
       hover, wait for the bytes to actually arrive, then click. No sleep, and
       no dependence on how busy the machine is. */
    await page.getByRole('button', { name: /download report/i }).hover();
    await expect
      .poll(() => bundleFetched, {
        message:
          'the offline report bundle never arrived, even after hovering the button. ' +
          'Either the prefetch is broken or /report-bundle/report.js is not being served.',
        timeout: 60_000,
      })
      .toBe(true);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      page.getByRole('button', { name: /download report/i }).click(),
    ]);

    const file = path.join(os.tmpdir(), `e2e-${RUN}-${download.suggestedFilename()}`);
    await download.saveAs(file);

    // A file that downloads but is a stub would still pass every assertion below
    // if the page merely failed quietly, so pin the size too.
    const { size } = await fs.stat(file);
    expect(size, 'the report should be a multi-MB self-contained document').toBeGreaterThan(
      500_000,
    );

    const offline = await context.newPage();
    const pageErrors: string[] = [];
    offline.on('pageerror', (e) => pageErrors.push(String(e)));

    // ── The file must not phone home (audit P6) ────────────────────────────
    // This is a document that LEAVES THE BUILDING. Once a customer has it, they
    // may open it on a plane, in five years, or somewhere they would not expect
    // a financial file to announce itself — so it must be genuinely
    // self-contained, not merely self-contained-looking. Fonts are inlined as
    // data URIs and the charts are drawn locally; nothing in it has any reason
    // to reach the network, and a single stray URL would be invisible to a
    // reader and obvious to whoever received the request.
    //
    // Collected here and asserted after the mount, so a request fired during
    // rendering is caught rather than raced.
    const offsite: string[] = [];
    offline.on('request', (r) => {
      const url = r.url();
      if (!/^(file|data|blob):/.test(url)) offsite.push(url.slice(0, 160));
    });

    await offline.goto('file:///' + file.replace(/\\/g, '/'));

    // A blank report fails as "mount never filled", which says nothing about why.
    // The uncaught error is the actual diagnosis, so surface it in the failure
    // instead of leaving a bare timeout — the real one read
    // `ReferenceError: process is not defined`.
    try {
      await offline.waitForFunction(
        () => (document.getElementById('report-mount')?.children.length ?? 0) > 0,
        undefined,
        { timeout: 60_000 },
      );
    } catch {
      throw new Error(
        'The downloaded report never mounted — the customer gets a blank page.' +
          (pageErrors.length
            ? `\nUncaught in the file: ${pageErrors.join(' | ')}`
            : '\nNo uncaught error was reported; check the bundle actually loaded.'),
      );
    }

    // Any uncaught error means the customer's file is broken, whatever the cause.
    expect(pageErrors, 'the offline report must throw nothing').toEqual([]);

    expect(
      offsite,
      'the downloaded report requested something over the network. It is meant to be a ' +
        'self-contained file a customer can open anywhere, forever — anything here is ' +
        'both a broken-when-offline surface and a request their machine makes on our ' +
        'behalf, to somebody, from a financial document (audit P6).',
    ).toEqual([]);

    const body = await offline.evaluate(() => document.body.innerText);
    expect(body.length, 'a mounted report has real text').toBeGreaterThan(2_000);
    expect(body).toContain('MAJOR CYCLE ANALYSIS REPORT');
    expect(body).toMatch(/OVERALL RATING/);
    expect(body).toMatch(/not financial advice/i);

    // It is an INTERACTIVE report — charts must have drawn, not just headings.
    const curves = await offline.evaluate(
      () => document.querySelectorAll('.recharts-wrapper path.recharts-curve').length,
    );
    expect(curves, 'the report charts should render').toBeGreaterThan(0);

    await offline.close();
    await fs.unlink(file).catch(() => {});
  });
});
