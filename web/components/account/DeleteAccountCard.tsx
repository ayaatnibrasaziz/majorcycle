'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestAccountDeletion } from '@/app/(app)/account/actions';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/lib/account';

/**
 * Danger-zone card: request account deletion. Two-step to avoid an accidental
 * click — the initial button reveals a warning panel with an explicit
 * acknowledgement checkbox that gates the actual submit. Submitting calls the
 * `requestAccountDeletion` server action (schedules the 30-day soft-delete,
 * emails the user, signs them out, and redirects to /deletion-requested).
 */
export function DeleteAccountCard() {
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);

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
              {/* Submits the server action; disabled until acknowledged. */}
              <form action={requestAccountDeletion}>
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
