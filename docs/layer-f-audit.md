# Layer F — Static Pages + Subscription Audit Tracker

> Living checklist for the production-readiness audit of **Layer F** (static/public pages,
> auth surfaces, the subscription machine, and the paywall). Mirrors `docs/layer-c-audit.md`,
> `docs/layer-d-audit.md` and `docs/layer-e-audit.md`. Update this file in the same commit as
> each session's fixes.
>
> Layer F was **built** across F0 → F3, merged in **PR #72** (`cd6b014`, 98 commits) and has
> been **live in production since 2026-08-01**; its last two open items closed 2026-08-02.
> This audit takes it from "built and secure" to "production-ready for a mass-retail beginner",
> exactly as C, D and E did.
>
> **This is a different audit from the one Layer F already had.** Live-check Sessions 1–5
> (§ *Build record* below) were a **security and billing** audit: they proved the paywall cannot
> be bypassed and the money moves correctly. They never asked whether the pages are accessible,
> on-brand, or well written. Those are the axes that produced real findings in D and E, and they
> are the work here.

## Definition of "audited" (11 checks)

Each surface must pass all eleven where they apply, verified signed-out **and** signed-in, and —
for any surface whose text varies by billing state — in every state that renders it.

1. **Functional correctness** — the surface does what it claims, on every path into it.
2. **Entitlement / security** — the right viewer sees the right thing; refusals are refusals at
   the wire, not just on screen (CLAUDE.md 11a/11b).
3. **Input validation** — every form field bounded, with a clear inline error that clears the
   moment it is valid.
4. **Reliability / failure modes** — a dependency being down (Resend, Stripe, Supabase) degrades
   honestly and never silently.
5. **Compliant labels** (#2) — the five tiers only; no Buy/Sell/Strong Buy/Avoid in our own
   outputs. Third-party analyst consensus stays verbatim (#17).
6. **Disclaimer presence** (#4/#12) — visible **without scrolling** on any page showing a rating,
   score or signal.
7. **Visual parity + design tokens** — brand palette, Sora/JetBrains Mono, spacing and component
   idiom per `design-system.md`; no orphan one-off styles.
8. **Beginner clarity** — a non-finance reader can act without a glossary open.
9. **Empty / null / edge renders** — missing profile fields, absent subscription, dependency
   failure, hostile input: graceful, never a crash or a blank.
10. **A11y** — keyboard reachable and operable, labelled controls, `:focus-visible`, live regions
    for anything that changes without a navigation.
11. **Copy quality** *(new for Layer F — see the dedicated section)* — consistent vocabulary,
    logically true in the rendering state, and precise about what the product does.

Status key: ✅ pass · ⚠️ issue logged · ❌ fail · ⬜ not yet audited · 🔧 fixed this round ·
**S1–S5** = already proven by the live-check sessions in the build record, cited and **not re-run**

## Verification method

- **Local:** `pnpm dev` (dev server on its own `distDir`, so a production build cannot poison it),
  driven through the Browser pane. Assertions read the **raw HTML and response headers**, never
  what is on screen — the 2026-07-28 bug rendered "🔒 Unlock" while the payload carried
  `"overallRating":60`.
- **Billing states** are set with the Supabase MCP (`execute_sql`) on the service-role-only
  billing columns; sign-in uses the zero-credential admin `generateLink` → `/auth/confirm` route.
- **A11y** is checked by keyboard first (Tab / Shift-Tab / Enter / Space / Esc / arrows) and by
  reading the accessibility tree, not by inspecting JSX for `aria-` strings.
- **Live tail** (F-A4) on `www.majorcycle.com` through the owner's own browser, for the things
  only a real deploy shows. Owner present for signed-in surfaces.
- **Standing gates each session:** `pnpm typecheck`, `pnpm lint`, `pnpm check:entitlement-gates`,
  `pnpm check:report-sections`, `pnpm e2e` (105), `pytest analytics/` (86).
- Fresh browser tab before judging console state — `read_console_messages` retains history per
  tab and has produced three wrong conclusions before.

## Surface matrix

Grouped into sessions F-A1 … F-A5. "Proven" cites the live-check session that already covers
checks 1–6 for that surface; the audit adds 7–11.

| # | Surface | File | Session | Proven | Status |
|---|---|---|---|---|---|
| 1 | `/pricing` | `app/(public)/pricing/{page,PricingPlans}.tsx` | F-A1 | S1 | ⬜ |
| 2 | `/methodology` | `app/(public)/methodology/page.tsx` | F-A1 | S1 | ⬜ |
| 3 | `/terms` | `app/(public)/terms/page.tsx` | F-A1 | S1 | ⬜ |
| 4 | `/privacy` | `app/(public)/privacy/page.tsx` | F-A1 | S1 | ⬜ |
| 5 | `/disclaimer` | `app/(public)/disclaimer/page.tsx` | F-A1 | S1 | ⬜ |
| 6 | `/contact` | `app/(public)/contact/{page,ContactForm,actions}.tsx` | F-A1 | S1 | ⬜ |
| 7 | `/deletion-requested` | `app/(public)/deletion-requested/page.tsx` | F-A1 | S1 | ⬜ |
| 8 | `/login` | `app/(public)/login/{page,LoginForm}.tsx` | F-A2 | S1 | ⬜ |
| 9 | `/signup` | `app/(public)/signup/page.tsx` | F-A2 | S1 | ⬜ |
| 10 | `/reset-password` | `app/(public)/reset-password/page.tsx` | F-A2 | S1 | ⬜ |
| 11 | `/account/update-password` | `app/(public)/account/update-password/page.tsx` | F-A2 | S1 (recovery confinement) | ⬜ |
| 12 | `GoogleSignIn` + One Tap | `components/GoogleSignIn.tsx` | F-A2 | F1 live-verify | ⬜ |
| 13 | `auth/callback` `auth/confirm` `auth/recovery-done` `auth/signout` | `app/auth/*/route.ts` | F-A2 | S1 | ✅ S1 |
| 14 | `/account` shell | `app/(app)/account/page.tsx` | F-A3 | S1 (9 states) | ⬜ |
| 15 | `SubscriptionCard` (7 rows) | `components/account/SubscriptionCard.tsx` | F-A3 | S1 + S3 | ⬜ |
| 16 | `ProfileForm` / `PasswordForm` | `components/account/*.tsx` | F-A3 | S1 | ⬜ |
| 17 | `DeleteAccountCard` | `components/account/DeleteAccountCard.tsx` | F-A3 | S3 seam | ⬜ |
| 18 | `ReferAFriendCard` | `components/account/ReferAFriendCard.tsx` | F-A3 | S1 | ⬜ |
| 19 | `StartTrialButton` / `StartTrialModal` | `components/account/*.tsx` | F-A3 | S3 (tombstone copy) | ⬜ |
| 20 | `/reactivate` | `app/(public)/reactivate/page.tsx` | F-A3 | S1 + S3 | ⬜ |
| 21 | `PremiumLockPage` (full-page lock) | `components/PremiumLockPage.tsx` | F-A3 | S2 | ⬜ |
| 22 | `PremiumLock` (inline lock) | `components/stocks/PremiumLock.tsx` | F-A3 | S2 | ⬜ |
| 23 | `UpgradeDialog` | `components/UpgradeDialog.tsx` | F-A3 | S2 | ⬜ |
| 24 | `/api/checkout` | `app/api/checkout/route.ts` | — | S2 + S3 | ✅ S2/S3 |
| 25 | `/api/portal` | `app/api/portal/route.ts` | — | S2 + S3 | ✅ S2/S3 |
| 26 | `/api/billing-context` | `app/api/billing-context/route.ts` | — | S2 | ✅ S2 |
| 27 | `/api/stripe/webhook` | `app/api/stripe/webhook/route.ts` | — | S2 + S3 + contract tests | ✅ S2/S3 |
| 28 | `/api/cron/purge-accounts` | `app/api/cron/purge-accounts/route.ts` | — | S3 seam | ✅ S3 |
| 29 | Entitlement core | `lib/entitlement.ts`, `entitlement.server.ts`, `freeViews.ts` | — | S2 + CI guard | ✅ S2 |
| 30 | Transactional emails | `lib/email/brandEmail.ts`, `billingEmails.ts` | F-A5 | S3 (Resend logs) | ⬜ copy |

**Session plan.** **F-A1** public/static pages (checks 7–11). **F-A2** auth surfaces (7–11).
**F-A3** `/account`, billing UI and the paywall lock surfaces (7–11). **F-A4** cross-cutting
sweep + the deploy-gated live tail. **F-A5** the copy inventory, drawn from every surface
touched in F-A1…F-A4 and presented to the owner as one table.

## Check 11 — copy quality, consistency and precision

Layer F is where a stranger meets the product. Every prior review judged its copy only for
**compliance** — no forbidden word, disclaimer present. Nothing has judged it for **quality**.
Three axes:

- **Consistency.** One name per concept, sourced from `docs/glossary.md` and CLAUDE.md #16.
  *Major Cycle · Overall Rating · Health Score · Cycle Payoff · Typical Drawdown · entry zone ·
  the five tiers* must read identically on `/pricing`, the lock panels, `/methodology` and the
  emails. Synonyms get normalised; a term used in the UI but missing from the glossary either
  earns an entry or is dropped.
- **Logical and contextual accuracy** — the sentence must be true *in the state that renders it*.
  This class has already produced two real defects: `/account` telling a locked-out `past_due`
  user their access was intact, and "Payment received" shown when provisioning had failed.
- **Precision and impact** — plain, concrete language about what the analysis is and what the
  reader gets. No hype, no performance or outcome claim, never advice (#12/#24). The bar: a
  non-finance reader understands *what a Major Cycle is and why it matters* from the public pages
  alone, with no formula and no promise.

**Ownership.** Copy is the owner's call. F-A5 produces one **copy inventory** table — `surface ·
state · current text · issue · proposed text · rationale` — and nothing user-facing changes until
it is approved. Mechanical consistency fixes are listed separately from voice rewrites so the
first can be accepted wholesale and the second weighed line by line. Two rules are
non-negotiable: no `noreply@` message invites a reply (point to `majorcycle.com/contact`), and no
Buy/Sell/Strong-Buy/Avoid in our own outputs.

## Cross-cutting items (apply layer-wide)

- ⬜ **Compliant labels** (#2) across every Layer F surface.
- ⬜ **Disclaimer without scrolling** (#4/#12) on every page showing a rating or score.
- ⬜ **Currency** (#13) — subscription pricing in the viewer's local currency; stock prices always
  in the stock's home currency.
- ⬜ **Console cleanliness** on every Layer F route, judged in a fresh tab.
- ⬜ **Design-token conformance** — no hard-coded hexes outside the token set.

## Known carry-over (recorded, not fixed in this audit)

- **CSP is still `Content-Security-Policy-Report-Only`** (`web/next.config.ts:42`). Flipping it
  to enforcing was always a tracked follow-up from F0.5 and is a launch decision, not an audit
  finding.
- **375px mobile** → Layer H (already triaged and measured there: 130px overflow, root-caused to
  the `(app)` shell, not to Layer F components).
- **Lighthouse / SEO / sitemap / robots** → Layer G.
- **Sentry / error monitoring** → Layer H.
- **Accepted residual risk, owner's decision:** a Checkout Session created *before* an account
  deletion can still be completed inside Stripe's 24-hour window. The owner considered a handler
  and withdrew it — **do not re-propose**.

## Session log

### F-A0 — tracker created (2026-08-02)

On `main` after `ab11e18`. Build record moved here from `docs/roadmap.md` in commit `2644880`
(roadmap 1,916 → 594 lines; Layer F 1,462 → 103, against 63/41/64 for C/D/E). Move proven
lossless: 1,426 of 1,427 non-blank lines verbatim, the one exception being the H3 heading
deliberately demoted to `## F0 → F3`.

### F-A1 — public/static pages (2026-08-02) — **STARTED, `/contact` partially done**

Local dev server, driven through the browser; assertions read the accessibility tree and the
source, not the screenshot.

**`/contact` — a11y checks pass, and the finding I predicted does not exist.**

The plan flagged `/contact` as the likeliest source of an a11y finding, on the evidence that
`app/(public)/contact` carries only **2** `aria-`/`role` attributes across 2 files against 26 in
the audited `components/run`. **That inference was wrong, and the raw count was a bad proxy:**

- **Labels are properly associated.** Every field exposes its label as its accessible name
  (Name / Email / Message) — via shadcn's `Label htmlFor`, which needs no extra ARIA.
- **The honeypot is correctly hidden from assistive tech.** `ContactForm.tsx:66` wraps it in
  `aria-hidden="true"` with `tabIndex={-1}` and `autoComplete="off"`. This matters more than it
  looks: a honeypot drops matching submissions *silently*, so one exposed to a screen reader
  would discard a blind user's message with no error. It doesn't.
- **The result is announced** — `role="alert"` on the outcome region (`ContactForm.tsx:112`).
- **Disclaimer present** — the public footer carries "Information only — not financial advice"
  with a working `/disclaimer` link, on every `(public)` page.

**Two false leads worth recording, because both would have become bogus findings.** The
accessibility tree dump listed the honeypot as a visible labelled textbox, and rendered the
footer as `advice. .` with a doubled full stop. Both are **artifacts of the reading tool** —
`read_page` enumerates DOM nodes including `aria-hidden` ones, and it flattens the text nodes
either side of an inline link. Checking the source settled both. *Lesson, and it is the same
one as the skipped-tests trap: know what your instrument actually measures before you file a bug
against what it printed.*

**Layer-wide a11y spot check — all five Layer F forms announce their outcome:** `ContactForm`,
`LoginForm`, `ProfileForm`, `PasswordForm` and `ReferAFriendCard` each carry an `aria-live`,
`role="status"` or `role="alert"` region. So Layer F's a11y baseline is materially better than
the attribute-density proxy suggested, and F-A2/F-A3 should be scoped accordingly — the open
question is now **keyboard traversal and focus management**, not labelling.

**`/methodology` — technically accurate, and the numbers were checked against the engine.**
The five bands printed on the page (80 / 65 / 50 / 35) match `analytics/scoring/overall.py`
exactly. Disclaimer sits above the fold. "We deliberately avoid 'Buy' and 'Sell' language" plus
the analyst-consensus carve-out are both present and correct (#2, #17).

**`/terms`, `/privacy`, `/disclaimer`, `/deletion-requested` — all 200**, all carrying the
"not financial advice" line and the Major Cycle vocabulary; the three legal pages all route to
`support@majorcycle.com`. *(`/deletion-requested` deliberately does not — it is a status page,
and its action is `/reactivate`.)*

**A third tool artifact, recorded like the other two.** `/methodology` appeared to read
"rather than guess— you'll see" with a missing space. The source has the space; the extraction
dropped it across a `</strong>` boundary. **Three false leads in one session from the same
instrument** — every one would have been a bogus finding had I trusted the printout.

### F-A1 findings — all check 11 (copy), none blocking, all owner-gated

| id | Surface | Finding |
|---|---|---|
| **F-A1-a** | `/pricing` | **The screener is never mentioned.** `/run` + `/results` — batch-analyse hundreds of tickers, rank, filter, export — is the single largest paid capability and appears nowhere in the four feature bullets (`PricingPlans.tsx:20`) |
| **F-A1-b** | `/pricing` | **Three of the four bullets describe what a free account already has.** Per the F3 Step 10 split, free keeps every ticker, the charts, the drawdown overlay *with cycle bands*, and all fundamentals. So "Every ticker, chart, and Major Cycle analysis" and "US, Australian, and Canadian equities" are not differentiators. Only "Financial health, valuation, and overall rating" names something actually paid. The page under-sells the product by describing the free tier |
| **F-A1-c** | `/pricing` | **The free account is never mentioned.** `/methodology` ends with "Create a free account →"; `/pricing` offers only a card-required trial. A visitor landing on `/pricing` first could reasonably conclude a card is required to use MajorCycle at all — which is not true, and is the opposite of the owner-agreed positioning |
| **F-A1-d** | `/methodology` | **"Cycle Payoff" is never named.** It is the third component of the Overall Rating, it is `cycle_payoff_score` in the engine, and it appears in **7 app files plus `docs/glossary.md`** — KPI strip, Verdict card, Stock header, results table. The public page describes it ("the reliability of the stock's historical cycle") but never names it, so a reader gets no bridge from the public vocabulary to the one they meet after signing up |

**Nothing here is a bug** — no incorrect claim, no compliance breach, no broken state. All four are
*precision and completeness* findings, which is exactly what check 11 was added to catch, and they
concentrate on the two pages that do the selling and the explaining.

### F-A2 — auth surfaces (2026-08-02) — ✅ **PASS, no findings**

Rescoped away from labelling (settled in F-A1) toward input semantics and focus. All five
password-bearing forms carry correct `autocomplete` tokens, which is both an a11y and a
password-manager requirement and is routinely missed:

| Form | Tokens |
|---|---|
| `LoginForm` | `email` · `current-password` |
| `SignupForm` | `email` · `new-password` |
| `ResetPasswordForm` | `email` (no password field — correct) |
| `UpdatePasswordForm` | `new-password` ×2 (new + confirm) |
| `PasswordForm` (account) | **`username`** · `current-password` · `new-password` ×2 |

That `username` token on the account form is the advanced-correct pattern: without a username
field in the DOM, password managers cannot bind a changed credential to the right account. It is
present. **No findings.**

### F-A3 — `/account` + paywall surfaces (2026-08-02) — **in progress**

**`PremiumLockPage` denial copy — ✅ pass, and the correctness is structural, not just written.**
Each of the four `AccessDenialReason` values gets its own message, each naming the caller's real
situation and the real remedy: `canceled` reassures that browsing and financials remain free;
`payment_failed` says update the card rather than buy a new plan; `billing_blocked` names the
dispute. `no_subscription` is deliberately `null` — a first-time free viewer has had nothing go
wrong, so a warning banner would read as a telling-off.

**Why it cannot silently rot:** `DENIAL_COPY` is typed `Record<AccessDenialReason, …>`, so adding
a fifth denial reason **fails the build** until its copy exists. That is the same principle as the
CI guards — the property is enforced by the toolchain rather than by remembering. Worth recording
as a strength, given this is precisely the surface where two real copy defects have already
occurred.

**`SubscriptionCard` — user-facing copy is correct in all seven states.** The precedence is
right and, importantly, it follows **entitlement** rather than Stripe's status where the two
diverge:

| State | Badge | Says |
|---|---|---|
| `active` | Active | names the plan |
| `trialing` | Trial active | names the trial end date |
| `past_due` **inside** grace | Payment due | "update your card to keep access" — true, they still have it |
| `past_due` **past** grace | **Access paused** | "access is paused… update your card and it comes straight back" — true, they've lost it |
| `canceled` | Cancelled | plain statement |
| none | No plan | plain statement |
| `billing_blocked` (any status) | **On hold** | names the dispute; outranks everything |

The two middle rows are the same Stripe status. Only entitlement separates them, which is
exactly the defect fixed in live-check S1. `canStartTrial` correctly excludes both a
dispute-locked and a lapsed `past_due` account.

**`StartTrialModal` repeat-email copy — ✅ honest, and before payment.** A tombstoned email
sees "Subscribe to MajorCycle" and *"Your subscription starts today and is billed immediately —
your free trial has already been used."* No surprise charge, which was the Step 7 requirement.

**Dialogs + `/reactivate` — ✅ pass.** `StartTrialModal`, `UpgradeDialog` and `MethodologyModal`
all build on the shared Radix `DialogContent`, so focus trap, Esc-to-close and focus restoration
come from the primitive rather than from hand-rolled handlers. `/reactivate` is reachable only
in its own state: no session → `/login`, no `deletion_scheduled_at` → `/stocks`.

### 🔧 F-A3-a — two constants misdocumented by a merged comment block (fixed)

`SubscriptionCard.tsx` carried one comment where there should have been two. The block above
`PAST_DUE_LAPSED_META` opened with four sentences explaining the **dispute** lock — including
the "ACTIVE — You're on the Monthly plan" defect that `BLOCKED_META` exists to prevent — and then
switched mid-block to the past-due case with a verbless fragment: *"`past_due` after the 3-day
grace window has closed."* Meanwhile `BLOCKED_META` itself had **no rationale at all**.

Not user-facing, and no behaviour was wrong. It matters because this is the single most
edit-prone surface in Layer F — both of the layer's real copy defects happened here — and the
reasoning that prevents their recurrence was filed against the wrong constant. Each block now
sits above the constant it explains, and the past-due comment states the actual trap: Stripe's
status is identical inside and outside the grace window, so status alone is one dimension short
of the truth and the copy must follow entitlement.

*Gates after the fix: typecheck, lint, entitlement guard (11). The e2e suite was **not** re-run —
the change is comments only, and 105/105 passed on the immediately preceding commit.*

---

## F-A5 — copy inventory — ✅ **APPROVED AND SHIPPED 2026-08-02**

Owner accepted Group 1 in full and chose option **(a)** for Group 4 — add the free-account line
to `/pricing`. All four changes are live in the codebase; gates green (typecheck, lint, both
static guards, e2e **105/105**).

**What shipped:**

- **`/pricing` features re-cut** (`PricingPlans.tsx`) to name only what a subscription actually
  adds: Overall Rating + Health Score · the Verdict, five-pillar scorecard and valuation zone ·
  the screener (rank, filter, export) · the downloadable report · cancel anytime. Cross-checked
  field by field against `PREMIUM_FIELDS` in `lib/cycle.ts`, so the page cannot advertise
  something a free account already has. A comment on the array says exactly that, and points at
  `lib/entitlement.ts`, so the next person editing it knows the constraint.
- **`/pricing` free-account line** — *"Or create a free account — no card needed — for charts,
  drawdown cycles and company financials across US, Australian and Canadian equities."* This
  also rehomes the coverage fact that used to masquerade as a paid feature.
- **`/methodology` names Cycle Payoff** where it previously only described it, closing the gap to
  the 7 app files and the glossary.

### 🔴 A real defect, in my own new copy, caught by the verification rule

The methodology sentence rendered as **"Cycle Payoff— how reliable"** — no space before the em
dash. JSX had swallowed the whitespace across the `</strong>` boundary. **The diff looked
correct; the page was wrong.** Fixed with an explicit `{' — '}` and re-confirmed on the rendered
DOM.

This is precisely why the plan says approved copy must be re-read **on the rendered page, not in
the diff** — and it is the fourth whitespace-around-markup issue this session. The other three
were tool artifacts I correctly dismissed; **this one was real, and had I generalised from those
three I would have shipped it.** The instrument being unreliable does not make the defect class
unreal. Verify each instance on the DOM.

---

### Group 1 — completeness gaps ✅ accepted

| # | Surface | Issue | Proposed |
|---|---|---|---|
| 1 | `/pricing` `PricingPlans.tsx:20` | The screener is absent from the feature list | Add a bullet naming it, e.g. *"Screen hundreds of stocks at once — rank, filter and export"* |
| 2 | `/pricing` | Bullets 1 and 3 describe the free tier, not the paid one | Re-cut the four bullets around what is actually paid: the judgement layer (Overall Rating, Health Score, Verdict, scorecard), the downloadable report, and the screener |
| 3 | `/methodology` | "Cycle Payoff" described but never named | Name it where it is described, so the public vocabulary matches the app's and the glossary's |

### Group 2 — positioning (owner's call) ✅ **owner chose (a)**

| # | Surface | Issue | Outcome |
|---|---|---|---|
| 4 | `/pricing` | The free account was never mentioned; `/methodology` did mention it. A visitor landing on `/pricing` first could conclude a card is required to use MajorCycle at all | Owner chose **(a)** — add the free-account line. Shipped. The alternatives were (b) a full free-vs-premium comparison table, or (c) leave `/pricing` as a pure conversion page |

---
---

# Part 2 — Build record (F0 → F3)

> Everything below moved verbatim out of `docs/roadmap.md` on 2026-08-02, where it had grown to
> ~1,460 lines against 41–64 for Layers C, D and E. It is the full construction history:
> F0/F0.5/F1/F2, the ten F3 steps, the five live-check sessions with every defect found, the
> go/no-go table, merge day, and the key-hygiene close-out. Nothing was deleted in the move.

## F0 → F3 — the build, as it happened

Goal: All non-app pages live, payment flow works end-to-end.

**F0 — Auth branding / de-Supabase-ification (do first).** Make every auth
touchpoint read as `majorcycle.com`, not a generic Supabase project. Code shipped;
console/DNS steps are owner-driven (see `plan-mode-auth-virtual-ladybug.md`).
- [x] Native Google sign-in (Google Identity Services + `signInWithIdToken`) to kill
      the `*.supabase.co` address-bar flash — `web/components/GoogleSignIn.tsx`
      (falls back to redirect flow until `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set)
- [x] Token-hash email verification route `web/app/auth/confirm/route.ts` (branded
      `majorcycle.com` email links, no `supabase.co`)
- [x] `/account/update-password` page (fixes the broken reset-flow 404)
- [x] `getSiteURL()` helper + friendly auth-error copy (`web/lib/url.ts`,
      `web/lib/authErrors.ts`)
- [x] **Console:** Google consent branding + Authorized JS origins + published to
      Production; Client ID in Vercel (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) + `web/.env.local`
- [x] **Console:** Supabase custom SMTP → Resend (`noreply@majorcycle.com`), Auth Site
      URL (`https://www.majorcycle.com`) + redirect allow-list, Google provider
      Authorized Client IDs
- [x] **Console:** Resend domain `majorcycle.com` verified + SPF/DKIM/DMARC in Cloudflare
- [x] All 6 auth email templates branded with token-hash links + a slim header
      (transparent `email-icon.png` + Sora wordmark + navy gradient) — design-system.md §17
- [x] Branded the 7 Supabase **security notification** emails (password / email-address /
      phone-number changed, sign-in-method linked/removed, MFA added/removed) — enabled +
      same slim header, each with a "didn't do this? `security@majorcycle.com`" callout.
      Edited per-template at `/auth/templates/<slug>` (two saves: toggle + content)
- [x] Footer standardised across **all 13** templates to the grey cell
      (`#f8fafc` + top border) — design-system.md §17
- [x] `security@majorcycle.com` inbox via **Cloudflare Email Routing** (free): destination =
      owner Gmail (verified), rule `security@ → Gmail` active, routing enabled (root MX →
      `route1/2/3.mx.cloudflare.net`); Resend sending on the `send.` subdomain untouched
- [x] Reply **as** `security@majorcycle.com` from Gmail via a **"Send mail as"** identity
      relaying through **Resend SMTP** (`smtp.resend.com:465`) + "reply from same address"
- [x] **Branded reply/signature email template** — on-brand Gmail signature for replies from
      `security@majorcycle.com` (`reference/email-signature.html` + `web/public/signature-logo.png`)
- [x] Live end-to-end test: Google no-flash sign-in + branded reset-email delivery (both verified live)

**F0.5 — Auth hardening & security pass (shipped + live-verified 2026-07-05, PR #61).**
Full code + platform security audit; runbook `plan-mode-auth-virtual-ladybug.md`.
- [x] **Recovery-session confinement (HIGH):** a password-reset link no longer grants roam-the-app
      access before a new password is set. `mc_pw_recovery` httpOnly marker (`auth/confirm`) + guard in
      `web/proxy.ts`; `/account/update-password` moved to the `(public)` shell (no sidebar); marker
      cleared by `/auth/recovery-done`. **Live-verified:** reset link → confined page → `/results`
      bounces back.
- [x] **Sign-out** — POST `/auth/signout` + `SignOutButton` in the sidebar (live-verified)
- [x] **Open-redirect guard** — `safeNextPath()` in `web/lib/url.ts` (login/Google/callback/confirm)
- [x] **`profiles` billing-column lockdown** — migration `20260705032433`: `REVOKE UPDATE` + column
      `GRANT` (display_name/country/acknowledged_disclaimer_at only) so subscription/stripe columns are
      client-immutable; RLS policies rewritten `(select auth.uid())`. Verified via column_privileges.
- [x] **FK covering indexes** — migration `20260705032503` (advisor M); advisor WARNs cleared
- [x] **Security headers** — `web/next.config.ts`: X-Frame-Options, nosniff, Referrer-Policy,
      Permissions-Policy + CSP **report-only** (flip to enforcing is a tracked follow-up)
- [x] **DMARC hardened** — `_dmarc` `p=none` → `p=reject` (strict alignment + rua/ruf reporting);
      safe because all `@majorcycle.com` mail is Resend-signed `d=majorcycle.com`. Verified live.
- Declined/deferred: leaked-password protection (Supabase Pro-only — skipped for an info product);
      "require current password" → build into the future `/account` change-password page (not the
      recovery flow); K/N/G/H/I per plan.
- [x] `/methodology` — public plain-English explainer (no formulas; owner to refine copy) — F1
- [x] `/disclaimer` — disclaimer page (baseline content, owner to review) — F0.5
- [x] `/terms` — terms of service (baseline content, owner to review) — F0.5
- [x] `/privacy` — privacy policy (baseline content, owner to review) — F0.5
- [x] `/contact` — contact form → Resend, brand-styled email, `support@` fallback — F1
- [ ] `/pricing` — monthly/annual plans, region-aware currency
- [x] **`/account` — F2 COMPLETE + MERGED LIVE + FULLY VERIFIED 2026-07-13** (Parts A+B+C merged as a clean
      fast-forward of `feat/f2-account-part-a` into `main` `d6c5eb9` → live on www.majorcycle.com; see the live-verification
      note under Part C). Original plan runbook in
      `~/.claude/plans/plan-mode-auth-virtual-ladybug.md`. Three parts: **(A) core** — edit
      `display_name` + full-country dropdown (read-only once subscribed, since Stripe currency is fixed
      per subscription), read-only subscription placeholder, change-password with **current-password re-auth**
      (Google-only accounts see "you sign in with Google"); **(B) delete account** — **soft-delete + 30-day
      grace** (not immediate hard-delete, so a hijacked session/mistake is recoverable): `deletion_scheduled_at`
      col (service-role-only) + branded "scheduled/deleted" emails via `renderBrandEmail` + reactivation gate in
      `(app)/layout` + a `CRON_SECRET`-guarded Vercel-cron purge route; **needs a migration** to change
      `universe_log.added_by_user` FK to `ON DELETE SET NULL` (currently NO ACTION → would block deletion);
      Stripe-cancel-on-delete is a stub wired in F3; **(C) refer-a-friend** — "invite a friend" card → a
      dedicated branded Resend email that **includes the referrer's name** (not the generic Supabase invite
      template), `referrals` table + ~10/day/user rate-limit + honeypot (anti-abuse), rewards/tracking deferred.
      Verified against the live DB (grants, FK rules, `handle_new_user` trigger). No further Supabase email-template
      work needed (all branded in F0; deletion has no Supabase template → we send our own).
  - [x] **Part A (core) — BUILT + LIVE-VERIFIED 2026-07-11 (awaiting owner sign-off; not yet merged).**
        New: `web/app/(app)/account/page.tsx` (server; `getUser` for email + identity-provider detection,
        loads the profile), `web/components/account/{ProfileForm,SubscriptionCard,PasswordForm}.tsx`,
        `web/lib/countries.ts` (full ISO-3166 list; stores the alpha-2 **code**, `countryName()` helper).
        Edited: `web/components/Sidebar.tsx` (Account nav link in the bottom block). ProfileForm writes only
        `display_name`+`country` via the browser client (allowed by the F0.5 column grant); country locks when
        `subscription_status ∈ {active,trialing,past_due}`. PasswordForm re-auths with the current password
        (`signInWithPassword`) before `updateUser` — the fresh sign-in also makes the user "recently logged in",
        so the change succeeds whether or not Supabase's *require-reauthentication* setting is on. The branded
        "password changed" security email **does** fire on the change — this project's Supabase
        `password_changed` security notification was **enabled + branded back in F0 (2026-07-04)**, so the UI's
        "we've emailed you to confirm" copy is truthful (that notification is opt-in in Supabase generally, but
        it is ON for MajorCycle). Supabase enforces **no password history**: it
        only rejects reusing the *current* password, so a user can later change back to an earlier password.
        Google-only accounts get a "you sign in with Google" notice instead. **Verified:** typecheck / lint /
        build green; **e2e 24/24** — new `web/e2e/account.spec.ts` exercises the REAL page against a real
        session (profile save writes to the DB + persists across reload; password form rejects a mismatch and a
        wrong current password without changing anything). **2026-07-11 follow-up:** live-verified the real route
        end-to-end in the **Claude Browser preview** by signing in with the test account — profile save,
        country-lock (temporarily flipped `subscription_status`→`trialing` then reverted), and both password
        guards, all watched live. The session-injection trick is still documented in `coding-standards.md` §15,
        but signing in with the test account inside the preview is the primary method now (headless Playwright /
        session-injection render nothing in the watched preview pane — that was why an earlier check appeared
        blank). **UI consistency pass:** the account page + its three cards were refactored onto the shared
        `.card` / `.card-header` / `.card-title` (uppercase) / `.card-body` system, and the page `h1` made
        `sr-only` — the visible page title comes from the app Header/topbar (matching Results / Request a Ticker);
        it previously rendered a **duplicate** visible "Account" title. Mobile at 375px inherits the **known
        pre-existing shell overflow deferred to Layer H** (fixed sidebar) — the account cards themselves stack
        cleanly.
  - [x] **Part C (refer-a-friend) — BUILT + VERIFIED 2026-07-12 (not yet merged).** Owner chose a **plain invite**
        (no reward — deferred to F3) and to **collect the referrer's name in the form** (prefilled from
        `display_name`, required) so every invite email is personal. Migration `20260712000000_referrals.sql`
        (applied via MCP): new `referrals` table (`referrer_id → profiles ON DELETE CASCADE`, `friend_email`,
        `message`, `created_at`) + RLS (owner-only select/insert; no update/delete = immutable audit) + index on
        `(referrer_id, created_at)`. New: `web/lib/email/format.ts` (shared email helpers extracted from
        `accountEmails.ts`), `web/lib/email/referralEmails.ts` (`sendReferralEmail` from **noreply@** — referrer
        name + optional quoted note + 7-day-trial CTA + one-off provenance line for anti-spam), server action
        `sendReferral` in `account/actions.ts` (guards in order: honeypot → auth → email validity → required name →
        no self-referral → **≤10/day** → no re-invite same address within 30 days; **sends first, records only a
        successful send** so a failure never burns the limit), `web/components/account/ReferAFriendCard.tsx` (invite
        card with hidden honeypot + `noValidate` so brand-styled errors drive validation). Wired into `account/page.tsx`
        before the danger zone. **Email owner-approved via Artifact preview 2026-07-12 before build.** Verified:
        typecheck/lint/build green, **e2e 26/26** (new non-destructive test: invalid-email client validation +
        self-referral server rejection — neither sends an email); card render + hidden honeypot confirmed live in the
        preview DOM; `referrals` table left empty. **F2 (Parts A + B + C) COMPLETE.**
  - [x] **F2 MERGED LIVE + FULLY VERIFIED 2026-07-13.** Owner gave the go; clean fast-forward of `feat/f2-account-part-a`
        into `main` (`d6c5eb9`), Vercel prod deploy READY on www.majorcycle.com. Pre-merge typecheck/lint/build green;
        both F2 migrations confirmed present in the prod DB (Supabase MCP + REST check) before deploy.
        **Live-verified via Claude-in-Chrome** on `nibrasctg@gmail.com` (an email/password account; owner typed the
        password at each sign-in, Claude drove the DB via Supabase MCP and read sends via Resend MCP):
        (i) **all 6 subscription-status renders** — set `subscription_status`/`plan`/`trial_ends_at` in the DB, reload
        /account: null="Free Trial", trialing="Trial Active + runs until <date>", active·monthly/annual="Active + You're
        on the Monthly/Annual plan", past_due="Payment Due" (amber), canceled="Cancelled" (muted); country-lock ON for
        active/trialing/past_due; delete-card reassurance copy correct per state.
        (ii) **refer-a-friend** — real invite delivered (Resend) and landed in the Gmail **inbox** with name + quoted note;
        `referrals` row written then cleaned up.
        (iii) **delete + all three deletion-email variants fired live and body-verified via Resend `get-email`** — paid
        ("stays valid until the end of the period you've already paid for — doesn't cut it short or extend it"), trial
        ("free trial — the days you have left are saved"), none (no subscription line); each set `deletion_scheduled_at`
        to exactly +30d and delivered with the real hosted logo + en-AU date + disclaimer.
        (iv) **flows** — reactivate-by-signin → confined to /reactivate → "Reactivate my account" cleared the flag → back
        in the app; **sign-out on /reactivate logs out AND leaves the deletion scheduled** (correct — only reactivate
        cancels). Account restored to a clean baseline afterward. **Email spam audit: all 19 Resend sends `delivered`, zero
        bounces; the connected Gmail shows every MajorCycle email in INBOX (mostly IMPORTANT) and the spam folder empty.**
  - [x] **Part B (delete account) — BUILT + LIVE-VERIFIED 2026-07-11 (not yet merged).**
        Soft-delete + 30-day grace + reactivation + purge cron + two branded emails (owner-approved copy).
        Migration `20260711000000_account_deletion.sql` (applied via MCP): `universe_log.added_by_user` FK
        `NO ACTION`→`ON DELETE SET NULL` (the last blocker to a hard delete — profiles→auth.users is already
        CASCADE, analysis_runs CASCADE, ticker_requests SET NULL) + `profiles.deletion_scheduled_at timestamptz`
        (service-role-only — excluded from the F0.5 authenticated UPDATE grant, verified). New: server actions
        `web/app/(app)/account/actions.ts` (`requestAccountDeletion` = set flag + email + sign out + →/deletion-requested;
        `reactivateAccount` = clear flag + →/results), `web/lib/account.ts` (`ACCOUNT_DELETION_GRACE_DAYS=30`; a
        plain module because a `'use server'` file can only export async fns), `web/lib/email/{send.ts,accountEmails.ts}`
        (Resend REST via `renderBrandEmail`, from **noreply@**; greeting falls back to "Hi there,"),
        `web/components/account/DeleteAccountCard.tsx` (danger zone, two-step confirm gated on a checkbox),
        `web/app/(public)/reactivate/page.tsx` (reactivation gate), `web/app/(public)/deletion-requested/page.tsx`
        (public post-request confirmation), `web/app/api/cron/purge-accounts/route.ts` (CRON_SECRET-guarded GET;
        emails + `admin.auth.admin.deleteUser` for rows past `deletion_scheduled_at`). Edited: `web/app/(app)/layout.tsx`
        (confine scheduled accounts → /reactivate), `web/proxy.ts` (PUBLIC_PATHS += `/deletion-requested`, `/api/cron`
        — the cron sends a Bearer secret, not cookies, so it must bypass the auth redirect; **this was a real bug the
        live test caught — without it the middleware 307-redirected the cron to /login**), `web/vercel.json` (daily
        cron `0 3 * * *`), `.env.example` (CRON_SECRET + RESEND_FROM_EMAIL now used). **Verified live in
        the Claude preview:** danger-zone confirm gating; setting the flag → confinement redirect to /reactivate →
        one-click reactivate clears it (DB-confirmed); purge route returns 401 (no/blank secret) and
        `{"purged":0}` (valid secret); typecheck/lint/build green, **e2e 25/25** (added a non-destructive
        delete-gating test — never submits against the shared test account). Emails send via the same proven
        Resend path as /contact; the two templates were owner-approved as an Artifact before building.
  - [x] **Part B follow-ups (2026-07-12, not yet merged).** Delete card + deletion email now show a **status-aware
        reassurance BEFORE confirming** (`DeleteAccountCard` takes `subscriptionStatus`; the email takes
        `subscriptionKind: 'paid'|'trial'|null`): a paying subscriber reads "your subscription **stays valid until the
        end of the period you've already paid for — deleting won't cut it short or extend it**"; a trial user reads
        "your free trial's remaining days are saved, and you get them back". Hidden for free/no-sub users. (Earlier
        "paused, not cancelled — resumes with no gap" wording was removed: it implied a delete-and-restore loophole to
        gain paid time.) Both live-verified in the Claude preview (test account temporarily
        flipped to `trialing` then `active`, screenshotted, restored to null). SPGI phantom split re-appeared as
        expected (nightly cron runs `main`, which lacks the `_MIN_SPLIT_DEVIATION` guard on the unmerged branch) —
        left in place; self-heals at the Layer-F merge. The delete/danger buttons (`Button` `destructive` variant)
        now lift on hover like the primary CTA (shadow-grow + 1px rise, red-tinted) instead of just fading, matching
        the app's interaction language. The reworded deletion email (paid + trial variants) was **owner-approved via
        an Artifact preview 2026-07-12** → **F2 = Part A + Part B complete; only Part C (refer-a-friend) remains.**
  - **F3 subscription/deletion mechanics (decided now so the on-card + email copy is honest — TODO markers in code):**
      **(a) Deletion never grants extra paid time — trial and paid differ:**
      · **Paid** — on delete, set `cancel_at_period_end` (NOT pause). The subscription stays valid through the period
        the user already paid for, then stops with no renewal/charge. Deleting must **not** cut it short **or** extend
        it — a delete-and-restore cycle must not buy more paid time (this is the loophole the owner flagged 2026-07-12;
        the earlier "pause + push-out renewal" idea was wrong and has been removed from the copy). Reactivating within
        grace clears `cancel_at_period_end` so it renews normally again; the user keeps only the paid-through time they
        already had.
      · **Trial** — cancel-at-trial-end (**Step 6 final decision 2026-07-19**, superseding the earlier freeze/restore
        idea): on delete set `cancel_at_period_end` so the trial simply runs to its normal end with no charge;
        reactivating before then un-cancels it, otherwise the user returns as a lapsed free account. A trial is free, so
        there's no paid-time loophole — and this makes trial + paid deletion one identical mechanism (`frozen_trial_ms`
        now unused). **(b) Trial-abuse guard (built Step 7 — see below) = deterministic email tombstone (Stripe Radar's
      Free-trial-abuse control was the intended card-vector backstop, but was later left OFF — see Step 7).** The owner's later "no surprise charges" requirement (2026-07-19) replaced the original
      "card fingerprint → end trial at the webhook" idea (that charged by surprise): the email signal is enforced with
      know-before-pay copy. The same-card-across-different-emails vector was meant for Stripe Radar's Free-trial-abuse
      control (a Dashboard toggle), but that control was **left off** (per-signup fee; owner decision 2026-07-20) —
      it's an accepted gap now (see the Step 7 record below). The hashed tombstone still survives account deletion. **(c) EDGE CASES — plan thoroughly WITH the owner before coding (owner's ask 2026-07-12).** The grace
      window and the billing clock are independent, so their timings cross in several ways that each need a defined
      behaviour, e.g.: paid period (or trial) **ends during the 30-day grace**, then the user reactivates **after** it
      lapsed — is the account restored as a lapsed/free user prompted to resubscribe, or something else? Payment fails
      mid-grace; a `past_due` account requests deletion; reactivation exactly on the boundary date; trial ends mid-grace
      then reactivate. Enumerate every timing combination and its outcome as a table before implementation — do NOT
      code the deletion↔Stripe wiring until that plan is agreed.
  - **F3 carry-over findings from the F2 live verification (2026-07-13) — ✅ ALL RESOLVED in the F3 build (see progress below):**
      · **Sidebar licence badge** (`web/components/Sidebar.tsx`) only mapped `active`→"Active" and `trialing`→"Trial
        Active"; `past_due`/`canceled`/null fell through to "Free Trial." **✅ FIXED (F3 step 1):** full mapping
        (active/trialing/past_due/canceled/null→"No plan"). Live-confirmed the badge reads "No plan" for the E2E user.
      · **Deletion-date display timezone.** The 30-day grace *length* was always timezone-safe (absolute +30×24h
        `timestamptz`); only the *displayed* string was UTC-formatted. **✅ RESOLVED (F3, commit `6fe6d5a`) — but by a
        BETTER approach than originally suggested:** dates render in the user's **DEVICE timezone** (`LocalDate.tsx`, and
        device-zone captured at action time for user-triggered emails), NEVER `profiles.country`. Country = currency only.
        Rationale: someone travelling/relocated should see the date where their device actually is. See coding-standards §16.
      · **SPGI phantom split** — **✅ VERIFIED RESOLVED (2026-07-16):** the Daily Data Refresh cron ran 2026-07-16 00:03
        UTC *after* the stale pending row was deleted, and did NOT recreate it (`split_events`: 0 SPGI rows, 0 pending). The
        `_MIN_SPLIT_DEVIATION` guard is proven in production.
  - **F3 product decisions (owner, 2026-07-13):**
      · **Account creation ≠ trial start.** A user can register a FREE account with no card and no trial (already the DB
        behaviour — `handle_new_user` sets no status/trial; the "Free Trial" label is just the null-status fallback).
        Starting the 7-day trial (card required upfront) is an explicit opt-in later. Card-upfront + trial-abuse guard fire
        at the trial-START moment, not signup. Needs a distinct "No active plan" state (not "Free Trial") — folds into the
        sidebar-badge fix. **The paywall/gate is the FINAL F3 step, built LAST after all Stripe plumbing works. What exactly
        gets gated for a free/no-trial account is an OPEN owner decision (owner rejected the Results/Run/Stocks assumption) —
        do NOT presume; ASK the owner to define the gated scope before building the gate.**
      · **Global signups allowed; non-AU/CA billed in USD.** Anyone worldwide can sign up and subscribe; currency rule
        extends to AU→AUD, CA→CAD, everyone-else→USD (US$15/mo, US$126/yr). Add **Stripe Tax** for VAT/GST regions. Stock
        coverage stays US/AU/CA (still useful globally). The /account country dropdown already lists all countries.
**F3 BUILD PROGRESS** — **✅ MERGED TO `main` AND LIVE IN PRODUCTION 2026-08-01** (PR #72,
merge commit `cd6b014`, 98 commits, owner-approved). The "NOT merged" notes throughout the
steps below were accurate when written and are left as history — the merge-day record is the
go/no-go table at the end of this section.
Full plan: `~/.claude/plans/moonlit-prancing-lantern.md`. Verification is done entirely in Stripe **TEST mode**
(test cards/clocks, never real money).
- [x] **Step 1 — migration + carry-over fixes + secret-scan hook** (`1138090`). 8 service-role-only billing columns
      on `profiles` + `stripe_events` (webhook idempotency) + `trial_tombstones` (abuse guard, survives deletion);
      Sidebar badge mapping fixed; `.githooks/pre-commit` blocks `sk_`/`rk_`/`whsec_` in staged diffs.
- [x] **Device-timezone rework** (`6fe6d5a`) — on-screen + emailed dates in the viewer's device zone, not country.
- [x] **Step 2 — `web/lib/stripe.ts`** (`6a7fdf6`): pinned API version `2026-06-24.dahlia`, `resolvePriceId` by
      lookup_key, `currencyForCountry` (AU→aud/CA→cad/else usd), `mapStripeStatus`, `TRIAL_PERIOD_DAYS=7`.
- [x] **Step 3 — Checkout + `/pricing` + `/account` wiring** (`4d087a9`): auth-gated `POST /api/checkout` (hosted
      Checkout, 7-day trial applied in code, currency forced by country, `automatic_tax:false`); public `/pricing`
      (monthly/annual toggle, region currency from profile.country→geo→USD); `/account` "Start free trial" → /pricing.
      **Live-verified in Stripe TEST via preview**: CTA → `checkout.stripe.com` sandbox, 7-day trial, correct price
      ($15/mo)/currency (USD)/email-prefill.
- [x] **Account-save flake fix** (`991db2d`): profile save moved to a **server action** (the cold browser client
      could fire the UPDATE pre-auth → 0-row RLS no-op → a *false* "Saved"); browser Supabase client made a true
      singleton; e2e helpers re-auth + bounded-wait through transient middleware bounces + slow dev renders.
- [x] **Step 4 — Stripe webhook** (`ec0b441`): `web/app/api/stripe/webhook/route.ts` — the ONE writer of the billing
      columns (service-role; entitlement = server-derived Stripe truth). Signature-verified (bad sig → 400), idempotent
      (`stripe_events`; dup → 200 skip; handler throw → release claim → Stripe retries). Handlers re-derive from the
      event object (no live retrieves): subscription.created/updated → full sync; deleted → canceled; invoice.paid/
      payment_succeeded → active+clear grace; payment_failed → past_due+3-day grace; checkout.session.completed → link
      customer. **Contract tests** `web/e2e/stripe-webhook.spec.ts` (plan §14): 8/8 — sign events → POST → assert the
      `profiles` row + idempotency + bad-sig 400, no network to Stripe; run in the existing CI e2e job, self-skip until
      `STRIPE_TEST_SECRET_KEY`+`STRIPE_TEST_WEBHOOK_SECRET`+`SUPABASE_SERVICE_ROLE_KEY` secrets set.
- **Owner setup done (2026-07-16):** GitHub Secret `STRIPE_TEST_SECRET_KEY` ✅ *(swapped to the
      restricted `rk_test_` on 2026-08-02 — it had been a full `sk_test_`; see "Key hygiene" below)*; Vercel **Preview** env
      `STRIPE_SECRET_KEY`=`sk_test_…` ✅ (Sensitive, Preview-only). Stripe **test-mode** product + 2 prices built
      (mirror live, same lookup_keys).
- [x] **Step 4 real end-to-end verified (2026-07-17) — via Stripe CLI, and it caught a real bug.** The preview URL is
      behind **Vercel Deployment Protection** (`vercel_auth_enabled:true`) → Stripe's server-to-server POST gets 401 and
      never reaches the route, so the "register webhook at preview URL" plan can't work without exposing previews. Instead
      tested the canonical way: **Stripe CLI** (`stripe login` → main account **test mode**; owner-interactive) +
      `stripe listen --forward-to localhost:3000/api/stripe/webhook` (its `whsec_` written to `web/.env.local`, gitignored,
      never displayed). Created a throwaway product/price (`lookup_key=majorcycle_monthly`) + customer (`pm_card_visa`) +
      trialing subscription with `metadata.user_id`=e2e profile. Real events forwarded → route returned **200** for all →
      DB written (plan=monthly, currency=aud, customer/sub ids, trial-end). **BUG FOUND + FIXED:** a 7-day trial's **$0
      invoice is marked paid instantly**, so `invoice.paid`/`payment_succeeded` fired and the handler's unconditional
      `status='active'` **clobbered `trialing`** → a real trial user would show as a paying "active" sub. Fix
      (`web/app/api/stripe/webhook/route.ts`): a paid invoice now **only clears grace + recovers `past_due`→active**
      (atomic guarded update, `.eq('subscription_status','past_due')`) — never downgrades `trialing`/resurrects `canceled`;
      `customer.subscription.*` stays the authoritative status writer. Re-tested with a fresh trial sub → status=**trialing** ✅.
      Added regression test (`stripe-webhook.spec.ts`: "a trial's paid $0 invoice must NOT downgrade trialing → active").
      Suite now **35/35 green**. Stripe test data cleaned up (customers deleted, price/product archived, `stripe_events` cleared,
      profile reset). Note: the whsec in `.env.local` is a real **test-mode CLI** secret (local only).
- [x] **CI webhook tests enabled (2026-07-17).** GitHub secret `STRIPE_TEST_WEBHOOK_SECRET` set (a transparent
      non-sensitive offline-signing value — the contract tests sign+verify with the same string, so it need not match a
      real endpoint). All three CI secrets now present. NOTE: CI only runs on **push to `main`** / **PRs to `main`**
      (`ci.yml`), not on feature-branch pushes — so these first execute in CI on the **F3 PR**. Proven green locally (35/35).
- [ ] **Production webhook (at F3 merge):** register the LIVE endpoint at `majorcycle.com/api/stripe/webhook` (prod is
      NOT auth-walled and is LIVE mode) → put its `whsec_` in Vercel **Production** `STRIPE_WEBHOOK_SECRET`. (The preview
      URL can't be used — it's behind Vercel Deployment Protection; Stripe gets 401.)
- [x] **Auth-middleware / session consistency (done 2026-07-17).** The `getClaims()`-hiccup theory was WRONG (JWTs
      live ~1h, so no refresh race during a test). Real root cause: the e2e account + auth suites share ONE test user,
      and the app's Sign-out used the Supabase default **`scope: 'global'`** — which revokes the user's sessions on
      EVERY device. Run concurrently, the auth suite's sign-out revoked the account suite's session mid-test → bounce
      to `/login`. Fix (at the source, not a test crutch): `auth/signout` → **`scope: 'local'`** (one device only; also
      correct product behaviour + explains the rare prod "Session not found") and account-deletion → explicit
      `scope: 'global'`. Also gave the Stripe webhook contract tests their **own throwaway user** (was sharing the login
      row → country-lock collision) and dropped the account suite's re-auth crutch. Full auth+account+webhook suite:
      34/34 green ×3 under 3 parallel workers. Broader auth audit found no other issues (singleton browser client, no
      `getSession()` footgun, careful recovery confinement). The exploratory middleware `getUser()` fallback was reverted.
- [x] **Step 5 — Customer Portal + full clickable demo (DONE + LIVE-VERIFIED 2026-07-18).** New `web/app/api/portal/route.ts`
      (auth-gated POST → `billingPortal.sessions.create` → 303 redirect; no customer → `?billing=none`, error → log +
      `?billing=error`); `SubscriptionCard` disabled placeholder → real "Manage billing" form-POST button + inline notice;
      account page reads `?billing=` and passes the notice. Gates green; committed. **Env aligned to the sandbox** (app key +
      prices already there); created the sandbox Customer Portal config `bpc_1TuR6R…` (update/cancel/payment/invoice, Terms +
      Privacy URLs) and ran `stripe listen` against the sandbox. **Full demo driven in the browser (Claude preview, TEST):**
      magic-link login (AU demo user) → `/pricing` shows A$19 → Start trial → Stripe Checkout (7 days free, A$19, card 4242) →
      webhooks forwarded [200] → `/account` flipped to **Trial Active** (trial-status fix re-proven: the $0 trial invoice did
      NOT downgrade to "active") + country locked → **Manage billing → Stripe Customer Portal** (trial ends Jul 25, $19/mo,
      update/cancel, Visa ••4242) → Return → `/account`. All demo data cleaned up (sub cancelled, customer deleted, throwaway
      user + 12 stripe_events rows removed). Prod webhook endpoint still deferred to F3 merge (Vercel preview is auth-walled).
- [x] **Audit pass — Stripe + Supabase best practices (2026-07-18, commits `907b948` + `93a681c`).** (a) Webhook
      idempotency: `web/app/api/stripe/webhook/route.ts` now claims the event id via an **ON CONFLICT DO NOTHING** upsert
      (`.upsert({id,type},{onConflict:'id',ignoreDuplicates:true}).select('id')`; empty result = duplicate) instead of
      insert-then-catch-23505 — identical semantics, but a Stripe redelivery no longer spams the Postgres log with
      `duplicate key … stripe_events_pkey`. (b) `web/lib/stripe.ts` client now sets **`maxNetworkRetries: 2`** (SDK
      default is 0). (c) `web/app/api/checkout/route.ts` — the two silent `catch {}` now `console.error` the real cause
      (owner can't debug a blank 500/502) while still returning clean user copy. (d) Supabase: **referrals RLS** policies
      rewritten to `(select auth.uid())` (migration `20260718000000_referrals_rls_initplan.sql`) → advisor
      `auth_rls_initplan` cleared; **pg_trgm moved `public`→`extensions`** (migration
      `20260718010000_move_pg_trgm_out_of_public.sql`; verified search_listings still uses the trigram index) → advisor
      `extension_in_public` cleared. (e) Owner enabled **leaked-password protection** in the Supabase dashboard (UI already
      surfaces it via `friendlyAuthError`, no code change). Remaining advisors are intentional/non-issues (9× server-only
      `rls_enabled_no_policy` = correct lockdown; `unused_index` = pre-launch false positives, revisit at live-Stripe;
      `auth_db_connections_absolute` INFO = scale-time knob, N/A on current compute). All verified: typecheck+lint clean,
      webhook e2e 9/9, account e2e 5/5.
- [x] **Profile-save Back-nav bug FIXED (2026-07-18, commit `9029762`).** `updateProfile` (account/actions.ts) persisted
      correctly but didn't invalidate the client Router Cache, so save → `/pricing` → Back re-showed `/account` from the
      stale pre-save snapshot (country looked unsaved though the DB was right). Fix = `revalidatePath('/account')` after a
      successful update. Verified live (set AU, saved, soft-nav to /pricing, Back → shows Australia).
- [x] **PUNCH-LIST (owner-agreed 2026-07-18) — WORKED 2026-07-18/19, branch `feat/f3-stripe`:**
      1. [x] **DB-write sweep DONE** (commit `cc9c0a5`). Audited every mutating server action + write API route:
         the profile-save `revalidatePath` gap was the ONLY real staleness bug — everything else is already safe
         (deletion signs out globally; reactivation redirects → fresh layout; referrals/contact display nothing back;
         request-ticker manages its own client list; password/onboarding use `router.refresh`). **Bonus fix:**
         `OnboardingModal` was the last client-side Supabase write (same silent-no-op-under-RLS risk as the old profile
         bug) → **converted to a server action** `web/app/(app)/actions.ts` `acknowledgeDisclaimer` (derives user from
         session, `revalidatePath('/','layout')`, surfaces a retry error instead of getting stuck). **NEXT SESSION: verify
         the onboarding change with a real login** (couldn't exercise the first-login modal locally — DEV_BYPASS_AUTH skips
         it; compile + typecheck clean).
      2. [x] **Local webhook forwarder DONE** (commits `120501d`, `0122f4d`). `pnpm stripe:listen`
         (`web/scripts/stripe-listen.mjs`) forces the SANDBOX account via `STRIPE_API_KEY` read from `web/.env.local`
         (never printed / not in argv), sidestepping the CLI-default-account gotcha. Verified: connects to "MajorCycle
         sandbox" `acct_1TrdbFGc5r0QcK9U`, reaches Ready, and the CLI signing secret **already matches**
         `STRIPE_WEBHOOK_SECRET` in `.env.local` (loop works with zero manual step). **DONE + owner-verified
         2026-07-19** — live 4242 checkout drove `[200]` webhooks and `/account` flipped to "Trial Active". (Owner
         hit a stale-PATH `'pnpm' not recognized` in an old terminal → fix = open a fresh terminal.)
      3. [x] (dotted zero — left as-is, JetBrains Mono trait. No change, as agreed.)
      4. [x] **Country IP auto-fill + currency consistency DONE** (commit `e30c7aa`). `web/lib/countries.ts` audited =
         the FULL correct ISO-3166-1 alpha-2 list (same codes Stripe + Vercel use), **NOT a dummy list**; only AU/CA
         affect currency and both correct; every other country → USD safely. Explained to owner: Stripe **locks a
         subscription's currency permanently** (verified in Stripe docs), we set it explicitly from country so *shown
         price == charged price* (that's why country is locked once subscribed). **Bug found + fixed:** the trial modal
         DISPLAYED price via saved→IP→USD but checkout CHARGED via saved-only → new resolver `effectiveBillingCountry`
         (`web/lib/stripe.ts`) now shared by /pricing, the account trial modal, and `/api/checkout`; checkout also
         **persists the resolved country** before the sub locks the currency, so stored country == charged currency.
         Autofill = pre-fill dropdown from `x-vercel-ip-country` as a changeable default; `ProfileForm.suggestedCountry`
         keeps the saved baseline empty so it's savable in one click; saved only on user action. **NEXT SESSION: verify
         autofill ON THE LIVE/PREVIEW SITE — the edge header is empty on localhost, so the IP path can't be exercised
         locally** (the Save-enabled-with-suggestion behaviour WAS verified in the dev-fixtures gallery).
      5. [x] **Trial entry styled like the Methodology modal DONE** (commit `767c9da`). New `StartTrialModal` +
         `StartTrialButton` (`web/components/account/`): the Account "Start free trial" button now opens an in-app modal
         reusing the Methodology modal's shell (blurred backdrop, gradient header + icon, disclaimer footer) with the plan
         chooser + `/api/checkout` hand-off — instead of jumping to `/pricing`. Public `/pricing` page unchanged (owner
         chose "Account button only"). Verified in dev-fixtures: AUD price + annual toggle correct, no console/a11y errors.
- [x] **LOCAL VERIFY SESSION (2026-07-19) — owner drove the browser, agent drove servers + DB; verification only, no code
      changes committed.** Two of the three deferred punch-list checks passed:
      - **Local Stripe trial loop VERIFIED.** `pnpm dev` + `pnpm stripe:listen` (sandbox, signing secret already matched
        `.env.local`); owner paid test card 4242 on `e2e@majorcycle.com` → **every webhook `[200]`** → DB confirmed
        `subscription_status=trialing`, `subscription_currency=usd` (no edge header locally → USD, correct),
        `trial_ends_at=2026-07-25 15:18:56Z`, `country=null` (checkout persists a country only when it can resolve one;
        empty edge header locally → nothing persisted → correct). Manage billing opened the sandbox Customer Portal; the
        portal **Cancel** fired `customer.subscription.updated` `[200]`. Owner's four "is this a bug?" questions all
        resolved as working-as-designed: trial "25th" (portal shows UTC; our app shows the local 26th via `<LocalDate>`;
        exactly 7 days), cancel-at-period-end keeps access (decision #21), portal stays on Stripe after cancel (its UX;
        Return uses our `return_url`→/account), `$0.00 Paid` trial invoice (zero-dollar trial-start invoice, no money).
      - **OnboardingModal server-action VERIFIED with a real login.** Reset `acknowledged_disclaimer_at=null` on the e2e
        account → owner saw the "Welcome to MajorCycle" modal → ticked ack + Continue → DB showed a fresh timestamp →
        proves `acknowledgeDisclaimer()` writes reliably (old browser-client write could silently no-op under RLS).
        Original timestamp restored; e2e account reset to a clean never-subscribed baseline afterward.
      - **Country autofill VERIFIED on preview (2026-07-19).** On the `feat/f3-stripe` preview alias, signed into the
        `country=null` e2e account from Australia: `/account` Country pre-filled to "Australia" (savable in one click),
        `/pricing` + the trial modal showed **A$19 AUD** — the `x-vercel-ip-country` edge path works end-to-end (it's
        just empty on localhost, which is why it needed a real deploy).
      - **⚠ REAL STEP-6 FINDING — read `cancel_at`, not `cancel_at_period_end`.** In API `2026-06-24.dahlia` a portal
        cancel-at-period-end leaves `cancel_at_period_end=false` and instead sets `cancel_at` (= period/trial end) +
        `cancellation_details.reason`. `syncSubscription` reads only the old boolean, so the DB never records that a sub is
        *scheduled* to cancel (the eventual `subscription.deleted`→`markCanceled` still works, so nothing gets stuck — only
        the interim "scheduled" state is invisible). Fold the fix into Step 6 (capture `cancel_at`; derive "will cancel"
        from it; then surface a "Cancels on <date>" line on the SubscriptionCard, which is also currently missing).
- [x] **Step 6 — delete↔billing wiring + `cancel_at` fix + traceability (2026-07-19, branch `feat/f3-stripe`).**
      Owner chose the **simpler trial path** (cancel-at-trial-end via `cancel_at_period_end`, not freeze/recreate), so
      trial + paid delete are one mechanism; `frozen_trial_ms` is now unused. Changes: (A) webhook derives
      `cancel_at_period_end` from `sub.cancel_at` (the dahlia signal; the old boolean stays false); (B) SubscriptionCard
      shows a "…cancels on <date>, won't renew" line; (C) `requestAccountDeletion` sets `cancel_at_period_end=true` on
      the live sub (trial cancels at trial end, no charge; paid runs out the paid period); (D) `reactivateAccount` clears
      it if the sub is still live (else lapsed free user); (E) purge cron hard-cancels the sub (+ list-by-customer
      fallback for the pre-sync-id race); (G, owner-requested) `stripe_events` gains `user_id`/customer/subscription
      traceability columns (migration `20260719000000`), stamped after each handled event. E7: trial deletion-email copy
      corrected (no more "days saved/restored"). **Verified:** typecheck/lint/build green; webhook contract tests 10/10
      (incl. new cancel_at + ledger-enrichment case); the delete/reactivate/purge Stripe ops driven against the real
      sandbox (8/8 — cancel_at set==trial_end, cleared, list-fallback, hard-cancel); advisors show no new warnings;
      `stripe_events` test rows purged. **Owner-live-verified 2026-07-19** — owner drove the login; delete→reactivate
      confirmed in the DB + Stripe sandbox (deletion scheduled with no charge, then un-cancelled on reactivate) and
      Part G traceability confirmed on the real events. The in-app `DeleteAccountCard` trial copy still described the
      old freeze model — caught during the live drive and fixed (commit `ba56c31`). NOT merged.
- [x] **Step 7 — trial-abuse guard (email tombstone + Stripe Radar) (2026-07-19, branch `feat/f3-stripe`, commit
      `ff461ab`; column drop `ee67042`).** Owner requirement **no surprise charges — the user is told before paying**
      overrode the original email+card-fingerprint-end-trial-at-webhook plan (which charged by surprise). Design:
      deterministic **email tombstone** (`trial_tombstones.email_hash` = sha256 lower+trim; new `web/lib/trialGuard.ts`),
      written once a sub goes trialing (`syncSubscription`) + at purge; read at checkout (omit `trial_period_days` for a
      repeat email) and on the account trial modal + signed-in `/pricing` (honest "already used your free trial — billed
      today, no free week" copy + dynamic price BEFORE checkout; button → "Subscribe"). Dead `frozen_trial_ms` column dropped
      (`20260719120000`). Gates green; webhook contract tests **11/11** (incl. tombstone write); honest modal verified
      in-browser (monthly + annual pre-pay callout). NOT merged.
      **Radar review + fraud settings (redone live 2026-07-20 via Claude-in-Chrome, LIVE acct — supersedes the 07-19
      "private preview" finding):** the managed **"Free trials"** control is now **available** (out of preview), but its
      prerequisite *"Radar on payment methods saved for future use"* **bills a per-SetupIntent fee** (~A$0.05–0.07 on
      every trial signup, converting or not). **Owner decision: leave it OFF and rely on the free email guard**; enable
      later only if real card-based trial abuse appears. So the same-card-across-different-emails vector is an **accepted
      gap**, covered only by base Radar's always-on high-risk blocking. Free wins we DID enable (backtest = 0 legit
      blocks): the built-in **CVC-fail** and **postal-fail** "block based on risk score" Radar rules. Adaptive 3DS +
      editing the risk dial (left at "Balance risk and revenue") both require **paid Radar for Fraud Teams** → skipped;
      the free "request 3DS on all cards" stand-in was declined (signup friction). The now-dead
      `trial_tombstones.card_fingerprint` column + index were dropped
      (`20260720120000_drop_trial_tombstones_card_fingerprint`).
      **Step 7 live end-to-end verified 2026-07-20 (owner-driven, localhost + Stripe sandbox, Claude-in-Chrome):**
      fresh email → "Start free trial" → sandbox checkout "7 days free" → DB `trialing`/monthly/AUD + `trial_ends_at`
      + **email tombstone written, hash == sha256(email)** + UI "Trial Active" + country-lock engaged. Repeat
      (tombstoned) email → button "Subscribe" → honest modal ("Subscribe to MajorCycle / your free trial has already
      been used / charged A$19 today, no free week") → sandbox checkout shows "A$19.00/month" with **no free-trial
      line** (proves the backend omit-trial enforcement). Currency: USD on localhost (no Vercel geo header), AU$19
      once `country=AU` — geo-currency only runs on the deployed site, so this is correct, not a bug. Sandbox sub
      canceled + test customer deleted + DB/tombstones/`stripe_events` reset to baseline. NOTE: the checkout route's
      `getUser()` is a network call that cold-connect-stalled locally ("Not signed in"); same client-side IPv6 stall
      (see [[reference-local-dev-ipv6-connect-fix]]) — not a live issue (Vercel↔Supabase), fixed for the test with a
      keep-warm pinger.
- [x] **Step 8 — trial reminders + billing emails + dispute handling (built 2026-07-20; branch
      `feat/f3-stripe`, NOT merged).** New `web/lib/email/billingEmails.ts` (4 branded senders:
      trial-**started** welcome, trial-ending, payment-failed dunning, payment-recovered) + optional Resend `Idempotency-Key`
      on `send.ts`. Webhook now: `trial_will_end` → branded reminder (skipped if `cancel_at` set) +
      `trial_reminder_sent`; `invoice.payment_failed` (renewals only) → single-owner `grace_until`
      anchor + dunning email once; paid/succeeded → guarded recover + recovery email; `charge.dispute.*`
      → `billing_blocked` (real chargeback only) + cancel-on-lost. `grace_until` made single-owner
      (removed the healthy-sync clear) → ordering-proof, dedup-safe. Email previews 05–08 in
      `reference/email-templates.html`.
      **Audit-driven additions (2026-07-22, this session):** full re-audit vs the *latest* Stripe docs +
      the live account (all 3 MCP connectors verified). Findings: (a) no unhandled event can error — the
      webhook no-ops unknown types; (b) collection works (card_payments/charges/payouts all active), and
      subscription-mode Checkout auto-filters to recurring-capable methods (cards + wallets + Link), so the
      account's active BNPL capabilities simply don't show — no error; (c) two **notification** gaps closed:
      **(1) trial-started welcome email** — new `sendTrialStartedEmail`, fired from `subscription.created`
      only when `trialing` (repeat/no-trial customers get the Stripe receipt instead); **(2) receipts/invoices**
      = Stripe's built-in **"Successful payments"** Dashboard toggle (owner-approved) — auto-emails a branded
      receipt + invoice-PDF link on every real charge, no $0-trial spam; folded into the Part C dashboard pass.
      Also per owner: trial-ending body reworded "ends in a few days" → **"ends soon"** (robust across the
      reactivation path). Added a contract test for the non-trial `created` path (no welcome). Tests **21/21**.
      **Sandbox drive DONE (2026-07-21, agent self-check):** trial reminder / dunning / recovery /
      dispute (created→won→lost) all verified live against the Stripe sandbox + a test clock; every
      webhook 200, zero errors; sandbox + DB reset to baseline. (CLI `stripe listen` drops test-clock
      event bursts on its ~60–90s session-reconnect → resend the missed event via `stripe events
      resend`; local-only artifact, prod uses a registered endpoint + Stripe retries.)
      **Cancellation edge cases + 2 fixes:** cancel-during-trial (reminder suppressed, no charge) and
      cancel-paid (no Step-8 email) verified; (1) **reactivation reminder gap-fill** — `reactivateAccount`
      sends the trial-ending email if a member cancels then reactivates inside the last 3 trial days
      (Stripe's one-time signal already passed); (2) **stale `subscription.deleted` guard** (only lapse
      the sub on file).
      **Full audit vs official Stripe + Supabase docs + 2 fixes:** (3) `invoice.payment_failed`
      **and** `invoice.payment_action_required` (3-D Secure) now share the dunning path, both guarded on
      the current sub (recovery guarded the same way) — a late/out-of-order failure can't lock a
      cancelled or newer account. Contract tests **20/20**; gates green.
      **Part C dashboard toggles — DONE 2026-07-22 (owner-driven via Claude-in-Chrome, LIVE mode).**
      **"Successful payments" receipts turned ON** (Settings → Emails; verified persisted) → branded
      receipt + invoice-PDF link on every real charge. Verified already-correct (no change needed):
      Stripe's own **trial-ending + failed-payment** customer emails all **OFF** (Settings → Billing →
      Subscriptions and emails) so they don't collide with our branded ones; **Smart Retries ON** (8 tries
      / 2 weeks); **"if all retries fail" = cancel the subscription**. Deferred by owner: **payouts kept
      MANUAL** (no customers yet — switch to Automatic later; how-to goes in the **F-layer payments
      monitoring checklist**); **branding (logo/navy) = Step 9** (receipts valid but plain until then).
      **Guided live check together — DONE 2026-07-24 (owner present, Stripe sandbox + real inbox).**
      All five billing-lifecycle paths driven end-to-end via test clocks + the `sk_test` harness (NOT the
      LIVE-scoped Stripe MCP), every branded email verified in `ayaatnibrasaziz@gmail.com` via the Gmail
      connector: (1) trial-started welcome (AU$19/mo copy, name, approved wording); (2) trial-ending
      "ends soon" + `trial_reminder_sent` marker; (3) cancelled-trial → **zero** emails (welcome + reminder
      both suppressed); (4) payment failed → `past_due` + `grace_until` + "update your card", then good-card
      pay → `active` + grace cleared + "you're all set"; (5) disputes: create → `billing_blocked=true`,
      won → false, lost → stays true + sub cancelled + `stripe_subscription_id` nulled. Sandbox (test clocks)
      + all touched DB rows / tombstones / `stripe_events` reset to the exact 0/0/0 baseline afterward.
      **Webhook event-subscription policy decided + documented** (architecture §7): the LIVE endpoint
      subscribes to **only the 13 handled event types** (Stripe best practice — don't ingest events you
      don't act on); `stripe_events` is for idempotency + our-actions attribution only, NOT a copy of
      Stripe's raw stream (that's Workbench → Event deliveries, 30-day retention). Null-attribution rows
      seen locally are a `stripe listen` firehose artifact; disputes legitimately have no subscription id.
      **Still remaining for Step 8:** at merge, create the LIVE webhook endpoint subscribed to the **13
      event types** (incl. `invoice.payment_action_required`).
- [x] **Step 9 — Stripe branding — DONE + LIVE-VERIFIED 2026-07-25 (owner-driven via Claude-in-Chrome,
      LIVE account `acct_1Trdax…`; no code — pure Dashboard config).** Confirmed against current Stripe docs
      + the live account (`GET /v1/accounts`). All customer-facing Stripe surfaces now read as MajorCycle:
      **Branding** (`settings/branding`) — icon `web/public/logo.png` (512²) + a logo (owner also uploaded one,
      "prefer logo over icon" ON); **brand + accent colour both `#04163e`** (owner chose monochrome navy after
      previewing — the mid-blue `#1E5CB3` muddied against the icon's own blue). **Public details** — support
      email `support@majorcycle.com`, support URL `…/contact`, Privacy `…/privacy` + Terms `…/terms`;
      **support address left BLANK** (owner: no address on receipts — Stripe accepted it; only a bare
      `country:AU` lingers, no street/city, home address never shown). **Checkout settings** — Legal-policy
      links + "agree to legal terms" + Contact-info display ON; Refund/return OFF (no-refund SaaS). **Invoice
      template** — memo "Thanks for subscribing to MajorCycle." + footer "ABN 60 469 571 324 · MajorCycle
      provides educational information only — not financial advice." **Customer Portal** already on-brand
      (header "Manage your MajorCycle subscription and billing.", redirect `/account`). Left as-is: statement
      descriptors (`WWW.MAJORCYCLE.COM` / prefix `MAJORCYCLE`), business name, Product (all already clean).
      **EXCLUDED (researched):** custom domain (paid ~US$10/mo, not free); custom email domain (free but owner
      prefers the `stripe.com` receipt as a trust signal); wordmark-only logo; return/refund UI; product image.
      **Checkout font/shape polish declined** (owner kept the clean default look). **GOTCHA: the Branding page
      does NOT auto-save — the "Save changes" button is mandatory** (verified branding was still null in the API
      until Save clicked). Icon upload can't be automated (Stripe native file picker) — owner picks the file.
      **VERIFIED:** re-`GET /v1/accounts` shows branding populated; **real branded test receipt landed in
      `ayaatnibrasaziz@gmail.com`** (read via Gmail connector) — navy `#04163e` header, M icon, support
      email+URL, **no address**, Stripe trust-signal footer; Checkout + Portal previews on-brand.
- [~] **Step 10 — paywall gate + free tier (owner-approved plan, 2026-07-26).** Code COMPLETE and
      self-verified; **NOT merged**. Scope agreed with the owner: a signed-in FREE tier (no card)
      keeps browse, the price chart, the drawdown overlay + cycle bands and every
      fundamentals/sentiment section; PREMIUM is our judgement (Overall Rating, Health Score,
      verdict, scorecard/radar, rating badges), the report, and the whole screener. See
      architecture §7.1 for the rule, the seam and the two cache traps.
      - Built: `lib/entitlement.ts` (+13 contract tests) · `lib/entitlement.server.ts` (React
        `cache()` so layout+page share one query) · `CycleAnalysisFree`/`CycleAnalysis` split ·
        `/api/cycle` internal-secret + `entitled` query param + `private, no-store` ·
        `/api/analyze` 402 + secret injection · locked-state UI · sidebar DISCOVER/SCREEN ·
        header account menu · home moved Results→Browse via the `POST_AUTH_HOME` choke point ·
        honest signup copy (signing up never did start a trial) · CI paywall tripwire.
      - Gates green: typecheck, lint, build, report-parity, entitlement-guard, ruff, mypy,
        pytest 86, Playwright 60/60.
      - [x] **`CYCLE_INTERNAL_SECRET` set in Vercel — DONE 2026-07-26** (owner-driven via
        Claude-in-Chrome; owner typed the value blind, I never saw it). **Sensitive**, scoped
        **Production + Preview**, with a rotation note. Development deliberately excluded —
        locally `next dev` computes the cycle by spawning `cycle.py` as a CLI, so it never makes
        the HTTP call the secret guards. Vercel injects env vars at BUILD time, so it takes
        effect on the next deployment (i.e. when this branch deploys — no action needed).
      - [x] **All three migrations APPLIED to production — DONE 2026-07-26** (owner approved the
        DDL; applied via the Supabase connector, each verified against the live DB afterwards).
        - `20260726000000` drop `idx_bars_ticker_date` — a DESC-only duplicate of the PK.
          **Database went 1,211 MB → 910 MB**, so it now fits inside the Micro instance's 1 GB
          RAM and the US$15/mo compute upgrade stays unnecessary. One fewer index per cron upsert.
        - `20260726010000` `free_views_date` + `free_views_tickers` on `profiles`.
        - `20260726020000` **`record_free_view()`** — added during the build, not in the original
          plan. The plan's read-append-write in TypeScript was **wrong**: two round-trips over a
          whole array lose count under concurrency, and the array overwrite means N parallel
          requests each write "their" single ticker and clobber each other — a scraper (the exact
          thing the fence exists to stop) would get N pages recorded as one. The function does the
          check and the append under `select … for update`, so it cannot be raced. Service-role
          EXECUTE only; `search_path` pinned. Verified live: first view, repeat view (free, no
          increment), at-cap, over-cap denial, already-seen-still-allowed-at-cap, UTC-day reset,
          unknown-user fail-open, and that neither `anon` nor `authenticated` may execute it.
      - [x] **Free-tier daily view counter — BUILT 2026-07-26.** `lib/freeViews.ts` +
        `FREE_VIEW_DAILY_LIMIT = 25` distinct tickers per **UTC** day, enforced in the Stock
        Detail page *after* `notFound()` (a typo'd ticker never costs a view) and skipped
        entirely for subscribers (locked decision #18 — no usage limits). Over the cap, a new
        stock renders an honest "daily browsing limit reached" notice; stocks opened earlier the
        same day still load. **Fails OPEN** on a DB error, the deliberate opposite of the
        entitlement gate — the premium fields are already stripped upstream, so over-throttling a
        free reader would cost goodwill for no security gain. `prefetch={false}` added to the
        Browse stock links (finding B5): `next/link` prefetch RUNS the server component, so
        scrolling the list would otherwise have burned quota silently.
      - **GRANT finding (2026-07-26, from the live DB — not visible in the migration text).**
        The counter migration's column-level `REVOKE` does **not** do what its comment claimed:
        Postgres cannot subtract a column from a table-level GRANT, and `authenticated` does hold
        table-level SELECT/INSERT on `profiles`. What actually protects the counter is that
        **`authenticated` has no table-level UPDATE at all** — its UPDATE is granted per column
        (`display_name`, `country`, `acknowledged_disclaimer_at`), so a new column is unwritable
        the moment it is added. The migration comment was corrected to say so, and
        `check-entitlement-gates.mjs` gained a check that fails CI if any migration ever issues
        table-level `grant update on profiles to authenticated`. (`anon` does hold table-level
        UPDATE, inherited from Supabase defaults — not exploitable, since the RLS policy requires
        `auth.uid() = id` and an anonymous caller has none. Tightening it is still open.)
      - [x] **Behavioural matrix BUILT 2026-07-26** — `web/e2e/entitlement-routes.spec.ts`, 23
        tests. This was specified in the approved plan (§9.3) and had **not** been built; the
        gap was found by the owner asking why the guided check came before full self-checking.
        It creates its own throwaway auth user, signs in, and walks **all seven** subscription
        states against real pages and the real API, then deletes the account (verified: zero
        DB residue). Covers `/run` + `/results` + the report page (render vs
        `/pricing?reason=…`), `POST /api/analyze` (past-the-gate vs **402** with the right
        reason), `/api/cycle` (**401** without the secret and never a redirect; accepted with
        it), deletion-scheduled → `/reactivate` outranking `/pricing`, the free-tier cap
        (blocked on a NEW ticker, allowed on one already seen, never applied to a subscriber),
        and that a signed-in user **cannot** write their own counter or `subscription_status`
        while **can** still write `display_name`/`country`. The decisive one: a free viewer's
        Stock Detail markup contains no `NN/100` anywhere, and the same page for an `active`
        account does — proving the bytes are withheld, not hidden.
        **Mutation-tested:** forcing `hasAccess` to return true makes the suite fail
        immediately; `lib/entitlement.ts` restored byte-identical afterwards (empty git diff).
        Wired into the CI `e2e` job (self-skips without the service-role key).
        **Playwright now 83 tests, all passing** (was 60).
      - Guard now at **8 checks**; both new checks proven to fail on a deliberately broken input
        and to pass on the correct column-scoped form. Supabase security advisors re-run after
        the migrations: same 9 INFO `rls_enabled_no_policy` notices as before, no new findings,
        and no `function_search_path_mutable` warning for the new function.
      - **Owner actions still outstanding:** (1) upgrade Vercel to **Pro** — Hobby forbids
        commercial use and the site takes payments (**plan badge visually confirmed as Hobby
        2026-07-26**); owner has scheduled this for **the end of Phase 1, at official launch**;
        (2) create the LIVE Stripe webhook endpoint (13 events) at merge; (3) add a LIVE
        `STRIPE_SECRET_KEY` to Production (below).
      - [x] **LIVE `STRIPE_SECRET_KEY` set in Vercel Production — DONE 2026-07-26**
        (owner-driven Claude-in-Chrome; owner revealed and pasted the value, I never saw it).
        A **restricted** key (`rk_live_`) named `MajorCycle web app - production`, created with
        exactly **6** permissions — deliberately NOT Stripe's "Recurring subscriptions and
        billing" template, which grants 40. Scoped **Production only**, *Sensitive*; the
        pre-existing Preview entry (test key) was left untouched. Permissions verified twice:
        once before saving and once by re-reading the key's own edit page.
        - Mapping to real call sites (Stripe's rule: GET → read, POST/DELETE → write, and
          **write implies read**): Checkout Sessions **write** (`POST /v1/checkout/sessions`) ·
          Customer Portal **write** (`POST /v1/billing_portal/sessions`) · Subscriptions
          **write** (`POST`/`DELETE /v1/subscriptions`; `list` covered by write→read) · Prices
          **read** (`GET /v1/prices`) · Charges and Refunds **read** (`GET /v1/charges/:id`,
          dispute attribution). No `Products`, `Invoices` or `Payment Intents` permission is
          needed — the webhook reads invoice/dispute data from the **event payload**, and
          `webhooks.constructEvent` is local crypto with no API call.
        - **Open, deliberately not yet tightened:** `Customers` was granted **write** but **no
          `/v1/customers` request exists anywhere in the code**. Passing `customer` /
          `customer_email` to a Checkout Session is a field on *that* resource. Verify in the
          **sandbox** with an identically-scoped test key set to Customers = None; if checkout
          and portal still work, drop it live. Stripe returns an `invalid_request_error` naming
          the missing permission, so a failure would be self-diagnosing.
        - Also found: an **unnamed, never-used restricted key from 10 Jul with broad write
          scopes** still exists on the live account. Left alone; recommend expiring it.
      - ✅ **WEBHOOK FINDINGS (2026-07-26) — BOTH CLOSED ON MERGE DAY, 2026-08-01.** The
        endpoint was created on `www` and its `whsec_` set in Vercel Production; see the
        go/no-go table at the end of this section for the read-back evidence. Kept in full
        below because the `www` rule governs any future endpoint, and because finding 2 is a
        good example of a gap that only local testing could hide. Original text:
        1. **The endpoint URL must use `www`:** `https://www.majorcycle.com/api/stripe/webhook`.
           Verified by request: the apex `majorcycle.com` answers **307 → www**, and Stripe's
           docs are explicit — *"We consider redirect responses to webhook requests as
           failures."* Pointing it at the apex would fail **every** delivery, silently, with no
           app-side error to see.
        2. **`STRIPE_WEBHOOK_SECRET` is not set in Vercel at all** — not Production *and not
           Preview* (verified by reading the live env-var list; only 11 vars exist and it isn't
           among them). Webhook contract testing has only ever run locally via `stripe listen`,
           which is why this went unnoticed. Preview deployments therefore cannot verify a
           Stripe signature today.
        Creating the live endpoint is deliberately **deferred to merge** rather than done now:
        `main` has no Stripe code, so that URL currently 307s to `/login`, which means a
        Stripe test-send would fail and the endpoint could not be verified. Do it as ONE atomic
        step — create endpoint (13 events) → copy signing secret into Vercel **Production** →
        redeploy → send a test event → confirm 200.
      - **Secret record:** `SECRETS.local.md` at the repo root — gitignored by name *and* by a
        `*.local.md` pattern, verified with `git check-ignore`. Documents every key, what it does
        in plain English, and which Vercel environments it belongs in. `.env.example` points at it.
      - [x] **VISUAL browser pass — DONE 2026-07-27 (`cc501c6`).** The owner's standing rule:
        code gates prove logic, not that a page *looks* right, so a self-driven browser pass
        with screenshots now precedes any live check. **Nine defects, every one of which had
        passed typecheck, lint, both guards, pytest 86 and Playwright 83** — because all nine
        were wording, an affordance, or a whitespace rule.
        - `/pricing` **ignored `?reason=` entirely** — `requireEntitled()` had always sent it and
          the page never read `searchParams`, so every locked-out customer saw the same generic
          shop-window. Now an allow-listed banner, **signed-in only**.
        - The pricing **headline was hard-coded to the trial pitch** — offering a free week both
          to a past-due customer (directly under a banner saying they don't need a new plan) and
          to someone the Step 7 tombstone bills on day one. Headline, closing bullet and CTA now
          vary by reader.
        - Free "Download Report" reported a **402 as a transient fault** ("try again in a
          moment") — telling a prospective subscriber the app is broken.
        - `PremiumLockCard` had **no `id`**, so the subnav's Scorecard pill was a silently dead
          click for exactly the viewers being sold to.
        - A bare **"Buy" chip** sat where our rating badge had been, attribution in a hover
          `title` only → reads as *our* call (CLAUDE.md #2). Now visibly "Analysts: Buy".
        - **Owner-caught:** signup said *"No card required. Start a 7-day free trial"*, which
          parses as "the trial needs no card" — the opposite of decision #19. Same false promise
          in the refer-a-friend card **and email**, and the signup `<title>` still read "Start
          Free Trial".
        - `"You've opened 25different stocks"` — JSX trims the leading space off a text segment
          following an interpolation.
        - Verified with screenshots: free vs entitled Stock Detail A/B, **no premium key and no
          `NN/100` anywhere in free HTML**, the fence at the cap, `/api/cycle` 401, every denial
          banner. **Not** verifiable locally and still open: geo currency, real Checkout,
          CDN cache behaviour.
          *(Correction, 2026-07-28: this line previously also claimed true 375px was not
          verifiable because "the browser pane clamps to 566px". That was wrong — the pane
          reports a true `innerWidth: 375`. See the Layer H entry for what the measurement
          actually found.)*
      - [x] **Locks explain themselves in place — DONE 2026-07-27 (`cf61908`, `03d5161`).**
        Owner feedback. Every lock now opens `UpgradeDialog` (Methodology-modal shell, blurred
        backdrop) instead of navigating to `/pricing`, so the reader keeps the stock they were
        deciding about; each of the seven surfaces explains **what that feature is**, then hands
        off to `StartTrialModal` — the same in-app checkout entry `/account` uses, which is what
        keeps every subscription rule in one place. New `GET /api/billing-context` labels the CTA
        only and is explicitly not authoritative. Also: sidebar Account row and header Run
        Analysis button removed (each duplicated a nav row); the signed-out trial CTA now carries
        the chosen plan through signup and the confirmation email (`?next=/pricing?start=…`,
        working for email/password **and** both Google paths) instead of dead-ending; onboarding
        acknowledgement no longer squeezed into three lines.
        **Edge cases re-verified after the rewiring:** one dialog at a time (no stacking), scroll
        lock and `pointer-events` restored on close, no orphaned `data-aria-hidden`, tombstoned
        email → "Subscribe … charged today, no free week", `billing_blocked` subscriber →
        "Manage your plan" and **no trial offered**, `/api/billing-context` 307s a signed-out
        caller.
      - [x] **Onboarding made a real gate — DONE 2026-07-27 (`c4264fd`).** Fixes a React
        hydration warning on first login that was **not** a regression of the Layer C portal fix
        (`74a17ab`) — different component, different cause. Radix writes `aria-hidden` onto
        sibling DOM nodes when a modal opens; App Router hydrates progressively, so the write hit
        the 862-stock Browse subtree mid-hydration and React discarded and re-rendered it — a
        real production cost, not just dev noise. Upstream
        [radix-ui/primitives#1386](https://github.com/radix-ui/primitives/issues/1386), still
        open; `dynamic(ssr:false)`, `useSyncExternalStore`, `requestAnimationFrame` and upgrading
        `@radix-ui/react-dialog` 1.1.15 → **1.1.23** all failed. Fix: when the disclaimer is
        unacknowledged the layout returns the modal **alone** and never renders the page behind
        it — nothing to race, and first login stops paying for a universe fetch plus a 120-row
        client component nobody sees. Verified in a clean tab: modal shows, console clean,
        acknowledging still lands on Browse. See architecture §7.3.
      - **Known non-issue:** `pytest` prints one `DeprecationWarning` about the `gotrue` package.
        It originates inside the installed `supabase` library (`supabase/_async/auth_client.py`
        does `from gotrue import …`); our code never imports it. The local env has supabase 2.7.4
        while `web/requirements.txt` pins `supabase>=2.4.0`, so CI and Vercel resolve a current
        release that has already migrated to `supabase_auth`. No action. (Open, minor: that pin
        is open-ended, so a future 2.x could reach production unreviewed.)
      - [x] **OWNER-DRIVEN LIVE CHECK on the deployed preview — 2026-07-28 (`ea84d01`).**
        Run against the `feat/f3-stripe` preview with a throwaway account signed in via an
        admin-generated one-time token aimed at the preview's own `/auth/confirm` (no password
        typed, no dependence on `NEXT_PUBLIC_SITE_URL`, which points at production and would
        otherwise bounce a preview sign-in). Billing states driven by flipping columns directly.
        - **Baseline captured first:** production `/api/cycle` today answers an anonymous,
          session-less, secret-less `curl` with **HTTP 200, `Cache-Control: public`, and the
          complete paid payload** (`overall_rating 60`, `financial_health_score 81.0`). That is
          §2.2 + B1 reproduced in the wild. Merging Step 10 strictly *reduces* exposure.
        - **M4 is narrower than recorded.** The audit said neither local dev nor a preview
          exercises the new HTTP gate, because `baseUrl()` sends SSR to production. True for the
          SSR path — but calling `/api/cycle` **directly from the preview page** reaches the
          preview's own function. It returned **401 `{"error":"unauthorized"}`** from a fully
          authenticated browser with no internal secret. So B2's edge gate IS verifiable before
          merge, and it works.
        - **Passed:** `/api/analyze` → 402; `/run` + `/results` → `/pricing?reason=…`;
          `billing_blocked` overriding an `active` subscription (locked, correct banner, Contact
          support link); a subscriber rendering the full page (rating, verdict, radar, report,
          no upsell); the free-view fence at 25 with the "already-seen stocks still open"
          promise verified true rather than assumed; `UpgradeDialog` explaining each feature in
          place; the nav rework (locks, no sidebar Account, no header Run Analysis).
        - **Found + fixed (`ea84d01`):** the four premium surfaces were not equally defended —
          Verdict and Scorecard require `!entitled` **and** the type guard, while the Overall
          Rating tile, Health Score tile and header chips required only the type guard, trusting
          the API strip as their single control. Now all four require both. Surfaced *because*
          of M4: fed unstripped production data, the preview rendered 60/100 and 81/100 to a
          free viewer.
        - **Found + fixed (`686fdd9`):** the middleware's own refusals carried
          `Cache-Control: public, max-age=0, must-revalidate` (NextResponse.json's default) —
          the 401 on `/api/cycle` and, worse, the 402 on `/api/analyze`, whose body names the
          caller's denial reason from their billing columns. Not exploitable (`max-age=0` +
          `must-revalidate` stop reuse), but `public` on a viewer-dependent response is the
          directive that made B1 an authorisation bypass, and it left both refusals safe only
          because of a modifier a later edit could delete. Both now send `private, no-store`.
          Guard section added and **mutation-tested**. Verified on the deployed preview:
          401 → `private, no-store`, 402 → `private, no-store`.
        - **Found + fixed (`10d8ff6`) — the sharpest finding of the session.** `ea84d01` stopped
          an unentitled viewer *seeing* the scores; it did not stop them being *sent*. The cycle
          object reaches client components, so React serialises it into the RSC payload embedded
          in the HTML — the page showed "🔒 Unlock" while the source carried
          `"overallRating":60,"overallLabel":"Neutral","financialHealthScore":81`. The M4 artifact
          again (preview → production's ungated endpoint), so not shipping, but it proved
          `api/cycle.py`'s strip was the **only** control on the payload: a regression there
          would leave the UI looking locked while quietly shipping the data — the failure mode
          that looks safe. `fetchCycleAnalysis` now strips premium keys on the way in at both
          parse seams whenever `entitled` is false. Side benefit: previews stop being silently
          more permissive than production, which is what let this hide in the first place.
        - **Not a defect:** `?reason=no_subscription` deliberately renders no banner (a
          first-time free user shouldn't be scolded); every other reason does. The silent case
          only occurs on direct navigation — the sidebar path opens the dialog.
        - **Geo currency — verified.** Saved country and edge header made to disagree so the
          result is discriminating: profile `country='US'` → **US$15/USD** (the saved country
          wins, which is the billing-currency lock); `country=null` → **A$19/AUD** read from
          `x-vercel-ip-country`. Without the header it would have fallen back to USD, so this
          is the edge geo path, not a default.
        - **Still open after this session:** real Stripe Checkout/Portal in sandbox, and the
          at-merge items.
        - **Tooling note (superseded for Stripe):** use the stable branch alias
          `majorcycle-git-feat-f3-stripe-…vercel.app`, not per-deployment URLs — it follows the
          latest build, so a session survives each redeploy (cookies are per-host, so a new
          deployment URL means signing in again). Preview deployment protection is bypassed for
          non-browser clients with the Vercel MCP's shareable `_vercel_share` link.
      - [x] **SANDBOX CHECKOUT + PORTAL, END TO END — 2026-07-28 (`f8374d0`, `09f1885`,
        `7ff5abe`).** Run on **localhost**, not the preview, and deliberately so: the paying
        half of the loop is the webhook, and a preview cannot receive one — `STRIPE_WEBHOOK_SECRET`
        exists in no Vercel environment, and preview SSO would bounce Stripe's POST before it
        reached the function. `pnpm stripe:listen` forwards real sandbox events with a matching
        secret, which is the only place the full chain runs today. Sandbox account
        `acct_1TrdbF…` (≠ LIVE `acct_1Trdax…`); the forwarder and every harness script refuse a
        live key outright.
        - **The whole loop, verified in order:** free viewer → both scores locked and **zero
          premium keys in 3.29 MB of HTML** → lock opens `UpgradeDialog` → `StartTrialModal` at
          **A$19 AUD** (profile country AU) → real Stripe Checkout, sandbox-badged, *"7 days
          free, then A$19.00 per month starting August 4, 2026"* → card `4242` → **11 webhooks,
          all 200** → `subscription_status='trialing'`, `plan=monthly`, `currency=aud`,
          `trial_ends_at=2026-08-04`, **tombstone written with `email_hash = sha256(email)`** →
          Account shows "TRIAL ACTIVE · runs until August 4, 2026" → sidebar locks gone, `/run`
          open, scores render, **premium keys now present**. Free/entitled symmetry is the proof
          the strip is entitlement-driven and not incidental.
        - **Portal:** opened on `billing.stripe.com` with the trial badge, A$19/month, the 4242
          card. Cancelling set `cancel_at_period_end=true` while status **stayed `trialing`** —
          access is preserved to the end of the paid period, never revoked early — and the card
          switched to *"ends August 4, 2026 and won't renew."* Confirmed still entitled after.
        - **Found + fixed (`f8374d0`) — `UpgradeDialog` offered the wrong door while loading.**
          `ctx === null` meant both "billing context in flight" and "the fetch failed", and both
          rendered a live `<Link href="/pricing">See plans</Link>`. Every reader who opened a lock
          got a real, clickable escape hatch out of the in-place dialog for as long as the request
          took. Loading is now an inert disabled button; only a genuine failure routes to
          `/pricing`. Proven by stalling the fetch: `disabled: true`, click changes nothing, and
          no `/pricing` link exists in the dialog at any point. **Owner-reported.**
        - **Found + fixed (`7ff5abe`) — the analyst chip lost its attribution when entitled.**
          The "Analysts:" prefix was conditional on our own label being *absent*, so a subscriber
          saw "Neutral · Stretched · **Buy**" — a bare Wall Street verb sitting in a row of our
          own judgements, which is exactly what CLAUDE.md #2 forbids. Colour and a `title` were
          carrying the distinction alone, and a tooltip is invisible on touch. Now unconditional.
          **Only a subscriber ever saw this**, which is why the free-tier visual pass on
          2026-07-27 could not have caught it — a standing lesson for paywalled UI: every
          conditional branch needs a viewer who actually lands on it.
        - **Found + fixed (`09f1885`) — three account-surface issues, all owner-reported.** The
          subscription status pill is a flex child, so on a narrow column it shrank and wrapped
          its own label to two lines *inside* the rounded border; it now refuses to shrink and the
          row top-aligns. Sidebar licence status uppercased (in CSS, not in `LICENCE_LABELS`, so
          the strings stay prose for screen readers). Refer-a-friend dropped "— they can create a
          free account, no card needed": a free account is what every visitor already gets, so
          framing it as part of an invite reads as an offer when it is not. The referral **email**
          keeps the line deliberately — it goes to someone who has never heard of MajorCycle.
        - **Gates after:** typecheck, lint, entitlement guard (9), report sections (22),
          **Playwright 83/83**. Sandbox reset to 0 customers / 0 live subscriptions; DB reset to
          0 tombstones / 0 `stripe_events` / no subscribed profile.
        - **Noted, no action:** Stripe Checkout now renders an **"I am an AI agent acting on
          behalf of someone else"** disclosure control. It is genuine Stripe UI (agentic
          commerce), not injected content, and it appears on the live checkout too.
        - **Gotcha — self-inflicted, worth recording.** Ad-hoc scratchpad scripts hit
          `UND_ERR_CONNECT_TIMEOUT` against `api.stripe.com` and Supabase. This *is* the known AAAA
          stall, and the repo already fixes it: `web/scripts/prefer-ipv4.mjs` (`preferIPv4()`,
          `family: 4`) is wired into `instrumentation.ts`, `stripe-listen.mjs` and
          `playwright.config.ts` — which is why `pnpm stripe:listen` worked all session while the
          throwaway scripts beside it did not. **One-off tooling must import `preferIPv4()` too.**
          Note the AAAA *query* stalls even when there is no AAAA record to return, so "the host is
          IPv4-only" does not rule this out — and `--dns-result-order=ipv4first` still doesn't help,
          because it reorders results *after* resolution.
      - [x] **DISPUTE LIFECYCLE, END TO END — 2026-07-28 (`aabc865`).** Owner asked whether the
        dispute path had ever been checked *against the paywall*. It had not, and the reason is
        a timing trap: disputes were live-checked on **2026-07-24**, at Step 8, when the paywall
        did not yet exist (Step 10 landed on the 26th). So "dispute → `billing_blocked`" was
        proven, and "`billing_blocked` → locked" was proven separately by e2e and the preview
        check — but **always by setting the column directly**. No run had ever crossed the seam,
        which is where `resolveUserIdFromDispute` lives: a dispute carries a charge id, not a
        customer, so the webhook does its one live Stripe retrieve there **and swallows failure**.
        If that retrieve breaks, both halves still pass their own tests and the chargebacker keeps
        full access.
        - **Seam proven.** A real `pm_card_createDispute` charge fired `dispute.created` +
          `funds_withdrawn` → attributed to the right profile → `billing_blocked=true` with
          `subscription_status` untouched at `active` → the page lost both scores, **premium keys
          left the wire entirely**, `/api/analyze` answered **402 `billing_blocked`** (not
          "no_subscription" — a chargeback must not be reported as "update your card"), and
          `/run`, `/results` and the report all redirected to `/pricing?reason=billing_blocked`.
          Stripe test mode then auto-resolved the dispute ~2 min later, which incidentally proved
          the other half live: `funds_reinstated` + `closed(won)` → access restored.
        - **🔴 The money bug.** Losing a chargeback cancels the subscription, so a lost dispute
          lands on **`canceled` + `billing_blocked`** — and `canceled` is precisely the status
          allowed to re-subscribe. `/api/checkout` never checked `billing_blocked`, so the blocked
          user could **pay again and still be denied**, because the block outranks any status.
          Money taken for access we then refuse. Checkout now **403s** a held account.
        - **🟡 The honesty bugs.** `billing_blocked` is orthogonal to `subscription_status` (a
          disputed account keeps its Stripe status), and both status displays read the status
          alone: the sidebar badge announced **ACTIVE**, and the account card said **"ACTIVE —
          You're on the Monthly plan"**, to someone locked out of everything, with no mention of
          a hold anywhere. Both now read **"On hold"** with the reason; the card's action becomes
          support rather than a plan button.
        - **UX, owner-directed.** A lock now explains the hold instead of pitching a subscription
          (an upsell there is an offer checkout refuses). Support opens **in place** as a dialog
          — same treatment as the upgrade dialog, reusing the same form and server action,
          prefilled — rather than throwing a signed-in reader onto public `/contact`.
        - **Flash fixed.** Billing context is fetched **once per page at mount** and shared by
          every lock, not per dialog-open. Fetching on open meant the answer landed after the
          dialog was already on screen, so a held reader saw the upsell for a beat before it
          corrected itself. Same failure as the `See plans` flash: a placeholder that *asserts*
          something about the reader.
        - **Also verified this pass:** Supabase advisors re-run — 9 INFO `rls_enabled_no_policy`,
          identical to the M1 baseline, all service-role-only tables where deny-by-default is
          intended. **Playwright 88** (3 new dispute tests). Sandbox + DB reset to baseline.
        - **Flake noted:** a first full run had 2 failures that did not reproduce (a webhook route
          answering 404, a free-tier redirect) — first-hit route compilation under `next dev`,
          not a regression. Worth watching if it recurs in CI.
      - [x] **PAYWALL UX REWORK — signed-in users never leave the app (2026-07-29, `ba3a6f2`).**
        Owner challenge: *"why do you always create a public page for all this? everything is
        happening for the logged-in user."* They were right, and the audit found it was worse
        than the original complaint.
        - **What was wrong.** `/run`, `/results` and the report `redirect()`ed an unentitled
          viewer to the public `/pricing` page — sidebar, header and account menu gone, landing
          on a page that reads as signed-out. A dispute-held reader was then sent *onward* to
          `/contact` to retype a name and email we already hold. That second jump was a defect I
          had introduced two commits earlier while fixing the P2 pricing hole.
        - **Fix.** `requireEntitled()` → **`requirePremiumPage()`**, which REPORTS entitlement
          instead of redirecting on it; each page returns the new `PremiumLockPage` in place.
          Still redirects signed-out→`/login` and mid-deletion→`/reactivate`. Because the gate
          no longer enforces, **the page's early return IS the enforcement** — it sits before any
          premium fetch, and `check:entitlement-gates` now asserts *both* halves.
        - **`/pricing` is signed-out-only.** A signed-in visitor redirects to `/account`. That
          let the page drop six branches (`?reason=`, `billing_blocked`, `hasSubscription`,
          `trialUsed`, `?start=`, the support dialog) that no reachable reader could hit any
          more. Owner also rejected an interim plan-preselect + "pick up where you left off"
          banner as over-complex — **nothing is carried across; `/account` says the right thing
          on its own.** Four other exits to `/pricing` repointed (mid-run alert, daily-fence
          notice, UpgradeDialog fallback, Stripe `cancel_url`).
        - **Report preview page DELETED.** Nothing had ever linked to it — Download Report builds
          the file client-side from `/report/data` + the offline bundle — yet it rendered the full
          scorecard server-side and had to be gated, cached and kept in step with `ReportDocument`
          forever. `ReportDocument`, `report-data.ts` and the `.report-page`/`.report-doc` CSS all
          STAY: the CSS is the downloaded file's `<body>` class, not dead.
        - 🔴 **REAL BUG found by the e2e written to replace that page's coverage:**
          `/report/data` sent **no `Cache-Control` at all**, on any branch, on a full-scorecard
          payload. Its safety rested on Vercel happening not to cache an uncacheable-*looking*
          response. Now `private, no-store` everywhere + guarded. Second occurrence of the
          CLAUDE.md 11a class; the rule was updated to say the missing header is itself the bug.
        - **Verified:** 33/33 entitlement e2e, typecheck, lint, build, both static guards, plus
          browser checks of free / dispute-held / active on `/run` and `/results`.
      - [x] **CHECKOUT→WEBHOOK RACE CLOSED (2026-07-29, `b2d2343`).** Found while grounding the
        live-check plan in the Stripe docs, *before* it could bite in production.
        - **The gap.** Stripe sends `checkout.session.completed` BEFORE redirecting and holds the
          redirect for our 2xx — **but only 10 seconds**, then redirects regardless. Our
          `success_url` carried no session id and `/account` ignored `?checkout` entirely, so a
          slow/failed/misconfigured webhook put someone who had just paid on a page reading
          **"No plan"**, beside a button inviting them to subscribe again.
        - **Fix (Stripe's documented belt-and-braces).** Webhook stays the guarantee (runs even
          if they close the tab; retried 3 days). `success_url` now carries
          `{CHECKOUT_SESSION_ID}` and `/account` runs `reconcileCheckoutSession()` before it reads
          the profile. `/account` also finally *says* something: "Payment received", or after
          cancelling, "You haven't been charged."
        - **Not a second source of truth.** It re-retrieves the subscription from Stripe and runs
          the SAME `syncSubscription()` the webhook runs — which is why that function + helpers
          moved to `web/lib/billing/sync.ts` instead of being copied. Two derivations of "who has
          paid" would drift. The webhook contract tests (**21/21**) are what proved the extraction
          was behaviour-preserving.
        - **Security.** `session_id` comes from the URL bar, so it is never proof: the session is
          fetched from Stripe and refused unless its own `client_reference_id` matches the caller.
          Two e2e cases assert a forged id grants nothing and still renders. Re-retrieving the
          subscription (not the session's embedded copy) also stops a stale session overwriting
          newer state. Note `payment_status` is `no_payment_required` for a 7-day trial — treating
          that as unpaid would refuse exactly the flow we sell.
        - **Verified:** entitlement e2e 35/35, webhook 21/21, typecheck, lint, guards.
          ⚠ **The happy path is NOT yet proven live** — that is a next-session check, deliberately
          run with the webhook forwarder OFF so only the reconciler can provision.
      - [x] **LIVE-CHECK SESSION 1 — static + identity surfaces (2026-07-30, `66c46f2` + `2f4f98b`).**
        First of the multi-session Layer F live-check plan (`~/.claude/plans/lovely-napping-neumann.md`).
        Gates first: typecheck, lint, build, both guards, **pytest 86**, **Playwright 95 → 99**.
        - **Passed:** all 7 public pages 200 with the disclaimer, every gated route 307 → `/login`
          with `next` preserved; `/pricing` signed-out is a plain shop window (**US$126/yr is
          exactly 30% off** $180) and signed-in redirects to `/account`; `/login` + `/signup`
          redirect to `/stocks`; recovery confinement holds and self-heals on fresh login;
          deletion-scheduled sends **both** `/account` and `/run` to `/reactivate` (deletion
          outranks billing); contact honeypot accepts silently with **zero** emails sent while a
          real submission is **delivered** with `reply_to` set to the sender; self-referral blocked.
        - 🔴 **TWO DEFECTS FOUND + FIXED (`66c46f2`)** — both the same shape as the dispute-hold
          bug: *a surface reading one dimension when the truth needs two.*
          1. **A lapsed `past_due` account was told its access was intact.** The status is identical
             either side of the 3-day grace window while the access is opposite, but `/account`
             never selected `grace_until` — so a reader whose grace had closed got "update your
             card to **keep access**". The sidebar said PAYMENT DUE in both states too, while the
             lock icons beside it (same `entitled` it already had) said otherwise. Both now split
             on entitlement via the shared `hasAccess`; lapsed reads **"Access paused"**.
          2. **"Payment received — your plan is set up below" printed above "No plan".** The banner
             came from the URL param before reconciliation ran, and `reconcileCheckoutSession`'s
             return value was **discarded** — so it made that claim in precisely the slow-webhook
             case the reconciler exists for. Now chosen after the fact, with an honest
             "still setting your plan up" when nothing is provisioned yet.
          Neither was a security hole (the paywall locked all these readers correctly) — both were
          honesty bugs on the paid surface. **4 new e2e cases assert BOTH halves of each fix**, so
          an over-correction fails too.
        - **Paywall re-verified live after the fixes:** free Stock Detail = **3.16 MB of HTML with
          zero premium keys and zero `NN/100`**, free data intact; an `active` viewer gets all four
          premium keys and the scores render (59/100, 81/100) — proving the strip is
          entitlement-driven, not blanket. `/run` locked in-place for free and for lapsed
          `past_due`, open for `active`. `/api/analyze-dev` **402 `payment_failed`**, `/api/cycle`
          without the secret **401**, `/report/data` **402** — all `private, no-store`.
        - **Stripe dashboard read (live + sandbox, identical)** — see data-contracts for the
          durable record: failed-payment terminal state is **`cancel the subscription`** (so
          `canceled`, never `unpaid` — our rule already denies both), and **all five Stripe
          customer emails are OFF**, which is what makes our branded Resend senders the single
          voice. Owner decision 2026-07-30: leave the one-time "trial over" statement-descriptor
          message **off** — the descriptor already names the site.
        - **Still open from Session 1:** nothing. Sessions 2–5 (paywall/wire-level, billing
          lifecycle on a test clock, fix sweep, merge day) remain.
      - [x] **LIVE-CHECK SESSION 2 — the paywall at the wire (2026-07-30).**
        Gates first: typecheck, lint, build, both guards, **pytest 86**, **Playwright 99**.
        Every Layer F app surface driven across **all twelve viewer states**, asserting on the
        raw body and the response headers rather than on what renders.
        - **The paywall holds, and it is entitlement-driven rather than blanket.** Free Stock
          Detail = **3.16 MB of HTML, zero premium keys, zero `NN/100`**; an entitled viewer at
          the same URL gets **7** score readings and `/report/data` returns all **nine** premium
          keys. The same probe proves both, so "safe" cannot be an artifact of the data simply
          being absent.
        - **Denied states are refused honestly and in place.** `/run` and `/results` return the
          locked panel **at the same URL inside the app shell**, each carrying the caller's own
          reason — lapsed `past_due` → "We couldn't take your last payment", `canceled` → "Your
          subscription has ended", `billing_blocked` → "Your account is on hold" — and a
          first-time free reader correctly gets **no** warning banner at all. `/api/analyze-dev`
          and `/report/data` both 402 with the matching `reason` in the body
          (`no_subscription` / `payment_failed` / `canceled` / `billing_blocked`), all
          `private, no-store`.
        - **Signed out, every gated surface 307s to `/login`** with `next` preserved — pages,
          route handlers and both POST endpoints alike. `/api/cycle`: **401** for anonymous and
          **401** for a wrong secret (both `private, no-store`), while the correct secret passes
          the proxy gate. `/api/stripe/webhook` unsigned → **400**, the merge-day liveness probe.
        - **Also confirmed:** the free 25-ticker fence stops a **new** stock while still serving
          an **already-seen** one; `/api/portal` gives all three outcomes (`?billing=none`,
          `?billing=blocked`, `?billing=error`); `/api/checkout` 409s a double-subscribe and
          403s a held account; `/request` stays free for everyone; bad market/ticker on
          `/report/data` → **404 `private, no-store`** (refusals carry the header too);
          deletion-scheduled really is confined to `/reactivate`; the onboarding modal blocks
          the page for an unacknowledged reader; and a **free** viewer keeps the drawdown
          overlay **with its cycle bands** plus all 22 sections.
        - 🟡 **Three findings, none a leak.** Recorded here as discovered; **ALL THREE CLOSED the same day** — see the Session 2 fix sweep immediately below.
          1. **`api/analyze.py` is the one premium route with no header guard.** It sends
             `Cache-Control: no-store` on every branch, which Vercel honours, but the house rule
             (11a) is `private, no-store` and `check:entitlement-gates` asserts that for
             `api/cycle.py`, `proxy.ts` and `/report/data` — not for the route returning the
             full screener payload. Align the header and add a 10th static check.
          2. **Nothing rejects a *second* completed Checkout Session.** Three concurrent POSTs
             each returned a distinct session; the 409 guard runs at session *creation*, while
             `customer.subscription.created` overwrites `stripe_subscription_id` unconditionally
             at *completion*. Abandon-then-retry-then-complete-both would leave two live Stripe
             subscriptions billing with only the second on file, and decision #21 means no
             refund. **Not yet reproduced end to end** — confirm in Session 3, which already owns
             the checkout race.
          3. **`pnpm build` and the dev/e2e servers share `web/.next`.** A stale production build
             makes real routes return HTML 404s; it cost time in Session 1 and again here, where
             it made a *paywalled* route look like a broken gate. A false security signal during
             the checks meant to find real ones deserves more than the anti-pattern note it has:
             give the dev/e2e server its own `distDir`.
        - **A "200" is not proof the guard failed.** `/run` and `/stocks` returned 200 for a
          deletion-scheduled account, which reads as confinement broken — but the bodies carry
          `NEXT_REDIRECT` to `/reactivate`: Next emits a server-component `redirect()` inside a
          streaming 200 once the shell has flushed. Check the body for the marker, not the status.
        - **Two probe markers were worthless and nearly produced false findings** — "reactivate"
          and "Run Analysis" both appear in every page's nav, and the onboarding modal is
          client-rendered so it is absent from the SSR HTML entirely. Grep for copy unique to the
          state, and confirm anything client-rendered in a real browser.
      - [x] **SESSION 2 FIX SWEEP — all three findings closed (2026-07-30).** Brought forward
        from Session 4 at the owner's request; each fix is proven, not merely written.
        - **A — `api/analyze.py` now sends `private, no-store`** on every branch, matching
          `cycle.py`, plus a **10th static check** in `check:entitlement-gates` asserting both the
          header and the absence of `s-maxage`/`stale-while-revalidate`. The guard was verified to
          actually fail: weakening the header to bare `no-store` and, separately, injecting
          `s-maxage=60` each turned CI red, then the file was restored. `/api/analyze-dev` got the
          same header on all four branches — a dev stand-in that answers differently from
          production is a test that lies, and its silence is why the local checks could never have
          caught this.
        - **B — a second completed Checkout Session is now refused.** `rejectDuplicateSubscription`
          in `lib/billing/sync.ts` runs inside `syncSubscription`, so it covers **both** writers
          (the webhook and the checkout landing page's reconciler). If a *different* subscription is
          already on file, it **retrieves that one from Stripe** before judging — our column can name
          a subscription that is already dead, because event order isn't guaranteed, and cancelling a
          real plan in error would be far worse than the duplicate. Live states are
          `active`/`trialing`/`past_due`/`unpaid`; **`incomplete` is excluded** so a retry after a
          declined card is never mistaken for a duplicate. On a confirmed duplicate the **incoming**
          subscription is cancelled (the incumbent owns the billing anchor and consumed any trial)
          and the profile is left untouched. If the retrieve fails, it falls through and writes
          normally — never cancel on a guess.
          **Proven in the Stripe sandbox with two REAL subscriptions on one customer:** the duplicate
          came back `canceled` while the profile stayed on the first; and with the incumbent genuinely
          cancelled, a re-subscribe was still accepted and recorded. A committed e2e pins the
          fail-safe half (synthetic ids ⇒ unverifiable incumbent ⇒ must fall through, never cancel).
          **Cancelling does not refund** — a duplicate caught while `trialing` was never charged, but
          a charged one needs a manual refund, so the guard logs both ids loudly. Worth an alerting
          path once Sentry lands in Layer H.
        - **C — dev and build no longer share `web/.next`.** `next.config.ts` sets
          `distDir = '.next-dev'` under `NODE_ENV=development`; `next dev` and `next build` set that
          themselves, so nothing has to be passed or remembered. Verified: a production build sits in
          `.next` with its `BUILD_ID` intact while the dev server runs from `.next-dev`. Needed
          `.next-dev/**` added to the eslint ignores and both `.gitignore`s.
        - **Owner-requested rename: `/report/data` → `/report`.** The `data` segment only ever existed
          to sit beside an on-screen `/report` preview page, deleted 2026-07-29 when nothing was found
          linking to it — so the suffix named a distinction that no longer existed. Verified signed-in:
          `/report` → **402 `no_subscription`** free / **200, 3.2 MB, `private, no-store`** subscribed,
          and the old path is cleanly **404**. Callers, the CI guard path, the e2e constant and every
          doc updated. **Trade-off accepted:** Next.js forbids a `page.tsx` and a `route.ts` in one
          segment, so this forecloses ever re-adding a `/report` page — intended, as the download is
          now the report's only form.
      - [x] **LIVE-CHECK SESSION 3 — the money actually moving (2026-08-01).**
        Gates first and last: typecheck, lint, build, both guards, **pytest 86**, **Playwright 100**.
        Everything below ran against the Stripe **sandbox** on real test clocks, with the DB and the
        sandbox returned to baseline afterwards. The destructive halves (delete, purge) ran on
        **throwaway accounts**, never the owner's — the purge cron hard-deletes.
        - **The full subscription lifecycle, end to end on one clock.** day 0 `trialing` + tombstone
          written + `trial_ends_at` +7d → day 4 `trial_will_end` sets `trial_reminder_sent` → trial
          converts and the account **stays `active`** (the Step-4 regression where `invoice.paid`
          clobbered `trialing` does not recur) → a renewal advances `current_period_end` → a forced
          decline (`pm_card_chargeCustomerFail`, Stripe's documented 4000…0341) gives `past_due` +
          `grace_until` = now+3d with **access still intact** and the honest "we couldn't take your
          last payment" notice → past the window the lock is hard (**scores 7 → 0**, `/report` and
          `/api/analyze-dev` **402 `private, no-store`**, `/run` and `/results` showing the *payment*
          reason and never "your trial ended") → card fixed → `active`, `grace_until` cleared, access
          restored. ⚠ **The +3-day step was simulated by ageing `grace_until`, not by the Stripe
          clock** — grace is anchored on our own server time (`Date.now()`), which a test clock cannot
          move. Everything either side of it is genuine.
        - **3-D Secure is a real path and shares the dunning route.** `pm_card_authenticationRequired`
          on a renewal fired **both** `invoice.payment_failed` and `invoice.payment_action_required`
          for the same invoice; the account went `past_due` with **one** grace anchor and **one**
          email. That single-owner `grace_until` guard is what stops a customer being emailed twice
          about one failure — same for recovery, where `invoice.paid` and `invoice.payment_succeeded`
          both fire and only the first to clear the marker sends.
        - **A dispute *inquiry* must not lock a paying customer, and doesn't.**
          `pm_card_createDisputeInquiry` produced `charge.dispute.created` with status
          `warning_needs_response` and `billing_blocked` stayed **false**. A real
          `pm_card_createDispute` on the same customer flipped it **true** (with the subscription
          still `active` — state S7) and the app refused in place with the *on hold* copy; closing it
          **won** restored access. The whole cycle driven by the webhook, not by hand-set columns.
        - 🟢 **The checkout reconciler works in anger — its first real test.** With `stripe listen`
          **killed**, a real 4242 payment landed the user on `/account?checkout=success&session_id=…`
          reading **"Payment received — your plan is set up below" / TRIAL ACTIVE**, not "No plan".
          Conclusive because `stripe_events` held **zero** rows for that user while the profile was
          fully provisioned: nothing but `reconcileCheckoutSession()` could have written it. Restarting
          the forwarder and **resending the three missed events** left the row **byte-identical** —
          idempotent, exactly as designed. Adversarially, user B pasting user A's real `session_id`
          (and a well-formed nonexistent one, and junk) granted **nothing**: profile still all nulls,
          and the honest "still setting your plan up" wording — the Session-1 fix — rather than the
          confident one.
        - **The four seams, each crossed for the first time since the paywall existed.**
          *Delete with a live subscription* → Stripe `cancel_at` set to period end (**scheduled, never
          cut short**), `deletion_scheduled_at` +30d, global sign-out, and the confirmation copy tells
          the truth about the paid period; *reactivate* → both undone, access restored.
          *Purge cron* → 401 for no header, a wrong secret, **and a bare secret without `Bearer`**;
          with the right one it hard-cancels the live subscription, tombstones the email **before**
          deleting, and purges — proven on both paths, the stored subscription id **and** the
          customer-id fallback with `stripe_subscription_id` NULL.
          *Tombstone re-signup* → a brand-new account on a purged email is offered **"Subscribe"**,
          not "Start free trial", the modal says *"your free trial has already been used … no free
          week"* **before** payment, and the created session charges **A$19 immediately** (trial
          sessions total 0). A fresh email at the same moment showed "Start free trial" — the control.
          *`/api/portal`* → all three outcomes, and a held account is refused by **both** the portal
          and checkout.
        - **Every branded email verified in Resend's own logs**, from
          `MajorCycle <noreply@majorcycle.com>`: trial-started, trial-ending, payment-failed ×2,
          payment-recovered ×2, deletion-scheduled, account-deleted ×2 — **exactly one each, no
          duplicates**, including the two cases where two Stripe events hit one handler. A repo-wide
          grep found **no** reply-inviting language in any template, and the ones that offer support
          point at `majorcycle.com/contact`.
        - 🟡 **Two findings, neither a leak.** Recorded here as discovered; **BOTH CLOSED the same day** — see the Session 3 fix sweep immediately below.
          1. **`/api/portal` and `/api/checkout` state no caching posture at all** (observed at the
             wire: no `Cache-Control` whatsoever; Next sets nothing on route handlers, unlike pages).
             Both return a **credential-equivalent, single-customer** payload — the portal `Location`
             is a live session granting card details, invoices and the cancel button. Nothing is
             exposed today (Vercel caches only on `s-maxage`, and these are POSTs without one), which
             is precisely the "safe because of someone else's default" class rule 11a records as
             having happened three times. Only 3 of 15 route handlers say anything. Say
             `private, no-store` and **guard it**.
          2. **Deletion confinement stops at the pages.** Every page correctly streams
             `NEXT_REDIRECT` → `/reactivate`, but `GET /report` returns **200 with the full 3.2 MB
             paid report**, `POST /api/analyze-dev` returns the full premium payload, and
             `POST /api/portal` 303s into a live portal session — for an account the app has just
             declared deactivated and signed out everywhere. The portal is the sharp one: its config
             (verified this session) allows price switches with prorations and a renew action, so a
             to-be-purged account can spend money and un-cancel the very subscription the delete flow
             just scheduled to stop. This is the sentence already written into `/api/portal` for the
             dispute case — *"the endpoint must not depend on the UI hiding it"* — applied to the one
             case where it still does.
      - [x] **SESSION 3 FIX SWEEP — both findings closed, plus the Stripe key (2026-08-01).**
        Brought forward from Session 4 at the owner's request. Each fix proven, and each new
        guard broken on purpose first to prove it can fail.
        - **A — `/api/portal` and `/api/checkout` now state `private, no-store`** on every
          branch, refusals included. An **11th** static check asserts three things per file:
          the constant is present and is exactly `private, no-store`; no shared-cache directive
          appears; and the count of `headers: NO_STORE` **matches the count of NextResponse
          returns**, so a single unguarded branch fails. Verified to actually fail three ways —
          dropping NO_STORE from one portal branch, weakening the constant to bare `no-store`,
          and injecting `s-maxage=60` — then restored.
          **Same defect found while fixing, wider blast radius:** `proxy.ts`'s three redirects
          were equally silent — the signed-out bounce to `/login` (which fires on **every**
          gated path), the recovery confinement, and the signed-in bounce off `/login`. All are
          per-viewer: whether the bounce happens at all depends on the caller's session. In the
          opposite direction from a leak — a cached bounce would *deny* a signed-in user — but
          the file already held the constant for its 401/402, so three bare siblings were an
          omission. Wire-verified: signed-out portal/checkout/page all 307 with the header.
        - **B — deletion confinement now reaches the route handlers.** `deletion_scheduled_at`
          is evaluated **before** entitlement in `proxy.ts` (covering `/api/analyze` and its dev
          twin), in the report route, in `/api/portal` and in `/api/checkout` — which had no
          deletion check at all and merely *happened* to 409 in testing because that account
          also had a subscription. **403 `account_deleting`**, never 402: 402 invites someone
          whose account is being deleted to pay again, and they may already have paid. The
          portal redirects to `/reactivate` — the one page such an account may use, and
          reactivating makes the portal legitimately available again.
          **Proven at the wire on an ENTITLED deleting account** (an unentitled one would be
          refused by the paywall anyway, masking whether the check exists): `/report` 200 → **403**,
          `/api/analyze-dev` 200 → **403**, `/api/portal` Stripe session → **303 `/reactivate`**,
          `/api/checkout` → **403**, all `private, no-store`, while `/reactivate` still renders.
          **And the mirror image**: clearing `deletion_scheduled_at` on the *same* account
          restored all of it — report 3.2 MB, screener 200, the real Stripe portal, checkout
          409 (already subscribed), `/reactivate` now redirecting away. An over-correction that
          locked out paying customers would have been just as wrong. Two e2e cases pin both
          halves; a **13th** guard check covers all four surfaces plus the proxy's `select`
          (a check without the column could only ever read `undefined` — fail open). All five
          sabotages went red.
        - **LIVE Stripe key: `Customers` dropped from Write to None** (owner typed the 2FA
          code; key value unchanged, so no redeploy). Proven first in the sandbox with an
          identically-scoped restricted key: all nine calls the app makes succeeded —
          including `checkout.sessions.create` with `customer_email`, the one that makes Stripe
          create a Customer, and `billingPortal.sessions.create` — while `customers.create` and
          `customers.retrieve` were refused with `StripePermissionError`. That control is what
          makes the nine passes meaningful. The throwaway sandbox key was expired afterwards
          (Stripe renders test keys in plaintext). Live key now holds exactly: Subscriptions W,
          Checkout Sessions W, Customer Portal W, Prices R, Charges R — each re-verified.
        - **Owner decision — NOT doing the "paid during deletion" handler.** The idea (auto-cancel
          the deletion and email the customer when a subscription lands on a deleting account) was
          the owner's, then withdrawn as too unlikely to be worth the machinery. **Residual risk,
          recorded deliberately:** `/api/checkout` now refuses to *create* a session for a deleting
          account, but a session created **before** the deletion can still be completed from
          browser history within Stripe's 24-hour window. That writes a live subscription onto an
          account the purge cron destroys within 30 days — a real charge for a repeat customer
          (a first-timer would be on a trial, so no money moves). Nothing detects it today.
      - ✅ **CLOSED 2026-08-01 (Session 4) — the sandbox key is now scoped like the live key
        (owner spotted the drift).** The live key had been a restricted `rk_live_` with 5
        permissions since 2026-07-26 while the local/sandbox `STRIPE_SECRET_KEY` was still a
        **full-access `sk_test_`** — pure drift, the sandbox key predating the hardening.
        **It mattered for the same reason the `/api/analyze-dev` finding did: a dev stand-in
        that behaves differently from production is a test that lies.**
        **What shipped:** a restricted `rk_test_` with scope *identical* to live
        (Subscriptions/Checkout Sessions/Customer Portal write, Prices/Charges read,
        **Customers None**) in `STRIPE_SECRET_KEY`, plus a **separate** full `sk_test` in the
        new `STRIPE_TEST_ADMIN_KEY` for the harness and `pnpm stripe:listen`, which
        legitimately need test clocks, disputes and fake customers. One restricted key per use
        case is Stripe's own guidance.
        **Proven, not assumed:** all 9 shipped call sites passed on the restricted key while
        `customers.create`/`retrieve`/`list` were refused with `StripePermissionError` — the
        refusals being the control that makes the passes mean anything — and the full
        Playwright suite (102) re-ran green under it.
        **The split is necessary, not cosmetic:** `GET /v1/account` returns **403** on the
        restricted key and **200** on the admin key, so `stripe:listen` genuinely could not run
        on the app's key. Guarded by the **dev-harness-key section** of `check-entitlement-gates.mjs`, which fails
        the build if anything under `app/`, `lib/`, `api/`, `components/` or `proxy.ts` reads
        `STRIPE_TEST_ADMIN_KEY` — the tempting "fix" for a permissions error, and one that
        would pass locally then throw in production, where the variable does not exist.
        Broken four ways before being trusted (fallback in `lib/stripe.ts`, a deep route
        handler, the Python bundle, and an empty file walk).
      - 📌 **One correction to the record.** The entry above originally said local dev **and CI**
        were more permissive than production. CI's extra permissions were real but the stated
        consequence was wrong: it is not that CI never reaches Stripe — the forged-`session_id`
        test really does call `checkout.sessions.retrieve` and gets a 404 back, visible as a
        Stripe request id in the e2e server log. That call is covered by the restricted key's
        Checkout Sessions permission, which is why the suite still passes. Noted because the
        original claim would have made someone think CI was a safe place to catch this; it is
        not, and local dev remains where nearly every real Stripe call gets exercised.
      - **Otherwise nothing blocking.** The LIVE key permission question is closed.
      - **Deferred:** SEO/public pages; the arrays-instead-of-objects RPC encoding; Supabase Auth
        percentage-based connections; revoking `anon`'s table-level UPDATE on `profiles`;
        **375px mobile — pre-existing, already triaged to Layer H, now measured there.**
      - No merge to `main` until the owner-driven live guided check passes and the owner approves.

---

### 🚦 Layer F go/no-go — Session 4 sign-off (2026-08-01)

Every check from the four live-check sessions, its result, and **the evidence that produced
it**. The evidence column matters more than the tick: each of these sessions found a real
defect that the existing tests had missed, and in every case what found it was looking at the
running system from outside rather than reading the code.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Standing gates from cold caches | ✅ GO | typecheck · lint · build · entitlement-gates **14** · report-sections **22** · pytest **86** · Playwright **102** |
| 2 | Public + legal pages, signed out and in | ✅ GO | S1 walk; disclaimer present on every rating surface (#12) |
| 3 | Auth surfaces + recovery confinement | ✅ GO | S1; `token_hash` confirm, `scope:'local'` sign-out, open-redirect guard |
| 4 | `/account` across all 9 billing states | ✅ GO | S1; **2 honesty defects found and fixed** (#68 locked-out user told access intact; #69 "Payment received" when provisioning had failed) |
| 5 | Paywall at the wire, all 12 viewer states | ✅ GO | S2; asserted against **raw HTML and headers**, never the screen — the method that caught a score sitting in View Source behind a "🔒 Unlock" |
| 6 | `/api/cycle` **both** halves | ✅ GO | S2; 401 to a stranger **and** 200 to our own render — checking only the first would blank the product while every security assertion passed |
| 7 | Premium routes' cache posture | ✅ GO | S2 + S3; all now say `private, no-store` explicitly; **CI checks 9 + 11** assert the `NO_STORE` count *equals* the `NextResponse` count |
| 8 | Full billing lifecycle on a test clock | ✅ GO | S3; trial → convert → renew → decline → grace → hard-lock → recover, real money moving in the sandbox. **Caveat recorded honestly:** the +3-day hard-lock step was forced by ageing `grace_until` in SQL, because grace is anchored on server time and a test clock cannot move it |
| 9 | Dispute inquiry vs real chargeback | ✅ GO | S3; inquiry must **not** lock, `charge.dispute.created` must |
| 10 | The checkout race, `stripe listen` **killed** | ✅ GO | S3; 0 webhook events for that user, account still provisioned by the reconciler; replay byte-identical. First time that safety net had ever run in anger |
| 11 | The four account↔billing seams | ✅ GO | S3; delete↔billing, reactivate, purge cron (incl. customer-id fallback), tombstone re-signup — each proven **before** the paywall existed, so each was re-crossed |
| 12 | Deletion outranks entitlement, everywhere | ✅ GO | S3-B; 403 `account_deleting` from report/analyze/checkout, 303 `/reactivate` from portal — wire-proven on an **entitled** deleting account *and in reverse* |
| 13 | Branded emails, each sent once | ✅ GO | S3; verified in Resend's own logs, not by reading our senders |
| 14 | Sandbox key scoped like live | ✅ GO | S4; 12/12 — 9 app calls pass, `customers.*` refused. **The refusals are the control** |
| 15 | Harness key cannot reach shipped code | ✅ GO | S4; the dev-harness-key section of `check:entitlement-gates`, broken 4 ways before being trusted, incl. an empty file walk |

**Merge-day items — ALL CLOSED 2026-08-01, except F which is deliberately deferred:**

| # | Item | Outcome |
|---|---|---|
| A | LIVE `STRIPE_SECRET_KEY` in Vercel **Production** | ✅ **Was already done** — this row was WRONG when written. Read back from the Vercel env list on merge day: Production entry added **Jul 26** (live key, Sensitive), plus a separate Preview entry from Jul 16 holding the test key. The "Preview-only today" claim was a stale note carried forward, and §2's own audit table had already corrected it once. **Lesson: a go/no-go row must cite a reading, not a memory.** |
| B | LIVE webhook at `https://www.majorcycle.com/api/stripe/webhook` | ✅ `we_1TzaT1K8OQZXQEminyKXmO3M`, `livemode: true`, enabled, 13 events, `api_version 2026-06-24.dahlia`, one endpoint only — read from `GET /v1/webhook_endpoints`. **Near-miss:** the create URL silently redirected to the *sandbox*; pinning `/acct_1Trdax…/` in the URL is what avoided pointing the test account at production |
| C | `STRIPE_WEBHOOK_SECRET` | ✅ Set in Vercel **Production** only (Sensitive), production rebuilt **without build cache**. Unsigned `POST` → **400 "Missing signature"** — the only proof available, since Stripe cannot send a test event to a live endpoint |
| D | `CYCLE_INTERNAL_SECRET` in Production **and identical in Preview** | ✅ **Stronger than asked:** it is a *single* variable scoped to "Production and Preview", so the two cannot differ — the risk is closed by construction, not by comparison. Independently confirmed on the wire: the documented value was accepted by production's `/api/cycle`, and the page's own fetch reads that same variable |
| E | `/api/cycle` 200+payload → **401** for a stranger | ✅ anon **401** · wrong secret **401** · correct secret **200** with premium keys · `entitled=0` **200 with premium keys absent**. All four carry `private, no-store`. **Both halves**, per §2 |
| F | **Roll the live restricted key** | ✅ **Closed 2026-08-02.** Rolled (Stripe *Roll key*, which replaces the token and preserves the permissions — *Edit key* would have kept the value). New value → Vercel Production → redeploy **without build cache** → proved on the wire. Permissions re-read from the Dashboard after the roll: the same five, **Customers = None** |

**Product-level proof in production** (throwaway free account, asserted on raw HTML, account
deleted afterwards): Stock Detail **200 / 3.12 MB with "Current Drawdown" present** — so the
cycle really renders and D's blackout risk is closed in fact, not just in config; **no
premium keys and no `NN/100` patterns anywhere in the HTML**; lock affordance and the
"not financial advice" disclaimer both present; `/run` served **at the same URL** with the
locked panel rather than a redirect; `/report` **402** with `private, no-store`.

> **Rollback trigger, agreed in advance:** any of A–E failing → Vercel instant rollback. No
> debugging in production. **Not needed — none failed.**

---

### 🚀 Session 5 — MERGE DAY, 2026-08-01. Layer F is live.

`feat/f3-stripe` → `main` via **PR #72**, merge commit **`cd6b014`**, 98 commits (`git rev-list --count cd6b014^1..cd6b014^2`).
Production deployment READY on that commit; `/pricing` did not exist on `main` beforehand
and returns 200 now, which is what proves the live site is running the merged code.

**The PR was the point.** CI runs only on `main` pushes and PRs, so these 98 commits had
never been through it. Opening a PR instead of merging directly caught **two** real failures
that every local gate had passed — an unpinned ruff release breaking the build on untouched
code, and an E2E job with no Python interpreter (both written up in
`docs/coding-standards.md` §13). Third run: all three jobs green, plus Vercel's preview
deploy. **Merging directly would have put both into `main`.**

**Merge-day sequence, in order:** merge → deploy → create the LIVE webhook → set
`STRIPE_WEBHOOK_SECRET` in Production → **redeploy without build cache** (a variable added
after a build does nothing until the next one) → verify. Evidence for each in the table
above.

**Two corrections this session, both from checking rather than remembering:**
- Go/no-go row A ("live key is Preview-only") was **wrong**. It had been in Production since
  Jul 26. A row that cites a memory instead of a reading is worse than no row.
- The Stripe Dashboard's `/webhooks/create` URL **silently redirected to the sandbox**,
  because it remembers the last mode used. Pinning the account id in the URL and confirming
  `livemode: true` from the API is what caught it.

**Still open after merge:** nothing inside Layer F. Row F was closed on 2026-08-02 (see the
section below), and with it the last Layer F item. What remains is the two things the owner
had already scheduled elsewhere — **375px mobile → Layer H**, and **Vercel Hobby → Pro at
official launch** (Hobby forbids commercial use, so that is a *launch* blocker, not a merge
blocker, and it is now the nearest thing to one).

**Accepted residual risks, recorded rather than fixed** (owner's decisions, not oversights):
a Checkout Session created *before* a deletion can still be completed inside Stripe's 24-hour
window (the owner considered and declined the handler — **do not re-propose**); 375px mobile
overflow is triaged to Layer H; Vercel Hobby→Pro is scheduled for official launch, and Hobby
forbids commercial use, so **that is a launch blocker, not a merge blocker**.

---

### 🔑 Key hygiene, 2026-08-02 — the last two Layer F items. **Layer F is now complete.**

Two open keys closed the day after merge. Neither was a defect in shipped code; both were
**a key holding more power, or more history, than it should**.

**(1) The live restricted key was rolled** (go/no-go row F). Its previous value had been read
into a chat transcript on 2026-08-01 while updating `SECRETS.local.md` — no exposure beyond
the owner's own machine and no evidence of misuse, which is why it was deferred rather than
made a merge blocker. Sequence, and the order matters: **roll → paste into Vercel Production →
redeploy without build cache → prove**. Stripe's *Roll key* replaces the token and keeps the
name and permissions; *Edit key* would have preserved the very value we were retiring.

> **Proving a live key works is harder than it sounds, because the safe surfaces don't touch
> Stripe.** `/pricing` renders from hard-coded constants in `lib/pricing.ts` and never calls
> the API, so loading it proves nothing. `resolvePriceId` is reachable from exactly one place
> — `/api/checkout` — so the *only* live Stripe call an authorised person can trigger without
> moving money is creating a Checkout Session and abandoning it. That was the test: the hosted
> page loaded at `checkout.stripe.com/c/pay/`**`cs_live_`**`…` showing **7 days free, then
> A$19.00/month from 9 August 2026**, which proves `prices.list` **and**
> `checkout.sessions.create` both succeeded on the new key. Abandoning costs nothing and does
> not burn the trial: the tombstone is written on `checkout.session.completed`, not on session
> creation ([api/checkout/route.ts:158](../web/app/api/checkout/route.ts)). Permissions were
> then **re-read from the Dashboard** rather than assumed — the same five, Customers = None.

**(2) The CI Stripe key was scoped like production.** The GitHub Actions secret
`STRIPE_TEST_SECRET_KEY` was still a full-access `sk_test_` after Session 4 tightened local dev
and production to a restricted 5-permission key — so **CI was more permissive than production**,
the exact drift Session 4 set out to close, left half-closed. Now the restricted `rk_test_`.
Justified before the change by enumerating every Stripe call in the repo (`prices.list`,
`checkout.sessions.create`/`.retrieve`, `billingPortal.sessions.create`, `subscriptions.*`,
`charges.retrieve` — and no `customers.*` anywhere), then proved after it: CI re-run **green,
102/102, with the Stripe contract tests running rather than self-skipping** — worth checking
explicitly, because those tests skip silently when their credentials are absent and a skipped
suite is also a green one.

**(3) …and then that pair's blind spot was closed, because "the owner says so" is not a control.**
GitHub secrets are write-only and nothing in the app calls `customers.*`, so a full key and a
restricted key were **indistinguishable from CI's output** — green showed nothing broke, not
which key was installed. It is now a test: **`web/e2e/stripe-key-scope.spec.ts`**, three
assertions, run by the very job that consumes the secret.

| Assertion | What it catches |
|---|---|
| key starts with `rk_`, not `sk_` | the blunt mistake — a full key, or the `STRIPE_TEST_ADMIN_KEY` harness key, pasted where the app key belongs |
| `prices.list` **succeeds** | the key being invalid or revoked. Without this the refusal below would pass for entirely the wrong reason |
| `customers.list` **is refused, specifically with `StripePermissionError`** | the key being over-granted. The error *type* is the point: a broken key raises `StripeAuthenticationError` on this call too, which a naive "did it throw?" check would score as a pass |

**Broken on purpose before being trusted, two ways.** (A) The real regression — a full-access
`sk_test_` — gave *2 failed, 1 passed*: `expected a restricted key (rk_…), got a full sk_… key`
and `customers.list SUCCEEDED — this key grants Customers, production does not`. (B) A
syntactically valid but nonexistent `rk_test_` — *2 failed, 1 passed*, this time `Prices read was
refused` and `expected StripePermissionError, got StripeAuthenticationError`.

> **Note which test passed in (B): the prefix check.** A restricted key can be granted
> everything, so the cheap check is necessary and nowhere near sufficient — the other two carry
> the proof. And the first attempt at (B) "failed" on a dev-server timeout, which the break
> harness happily reported as success: **a red run is not automatically red for your reason.**
> It was re-run in isolation before being believed.

This is the only Stripe test that reaches the network — unavoidable, because permissions exist
only on Stripe's side, so the only way to learn them is to be refused. Suite is now **105**
(was 102).

**F1 — Public methodology + contact, CI e2e, Google One Tap polish (shipped 2026-07-07).**
- [x] `/methodology` — public, pre-sign-up plain-English explainer (cycle position, financial
      health, valuation, overall rating + the five compliant tiers, **no formulas**); disclaimer
      above the fold; CTA into the trial. `web/app/(public)/methodology/page.tsx`.
- [x] `/contact` — form → Resend via a server action (`useActionState`); honeypot, input
      validation, `reply-to` = sender; **brand-styled HTML email** (navy header + signature,
      user input HTML-escaped); fails safe to an "email `support@`" fallback when the key is
      absent. `web/app/(public)/contact/{page,ContactForm,actions}.tsx`.
- [x] **Support email:** all public pages point to `support@majorcycle.com` (contact, terms,
      disclaimer, privacy, methodology). `support@` set up as a second Cloudflare Email-Routing
      inbox + Gmail "Send mail as" (Resend SMTP) with its own branded signature + a
      `MajorCycle/Support` label filter — verified live via the Resend + Gmail MCPs.
- [x] **Contact form live:** `RESEND_API_KEY` added to the Vercel project env (+ redeploy); the
      form now sends and the fallback disappears. (`RESEND_FROM_EMAIL` was already present; a
      Resend key is domain-scoped, so the same key serves every `@majorcycle.com` sender.)
- [x] **CI Auth E2E enabled** — repo Variables `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + Secrets
      `E2E_EMAIL/E2E_PASSWORD` set, so the Playwright job runs (was skipping). Suite is now 20
      tests incl. the logged-in flow (dedicated email/password test account).
- [x] **e2e robustness** (`web/e2e/auth.spec.ts`) — wait for the async-mounted onboarding modal,
      poll the idempotent ack-checkbox through hydration, and keyboard-activate Sign out (the
      Next.js dev-overlay portal intercepts pointer events at that corner in dev).
- [x] **Sign-out a11y** — `aria-hidden` on the decorative `LogOut` icon so the button exposes a
      proper accessible name (`web/components/SignOutButton.tsx`).
- [x] **Google One Tap + clean console** — `GoogleSignIn.tsx` initialises GIS exactly once
      (latest handler/label held in refs → no re-init `AbortError` churn), keeps One Tap
      (`api.prompt()`), and installs a narrowly-scoped filter that drops **only** the benign
      `[GSI_LOGGER] … FedCM get() rejects` lines (emitted when there's no eligible Google
      session) while forwarding every other `console.error`. CSP already allows the FedCM
      endpoints (`connect-src`/`frame-src` include `accounts.google.com`).

**F1 email-branding follow-ups.**
- [x] **Unify the contact-form email with the transactional brand** (— F1). Extracted a shared
      wrapper `web/lib/email/brandEmail.ts` (slim gradient header `#010F2C→#063A80` + `email-icon.png`
      + Sora wordmark + grey `#f8fafc` disclaimer footer — design-system.md §17); `/contact`
      (`actions.ts`) now renders through it via `renderBrandEmail()`, replacing the old flat `#1A3A6E`
      header. Table + inline-style only (Gmail/Outlook-safe), gradient has a solid `#04163E` fallback.
      Owner reviewed the before/after markup in-chat. Future app-sent emails reuse the same wrapper.
      Tweaks (owner review): dropped the "reply directly…" line; footer is one `©`-prefixed disclaimer
      line. **Sender changed to `support@majorcycle.com`** (was `noreply@`) via `CONTACT_FROM_EMAIL`,
      since these are messages you actually reply to (reply-to stays the submitter). (PRs #69, #70+.)
- [x] **Sender profile image / BIMI — DROPPED (owner decision 2026-07-08).** The "logo next to the
      sender in the recipient's inbox" = BIMI (one domain-wide logo). Not worth it now: **Gmail** needs a
      paid **VMC** (~US$1k+/yr + a registered trademark) to show it (Apple Mail/Yahoo are free), and it
      requires a simplified ≤32KB **SVG Tiny-PS** (the owner's 1.7MB traced `reference/email-logo.svg`
      is too large/complex). Revisit only with a trademark + revenue. **Email-hosting review done:**
      staying on the free Cloudflare Routing + Resend + Gmail send-as stack (Workspace/private hosting
      not worth it pre-revenue). **Resend Return-Path verified aligned** (custom `send.majorcycle.com`
      bounce subdomain + DKIM `d=majorcycle.com`) → no "via resend". DMARC aggregate reports arriving =
      healthy (`p=reject` working).

**F1 sign-in performance.**
- [x] **Cut auth round-trips + fix the Google/One-Tap bounce** (— F1). Middleware (`proxy.ts`) and
      the app layout (`(app)/layout.tsx`) now verify the session with `getClaims()` (local WebCrypto
      + cached JWKS — the project already uses an ES256 asymmetric signing key) instead of `getUser()`,
      which had made an Auth-server round-trip on **every** request (twice per protected page). After
      an id-token / password sign-in the forms now do a hard `window.location.assign(next)` instead of
      `router.push()+refresh()`, so the freshly-set cookies are sent with the request and middleware
      sees the session first try — eliminating the "goes back to sign-in, waits, then logs in" bounce.
      Added `<link rel="preconnect">` to Google GIS + the Supabase origin on the auth pages to warm the
      TLS handshake. Auth e2e suite 20/20 (incl. login→results→signout→re-gate). Files: `proxy.ts`,
      `(app)/layout.tsx`, `components/GoogleSignIn.tsx`, `(public)/login/LoginForm.tsx`,
      `(public)/layout.tsx`. (PR #69.)
- [x] **iOS One Tap + "Signing you in…" polish** (— F1, PR #70). Added `itp_support:true` to the GIS
      init so One Tap surfaces on Safari/iOS (ITP browsers otherwise suppress it); added a
      "Signing you in…" state (lucide `Loader2`) shown the moment a Google credential arrives (One Tap
      or button) until the redirect, so the token-exchange wait no longer reads as an idle sign-in page.
      **Owner live-verified 2026-07-08:** email + Google sign-in fast, One Tap popup shows for a
      non-cooled-down session, console clean. (A "skipped" One Tap moment on the owner's device was
      Google's post-dismissal cooldown, not a defect — confirmed via the GIS moment API.)

**Verification:**
- Full signup → trial → paid conversion flow tested with Stripe test mode
- Payment failure → grace period → hard lock tested
- All static pages render correctly, content reviewed by owner
- Cancellation flow works without dark patterns
