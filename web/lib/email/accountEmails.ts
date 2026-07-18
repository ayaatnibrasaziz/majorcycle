import { sendBrandEmail } from '@/lib/email/send';
import {
  SITE,
  escapeHtml,
  p,
  muted,
  button,
  greetingHtml,
  greetingText,
  formatDate,
} from '@/lib/email/format';

/**
 * The two branded account-lifecycle emails (F2 Part B): "deletion scheduled"
 * (sent when a user requests deletion) and "account deleted" (sent by the purge
 * cron after the 30-day grace). Both render through the shared brand chrome
 * (`renderBrandEmail`) and send from noreply@. Copy signed off with the owner.
 * Body-formatting helpers live in `./format` (shared with referralEmails.ts).
 */

/** Email #1 — sent the moment a user schedules their account for deletion. */
export async function sendDeletionScheduledEmail(opts: {
  to: string;
  name: string | null;
  deletionDate: Date;
  /** 'paid' and 'trial' get different reassurance copy; null = no subscription line. */
  subscriptionKind: 'paid' | 'trial' | null;
  /**
   * The user's device IANA timezone, captured in the browser at deletion request
   * time, so the emailed date matches what they saw on screen. Null -> runtime zone.
   */
  timeZone?: string | null;
}): Promise<boolean> {
  const dateStr = formatDate(opts.deletionDate, opts.timeZone);
  const to = escapeHtml(opts.to);

  const bodyHtml = [
    greetingHtml(opts.name),
    p(
      `We've received a request to delete your MajorCycle account (<strong>${to}</strong>). ` +
        `It's now scheduled for permanent deletion on <strong>${dateStr}</strong>.`
    ),
    p(
      `Until then, your account is deactivated but fully recoverable. To cancel the deletion, ` +
        `just sign back in any time before ${dateStr} — everything picks up right where you left off.`
    ),
    opts.subscriptionKind === 'paid'
      ? p(
          `Your subscription stays valid until the end of the period you've already paid for — ` +
            `deleting doesn't cut it short or extend it. Sign back in before ${dateStr} to keep your ` +
            `account; otherwise it's removed then and won't renew, so no further charges go out.`
        )
      : opts.subscriptionKind === 'trial'
        ? p(
            `You're on a free trial — it stays active until its normal end date, with no charge. Sign ` +
              `back in before ${dateStr} to keep your account; if the trial ends first, you'll come back ` +
              `to a free account.`
          )
        : '',
    button('Sign in to cancel deletion', `${SITE}/login`),
    p(
      `After ${dateStr}, your account, profile, and all associated data are permanently removed ` +
        `and can't be restored.`
    ),
    muted(`If you didn't request this, sign in now to cancel it and change your password.`),
  ]
    .filter(Boolean)
    .join('\n');

  const text =
    `${greetingText(opts.name)}\n\n` +
    `We've received a request to delete your MajorCycle account (${opts.to}). It's now scheduled ` +
    `for permanent deletion on ${dateStr}.\n\n` +
    `Until then your account is deactivated but fully recoverable — sign back in before ${dateStr} ` +
    `to cancel it: ${SITE}/login\n\n` +
    (opts.subscriptionKind === 'paid'
      ? `Your subscription stays valid until the end of the period you've already paid for — deleting ` +
        `doesn't cut it short or extend it. Sign back in before ${dateStr} to keep your account; ` +
        `otherwise it's removed then and won't renew, so no further charges go out.\n\n`
      : opts.subscriptionKind === 'trial'
        ? `You're on a free trial — it stays active until its normal end date, with no charge. Sign back ` +
          `in before ${dateStr} to keep your account; if the trial ends first, you'll come back to a ` +
          `free account.\n\n`
        : '') +
    `After that date, your account and all associated data are permanently removed and can't be ` +
    `restored. If you didn't request this, sign in now to cancel it and change your password.`;

  return sendBrandEmail({
    to: opts.to,
    subject: 'Your MajorCycle account is scheduled for deletion',
    heading: 'Account deletion scheduled',
    bodyHtml,
    preheader: `Your account is scheduled for deletion on ${dateStr} — sign in before then to keep it.`,
    text,
  });
}

/** Email #2 — sent by the purge cron once the grace period has elapsed. */
export async function sendAccountDeletedEmail(opts: {
  to: string;
  name: string | null;
}): Promise<boolean> {
  const to = escapeHtml(opts.to);

  const bodyHtml = [
    greetingHtml(opts.name),
    p(
      `As scheduled, your MajorCycle account (<strong>${to}</strong>) and all associated data have ` +
        `now been permanently deleted. There's nothing more you need to do.`
    ),
    p(
      `We're sorry to see you go. You're always welcome back — you can create a new account any time.`
    ),
    button('Return to MajorCycle', `${SITE}/signup`),
    muted(`Thank you for trying MajorCycle.`),
  ].join('\n');

  const text =
    `${greetingText(opts.name)}\n\n` +
    `As scheduled, your MajorCycle account (${opts.to}) and all associated data have now been ` +
    `permanently deleted. There's nothing more you need to do.\n\n` +
    `You're always welcome back — create a new account any time: ${SITE}/signup\n\n` +
    `Thank you for trying MajorCycle.`;

  return sendBrandEmail({
    to: opts.to,
    subject: 'Your MajorCycle account has been deleted',
    heading: 'Account deleted',
    bodyHtml,
    preheader: 'Your MajorCycle account and data have been permanently deleted.',
    text,
  });
}
