import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';

import { AuthCard } from '@/components/AuthCard';
import { Button } from '@/components/ui/button';

// noindex (crawlable) — see lib/seo.ts. This page asserts something true of exactly
// one reader at one moment, so indexing it would be actively wrong, not just noise.
export const metadata: Metadata = pageMetadata({
  path: '/deletion-requested',
  title: 'Account deletion scheduled',
  description:
    'Your MajorCycle account is scheduled for deletion after a 30-day grace period. You can cancel any time before then by signing back in.',
});

/**
 * Public confirmation shown right after a user schedules deletion (they've just
 * been signed out). Generic by design — the exact date is in the email, so no
 * session or user data is needed here.
 */
export default function DeletionRequestedPage() {
  return (
    <AuthCard
      title="Account deletion scheduled"
      subtitle="We've emailed you the details."
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          Your MajorCycle account is now scheduled for permanent deletion after a
          30-day grace period. Check your inbox for a confirmation with the exact
          date.
        </p>
        <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          Changed your mind? You can cancel any time before then — just sign back
          in and reactivate. Everything picks up right where you left off.
        </p>

        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href="/login">Sign in to cancel</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
