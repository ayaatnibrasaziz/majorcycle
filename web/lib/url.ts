/**
 * Canonical site origin for building auth redirect and email-link URLs.
 *
 * Prefers the explicit `NEXT_PUBLIC_SITE_URL` (always `https://majorcycle.com`)
 * so links never bake in a preview (`*.vercel.app`) or `localhost` origin.
 * Falls back to the live browser origin, then a hard-coded production default
 * for any server-side caller without the env set.
 */
export function getSiteURL(): string {
  const configured = process.env['NEXT_PUBLIC_SITE_URL'];
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://majorcycle.com';
}
