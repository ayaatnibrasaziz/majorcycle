import { sendBrandEmail } from '@/lib/email/send';
import { FONT, SITE, escapeHtml, p, muted, button } from '@/lib/email/format';

/**
 * Refer-a-friend invite email (F2 Part C). A one-off, member-initiated invite
 * sent from noreply@ through the shared brand chrome. Carries the referrer's
 * name (collected on the invite form, so it's always present), an optional
 * personal note, a 7-day-trial CTA, and a clear one-off provenance line for
 * anti-spam hygiene. Copy owner-approved before build.
 */

/** A left-bordered italic quote block for the referrer's optional personal note. */
function quote(html: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;"><tr>` +
    `<td style="border-left:3px solid #2E7DE8;padding:3px 0 3px 15px;">` +
    `<p style="margin:0;font-style:italic;font-family:${FONT};font-size:14.5px;line-height:1.6;color:#334155;">&ldquo;${html}&rdquo;</p>` +
    `</td></tr></table>`
  );
}

export async function sendReferralEmail(opts: {
  to: string;
  /** Referrer's name (form-collected; may be empty in edge cases). */
  referrerName: string | null;
  /** Optional personal note from the referrer. */
  message: string | null;
}): Promise<boolean> {
  const rawName = opts.referrerName?.trim() || null; // plain, for subject + text
  const name = rawName ? escapeHtml(rawName) : null; // escaped, for HTML body + preheader
  const rawMsg = opts.message?.trim() || null;
  const msg = rawMsg ? escapeHtml(rawMsg) : null;

  const intro = name
    ? `<strong>${name}</strong> uses MajorCycle and thought you&rsquo;d find it useful.`
    : `Someone who uses MajorCycle thought you&rsquo;d find it useful.`;

  const bodyHtml = [
    p('Hi there,'),
    p(intro),
    msg ? quote(msg) : '',
    p(
      `MajorCycle is a premium terminal that shows where US, Australian and Canadian ` +
        `stocks sit in their historical drawdown and recovery cycles &mdash; alongside ` +
        `financial-health, valuation and analyst data. It&rsquo;s educational information ` +
        `to support your own research, not financial advice.`
    ),
    p(`New members start with a <strong>7-day free trial</strong>.`),
    button('Start your free trial', `${SITE}/signup`),
    muted(
      `You received this one-off invitation because ${name ?? 'a MajorCycle member'} ` +
        `entered your email address. We won&rsquo;t email you again unless you sign up.`
    ),
  ]
    .filter(Boolean)
    .join('\n');

  const text =
    `Hi there,\n\n` +
    `${
      rawName
        ? `${rawName} uses MajorCycle and thought you'd find it useful.`
        : `Someone who uses MajorCycle thought you'd find it useful.`
    }\n\n` +
    (rawMsg ? `"${rawMsg}"\n\n` : '') +
    `MajorCycle shows where US, Australian and Canadian stocks sit in their historical ` +
    `drawdown and recovery cycles, alongside financial-health, valuation and analyst data. ` +
    `It's educational information to support your own research, not financial advice.\n\n` +
    `New members start with a 7-day free trial: ${SITE}/signup\n\n` +
    `You received this one-off invitation because ${rawName ?? 'a MajorCycle member'} ` +
    `entered your email address. We won't email you again unless you sign up.`;

  return sendBrandEmail({
    to: opts.to,
    subject: `${rawName ?? 'A MajorCycle member'} thought you'd like MajorCycle`,
    heading: "You're invited",
    bodyHtml,
    preheader: `${name ?? 'A MajorCycle member'} invited you to try MajorCycle — 7-day free trial.`,
    text,
  });
}
