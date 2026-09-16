import * as Sentry from '@sentry/nextjs';

import { ALERT_TAG } from './sentryOptions';
import { redactSensitive } from './redact';

/**
 * The one place an operational failure is announced — H2, 2026-09-16.
 *
 * ── THE PROBLEM THIS SOLVES ──────────────────────────────────────────────────
 * Every failure in this product is already handled correctly in code and then
 * announced to a `console.error` nobody reads. The worst of them is
 * `billing sync: DUPLICATE SUBSCRIPTION`: the guard cancels the duplicate, and
 * **cancelling does not refund**, so a customer who has been charged twice stays
 * charged twice until a human opens the Stripe Dashboard. Nobody currently finds
 * out. The roadmap's H2 row names five more of the same shape.
 *
 * ── WHY A FUNCTION RATHER THAN SIX SENTRY CALLS ──────────────────────────────
 * Because the alternative is six message strings restated inside somebody else's
 * dashboard, and that is 11c-v exactly: a rule written twice drifts, and the copy
 * that lives in a third party's UI is invisible to every tool we own — no type
 * checker, no grep, no gate. Reword a log line and the alert silently stops
 * matching; nothing errors, nothing looks stale, and the first sign is a failure
 * nobody was told about, which is the situation H2 exists to end.
 *
 * So the CODE declares which failures deserve waking someone, as a tag, and the
 * alert rule keys on the tag. One rule in Sentry —
 *
 *     the event's tags match  mc.alert  equals  yes
 *
 * — covers all six and every future one, and it cannot drift, because there is
 * nothing on Sentry's side to keep in step.
 *
 * ── THE CONSOLE LINE STAYS ───────────────────────────────────────────────────
 * ⚠️ This writes to `console.error` AS WELL, always, including when the DSN is
 * unset. Not belt-and-braces — the Vercel function log is the instrument the owner
 * already knows how to read, it works when Sentry is down, an ad blocker cannot
 * remove it, and it is the only one that exists on a local run. Replacing a log
 * line with a third-party call would be trading an instrument we control for one
 * we do not. `e2e/observability.spec.ts` asserts this in both directions.
 */

/**
 * How loud a failure is.
 *
 * - `alert`  — a human must act, and the product cannot fix itself. A customer has
 *              been charged and not provisioned; a duplicate has been cancelled and
 *              not refunded; the anti-scraping fence has stopped counting. These
 *              carry the tag one alert rule watches.
 * - `error`  — something broke and was handled. Worth seeing in a list, not worth
 *              an email at 3am.
 * - `warning` — a degradation. Recorded so a pattern is visible.
 */
export type IssueLevel = 'alert' | 'error' | 'warning';

/** What Sentry calls the three levels above. `alert` is an error plus a tag. */
const SENTRY_LEVEL: Record<IssueLevel, 'error' | 'warning'> = {
  alert: 'error',
  error: 'error',
  warning: 'warning',
};

/**
 * The value of `mc.alert` for a level — the single fact the whole alerting rule
 * rests on.
 *
 * ⚠️ **Exported ONLY so a test can drive it, and that is not ceremony.** The first
 * version of the guard asserted the distribution of `level: 'alert'` across the
 * SOURCE, which sounds like the same claim and is not: a reporter that tagged every
 * event `yes` — one character's difference here — left every source count untouched
 * and passed. Found by breaking it on purpose (11p), and it is the same shape as
 * every other finding in this repo: the guard was watching a proxy for the thing
 * rather than the thing. A function can be called; a count of literals cannot.
 */
export function alertTagValue(level: IssueLevel): 'yes' | 'no' {
  return level === 'alert' ? 'yes' : 'no';
}

export type IssueOptions = {
  /** The thrown value, when there is one. A stack is worth more than a sentence. */
  cause?: unknown;
  /** Defaults to `error`. Use `alert` only when a human must do something. */
  level?: IssueLevel;
  /**
   * Identifiers that make the failure actionable — a user id, a Stripe object id, a
   * ticker.
   *
   * ⚠️ **Values here are SEARCHABLE and are kept for the life of the event, so they
   * take opaque ids and never a person.** An email address would be masked by
   * `scrub()` on its way out, which is a backstop rather than a licence: the rule is
   * that nothing personal is put in, and the masking is there for what somebody
   * else's error message brings with it.
   */
  tags?: Record<string, string | number | undefined | null>;
};

/**
 * ⚠️ `String(value)` CAN THROW — an object whose `toString` throws, a `Symbol`, a
 * `Proxy` that rejects reads — and every caller of this module is already on a
 * failure path. A reporter that throws there turns a *handled* failure into an
 * unhandled one, which is strictly worse than having no monitoring at all: the
 * customer gets an error page instead of a degraded one, and the cause is the
 * telemetry. So each value is coerced on its own and a bad one becomes a note
 * rather than an exception.
 */
function safely(produce: () => string): string {
  try {
    return produce();
  } catch {
    return '[unprintable]';
  }
}

function tagStrings(tags: IssueOptions['tags']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags ?? {})) {
    if (value === undefined || value === null) continue;
    out[key] = safely(() => redactSensitive(String(value)));
  }
  return out;
}

/**
 * Announce an operational failure: to the Vercel log always, and to Sentry when a
 * DSN is configured.
 *
 * `message` is a fixed literal we write, so it groups in Sentry and stays greppable
 * here. Everything that varies goes in `tags`.
 */
export function reportIssue(message: string, options: IssueOptions = {}): void {
  const { cause, level = 'error', tags } = options;
  const flat = tagStrings(tags);
  const suffix = Object.entries(flat)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  const line = redactSensitive(suffix ? `${message} — ${suffix}` : message);

  // ⚠️ The cause goes to the console as a REDACTED STRING, not as the object.
  // `console.error(line, err)` — which is what every call site did before this
  // module existed — prints whatever the provider put in `err.message`, and a
  // Vercel log is not a safe place for a token somebody else echoed back at us.
  // `err.stack` already begins with the message, so nothing diagnostic is lost;
  // what is lost is the console's object expansion, which for an Error is the same
  // text anyway. The Sentry side keeps the real Error — `scrub()` masks the
  // serialised event, so the stack survives with the frames intact.
  const printable =
    cause === undefined
      ? ''
      : safely(() =>
          redactSensitive(cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)),
        );

  if (level === 'warning') console.warn(line, printable);
  else console.error(line, printable);

  // ⚠️ Never let telemetry break the thing it is watching. Every caller is already
  // on a failure path; a throw from here would turn a handled failure into an
  // unhandled one, which is strictly worse than having no monitoring at all.
  try {
    Sentry.withScope((scope) => {
      scope.setLevel(SENTRY_LEVEL[level]);
      scope.setTags({ ...flat, [ALERT_TAG]: alertTagValue(level) });
      // ⚠️ Group by OUR sentence, not by the thrown message. A provider's wording
      // changes under us — 11g is this repo's record of Supabase rewording an error
      // and a `includes()` silently ceasing to match — and without this a reworded
      // upstream message splits one recurring failure into two issues in Sentry,
      // each below whatever threshold an alert rule uses. A fingerprint says which
      // failure this IS; the stack still says where.
      scope.setFingerprint([message]);
      scope.setContext('majorcycle', { event: message });
      if (cause instanceof Error) {
        // ⚠️ NOT `cause.message = …`. The caller still owns this object — several of
        // them log it afterwards or re-throw it — and a reporter that edits its
        // argument is a side effect nobody reading the call site can see.
        Sentry.captureException(cause);
      } else {
        if (cause !== undefined) {
          scope.setExtra('cause', safely(() => redactSensitive(String(cause))));
        }
        Sentry.captureMessage(message);
      }
    });
  } catch {
    // Deliberately silent. If the reporter cannot report, the console line above has
    // already carried the failure to the log the owner actually reads.
  }
}

/**
 * Leave a trail on the scope without raising an alarm.
 *
 * The one use today is the `CYCLE_INTERNAL_SECRET` mismatch: `/api/cycle` answers
 * 401, `lib/cycle.ts` returns `null`, and every Stock Detail page renders **200 with
 * empty cycle sections** — the whole paid analysis silently absent from a page that
 * looks finished. It is not an exception, so nothing would ever be captured; it is
 * the fact that explains the next thing that IS.
 */
export function addBreadcrumb(message: string, data?: Record<string, string | number>): void {
  try {
    Sentry.addBreadcrumb({ category: 'majorcycle', level: 'warning', message, data });
  } catch {
    // See above: telemetry never throws into a caller.
  }
}
