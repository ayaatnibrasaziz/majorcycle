import { test, expect, type APIRequestContext } from '@playwright/test';
import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * F3 Stripe webhook — contract tests (plan §14). No network to Stripe: each event
 * JSON is signed with the webhook secret via `generateTestHeaderString`, POSTed to
 * /api/stripe/webhook, and the resulting `profiles` row is asserted with the
 * service-role client. Covers the event→DB mapping, idempotency (same id twice ⇒
 * one effect), and bad-signature rejection. Runs only when the Stripe + Supabase
 * service creds are present (skips cleanly otherwise, like the auth/account suites).
 *
 * Creates its OWN throwaway auth user + profiles row in beforeAll and deletes it in
 * afterAll, so it never touches the shared login account — the account and webhook
 * suites can run fully in parallel without contending on one row. Billing columns
 * are service-role-only, so only this admin client (never a browser) writes them.
 */

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const BILLING_COLUMNS =
  'subscription_status, subscription_plan, subscription_currency, ' +
  'stripe_subscription_id, stripe_customer_id, cancel_at_period_end, ' +
  'trial_ends_at, current_period_end, grace_until';

// Only used offline for generateTestHeaderString (signs with the webhook secret,
// never calls the API), so the API key value is irrelevant — any non-empty string.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'unused-offline-signing');

const RUN = Date.now();
const CUSTOMER = `cus_e2e_${RUN}`;
const SUB = `sub_e2e_${RUN}`;
const nowSec = Math.floor(RUN / 1000);
const trialEnd = nowSec + 7 * 24 * 60 * 60;
const periodEnd = nowSec + 30 * 24 * 60 * 60;

let admin: SupabaseClient;
let userId: string;

function makeEvent(type: string, object: unknown) {
  return {
    id: `evt_e2e_${RUN}_${Math.random().toString(36).slice(2)}`,
    object: 'event',
    api_version: '2026-06-24.dahlia',
    created: nowSec,
    type,
    data: { object },
  };
}

function signedHeaders(payload: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'stripe-signature': stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET!,
    }),
  };
}

async function post(request: APIRequestContext, event: object) {
  const payload = JSON.stringify(event);
  return request.post('/api/stripe/webhook', {
    headers: signedHeaders(payload),
    data: payload,
  });
}

async function profile() {
  const { data } = await admin
    .from('profiles')
    .select(BILLING_COLUMNS)
    .eq('id', userId)
    .single();
  return data as unknown as Record<string, unknown>;
}

function subObject(overrides: Record<string, unknown> = {}) {
  return {
    id: SUB,
    object: 'subscription',
    status: 'trialing',
    currency: 'aud',
    cancel_at_period_end: false,
    trial_end: trialEnd,
    customer: CUSTOMER,
    metadata: { user_id: userId },
    items: {
      data: [
        {
          current_period_end: trialEnd,
          price: { lookup_key: 'majorcycle_monthly' },
        },
      ],
    },
    ...overrides,
  };
}

function invoiceObject(overrides: Record<string, unknown> = {}) {
  return {
    id: `in_e2e_${RUN}_${Math.random().toString(36).slice(2)}`,
    object: 'invoice',
    customer: CUSTOMER,
    parent: {
      subscription_details: { subscription: SUB, metadata: { user_id: userId } },
    },
    ...overrides,
  };
}

test.describe.serial('stripe webhook contract', () => {
  test.skip(
    !WEBHOOK_SECRET || !SERVICE_KEY || !SUPABASE_URL,
    'set STRIPE_WEBHOOK_SECRET + Supabase service creds to run',
  );

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Dedicated throwaway account for this run only — never the shared login user.
    // @example.com is reserved + non-deliverable, and admin.createUser sends no
    // email (email_confirm: true), so this has no outside side-effects.
    const email = `stripe-webhook-e2e-${RUN}@example.com`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: `E2e!webhook-${RUN}`,
    });
    if (error || !created?.user) {
      throw new Error(`could not create webhook test user: ${error?.message}`);
    }
    userId = created.user.id;
    // The on_auth_user_created trigger creates the profiles row; upsert defensively
    // so it is guaranteed present regardless of trigger timing.
    await admin.from('profiles').upsert({ id: userId, email }, { onConflict: 'id' });
  });

  test.afterAll(async () => {
    // Drop our event rows, then delete the throwaway user — the profiles row goes
    // with it via ON DELETE CASCADE, leaving zero residue.
    if (admin && userId) {
      await admin.from('stripe_events').delete().like('id', `evt_e2e_${RUN}_%`);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  test('rejects a bad signature with 400', async ({ request }) => {
    const payload = JSON.stringify(makeEvent('customer.subscription.created', subObject()));
    const res = await request.post('/api/stripe/webhook', {
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
      data: payload,
    });
    expect(res.status()).toBe(400);
  });

  test('subscription.created → trialing sync', async ({ request }) => {
    const event = makeEvent('customer.subscription.created', subObject());
    const res = await post(request, event);
    expect(res.ok()).toBeTruthy();

    const p = await profile();
    expect(p['subscription_status']).toBe('trialing');
    expect(p['subscription_plan']).toBe('monthly');
    expect(p['subscription_currency']).toBe('aud');
    expect(p['stripe_subscription_id']).toBe(SUB);
    expect(p['stripe_customer_id']).toBe(CUSTOMER);
    expect(p['cancel_at_period_end']).toBe(false);
    expect(p['trial_ends_at']).not.toBeNull();
    expect(p['current_period_end']).not.toBeNull();

    // The event was recorded in the idempotency ledger.
    const { data: rows } = await admin
      .from('stripe_events')
      .select('id')
      .eq('id', event.id);
    expect(rows?.length).toBe(1);
  });

  test("a trial's paid $0 invoice must NOT downgrade trialing → active", async ({
    request,
  }) => {
    // Regression: a 7-day trial's $0 invoice is marked paid the instant the trial
    // starts, firing invoice.paid/payment_succeeded alongside subscription.created.
    // The invoice handler must clear grace but leave 'trialing' intact (only
    // customer.subscription.* sets status). The prior test left status 'trialing'.
    const event = makeEvent('invoice.paid', invoiceObject());
    expect((await post(request, event)).ok()).toBeTruthy();

    const p = await profile();
    expect(p['subscription_status']).toBe('trialing'); // NOT 'active'
    expect(p['grace_until']).toBeNull();
  });

  test('same event id twice ⇒ one effect (idempotent)', async ({ request }) => {
    const event = makeEvent('customer.subscription.updated', subObject({ status: 'active', trial_end: null }));
    const first = await post(request, event);
    expect(first.ok()).toBeTruthy();
    expect((await first.json()).duplicate).toBeUndefined();

    const second = await post(request, event); // identical id
    expect(second.ok()).toBeTruthy();
    expect((await second.json()).duplicate).toBe(true);

    const { data: rows } = await admin
      .from('stripe_events')
      .select('id')
      .eq('id', event.id);
    expect(rows?.length).toBe(1);
  });

  test('subscription.updated → active + cancel_at_period_end', async ({ request }) => {
    const event = makeEvent(
      'customer.subscription.updated',
      subObject({
        status: 'active',
        trial_end: null,
        cancel_at_period_end: true,
        items: {
          data: [
            { current_period_end: periodEnd, price: { lookup_key: 'majorcycle_monthly' } },
          ],
        },
      }),
    );
    expect((await post(request, event)).ok()).toBeTruthy();

    const p = await profile();
    expect(p['subscription_status']).toBe('active');
    expect(p['cancel_at_period_end']).toBe(true);
    expect(p['grace_until']).toBeNull();
  });

  test('subscription.updated with cancel_at (dahlia) → scheduled cancel + ledger enriched', async ({
    request,
  }) => {
    // In API 2026-06-24.dahlia a cancel-at-period-end sets `cancel_at` and leaves the
    // legacy `cancel_at_period_end` boolean FALSE. The handler must derive the flag
    // from cancel_at (Step 6 fix A). Same event also proves Part G (ledger enrichment).
    const event = makeEvent(
      'customer.subscription.updated',
      subObject({
        status: 'active',
        trial_end: null,
        cancel_at_period_end: false, // deprecated boolean stays false…
        cancel_at: periodEnd, // …but cancel_at is the real signal
        items: {
          data: [
            { current_period_end: periodEnd, price: { lookup_key: 'majorcycle_monthly' } },
          ],
        },
      }),
    );
    expect((await post(request, event)).ok()).toBeTruthy();

    const p = await profile();
    expect(p['cancel_at_period_end']).toBe(true); // derived from cancel_at, not the boolean

    // Part G: the idempotency-ledger row is stamped with who/what it resolved to.
    const { data: row } = await admin
      .from('stripe_events')
      .select('user_id, stripe_customer_id, stripe_subscription_id')
      .eq('id', event.id)
      .single();
    expect(row?.user_id).toBe(userId);
    expect(row?.stripe_customer_id).toBe(CUSTOMER);
    expect(row?.stripe_subscription_id).toBe(SUB);
  });

  test('invoice.payment_failed → past_due + grace window', async ({ request }) => {
    const event = makeEvent('invoice.payment_failed', invoiceObject());
    expect((await post(request, event)).ok()).toBeTruthy();

    const p = await profile();
    expect(p['subscription_status']).toBe('past_due');
    expect(p['grace_until']).not.toBeNull();
    // ~3 days out.
    const graceMs = new Date(p['grace_until'] as string).getTime() - Date.now();
    expect(graceMs).toBeGreaterThan(2.8 * 24 * 60 * 60 * 1000);
    expect(graceMs).toBeLessThan(3.2 * 24 * 60 * 60 * 1000);
  });

  test('invoice.payment_succeeded → active + grace cleared', async ({ request }) => {
    const event = makeEvent('invoice.payment_succeeded', invoiceObject());
    expect((await post(request, event)).ok()).toBeTruthy();

    const p = await profile();
    expect(p['subscription_status']).toBe('active');
    expect(p['grace_until']).toBeNull();
  });

  test('subscription.deleted → canceled + cleared', async ({ request }) => {
    const event = makeEvent('customer.subscription.deleted', subObject({ status: 'canceled' }));
    expect((await post(request, event)).ok()).toBeTruthy();

    const p = await profile();
    expect(p['subscription_status']).toBe('canceled');
    expect(p['stripe_subscription_id']).toBeNull();
    expect(p['trial_ends_at']).toBeNull();
    expect(p['cancel_at_period_end']).toBe(false);
  });

  test('checkout.session.completed → links the Stripe customer', async ({ request }) => {
    // First clear the customer link so we can prove the handler sets it.
    await admin.from('profiles').update({ stripe_customer_id: null }).eq('id', userId);
    const session = {
      id: `cs_e2e_${RUN}`,
      object: 'checkout.session',
      client_reference_id: userId,
      customer: CUSTOMER,
      subscription: SUB,
    };
    expect((await post(request, makeEvent('checkout.session.completed', session))).ok()).toBeTruthy();

    const p = await profile();
    expect(p['stripe_customer_id']).toBe(CUSTOMER);
  });
});
