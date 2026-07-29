import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import {
  hasAccess,
  accessDenialReason,
  type AccessDenialReason,
  type EntitlementProfile,
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
export interface ViewerEntitlement {
  /** Null when signed out. */
  userId: string | null;
  entitled: boolean;
  /** Null when entitled; otherwise why not — drives the locked panel's copy. */
  reason: AccessDenialReason | null;
  /** True when the account is mid-deletion; callers must send these to /reactivate. */
  deletionScheduled: boolean;
  /** Present so callers needing onboarding state don't re-query. */
  acknowledgedDisclaimerAt: string | null;
  subscriptionStatus: string | null;
  /**
   * Dispute lock. Exposed separately from `subscriptionStatus` because it is an
   * orthogonal dimension — a disputed account keeps its Stripe status — and any
   * surface that DISPLAYS the status must say "on hold" instead of announcing the
   * stale "Active" to someone who is locked out.
   */
  billingBlocked: boolean;
  /** Shown on the header account menu. */
  email: string | null;
  /** Prefills the in-app support form, so a locked reader retypes nothing. */
  displayName: string | null;
}

const SIGNED_OUT: ViewerEntitlement = {
  userId: null,
  entitled: false,
  reason: 'no_subscription',
  deletionScheduled: false,
  acknowledgedDisclaimerAt: null,
  subscriptionStatus: null,
  billingBlocked: false,
  email: null,
  displayName: null,
};

export const getViewerEntitlement = cache(async (): Promise<ViewerEntitlement> => {
  const supabase = await createServerSupabaseClient();
  // Local JWT verification (asymmetric key + cached JWKS) — no Auth-server
  // round-trip, matching the pattern in app/(app)/layout.tsx and the proxy.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) return SIGNED_OUT;

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'email, display_name, subscription_status, grace_until, billing_blocked, acknowledged_disclaimer_at, deletion_scheduled_at',
    )
    .eq('id', userId)
    .single();

  if (!profile) return { ...SIGNED_OUT, userId };

  const entitlementFields: EntitlementProfile = {
    subscription_status: profile.subscription_status,
    grace_until: profile.grace_until,
    billing_blocked: profile.billing_blocked,
  };

  return {
    userId,
    entitled: hasAccess(entitlementFields),
    reason: accessDenialReason(entitlementFields),
    deletionScheduled: !!profile.deletion_scheduled_at,
    acknowledgedDisclaimerAt: profile.acknowledged_disclaimer_at ?? null,
    subscriptionStatus: profile.subscription_status ?? null,
    billingBlocked: !!profile.billing_blocked,
    email: profile.email ?? null,
    displayName: profile.display_name ?? null,
  };
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
