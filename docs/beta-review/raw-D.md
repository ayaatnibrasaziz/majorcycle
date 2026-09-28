# Findings D — account/billing states, paywall, /account. Returned as text; saved by main session.
Counts: 0 blocker · 5 major · 11 minor · 3 idea. Paywall held in every state.
Harness artifacts: no country/Stripe customer on beta accounts (Select your country…, ?billing=none, USD fallback); canceled offered trial (no tombstone).
Writes: free display name restored; deleteme hit 25/day cap; firstlogin acknowledged 2026-09-27 15:22 UTC; one Stripe TEST checkout session abandoned.

D-1 [major] grace (past_due in grace): no banner on /stocks, AAPL, /run, /results; only sidebar chip "Payment due" + /account card with no deadline (grace_until loaded); on phone card below fold. AppShell/Header no past_due; SubscriptionCard STATUS_META.past_due.
D-2 [major] /account?checkout=success shows "Payment received — your plan is set up below" in amber alert styling for trial (nothing charged), canceled, lapsed, and free with bogus/no session id. account/page.tsx CHECKOUT_SUCCESS_NOTICE triggers on any status.
D-3 [major] Delete-account copy "Your subscription stays valid until the end of the period you've already paid for" is false: once scheduled the user is signed out → /reactivate, and day-30 purge hard-cancels Stripe sub (api/cron/purge-accounts/route.ts:36) — annual payer loses ~6 months, no refunds; untrue for past_due. Trial variant similar.
D-4 [major] lapsed/canceled on stock pages see the generic free upsell ("Unlock — included with a subscription"), no "payment failed"/"subscription ended"; /run,/results use PremiumLockPage DENIAL_COPY but stock page + UpgradeDialog don't.
D-5 [major] No email when grace expires or subscription ends; only trial-started, trial-ending, payment-failed (first only), payment-recovered; webhook comment claims a cancellation email exists.
D-6 [minor] "Payment recovered" email says access continued uninterrupted even after lockout.
D-7 [minor] No single place states trial end date + amount + "cancel before then" (emails: amount, no date; card: date, no amount/plan).
D-8 [minor] Active card lacks renewal date/price though current_period_end loaded.
D-9 [minor] Cancelling subscriber not told they can resume.
D-10 [minor] First-login gate has no exit: no sign-out, no Terms/Privacy links.
D-11 [minor] Pages behind first-login gate still render server-side: consume free views (AAPL, BHP.AX recorded) and full page HTML (price etc.) sits behind modal; /api/bars preloaded. app/(app)/layout.tsx returns modal only but child page still renders.
D-12 [minor] Nonexistent ticker consumes a free daily view (/api/bars?ticker=ZZZZQ 404 but stored in free_views_tickers).
D-13 [minor] Sign-in redirect drops query string: ?preset=long lost; /account?checkout=success&session_id= loses session id. proxy.ts:233 uses pathname only.
D-14 [minor] /pricing keeps a private feature list (PricingPlans.tsx) worded differently from PREMIUM_UNLOCKS (11c-i); Stripe product description says premium includes "analyst data" (free).
D-15 [minor] Overall Rating described differently: OnboardingModal (Cycle Position, Health, Valuation) vs UpgradeDialog (Health 40%, pullback 35%, historical payoff 25%).
D-16 [minor] Display name silently truncated at 80, no counter; empty saves.
D-17 [idea] Refer-a-friend phishing surface: free-text sender name in subject + 300-char note auto-linked by clients, 10/day from noreply@.
D-18 [idea] No "20 of 25 used" warning; "resets at midnight UTC" = 10am Sydney.
D-19 [idea] Currency chosen silently from country/IP; pricing never says "prices shown for your region".

Checked fine: 402 + private,no-store for free/firstlogin/lapsed/canceled/deleteme on analyze/analyze-dev/report; anon 307; no premium keys in free/lapsed HTML; positive controls paid/trial/paidcancelling/grace; checkout 409 for subscribers, 400 bad plan; all upgrade entry points → same dialog A$19/mo A$159/yr Save 30% (Stripe test: 7 days free then A$159/yr); signed-in /pricing,/ redirect; referral validation; delete two-step; first-login gate blocks + keyboard; daily cap 25 then 429 clear page; canceled/lapsed copy on /run,/results good; no 375 sideways scroll.
Not checked: billing_blocked, real portal/resume, email delivery, two-tab live, Firefox/WebKit.
