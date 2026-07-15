'use client';

import { useState, useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestAccountDeletion } from '@/app/(app)/account/actions';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/lib/account';

// The viewer's device IANA timezone (client-only; '' on the server / no JS). Sent
// with the deletion request so the "deletion scheduled" email shows the date in the
// zone the user is actually in — never a country guess. See coding-standards.md §16.
const noopSubscribe = () => () => {};
function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/**
 * Danger-zone card: request account deletion. Two-step to avoid an accidental
 * click — the initial button reveals a warning panel with an explicit
 * acknowledgement checkbox that gates the actual submit. Submitting calls the
 * `requestAccountDeletion` server action (schedules the 30-day soft-delete,
 * emails the user, signs them out, and redirects to /deletion-requested).
 *
 * `subscriptionStatus` drives the reassurance copy shown before confirming:
 * a paying subscriber is told their plan stays valid through the period they've
 * already paid for (deleting neither cuts it short nor extends it — no delete-and-
 * restore loophole); a trial user is told their remaining trial days are saved.
 * Both restore when they sign back in before the deletion date.
 */
export function DeleteAccountCard({
  subscriptionStatus = null,
}: {
  subscriptionStatus?: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);
  const timeZone = useSyncExternalStore(noopSubscribe, getDeviceTimeZone, () => '');

  const isTrial = subscriptionStatus === 'trialing';
  const isPaidSub =
    subscriptionStatus === 'active' || subscriptionStatus === 'past_due';

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title text-[var(--c-tier-5-ink)]">Delete account</h2>
      </div>
      <div className="card-body">
        <p className="mb-5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Permanently delete your MajorCycle account. Deletion is scheduled with a{' '}
          {ACCOUNT_DELETION_GRACE_DAYS}-day grace period — you can cancel any time before
          then by signing back in.
        </p>

        {!confirming ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirming(true)}
          >
            Delete my account…
          </Button>
        ) : (
          <div className="flex flex-col gap-4 rounded-[var(--radius-sm)] border border-[var(--tint-tier-5-strong)] bg-[var(--tint-tier-5)] p-4">
            <div className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--c-tier-5-ink)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden />
              <p>
                This schedules your account for <strong>permanent deletion</strong>{' '}
                {`in ${ACCOUNT_DELETION_GRACE_DAYS} days`}. You&apos;ll be signed out and
                emailed a confirmation. Sign back in before then to cancel.
              </p>
            </div>

            {isPaidSub && (
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Your subscription stays valid until the end of the period you&apos;ve
                already paid for — deleting won&apos;t cut it short or extend it. Sign
                back in before the deletion date to restore your account; otherwise
                it&apos;s removed then and won&apos;t renew.
              </p>
            )}
            {isTrial && (
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Your free trial is <strong>paused, not cancelled</strong> — the days
                you have left are saved, and you get them back when you sign in before
                the deletion date.
              </p>
            )}

            <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--c-tier-5)]"
              />
              I understand my account will be permanently deleted after{' '}
              {ACCOUNT_DELETION_GRACE_DAYS} days.
            </label>

            <div className="flex items-center gap-3">
              {/* Submits the server action; disabled until acknowledged. The
                  hidden field carries the device timezone for the email date. */}
              <form action={requestAccountDeletion}>
                <input type="hidden" name="timeZone" value={timeZone} />
                <Button type="submit" variant="destructive" disabled={!ack}>
                  Schedule deletion
                </Button>
              </form>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setConfirming(false);
                  setAck(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
