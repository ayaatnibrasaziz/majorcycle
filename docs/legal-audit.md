# Legal Compliance Audit — the legal pages vs. what the system actually does

> ## ⚠️ STATUS: PROPOSED. **NOTHING IN THIS FILE HAS BEEN APPLIED.**
>
> The owner asked for an audit under strict rules: *do not change any code, do not
> modify any files, write the suggestions down, get approval first.* This document
> IS that deliverable. The three legal pages are **unchanged** on disk.
>
> **Owner will read this and decide in a later session.** Do not action any finding
> below without an explicit instruction naming it.

**Audited 2026-08-15.** Standard applied — **Australian Privacy Act 1988 (APPs) +
ASIC posture**, chosen by the owner. GDPR/CCPA noted only where they would bite.

**Pages audited:** `/disclaimer`, `/terms`, `/privacy` (all `LegalDoc`, content
last updated 5 July 2026).

---

## How this was verified

Not read — **measured against live systems and the code**, because a legal page is
a factual claim about a running machine and the machine is the authority.

| Source | What it settled |
|---|---|
| **Supabase MCP** (live) | Project `MajorCycle`, `ACTIVE_HEALTHY`, Postgres 17.6, region **`us-east-1`**. Full `public` schema + every FK delete rule |
| **Stripe MCP** (live) | Account `acct_1TrdaxK8OQZXQEmi`, livemode. Two active prices, AUD base (A$19/mo `majorcycle_monthly`, A$159/yr `majorcycle_annual`), `trial_period_days: null` on the price, **`tax_behavior: "unspecified"`** |
| **Resend MCP** (live) | `majorcycle.com` verified, region `us-east-1`, sending enabled, **receiving disabled**, **open-tracking and click-tracking both false** |
| **Vercel MCP** (live) | Project `majorcycle`, team `team_AIgUMMMzMtI9la7rj1x32TZZ` |
| **Codebase** | `lib/trialGuard.ts`, `lib/freeViews.ts`, `lib/account.ts`, `app/api/cron/purge-accounts/route.ts`, `app/api/stripe/webhook/route.ts`, `app/(app)/account/actions.ts`, `components/GoogleSignIn.tsx`, `package.json` |

⚠️ **Cloudflare has no MCP connection** and could not be verified. See the open
questions at the end.

---

## The technical facts this established (true regardless of what the owner decides)

These are worth keeping even if every finding below is rejected — several were not
written down anywhere before.

1. **Personal data lives in the United States.** Supabase `us-east-1`, Resend
   `us-east-1`; Stripe and Vercel are US-based too. The business is Australian.
2. **`referrals` stores a NON-USER's personal information** — `friend_email` and a
   free-text `message`, and `sendReferralEmail` actually emails that person.
   FK `referrer_id` is `CASCADE`, so the row dies with the referrer's account.
3. **`trial_tombstones` survives hard account deletion by design.** A SHA-256 hash
   of the email, deliberately *not* a foreign key, so a purged user cannot farm a
   second free trial. Source comment states this outright.
4. **Deletion is a 30-day scheduled purge**, not immediate — `ACCOUNT_DELETION_GRACE_DAYS = 30`.
   The cron cancels Stripe first, then deletes the auth user; `profiles` and
   `analysis_runs` CASCADE, `universe_log` / `ticker_requests` / `stripe_events`
   SET NULL.
5. **Free tier is capped at 25 new stocks per day** — `FREE_VIEW_DAILY_LIMIT = 25`,
   tracked in `profiles.free_views_date` / `free_views_tickers`.
6. **Payment failure grants a 3-day grace** — `GRACE_DAYS = 3` in the Stripe webhook.
7. **There is no analytics, advertising or tracking stack.** Nothing in
   `package.json`: no PostHog, Sentry, GA, Plausible, Vercel Analytics. Resend
   tracking is off. The privacy page's "we do not build advertising profiles" is
   comfortably true.
8. **Google is a live data recipient** — `GoogleSignIn.tsx` loads Google Identity
   Services on `/login` and `/signup`; the public layout preconnects to
   `accounts.google.com`.
9. **`analysis_runs` persists screener results** (`tickers`, `results`) per user —
   the "analysis activity" the policy mentions is stored, not transient.

---

## Findings

Seven. **None is a misrepresentation** — the pages are honest. Each is a gap
between what the system does and what the disclosures cover.

### 🔴 1 — A third party's personal information is collected and emailed, undisclosed

- **Location:** Privacy Policy → "Information we collect"
- **Current:** *"We collect: account details you provide (email, and — if you choose — display name and country); authentication data when you sign in with Google; billing information handled by our payment processor; your analysis activity within the app; and standard technical data…"*
- **Issue:** Refer-a-Friend takes a friend's email + message, stores both in
  `referrals`, and **emails that person**. They are not a user and have never
  visited the site. **APP 5** requires notifying an individual when their personal
  information is collected from someone else; **APP 3.6** governs collecting from a
  third party at all. The policy discloses none of it.
- **Proposed** (new bullet in the existing list):
  > "an email address and optional message you supply when you refer a friend — we use these once to send that person your invitation, and we tell them who referred them;"

### 🔴 2 — Personal information is stored in the US; the policy is silent

- **Location:** Privacy Policy → "Service providers"
- **Current:** *"Each processes data only to provide their service to us."*
- **Issue:** **APP 8** (cross-border disclosure). Supabase and Resend are both
  `us-east-1`, verified live. Nothing anywhere says data leaves Australia. Most
  likely single point of a privacy complaint.
- **Proposed** (replace the closing line):
  > "Each processes data only to provide their service to us, under contract.
  >
  > **Where your information is stored.** These providers host and process data outside Australia, principally in the United States. By using the Service you agree to your personal information being disclosed to these overseas recipients. We take reasonable steps to ensure they handle it consistently with this policy, but Australian Privacy Principle 8.1 may not apply to them and you may not be able to seek redress under the Privacy Act 1988 in respect of their handling."

### 🟠 3 — Something deliberately survives deletion; the retention clause implies nothing does

- **Location:** Privacy Policy → "Data retention"
- **Current:** *"We keep your personal information for as long as your account is active and as needed to provide the Service, then for any period required to meet legal, tax, or accounting obligations, after which it is deleted or anonymised."*
- **Issue:** (a) deletion is a **30-day scheduled purge**, recoverable in that
  window; (b) `trial_tombstones` keeps a **SHA-256 hash of the email forever**, by
  design. The hash is strongly pseudonymised and defensible — but retaining
  anything derived from a deleted user's email should be stated.
- **Proposed:**
  > "We keep your personal information for as long as your account is active and as needed to provide the Service, then for any period required to meet legal, tax, or accounting obligations, after which it is deleted or anonymised.
  >
  > If you ask us to delete your account, we schedule it and permanently delete it after 30 days — you can cancel during that window by signing back in. After deletion we retain a one-way cryptographic hash of your email address, which cannot be reversed to identify you, solely to enforce our one-free-trial-per-person limit. We also keep billing records for as long as tax law requires."

### 🟠 4 — Google is a data recipient but is not in the recipients list

- **Location:** Privacy Policy → "Service providers"
- **Current:** List names Supabase, Stripe, Resend, Vercel, Cloudflare.
- **Issue:** The collection clause acknowledges Google sign-in, but Google is
  absent from the list that actually discharges **APP 6 / APP 8**.
- **Proposed** (insert into the list):
  > "**Google** — optional Google Sign-In. If you choose it, Google confirms your identity to us and receives the fact that you signed in; we never receive your Google password."

### 🟡 5 — The Terms enforce "usage limits" they never state

- **Location:** Terms → "Trial and subscription" / "Acceptable use"
- **Current (Acceptable use):** *"attempt to circumvent access controls or usage limits;"*
- **Issue:** The Terms never mention that a **free account exists**, or that it is
  capped (`FREE_VIEW_DAILY_LIMIT = 25`). A term you enforce should be a term you
  stated.
- **Proposed** (new clause **"Free accounts"**, before "Trial and subscription"):
  > "A free account requires no payment method and gives you the price chart, the drawdown cycle overlay, and company fundamentals. Our own analysis — the Overall Rating, Health Score, the Verdict and scorecard, downloadable reports, and the screener — requires a subscription. Free accounts may open up to 25 new stocks per day. We may change these limits, and will not reduce them without notice."

### 🟡 6 — No governing law; nothing about tax

- **Location:** Terms → after "Limitation of liability"
- **Current:** No such clause. Only the Disclaimer says *"operated from Australia."*
- **Issue:** (a) no governing-law/jurisdiction clause for US/CA customers; (b)
  Stripe prices carry `tax_behavior: "unspecified"` and the Terms are silent on
  tax — relevant at the **A$75,000 GST registration threshold**.
- **Proposed** (new clause **"Governing law"**):
  > "MajorCycle is operated from Australia by a sole trader registered with ABN 60 469 571 324. These terms are governed by the laws of Australia, and you and we submit to the non-exclusive jurisdiction of its courts. Nothing in this clause limits any right you have to bring proceedings in your own country of residence where the law gives you that right. Prices are shown inclusive of any taxes that apply; if tax obligations change, we will tell you before the change affects your next payment."
- ⚠️ **ABN taken from project notes, NOT a live registry lookup. Owner must confirm before publishing.**

### 🟡 7 — The payment-failure grace is given but not promised

- **Location:** Terms → "Payment and refunds"
- **Current:** *"Subscription fees are billed in advance through our payment processor (Stripe). Except where required by law, fees are non-refundable and we do not provide partial refunds for unused time."*
- **Issue:** `GRACE_DAYS = 3` — access stays open for 3 days after a failed
  payment, with an email. A real benefit, undocumented; stating it also sets the
  expectation that access *does* end afterwards.
- **Proposed:**
  > "Subscription fees are billed in advance through our payment processor (Stripe). Except where required by law, fees are non-refundable and we do not provide partial refunds for unused time. If a payment fails we will email you and keep your access open for 3 days while you update your payment method; after that, paid features are paused until payment succeeds. Nothing here limits your rights under the Australian Consumer Law."

---

## Checked and found ACCURATE — no change proposed

Recorded so a later pass does not re-litigate them.

- **"We do not sell your personal information."** No analytics, ad tech or tracking
  anywhere in `package.json`.
- **"We do not use them to build advertising profiles."** Resend open- and
  click-tracking are both **off**; there is no ad tech. Stronger than it needed to be.
- **Cookies clause.** Accurate — Supabase's auth session plus two short-lived,
  httpOnly, path-scoped markers (`mc_pw_recovery`, `mc_deletion_notice`) carrying
  no personal data.
- **The whole Disclaimer.** Accurate and well-scoped. *"Our ratings reflect a
  quantitative model, not the judgement of a licensed adviser"* is exactly right,
  and naming the five tiers explicitly is good practice.
- **Trial terms.** Verified against Stripe and the checkout code: 7 days, card
  required, auto-converts, monthly/annual, regional pricing, cancellation effective
  at period end. All correct.
- **Refunds + ACL carve-out.** Correctly drafted.

---

## Open questions — owner must answer before anything is applied

1. **Which findings to apply?** All seven · only 1–4 (privacy) · a chosen subset ·
   or revise the wording first.
2. **Confirm the ABN** `60 469 571 324` against a live registry.
3. **Cloudflare** — still doing DNS? Is email routing actually in use? Resend
   reports **receiving disabled**, and `app/layout.tsx` records that Search Console
   was verified by meta tag *specifically so no Cloudflare DNS record was needed*.
   The current phrase "DNS and email routing" may be overstated.

---

## Notes for whoever applies this

- The legal pages are `app/(public)/{terms,privacy,disclaimer}/page.tsx`, rendered
  through `components/LegalDoc.tsx`. Content is a `sections` array — adding a
  clause means adding an entry, and the contents rail derives from it automatically.
- **Bump the `updated` prop** on any page whose content changes. It currently reads
  `5 July 2026` on all three.
- `e2e/legal-doc.spec.ts` measures the rendered type and line band; adding prose
  will not break it, but re-run it.
- ⚠️ **The owner has said repeatedly they are happy with the CONTENT.** These are
  additions for accuracy and completeness, not a rewrite. Do not restyle, re-order
  or "improve" the existing wording while inserting them.

---

**End of legal-audit.md.**
