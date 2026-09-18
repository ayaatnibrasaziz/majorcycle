/**
 * The ONE set of Sentry options every runtime uses — H2, 2026-09-16.
 *
 * Three files initialise this SDK (`instrumentation-client.ts`,
 * `sentry.server.config.ts`, `sentry.edge.config.ts`) and every one of them needs
 * the same answer to the same question: what may leave this machine? Written once
 * here, because a privacy rule kept in three places is a privacy rule that drifts,
 * and the copy that drifts is the one nobody re-reads (11c). Three consumers, one
 * rule — and 11c-iv is the defect where the rule existed and one consumer never
 * received it.
 *
 * ── WHY THIS FILE IS THE SECURITY-CRITICAL HALF OF H2 ────────────────────────
 * A `console.error` goes to a Vercel log the owner reads. An error sent to Sentry
 * goes to a third party, in another country, and carries far more than the message:
 * by default this SDK can attach the request's cookies, its headers, the reader's
 * IP address and every URL they visited on the way. **Our session lives in a
 * cookie.** A session cookie inside an error report is credential-equivalent — the
 * same class as the Customer Portal redirect in 11a — and it would be shipped by an
 * ordinary failure on an ordinary page, with nothing on screen to show for it.
 *
 * So the posture is: send the smallest thing that still lets the owner debug.
 *
 * ⚠️ **AND WE SAY IT OURSELVES RATHER THAN INHERIT IT.** `dataCollection` below
 * already withholds these, so the strippers in `scrub()` below are, today, removing
 * fields the SDK was never going to attach. That is deliberate. This repo has now
 * been bitten SIX times by a response that was safe because of somebody else's
 * default (11a) — the rule learned from those is not "check the default", it is
 * **"state it, AND guard it"**, because an unasserted property is one upgrade away
 * from being gone and nothing goes red. An SDK's defaults are somebody else's to
 * change.
 */

import { redactSensitive } from './redact';

/**
 * The DSN is the switch for the whole feature.
 *
 * Empty ⇒ `Sentry.init` is a no-op and not one byte leaves the machine. That is the
 * safe direction and it is also how this ships: the code lands inert, and the owner
 * turning it on is a deliberate act with a privacy-policy line attached to it.
 *
 * ⚠️ A DSN is PUBLIC — it is compiled into the browser bundle by design, and it
 * grants nothing but the ability to post an event. It is not a secret and must not
 * be treated as one, or the next person will hide it somewhere the client build
 * cannot reach and quietly disable browser monitoring. `SENTRY_AUTH_TOKEN`, which
 * uploads source maps at build time, IS a secret and is server-only.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

/**
 * Which deployment an event came from, so a preview's noise never reads as
 * production's. `VERCEL_ENV` is `production` | `preview` | `development`; locally it
 * is unset, and `local` is a more honest label than a missing field.
 */
export const SENTRY_ENVIRONMENT =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? 'local';

/** The commit an event came from, so "which deploy broke this" has an answer. */
export const SENTRY_RELEASE =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA;

/** The tag one alert rule keys on — see `lib/observability.ts`. */
export const ALERT_TAG = 'mc.alert';

type Loose = Record<string, unknown>;

/**
 * Walk every string in an event and mask anything shaped like an email address.
 *
 * ⚠️ **A deep walk rather than a list of fields, and that is the whole point.** The
 * addresses we already know about are handled in `redact.ts` — upstream error
 * bodies from Resend. What reaches Sentry is *everything else*: a stack frame's
 * local variable, a breadcrumb from a fetch, an exception message somebody writes
 * next year. A field list is a hand-written list, and this repo's standing finding
 * about those is that they are silent about whatever is not on them (14g).
 *
 * Bounded at depth 8 and 5,000 entries so a cyclic or enormous payload cannot turn
 * a crash report into a hang. `seen` handles cycles, which Sentry events do have.
 */
/** Stack-frame keys that hold a path to CODE, left unmasked by `maskDeep`. */
const CODE_PATH_KEYS = new Set(['filename', 'abs_path', 'module']);

function maskDeep(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
  budget = { left: 5000 },
): unknown {
  if (depth > 8 || budget.left <= 0) return value;
  budget.left -= 1;
  if (typeof value === 'string') return redactSensitive(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = maskDeep(value[i], seen, depth + 1, budget);
    }
    return value;
  }
  const obj = value as Loose;
  for (const key of Object.keys(obj)) {
    // A stack frame's file path is code, never reader data — and pnpm paths are
    // shaped like addresses (`next@16.3.5_…@19.2.4/…/tracer.js`), so masking them
    // turned every third-party frame into "[email redacted]". Measured on the first
    // server-side event from Vercel, 2026-09-18.
    if (CODE_PATH_KEYS.has(key) && typeof obj[key] === 'string') continue;
    obj[key] = maskDeep(obj[key], seen, depth + 1, budget);
  }
  return obj;
}

/**
 * Remove the things that must never leave, then mask what is left.
 *
 * Exported so a test can drive the real function rather than restate it — a guard
 * that re-implements the rule guards nothing (11c-iii).
 */
export function scrub<T extends object>(event: T): T {
  const loose = event as Loose;
  const req = loose.request as Loose | undefined;
  if (req) {
    // 1. COOKIES — our session lives here. Never, under any option.
    delete req.cookies;
    // 2. HEADERS — `authorization`, `x-mc-internal` and `cookie` all live here, and
    //    a partial strip is the shape that leaves one behind. Take the lot: the
    //    method and the path below are what actually help diagnose a failure.
    delete req.headers;
    // 3. THE QUERY STRING. Nothing here is supposed to put personal data in a URL,
    //    so this removes little — which is the argument FOR doing it: it costs no
    //    diagnostic value and closes the case where a future parameter carries
    //    something it should not.
    delete req.query_string;
    delete req.data;
    if (typeof req.url === 'string') {
      const cut = req.url.indexOf('?');
      if (cut >= 0) req.url = req.url.slice(0, cut);
    }
  }
  // 4. THE READER. `dataCollection.userInfo: false` already withholds the IP; saying
  //    so here means a future `true` — set for some unrelated reason — cannot hand it over
  //    as a side effect. The user's `id` is deliberately KEPT: it is the opaque
  //    Supabase UUID we already log, and without it "whose subscription is
  //    duplicated?" has no answer.
  // ⚠️ The query string reaches the event a SECOND way that `urlQueryParams: false`
  // does not govern: `captureRequestError` (every UNHANDLED server error) writes
  // `contexts.nextjs.request_path` as the raw path WITH its query. Found on the
  // first server-side event from Vercel, 2026-09-18, reading `?mode=throw`. On this
  // site a query can be `/auth/callback?code=…` or `/auth/confirm?token_hash=…` —
  // one-time sign-in credentials — or a Stripe `session_id`. Cut at `?` in every
  // context, not just `nextjs`, so the next integration that copies a URL is covered.
  const contexts = loose.contexts as Record<string, unknown> | undefined;
  if (contexts && typeof contexts === 'object') {
    for (const ctx of Object.values(contexts)) {
      if (!ctx || typeof ctx !== 'object') continue;
      const c = ctx as Loose;
      for (const k of Object.keys(c)) {
        const v = c[k];
        if (typeof v === 'string' && /(?:path|url)$/i.test(k) && v.includes('?')) {
          c[k] = v.slice(0, v.indexOf('?'));
        }
      }
    }
  }

  const user = loose.user as Loose | undefined;
  if (user) {
    delete user.ip_address;
    delete user.email;
    delete user.username;
  }
  return maskDeep(loose) as T;
}

/**
 * Options shared by all three runtimes.
 *
 * ⚠️ **`tracesSampleRate: 0` — performance tracing is OFF, and that is a decision
 * rather than an omission.** A trace records every URL a reader visits, which on
 * this site is a record of which companies a named person looked at. H2 exists
 * because a duplicate subscription is cancelled and nobody is told; that is an
 * ERROR, and errors are what this turns on. Tracing can be enabled later by an
 * owner who wants it, with a privacy line to match — it must not arrive as a side
 * effect of installing error monitoring.
 *
 * ⚠️ **No Session Replay, for the same reason and more so:** it records the screen,
 * including a signed-in reader's own account page.
 */
export const sharedOptions = {
  dsn: SENTRY_DSN,
  enabled: SENTRY_DSN.length > 0,
  environment: SENTRY_ENVIRONMENT,
  release: SENTRY_RELEASE,
  /**
   * ⚠️ **EVERY CATEGORY IS NAMED, AND THAT IS THE WHOLE POINT (audit, 2026-09-17).**
   *
   * This was `sendDefaultPii: false` until the SDK deprecated it for this option
   * (removed in v11; ignored when both are set). The trap in the replacement, read
   * out of `@sentry/core`'s own resolver: **the moment `dataCollection` is present,
   * every category it does NOT name defaults to ON** — `userInfo` included. So a
   * one-line "upgrade" to `{ userInfo: false }` would have quietly started sending
   * request headers, cookies, bodies, query strings and database values that the old
   * option withheld. Nothing would error and the privacy policy would be wrong.
   *
   * Hence the full list, each at its strictest. `e2e/observability.spec.ts` reads the
   * installed resolver's category list and fails if the SDK ever adds one that is
   * not named here, because a new category arrives switched ON.
   *
   * `frameContextLines` is the one thing kept: it is lines of OUR source code around
   * a stack frame, which is what makes a trace readable, and holds no reader data.
   * `scrub` still runs on every event as the second layer.
   */
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    // `never[]` rather than `[]`: the object is `as const`, which would make this a
    // readonly tuple the SDK's type refuses. Empty either way — no body is collected.
    httpBodies: [] as never[],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    stackFrameVariables: false,
    frameContextLines: 5,
  },
  tracesSampleRate: 0,
  /**
   * How many breadcrumbs ride along with an event. The default is 100; each one can
   * carry a URL or a console line, so this is the second-largest thing an event
   * sends after the stack. 30 is enough to see what happened just before a failure.
   */
  maxBreadcrumbs: 30,
  beforeSend: <T extends object>(event: T) => scrub(event),
  beforeSendTransaction: <T extends object>(event: T) => scrub(event),
} as const;
