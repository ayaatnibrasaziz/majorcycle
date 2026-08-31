import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { sendAccountDeletedEmail } from '@/lib/email/accountEmails';
import { recordTrialConsumed } from '@/lib/trialGuard';
import { isAuthorisedCronCall, selectDueForPurge } from '@/lib/purge';

export const dynamic = 'force-dynamic';

/**
 * Every response here is operational detail about one deployment's deletion queue,
 * and Next attaches NO `Cache-Control` to route handlers (CLAUDE.md 11a). This route
 * said nothing at all until 2026-08-23 — including on its 401, which is the response
 * an unauthorised caller actually receives.
 */
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/**
 * Immediately cancel any live Stripe subscription for a to-be-purged account, so none
 * outlives the deleted user. Prefers the stored subscription id; if that's absent but
 * we have the customer (a delete that raced the subscription.created webhook — edge
 * E1), list the customer's subscriptions and cancel any that are still live. Its own
 * try/catch: a Stripe failure logs but must NOT abort the user deletion (a stray
 * canceled-later sub is less bad than a user we fail to purge; the row won't recur).
 */
async function cancelStripeForRow(row: {
  id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
}): Promise<void> {
  try {
    if (row.stripe_subscription_id) {
      await getStripe().subscriptions.cancel(row.stripe_subscription_id);
      return;
    }
    if (row.stripe_customer_id) {
      const subs = await getStripe().subscriptions.list({
        customer: row.stripe_customer_id,
        status: 'all',
        limit: 100,
      });
      for (const s of subs.data) {
        if (s.status !== 'canceled' && s.status !== 'incomplete_expired') {
          await getStripe().subscriptions.cancel(s.id);
        }
      }
    }
  } catch (err) {
    console.error('purge-accounts: could not cancel Stripe subscription(s)', row.id, err);
  }
}

/**
 * Purge cron (F2 Part B). Runs daily via Vercel Cron (see web/vercel.json) and
 * permanently deletes accounts whose 30-day grace has elapsed. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set in the project
 * env, so anything without that header is rejected — the endpoint can't be run by
 * the public. Deleting the auth user cascades: profiles (ON DELETE CASCADE),
 * analysis_runs (CASCADE); universe_log + ticker_requests are SET NULL.
 */
export async function GET(request: NextRequest) {
  // The comparison lives in `lib/purge.ts` as a pure function so it can be tested
  // without the real secret ever entering a test process — see the note there.
  if (!isAuthorisedCronCall(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Which rows may be deleted lives in `lib/purge.ts` — one page, oldest first,
  // bounded, and only accounts whose 30-day grace has actually elapsed. It is a
  // separate function so a stub client can assert those three properties without
  // deleting anything, which is the only way this route can be tested at all
  // (there is no test Supabase). See `e2e/purge-cron.spec.ts`.
  const { data: due, error } = await selectDueForPurge(admin, nowIso);

  if (error) {
    console.error('purge-accounts: query failed', error);
    return NextResponse.json({ error: 'query_failed' }, { status: 500, headers: NO_STORE });
  }

  let purged = 0;
  const failed: string[] = [];

  for (const row of due ?? []) {
    try {
      // Cancel any live Stripe subscription before deleting the user (own try/catch —
      // never blocks the purge). Then email BEFORE deleting, while we still hold the
      // captured address/name.
      await cancelStripeForRow(row);
      // Trial-abuse guard (Step 7): tombstone the email BEFORE the account is gone, so
      // a re-signup with the same address can't farm a fresh free trial. Best-effort
      // (a trial started at checkout is already tombstoned; this is belt-and-suspenders).
      await recordTrialConsumed(admin, row.email);
      if (row.email) {
        await sendAccountDeletedEmail({ to: row.email, name: row.display_name ?? null });
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(row.id);
      if (delErr) {
        console.error('purge-accounts: deleteUser failed', row.id, delErr);
        failed.push(row.id);
        continue;
      }
      purged += 1;
    } catch (err) {
      console.error('purge-accounts: unexpected error', row.id, err);
      failed.push(row.id);
    }
  }

  return NextResponse.json(
    { purged, failed: failed.length, checkedAt: nowIso },
    { headers: NO_STORE },
  );
}
