/**
 * What a refer-a-friend invite may carry (beta review D-17, 2026-10-03).
 *
 * The invite goes out from OUR address with the sender's name in the SUBJECT and their
 * note in the body, to an address they typed. Any signed-in account could therefore send
 * ten emails a day reading "Your account is locked — verify at <link>" from
 * noreply@majorcycle.com, and mail clients turn a bare domain into a live link. So:
 *
 * - the name must look like a name: letters (any script), spaces, apostrophes, hyphens
 *   and full stops, at most 40 characters — no digits, no "@", no ":" or "/";
 * - the note may not hold a link or an address of any kind: no "http", no "www.", no
 *   "@", and nothing shaped like a domain ("word.word").
 *
 * Refusing is kinder than silently stripping: the sender sees why and can reword.
 * Pure, so `e2e/referral-input.spec.ts` drives it without a browser.
 */
export const REFERRAL_NAME_MAX = 40;
export const REFERRAL_NOTE_MAX = 300;

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .\-’]*$/u;
// A link or an address in any of the shapes a mail client will make clickable.
const LINKISH_RE = /(https?:|www\.|@|\b[\p{L}\p{N}-]+\.(?:[a-z]{2,24})(?:\b|\/))/iu;

export type ReferralInputResult =
  | { ok: true; name: string; note: string }
  | { ok: false; error: string };

export function cleanReferralInput(rawName: string, rawNote: string): ReferralInputResult {
  // Control characters out first (the name becomes an email SUBJECT — audit 5A-143).
  const name = rawName.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: 'Please add your name so your friend knows who invited them.' };
  if (name.length > REFERRAL_NAME_MAX || !NAME_RE.test(name)) {
    return { ok: false, error: 'Please enter just your name — letters only, no links or numbers.' };
  }
  const note = rawNote.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ').trim().slice(0, REFERRAL_NOTE_MAX);
  if (note && LINKISH_RE.test(note)) {
    return { ok: false, error: 'Please leave links and email addresses out of your note.' };
  }
  return { ok: true, name, note };
}
