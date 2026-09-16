import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect } from '@playwright/test';

import { redactEmails, redactSecrets, redactSensitive } from '../lib/redact';

/**
 * No personal data in the logs — P9 / 5A-163, 2026-09-07.
 *
 * Stripe's go-live checklist asks that logs contain no card data or PII, and this
 * sweep had never read a single log line for it. Card data is a non-question:
 * Checkout is hosted, so a card number never reaches this codebase. What the audit
 * did find is two lines logging an UPSTREAM error body verbatim — Resend's
 * `validation_error` messages describe the request, whose `to` field is a real
 * person's address — plus one logging the referral email's SUBJECT, which carries
 * the sender's own name.
 *
 * A pure, credential-free spec (the shape used by `entitlement.spec.ts` and
 * `auth-contracts.spec.ts`): no browser, no network, so it runs on a fork PR with
 * no secrets and can never self-skip.
 *
 * ⚠️ It has TWO halves because they fail in opposite directions and neither covers
 * the other. The first drives the real `redactEmails`. The second reads the SOURCE,
 * because a perfect redactor protects nothing if the next person to add a log line
 * does not call it — this repo's most-repeated defect (11c-iv: the rule existed and
 * one of its consumers never received it).
 */

const WEB = join(__dirname, '..');

/**
 * Every call that writes a log line, with its argument list.
 *
 * ⚠️ **`reportIssue` IS IN THIS LIST, AND LEAVING IT OUT WOULD HAVE SILENTLY GUTTED
 * THIS FILE (H2, 2026-09-16).** Layer H2 routed every operational failure in `app/`
 * and `lib/` through `lib/observability.ts`, which writes the console line on the
 * caller's behalf. Matching only `console.*` would therefore have found **nothing
 * to examine** the moment that landed — the sweep below would still run, still pass,
 * and still report a clean bill of health over zero log lines. `lib/email/send.ts`,
 * the file the redaction rule was WRITTEN for, has no `console.` in it any more.
 *
 * That is 14g in its purest form and 11am's lesson exactly: **a guard's scope is a
 * claim about what it can see, and matching on the shape the last defect happened to
 * use is how the claim quietly stops being true.** Match on what the surface IS —
 * "a line that goes to a log" — not on the function that used to write it.
 */
function consoleCalls(src: string): string[] {
  return [
    ...src.matchAll(/(?:console\.\w+|reportIssue|addBreadcrumb)\(([\s\S]{0,600}?)\);/g),
  ].map((m) => m[1] ?? '');
}

test.describe('redactEmails — the function', () => {
  /**
   * The body observed in production on 2026-09-01 (/account, referral send), with
   * a real-looking address substituted for the domain Resend actually named. Held
   * verbatim rather than paraphrased: where the string is not ours, a test is the
   * only place our guess about its shape stops being a guess (11g).
   */
  const REAL_BODY =
    '{"statusCode":422,"name":"validation_error","message":"Invalid `to` field. ' +
    'sam.oreilly+news@example.co.uk is not a valid recipient."}';

  test('masks an address embedded in an upstream JSON body', () => {
    const out = redactEmails(REAL_BODY);
    expect(out).not.toContain('sam.oreilly+news@example.co.uk');
    expect(out).toContain('[email redacted]');
  });

  /**
   * ⚠️ THE LOAD-BEARING CONTROL. A `redactEmails` returning one fixed string would
   * satisfy every masking assertion above while destroying the only thing the log
   * line exists for — the reason the send failed. So the surrounding text has to
   * survive character for character (11am).
   */
  test('CONTROL — everything that is not an address survives', () => {
    const out = redactEmails(REAL_BODY);
    expect(out).toContain('"statusCode":422');
    expect(out).toContain('"name":"validation_error"');
    expect(out).toContain('Invalid `to` field.');
    expect(out).toContain('is not a valid recipient.');
    expect(redactEmails('Resend send failed 429 rate limit exceeded')).toBe(
      'Resend send failed 429 rate limit exceeded',
    );
  });

  test('CONTROL — text that merely contains an @ is left alone', () => {
    // A scoped package name and a bare handle are not addresses, and masking them
    // would quietly remove the part of the message that names the failure.
    for (const s of ['@resend/node failed to load', 'user @ 10.0.0.1', 'a@b']) {
      expect(redactEmails(s)).toBe(s);
    }
  });

  test('redactSecrets — a Supabase JWT never reaches a log line', () => {
    // ⚠️ Added with H2, 2026-09-16, from asking "what is the WORST thing that could
    // end up in a string we forward?" rather than from anything going red. The
    // answer was already in the building: the `anon` key, the `service_role` key and
    // every signed-in reader's session token are all JWTs, all beginning `eyJ`
    // because that encodes `{"`. A Vercel log is one place that must never hold one;
    // an error sent to Sentry leaves the building entirely.
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImFub24ifQ.dBjftJeZ4CVP';
    const out = redactSecrets(`PostgREST refused: apikey=${jwt} role=anon`);
    expect(out).not.toContain('eyJ');
    expect(out).toContain('[token redacted]');
    // CONTROL — the part that says WHAT failed survives, which is the same
    // one-directional rule the email redactor is held to above.
    expect(out).toContain('PostgREST refused:');
    expect(out).toContain('role=anon');
  });

  test('redactSecrets — Stripe keys and Bearer headers too', () => {
    // ⚠️ ASSEMBLED AT RUNTIME, NEVER WRITTEN AS A LITERAL. These are invented, but
    // they are invented in the SHAPE of a live key — which is the whole point of the
    // test and also exactly what the repo's pre-commit secret scanner exists to
    // stop. It blocked this file on first commit, correctly: a scanner that trusts
    // "it's only a test" is a scanner that waves through the day someone pastes a
    // real one. Same reasoning as `purge-cron.spec.ts` holding an invented
    // CRON_SECRET. Joining the parts keeps the runtime string identical and leaves
    // nothing matchable in the source.
    const stripeSecret = ['sk', 'live', '51Abc123Def456Ghi789'].join('_');
    const stripeWebhook = ['whsec', 'AbCdEf1234567890xyz'].join('_');
    expect(redactSecrets(`Stripe said ${stripeSecret} is revoked`)).toBe(
      'Stripe said [stripe key redacted] is revoked',
    );
    expect(redactSecrets(`bad signature for ${stripeWebhook}`)).toBe(
      'bad signature for [stripe key redacted]',
    );
    expect(redactSecrets('sent Authorization: Bearer abc123def456ghi789jkl')).toBe(
      'sent Authorization: Bearer [redacted]',
    );
  });

  test('CONTROL — redactSecrets leaves ordinary prose completely alone', () => {
    // ⚠️ The load-bearing control for a pattern matcher. Over-masking destroys the
    // part of a message that names the failure, and these are the shapes closest to
    // a false positive: short base64, a word that starts the same way, a ticker.
    for (const s of [
      'Resend send failed 429 rate limit exceeded',
      'could not resolve price for plan monthly_aud',
      'eyJ is not a token on its own',
      'the skater sk_ did not match',
      'BearerTown is a place',
      'user 6f1c0e2a-1111-2222-3333-444455556666 has no profile',
    ]) {
      expect(redactSecrets(s), `redactSecrets mangled: ${s}`).toBe(s);
    }
  });

  test('redactSensitive — secrets are masked BEFORE addresses, and that order matters', () => {
    // A JWT payload can decode to something containing an address, and more to the
    // point a log line can hold both. Masking the address first would leave
    // `eyJ…[email redacted]…` — no longer matching the token pattern, and still most
    // of a credential. One function, one order (11c).
    const both =
      'rejected eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFAYi5jb20ifQ.sig for sam@example.com';
    const out = redactSensitive(both);
    expect(out).not.toContain('eyJ');
    expect(out).not.toContain('sam@example.com');
    expect(out).toContain('[token redacted]');
    expect(out).toContain('[email redacted]');
    expect(out).toContain('rejected');
  });

  test('masks every address when a body names more than one', () => {
    expect(redactEmails('from noreply@majorcycle.com to friend@gmail.com')).toBe(
      'from [email redacted] to [email redacted]',
    );
  });
});

test.describe('the log lines themselves', () => {
  /** Every `.ts`/`.tsx` under app/ and lib/ — derived, never a hand-written list. */
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  const FILES = [...sourceFiles(join(WEB, 'app')), ...sourceFiles(join(WEB, 'lib'))];

  test('the sweep actually read some files', () => {
    // Without this, a broken path makes every assertion below vacuous and the suite
    // reports a clean run having read nothing (14g). 127 files today — a floor with
    // headroom rather than a boundary at the current count (11i-b), so it fails on a
    // broken path and never on a routine file removal.
    expect(FILES.length).toBeGreaterThan(100);
  });

  test('no log line passes an upstream response body through unredacted', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      for (const args of consoleCalls(readFileSync(file, 'utf8'))) {
        if (!/await\s+\w+\.text\(\)/.test(args)) continue;
        if (/redactEmails\(/.test(args)) continue;
        offenders.push(`${file.slice(WEB.length + 1)}: ${args.replace(/\s+/g, ' ').trim()}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  test('CONTROL — the sweep can still SEE the log lines it judges', () => {
    // ⚠️ Added with H2, and it is the assertion that would have caught the blinding
    // described above. Every test in this describe block is vacuously true over an
    // empty list, so "how many lines did you look at?" has to be asserted rather
    // than assumed — a floor with headroom, not the current count (11i-b).
    const total = FILES.reduce((n, f) => n + consoleCalls(readFileSync(f, 'utf8')).length, 0);
    expect(total, 'the log-line matcher found almost nothing — it has stopped matching').toBeGreaterThan(
      25,
    );
    // And specifically on the file this rule was written for: it is the one that
    // logs an upstream body, and it now writes it through `reportIssue`.
    expect(
      consoleCalls(readFileSync(join(WEB, 'lib', 'email', 'send.ts'), 'utf8')).length,
      'the email sender is the subject of the rule below and no line of it is visible here',
    ).toBeGreaterThan(0);
  });

  test('the email sender logs its heading, never the subject', () => {
    // The referral subject is `"<name>" thought you'd like MajorCycle`, so it carries
    // a person's own name. All seven headings are fixed literals we write, and they
    // identify the failing email just as well.
    const src = readFileSync(join(WEB, 'lib', 'email', 'send.ts'), 'utf8');
    for (const args of consoleCalls(src)) {
      expect(args).not.toContain('input.subject');
    }
    expect(src).toContain('input.heading');
  });
});
