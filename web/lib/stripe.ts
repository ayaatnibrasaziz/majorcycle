import Stripe from 'stripe';

/**
 * Server-side Stripe client + the small pure helpers shared across F3 (checkout,
 * webhook, portal, cron). Import this only from server code — it reads the secret
 * key from the environment and must never reach the browser. Hosted Checkout is a
 * redirect, so no client-side Stripe key/SDK is needed anywhere.
 *
 * See ~/.claude/plans/moonlit-prancing-lantern.md §2 and docs/data-contracts.md §10.
 */

// PIN the API version so webhook payload shapes never shift under us on a Stripe
// upgrade (plan §7A). This is the version stripe-node 22.x is generated against;
// bump it deliberately (with a re-test) when upgrading the SDK, never implicitly.
const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2026-06-24.dahlia';

let _stripe: Stripe | null = null;

/**
 * Lazily-constructed singleton. Lazy so importing this module at build time (when
 * no key is set) never throws — it only errors if code actually tries to use Stripe
 * without a key, with a message that says exactly what to fix.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add a test key (rk_test_/sk_test_) to ' +
        'web/.env.local for local/preview, or the live key to Vercel env for production.',
    );
  }
  _stripe = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    appInfo: { name: 'MajorCycle', url: 'https://www.majorcycle.com' },
    // Auto-retry transient network failures with idempotency keys + exponential
    // backoff (Stripe's recommended resilience default; the SDK does 0 retries
    // unless told to). Safe for our GETs (price list) and the checkout POST alike.
    maxNetworkRetries: 2,
  });
  return _stripe;
}

// ── Plans & prices (addressed by lookup_key — never hard-coded ids) ──────────
// Test and live have different price ids but the SAME lookup_keys, so lookup_key
// is the only stable cross-mode reference (plan §2 / data-contracts §10).
export type PlanKey = 'monthly' | 'annual';

export const PLAN_LOOKUP_KEYS: Record<PlanKey, string> = {
  monthly: 'majorcycle_monthly',
  annual: 'majorcycle_annual',
};

/** 7-day free trial, applied in checkout code (NOT on the Price) so the abuse guard can drop it. */
export const TRIAL_PERIOD_DAYS = 7;

const _priceIdCache = new Map<PlanKey, string>();

/**
 * Resolve a plan's active Price id by its lookup_key, cached per process (test/live
 * differ, but a single process only ever holds one key/mode). Throws a clear error
 * if the price is missing in the current mode — the usual cause is "built it in live
 * but not test mode" (they're isolated).
 */
export async function resolvePriceId(plan: PlanKey): Promise<string> {
  const cached = _priceIdCache.get(plan);
  if (cached) return cached;

  const lookupKey = PLAN_LOOKUP_KEYS[plan];
  const { data } = await getStripe().prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = data[0];
  if (!price) {
    throw new Error(
      `No active Stripe price for lookup_key "${lookupKey}" (plan "${plan}"). ` +
        'Create the product + prices in the CURRENT Stripe mode (test and live are separate).',
    );
  }
  _priceIdCache.set(plan, price.id);
  return price.id;
}

/** Reverse map (webhook): a Price's lookup_key back to our plan key, or null if unrecognised. */
export function planFromLookupKey(lookupKey: string | null | undefined): PlanKey | null {
  if (lookupKey === PLAN_LOOKUP_KEYS.monthly) return 'monthly';
  if (lookupKey === PLAN_LOOKUP_KEYS.annual) return 'annual';
  return null;
}

// ── Currency (fixed per subscription by country) ─────────────────────────────
export type BillingCurrency = 'usd' | 'aud' | 'cad';

/** AU→aud, CA→cad, everyone-else→usd (locked decision). Input is ISO-3166 alpha-2. */
export function currencyForCountry(country: string | null | undefined): BillingCurrency {
  switch (country?.toUpperCase()) {
    case 'AU':
      return 'aud';
    case 'CA':
      return 'cad';
    default:
      return 'usd';
  }
}

// ── Status mapping (Stripe → our profiles.subscription_status) ───────────────
export type AppSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | null;

/**
 * Collapse Stripe's subscription status into the value we store. `unpaid` is treated
 * as past_due-equivalent (hard-locked); incomplete/expired/paused mean "no active
 * sub". The hard-lock decision itself (past_due AND now > grace_until, or
 * billing_blocked) lives in the entitlement gate (build step 10), which reads
 * grace_until/billing_blocked alongside this status.
 */
export function mapStripeStatus(
  status: Stripe.Subscription.Status,
): AppSubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return null;
    default:
      return null;
  }
}
