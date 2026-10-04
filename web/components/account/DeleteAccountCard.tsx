'use client';

import { useState, useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestAccountDeletion } from '@/app/(app)/account/actions';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/lib/account';
import { clearStoredRuns } from '@/lib/analysis';
import {
  deletionSubscriptionLine,
  type DeletionSubscriptionKind,
} from '@/lib/deletionSubscription';

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
 * `subscription` (computed on the server by lib/deletionSubscription.ts — the same rule
 * the email and /reactivate read) picks the one sentence about what deletion does to
 * the subscription. It carries no dates: this card cannot know the reader's time zone
 * on the server, and the email that follows states them.
 */
export function DeleteAccountCard({
  subscription = 'none',
}: {
  subscription?: DeletionSubscriptionKind;
}) {
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);
  const timeZone = useSyncExternalStore(noopSubscribe, getDeviceTimeZone, () => '');

  const subLine = deletionSubscriptionLine(subscription, { deletionDate: null, periodEnd: null });

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title text-[var(--status-danger-ink)]">Delete account</h2>
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
          <div className="flex flex-col gap-4 rounded-[var(--radius-sm)] border border-[var(--status-danger-tint-strong)] bg-[var(--status-danger-tint)] p-4">
            {/* ⚠️ The wash and the border were `--tint-tier-5` / `--tint-tier-5-strong`
                — the BEARISH RATING tints — under text that had already moved to
                `--status-danger-ink`. Half a migration: 5A-102 moved every ink on this
                card and left the surface behind them on our judgement of a stock. The
                two token sets hold the same value, so nothing moved on screen, which is
                exactly why it survived. The guard could not see it either: it matches
                `role="alert"`, and this panel carries no role. */}
            <div className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--status-danger-ink)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden />
              <p>
                This schedules your account for <strong>permanent deletion</strong>{' '}
                {`in ${ACCOUNT_DELETION_GRACE_DAYS} days`}. You&apos;ll be signed out and
                emailed a confirmation. Sign back in before then to cancel.
              </p>
            </div>

            {subLine && (
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                {subLine}
              </p>
            )}

            <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--status-danger)]"
              />
              I understand my account will be permanently deleted after{' '}
              {ACCOUNT_DELETION_GRACE_DAYS} days.
            </label>

            <div className="flex items-center gap-3">
              {/* Submits the server action; disabled until acknowledged. The
                  hidden field carries the device timezone for the email date. */}
              <form action={requestAccountDeletion}>
                <input type="hidden" name="timeZone" value={timeZone} />
                {/* Screener results kept in this browser leave with the account. */}
                <Button type="submit" variant="destructive" disabled={!ack} onClick={clearStoredRuns}>
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
