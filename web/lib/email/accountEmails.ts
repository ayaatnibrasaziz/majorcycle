import { sendBrandEmail } from '@/lib/email/send';

/**
 * The two branded account-lifecycle emails (F2 Part B): "deletion scheduled"
 * (sent when a user requests deletion) and "account deleted" (sent by the purge
 * cron after the 30-day grace). Both render through the shared brand chrome
 * (`renderBrandEmail`) and send from noreply@. Copy signed off with the owner.
 */

const FONT =
  "'Sora',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.majorcycle.com';

/** Escape any user-controlled value (display name, email) before interpolating. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function p(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:14.5px;line-height:1.65;color:#0f1923;">${html}</p>`;
}

function muted(html: string): string {
  return `<p style="margin:16px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:#64748b;">${html}</p>`;
}

function button(label: string, url: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;"><tr>` +
    `<td bgcolor="#1E5CB3" style="border-radius:8px;">` +
    `<a href="${url}" style="display:inline-block;padding:11px 24px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>` +
    `</td></tr></table>`
  );
}

/** "Hi Alex," when a display name exists, else the "Hi there," fallback. */
function greetingHtml(name: string | null): string {
  const n = name?.trim();
  return p(n ? `Hi ${escapeHtml(n)},` : 'Hi there,');
}

function greetingText(name: string | null): string {
  const n = name?.trim();
  return n ? `Hi ${n},` : 'Hi there,';
}

/** "Friday, 10 August 2026" — owner is AU, so format in en-AU deterministically. */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Email #1 — sent the moment a user schedules their account for deletion. */
export async function sendDeletionScheduledEmail(opts: {
  to: string;
  name: string | null;
  deletionDate: Date;
  /** 'paid' and 'trial' get different reassurance copy; null = no subscription line. */
  subscriptionKind: 'paid' | 'trial' | null;
}): Promise<boolean> {
  const dateStr = formatDate(opts.deletionDate);
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
            `You're on a free trial — the days you have left are saved, and you get them back if you ` +
              `sign back in before ${dateStr}.`
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
        ? `You're on a free trial — the days you have left are saved, and you get them back if you sign ` +
          `back in before ${dateStr}.\n\n`
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
