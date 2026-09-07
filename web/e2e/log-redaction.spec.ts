import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect } from '@playwright/test';

import { redactEmails } from '../lib/redact';

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

/** Every `console.<anything>(...)` call in a file, with its argument list. */
function consoleCalls(src: string): string[] {
  return [...src.matchAll(/console\.\w+\(([\s\S]{0,400}?)\);/g)].map((m) => m[1] ?? '');
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
