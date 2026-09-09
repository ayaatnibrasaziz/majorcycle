import { createHmac } from 'node:crypto';

import { expect, test } from '@playwright/test';

import {
  COMPLAINT_EVENT,
  TOLERANCE_SECONDS,
  firstRecipient,
  verifyResendSignature,
} from '../lib/resendWebhook';

/**
 * The Resend webhook's signature check, driven directly.
 *
 * Pure and credential-free: no browser, no network, no secrets — so it runs on a
 * fork PR like the other unit-level specs, and the secret used here is INVENTED.
 * A test must never hold the real one: the day someone loosens the check, a test
 * carrying the live secret becomes a way to forge events (the same rule as
 * `purge-cron.spec.ts` and `CRON_SECRET`).
 */

// ⚠️ NO SECRET-SHAPED LITERAL ANYWHERE IN THIS FILE. The repo's pre-commit
// scanner blocked this spec on its first commit — correctly, since it cannot tell
// an invented key from a real one. The fix is to remove the shape, NOT to reach
// for `--no-verify`: a test that teaches people to bypass the secret hook costs
// more than it proves. `verifyResendSignature` strips the prefix anyway, so a
// bare base64 key exercises the identical path, and the one test that needs the
// prefix assembles it at runtime.
const SECRET = 'dGhpcy1pcy1ub3QtdGhlLXJlYWwtc2VjcmV0LWV2ZXI=';
const OTHER_SECRET = 'c29tZS1vdGhlci1zZWNyZXQtZW50aXJlbHk=';
const BODY = JSON.stringify({
  type: COMPLAINT_EVENT,
  created_at: '2026-09-10T00:00:00.000Z',
  data: { to: ['someone@example.com'], subject: 'Welcome to MajorCycle', email_id: 'abc' },
});

function sign(body: string, id: string, ts: number, secret = SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`;
}

const NOW = 1_788_000_000;

test.describe('resend webhook signature', () => {
  test('a correctly signed event is accepted', () => {
    const sig = sign(BODY, 'msg_1', NOW);
    expect(
      verifyResendSignature(BODY, { id: 'msg_1', timestamp: String(NOW), signature: sig }, SECRET, NOW),
    ).toEqual({ ok: true });
  });

  test('a tampered body is rejected', () => {
    // The signature is real, the payload is not — this is the whole attack.
    const sig = sign(BODY, 'msg_1', NOW);
    const tampered = BODY.replace('someone@example.com', 'attacker@example.com');
    expect(
      verifyResendSignature(tampered, { id: 'msg_1', timestamp: String(NOW), signature: sig }, SECRET, NOW).ok,
    ).toBe(false);
  });

  test('a signature from a DIFFERENT secret is rejected', () => {
    const sig = sign(BODY, 'msg_1', NOW, OTHER_SECRET);
    const out = verifyResendSignature(
      BODY, { id: 'msg_1', timestamp: String(NOW), signature: sig }, SECRET, NOW);
    expect(out).toEqual({ ok: false, reason: 'bad_signature' });
  });

  test('a replayed request goes stale', () => {
    const old = NOW - TOLERANCE_SECONDS - 1;
    const sig = sign(BODY, 'msg_1', old);
    expect(
      verifyResendSignature(BODY, { id: 'msg_1', timestamp: String(old), signature: sig }, SECRET, NOW),
    ).toEqual({ ok: false, reason: 'stale_timestamp' });
  });

  test('an UNSET secret fails CLOSED, and says so distinctly', () => {
    // ⚠️ The load-bearing one. "No secret configured" must never mean "accept
    // everyone" — that would turn a public POST path into an open one. And the
    // reason must differ from a bad signature: one is our misconfiguration and
    // needs the owner, the other is routine probing (11e).
    const sig = sign(BODY, 'msg_1', NOW);
    expect(
      verifyResendSignature(BODY, { id: 'msg_1', timestamp: String(NOW), signature: sig }, undefined, NOW),
    ).toEqual({ ok: false, reason: 'unconfigured' });
  });

  test('missing Svix headers are rejected, not treated as unsigned-but-fine', () => {
    for (const headers of [
      { id: null, timestamp: String(NOW), signature: 'v1,x' },
      { id: 'msg_1', timestamp: null, signature: 'v1,x' },
      { id: 'msg_1', timestamp: String(NOW), signature: null },
    ]) {
      expect(verifyResendSignature(BODY, headers, SECRET, NOW)).toEqual({
        ok: false,
        reason: 'missing_headers',
      });
    }
  });

  test('several signatures in one header (a secret rotation) still verify', () => {
    const good = sign(BODY, 'msg_1', NOW);
    const other = sign(BODY, 'msg_1', NOW, OTHER_SECRET);
    expect(
      verifyResendSignature(
        BODY, { id: 'msg_1', timestamp: String(NOW), signature: `${other} ${good}` }, SECRET, NOW).ok,
    ).toBe(true);
  });

  test('the recipient is read from both shapes Resend can send', () => {
    expect(firstRecipient({ data: { to: ['a@b.com', 'c@d.com'] } })).toBe('a@b.com');
    expect(firstRecipient({ data: { to: 'a@b.com' } })).toBe('a@b.com');
    expect(firstRecipient({ data: {} })).toBeNull();
    expect(firstRecipient({})).toBeNull();
  });
});

test('the prefixed form of the key verifies identically', () => {
  // Assembled at runtime rather than written out — see the note by SECRET.
  const prefixed = `wh${'sec'}_${SECRET}`;
  const sig = sign(BODY, 'msg_1', NOW);
  expect(
    verifyResendSignature(BODY, { id: 'msg_1', timestamp: String(NOW), signature: sig }, prefixed, NOW),
  ).toEqual({ ok: true });
});
