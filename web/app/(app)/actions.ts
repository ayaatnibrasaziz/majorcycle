'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { after } from 'next/server';

import { sendWelcomeEmail } from '@/lib/email/welcomeEmail';
import { clientIpFrom, metaWebsiteEvent, sendToMeta } from '@/lib/metaServer';
import { SITE_ORIGIN } from '@/lib/url';
import { acknowledgeWriteDecision } from '@/lib/entitlement';
import { reportIssue } from '@/lib/observability';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Record that the signed-in user has read and acknowledged the first-login
 * methodology + disclaimer (locked decision #23).
 *
 * A server action, deliberately — the earlier client-side write (browser Supabase
 * client) could fire before the browser session had hydrated, so RLS matched zero
 * rows and PostgREST returned NO error: a silent non-save that left the user stuck
 * behind the modal. Same failure class as the profile save. Here the cookie-bound
 * client is already authenticated (middleware validated the session for this
 * request) and the user id is derived from that session, never trusted from the
 * client, so the write always runs as the user.
 */
export async function acknowledgeDisclaimer(): Promise<{ ok: boolean }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // ── The acknowledgement is WRITE-ONCE ───────────────────────────────────────
  // It is a compliance record (locked decisions #23/#24): the date on which this
  // person was shown the methodology and the disclaimer. Re-stamping it does not
  // add information, it destroys the only copy of it.
  //
  // That is not hypothetical. On 2026-08-27 a failed profile read put the modal in
  // front of an account that had acknowledged on 2026-06-15; pressing the only
  // button on it replaced the June date with that day's, and the original is gone.
  // The read is fixed in lib/entitlement.ts, and this is the second layer: if the
  // gate is ever wrong again, being wrong costs nothing.
  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('acknowledged_disclaimer_at, display_name, country')
    .eq('id', user.id)
    .maybeSingle();

  // ⚠️ The DECISION lives in lib/entitlement.ts, not here, and that is the whole
  // point of finding F-033: while these rules sat inside this action they could not
  // be tested at all. This file builds its own Supabase client, so no spec could
  // substitute a stub, and four real protections went unexercised on the one path
  // that has already destroyed a compliance record. `acknowledgeWriteDecision` is
  // pure, so `e2e/onboarding-gate.spec.ts` drives every branch with no credentials.
  const decision = acknowledgeWriteDecision(existing, !!readError);

  if (decision === 'refuse_unreadable') {
    // ALERT: this is the refusal that stops the 2026-08-27 incident repeating — an
    // unreadable profile must never let the gate WRITE over an existing June
    // acknowledgement (11e, third instance). Refusing is right, and it also means a
    // real reader is stuck on a modal they cannot dismiss.
    reportIssue('acknowledgeDisclaimer: could not read the row before writing', {
      level: 'alert',
      tags: { userId: user.id, code: readError?.code ?? 'zero_rows' },
    });
    return { ok: false };
  }

  if (decision === 'skip_already_acknowledged') return { ok: true };

  const { error } = await supabase
    .from('profiles')
    // `.is(...)` repeats the check as a WHERE clause so two tabs racing cannot both
    // write. Postgres decides it, not the gap between our read and our write.
    .update({ acknowledged_disclaimer_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('acknowledged_disclaimer_at', null);
  if (error) {
    reportIssue('acknowledgeDisclaimer: update failed', {
      cause: error,
      level: 'alert',
      tags: { userId: user.id },
    });
    return { ok: false };
  }

  // The ONE welcome email (lib/email/welcomeEmail.ts), scheduled for tomorrow. Here
  // because this write happens exactly once per account — it is write-once above —
  // so the email cannot be sent twice; its idempotency key is a second guard. A failed
  // send is logged inside and never stops the reader getting past the modal.
  // `after()`: sent once the reader is already past the modal, so a slow email service
  // can never hold them on it.
  const email = user.email;
  if (email) {
    after(() => sendWelcomeEmail({ to: email, name: existing?.display_name ?? null, userId: user.id }));
  }

  // Meta: the server copy of the registration (Meta's "redundant setup"). This write
  // happens once per account, and `reg_<user id>` is the same id the browser sent with
  // its CompleteRegistration, so Meta keeps one of the two (lib/metaPixel.ts). A no-op
  // until META_CAPI_TOKEN is set.
  const h = await headers();
  const registration = metaWebsiteEvent({
    name: 'CompleteRegistration',
    eventId: `reg_${user.id}`,
    sourceUrl: `${SITE_ORIGIN}/stocks`,
    userId: user.id,
    email: user.email,
    cookieHeader: h.get('cookie'),
    userAgent: h.get('user-agent'),
    ip: clientIpFrom(h),
    country: existing?.country ?? h.get('x-vercel-ip-country'),
    customData: { content_name: 'free_account' },
  });
  after(() => sendToMeta([registration]));

  // The (app) layout gates the onboarding modal on this flag across every
  // authenticated route, so revalidate the shared layout (not just one page).
  revalidatePath('/', 'layout');
  return { ok: true };
}
