import { test, expect } from '@playwright/test';
import Stripe from 'stripe';

/**
 * Is the Stripe key we are given actually RESTRICTED to what the app needs?
 *
 * Every other Stripe test asks "does our code work?". This one asks "is the key
 * holding no more power than production's?" — a question no other test can answer,
 * because nothing in the app calls `customers.*`, so a full-access key and a properly
 * scoped one behave identically everywhere else. That blind spot was real: the GitHub
 * Actions secret stayed a full `sk_test_` for a day after local dev and production were
 * both tightened, and CI went green throughout (2026-08-02, docs/roadmap.md "Key hygiene").
 *
 * UNLIKE e2e/stripe-webhook.spec.ts, this DOES call the Stripe API — two requests, both
 * reads, in test mode. That is unavoidable: permissions only exist on Stripe's side, so
 * the only way to learn them is to be refused.
 *
 * The proof needs BOTH halves, and neither is sufficient alone:
 *   - a permitted call must SUCCEED  → the key is valid and reaching Stripe
 *   - a forbidden call must be REFUSED → the key is genuinely restricted
 * Without the first, an invalid or revoked key would "pass" the refusal for entirely the
 * wrong reason. This is the same "the refusals are the control" logic that made the
 * Session 4 permission proof meaningful, kept honest by also proving the passes.
 */

const KEY = process.env.STRIPE_SECRET_KEY;

// Never let this suite talk to the live account: it would be a read-only pair of calls,
// but "harmless in live mode" is how live-mode accidents start. Same refusal as
// scripts/stripe-listen.mjs.
const IS_LIVE = !!KEY && (KEY.startsWith('sk_live') || KEY.startsWith('rk_live'));

test.describe('stripe key scope', () => {
  test.skip(!KEY, 'set STRIPE_SECRET_KEY (test mode) to run');
  test.skip(IS_LIVE, 'STRIPE_SECRET_KEY is a LIVE key — refusing to run key-scope probes against live');

  test('the key is a restricted key, not a full-access secret key', async () => {
    // Necessary but NOT sufficient — a restricted key can still be granted everything,
    // which is why the refusal test below exists. This one catches the blunt mistake of
    // pasting sk_… (or the STRIPE_TEST_ADMIN_KEY harness key) where the app key belongs.
    expect(KEY!.startsWith('rk_'), 'expected a restricted key (rk_…), got a full sk_… key').toBe(
      true,
    );
  });

  test('a permitted call succeeds — the key is valid and in scope for Prices', async () => {
    const stripe = new Stripe(KEY!, { apiVersion: '2026-06-24.dahlia' });
    // Prices read is one of the five the app genuinely needs (lib/stripe.ts resolvePriceId).
    // We assert only that it does not throw: whether a given lookup_key exists is a
    // fixture question, not a permission one.
    await expect(
      stripe.prices.list({ active: true, limit: 1 }),
      'Prices read was refused — the key is invalid, revoked, or under-scoped',
    ).resolves.toBeDefined();
  });

  test('a forbidden call is refused — Customers is not granted', async () => {
    const stripe = new Stripe(KEY!, { apiVersion: '2026-06-24.dahlia' });

    let err: unknown;
    try {
      await stripe.customers.list({ limit: 1 });
    } catch (e) {
      err = e;
    }

    expect(err, 'customers.list SUCCEEDED — this key grants Customers, production does not').toBeDefined();

    // Distinguish "refused because restricted" from "refused because the key is broken".
    // An invalid key raises StripeAuthenticationError on every call, including this one,
    // so without this assertion a garbage key would pass for the wrong reason.
    const type = (err as Stripe.errors.StripeError).type;
    expect(type, `expected StripePermissionError, got ${type}`).toBe('StripePermissionError');
  });
});
