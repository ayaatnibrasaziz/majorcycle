'use server';

/** Where contact-form submissions are emailed. Defaults to the live security@
 *  inbox (Cloudflare Email Routing → owner), overridable via env. */
const CONTACT_TO = process.env.CONTACT_TO_EMAIL || 'security@majorcycle.com';
const CONTACT_FROM = process.env.RESEND_FROM_EMAIL || 'MajorCycle <noreply@majorcycle.com>';

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
