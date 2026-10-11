import type { SupabaseClient } from '@supabase/supabase-js';

import { sendAccessPausedEmail } from '@/lib/email/billingEmails';
import { reportIssue } from '@/lib/observability';

/**
 * The daily "your access is paused" notices (owner, 2026-10-03; beta review D-5).
 *
 * A failed card keeps access through the 3-day grace window (decision #20); nothing
 * happens at the moment it closes — no Stripe event, no page view — so nothing told the
 * customer they had lost access. The daily cron (app/api/cron/purge-accounts) calls this.
 * It can be up to a day late, which is why the email says "paused" and not "today".
 *
 * Who: still `past_due`, grace passed, not yet told for THIS failure, not disputed (the
 * hold banner speaks to that), not being deleted. Stamp first, then send — the stamp is
 * conditional, so a second run (or two at once) can never send a second copy.
 */
export const PAUSED_NOTICE_BATCH = 200;

export interface PausedCandidate {
  id: string;
  email: string | null;
  display_name: string | null;
  next_charge_amount: number | null;
  next_charge_currency: string | null;
}

export function selectPausedToNotify(
  admin: SupabaseClient,
  nowIso: string,
): PromiseLike<{ data: PausedCandidate[] | null; error: unknown }> {
  return admin
    .from('profiles')
    .select('id, email, display_name, next_charge_amount, next_charge_currency')
    .eq('subscription_status', 'past_due')
    .lte('grace_until', nowIso)
    .is('access_paused_notified_at', null)
    .not('billing_blocked', 'is', true)
    .is('deletion_scheduled_at', null)
    .order('grace_until', { ascending: true })
    .range(0, PAUSED_NOTICE_BATCH - 1) as unknown as PromiseLike<{
    data: PausedCandidate[] | null;
    error: unknown;
  }>;
}

export async function notifyPausedAccess(
  admin: SupabaseClient,
  nowIso: string,
): Promise<{ sent: number; failed: number }> {
  const { data, error } = await selectPausedToNotify(admin, nowIso);
  if (error) {
    reportIssue('paused-notices: query failed', { cause: error, level: 'alert' });
    return { sent: 0, failed: 1 };
  }
  let sent = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      const { data: stamped } = await admin
        .from('profiles')
        .update({ access_paused_notified_at: nowIso })
        .eq('id', row.id)
        .eq('subscription_status', 'past_due')
        .is('access_paused_notified_at', null)
        .select('id')
        .maybeSingle();
      if (!stamped || !row.email) continue;
      const ok = await sendAccessPausedEmail({
        to: row.email,
        name: row.display_name ?? null,
        charge:
          row.next_charge_amount != null && row.next_charge_currency
            ? { amount: row.next_charge_amount, currency: row.next_charge_currency }
            : null,
        idempotencyKey: `access-paused:${row.id}:${nowIso.slice(0, 10)}`,
      });
      if (ok) sent += 1;
      else failed += 1;
    } catch (cause) {
      failed += 1;
      reportIssue('paused-notices: could not notify', { cause, tags: { userId: row.id } });
    }
  }
  return { sent, failed };
}
