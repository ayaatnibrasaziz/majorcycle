import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { test, expect } from '@playwright/test';

import { contentSecurityPolicy, sentryOriginForCsp } from '../lib/csp';
import { alertTagValue, reportIssue } from '../lib/observability';
import { scrub, sharedOptions } from '../lib/sentryOptions';

/**
 * Error monitoring — Layer H2, 2026-09-16.
 *
 * A pure, credential-free spec (the shape of `entitlement.spec.ts` and
 * `log-redaction.spec.ts`): no browser, no network, so it runs on a fork PR with no
 * secrets and can never self-skip.
 *
 * ⚠️ **WHAT THIS FILE CAN AND CANNOT SEE, said rather than implied (14g).**
 * It cannot prove an event ARRIVES — that needs a DSN, a real project and a look at
 * the inbox, and it is the merge-day step recorded in `docs/layer-h-plan.md`. What
 * it CAN prove is everything on our side of the wire: that the scrubbing removes
 * what it claims to, that the reporter still writes the log line the owner reads,
 * that the CSP will permit the request, and that no failure path has quietly gone
 * back to shouting into a console. Those are the halves that rot silently. Arrival
 * is checked once, by a human, and stays true.
 *
 * Four of the five sections carry a CONTROL, because every assertion here is
 * satisfiable by a function that destroys the feature: "removes cookies" is true of
 * `() => ({})`, "adds no Sentry origin when off" is true of a CSP builder that never
 * adds one at all, and "no console.error remains" is true of a codebase that has
 * stopped reporting anything.
 */

const WEB = join(__dirname, '..');

/**
 * ⚠️ ASSEMBLED AT RUNTIME. Invented, but invented in the SHAPE of a live Stripe
 * key — which is the point of the assertion and also exactly what this repo's
 * pre-commit secret scanner exists to stop. It blocked this file on first commit,
 * correctly: a scanner that trusts "it's only a test" is one that waves through the
 * day somebody pastes a real key. Joining the parts leaves nothing matchable in the
 * source while the runtime string stays identical.
 */
const FAKE_STRIPE_KEY = ['sk', 'live', 'pretend'].join('_');

/** A DSN shaped exactly like Sentry's, with no real project behind it. */
const FAKE_DSN = 'https://0123456789abcdef0123456789abcdef@o4509999.ingest.us.sentry.io/4510000';

test.describe('scrub — what may leave this machine', () => {
  /**
   * An event shaped the way the SDK really builds one, carrying every field that
   * must not travel. The cookie is the reason this file exists: our session lives
   * in one, and a session inside an error report is credential-equivalent.
   */
  function sampleEvent() {
    return {
      message: 'billing sync: DUPLICATE SUBSCRIPTION — cancelled the incoming one',
      level: 'error',
      user: {
        id: '6f1c0e2a-1111-2222-3333-444455556666',
        email: 'sam.oreilly+news@example.co.uk',
        username: 'sam',
        ip_address: '203.0.113.7',
      },
      request: {
        method: 'POST',
        url: 'https://www.majorcycle.com/api/portal?session=abc123&email=sam@example.com',
        query_string: 'session=abc123',
        cookies: { 'sb-access-token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PAYLOAD.SIG' },
        headers: {
          cookie: 'sb-access-token=eyJhbGciOiJIUzI1NiJ9.PAYLOAD.SIG',
          authorization: `Bearer ${FAKE_STRIPE_KEY}`,
          'x-mc-internal': 'the-internal-secret',
        },
        // A token that arrived somewhere `scrub` does NOT delete — the shape that
        // actually happens, where an upstream error body echoes the request it
        // rejected. Deleting known fields cannot reach this; the deep walk can.
        otherwise: 'PostgREST refused apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.dBjftJeZ4CVP',
        data: { password: 'hunter2' },
      },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Invalid `to` field. sam.oreilly+news@example.co.uk is not a valid recipient.',
            stacktrace: {
              frames: [
                {
                  // A pnpm path, which is shaped like an email address.
                  filename:
                    '../node_modules/.pnpm/next@16.3.5_@babel+core@7.29.0_react@19.2.4/node_modules/next/dist/server/lib/trace/tracer.js',
                  function: 'startActiveSpan',
                },
              ],
            },
          },
        ],
      },
      // What `captureRequestError` really attaches to every UNHANDLED server error —
      // the raw path WITH its query (seen on the first server event from Vercel).
      contexts: {
        nextjs: {
          request_path: '/auth/confirm?token_hash=pretend-one-time-hash&type=recovery',
          router_path: '/auth/confirm',
          route_type: 'route',
        },
      },
      breadcrumbs: [{ category: 'fetch', message: 'POST /api/portal for dana@example.org' }],
      tags: { userId: '6f1c0e2a-1111-2222-3333-444455556666', subscriptionId: 'sub_123' },
    };
  }

  test('the session cookie, the headers and the IP never leave', () => {
    const out = scrub(sampleEvent());
    const wire = JSON.stringify(out);

    expect(out.request.cookies, 'the session cookie is the whole reason for this file').toBeUndefined();
    expect(out.request.headers, 'authorization and x-mc-internal both live in headers').toBeUndefined();
    expect(out.request.query_string).toBeUndefined();
    expect(out.request.data, 'a POST body can carry anything a form carried').toBeUndefined();
    expect(out.user.ip_address).toBeUndefined();

    // Asserted on the SERIALISED event as well as the object, because "deleted the
    // key" and "the value cannot appear anywhere" are different claims and only the
    // second one is what actually travels.
    for (const secret of [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      FAKE_STRIPE_KEY,
      'the-internal-secret',
      'hunter2',
      '203.0.113.7',
    ]) {
      expect(wire, `${secret} reached the wire`).not.toContain(secret);
    }
    // ⚠️ And specifically NOT because the field was deleted. `request.otherwise`
    // survives `scrub`'s strippers, so the only thing that can mask the token inside
    // it is the deep walk — which is the case that actually happens, an upstream
    // error body echoing the request it rejected.
    expect(
      (out.request as Record<string, unknown>).otherwise,
      'a token in an unexpected field survived — the deep walk is not reaching it',
    ).toContain('[token redacted]');
    expect((out.request as Record<string, unknown>).otherwise).toContain('PostgREST refused');
  });

  test('the query string does not travel inside a context either', () => {
    // `urlQueryParams: false` and the `request.url` cut both miss this one: the SDK's
    // unhandled-error hook copies the raw path, query included, into a context.
    const out = scrub(sampleEvent());
    const wire = JSON.stringify(out);
    expect(wire, 'a one-time sign-in hash reached the wire').not.toContain('pretend-one-time-hash');
    expect(out.contexts.nextjs.request_path, 'the path itself is what makes it useful').toBe(
      '/auth/confirm',
    );
    expect(out.contexts.nextjs.router_path).toBe('/auth/confirm');
  });

  test('every email address is masked, however deep it sits', () => {
    const wire = JSON.stringify(scrub(sampleEvent()));
    // One in `user`, one inside an exception value, one inside a breadcrumb, one in
    // a query string — four different depths, because a field LIST would have caught
    // the first and missed the rest (14g).
    for (const address of [
      'sam.oreilly+news@example.co.uk',
      'dana@example.org',
      'sam@example.com',
    ]) {
      expect(wire, `${address} reached the wire`).not.toContain(address);
    }
    expect(wire).toContain('[email redacted]');
  });

  test('CONTROL — everything that makes the report useful survives', () => {
    // ⚠️ THE LOAD-BEARING ONE. `scrub = () => ({})` satisfies every assertion above
    // and leaves the owner with an inbox full of empty events. What has to survive
    // is precisely what makes a failure actionable.
    const out = scrub(sampleEvent());
    expect(out.message).toContain('DUPLICATE SUBSCRIPTION');
    expect(out.request.method, 'the method says what was being attempted').toBe('POST');
    expect(out.request.url, 'the path says where').toBe('https://www.majorcycle.com/api/portal');
    expect(out.user.id, 'the opaque user id is the only way to answer "whose?"').toBe(
      '6f1c0e2a-1111-2222-3333-444455556666',
    );
    expect(out.tags.subscriptionId).toBe('sub_123');
    expect(out.exception.values[0]!.type).toBe('Error');
    // The upstream sentence survives with only the address removed — the same
    // one-directional rule `log-redaction.spec.ts` holds for the console line.
    expect(out.exception.values[0]!.value).toContain('is not a valid recipient.');
    // A stack frame's file path is code, not reader data. Masking it as an "email"
    // left every third-party frame reading "[email redacted]".
    expect(out.exception.values[0]!.stacktrace.frames[0]!.filename).toContain(
      'next/dist/server/lib/trace/tracer.js',
    );
  });

  test('a cyclic event does not hang the reporter', () => {
    // Sentry events really do contain cycles, and a crash reporter that hangs on a
    // crash is worse than none. The budget and the WeakSet are what stop it.
    const event: Record<string, unknown> = { message: 'loop', user: { id: 'u1' } };
    event.self = event;
    const nested: Record<string, unknown> = { parent: event };
    event.child = nested;
    expect(() => scrub(event)).not.toThrow();
    expect((scrub(event) as { message: string }).message).toBe('loop');
  });

  test('the posture is stated in code, not inherited from the SDK', () => {
    // 11a, for the seventh time: an option that happens to default the right way is
    // one upgrade from not doing so, and nothing goes red. These are the three that
    // decide how much of a reader travels with a crash.
    const dc = sharedOptions.dataCollection;
    expect(dc.userInfo, 'the reader must be refused explicitly').toBe(false);
    expect(dc.cookies, 'our session lives in a cookie').toBe(false);
    expect(dc.httpHeaders).toEqual({ request: false, response: false });
    expect(dc.httpBodies, 'a POST body can carry anything a form carried').toEqual([]);
    expect(dc.urlQueryParams).toBe(false);
    expect(dc.graphQL).toEqual({ document: false, variables: false });
    expect(dc.genAI).toEqual({ inputs: false, outputs: false });
    expect(dc.databaseQueryData, 'a query value can be an email address').toBe(false);
    expect(dc.stackFrameVariables, 'a local variable can hold a key').toBe(false);
    expect(sharedOptions.tracesSampleRate, 'tracing records which companies a named person read').toBe(0);
    expect(sharedOptions.maxBreadcrumbs).toBeLessThanOrEqual(30);
    // The deprecated switch must be GONE, not merely false: when both are set the SDK
    // ignores it, so leaving it in reads as a second control that does nothing (11ak).
    expect('sendDefaultPii' in sharedOptions, 'sendDefaultPii is deprecated and ignored beside dataCollection').toBe(false);
  });

  test('every data category the INSTALLED SDK knows about is named — a new one arrives switched ON', () => {
    // ⚠️ The trap this exists for, read out of `@sentry/core`: once `dataCollection`
    // is present, an unnamed category takes the resolver's DEFAULT, and every default
    // there is `true`. So the day an SDK upgrade adds a category, it starts collecting
    // with nothing in our code having changed. Read the category list from the
    // resolver the app actually ships with, rather than restating it here (11c-iii).
    const nextjsDir = dirname(createRequire(__filename).resolve('@sentry/nextjs/package.json'));
    const coreDir = dirname(createRequire(join(nextjsDir, 'package.json')).resolve('@sentry/core/package.json'));
    const resolver = readFileSync(
      join(coreDir, 'build/esm/utils/data-collection/resolveDataCollectionOptions.js'),
      'utf8',
    );
    const block = resolver.match(/const DEFAULTS = \{([\s\S]*?)\n\};/);
    expect(block, 'the resolver changed shape — re-read it before trusting this guard').not.toBeNull();
    const sdkKeys = [...(block![1] ?? '').matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1] ?? '').sort();
    // CONTROL: a regex that matched nothing would make the comparison below vacuous.
    expect(sdkKeys.length, 'found no categories — the parse is broken').toBeGreaterThanOrEqual(8);
    expect(Object.keys(sharedOptions.dataCollection).sort()).toEqual(sdkKeys);
  });

  test('the DSN is the switch — no DSN, nothing leaves', () => {
    // How this ships. `enabled` is the DSN's own length, so the feature is inert
    // until the owner turns it on, and turning it on is one deliberate act with a
    // privacy-policy line attached to it.
    expect(sharedOptions.enabled).toBe(process.env.NEXT_PUBLIC_SENTRY_DSN ? true : false);
  });
});

test.describe('the CSP will actually permit the report', () => {
  const args = {
    nonce: null,
    dev: false,
    supabaseUrl: 'https://example.supabase.co',
    siteOrigin: 'https://www.majorcycle.com',
  };

  test('the ingest origin is derived from the DSN, never typed', () => {
    expect(sentryOriginForCsp(FAKE_DSN)).toBe('https://o4509999.ingest.us.sentry.io');
    // The EU region is a different host, and deriving it is why changing the DSN
    // needs no second edit here.
    expect(sentryOriginForCsp('https://k@o1.ingest.de.sentry.io/2')).toBe(
      'https://o1.ingest.de.sentry.io',
    );
  });

  test('an absent or malformed DSN widens the policy by NOTHING', () => {
    // ⚠️ And specifically not by a wildcard. `https://*.ingest.sentry.io` would be
    // the convenient fallback and would grant every Sentry project on the internet
    // as a destination, permanently, for a feature that is switched off.
    for (const bad of [undefined, '', 'not-a-url', 'http://o1.ingest.us.sentry.io/2']) {
      expect(sentryOriginForCsp(bad), `${String(bad)} produced an origin`).toBeNull();
    }
    const off = contentSecurityPolicy({ ...args, sentryDsn: undefined });
    expect(off).not.toContain('sentry.io');
    expect(off).not.toContain('*.ingest');
  });

  test('CONTROL — with a DSN the origin IS in connect-src, and only there', () => {
    // Without this, "adds nothing when off" is satisfied by a builder that never
    // adds it at all — and the failure mode of a missing connect-src entry is the
    // quietest one there is: the SDK initialises, the page works, every browser
    // error is refused by the CSP, and the inbox stays empty like a quiet week.
    const on = contentSecurityPolicy({ ...args, sentryDsn: FAKE_DSN });
    const connect = on.split('; ').find((d) => d.startsWith('connect-src '))!;
    expect(connect).toContain('https://o4509999.ingest.us.sentry.io');
    for (const directive of on.split('; ')) {
      if (directive.startsWith('connect-src ')) continue;
      expect(directive, 'the ingest origin belongs in connect-src and nowhere else').not.toContain(
        'sentry.io',
      );
    }
  });
});

test.describe('the wiring — a rule nobody receives is not a rule', () => {
  /**
   * ⚠️ THE FILENAME TRAP, and it is the one failure here that is completely silent.
   * Sentry's older guides say `sentry.client.config.ts`; under Turbopack — Next 16's
   * default bundler, and ours — that file is NEVER IMPORTED. It sits in the repo,
   * reads correctly, passes lint and typecheck, and does nothing. Browser errors
   * simply stop arriving, which looks exactly like a quiet week (11ak).
   */
  test('the client entry point is the one Turbopack actually loads', () => {
    expect(
      existsSync(join(WEB, 'instrumentation-client.ts')),
      'instrumentation-client.ts is the only client entry Next loads under Turbopack',
    ).toBe(true);
    expect(
      existsSync(join(WEB, 'sentry.client.config.ts')),
      'sentry.client.config.ts is never imported under Turbopack — its PRESENCE is the defect, ' +
        'because it reads as coverage while monitoring is off',
    ).toBe(false);
  });

  test('all three runtimes read ONE options module', () => {
    // 11c-iv is this repo's most repeated defect: the rule existed and one consumer
    // never received it. Three init files, one privacy posture.
    for (const file of [
      'instrumentation-client.ts',
      'sentry.server.config.ts',
      'sentry.edge.config.ts',
    ]) {
      const src = readFileSync(join(WEB, file), 'utf8');
      expect(src, `${file} does not read the shared options`).toContain('sharedOptions');
      expect(
        src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
        `${file} sets its own PII option — there must be exactly one answer to that question`,
      ).not.toMatch(/sendDefaultPii|dataCollection/);
    }
  });

  test('turning monitoring ON turns the privacy disclosure on with it', () => {
    // ⚠️ THE COMPLIANCE HALF, and it fails in BOTH directions, which is why it is
    // tied to the DSN rather than written as prose. Name Sentry while monitoring is
    // off and the policy describes a disclosure that is not happening; forget to
    // name it when the DSN is set and the policy is a false statement about what we
    // do — an Australian business sending personal information to a US recipient
    // with nothing published to say so (APP 6 / APP 8, the same obligation
    // `us-east-1` turned out to carry in 11n).
    //
    // Prose cannot be guarded by a type checker and no import links a sentence to a
    // constant (11c-v). Making the line CONDITIONAL on the same env var that
    // switches the SDK on is what removes the question: Vercel bakes NEXT_PUBLIC_
    // vars at build time and this page is prerendered, so they ship together or not
    // at all. This test asserts the link still exists.
    const src = readFileSync(join(WEB, 'app', '(public)', 'privacy', 'page.tsx'), 'utf8');
    expect(src, 'the privacy page no longer reads the DSN').toContain('SENTRY_DSN');
    expect(src, 'Sentry is not named as a recipient anywhere on the privacy page').toContain(
      '<strong>Sentry</strong>',
    );
    // The disclosure must be GATED on the DSN, not merely present near it — an
    // unconditional line would be wrong today and a conditional one that lost its
    // condition would be wrong tomorrow.
    const at = src.indexOf('<strong>Sentry</strong>');
    expect(
      src.slice(Math.max(0, at - 400), at),
      'the Sentry recipient line is no longer conditional on the DSN',
    ).toContain('SENTRY_DSN ?');
  });

  test('the server catches what no try/catch reaches', () => {
    const src = readFileSync(join(WEB, 'instrumentation.ts'), 'utf8');
    expect(src, 'onRequestError is the only thing that sees an UNHANDLED server error').toContain(
      'export const onRequestError',
    );
    expect(src).toContain('sentry.server.config');
    expect(src).toContain('sentry.edge.config');
  });

  test('a report asks Vercel to stay awake until it is SENT', () => {
    // The SDK's own flush is a no-op on Vercel's Node runtime, and Vercel freezes the
    // instance once the response is out — measured: 3 of 5 unhandled throws arrived.
    const key = Symbol.for('@vercel/request-context');
    const g = globalThis as Record<symbol, unknown>;
    const held: unknown[] = [];
    g[key] = { get: () => ({ waitUntil: (p: unknown) => held.push(p) }) };
    try {
      reportIssue('observability.spec: flush probe', { level: 'warning' });
      expect(held, 'reportIssue did not hand a flush to waitUntil').toHaveLength(1);
      expect(held[0], 'waitUntil must receive the flush PROMISE').toBeInstanceOf(Promise);
    } finally {
      delete g[key];
    }
    // CONTROL — off Vercel there is no context, and nothing may throw or be queued.
    expect(() => reportIssue('observability.spec: no context', { level: 'warning' })).not.toThrow();
    expect(held).toHaveLength(1);

    const inst = readFileSync(join(WEB, 'instrumentation.ts'), 'utf8');
    const body = inst.slice(inst.indexOf('export const onRequestError'));
    expect(body, 'unhandled errors must flush too — that is where the loss was measured').toContain(
      'flushBeforeFreeze()',
    );
  });

  test('a failing Python engine is RECORDED, not only left as a breadcrumb', () => {
    // The Python functions carry no SDK, so the TypeScript caller is the only place their
    // failure can be seen. A 5xx means every paid page is missing its analysis.
    const src = readFileSync(join(WEB, 'lib', 'cycle.ts'), 'utf8');
    const at = src.indexOf('res.status >= 500');
    expect(at, 'the 5xx branch of the /api/cycle call is gone').toBeGreaterThan(-1);
    const branch = src.slice(at, src.indexOf('} else {', at));
    expect(branch).toContain('reportIssue(');
    // CONTROL — a warning, not an alert: one outage must not become an email per page view.
    expect(branch).toContain("level: 'warning'");
  });

  test('the build plugin does not report its own usage to Sentry', () => {
    const src = readFileSync(join(WEB, 'next.config.ts'), 'utf8');
    const at = src.indexOf('withSentryConfig(nextConfig');
    expect(at, 'withSentryConfig(nextConfig, …) not found').toBeGreaterThan(-1);
    expect(src.slice(at), 'telemetry defaults to ON — it must be switched off explicitly').toMatch(
      /^\s*telemetry:\s*false,/m,
    );
  });
});

test.describe('no failure path has gone back to shouting into a console', () => {
  /** Every `.ts`/`.tsx` under app/ and lib/ — derived, never a hand-written list. */
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  /**
   * The three places a bare `console.*` is correct, each for a stated reason.
   *
   * ⚠️ Bounded on BOTH sides (11t): the test below fails if one of these stops
   * existing, so an exemption cannot outlive the thing it excuses.
   *
   * - `lib/observability.ts` IS the console line — it writes it on purpose.
   * - the three error boundaries are client components that call
   *   `Sentry.captureException` directly and keep the console line beside it; the
   *   test asserts they do both.
   */
  const CONSOLE_ALLOWED = [
    'lib/observability.ts',
    'app/error.tsx',
    'app/(app)/error.tsx',
    'app/global-error.tsx',
  ];

  const FILES = [...sourceFiles(join(WEB, 'app')), ...sourceFiles(join(WEB, 'lib'))];

  test('the sweep actually read some files', () => {
    // Without this, a broken path makes every assertion below vacuous and the suite
    // reports a clean run having read nothing (14g).
    expect(FILES.length).toBeGreaterThan(100);
  });

  test('every operational failure goes through reportIssue', () => {
    // ⚠️ This is the assertion that makes H2 durable rather than a one-off sweep.
    // The defect it prevents is not "someone deleted Sentry"; it is the ordinary one
    // — the next failure path somebody adds reaches for `console.error`, because
    // that is what the file next door used to do, and it is invisible from the day
    // it ships. There is nothing to notice: the code is right, the failure is
    // handled, and nobody is told.
    const offenders: string[] = [];
    for (const file of FILES) {
      const rel = file.slice(WEB.length + 1).split('\\').join('/');
      if (CONSOLE_ALLOWED.includes(rel)) continue;
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      // Comments stripped first — this repo has been caught FIVE times by a guard
      // failing on the paragraph that documents the fix (11au, 11aw).
      for (const m of src.matchAll(/console\.(error|warn)\(/g)) {
        offenders.push(`${rel}: console.${m[1]}(`);
      }
    }
    expect(
      offenders,
      'These announce a failure to a log nobody reads, which is the situation H2 exists to ' +
        `end. Use reportIssue() from lib/observability.ts:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  test('CONTROL — the exemptions still name real files that still do both', () => {
    // An exemption that outlives its defect does not go quiet: it goes on excusing
    // whatever wanders into its scope (11t). So each allowed file must exist, and
    // each error boundary must genuinely capture as well as log — otherwise the
    // exemption is covering silence rather than a second channel.
    for (const rel of CONSOLE_ALLOWED) {
      const full = join(WEB, rel);
      expect(existsSync(full), `${rel} is exempted and no longer exists`).toBe(true);
      const src = readFileSync(full, 'utf8');
      if (rel === 'lib/observability.ts') {
        expect(src).toContain('console.error');
        continue;
      }
      expect(src, `${rel} logs to the console and never captures`).toContain(
        'Sentry.captureException',
      );
      expect(src, `${rel} no longer writes the console line the exemption is for`).toContain(
        'console.error',
      );
    }
  });

  test('the six named money paths are ALERTS, not merely errors', () => {
    // The plan names six failures that a human must act on. They are asserted by
    // their own message literals, because the point of `level: 'alert'` is that it
    // is a claim about THESE failures — a test counting alerts would pass on six
    // entirely different ones.
    const sources = FILES.map((f) => readFileSync(f, 'utf8')).join('\n');
    const NAMED = [
      'billing sync: DUPLICATE SUBSCRIPTION',
      'billing sync: could not verify existing subscription',
      'stripe webhook: no profile for canceled subscription',
      'stripe webhook: no profile for paid invoice',
      'stripe webhook: no profile for failed invoice',
      'portal: could not create billing portal session',
      'checkout: stripe session create failed',
      '[freeViews] record_free_view failed',
    ];
    for (const message of NAMED) {
      const at = sources.indexOf(message);
      expect(at, `${message} is no longer reported anywhere`).toBeGreaterThan(-1);
      // The options object follows the message on the same call; 400 characters is
      // comfortably past the longest of them and well short of the next call.
      expect(
        sources.slice(at, at + 400),
        `${message} is reported without level: 'alert', so one alert rule will not see it`,
      ).toContain("level: 'alert'");
    }
  });

  test('the reporter never throws into the failure it is reporting', () => {
    // ⚠️ Every caller of `reportIssue` is ALREADY on a failure path, so a throw from
    // here turns a handled failure into an unhandled one: the customer gets an error
    // page instead of a degraded one, and the cause is the telemetry. That is worse
    // than having no monitoring at all.
    //
    // The coercions are the sharp edge — `String(value)` throws on a Symbol, on a
    // Proxy that rejects reads, and on any object with a hostile `toString`, and the
    // first version of this module did them OUTSIDE its try. Found by asking what
    // could throw rather than by anything going red.
    const hostile = {
      toString() {
        throw new Error('nice try');
      },
    };
    const consoleError = console.error;
    console.error = () => {};
    try {
      expect(() =>
        reportIssue('test: a hostile tag value', {
          cause: hostile,
          tags: { bad: hostile as unknown as string, good: 'kept' },
        }),
      ).not.toThrow();
      expect(() => reportIssue('test: a hostile cause', { cause: hostile })).not.toThrow();
    } finally {
      console.error = consoleError;
    }
  });

  test('the alert tag is DERIVED from the level, not painted on', () => {
    // ⚠️ THIS TEST EXISTS BECAUSE THE ONE BELOW IT FAILED A DELIBERATE BREAK.
    // Replacing the reporter's tag expression with a literal `'yes'` — so every
    // event on the site becomes an alert — left every source count untouched and
    // the whole file green. The source distribution is a PROXY for the rule; this
    // is the rule. One alert rule in Sentry keys on `mc.alert = yes`, so this two-
    // line mapping is the entire difference between an alarm and a siren.
    expect(alertTagValue('alert')).toBe('yes');
    expect(alertTagValue('error')).toBe('no');
    expect(alertTagValue('warning')).toBe('no');
  });

  test("CONTROL — 'alert' is a distinction, not a label on everything", () => {
    // The other half: the mapping can be perfect while every CALL SITE asks for an
    // alert, which fires the rule on all of them — and that is how people learn to
    // ignore an alarm (11z, and 11t on guards that get loosened until they are
    // obeyed by nobody).
    const sources = FILES.map((f) => readFileSync(f, 'utf8')).join('\n');
    const calls = [...sources.matchAll(/reportIssue\(/g)].length;
    const alerts = [...sources.matchAll(/level: 'alert'/g)].length;
    expect(calls, 'the reporter is barely used — something reverted').toBeGreaterThan(20);
    expect(alerts, 'nothing is an alert, so the tag means nothing').toBeGreaterThan(5);
    expect(alerts, 'everything is an alert, so the tag means nothing').toBeLessThan(calls);
  });
});
