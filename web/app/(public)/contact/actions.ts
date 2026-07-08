'use server';

import { renderBrandEmail } from '@/lib/email/brandEmail';

/** Where contact-form submissions are emailed. Defaults to the live support@
 *  inbox (Cloudflare Email Routing → owner Gmail), overridable via env. */
const CONTACT_TO = process.env.CONTACT_TO_EMAIL || 'support@majorcycle.com';
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

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const message = (formData.get('message') as string | null)?.trim() ?? '';

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
    preheader: `New contact message from ${name}`,
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
