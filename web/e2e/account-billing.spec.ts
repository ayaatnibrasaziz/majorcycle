import { expect, test, type Page } from '@playwright/test';

import { HAVE_SERVICE_ROLE, createThrowawayUser, type ThrowawayUser } from './lib/throwawayUser';
import { signInAs } from './lib/session';

/**
 * What a customer sees about their own billing (owner-approved designs, 2026-10-03):
 * the Account card in each state, the failed-payment banner, the message after
 * checkout, and the Stock Detail lock window. Each state is a throwaway account, and
 * the stored Stripe figure is written the way the webhook writes it.
 */

const DAY = 86_400_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

const STATES: Record<string, Record<string, unknown>> = {
  trial: {
    subscription_status: 'trialing', subscription_plan: 'monthly', subscription_currency: 'aud',
    trial_ends_at: iso(5 * DAY), current_period_end: iso(5 * DAY),
    next_charge_amount: 1900, next_charge_currency: 'aud',
  },
  paid: {
    subscription_status: 'active', subscription_plan: 'annual', subscription_currency: 'aud',
    current_period_end: iso(200 * DAY), next_charge_amount: 14310, next_charge_currency: 'aud',
  },
  paidNoAmount: {
    subscription_status: 'active', subscription_plan: 'monthly', subscription_currency: 'aud',
    current_period_end: iso(20 * DAY),
  },
  cancelling: {
    subscription_status: 'active', subscription_plan: 'monthly', subscription_currency: 'usd',
    current_period_end: iso(12 * DAY), cancel_at_period_end: true,
  },
  grace: {
    subscription_status: 'past_due', subscription_plan: 'monthly', subscription_currency: 'aud',
    grace_until: iso(2 * DAY), next_charge_amount: 1900, next_charge_currency: 'aud',
  },
  lapsed: {
    subscription_status: 'past_due', subscription_plan: 'monthly', subscription_currency: 'aud',
    grace_until: iso(-1 * DAY), next_charge_amount: 1900, next_charge_currency: 'aud',
  },
  canceled: { subscription_status: 'canceled', subscription_plan: 'monthly', subscription_currency: 'cad' },
  trialCancelling: {
    subscription_status: 'trialing', subscription_plan: 'monthly', subscription_currency: 'aud',
    trial_ends_at: iso(5 * DAY), current_period_end: iso(5 * DAY), cancel_at_period_end: true,
  },
  // A payment disputed with the bank: a paid-up plan, held.
  disputed: {
    subscription_status: 'active', subscription_plan: 'monthly', subscription_currency: 'aud',
    current_period_end: iso(20 * DAY), next_charge_amount: 1900, next_charge_currency: 'aud',
    billing_blocked: true,
  },
  // A dispute that went against the customer: the plan is cancelled and the hold stays.
  disputeLost: { subscription_status: 'canceled', subscription_plan: 'monthly', subscription_currency: 'aud', billing_blocked: true },
};

const users: Record<string, ThrowawayUser> = {};

async function as(page: Page, state: string): Promise<void> {
  const u = users[state]!;
  await signInAs(page, u.email, u.password);
}

const card = (page: Page) =>
  page.locator('section.card', { has: page.getByRole('heading', { name: 'Subscription' }) });
const text = async (page: Page) => (await card(page).innerText()).replace(/\s+/g, ' ');

test.describe('billing as the customer sees it', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!HAVE_SERVICE_ROLE, 'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to run');
  // Each test signs in as several accounts in turn, and a sign-in is up to 45s.
  test.setTimeout(420_000);

  test.beforeAll(async () => {
    for (const [state, profile] of Object.entries(STATES)) {
      users[state] = await createThrowawayUser(`bill-${state.toLowerCase()}`, profile);
    }
  });
  test.afterAll(async () => {
    for (const u of Object.values(users)) await u.remove();
  });

  test('the Account card lists what each state means, with Stripe’s own amount', async ({ page }) => {
    const expectCard = async (state: string, must: RegExp[], mustNot: RegExp[] = []) => {
      await as(page, state);
      await page.goto('/account');
      await expect(card(page)).toBeVisible();
      const t = await text(page);
      for (const m of must) expect(t, `${state}: ${m}`).toMatch(m);
      for (const m of mustNot) expect(t, `${state} must not show ${m}`).not.toMatch(m);
      // The sidebar badge and the card's pill name the state alike (lib/planStatus.ts).
      const pill = (await card(page).locator('.sub-plan-top > span').textContent())?.trim();
      const badge = (await page.getByRole('group', { name: 'Subscription status' }).first().textContent())?.trim();
      expect(pill, `${state}: card pill`).toBeTruthy();
      expect(badge?.toLowerCase(), `${state}: sidebar says what the card says`).toBe(pill?.toLowerCase());
      await page.context().clearCookies();
    };
    await expectCard('trial', [/Trial ends/, /Then A\$19\.00 a month/, /First charge/, /Cancel any time before/, /Manage billing/]);
    await expectCard('paid', [/Renews on/, /Amount A\$143\.10 a year/, /Manage billing/]);
    // CONTROL: no stored amount → the date alone, never a price from our own table.
    await expectCard('paidNoAmount', [/Renews on/], [/A\$/, /Amount/]);
    await expectCard('cancelling', [/Plan ends/, /Next charge None/, /won.t be charged again/, /CANCELLING/i]);
    await expectCard('grace', [/Payment failed A\$19\.00 on/, /Update card by/, /Update card/]);
    await expectCard('lapsed', [/Payment failed A\$19\.00 on/, /ACCESS PAUSED/i], [/Update card by/]);
    await expectCard('canceled', [/Free plan/, /subscription has ended/]);
    // A trial was never charged, so it is not told it "won't be charged AGAIN".
    await expectCard('trialCancelling', [/Trial ends/, /Next charge None/, /won.t be charged\./], [/charged again/]);
    // A held account: why, and the one action that helps — no renewal, amount or card button.
    // After a LOST dispute nothing is "on hold" — it will not come back by itself.
    await expectCard('disputeLost', [/CANCELLED/i, /switched off/, /Contact support/], [/on hold/i, /while that.s resolved/]);
    await expectCard('disputed', [/ON HOLD/i, /disputed with the bank/, /Contact support/], [/Renews on/, /A\$19/, /Manage billing/, /Update card/]);
  });

  test('a held account: the hold banner with support, never the card one, and the card says it once', async ({ page }) => {
    await as(page, 'disputed');
    await page.goto('/account?billing=blocked');
    await expect(card(page)).toBeVisible();
    const t = await text(page);
    expect(t.match(/disputed/g)?.length, 'the hold explained once in the card, not twice').toBe(1);
    // ...and once on the PAGE: the banner stays off /account, whose card already says
    // it with the same button (visual audit, 2026-10-07).
    await expect(page.locator('.payment-banner')).toHaveCount(0);
    // Every signed-in page carries the hold banner; its one action is support.
    await page.goto('/stocks');
    const banner = page.locator('.payment-banner');
    await expect(banner).toHaveClass(/payment-banner--held/);
    await expect(banner).toContainText('Your account is on hold');
    // Updating a card cannot lift a dispute, so nothing may point at it.
    await expect(banner.getByRole('button', { name: 'Update card' })).toHaveCount(0);
    await banner.getByRole('button', { name: 'Contact support' }).click();
    await expect(page.getByRole('dialog')).toContainText('on hold because a payment was disputed');
    await page.context().clearCookies();

    // After a LOST dispute it no longer says "on hold".
    await as(page, 'disputeLost');
    await page.goto('/stocks');
    await expect(page.locator('.payment-banner')).toContainText('switched off on this account');
    await expect(page.locator('.payment-banner')).not.toContainText('on hold');
  });

  test('the failed-payment banner: amber with a deadline, red once paused, absent otherwise', async ({ page }) => {
    await as(page, 'grace');
    await page.goto('/stocks');
    const banner = page.locator('.payment-banner');
    await expect(banner).toHaveClass(/payment-banner--grace/);
    await expect(banner).toContainText('Update your card by');
    await expect(banner.getByRole('button', { name: 'Update card' })).toBeVisible();
    // On /account the card says it instead, so the page does not say it twice.
    await page.goto('/account');
    await expect(card(page)).toContainText('Update card by');
    await expect(page.locator('.payment-banner')).toHaveCount(0);
    await page.context().clearCookies();

    await as(page, 'lapsed');
    await page.goto('/stocks');
    await expect(page.locator('.payment-banner')).toHaveClass(/payment-banner--paused/);
    await expect(page.locator('.payment-banner')).toContainText('Your access is paused');
    await page.context().clearCookies();

    // CONTROL: a healthy subscriber and a cancelled one see no banner.
    for (const state of ['paid', 'canceled']) {
      await as(page, state);
      await page.goto('/stocks');
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('.payment-banner'), state).toHaveCount(0);
      await page.context().clearCookies();
    }
  });

  test('after checkout: a trial is not told it paid', async ({ page }) => {
    const notice = (p: Page) => card(p).locator('[role="status"], [role="alert"]').first();
    await as(page, 'trial');
    await page.goto('/account?checkout=success');
    await expect(notice(page)).toContainText('free trial has started');
    await expect(card(page)).not.toContainText('Payment received');
    await page.context().clearCookies();

    await as(page, 'paid');
    await page.goto('/account?checkout=success');
    await expect(notice(page)).toContainText('Payment received');
    await page.context().clearCookies();

    // A cancelled account returning from checkout is congratulated on nothing.
    await as(page, 'canceled');
    await page.goto('/account?checkout=success');
    await expect(card(page)).toBeVisible();
    await expect(card(page)).not.toContainText('Payment received');
    await expect(card(page)).not.toContainText('trial has started');
  });

  test('the Stock Detail lock window says why, with the button that fixes it', async ({ page }) => {
    const open = async (state: string) => {
      await as(page, state);
      await page.goto('/stocks/us/AAPL');
      const unlock = page.getByRole('button', { name: /Unlock/ }).first();
      await unlock.waitFor({ timeout: 60_000 });
      await unlock.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Checking your plan…')).toHaveCount(0, { timeout: 20_000 });
      return dialog;
    };
    let dialog = await open('canceled');
    await expect(dialog).toContainText('Your subscription has ended');
    await expect(dialog.getByRole('button', { name: 'Resubscribe' })).toBeVisible();
    await page.context().clearCookies();

    dialog = await open('lapsed');
    await expect(dialog).toContainText('We couldn’t take your last payment');
    await expect(dialog.getByRole('button', { name: 'Update card' })).toBeVisible();
    // CONTROL: the stranger's pitch is not what a customer with a failed card gets.
    await expect(dialog.getByRole('button', { name: /free trial/i })).toHaveCount(0);
  });
});

test.describe('the first-login screen does not use a free view', () => {
  test.skip(!HAVE_SERVICE_ROLE, 'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to run');
  let user: ThrowawayUser;
  test.beforeAll(async () => {
    user = await createThrowawayUser('firstview', { acknowledged_disclaimer_at: null });
  });
  test.afterAll(async () => user?.remove());

  test('opening a stock behind it counts nothing', async ({ page }) => {
    // Sign-in lands on Browse, where the gate is already showing in place of the page.
    await signInAs(page, user.email, user.password);
    await page.goto('/stocks/us/MSFT');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
    const row = await user.read<{ free_views_tickers: string[] | null }>('free_views_tickers');
    expect(row.free_views_tickers ?? []).toEqual([]);
  });
});
