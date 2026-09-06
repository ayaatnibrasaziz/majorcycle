'use server';

import { renderBrandEmail } from '@/lib/email/brandEmail';

/** Where contact-form submissions are emailed. Defaults to the live support@
 *  inbox (Cloudflare Email Routing → owner Gmail), overridable via env. */
const CONTACT_TO = process.env.CONTACT_TO_EMAIL || 'support@majorcycle.com';

/** Generous, and finite. Matches the referral note's own cap. */
const MESSAGE_MAX = 4000;

/** Trim, drop every control character, and cap. For anything reaching a header. */
function oneLine(value: FormDataEntryValue | null, max: number): string {
  return clamp(value, max).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
}

/** Trim and cap. For body text, where newlines are the point. */
function clamp(value: FormDataEntryValue | null, max: number): string {
  return (typeof value === 'string' ? value : '').trim().slice(0, max);
}
/** Sender for the contact-form notification. From support@ (a real, monitored
 *  inbox) rather than noreply@, since these are messages you actually reply to;
 *  reply-to is still the submitter, so hitting Reply reaches them. */
const CONTACT_FROM = process.env.CONTACT_FROM_EMAIL || 'MajorCycle <support@majorcycle.com>';

/** Escape user-supplied text before it is interpolated into the HTML email body,
 *  so a submitted message can never inject markup or links into the inbox. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ContactState = {
  status: 'idle' | 'success' | 'error' | 'unconfigured';
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Contact-form handler (used via useActionState). Sends the message to the
 * MajorCycle inbox through Resend's REST API. Fails safe: invalid input returns a
 * friendly error, a missing API key returns `unconfigured` (the page then shows a
 * direct-email fallback) rather than throwing, and a spam-bot honeypot hit is
 * silently accepted. No secrets are ever returned to the client.
 */
export async function sendContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  // Honeypot: a hidden field real users never see. If filled, drop silently.
  if ((formData.get('company') as string)?.trim()) {
    return { status: 'success' };
  }

  // Bounded, and bounded HERE. Audit 5A-143: there was no upper limit on any of
  // the three, on the client or the server, so a single POST could carry an
  // arbitrarily large name straight into an email subject. Its sibling
  // `sendReferral` has capped its name at 80 since Layer F2 — this is the same
  // rule, and this is the consumer that never received it (CLAUDE.md 11c-iv).
  //
  // `oneLine` also strips control characters, INCLUDING interior newlines, which
  // `trim()` does not touch. That is defence in depth rather than a demonstrated
  // hole: `name` reaches Resend as a JSON string in a `subject` field and Resend
  // encodes the header itself, so I could not produce an injection. Saying which
  // it is matters — an unproven claim recorded as a fix is worse than the gap.
  const name = oneLine(formData.get('name'), 80);
  const email = oneLine(formData.get('email'), 254);
  const message = clamp(formData.get('message'), MESSAGE_MAX);

  if (name.length < 2 || !EMAIL_RE.test(email) || message.length < 10) {
    return {
      status: 'error',
      message:
        'Please add your name, a valid email, and a message of at least 10 characters.',
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: 'unconfigured' };
  }

  // Brand-styled notification rendered through the shared email wrapper so it
  // matches the Supabase auth templates (gradient header + icon + disclaimer
  // footer); plain text stays as the fallback for non-HTML clients.
  const bodyHtml = `              <p style="margin:0 0 14px;font-size:13px;color:#475569;line-height:1.5;"><strong style="color:#0f1923;">From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
              <div style="font-size:14px;line-height:1.65;white-space:pre-wrap;color:#0f1923;">${escapeHtml(message)}</div>`;
  const html = renderBrandEmail({
    heading: 'New contact message',
    bodyHtml,
    // escapeHtml, like the body two lines above. Audit 5A-142: this was the raw
    // value, and `renderBrandEmail` drops the preheader straight into a <div> —
    // so a name of `</div><a href=...>` injected arbitrary markup into an email
    // arriving from support@majorcycle.com. `referralEmails.ts` gets this right
    // and its comment even says "escaped, for HTML body + preheader"; the rule
    // existed and this caller never received it (CLAUDE.md 11c-iv).
    preheader: `New contact message from ${escapeHtml(name)}`,
  });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: [CONTACT_TO],
        reply_to: email,
        subject: `[MajorCycle contact] ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html,
      }),
    });

    if (!res.ok) {
      console.error('Contact form: Resend send failed', res.status, await res.text());
      return {
        status: 'error',
        message: 'Something went wrong sending your message. Please try again shortly.',
      };
    }

    return { status: 'success' };
  } catch (err) {
    console.error('Contact form: Resend request threw', err);
    return {
      status: 'error',
      message: 'Something went wrong sending your message. Please try again shortly.',
    };
  }
}
