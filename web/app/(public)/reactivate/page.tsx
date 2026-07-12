import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { reactivateAccount } from '@/app/(app)/account/actions';
import { AuthCard } from '@/components/AuthCard';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Reactivate your account' };
export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'the scheduled date';
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Reactivation gate. A signed-in account whose deletion is scheduled is
 * redirected here by the app layout. One click cancels the deletion (clears
 * `deletion_scheduled_at` via the service role) and restores full access.
 */
export default async function ReactivatePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('deletion_scheduled_at')
    .eq('id', user.id)
    .single();

  // Nothing scheduled → nothing to reactivate; send them into the app.
  if (!profile?.deletion_scheduled_at) redirect('/results');

  const dateStr = formatDate(profile.deletion_scheduled_at);

  return (
    <AuthCard
      title="Your account is scheduled for deletion"
      subtitle={`It will be permanently deleted on ${dateStr}.`}
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          Reactivate to cancel the deletion and restore everything — your profile,
          your history, and your subscription — exactly as you left it.
        </p>

        <form action={reactivateAccount}>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Reactivate my account
          </Button>
        </form>

        <form action="/auth/signout" method="post">
          <Button type="submit" variant="secondary" className="w-full">
            Sign out
          </Button>
        </form>

        <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
          If you do nothing, your account and all associated data are permanently
          removed on {dateStr}.
        </p>
      </div>
    </AuthCard>
  );
}
