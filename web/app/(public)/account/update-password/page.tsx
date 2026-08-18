import type { Metadata } from 'next';
import { UpdatePasswordForm } from './UpdatePasswordForm';

export const metadata: Metadata = { title: 'Set a New Password' };

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}

/**
 * ⚠️ NEVER STATIC. Making `app/not-found.tsx` session-unaware turned most public
 * pages into prerendered files (a real speed win), and this page came with them
 * by accident — measured on the wire sending `Cache-Control: s-maxage=31536000`,
 * a SHARED cache directive with a one-year life, where it had previously sent
 * `private, no-cache, no-store`.
 *
 * Nothing was exposed — this is the page a recovery session is confined to, and
 * `proxy.ts` enforces that before the cache is consulted, so a reader without
 * both the marker AND a session is redirected. But CLAUDE.md 11a is explicit that
 * safety must be stated rather than inherited from someone else's ordering, and
 * this is the screen somebody sets a new password on. It states its own caching.
 */
export const dynamic = 'force-dynamic';
