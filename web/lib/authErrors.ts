/**
 * Maps raw Supabase Auth error messages to friendly, on-brand copy.
 *
 * Unknown messages pass through unchanged so we never hide a real error from
 * the user (or from ourselves during debugging). Keep the matches loose — the
 * upstream wording occasionally changes between Supabase releases.
 */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials')) {
    return "That email or password doesn't match our records.";
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email first — check your inbox for the link.';
  }
  // ⚠️ "already BEEN registered" is a different string from "already registered"
  // and does not contain it. Supabase sends both wordings depending on the call
  // and the release, and only one of them was matched until 2026-08-12 — so a
  // reader who signed up twice was shown raw GoTrue English. Found by
  // e2e/auth-contracts.spec.ts, which drives this function over the real
  // upstream messages rather than over the phrases it was written against.
  if (
    m.includes('already registered') ||
    m.includes('already been registered') ||
    m.includes('already exists')
  ) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  // ⚠️ The 60-second cooldown — by far the most likely limit a real person meets,
  // by pressing "Send reset link" twice — says neither "rate limit" nor "too
  // many". It says "For security purposes, you can only request this after 51
  // seconds", and it too fell straight through to the raw text.
  if (
    m.includes('rate limit') ||
    m.includes('too many') ||
    m.includes('for security purposes') ||
    m.includes('you can only request this')
  ) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (
    m.includes('weak') ||
    m.includes('pwned') ||
    m.includes('data breach') ||
    m.includes('compromised')
  ) {
    return 'For your security, choose a password that has not appeared in a known data breach.';
  }
  if (m.includes('should be at least') || (m.includes('password') && m.includes('characters'))) {
    return 'Your password is too short — use at least 8 characters.';
  }

  return message;
}
