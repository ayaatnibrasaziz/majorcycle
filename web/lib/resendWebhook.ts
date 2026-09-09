import { createHmac } from 'node:crypto';

import { safeEqual } from '@/lib/internalAuth';

/**
 * Resend webhook signature verification.
 *
 * Resend signs with **Svix**, so this is the Svix scheme rather than anything
 * Resend-specific: HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}`,
 * keyed by the base64 body of the `whsec_…` secret, compared against the
 * space-separated `v1,<sig>` list in `svix-signature`.
 *
 * ⚠️ Implemented here rather than by adding the `svix` package. This is ~30 lines
 * of standard-library crypto against a published, stable scheme, and a webhook
 * verifier is exactly the kind of code that must not silently change under a
 * dependency bump. It is also the only way to keep it PURE — no network, no
 * client — so `e2e/resend-webhook.spec.ts` can drive the real function with
 * known-good and known-bad inputs instead of asserting that a library was called.
 *
 * ⚠️ Fails CLOSED throughout. An unset secret returns `false`, never `true` —
 * "no secret configured" must never mean "accept everyone", which would turn a
 * public POST endpoint into an open one (the same rule as `hasInternalSecret`).
 */

/** How far a timestamp may be from now. Svix's own default. */
export const TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export type VerifyResult =
  | { ok: true }
  /**
   * ⚠️ Distinct reasons, because they are not the same event (11e). `unconfigured`
   * is OUR fault and must page the owner; `bad_signature` is someone probing and
   * is routine. Collapsing them into one `false` is how a missing env var would
   * look like an attack for weeks.
   */
  | { ok: false; reason: 'unconfigured' | 'missing_headers' | 'stale_timestamp' | 'bad_signature' };

export function verifyResendSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!secret) return { ok: false, reason: 'unconfigured' };
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing_headers' };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) {
    // Replay protection: a captured request must not stay valid forever.
    return { ok: false, reason: 'stale_timestamp' };
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');

  // The header may carry several versioned signatures during a secret rotation.
  const presented = signature
    .split(' ')
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice(3));

  const match = presented.some((sig) => safeEqual(sig, expected));
  return match ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

/** The event we act on. A spam complaint is invisible everywhere else. */
export const COMPLAINT_EVENT = 'email.complained';

export interface ResendEvent {
  type?: string;
  created_at?: string;
  data?: { to?: string[] | string; subject?: string; email_id?: string };
}

/** First recipient, for the alert body. Resend sends `to` as an array. */
export function firstRecipient(event: ResendEvent): string | null {
  const to = event.data?.to;
  if (Array.isArray(to)) return to[0] ?? null;
  return typeof to === 'string' ? to : null;
}
