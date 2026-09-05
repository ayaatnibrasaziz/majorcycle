import { test, expect } from '@playwright/test';
import {
  sendTrialStartedEmail,
  sendTrialEndingEmail,
  sendPaymentFailedEmail,
  sendPaymentRecoveredEmail,
} from '@/lib/email/billingEmails';
import { sendDeletionScheduledEmail, sendAccountDeletedEmail } from '@/lib/email/accountEmails';
import { sendReferralEmail } from '@/lib/email/referralEmails';
import { sendContact } from '@/app/(public)/contact/actions';
import { CURRENCY_SYMBOL, PRICE_TABLE } from '@/lib/pricing';
import { TRIAL_PERIOD_DAYS } from '@/lib/stripe';

/**
 * Every transactional email, rendered.
 *
 * ── Why this suite exists (audit P6, 2026-09-05) ────────────────────────────
 * Seven emails, live since Layer F, and **not one test of any kind**. They are the
 * only part of this product that reaches a customer with no browser, no console
 * and no screen for anyone to look at — so a defect in one is silent by
 * construction, and stays silent until a real person receives it.
 *
 * ⚠️ **I first wrote here that only one email had ever been sent, from Resend's
 * API log, and concluded no defect had reached anybody. That was wrong.** The
 * owner's actual inbox holds the trial-started, trial-ending, payment-failed,
 * payment-recovered and referral emails, really delivered on 24 and 31 July —
 * `/results` link and all. Resend's `/emails` listing simply does not return them.
 * **An instrument's silence is not the absence of the thing** (14g), and the
 * cheap correction was to look in the inbox the emails were sent to.
 *
 * Rendering all seven for the first time found two, both invisible to review:
 *
 *   5A-136 🔴 The trial-welcome email's **plain-text** half sent a brand-new
 *   subscriber to `/results`, which is empty until a screen has been run. The
 *   HTML button had been moved to `/stocks` for exactly that reason, and the
 *   comment above it says so — the fix reached one of the two copies. **Every
 *   email in this codebase is written twice**, once as HTML and once as text, and
 *   nothing compared them (CLAUDE.md 11c: one rule, one place).
 *
 *   5A-137 🟡 Every footer read *"© MajorCycle provides educational information
 *   only"* — a copyright symbol glued to a sentence that is not a copyright
 *   notice, with no year.
 *
 * ── How it renders without sending ─────────────────────────────────────────
 * The senders POST to Resend. `fetch` is replaced for the duration, so the real
 * body is captured and nothing leaves the machine. **No credential is involved:**
 * `RESEND_API_KEY` is set to an obviously invented string, because a test holding
 * the real one becomes a live send the day somebody loosens the stub — the same
 * rule as `purge-cron.spec.ts` and its invented `CRON_SECRET`.
 *
 * ⚠️ **What this cannot see** (14g). The Supabase **auth** templates — confirm
 * signup, reset password, magic link, email change — are not in this repo. They
 * live in the Supabase project's own configuration, and neither the Supabase
 * connector (which has no tool for them) nor Resend's API log (an SMTP relay does
 * not appear there) can read them. They are checked by hand, by triggering a real
 * one to a real inbox. Saying which half a guard covers is the whole point of 14g.
 *
 * Pure: no browser, no network, no credentials.
 */

interface Captured {
  subject: string;
  html: string;
  text: string;
}

const NAMES = [
  'trialStarted',
  'trialEnding',
  'paymentFailed',
  'paymentRecovered',
  'deletionScheduled',
  'accountDeleted',
  'referral',
] as const;

type MailName = (typeof NAMES)[number];

async function renderAll(): Promise<Record<MailName, Captured>> {
  process.env.RESEND_API_KEY = 'not-a-real-key-see-the-header-of-this-file';
  const seen: Captured[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init: { body?: string }) => {
    seen.push(JSON.parse(init.body ?? '{}') as Captured);
    return { ok: true, status: 200, text: async () => '' } as unknown as Response;
  }) as typeof fetch;

  try {
    await sendTrialStartedEmail({ to: 'x@example.com', name: 'Ayaat', currency: 'aud', plan: 'monthly' });
    await sendTrialEndingEmail({ to: 'x@example.com', name: null, currency: 'usd', plan: 'annual' });
    await sendPaymentFailedEmail({
      to: 'x@example.com', name: 'Ayaat', currency: 'cad', plan: 'monthly', graceDays: 3,
    });
    await sendPaymentRecoveredEmail({ to: 'x@example.com', name: 'Ayaat' });
    await sendDeletionScheduledEmail({
      to: 'x@example.com',
      name: 'Ayaat',
      deletionDate: new Date('2026-10-05T00:00:00Z'),
      subscriptionKind: 'paid',
      timeZone: 'Australia/Sydney',
    });
    await sendAccountDeletedEmail({ to: 'x@example.com', name: 'Ayaat' });
    await sendReferralEmail({ to: 'friend@example.com', referrerName: 'Ayaat', message: 'Have a look' });
  } finally {
    globalThis.fetch = realFetch;
  }

  const byName = {} as Record<MailName, Captured>;
  seen.forEach((c, i) => {
    const n = NAMES[i];
    if (n) byName[n] = c;
  });
  return byName;
}

/** The path of every destination an email points a reader at, deduplicated. */
function paths(body: string): string[] {
  const urls = [...body.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0].replace(/[.,]$/, ''));
  return [...new Set(urls.map((u) => new URL(u).pathname))]
    .filter((p) => p !== '/email-icon.png')
    .sort();
}

test.describe('every transactional email renders, and says the same thing twice', () => {
  test('all seven render, in both formats, with nothing unresolved', async () => {
    const mail = await renderAll();
    // Control: a stub that captured nothing would report what a clean run reports.
    expect(Object.keys(mail), 'not every email rendered').toHaveLength(7);

    for (const [name, m] of Object.entries(mail)) {
      expect(m.subject, `${name}: no subject`).toBeTruthy();
      expect(m.html.length, `${name}: html body too short to be real`).toBeGreaterThan(800);
      expect(m.text.length, `${name}: text body too short to be real`).toBeGreaterThan(120);
      expect(m.html, `${name}: not wrapped in the brand chrome`).toContain('MajorCycle');
      // Compliance floor (#4 / #12): the footer disclaimer must survive.
      expect(m.html, `${name}: lost the "not financial advice" line`).toMatch(/not financial advice/i);
      // A template that failed to interpolate still renders as a plausible email.
      expect(m.html, `${name}: an unresolved value reached the reader`)
        .not.toMatch(/undefined|NaN|\[object/);
      expect(m.text, `${name}: an unresolved value reached the reader`)
        .not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('the HTML and plain-text halves send the reader to the same places', async () => {
    const mail = await renderAll();
    // THE 5A-136 GUARD. The text body is a hand-written second copy of the same
    // message; when a link moves, only one of the two tends to move with it.
    //
    // ⚠️ Text may name MORE paths than HTML, and that is correct rather than a
    // miss: HTML can hang a link on the words "your account", where plain text has
    // to spell the URL out. So the assertion runs one way — every destination the
    // HTML offers must also appear in the text — which is the direction the defect
    // actually ran. A two-way check would fail on correct emails and be loosened.
    for (const [name, m] of Object.entries(mail)) {
      const htmlPaths = paths(m.html);
      const textPaths = paths(m.text);
      expect(htmlPaths.length, `${name}: no links found — the extractor is broken`).toBeGreaterThan(0);
      const missing = htmlPaths.filter((p) => !textPaths.includes(p));
      expect(missing, `${name}: the plain-text half does not offer ${missing.join(', ')}`).toEqual([]);
    }
  });

  test('the welcome email sends a new subscriber somewhere that has content', async () => {
    // Named as well as mechanical: HTML and text agreeing on /results would
    // satisfy the parity check perfectly and still be the original defect.
    const { trialStarted } = await renderAll();
    expect(paths(trialStarted.html)).toContain('/stocks');
    expect(trialStarted.html, 'back on /results — empty until a screen has been run')
      .not.toContain('/results');
    expect(trialStarted.text, 'back on /results — empty until a screen has been run')
      .not.toContain('/results');
  });

  test('every email carries the ONE footer, and it is not the run-on sentence', async () => {
    // Audit 5A-137, widened by 5A-147. The same sentence exists in 13 Supabase auth
    // templates that no test here can reach, so the string must be identical rather
    // than merely correct — see the note on renderBrandEmail for why it has no year.
    const mail = await renderAll();
    const FOOTER = '&copy; MajorCycle &middot; Educational information only &mdash; not financial advice.';
    for (const [name, m] of Object.entries(mail)) {
      expect(m.html, `${name}: not on the shared footer`).toContain(FOOTER);
      expect(m.html, `${name}: the run-on footer is back`).not.toContain('&copy; MajorCycle provides');
      expect(m.html, `${name}: the other old variant is back`)
        .not.toContain('&copy; MajorCycle &mdash; Information only');
    }
  });

  test('numbers in the copy come from the real constants, not from prose', async () => {
    // CLAUDE.md 11c-v: a sentence stating a constant IS a copy of that constant.
    // Built FROM the constant, with an off-by-one control proving the match is
    // value-sensitive rather than merely finding a digit somewhere in the body.
    const { trialStarted, paymentFailed } = await renderAll();
    expect(trialStarted.html).toContain(`${TRIAL_PERIOD_DAYS}-day`);
    expect(trialStarted.html).not.toContain(`${TRIAL_PERIOD_DAYS + 1}-day`);
    expect(paymentFailed.text, 'the grace period is wrong or missing').toContain('3 days');
    // And the sticker is the real PRICE_TABLE value for the currency the caller
    // passed. BUILT from the table rather than restated: my first draft typed
    // `CA$` from memory and went red on a correct email, because the subscription
    // symbol is `C$` (`CURRENCY_SYMBOL` in lib/pricing.ts, the same map /pricing
    // renders from). A guard that restates the value it is guarding is a fourth
    // copy of it (CLAUDE.md 11c-iii), and it fails on the code rather than on the
    // defect.
    expect(trialStarted.text, 'AUD monthly sticker wrong or missing')
      .toContain(`${CURRENCY_SYMBOL.aud}${PRICE_TABLE.aud.monthly}/month`);
    expect(paymentFailed.text, 'CAD sticker wrong or missing')
      .toContain(`${CURRENCY_SYMBOL.cad}${PRICE_TABLE.cad.monthly}`);
    // The control: an off-by-one must NOT be found, or the two assertions above
    // would pass on any body containing a currency symbol and some digits.
    expect(trialStarted.text)
      .not.toContain(`${CURRENCY_SYMBOL.aud}${PRICE_TABLE.aud.monthly + 1}/month`);
  });
});

test.describe('the contact form cannot put markup or an unbounded value in an email', () => {
  /** Drive the real server action with a stubbed transport and keep the payload. */
  async function send(fields: Record<string, string>) {
    process.env.RESEND_API_KEY = 'not-a-real-key-see-the-header-of-this-file';
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    // Captured in an object, not a bare `let`. A `let x: T | null = null` written
    // to only inside a callback narrows to `never` under tsc, so every read of it
    // is a type error — and Playwright's own transpile does NOT catch that, so
    // the spec passed while `pnpm typecheck` failed (CLAUDE.md 11aq: a spec
    // passing is not the same as the repo compiling).
    const box: { sent: Captured | null } = { sent: null };
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_u: unknown, init: { body?: string }) => {
      box.sent = JSON.parse(init.body ?? '{}') as Captured;
      return { ok: true, status: 200, text: async () => '' } as unknown as Response;
    }) as typeof fetch;
    try {
      const result = await sendContact({ status: 'idle' }, fd);
      return { result, sent: box.sent };
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  test('a name full of markup arrives as text, in the body AND the preheader', async () => {
    // THE 5A-142 GUARD. The body was escaped and the preheader was not, so a
    // name could inject arbitrary HTML - a link, most usefully - into a message
    // arriving from support@majorcycle.com. `referralEmails.ts` had it right and
    // this caller never received the rule (CLAUDE.md 11c-iv).
    const evil = 'Ayaat</div><a href="https://evil.example">Click here</a><div>';
    const { result, sent } = await send({
      name: evil,
      email: 'a@example.com',
      message: 'A message long enough to pass validation.',
    });
    expect(result.status, 'the send did not happen - nothing below means anything').toBe('success');
    expect(sent, 'no payload captured').toBeTruthy();
    expect(sent!.html, 'raw markup reached the email').not.toContain('<a href="https://evil.example"');
    expect(sent!.html, 'the closing div escaped').not.toContain('Ayaat</div>');
    // The control: the name must still BE there, escaped. "Strip everything"
    // would satisfy both assertions above and destroy the feature.
    expect(sent!.html, 'the name vanished instead of being escaped').toContain('&lt;a href');
    expect(sent!.html.match(/&lt;a href/g)!.length, 'escaped in only one of the two places')
      .toBeGreaterThanOrEqual(2);
  });

  test('an unbounded field is capped before it reaches a header', async () => {
    // THE 5A-143 GUARD. There was no upper bound on the client or the server.
    const { result, sent } = await send({
      name: 'A'.repeat(5000),
      email: 'a@example.com',
      message: 'B'.repeat(50_000),
    });
    expect(result.status).toBe('success');
    expect(sent!.subject.length, 'the subject is unbounded').toBeLessThan(140);
    expect(sent!.text.length, 'the body is unbounded').toBeLessThan(6000);
  });

  test('a newline in the name cannot reach the subject line', async () => {
    // Defence in depth, and labelled as such: `name` reaches Resend as a JSON
    // string and Resend encodes the header, so no injection was demonstrated.
    // `trim()` does not touch an INTERIOR newline, which is why this is checked
    // rather than assumed.
    const { sent } = await send({
      name: 'Ayaat\nBcc: someone@example.com',
      email: 'a@example.com',
      message: 'A message long enough to pass validation.',
    });
    expect(sent!.subject).not.toContain('\n');
    expect(sent!.subject, 'the name was dropped rather than flattened').toContain('Ayaat');
  });

  test('a message too short is still refused, and sends nothing', async () => {
    // The control for the whole describe: validation must not have been widened
    // by the bounds work. "Accept everything" would pass every test above.
    const { result, sent } = await send({ name: 'Ayaat', email: 'a@example.com', message: 'hi' });
    expect(result.status).toBe('error');
    expect(sent, 'a refused message was still sent').toBeNull();
  });
});
