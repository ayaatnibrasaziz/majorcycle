import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/server';
import { sendAccountDeletedEmail } from '@/lib/email/accountEmails';

export const dynamic = 'force-dynamic';

/**
 * Purge cron (F2 Part B). Runs daily via Vercel Cron (see web/vercel.json) and
 * permanently deletes accounts whose 30-day grace has elapsed. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set in the project
 * env, so anything without that header is rejected — the endpoint can't be run by
 * the public. Deleting the auth user cascades: profiles (ON DELETE CASCADE),
 * analysis_runs (CASCADE); universe_log + ticker_requests are SET NULL.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from('profiles')
    .select('id, email, display_name')
    .not('deletion_scheduled_at', 'is', null)
    .lte('deletion_scheduled_at', nowIso);

  if (error) {
    console.error('purge-accounts: query failed', error);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  let purged = 0;
  const failed: string[] = [];

  for (const row of due ?? []) {
    try {
      // F3 TODO: cancel the Stripe subscription for this customer before deleting.
      // Email BEFORE deleting, while we still hold the captured address/name.
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

  return NextResponse.json({ purged, failed: failed.length, checkedAt: nowIso });
}
