import { renderBrandEmail } from '@/lib/email/brandEmail';
import { reportIssue } from '@/lib/observability';
import { redactEmails } from '@/lib/redact';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Transactional sender. Account/system emails go from noreply@ (the Resend
 * transactional sender), distinct from the /contact form which sends from the
 * monitored support@ inbox. Overridable via RESEND_FROM_EMAIL.
 */
const FROM = process.env.RESEND_FROM_EMAIL || 'MajorCycle <noreply@majorcycle.com>';

export interface SendBrandEmailInput {
  to: string;
  subject: string;
  /** Small label under the wordmark in the header. */
  heading: string;
  /** Trusted, pre-escaped HTML for the message body. */
  bodyHtml: string;
  /** Hidden inbox-preview text (optional). */
  preheader?: string;
  /** Plain-text fallback for non-HTML clients. */
  text: string;
  /**
   * Optional Resend Idempotency-Key. When set, Resend delivers at most one email
   * per key within a 24-hour window — so a duplicate trigger (e.g. a re-processed
   * webhook) can never send a customer the same message twice. Omitted by
   * user-action emails (account/referral/contact), which fire once per click.
   */
  idempotencyKey?: string;
}

/**
 * Send a MajorCycle-branded transactional email via Resend's REST API. Returns
 * whether it was sent; it never throws, and a missing RESEND_API_KEY is treated
 * as "not sent" (logged) rather than an error — so a surrounding flow such as
 * scheduling an account deletion still completes even if email is unconfigured.
 */
export async function sendBrandEmail(input: SendBrandEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // `heading`, never `subject`: the referral subject carries the sender's own name,
    // and this line only needs to say WHICH email failed. All seven headings are fixed
    // literals we write (P9, 5A-163).
    // ALERT: no key means NO transactional email at all — no password reset, no
    // trial welcome, no payment-failure warning. Every one of those fails silently
    // from the reader's side: they ask for a reset link and simply never get one.
    reportIssue('sendBrandEmail: RESEND_API_KEY not set — not sent', {
      level: 'alert',
      tags: { heading: input.heading },
    });
    return false;
  }

  const html = renderBrandEmail({
    heading: input.heading,
    bodyHtml: input.bodyHtml,
    preheader: input.preheader,
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (input.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html,
      }),
    });
    if (!res.ok) {
      // Redacted, not dropped: this body is the only thing that says WHY a customer's
      // email did not arrive, and Resend decides what goes in it (5A-163).
      reportIssue('sendBrandEmail: Resend send failed', {
        tags: {
          status: res.status,
          heading: input.heading,
          // Redacted, not dropped: this body is the only thing that says WHY a
          // customer's email did not arrive, and Resend decides what goes in it
          // (5A-163). `reportIssue` redacts again on the way out, which is a
          // backstop rather than a reason to stop doing it here.
          body: redactEmails(await res.text()),
        },
      });
      return false;
    }
    return true;
  } catch (err) {
    reportIssue('sendBrandEmail: Resend request threw', {
      cause: err,
      tags: { heading: input.heading },
    });
    return false;
  }
}
