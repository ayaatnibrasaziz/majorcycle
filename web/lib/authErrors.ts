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
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
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
