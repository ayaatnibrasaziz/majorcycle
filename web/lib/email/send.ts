import { renderBrandEmail } from '@/lib/email/brandEmail';

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
    console.error('sendBrandEmail: RESEND_API_KEY not set — not sent:', input.subject);
    return false;
  }

  const html = renderBrandEmail({
    heading: input.heading,
    bodyHtml: input.bodyHtml,
    preheader: input.preheader,
  });

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html,
      }),
    });
    if (!res.ok) {
      console.error('sendBrandEmail: Resend send failed', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('sendBrandEmail: Resend request threw', err);
    return false;
  }
}
