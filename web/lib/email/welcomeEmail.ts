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
 * Copy rewritten 2026-11-27 at the owner's request to sound like a person rather than
 * a catalogue: titles and reading times only (the registry's summaries are written for
 * the Learn index), plain sentences, no slogan at the end.
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

type Article = (typeof LEARN_ARTICLES)[number];

/** Pure: the email's content. Rendered by e2e/email-render.spec.ts without sending anything. */
export function buildWelcomeEmail(name: string | null): WelcomeEmail {
  const isStart = (a: Article) => (WELCOME_START_HERE as readonly string[]).includes(a.slug);
  const start = LEARN_ARTICLES.filter(isStart);
  const ideas = LEARN_ARTICLES.filter((a) => !isStart(a));
  const url = (slug: string) => `${SITE}${learnPath(slug)}`;
  const days = `${TRIAL_PERIOD_DAYS} days`;
  const mins = (a: Article) => `${a.minutes} min`;

  const intro = 'Welcome to MajorCycle, and thanks for signing up.';
  const startLead =
    "If you're not sure where to begin, start with these two. They explain what a rating means and what it doesn't:";
  const ideasLead =
    'After that, each of these covers one idea behind the ratings. Read them in any order, whenever you have a few minutes:';
  const trial = `When you're ready to see the full ratings, the Verdict and the screener, you can try everything free for ${days}.`;
  const closing = "This is the only welcome email we'll send. If you have a question, you can reach us at";

  const item = (a: Article) =>
    `<li style="margin:0 0 8px;">${link(url(a.slug), a.title)} <span style="color:#64748b;">(${mins(a)})</span></li>`;
  const list = (items: string[]) =>
    `<ul style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.6;color:#0f1923;">${items.join('')}</ul>`;

  const bodyHtml = [
    greetingHtml(name),
    p(intro),
    p(escapeHtml(startLead)),
    list(start.map(item)),
    p(ideasLead),
    list(ideas.map(item)),
    p(escapeHtml(trial)),
    button('Start my free trial', `${SITE}/account`),
    muted(`${escapeHtml(closing)} ${link(`${SITE}/contact`, 'majorcycle.com/contact')}.`),
  ].join('\n');

  const textItem = (a: Article) => `- ${a.title} (${mins(a)})\n  ${url(a.slug)}`;
  const text = [
    greetingText(name),
    intro,
    startLead,
    start.map(textItem).join('\n'),
    ideasLead,
    ideas.map(textItem).join('\n'),
    `${trial.slice(0, -1)}: ${SITE}/account`,
    `${closing} ${SITE}/contact`,
    // The HTML footer (renderBrandEmail) carries this line; the plain-text copy has no footer.
    'MajorCycle is educational information only, not financial advice.',
  ].join('\n\n');

  return {
    subject: 'Welcome to MajorCycle: where to start',
    heading: 'Welcome to MajorCycle',
    preheader: 'Two short reads to start with, and a few more for when you have time.',
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
