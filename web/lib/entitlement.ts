/**
 * Entitlement gate (F3 Step 10) — the single source of truth for "may this user
 * see premium content?".
 *
 * Steps 1–9 built the whole billing machine but nothing ever *read* it: auth alone
 * granted the full product, so a cancelled or unpaid account kept everything. This
 * module is the decision that was always specified but never built — see the note in
 * `lib/stripe.ts` on `mapStripeStatus`, which defers the hard-lock rule to exactly here.
 *
 * The rule (locked decision #20 — 3-day grace on payment failure, then hard lock):
 *
 *   billing_blocked === true                  -> NO   (dispute lock; overrides everything)
 *   status 'active' | 'trialing'              -> YES
 *   status 'past_due' && now <  grace_until    -> YES  (inside the grace window)
 *   status 'past_due' && now >= grace_until    -> NO
 *   status 'canceled' | null | anything else  -> NO
 *
 * FAIL CLOSED. A missing profile, an unreadable row, or an unrecognised status all
 * deny. This is the opposite of `lib/trialGuard.ts` (which fails OPEN so a blip never
 * denies someone their trial) — the asymmetry is deliberate: giving away premium
 * costs revenue, whereas a denied *view* is recoverable and visible to the user.
 *
 * Deliberately PURE — no DB, no I/O, no `next/*` imports — so it can be unit-tested
 * exhaustively and used from a server component, a route handler or the proxy alike.
 * Callers fetch the three fields themselves (`app/(app)/layout.tsx` already selects
 * the profile, so it costs no extra query).
 *
 * NOTE: entitlement is *not* the deletion check. `deletion_scheduled_at` confinement
 * to /reactivate must be evaluated BEFORE this, so a soft-deleted account is sent to
 * /reactivate rather than to /pricing.
 */

/** The only profile fields entitlement depends on. */
export interface EntitlementProfile {
  subscription_status?: string | null;
  /** ISO timestamp (Supabase returns timestamptz as a string). */
  grace_until?: string | null;
  billing_blocked?: boolean | null;
}

/**
 * Why access was refused. Drives the honest copy on the in-app locked panel
 * (PremiumLockPage) and the `reason` in /api/analyze's 402 body — "your trial ended"
 * reads very differently from "your payment failed".
 */
export type AccessDenialReason =
  | 'no_subscription'
  | 'canceled'
  | 'payment_failed'
  | 'billing_blocked'
  | 'setup_incomplete'
  | 'subscription_paused';

/** Statuses that carry full access with no further checks. */
const LIVE_STATES = new Set(['active', 'trialing']);

/**
 * Is `grace_until` still in the future? Missing or unparseable ⇒ false (fail closed),
 * so a past_due row that somehow lacks its grace marker locks rather than leaks.
 */
function withinGrace(graceUntil: string | null | undefined, now: Date): boolean {
  if (!graceUntil) return false;
  const until = Date.parse(graceUntil);
  if (Number.isNaN(until)) return false;
  return now.getTime() < until;
}

/**
 * May this profile see premium content? `now` is injectable so the grace boundary
 * can be tested from both sides without touching the system clock.
 */
export function hasAccess(
  profile: EntitlementProfile | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!profile) return false;
  // A dispute lock outranks every other signal, including an otherwise-active sub:
  // the money is being clawed back, so access stops until it resolves in our favour.
  if (profile.billing_blocked === true) return false;

  const status = profile.subscription_status ?? null;
  if (status !== null && LIVE_STATES.has(status)) return true;
  if (status === 'past_due') return withinGrace(profile.grace_until, now);
  return false;
}

/**
 * The reason access was refused, or null when the profile IS entitled. Kept in step
 * with `hasAccess` — every branch that denies there maps to exactly one reason here.
 */
export function accessDenialReason(
  profile: EntitlementProfile | null | undefined,
  now: Date = new Date(),
): AccessDenialReason | null {
  if (hasAccess(profile, now)) return null;
  if (profile?.billing_blocked === true) return 'billing_blocked';
  const status = profile?.subscription_status ?? null;
  if (status === 'past_due') return 'payment_failed';
  if (status === 'canceled') return 'canceled';

  // ⚠️ Stripe has EIGHT statuses and this function knew four. The other four all
  // fell through to `no_subscription` below, which shows a reader with a stuck
  // subscription the same screen as someone who has never subscribed — "you don't
  // have a subscription" to a person who does, and who in three of these cases has
  // already tried to pay us. Found by the Layer G coverage map (F-005):
  // `incomplete_expired` had never appeared in a single test, the other three once
  // or twice. **The access decision was always right; only the sentence was wrong**,
  // which is why nothing was failing and nobody noticed.
  //
  // `unpaid` deliberately REUSES `payment_failed` rather than getting its own copy:
  // it is what `past_due` becomes once Stripe stops retrying, so the reader's
  // situation and their next action — update the card — are identical. A separate
  // reason would be a distinction that exists in Stripe's model and not in theirs.
  if (status === 'unpaid') return 'payment_failed';
  if (status === 'incomplete' || status === 'incomplete_expired') return 'setup_incomplete';
  if (status === 'paused') return 'subscription_paused';

  return 'no_subscription';
}

// ─── The viewer record, and the two decisions that hang off a failed read ────

/**
 * Everything a signed-in surface needs to know about the current viewer.
 *
 * Lives HERE rather than in `entitlement.server.ts` so the pure decisions below can
 * be driven by a credential-free Playwright spec. `entitlement.server.ts` carries
 * `import 'server-only'`, and importing that from a spec takes the whole suite down.
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
  /**
   * TRUE when we hold a valid session but could not read that session's profile row.
   *
   * ⚠️ This is the field the onboarding bug of 2026-08-27 needed and did not have.
   * `null` on every other field then meant two irreconcilable things at once — "we
   * read your row and this is empty" and "we never got your row" — and the two want
   * OPPOSITE handling. For entitlement, unreadable must deny (fail closed). For the
   * disclaimer, unreadable must NOT re-prompt, because re-prompting overwrites the
   * acknowledgement it was wrongly asking for. One boolean separates them.
   */
  profileUnreadable: boolean;
}

export const SIGNED_OUT_VIEWER: ViewerEntitlement = {
  userId: null,
  entitled: false,
  reason: 'no_subscription',
  deletionScheduled: false,
  acknowledgedDisclaimerAt: null,
  subscriptionStatus: null,
  billingBlocked: false,
  email: null,
  displayName: null,
  profileUnreadable: false,
};

/** The columns `getViewerEntitlement` selects. */
export interface ViewerProfileRow {
  email?: string | null;
  display_name?: string | null;
  subscription_status?: string | null;
  grace_until?: string | null;
  billing_blocked?: boolean | null;
  acknowledged_disclaimer_at?: string | null;
  deletion_scheduled_at?: string | null;
}

/**
 * Turn one profile read into a viewer record — CLAUDE.md 11e, applied to the row
 * every signed-in page depends on.
 *
 * ⚠️ A NULL ROW HERE ALWAYS MEANS "COULD NOT READ", NEVER "NO SUCH USER". Every
 * account gets its `profiles` row from the `on_auth_user_created` trigger
 * (migration 20260614030000), verified against the live database on 2026-08-28:
 * 7 auth users, 7 profiles, none missing. So if the caller already holds a verified
 * `userId`, that row exists by construction, and a read that comes back empty did
 * not see it — an expired-JWT fallback to `anon` (which RLS answers with zero rows,
 * measured: HTTP 406 / PGRST116), a statement timeout, or a transient network fault.
 *
 * Entitlement still FAILS CLOSED on that path, unchanged and deliberate. The only
 * thing that changes is that the caller can now tell the difference.
 */
export function viewerFromProfileRead(
  userId: string,
  profile: ViewerProfileRow | null | undefined,
): ViewerEntitlement {
  if (!profile) {
    return { ...SIGNED_OUT_VIEWER, userId, profileUnreadable: true };
  }

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
    profileUnreadable: false,
  };
}

/**
 * Should the first-login disclaimer modal be shown to this viewer?
 *
 * Two conditions, not one — and the second is the whole fix. Asking an unreadable
 * viewer to acknowledge is not a harmless extra prompt: the only button on that
 * modal WRITES, so a false prompt destroys the original acknowledgement date. That
 * happened on the live site to the owner's own account on 2026-08-27, replacing a
 * June record with an August one.
 *
 * A viewer we cannot read is therefore shown the app, not the gate. They may see a
 * locked/free view for that one render — the existing fail-closed behaviour, which
 * is recoverable — and the next request, whose token has been refreshed by the
 * proxy, renders correctly. Nothing is written, so nothing can be lost.
 */
export function shouldShowOnboarding(viewer: ViewerEntitlement): boolean {
  if (!viewer.userId) return false;
  if (viewer.profileUnreadable) return false;
  return !viewer.acknowledgedDisclaimerAt;
}
