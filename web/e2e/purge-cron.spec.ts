import { expect, test } from '@playwright/test';

import { PURGE_BATCH, isAuthorisedCronCall, selectDueForPurge } from '../lib/purge';

/**
 * The account-purge cron — the route that permanently deletes users.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * `/api/cron/purge-accounts` is the highest-stakes route in the product and it had
 * **no automated test of any kind** until 2026-08-23. It was driven once by hand
 * during the F3 live-check in July and never again. The Layer G coverage map found
 * it: the route appeared in zero specs, and the two files that mentioned "purge" at
 * all were using the word inside a comment and a test title.
 *
 * ── ⚠️ What this file deliberately does NOT do ──────────────────────────────
 * **It never calls the route with a valid `CRON_SECRET`.** There is no test
 * Supabase — dev, preview and production all point at the one real database — so a
 * test that proved the purge works would be a test that really deletes whichever
 * accounts happened to be due that morning, including a customer who had just
 * changed their mind and reactivated. A green tick is not worth that, and the
 * failure would be irreversible and invisible.
 *
 * So the route is covered in two halves that together answer the question that
 * actually matters — **who can trigger it, and what it would take**:
 *
 *   1. **The gate**, over HTTP. Nobody without the secret gets past the door.
 *   2. **The selection**, with a stub client. Which rows the query would hand to
 *      the delete loop, asserted without deleting anything.
 *
 * What remains uncovered, stated plainly rather than left to silence: that a
 * *valid* call actually cancels Stripe, tombstones the email, sends the notice and
 * removes the auth user. That path is exercised only by the live cron and by the
 * owner's July walkthrough. Covering it needs a disposable database, which is a
 * Phase 2 decision, not something to fake here.
 *
 * The selection tests are pure — no browser, no network, no credential — so they
 * run on a fork PR and can never self-skip, the same contract as
 * `stock-read-errors.spec.ts` and `entitlement.spec.ts`.
 */

const CRON_PATH = '/api/cron/purge-accounts';

/* ────────────────────────── the selection, with a stub ────────────────────── */

interface Call {
  method: string;
  args: unknown[];
}

/**
 * Records the PostgREST chain instead of executing it. Every builder method returns
 * the same object, so the real chain resolves, and `then` makes the builder awaitable
 * exactly as the Supabase query builder is.
 */
function recordingClient(rows: unknown[] = []) {
  const calls: Call[] = [];
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  const builder = {
    select: record('select'),
    not: record('not'),
    lte: record('lte'),
    order: record('order'),
    range: record('range'),
    then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: rows, error: null }),
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return builder;
    },
  };
  return { client, calls, find: (m: string) => calls.find((c) => c.method === m) };
}

// A distinctive instant, so an assertion cannot pass by matching some other
// timestamp the code happened to have lying around.
const NOW = '2026-08-23T04:05:06.789Z';

test.describe('purge cron — which accounts it would delete', () => {
  test('reads the profiles table', async () => {
    const { client, find } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await selectDueForPurge(client as any, NOW);
    expect(find('from')?.args[0]).toBe('profiles');
  });

  test('an account that never asked to be deleted is excluded', async () => {
    const { client, find } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await selectDueForPurge(client as any, NOW);
    // Without this filter the query returns EVERY user and the loop deletes the
    // entire customer base on the next nightly run.
    expect(find('not')?.args, 'must require deletion_scheduled_at to be set').toEqual([
      'deletion_scheduled_at',
      'is',
      null,
    ]);
  });

  test('only accounts whose 30-day grace has ALREADY elapsed', async () => {
    const { client, find } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await selectDueForPurge(client as any, NOW);
    // ⚠️ The quietest of the three to lose. Dropping `lte` deletes everyone with a
    // pending request the moment they ask, grace window and all — and the cron
    // still succeeds, still reports a plausible count, and the only symptom is
    // customers who reactivate finding nothing left. Asserting the VALUE (not just
    // that lte was called) is what makes this sensitive to a wrong bound.
    expect(find('lte')?.args).toEqual(['deletion_scheduled_at', NOW]);
  });

  test('oldest first, so a backlog drains in the order people asked', async () => {
    const { client, find } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await selectDueForPurge(client as any, NOW);
    expect(find('order')?.args).toEqual(['deletion_scheduled_at', { ascending: true }]);
  });

  test('the batch is bounded, because PostgREST truncates at 1000 in silence', async () => {
    const { client, find } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await selectDueForPurge(client as any, NOW);
    // CLAUDE.md 14c. An unbounded read would stop purging past row 1000 with no
    // error and no warning. Paging is wrong here — rows are DELETED as they are
    // handled, which shifts every later offset — so one bounded batch that
    // self-drains on the next daily run is the correct shape.
    expect(find('range')?.args).toEqual([0, PURGE_BATCH - 1]);
    expect(PURGE_BATCH).toBeLessThan(1000);
  });

  test('every column the delete loop needs is selected', async () => {
    const { client, find } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await selectDueForPurge(client as any, NOW);
    const cols = String(find('select')?.args[0] ?? '');
    // Each of these is load-bearing downstream: `id` deletes the auth user, `email`
    // both tombstones the trial and addresses the notice, `display_name` names it,
    // and the two Stripe ids cancel a subscription that would otherwise outlive the
    // account. A silently dropped column degrades to "no email sent" — no error.
    for (const c of ['id', 'email', 'display_name', 'stripe_subscription_id', 'stripe_customer_id']) {
      expect(cols, `select() must include ${c}`).toContain(c);
    }
  });

  test('rows come back as the loop expects them', async () => {
    const rows = [{ id: 'u1', email: 'a@example.com', display_name: null, stripe_subscription_id: null, stripe_customer_id: null }];
    const { client } = recordingClient(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await selectDueForPurge(client as any, NOW);
    expect(error).toBeNull();
    expect(data).toEqual(rows);
  });
});

/* ──────────────────── the gate: the comparison itself ─────────────────────── */

test.describe('purge cron — who counts as Vercel Cron', () => {
  // ⚠️ Invented secrets throughout. The real `CRON_SECRET` never enters this process,
  // deliberately: the tempting version of these tests sends the true secret under a
  // wrong scheme and expects a refusal, and that test becomes a real purge of the
  // live database on the day someone loosens the check to a substring match. A test
  // that turns destructive exactly when the code regresses is worse than no test.
  const SECRET = 'sekrit-value-for-testing-only';

  test('the exact Bearer form is the only thing that passes', () => {
    expect(isAuthorisedCronCall(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  test('a substring is not enough', () => {
    // The regression this exists for. `auth.includes(secret)` would admit all four.
    for (const header of [
      SECRET,
      `Basic ${SECRET}`,
      `Bearer  ${SECRET}`,
      `Bearer ${SECRET} `,
    ]) {
      expect(isAuthorisedCronCall(header, SECRET), `"${header}" must not pass`).toBe(false);
    }
  });

  test('a wrong or absent token', () => {
    for (const header of ['Bearer wrong', 'Bearer', '', null, undefined]) {
      expect(isAuthorisedCronCall(header, SECRET), `"${header}" must not pass`).toBe(false);
    }
  });

  test('no secret configured refuses EVERYONE, including a well-formed call', () => {
    // Fails closed. A deployment that forgot CRON_SECRET must end up with a cron
    // that stops working, never a delete endpoint open to the internet — and note
    // `Bearer undefined` is a real string a naive template would accept.
    for (const secret of [undefined, '']) {
      expect(isAuthorisedCronCall(`Bearer ${SECRET}`, secret)).toBe(false);
      expect(isAuthorisedCronCall('Bearer undefined', secret)).toBe(false);
      expect(isAuthorisedCronCall(null, secret)).toBe(false);
    }
  });
});

/* ─────────────────────────── the gate, over HTTP ──────────────────────────── */

test.describe('purge cron — nobody without the secret gets in', () => {
  // ⚠️ Every case here is a REFUSAL, on purpose. None of them reaches the database.
  // The route is in PUBLIC_ENDPOINTS (Vercel Cron sends a Bearer secret, not
  // cookies), so the proxy lets the request through to the handler and the
  // handler's own check is the only thing standing between the public and the
  // delete loop. That makes these four the security boundary, not a formality.

  test('no Authorization header at all', async ({ request }) => {
    const res = await request.get(CRON_PATH);
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  test('a wrong bearer token', async ({ request }) => {
    const res = await request.get(CRON_PATH, {
      headers: { authorization: 'Bearer not-the-real-secret' },
    });
    expect(res.status()).toBe(401);
  });

  test('a malformed scheme', async ({ request }) => {
    for (const authorization of ['Basic whatever', 'whatever', 'Bearer', 'Bearer ']) {
      const res = await request.get(CRON_PATH, { headers: { authorization } });
      expect(res.status(), `"${authorization}" must be refused`).toBe(401);
    }
  });

  test('the refusal is not cacheable', async ({ request }) => {
    // CLAUDE.md 11a. This route sent no Cache-Control at all until 2026-08-23 —
    // including on this 401, which is the response an unauthorised caller receives.
    const res = await request.get(CRON_PATH);
    const cc = res.headers()['cache-control'] ?? '';
    expect(cc).toContain('no-store');
    expect(cc).toContain('private');
    expect(cc).not.toContain('s-maxage');
  });

  test('a POST is refused — the cron is a GET', async ({ request }) => {
    const res = await request.post(CRON_PATH);
    expect(res.status(), 'only GET is exported, so anything else must not run it').not.toBe(200);
  });
});
