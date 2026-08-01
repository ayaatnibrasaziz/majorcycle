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
  | 'billing_blocked';

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
  return 'no_subscription';
}
