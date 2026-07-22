import { sendBrandEmail } from '@/lib/email/send';
import { SITE, p, muted, button, greetingHtml, greetingText } from '@/lib/email/format';
import { PRICE_TABLE, CURRENCY_SYMBOL } from '@/lib/pricing';
import { TRIAL_PERIOD_DAYS } from '@/lib/stripe';

/**
 * The four branded billing-lifecycle emails (F3 Step 8), all fired from the
 * Stripe webhook (`web/app/api/stripe/webhook/route.ts`):
 *   1. trial started    — the trial begins at checkout (customer.subscription.created, trialing)
 *   2. trial ending     — ~3 days before the first charge (customer.subscription.trial_will_end)
 *   3. payment failed    — first renewal failure (invoice.payment_failed)
 *   4. payment recovered — a failed payment succeeded (invoice.payment_succeeded)
 *
 * They render through the shared brand chrome (`renderBrandEmail`) and send from
 * noreply@, exactly like the F2 account emails. Copy signed off with the owner.
 * Body-formatting helpers live in `./format` (shared with accountEmails.ts).
 *
 * These are SYSTEM-triggered (no browser at send time), so dates use relative
 * phrasing ("soon" / "a few days beforehand") per docs/coding-standards.md §16 —
 * never a device date. (Relative wording also keeps the trial-ending copy correct on
 * the reactivation gap-fill path, where the exact days-remaining can vary.)
 * Each caller passes a Resend `idempotencyKey` (the Stripe event id) so a
 * re-processed webhook can never send the same customer two copies.
 */

// Stripe → Revenue recovery → Retries. Confirmed ON in the dashboard during Step 8
// Part C (Stripe's default). If it's ever turned off, flip this to drop the
// "we'll automatically retry" line so the email never over-promises.
const SMART_RETRIES_ENABLED = true;

type BillingCurrency = keyof typeof PRICE_TABLE; // 'usd' | 'aud' | 'cad'

/**
 * Turn a stored `subscription_currency` + `subscription_plan` into display strings:
 *   { amount: "A$19", rate: "A$19/month" }  (annual → "A$159" / "A$159/year")
 * Returns null when either is missing/unrecognised, so callers fall back to a
 * generic phrase rather than showing a wrong or blank price.
 */
function priceParts(
  currency: string | null,
  plan: string | null,
): { amount: string; rate: string } | null {
  if (!currency || !plan) return null;
  const cur = currency.toLowerCase();
  if (!(cur in PRICE_TABLE)) return null;
  if (plan !== 'monthly' && plan !== 'annual') return null;
  const c = cur as BillingCurrency;
  const amount = `${CURRENCY_SYMBOL[c]}${PRICE_TABLE[c][plan]}`;
  const period = plan === 'monthly' ? 'month' : 'year';
  return { amount, rate: `${amount}/${period}` };
}

/** A brand-styled inline link to the monitored contact form (never a reply — noreply@ is unmonitored). */
const contactLink = `<a href="${SITE}/contact" style="color:#1E5CB3;text-decoration:underline;">majorcycle.com/contact</a>`;

/** Email #1 — welcome the moment a free trial begins (fired once, on subscription create). */
export async function sendTrialStartedEmail(opts: {
  to: string;
  name: string | null;
  currency: string | null;
  plan: string | null;
  idempotencyKey?: string;
}): Promise<boolean> {
  const parts = priceParts(opts.currency, opts.plan);
  const rateHtml = parts ? `<strong>${parts.rate}</strong>` : 'your regular subscription rate';
  const rateText = parts ? parts.rate : 'your regular subscription rate';
  const days = `${TRIAL_PERIOD_DAYS}-day`;

  const bodyHtml = [
    greetingHtml(opts.name),
    p(
      `Welcome to MajorCycle — your <strong>${days} free trial</strong> is now active, with full ` +
        `access to everything your plan includes.`,
    ),
    p(
      `When the trial ends, your subscription continues automatically at ${rateHtml}, billed to the ` +
        `card on file. We'll send a reminder a few days beforehand, so the first charge is never a surprise.`,
    ),
    p(
      `You can change your plan or cancel anytime from your account — cancel before the trial ends and ` +
        `you won't be charged a cent.`,
    ),
    button('Start exploring', `${SITE}/results`),
    muted(`Questions? Get in touch anytime at ${contactLink}.`),
  ].join('\n');

  const text =
    `${greetingText(opts.name)}\n\n` +
    `Welcome to MajorCycle — your ${days} free trial is now active, with full access to everything ` +
    `your plan includes.\n\n` +
    `When the trial ends, your subscription continues automatically at ${rateText}, billed to the ` +
    `card on file. We'll send a reminder a few days beforehand, so the first charge is never a ` +
    `surprise.\n\n` +
    `You can change your plan or cancel anytime from your account — cancel before the trial ends and ` +
    `you won't be charged a cent: ${SITE}/account\n\n` +
    `Start exploring: ${SITE}/results\n\n` +
    `Questions? Get in touch anytime at ${SITE}/contact`;

  return sendBrandEmail({
    to: opts.to,
    subject: 'Welcome to MajorCycle — your free trial has started',
    heading: 'Your free trial has started',
    bodyHtml,
    preheader: `Your ${days} free trial is active — full access, cancel anytime before it ends.`,
    text,
    idempotencyKey: opts.idempotencyKey,
  });
}

/** Email #2 — trial ending reminder, ~3 days before the first charge. */
export async function sendTrialEndingEmail(opts: {
  to: string;
  name: string | null;
  currency: string | null;
  plan: string | null;
  idempotencyKey?: string;
}): Promise<boolean> {
  const parts = priceParts(opts.currency, opts.plan);
  const rateHtml = parts ? `<strong>${parts.rate}</strong>` : 'your regular subscription rate';
  const rateText = parts ? parts.rate : 'your regular subscription rate';

  const bodyHtml = [
    greetingHtml(opts.name),
    p(
      `Your MajorCycle free trial ends soon. After it ends, your subscription will ` +
        `continue automatically at ${rateHtml}, billed to the card on file.`,
    ),
    p(
      `If you'd like to change your plan or cancel, you can do that anytime before then from your ` +
        `account — you won't be charged if you cancel before the trial ends.`,
    ),
    button('Manage your subscription', `${SITE}/account`),
    muted(`Need help? Get in touch anytime at ${contactLink}.`),
  ].join('\n');

  const text =
    `${greetingText(opts.name)}\n\n` +
    `Your MajorCycle free trial ends soon. After it ends, your subscription will continue ` +
    `automatically at ${rateText}, billed to the card on file.\n\n` +
    `If you'd like to change your plan or cancel, you can do that anytime before then from your ` +
    `account — you won't be charged if you cancel before the trial ends: ${SITE}/account\n\n` +
    `Need help? Get in touch anytime at ${SITE}/contact`;

  return sendBrandEmail({
    to: opts.to,
    subject: 'Your MajorCycle free trial ends soon',
    heading: 'Trial ending soon',
    bodyHtml,
    preheader: 'Your free trial ends soon — after that your subscription begins.',
    text,
    idempotencyKey: opts.idempotencyKey,
  });
}

/** Email #3 — first failed renewal payment; nudge to update the card within the grace window. */
export async function sendPaymentFailedEmail(opts: {
  to: string;
  name: string | null;
  currency: string | null;
  plan: string | null;
  graceDays: number;
  idempotencyKey?: string;
}): Promise<boolean> {
  const parts = priceParts(opts.currency, opts.plan);
  const amountHtml = parts ? `<strong>${parts.amount}</strong>` : 'your latest subscription payment';
  const amountText = parts ? parts.amount : 'your latest subscription payment';
  const days = `${opts.graceDays} day${opts.graceDays === 1 ? '' : 's'}`;
  const retryHtml = SMART_RETRIES_ENABLED ? ` We'll automatically retry in the meantime.` : '';
  const retryText = SMART_RETRIES_ENABLED ? ` We'll automatically retry in the meantime.` : '';

  const bodyHtml = [
    greetingHtml(opts.name),
    p(
      `We tried to process ${parts ? `your latest MajorCycle payment of ${amountHtml}` : amountHtml}, ` +
        `but it didn't go through — usually this is an expired or declined card.`,
    ),
    p(
      `Please update your payment details within the next <strong>${days}</strong> to keep your ` +
        `access.${retryHtml}`,
    ),
    button('Update your card', `${SITE}/account`),
    muted(`If you've already updated your card, you can ignore this message.`),
  ].join('\n');

  const text =
    `${greetingText(opts.name)}\n\n` +
    `We tried to process ${parts ? `your latest MajorCycle payment of ${amountText}` : amountText}, but ` +
    `it didn't go through — usually this is an expired or declined card.\n\n` +
    `Please update your payment details within the next ${days} to keep your access.${retryText} ` +
    `Update your card here: ${SITE}/account\n\n` +
    `If you've already updated your card, you can ignore this message.`;

  return sendBrandEmail({
    to: opts.to,
    subject: "Action needed: your MajorCycle payment didn't go through",
    heading: 'Payment failed',
    bodyHtml,
    preheader: 'Update your card to keep your MajorCycle access.',
    text,
    idempotencyKey: opts.idempotencyKey,
  });
}

/** Email #4 — a previously failed payment has now succeeded; all good. */
export async function sendPaymentRecoveredEmail(opts: {
  to: string;
  name: string | null;
  idempotencyKey?: string;
}): Promise<boolean> {
  const bodyHtml = [
    greetingHtml(opts.name),
    p(
      `Good news — your MajorCycle payment went through and your access continues uninterrupted. ` +
        `Thanks for being a member.`,
    ),
    button('Go to your account', `${SITE}/account`),
    muted(`No action needed — we just wanted to let you know.`),
  ].join('\n');

  const text =
    `${greetingText(opts.name)}\n\n` +
    `Good news — your MajorCycle payment went through and your access continues uninterrupted. ` +
    `Thanks for being a member.\n\n` +
    `Go to your account: ${SITE}/account\n\n` +
    `No action needed — we just wanted to let you know.`;

  return sendBrandEmail({
    to: opts.to,
    subject: "You're all set — payment received",
    heading: 'Payment received',
    bodyHtml,
    preheader: 'Your MajorCycle payment went through.',
    text,
    idempotencyKey: opts.idempotencyKey,
  });
}
