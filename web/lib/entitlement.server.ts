import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import {
  SIGNED_OUT_VIEWER,
  viewerFromProfileRead,
  type ViewerEntitlement,
  type ViewerProfileRow,
} from '@/lib/entitlement';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Server-side entitlement lookup for the CURRENT viewer (F3 Step 10).
 *
 * Wrapped in React `cache()` so the layout, the page and any nested server
 * component share ONE database round-trip per request. Without it, the Stock Detail
 * page alone would re-read the profile for every section that needs to know whether
 * to lock — the same reason `fetchCycleAnalysis` is memoised.
 *
 * Reads through the *user's* client, so RLS ("users read own profile") is what scopes
 * the row — this can only ever see the caller's own entitlement, never anyone else's.
 *
 * Fails CLOSED: no session, no profile row, or a failed read all yield `entitled:
 * false`. See lib/entitlement.ts for why this is the opposite of trialGuard's posture.
 */
export type { ViewerEntitlement } from '@/lib/entitlement';

export const getViewerEntitlement = cache(async (): Promise<ViewerEntitlement> => {
  const supabase = await createServerSupabaseClient();
  // Local JWT verification (asymmetric key + cached JWKS) — no Auth-server
  // round-trip, matching the pattern in app/(app)/layout.tsx and the proxy.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) return SIGNED_OUT_VIEWER;

  // maybeSingle(), not single(): `single()` raises PGRST116 for zero rows, so a
  // genuine failure and an RLS-filtered read were already indistinguishable — and
  // the error was being discarded anyway. maybeSingle() hands back both, and
  // `viewerFromProfileRead` treats an empty row as unreadable rather than as a user
  // who has never agreed to anything.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'email, display_name, subscription_status, grace_until, billing_blocked, acknowledged_disclaimer_at, deletion_scheduled_at',
    )
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    // The whole reason the 2026-08-27 incident could not be diagnosed after the
    // fact: this read failed, said nothing, and the user simply saw a first-login
    // modal. `error` is null when RLS filtered the row to nothing (the expired-JWT
    // fallback to `anon`), which is itself the signal worth recording.
    console.error('getViewerEntitlement: profile unreadable for a verified session', {
      userId,
      code: error?.code ?? 'zero_rows',
      message: error?.message ?? 'RLS returned no row for a session we just verified',
    });
  }

  return viewerFromProfileRead(userId, profile as ViewerProfileRow | null);
});

/**
 * Guard for a fully-premium PAGE (/run, /results, the report).
 *
 * Redirects only for the two states where the reader genuinely belongs elsewhere:
 * signed out (→ /login) and mid-deletion (→ /reactivate, which must keep winning over
 * any billing consideration — offering to sell a plan to someone whose account is
 * being deleted answers the wrong question).
 *
 * An unentitled-but-signed-in viewer is deliberately NOT redirected. Sending them to
 * the public /pricing page threw them out of the app — sidebar, header and account
 * menu gone, landing on a page that reads as signed-out. The caller instead renders
 * <PremiumLockPage> in place, so the shell, the route and the reader's sense of being
 * inside the product all survive. `reason` on the returned viewer drives its copy.
 *
 * CALLER CONTRACT: return the panel BEFORE fetching any premium payload. React
 * serialises client-component props into the HTML, so a panel drawn over data already
 * loaded would ship the scores regardless of what renders (CLAUDE.md 11b).
 *
 * This is the UX layer, not the security boundary: the data itself is refused by the
 * proxy (402) and by the Python functions regardless of what any page does.
 */
export async function requirePremiumPage(): Promise<ViewerEntitlement> {
  const viewer = await getViewerEntitlement();
  if (!viewer.userId) redirect('/login');
  if (viewer.deletionScheduled) redirect('/reactivate');
  return viewer;
}
