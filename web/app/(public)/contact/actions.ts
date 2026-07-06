'use server';

/** Where contact-form submissions are emailed. Defaults to the live support@
 *  inbox (Cloudflare Email Routing → owner Gmail), overridable via env. */
const CONTACT_TO = process.env.CONTACT_TO_EMAIL || 'support@majorcycle.com';
const CONTACT_FROM = process.env.RESEND_FROM_EMAIL || 'MajorCycle <noreply@majorcycle.com>';

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

  // Brand-styled notification (navy header + signature footer) so messages are
  // easy to spot and reply to in the inbox; plain text stays as the fallback.
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f1923;">
  <div style="background:#1A3A6E;padding:16px 20px;border-radius:8px 8px 0 0;">
    <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:-0.2px;">MajorCycle</span>
    <span style="color:#9db8e0;font-size:12px;margin-left:8px;">New contact message</span>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px;background:#ffffff;">
    <p style="margin:0 0 12px;font-size:13px;color:#475569;"><strong style="color:#0f1923;">From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
    <div style="font-size:14px;line-height:1.6;white-space:pre-wrap;color:#0f1923;">${escapeHtml(message)}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0 12px;" />
    <p style="margin:0;font-size:11px;color:#94a3b8;">Reply directly to this email to respond. Sent via the majorcycle.com contact form.</p>
  </div>
</div>`.trim();

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
