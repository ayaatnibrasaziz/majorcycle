import { sendBrandEmail } from '@/lib/email/send';
import { SITE, escapeHtml, p, muted, button, greetingHtml, greetingText } from '@/lib/email/format';
import { LEARN_ARTICLES, learnPath } from '@/lib/learn';
import { TRIAL_PERIOD_DAYS } from '@/lib/stripe';

/**
 * The ONE welcome email (owner decision 2026-11-27): sent once, the day after a
 * reader's first sign-in, pointing them at the Learn library so they know how to use
 * the product and what its ideas mean — then one button to try the full ratings.
 *
 * ⚠️ The article list is READ from `LEARN_ARTICLES`, never typed here. A Learn piece
 * added, renamed or retired changes this email with it (11c: a second list drifts).
 * The two "start here" pieces are named by slug; if either slug ever disappears the
 * email simply lists every article under the other heading.
 *
 * Owner, 2026-11-27: keep this first version of the copy; only the trial sentence
 * (`TRIAL_LINE`) was rewritten (a second, shorter draft was tried and rejected).
 *
 * Triggered by `acknowledgeDisclaimer` — the write-once first-login record — so it can
 * only be scheduled once per account. The Resend idempotency key is the user id as a
 * second guard. noreply@ is unmonitored, so the email invites questions through
 * /contact, never a reply.
 */

export const WELCOME_START_HERE = ['how-to-read-a-majorcycle-rating', 'what-majorcycle-doesnt-do'] as const;

/** Sent this long after the first sign-in, so it never lands on top of the confirmation email. */
export const WELCOME_DELAY_HOURS = 24;

const link = (href: string, label: string) =>
  `<a href="${href}" style="color:#1E5CB3;text-decoration:underline;">${escapeHtml(label)}</a>`;

export interface WelcomeEmail {
  subject: string;
  heading: string;
  preheader: string;
  bodyHtml: string;
  text: string;
}

/** Pure: the email's content. Rendered by e2e/email-render.spec.ts without sending anything. */
export function buildWelcomeEmail(name: string | null): WelcomeEmail {
  const start = LEARN_ARTICLES.filter((a) => (WELCOME_START_HERE as readonly string[]).includes(a.slug));
  const ideas = LEARN_ARTICLES.filter((a) => !(WELCOME_START_HERE as readonly string[]).includes(a.slug));
  const url = (slug: string) => `${SITE}${learnPath(slug)}`;
  const days = `${TRIAL_PERIOD_DAYS} days`;
  const TRIAL_LINE = `Once you're ready, you can see a stock's full rating and Verdict, and run the screener across a whole market. Try it free for ${days}`;

  const item = (a: (typeof LEARN_ARTICLES)[number]) =>
    `<li style="margin:0 0 8px;">${link(url(a.slug), a.title)} — ${escapeHtml(a.summary)}</li>`;
  const list = (items: string[]) =>
    `<ul style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.6;color:#0f1923;">${items.join('')}</ul>`;

  const bodyHtml = [
    greetingHtml(name),
    p(
      'Thanks for joining MajorCycle. Here is the short version of how to get the most out of it, ' +
        'and where to read more when you want the detail.',
    ),
    p('<strong>Start here</strong>'),
    list(start.map(item)),
    p('<strong>The ideas behind the ratings</strong>'),
    list(ideas.map(item)),
    // The one line rewritten at the owner's request (2026-11-27: the first version's
    // trial sentence "sounded AI"). Everything else is the first version's copy.
    p(`${TRIAL_LINE}.`),
    button(`Try it free for ${days}`, `${SITE}/account`),
    muted(
      `This is a one-off welcome email. MajorCycle is educational analysis, not financial advice. ` +
        `Questions? Get in touch at ${link(`${SITE}/contact`, 'majorcycle.com/contact')}.`,
    ),
  ].join('\n');

  const textItem = (a: (typeof LEARN_ARTICLES)[number]) => `- ${a.title} — ${a.summary}\n  ${url(a.slug)}`;
  const text =
    `${greetingText(name)}\n\n` +
    'Thanks for joining MajorCycle. Here is the short version of how to get the most out of it, ' +
    'and where to read more when you want the detail.\n\n' +
    `START HERE\n${start.map(textItem).join('\n')}\n\n` +
    `THE IDEAS BEHIND THE RATINGS\n${ideas.map(textItem).join('\n')}\n\n` +
    `${TRIAL_LINE}: ${SITE}/account\n\n` +
    `This is a one-off welcome email. MajorCycle is educational analysis, not financial advice. ` +
    `Questions? Get in touch at ${SITE}/contact`;

  return {
    subject: 'Welcome to MajorCycle — where to start',
    heading: 'Welcome to MajorCycle',
    preheader: 'How to read a rating, and the short articles that explain the ideas behind it.',
    bodyHtml,
    text,
  };
}

/** Reserved test domains (RFC 2606/6761): nothing real ever lives there. */
const RESERVED_DOMAIN = /@(?:[^@]+\.)?(?:example\.(?:com|net|org)|[^@]+\.(?:test|example|invalid|localhost))$/i;

/** Pure: may this deploy send the welcome email to this address? */
export function welcomeEmailAllowed(vercelEnv: string | undefined, to: string): boolean {
  return vercelEnv === 'production' && !RESERVED_DOMAIN.test(to.trim());
}

/** Schedule the welcome email for tomorrow. Never throws (sendBrandEmail does not). */
export async function sendWelcomeEmail(opts: {
  to: string;
  name: string | null;
  userId: string;
  now?: Date;
}): Promise<boolean> {
  // Production only. The e2e suite signs up throwaway `@example.com` accounts and
  // presses the first-login button; scheduling real mail to them from a dev server or
  // a preview would bounce, and bounces cost the sending domain its reputation.
  if (!welcomeEmailAllowed(process.env['VERCEL_ENV'], opts.to)) return false;
  const email = buildWelcomeEmail(opts.name);
  const when = new Date((opts.now ?? new Date()).getTime() + WELCOME_DELAY_HOURS * 3_600_000);
  return sendBrandEmail({
    to: opts.to,
    ...email,
    idempotencyKey: `welcome:${opts.userId}`,
    scheduledAt: when.toISOString(),
  });
}
