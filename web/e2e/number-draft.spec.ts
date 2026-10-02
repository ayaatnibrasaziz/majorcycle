import { expect, test } from '@playwright/test';

import { draftError, parseDraft } from '../lib/numberDraft';

/**
 * The Custom horizon boxes on Run Analysis AND Browse share these rules
 * (`lib/numberDraft.ts`; owner, 2026-10-03: "ensure both pages are consistent").
 * Pure and credential-free.
 */

test.describe('what a Custom horizon box accepts', () => {
  for (const [typed, n] of [['-8', -8], ['-7.5', -7.5], ['5', 5], ['252', 252], [' 30 ', 30], ['0', 0], ['0.5', 0.5]] as const) {
    test(`"${typed}" is the number ${n}`, () => {
      expect(draftError(typed)).toBeNull();
      expect(parseDraft(typed)).toBe(n);
    });
  }

  for (const typed of ['05', '-05', '0252', '-0.5x', '00']) {
    test(`"${typed}" is refused`, () => {
      expect(Number.isNaN(parseDraft(typed))).toBe(true);
      expect(draftError(typed)).not.toBeNull();
    });
  }

  test('a leading zero says so, rather than a generic message', () => {
    expect(draftError('05')).toBe('Remove the leading 0.');
    expect(draftError('-05')).toBe('Remove the leading 0.');
  });

  test('an empty or half-typed box is not a number yet', () => {
    for (const typed of ['', '-', '.', '-.', 'abc']) expect(Number.isNaN(parseDraft(typed))).toBe(true);
  });

  test('CONTROL: "0.5" and "-0.5" are not leading zeros (the range check decides those)', () => {
    expect(draftError('0.5')).toBeNull();
    expect(draftError('-0.5')).toBeNull();
  });
});
