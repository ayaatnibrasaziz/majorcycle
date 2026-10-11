import { expect, test } from '@playwright/test';

import { cleanReferralInput } from '../lib/referralInput';

/**
 * A refer-a-friend invite cannot carry a phishing line (beta review D-17, 2026-10-03).
 * The email goes out from our address with the sender's name in its subject, so the
 * name must be a name and the note must hold no link. Pure and credential-free.
 */

const ok = (name: string, note = '') => cleanReferralInput(name, note).ok;

test('ordinary names pass, in any script', () => {
  for (const name of ['Sarah', "Mary-Jane O'Neil", 'J. R. Smith', 'José Álvarez', 'Nguyễn Văn An', '李小龍', "D’Arcy"]) {
    expect(ok(name), name).toBe(true);
  }
});

test('a name that is really a message, a link or an address is refused', () => {
  for (const name of [
    'Your account is locked: verify at evil.com',
    'support@bank.com',
    'Call 0400 000 000',
    'http://evil.example',
    'A'.repeat(41),
  ]) {
    expect(ok(name), name).toBe(false);
  }
});

test('a note may say anything except a link or an address', () => {
  expect(ok('Sam', "This screener changed how I look at the ASX — worth a look!")).toBe(true);
  // CONTROL: an ordinary sentence ending in a full stop is not a "domain".
  expect(ok('Sam', 'I use it most weekends. Give it a go.')).toBe(true);
  for (const note of ['go to evil.com now', 'https://bit.ly/x', 'www.example.org', 'email me: a@b.co', 'login.microsoftonline.com/x']) {
    expect(ok('Sam', note), note).toBe(false);
  }
});

test('control characters never reach the subject line', () => {
  const r = cleanReferralInput('Sam\r\nBcc: x', '');
  // Folded to spaces, and then refused for the colon.
  expect(r.ok).toBe(false);
  const plain = cleanReferralInput('Sam\tLee', '');
  expect(plain.ok && plain.name).toBe('Sam Lee');
});
