import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Which accounts the purge cron is allowed to delete.
 *
 * ── Why this is a function, and why it takes its client ─────────────────────
 * `app/api/cron/purge-accounts/route.ts` permanently deletes user accounts. It is
 * the highest-stakes route in the product and, until 2026-08-23, it had **no
 * automated test of any kind** — it was verified once by hand during the F3
 * live-check in July and never again. The Layer G coverage map found it.
 *
 * It cannot be tested the obvious way. Driving the route with a valid
 * `CRON_SECRET` really does purge, against the real database — there is no test
 * Supabase — so a test that proved it works would be a test that deletes whatever
 * happened to be due that morning. That is not a risk worth taking to hold a
 * green tick.
 *
 * So the query is lifted out here, taking its client as an argument, exactly like
 * `readStockRow` in `lib/stocks.ts`. A stub client can then assert *which rows
 * this would delete* without deleting anything — see `e2e/purge-cron.spec.ts`,
 * which also drives the route's refusal paths over HTTP. The two halves together
 * cover the thing that matters: **who can trigger it, and what it would take.**
 *
 * ── The three properties worth guarding ─────────────────────────────────────
 * 1. `deletion_scheduled_at IS NOT NULL` — an account that never asked to be
 *    deleted must never appear. Dropping this deletes the entire user table.
 * 2. `deletion_scheduled_at <= now` — the 30-day grace is what makes deletion
 *    recoverable, and it is enforced *here*, not by the column. Dropping this
 *    deletes every pending account immediately, including people still inside
 *    their window who intend to change their mind. It is the quietest of the
 *    three: the cron would still succeed, still report a plausible count, and
 *    the only symptom would be customers who reactivated finding nothing left.
 * 3. A bounded batch. PostgREST caps a response at 1000 rows and says nothing
 *    (CLAUDE.md 14c), so an unbounded read would silently stop purging past that
 *    point. Paging is the wrong tool because rows are DELETED as they are handled,
 *    which shifts every later offset; a single bounded batch that self-drains on
 *    the next daily run is correct. Anything approaching PURGE_BATCH means
 *    accounts are queueing up faster than one run clears them.
 */
export const PURGE_BATCH = 500;

/**
 * Is this caller Vercel Cron? Exact match on the whole header value.
 *
 * ⚠️ **Extracted so it can be tested WITHOUT the real secret.** The obvious test —
 * send the true secret under a wrong scheme and expect a refusal — is a landmine:
 * the day someone loosens this to `auth.includes(secret)`, that test stops being a
 * refusal and becomes a real, authenticated purge of the live database. **A test
 * that turns destructive at the exact moment the code regresses is worse than no
 * test.** As a pure function it takes both sides as arguments, so the cases below
 * use invented strings and nothing can reach a database however the logic changes.
 *
 * Fails closed when `secret` is unset: a deployment that forgot `CRON_SECRET` must
 * refuse everyone rather than admit everyone, which is the difference between a
 * cron that stops working and a delete endpoint open to the internet.
 */
export function isAuthorisedCronCall(
  authHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

export interface PurgeCandidate {
  id: string;
  email: string | null;
  display_name: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
}

export function selectDueForPurge(
  admin: SupabaseClient,
  nowIso: string,
): PromiseLike<{ data: PurgeCandidate[] | null; error: unknown }> {
  return admin
    .from('profiles')
    .select('id, email, display_name, stripe_subscription_id, stripe_customer_id')
    .not('deletion_scheduled_at', 'is', null)
    .lte('deletion_scheduled_at', nowIso)
    .order('deletion_scheduled_at', { ascending: true })
    .range(0, PURGE_BATCH - 1) as unknown as PromiseLike<{
    data: PurgeCandidate[] | null;
    error: unknown;
  }>;
}
