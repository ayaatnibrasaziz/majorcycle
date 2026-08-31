# Legal Compliance Audit — the legal pages vs. what the system actually does

> ## ✅ STATUS: APPLIED — all seven findings, 2026-08-15, on owner instruction.
>
> The audit was originally delivered under strict propose-only rules (*do not change
> any code, write the suggestions down, get approval first*), and sat unapplied for
> one session. The owner then instructed: **"apply all the 7 fixes"**, with two
> amendments, both recorded below.
>
> **What changed on disk:** `app/(public)/privacy/page.tsx` (findings 1–4) and
> `app/(public)/terms/page.tsx` (findings 5–7). Both `updated` dates moved
> **5 July 2026 → 15 August 2026**. `/disclaimer` is untouched — it was audited and
> found accurate, so its date correctly still reads 5 July 2026.
>
> **Amendment 1 — finding 6 carries no ABN and no entity type.** Owner's
> instruction: *"do not provide ABN or say sole trader. Make it general like
> business in Australia."* The clause now opens *"MajorCycle is operated by a
> business based in Australia."* Open question 2 (verify the ABN) is therefore
> **closed as no longer applicable** — nothing published depends on it.
>
> **Amendment 2 — open question 3 is answered, and the existing wording was right.**
> Checked in the live Cloudflare dashboard, signed in, on 2026-08-15. See below.
>
> Everything under "Findings" is preserved as written, as the record of *why* each
> edit exists. The wording that shipped matches it, except finding 6 per above.

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

✅ **Cloudflare — verified 2026-08-15 in the signed-in dashboard** (it has no MCP
server, so it was checked by hand in the browser). It was the one unverified claim
on the page, and **both halves of "DNS and email routing" are true**:

| Checked | Found |
|---|---|
| Zone `majorcycle.com` | **DNS Setup: Full** — Cloudflare is the authoritative nameserver. 12 records |
| Proxy status | **DNS only on every record.** Cloudflare is registrar + DNS, and does **not** proxy site traffic — no visitor request passes through it |
| Apex `A` / `www` `CNAME` | `76.76.21.21` / `cname.vercel-dns.com` — traffic goes straight to Vercel |
| Email Routing | **Enabled.** 3 `MX` → `route1/2/3.mx.cloudflare.net`, SPF `include:_spf.mx.cloudflare.net`, DNS records locked |
| Routing rules | **2 active** — `support@majorcycle.com` and `security@majorcycle.com` both forward to the owner's personal inbox. Catch-all is **Disabled (Drop)** |
| `send.majorcycle.com` | `MX` → `feedback-smtp.**us-east-1**.amazonses.com` + Resend DKIM — independent confirmation of finding 2's US residency, from DNS rather than from Resend's own API |

⚠️ **One factual correction to this document's own earlier text.** The open question
below asserted that Search Console was verified *"by meta tag specifically so no
Cloudflare DNS record was needed"*. There **is** a `google-site-verification` TXT
record in the zone. The claim was wrong; it changed nothing legally, but it is the
kind of remembered-not-checked detail this audit exists to catch.

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
- ✅ **SHIPPED DIFFERENTLY — owner instruction, 2026-08-15.** No ABN, no entity
  type. The first sentence reads **"MajorCycle is operated by a business based in
  Australia."**; the rest is verbatim as proposed. This is the better call on its
  own merits as well as the owner's: an ABN on a public page is a live claim about
  a real registry that must be verified and kept current, and nothing on the page
  depends on it. **Do not reinstate either without being asked.**

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

## Open questions — ALL THREE NOW CLOSED

1. ~~**Which findings to apply?**~~ ✅ **All seven**, owner instruction 2026-08-15.
2. ~~**Confirm the ABN.**~~ ✅ **No longer applicable** — the ABN and the entity type
   were removed from the clause on owner instruction, so nothing published depends
   on the number. It stays out of the repo's public surface entirely.
3. ~~**Cloudflare.**~~ ✅ **Verified in the live dashboard** — see the table under
   "How this was verified". DNS is authoritative (Full setup, DNS-only, no
   proxying) and Email Routing is genuinely Enabled with two active forwarding
   rules. **"Cloudflare — DNS and email routing" is accurate and was left
   unchanged.** The Resend *"receiving disabled"* reading was a true fact about the
   wrong system: inbound mail was never Resend's job, it is Cloudflare's.

---

## What applying it actually cost — one guard defect, found by the change

Nothing in the legal pages broke. **The test measuring them did**, and it is worth
recording because the failure looked exactly like a content problem:

    /privacy runs only 39 chars in a 494px column

`e2e/legal-doc.spec.ts` counts characters on the first visual line of a real
paragraph, to catch a column that is the right number of *pixels* and the wrong
number of *characters*. Finding 2's clause opens with a bold lead-in —
`<p><strong>Where your information is stored.</strong> These …</p>` — and the guard
took the first text node over 60 characters, which is the run **after** the
`</strong>`, beginning **221px into the paragraph**. It then counted to the wrap
from there: not a line, but what was left of one.

Measured on the real page before touching anything (CLAUDE.md 11i — *print what the
browser computed before editing the assertion*): every paragraph that genuinely
starts at the left edge measured **72, 74, 76, 76**. The column was never wrong.

Fixed by stating the precondition the guard had left implicit — **a
characters-per-line count is only valid measured from the start of a line** — and
checking it, rather than loosening the bound. Candidates beginning mid-line are
skipped, and if a page ever offers nothing else the assertion says so instead of
reporting a bogus number. Proven not to be a no-op afterwards: narrowing
`--measure-doc` 560 → 280px took all three documents red (24, 20, 24 chars in a
214px column), then reverted.

⚠️ **A second observation, recorded and deliberately NOT fixed.** Two paragraphs on
`/privacy` measure **76** characters, one over the 75 band — including one that
predates this session. The guard never saw it because it measures **one** paragraph
per page and stops. Widening it to every paragraph would take `/privacy` red on
pre-existing content, and the only fixes are the document measure or the type
size — a design change nobody asked for (CLAUDE.md 11l). Logged as a Layer G audit
item instead.

---

## Notes for whoever touches these pages next

- The legal pages are `app/(public)/{terms,privacy,disclaimer}/page.tsx`, rendered
  through `components/LegalDoc.tsx`. Content is a `sections` array — adding a
  clause means adding an entry, and the contents rail derives from it automatically.
  Every insertion made here carries a comment naming its finding number.
- **Bump the `updated` prop** on any page whose content changes. `/terms` and
  `/privacy` now read `15 August 2026`; `/disclaimer` correctly still reads
  `5 July 2026`, because its content was audited and left alone.
- ⚠️ **The owner has said repeatedly they are happy with the CONTENT.** These were
  additions for accuracy and completeness, not a rewrite. Nothing existing was
  restyled, re-ordered or "improved" — the one edit to a pre-existing sentence is
  finding 2's `"…to us."` → `"…to us, under contract."`, and the one to a list item
  is moving `and` from the analysis-activity bullet to the technical-data bullet so
  the new sixth item reads grammatically.
- **These clauses describe live behaviour, so they expire like any other measured
  number (CLAUDE.md 11k).** If `FREE_VIEW_DAILY_LIMIT` (25/day),
  `ACCOUNT_DELETION_GRACE_DAYS` (30) or `GRACE_DAYS` (3) ever change, the Terms and
  the Privacy Policy become **wrong**, not merely stale — and nothing will go red.

---

**End of legal-audit.md.**
