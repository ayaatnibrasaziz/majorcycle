import { NextResponse } from 'next/server';

import { sendBrandEmail } from '@/lib/email/send';
import { redactEmails } from '@/lib/redact';
import {
  COMPLAINT_EVENT,
  firstRecipient,
  verifyResendSignature,
  type ResendEvent,
} from '@/lib/resendWebhook';

/**
 * Resend webhook — the only thing that can tell the owner an email was marked as
 * spam.
 *
 * ⚠️ WHY IT EXISTS. Until 2026-09-10 the Resend account had ZERO webhooks, so a
 * spam complaint or a hard bounce was invisible: Resend records it, nothing asks,
 * and the owner finds out when deliverability has already degraded. Complaints
 * are the one signal that compounds — a rising rate quietly poisons the sending
 * domain that carries every sign-in and password-reset email we send.
 *
 * ⚠️ PUBLIC PATH, so the signature is the ONLY gate. Listed in `PUBLIC_PATHS`
 * because Resend posts server-to-server without cookies, exactly like the Stripe
 * webhook. Every request is verified against `RESEND_WEBHOOK_SECRET` before a
 * single field is read, and an unset secret is a 503 rather than an open door
 * (`verifyResendSignature` fails closed).
 *
 * ⚠️ It ALWAYS answers 200 to a verified event it does not handle. Resend retries
 * non-2xx, so returning an error for "not a complaint" would turn every ordinary
 * `email.sent` into a retry storm.
 *
 * Scope is deliberately complaints only, by owner instruction. Bounces are the
 * obvious sibling and are NOT covered — recorded here rather than assumed, since
 * a comment naming a gap is the only thing that keeps it visible (11f).
 */

export const runtime = 'nodejs'; // node:crypto — the edge runtime has no HMAC helper
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/** Where the alert goes. Same inbox the contact form uses. */
const ALERT_TO = process.env.CONTACT_TO_EMAIL || 'support@majorcycle.com';

export async function POST(req: Request): Promise<NextResponse> {
  // The RAW body, before any parsing — the signature covers the exact bytes.
  const raw = await req.text();

  const verdict = verifyResendSignature(
    raw,
    {
      id: req.headers.get('svix-id'),
      timestamp: req.headers.get('svix-timestamp'),
      signature: req.headers.get('svix-signature'),
    },
    process.env.RESEND_WEBHOOK_SECRET,
  );

  if (!verdict.ok) {
    if (verdict.reason === 'unconfigured') {
      // OUR fault, not an attacker's — and the two must not look alike (11e).
      console.error('resend webhook: RESEND_WEBHOOK_SECRET is unset — rejecting every event');
      return NextResponse.json({ error: 'not configured' }, { status: 503, headers: NO_STORE });
    }
    return NextResponse.json({ error: verdict.reason }, { status: 400, headers: NO_STORE });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400, headers: NO_STORE });
  }

  if (event.type !== COMPLAINT_EVENT) {
    return NextResponse.json({ received: true, handled: false }, { headers: NO_STORE });
  }

  const recipient = firstRecipient(event);
  const subject = event.data?.subject ?? '(no subject)';

  // ⚠️ The recipient is a real person's address, so it is redacted in the LOG and
  // kept in the EMAIL — the log is the thing that gets shipped around, and the
  // alert is useless without knowing who complained (lib/redact.ts).
  console.warn(
    'resend webhook: spam complaint',
    redactEmails(`to=${recipient ?? 'unknown'}`),
    `subject=${JSON.stringify(subject)}`,
  );

  const when = event.created_at ?? new Date().toISOString();
  await sendBrandEmail({
    to: ALERT_TO,
    subject: 'Spam complaint received',
    heading: 'Deliverability',
    preheader: 'Someone marked a MajorCycle email as spam.',
    bodyHtml:
      `<p>A recipient marked a MajorCycle email as spam.</p>` +
      `<p><strong>Recipient:</strong> ${escapeHtml(recipient ?? 'unknown')}<br>` +
      `<strong>Subject:</strong> ${escapeHtml(subject)}<br>` +
      `<strong>When:</strong> ${escapeHtml(when)}</p>` +
      `<p>Resend suppresses this address automatically. Repeated complaints ` +
      `damage the sending domain, which carries every sign-in and password-reset ` +
      `email, so it is worth reading the message that triggered it.</p>`,
    text:
      `A recipient marked a MajorCycle email as spam.\n\n` +
      `Recipient: ${recipient ?? 'unknown'}\nSubject: ${subject}\nWhen: ${when}\n\n` +
      `Resend suppresses this address automatically. Repeated complaints damage ` +
      `the sending domain, which carries every sign-in and password-reset email.`,
    // One alert per Resend event, even if Resend redelivers it.
    idempotencyKey: `complaint-${event.data?.email_id ?? when}`,
  });

  return NextResponse.json({ received: true, handled: true }, { headers: NO_STORE });
}

/** Minimal escaping — the values come from Resend, not from us. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
