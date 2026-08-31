import { test, expect } from '@playwright/test';
import Stripe from 'stripe';

import { PRICE_TABLE, annualSavingPercent } from '@/lib/pricing';
import { PLAN_LOOKUP_KEYS, type BillingCurrency, type PlanKey } from '@/lib/stripe';

/**
 * The price a customer is SHOWN must be the price they are CHARGED (audit F-025).
 *
 * ── Why this suite exists ───────────────────────────────────────────────────
 * The amounts live in two systems that cannot see each other: `PRICE_TABLE` in
 * `lib/pricing.ts` renders the sticker on `/pricing`, `/account`, the upgrade
 * dialog and the trial modal, while Stripe's multi-currency Prices decide what the
 * card is actually debited. Nothing linked them. Edit the table and the site
 * advertises a price Stripe will not charge; edit the Stripe price and the site
 * advertises one it no longer charges. **Both directions are silent** — no error,
 * no stale-looking page, just a fluent and specific false statement about what we
 * do, which is the CLAUDE.md 11c (v) failure shape and a consumer-law problem
 * rather than a bug.
 *
 * They agreed when checked by hand on 2026-08-24 (Layer 3b, all six figures). This
 * is the part that keeps agreeing.
 *
 * ⚠️ **STATED LIMIT, and it is half the value of this file: THIS ONLY SEES THE
 * SANDBOX.** The Stripe key available to CI is the restricted test-mode key —
 * `stripe-key-scope.spec.ts` proves that, and refuses to run at all against a live
 * key. So this suite catches the common case (somebody edits `PRICE_TABLE`, or
 * edits the test-mode Price) and is **completely blind to a live-mode change**.
 * Test and live are separate objects that merely share `lookup_key`. The live
 * figures are therefore re-read by hand at merge, and that step is written into the
 * audit's merge-gate table — not left to memory.
 *
 * ⚠️ It imports the real `PRICE_TABLE` and the real `PLAN_LOOKUP_KEYS` rather than
 * restating either. A test carrying its own copy of the numbers would be a third
 * copy to drift, which is the defect, not the guard (CLAUDE.md 11c iii).
 */

const KEY = process.env.STRIPE_SECRET_KEY;

// Same refusal as stripe-key-scope.spec.ts and scripts/stripe-listen.mjs: these are
// reads, but "harmless in live mode" is how live-mode accidents start.
const IS_LIVE = !!KEY && (KEY.startsWith('sk_live') || KEY.startsWith('rk_live'));

/** Stripe holds minor units (1500 = US$15.00); the site holds major units. */
const toMinorUnits = (major: number) => Math.round(major * 100);

const EXPECTED_INTERVAL: Record<PlanKey, Stripe.Price.Recurring.Interval> = {
  monthly: 'month',
  annual: 'year',
};

test.describe('the price shown is the price charged (test mode)', () => {
  test.skip(!KEY, 'set STRIPE_SECRET_KEY (test mode) to run');
  test.skip(IS_LIVE, 'STRIPE_SECRET_KEY is a LIVE key — refusing to probe live prices');

  const plans = Object.keys(PLAN_LOOKUP_KEYS) as PlanKey[];

  for (const plan of plans) {
    test(`${plan}: every advertised currency matches Stripe, at the right interval`, async () => {
      const stripe = new Stripe(KEY!, { apiVersion: '2026-06-24.dahlia' });
      const lookupKey = PLAN_LOOKUP_KEYS[plan];

      // ⚠️ `currency_options` is NOT returned unless expanded. Without it every
      // per-currency amount below reads `undefined`, and a test comparing
      // `undefined` to a number fails for a reason that has nothing to do with
      // pricing — or, worse, a test written to tolerate it would pass while
      // measuring nothing.
      const { data } = await stripe.prices.list({
        lookup_keys: [lookupKey],
        active: true,
        expand: ['data.currency_options'],
        limit: 10,
      });

      // CONTROL — the fixture is what we think it is. Zero prices would make every
      // loop below vacuous and the test would pass having compared nothing (14g);
      // two would mean `resolvePriceId` picks one of them arbitrarily at checkout.
      expect(
        data.length,
        `expected exactly one active Stripe price with lookup_key "${lookupKey}" — ` +
          'zero means the app cannot check out at all, more than one means checkout ' +
          'picks whichever Stripe lists first',
      ).toBe(1);

      // Safe after the assertion above; `noUncheckedIndexedAccess` cannot see it.
      const price = data[0]!;

      // A right amount on a wrong interval is the expensive version of this bug:
      // the annual figure billed every month, or the monthly figure billed once a
      // year. Nothing about the sticker would look wrong.
      expect(
        price.recurring?.interval,
        `"${lookupKey}" must bill per ${EXPECTED_INTERVAL[plan]}`,
      ).toBe(EXPECTED_INTERVAL[plan]);

      // CONTROL on the instrument, not on Stripe. Proven by deleting the `expand`
      // above: without it every per-currency amount reads `undefined` and the loop
      // below fails saying "Stripe has no USD amount" — true of the response, false
      // about Stripe, and it would send the reader to the dashboard instead of to
      // this line. Fail here first, naming the real cause.
      expect(
        price.currency_options,
        'the response carries no currency_options — the request is missing ' +
          "expand: ['data.currency_options'], not Stripe missing the currencies",
      ).toBeDefined();

      const options = price.currency_options ?? {};
      const currencies = Object.keys(PRICE_TABLE) as BillingCurrency[];

      for (const currency of currencies) {
        const advertised = PRICE_TABLE[currency][plan];
        const charged = options[currency]?.unit_amount;

        expect(
          charged,
          `the site advertises ${currency.toUpperCase()} for the ${plan} plan, but Stripe's ` +
            `"${lookupKey}" has no ${currency.toUpperCase()} amount — a customer in that ` +
            'country would be shown a price Checkout cannot charge',
        ).not.toBeUndefined();

        expect(
          charged,
          `${currency.toUpperCase()} ${plan}: the site shows ${advertised}, Stripe charges ` +
            `${(charged ?? 0) / 100}. Fix whichever is wrong — but note this suite only ` +
            'sees TEST mode, so a live-mode edit produces the same mismatch invisibly.',
        ).toBe(toMinorUnits(advertised));
      }
    });
  }

  test('the annual plan is the ~30% saving locked decision #18 promises', async () => {
    // The third copy of these numbers is CLAUDE.md's decisions table, which no tool
    // can read. Rather than restate its figures here (a fourth copy), assert the
    // relationship it states — "Annual ~30% off" — computed by the same function
    // the "Save N%" badge renders from.
    for (const currency of Object.keys(PRICE_TABLE) as BillingCurrency[]) {
      expect(
        annualSavingPercent(currency),
        `${currency.toUpperCase()}: the annual plan no longer saves the ~30% decision #18 ` +
          'fixes, and the "Save N%" badge on /pricing renders this exact number',
      ).toBe(30);
    }
  });
});
