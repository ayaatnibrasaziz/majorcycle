# Layer G audit — findings log

**Started 2026-08-23, on `feat/layer-g` (PR #89), before merge.**
Method: `https://claude.ai/code/artifact/980cf128-2b42-4f2b-ba9b-0b148f1e8f4e` (rev 4).

The audit runs in layers, each proving something no other layer can: **step zero** (sync +
fold-ins) → **0** prove the instruments → **1** the coverage map → **2** the machine sweep →
**3** the wire sweep → **3b** the platform sweep → **4** the data sweep → **5a** my visual
sweep → **5b** the owner's judgement sweep.

**Definition of done:** every enumerated case sits in exactly one of three states — *passed*,
*fixed and guarded*, or *accepted risk with the owner's sign-off*. **Zero cases in "unknown".**

**Severity key.** 🔴 blocks merge · 🟠 fix in this layer · 🟡 hardening / record ·
🔵 owner decision · ℹ️ no action, recorded so it is a checked fact rather than an assumption.

---

## Step zero — sync with main

`git merge origin/main` into `feat/layer-g` (**merge, not rebase** — PR #89 is open and 119
commits are pushed; a rebase would rewrite published history). Clean, one file:
`web/components/results/columns.ts`, 2 lines, from PR #90.

⚠️ **Why this had to come first:** the plan's revision 1 would have audited the branch as it
stood, and PR #90 changes a **paid surface**. Every measurement taken before the merge would
have described code that will never ship. My first check for this reported *no difference* —
it was reading a stale local copy of `main`. **The instrument was out of date**, which is the
same failure this audit exists to catch, one level up.

---

## Findings

### F-001 🔴 The bounds are described two different ways on two screens, and one of them is advice

**Found:** step zero, by asking what else PR #90's correction touched.

PR #90 corrected the Results table tooltips because they called a record *"not
unprecedented"* — i.e. they described the bounds as a **typical band** when the bounds are in
fact the **extremes**. The corrected copy now reads:

> Lower Bound % — The deepest confirmed fall in this stock's whole history … **A still-forming
> dip can run below it.**

The same concept is described on the Stock Detail page, in
`web/components/stocks/DrawdownOverlay.tsx:377-378`, and it was **not** corrected:

> Lower Bound — The deepest drawdown ever recorded … **Stocks rarely breach this level.** If
> Current approaches Lower Bound, **risk/reward is very favourable**.

> Upper Bound — The highest profit recovery peak ever recorded … If Current approaches Upper
> Bound, **consider taking profits**.

**Two separate defects in one tooltip pair.**

**(a) A direct contradiction.** The Results table now tells a reader a dip *can* run below the
lower bound. Stock Detail tells the same reader stocks *rarely breach* it. Both describe the
same number, on the same product, to the same person. This is CLAUDE.md **11c** exactly —
one claim, two copies, and PR #90 fixed the copy it was looking at. Nothing errored, nothing
went red, and both sentences read as confident and deliberate.

**(b) 🔴 It is financial advice, which is a non-negotiable.** *"Consider taking profits"* is
an instruction to sell. *"Risk/reward is very favourable"* is a recommendation to buy. This
breaches **non-negotiable #12 / decision #24** (educational and informational only,
ASIC-compliant, never financial advice) and the spirit of **decision #16**, which bans
Buy/Sell framing in our own outputs — the ban is on the *judgement*, and rephrasing it into
plain English does not exempt it.

⚠️ **Note how invisible this was.** The words are in a `title` attribute, so they appear only
on hover: no automated check reads them, no screenshot shows them, and a visual review never
triggers them. The compliance guard asserts the *disclaimer is present*, which it is — the
page is compliant everywhere except inside a tooltip nobody measured.

### ⚠️ Two errors of MINE in the first report of F-001, both corrected before any code changed

**(i) My advice sweep was built from the phrases I had already seen.** I reported the problem
as *"isolated to two tooltips"*. It was **six clauses across three pills** in the same
component. My pattern searched for `consider taking/buying/selling`, `risk/reward is`,
`good time|entry` — and so missed *"better entry opportunities"*, *"historically an attractive
entry zone"* and *"nearing an exit zone"*. This is CLAUDE.md **11g** committed by the person
quoting it: **a matcher tested only against its own source phrases has not been tested.**
A confident "isolated" is worse than no answer, because it closes the question.

**(ii) I graded an owner-approved feature as a compliance breach.** Widening the sweep
surfaced a whole named **Entry Zone** concept — UI labels in `VerdictCard` (*"Entry Zone ·
Active"*, *"Wait for Entry Zone"*), a formula in `MethodologyModal`, and generated bullets in
`ThesisInsights`. Grepping the audit docs *before* forming a view (CLAUDE.md **11h**) found it
in `layer-c-audit.md`: **"Thesis follow-up — … + entry-zone …. Owner-driven refinements …
design questions signed off via AskUserQuestion before building"** (2026-06-11), and **Fix 2**
records the owner engaging with the exact phrase *"historically attractive entry zone"* and
choosing to **gate it on Financial Health** rather than remove it.

So the house voice is a settled decision, and I nearly re-opened it — the same mistake as the
colour reversal (**11l**). **Grep the audit docs before deriving a diagnosis** turned a
"compliance breach" into a "one factual contradiction plus one question", which is what it
actually was.

**Owner's ruling (2026-08-23):** fix the contradiction, change *"consider taking profits"*,
and treat PR #90's terser wording as **a one-off correction, not a house-style shift** — the
remaining entry/exit language stays.

**Status:** ✅ **FIXED**, exactly and only as ruled.

| | Before | After |
|---|---|---|
| Lower Bound | "…**Stocks rarely breach this level.** If Current approaches Lower Bound, risk/reward is very favourable." | "…**A still-forming dip can run below it.** If Current approaches Lower Bound, risk/reward is very favourable." |
| Upper Bound | "…If Current approaches Upper Bound, **consider taking profits**." | "…**A still-forming rally can run above it.** If Current approaches Upper Bound, **the stock is near the top of its historical range**." |

**Left alone by ruling:** the `Current` and `Typical` pills keep *"better entry
opportunities"*, *"historically an attractive entry zone"* and *"nearing an exit zone"*.

⚠️ **No shared constant was extracted, deliberately.** My first proposal was to make both
screens import one string. The ruling that the two screens keep their own voice makes that
wrong — a shared constant would force an identity the owner explicitly declined. What is
shared is the *fact* (a live move can exceed the bound), now stated on both.

⚠️ **This component is imported by the offline report** (`ReportDocument.tsx:9`), so the
downloadable file carries the same tooltips. Per **11d** the source being right is not
evidence the artifact is: verified in Layer 2 by opening the built file, not here.

**Why no guard caught it, and none has been added yet:** nothing reads tooltip text. The words
live in a `title` attribute, so they surface only on hover — no test reads them, no screenshot
shows them, no visual review triggers them. A guard asserting neither bound tooltip claims the
level is rarely breached would hold this fix. **Not built:** the owner asked for a copy fix,
and adding a test unasked is the scope-widening this log already records me doing once. Raised
for decision instead.

### F-002 🟡 Signed-out visitors kept a write permission that signed-in users had removed

**Found:** the platform sweep, while checking whether a customer can grant themselves premium.

⚠️ **The headline is that I was wrong, and checking is what showed it.** The `profiles` UPDATE
policy is `auth.uid() = id` with **no `WITH CHECK` and no column restriction**, so on the face of
it any signed-in person could `update({ subscription_status: 'active' })` from the browser
console and take the paid product for free — a total paywall bypass, invisible to every guard we
own. **That is not what happens.** Underneath the policy sit column-level grants, and
`authenticated` holds UPDATE on exactly three columns:

```
acknowledged_disclaimer_at, country, display_name
```

The billing columns are unreachable. **The defence is real and it is good** — and it is
defence-in-depth, since the policy restricts the *row* and the grant restricts the *columns*.
Had I reported the alarm instead of testing it, I would have sent the owner chasing a
vulnerability that does not exist.

**The actual finding is an asymmetry.** `anon` still holds UPDATE on **all 20** `profiles`
columns, including `subscription_status`, `billing_blocked`, `grace_until` and
`stripe_customer_id`.

**Not exploitable today.** RLS denies it: for an unauthenticated request `auth.uid()` is NULL,
`NULL = id` is NULL rather than TRUE, so zero rows match. Safety rests on the policy alone.

**Why it is still worth fixing.** Someone deliberately narrowed those grants for
`authenticated` — that is a considered act, not a default — and did not mirror it to `anon`.
That is CLAUDE.md **11c-iv** precisely: *the rule existed and one of its consumers never
received it.* Today the policy covers for it; a future migration that adds any anon-reachable
policy to `profiles` makes the wide grant live, and nothing would go red.

**Proposed fix:** `REVOKE UPDATE ON public.profiles FROM anon;` — anon has no legitimate reason
to write any profile column. Plus a guard asserting the privilege posture, so it cannot widen
silently. **Not applied:** it is a live-database change, and the owner asked to be consulted
before anything is removed.

### F-003 🟡 The stock universe is 129 rows from a silent truncation limit

`stocks` holds **871** rows. PostgREST returns at most **1000** to an unpaginated read and says
nothing about it — no error, no warning, no flag (CLAUDE.md **14c**). The universe auto-expands
every time a reader requests a ticker, so this arrives with *growth*, not with a commit.
`selectAll()` / `_select_all()` and `pnpm check:data-integrity` exist to prevent it. **Layer 0
proves that guard can actually fail** rather than assuming it.

### F-004 ℹ️ Seven tables cannot tell a reader that their configuration is deliberate

Nine tables have row-level security enabled with **no policies** — the correct, deny-all posture
for server-only tables, and the reason the database's own advisor lists nine notices. Two
(`stripe_events`, `trial_tombstones`) carry a table comment saying the notice is intentional.
The other seven do not, so the next person to read the advisor output cannot distinguish
*deliberate* from *forgotten* — and will either re-investigate it or, worse, "fix" it.
One-line comment each.

### F-005 🔵 Four subscription states show a screen that does not describe them

The billing layer maps **eight** Stripe statuses. Four — `incomplete`, `incomplete_expired`,
`paused`, `unpaid` — fall through `hasAccess()`'s catch-all and produce the denial reason
`no_subscription`, whose entry in `PremiumLockPage` is `null` (the generic panel).

**Correct and safe** — the rule fails closed by design, so nobody gets in who should not.
**Possibly unfair** — telling someone whose payment is *unpaid*, or whose subscription is
*paused*, that they "don't have a subscription" is not true and gives them nothing to act on.
Owner's call; the four screens go to them in Layer 5b.

### F-006 🟠 The launch-gate table's evidence is three weeks stale

`roadmap.md` §3 is the formal definition of ready, and every row is supposed to cite a reading.
It cites **E2E 105/105 and pytest 86**, measured 2026-08-02 on `ab11e18`. Several rows are
🟡 *partly proven*. The table is not wrong so much as **out of date in a way that reads as
current** — the same shape as CLAUDE.md **11j**, where three documents said a page was
finished.

✅ **The test row is fixed (2026-08-23).** Re-read from CI run `32585813431` on `f17866a`:
**E2E 523 passed, pytest 153**, with no `flaky` and no `skipped` line in either summary
(read the whole block — CLAUDE.md 11i). Local `pytest` re-run the same day independently
gave 153, agreeing. The row now cites the run id and the SHA, which is the thing that
stops a number ageing invisibly: without one, *"all tests passing"* stays true-looking
forever. ⚠️ **Noted in the row itself:** the audit's own commits were local and unpushed
at the time, so CI has not seen them — the citation is the last SHA it actually ran, not
a claim about the working tree.

**The remaining rows are re-verified in Layer 2.**

### F-011 🔵 An unknown ticker answers 200, not 404 — the August soft-404 fix never reached the signed-in app

**Found:** Layer 1, by writing the test the coverage map said was missing.

Measured on the production build, signed in, 2026-08-23:

| URL | Status | Should be |
|---|---|---|
| `/stocks/us/ZZZZNOTREAL` | **200** | 404 |
| `/stocks/xx/AAPL` (no such market) | **200** | 404 |
| `/learn/not-a-real-article` | 404 ✅ | 404 |

CLAUDE.md **11r** records a sitewide soft-404 — every `notFound()` answering 200 —
fixed on 2026-08-18 by deleting the root `app/loading.tsx`. That fix was correct and
it was **incomplete**: `app/(app)/loading.tsx` and the ticker route's own
`loading.tsx` are still present, so inside the signed-in product the Suspense shell
is still flushed before the status is set. Same bug, same mechanism, the half of the
site nobody re-checked — 11c's "one rule, one place" and 14g's "a guard scoped to
public routes is silent, not clean, about the rest."

⚠️ **Nothing on screen is wrong**, which is why it survived: the reader gets the
correct "Not in our coverage yet" page with its Request button. Only the status line
disagrees.

**Cause proven, not theorised.** Moving both `loading.tsx` files aside and rebuilding
turned both 200s into **404s**; restoring them turned them back. Two builds, both
directions.

**🔵 Why this is the owner's call and not a fix.** Removing those files removes the
loading skeleton from the slowest page in the product — the ticker page took
**~4 seconds** to render in the same measurement, and without a `loading.tsx` there
is no shell to stream, so that becomes 4 seconds of blank. Against that: the harm
today is small. `/stocks` is `Disallow`ed, so no crawler ever sees it; a human
reader sees the right page. The cost is to anything reading the status
programmatically, and to the honesty of the response.

**✅ FIXED the same day, and the trade-off turned out to be avoidable.** The owner
asked for the fix *and* for a way that costs nothing, and there is one. Next nests a
segment as `<Layout>` → `<Suspense fallback={<Loading/>}>` → `<Page/>`, so **a layout
renders outside the boundary**. The existence check moved into a new
`stocks/[market]/[ticker]/layout.tsx` and only the *group-level*
`app/(app)/loading.tsx` was removed — the ticker route keeps its own detailed
skeleton.

Measured after, on the production build:

| | Before | After |
|---|---|---|
| `/stocks/us/ZZZZNOTREAL` | 200 | **404** |
| `/stocks/xx/AAPL` | 200 | **404** |
| real ticker | 200 | 200 |
| ticker-page skeleton | 430ms | **389ms** |
| `/stocks` · `/run` · `/results` · `/account` · `/request` | group skeleton | 812 · 380 · 453 · 945 · 387 ms to full load |

The four routes that lost the group skeleton all load in under a second, and Next's
router keeps the previous page on screen during a client navigation anyway, so the
skeleton was buying them a flash rather than a wait.

⚠️ **Two wrong turns, both caught by measuring rather than reasoning.** (i) My first
attempt added the layout and kept `app/(app)/loading.tsx` — still 200, because that
file's boundary sits *above* the new layout. The theory was right and the placement
was wrong, and only the wire said so. (ii) The fix then silently broke the
reader-facing half: **a `notFound()` thrown by a layout is caught by the boundary
ABOVE that segment**, so `[ticker]/not-found.tsx` stopped firing and the friendly
"Not in our coverage yet" page was replaced by the generic 404 — statuses green,
customer experience quietly worse. The e2e tests written an hour earlier caught it.
Fixed by extracting `components/stocks/NotInCoverage.tsx` and re-exporting it from
both boundaries, rather than copying the markup into the second one (11c).

Guarded by `e2e/stock-not-found.spec.ts`: the two 404s, a 200 control, the friendly
page and its Request link, **and that the skeleton still appears** — because the
cheap "fix" for this is to delete the last `loading.tsx`, which would keep every
status green and hand the reader a blank screen for three seconds.

### ℹ️ Two flaky tests on the first full run, same cause — one fixed, one recorded

The full suite came back **571 listed = 569 passed + 2 flaky, 0 failed, 0 skipped**, exit
code 0 measured **without a pipe** (Layer 0's own lesson). Reconciled deliberately: a
green line is not a report, and 2-apart is exactly the gap that hid a real failure earlier
the same day.

Both flakes were `page.goto` **timing out at 60s**, not a wrong answer:

| Test | Mine? | Page |
|---|---|---|
| `stock-not-found` · a real ticker still answers 200 | **yes** | `/stocks/us/AAPL` |
| `seo` · no page ships a SECOND, per-page share card | no, pre-existing | `/learn/what-majorcycle-doesnt-do` |

⚠️ **Mine was my defect, as 11i predicts for a test written the same day.** `page.goto`
waits for `load` by default, which on the ticker page means the charts and the Python
cycle analysis — three-plus seconds normally, and past 60s under full-suite parallel load
on `next dev`. The assertion wanted the **status line**, which arrives in the first
packet. Fixed with `waitUntil: 'commit'`. The two 404 assertions keep the default wait —
those pages are tiny, so the stricter wait is free.

**✅ The `seo` one is now fixed too, at the owner's request — and my first fix was
wrong, which is the useful part.**

That test walked **19 pages inside ONE test** (7 static plus every Learn article) against
a single 60s budget. I diagnosed the cost as the Learn illustrations and changed the wait
to `domcontentloaded`, which reads the `<head>` tag without waiting for images. Measured
before shipping it: **28.2s → 30.2s**. No improvement. The cost is `next dev` compiling
nineteen routes on first request, and no client-side wait can avoid that.

⚠️ **Had I not timed it, I would have committed a comment stating a mechanism I had never
verified** — CLAUDE.md **14f** exactly: *a doc that attributes a number to a cause owes
that number a measurement*, and a plausible cause that is genuinely present is the hardest
kind of wrong explanation to catch. Slower-page-loads *is* a real phenomenon here; it just
is not what was costing the 28 seconds.

The actual fix is the shape the same file already used **70 lines above**: one test per
page instead of one loop inside one test, so each page gets its own budget and a failure
names the page rather than producing one opaque timeout. `seo.spec.ts` 62 → **80 tests**.
The `domcontentloaded` change is kept — it is the honest wait for an assertion that reads
one tag from `<head>` — with its comment rewritten to say it bought nothing.

### F-012 🟠 `/api/request-ticker` treated a failed database read as "not covered" — FIXED

**Found:** Layer 1, by a flaky test — the kind of result that is easiest to re-run and ignore.

The 409 case ("this stock is already covered") passed in isolation and **failed once in
the full suite**. Both of the route's lookups destructured only `data` and discarded
`error`, so a transient read failure was indistinguishable from an absent row — CLAUDE.md
**11e**, on a route that had no tests at all until that morning.

The two failures point in opposite directions and the second one writes:

- a `listings` error told a reader their real stock was **"not a known US/AU/CA listed
  stock"** — wrong, but a refusal;
- a `stocks` error fell through to the upsert and **queued a request for a ticker we
  already cover**, so the nightly cron would go and re-fetch it. Nothing errored, nothing
  logged, and the row was indistinguishable from a genuine reader request.

Both now check `error` first and answer **503 + `Retry-After`**, matching the report
route. ⚠️ **Checked before assuming:** the live queue holds 9 rows, all from June, so no
spurious row was ever written — by the tests or otherwise.

⚠️ And the fix tripped the paywall guard for the wrong reason: its regex matched
`headers: NO_STORE` but not `headers: { ...NO_STORE, 'Retry-After': '5' }`, so a
correctly-guarded 503 read as unguarded. The report-route section a few checks above had
already widened its pattern; the two had drifted (11c). Widened and re-proven able to
catch a genuinely missing header.



### ✅ Verified clean — recorded so these are checked facts, not assumptions

| Check | Result |
|---|---|
| Row-level security enabled on every table | **12 / 12** |
| Tables denying all public access (server-only) | **9**, correctly |
| Tables with policies | **3** — `profiles`, `analysis_runs`, `referrals`, each scoped to `auth.uid()` |
| Can a signed-in customer escalate their own entitlement? | **No** — column grants block it (F-002) |
| Preview deployments protected | **Yes** — sign-in required on all but the custom domain |
| Live Stripe webhook | **1**, enabled, `https://www.majorcycle.com/api/stripe/webhook`, 13 events, livemode |
| Database performance advisors | 10, all INFO unused-index — expected at 3 accounts |

---

## Step zero — the five fold-ins

### 1 ✅ Two cron scripts crashed instead of explaining — FIXED

`daily_refresh.py` and `check_field_units.py` read `os.environ["SUPABASE_URL"]` strictly, while
six sibling scripts accepted `NEXT_PUBLIC_SUPABASE_URL` as a fallback. Running either by hand
off `.env.local` raised a bare `KeyError` naming a variable the operator has never heard of.

Both now use the same fallback, with the reasoning inline. **Verified:** all **11** Python
readers of `SUPABASE_URL` (9 in `analytics/`, 2 in `web/api/`) now accept either name; strict
readers remaining = **0**. `mypy` clean on 42 files, `pytest` **153 passed**.

ℹ️ **Noted, not changed:** three different fallback *shapes* now exist. Six use
`os.environ.get(A) or os.environ[B]` — which raises a clear error naming `B` if neither is set.
Two one-off repair scripts (`fix_pe_history.py`, `fix_insider_transactions.py`) use
`os.environ.get(A) or os.environ.get(B, "")`, which **silently yields an empty string** and
defers the failure to a confusing place. Not changed: they are hand-run repair tools, not the
nightly pipeline, and churning them mid-audit buys little. Recorded so it is a known
inconsistency rather than an unnoticed one.

⚠️ **Update 2026-08-23:** `fix_insider_transactions.py` was deleted (owner-approved — it
repaired dates stored as row indices by a bug fixed at source, and cannot recur), so **one**
weak-fallback script remains: `fix_pe_history.py`. Still not changed, for the same reason.

### 2 ✅ Two guards never ran automatically — now a required merge gate

`pnpm check:page-weight` and `pnpm lighthouse` exist but sit outside CI. Both need a
**production** build on `:3200` plus a real signed-in session, which the CI jobs do not provide:
the frontend job builds but has no browser or secrets, and the E2E job has both but deliberately
runs `next dev`.

They are now a **required pre-merge gate** (below), with their numbers recorded so a regression
has to be *seen and waved through* rather than passing unnoticed.

🔵 **Recommendation for the owner, not actioned:** these two are not equally automatable, and
treating them the same would be a mistake.

- **`check:page-weight` could go into CI.** It measures *bytes over the wire*, which is
  deterministic — the same commit yields the same number on any machine. Adding a production
  build and server to the E2E job would cost a few minutes and buy permanent protection.
- **`lighthouse` should stay manual.** It measures *timing*, which depends on the CPU it runs
  on, and shared CI runners are noisy. This repo already learned that one run is not a number
  (85→62 across five runs) — a perf gate that flaps gets loosened rather than obeyed, which is
  worse than no gate. Manual, median-of-3, on a known machine, is the honest form.

Not actioned because changing the CI pipeline days before a merge is a scope expansion I was
not asked for, and the approved fold-in was the manual gate.

### 3 🔵 Apex redirect is still temporary — owner's, at merge

Cannot be done from code; it is a hosting/DNS setting. On the merge-day list below.

### 4 🔵 Public document text size — owner's decision, prepared in Layer 5b

Both sizes to be built and shown side by side.

### 5 ℹ️ Supabase legacy API keys expire end of 2026 — recorded, not actioned

Rotating live database keys during a pre-launch audit adds risk for no benefit. Belongs in the
roadmap as a dated item.

---

## The merge gate — every box ticked before PR #89 merges

Numbers get filled in during Layer 2 (the machine sweep) and re-checked immediately before
merge. An empty number is an unticked box.

| | Gate | Required | Last reading |
|---|---|---|---|
| ✅ | `pnpm typecheck` | zero errors | **0 errors** — Layer 2, 2026-08-24 |
| ✅ | `pnpm lint` | zero errors | **0 errors** — Layer 2, 2026-08-24 |
| ✅ | `pnpm build` | succeeds | **succeeds**, compiled in 37.5s — Layer 2, 2026-08-24 |
| ✅ | `pnpm e2e` | 0 failed, 0 skipped, count reconciled with CI | **617 passed, 0 failed, 0 flaky, 0 skipped** — CI run `32847359890` on `bc7672e`, matching the 617 collected locally. Grew 589 → 617 across the fixes: +7 benchmark-cache, +1 run-history, +15 db-grants, +3 pricing-parity, +2 stock-currency. ⚠️ Earlier in the layer this was **reconciled with CI by TITLE, not by count** — 588 of 589 identical, the 589th differing only by GitHub's redaction (F-017) — and that remains the method whenever the two disagree |
| ✅ | `pytest analytics/` | all pass | **189 passed** — 153 at step zero, +17 in Layer 1, +19 for the listings regression rules (F-027/F-028) |
| ✅ | `mypy analytics/` | no issues | **43 files, no issues** — 42 at step zero, +2 new tests −1 deleted script |
| ✅ | `ruff check analytics/` **and** `cd web && ruff check _engine/ api/` | zero errors | **both clean.** ⚠️ Added to this table on 2026-08-24 because Layer 2 originally omitted it and CI caught 6 errors on the first push — F-016. A gate absent from the list is a gate nobody runs |
| ✅ | The **nine** `check:*` guards | all green, **each proven able to fail** | **all 9 proven able to fail** ✅ — eight in Layer 0 (2026-08-23, 13 sabotages each with a control) and the ninth on 2026-08-25. ⚠️ **This row said "eight" until then, and there were nine.** `check:engine-drift` had never been broken on purpose, so the row read as "all of them" while one was unproven — the audit's own rule 3 turned on the audit. Sabotaged by appending a line to `web/_engine/major_cycle.py`: it names the file, explains the fix, and **exits 1** (read without a pipe — `$?` after a pipe is `tail`'s). **All 9 green on a fresh production build** ✅ |
| ✅ | `pnpm check:page-weight` | within budget — **manual, production build** | all 6 within budget ✅ **re-taken 2026-08-24 after F-019**; heaviest `/stocks/us/AAPL` **1079 / 1250 KB** (was 1222 / 1400 — the four index series left the document, and the ceiling was ratcheted so the saving cannot be given back). Re-taken again at merge |
| 🔴 | `pnpm lighthouse` | meets decision #33 — **manual, median of 3** | public pages **100 / 100 / 100 / 100**; `/stocks` **100**; `/stocks/us/AAPL` **83** local, **64** on the deployed preview. **Below the 90 target, and BLOCKED rather than merely unfinished.** The 84→90 work was attempted and is recorded: F-019 took a third off the page with no score movement, F-020 (split hydration) made it worse and was reverted, and F-021 found that **neither available measurement is trustworthy** — three consecutive preview runs gave 370/540/990 ms of blocking time, and no external lab tool can reach a page behind sign-in. ⚠️ **This row cannot be ticked by more optimisation; it needs an instrument.** Owner decision pending on real-user monitoring. The reliable evidence is the byte count above |
| ⬜ | Launch-gate table re-verified | every row's evidence current, not from 2026-08-02 | — |
| ⬜ | Deferred list GA-1…GA-5 re-verified | closed *today*, not closed *once* | — |
| 🟡 | Layer 1 coverage map | built, and the uncovered list ruled on by the owner | map built 2026-08-23 → `docs/layer-g-coverage-map.md`; owner ruled on all 8 the same day and **all 8 acted on** ✅ — five defects found (F-005, F-009, F-011, F-012, and 11a's fifth instance) |
| ⬜ | All findings resolved | passed / fixed+guarded / accepted with sign-off. **Zero unknown** | — |

**At merge, owner-only:**

| | Action | Why it matters |
|---|---|---|
| ⬜ | Flip apex → `www` from a temporary to a permanent redirect | Search engines consolidate ranking only across a permanent one, and Layer G declares `www` canonical in ten places |
| ⬜ | Move hosting off the free tier | It forbids commercial use — this blocks taking payment, not just launch |
| ⬜ | Submit the sitemap, **after** deploy | Submitting while it still redirects teaches the crawler to distrust it |
| ⬜ | Re-read the **six LIVE Stripe prices** and check them against `PRICE_TABLE` | `e2e/pricing-parity.spec.ts` closed F-025 for test mode only. Test and live are separate objects sharing a `lookup_key`, and CI holds only the restricted test key — so a live-mode price edit is invisible to every check we own. Last read by hand 2026-08-24: all six matched |
| ⬜ | **Re-run the listings refresh after merge** | The TSX Venture rows (F-028) and the ASX menu (F-027) were written from this branch. Tonight's scheduled run checks out `main`, whose delisting sweep has no churn guard and knows nothing about TSXV — so it will mark all 1,457 venture rows inactive. Harmless and reversible (deactivated, never deleted), and the first post-merge run restores them. This is CLAUDE.md 14g, and it is on this list precisely because it looks like nothing happened |

---

## Layer 0 — proving the instruments

Each guard broken on purpose and required to go red **for the stated reason**, with a control
run after every revert. Exit codes measured **without a pipe** — see the method note below.

| Guard | Sabotage | Exit | Message |
|---|---|---|---|
| `check:entitlement-gates` | `/api/portal` header → `public, s-maxage=60` | **1** ✅ | named the file, the directive, and *why* a shared cache leaks a Stripe session URL |
| `check:report-sections` | **delete** the `<DrawdownOverlay>` render | **1** ✅ | `DRIFT: … on the Stock Detail page but NOT in the report — DrawdownOverlay` |
| `check:report-sections` | **comment out** the same render | **0** 🔴 | *nothing* — see F-007 |
| `check:data-integrity` | unpaginated `.from('stocks').select()` | **1** ✅ | named the file, the table, the 1000-row cap and the three valid fixes |
| `check:seo` | `/pricing` → `index: false` | **1** ✅ | named the page and that it "keeps working, so nothing looks wrong" |
| `check:tier-palette` | change tier 4 in **one** copy | **1** ✅ | caught the two copies drifting apart |
| `check:tier-palette` | collide tiers 4+5 in **both** copies | **1** ✅ | 3 messages: 1.0 vs floor 16, protanope 3.2 vs 17.5, deuteranope 1.6 vs 16 |
| `check:render-modes` | move `.next/server/app/terms.html` aside | **1** ✅ | `/terms is NOT prerendered` — and named `app/not-found.tsx` as the usual culprit |
| `check:render-modes` | plant a `login.html` (the opposite direction) | **1** ✅ | `/login IS prerendered and must not be`, **plus** a second message: the nonce interlock, unprompted |
| `check:csp` | `proxy.ts` header → `…-Report-Only` | **1** ✅ | all 12 routes `sent NO Content-Security-Policy` — correct, Report-Only enforces nothing |
| `check:page-weight` | `/learn` budget 380 → 100 | **1** ✅ | named the overage **and the five heaviest resources** |
| `check:page-weight` | budget a route that 308s (`/methodology`) | **1** ✅ | `redirected to / — that is not the page this budget describes` |
| `check:page-weight` | budget a route that barely loads (`/robots.txt`) | **1** ✅ | `transferred only 1 KB over 0 requests — it did not load` (the 14g floor) |

**All eight `check:*` guards are now proven able to fail.** *(⚠️ Corrected 2026-08-25: there are **nine**. `check:engine-drift` was never in this table and was proven separately that day — see the merge-gate row.)* The three added 2026-08-23
needed a production build on `:3200` and a running server; the CSP one needed two full
rebuilds, because the header is set in `proxy.ts`, which Next compiles at build time —
editing the source and re-running the guard would have measured the previous build
(CLAUDE.md 11i). **The sabotage was confirmed on the wire with `curl -I` before the guard
ran**, so a green result could not have been the sabotage silently failing to land.

### ✅ F-010 The page-weight guard printed `ok` next to a failing page — FIXED

⚠️ **Two of the three page-weight sabotages printed `ok` in the summary table while
failing.** The `ok`/`OVER` column reports the budget comparison only, so a page that
redirected somewhere else, or never loaded, is labelled `ok` on the very line meant to
summarise it — `ok /methodology 277 KB / 400 … landed /` and `ok /robots.txt 1 KB / 400
0 reqs`. The problem block underneath catches both and the exit code is 1, so nothing is
missed by a reader who scrolls; it is cosmetic. Recorded because the theme of this whole
layer is checks that look clean while blind, and a column that says `ok` next to a
failure is one careless skim from being believed.

**Owner's ruling (2026-08-23): fix it.** The flag was `kb > maxKB ? 'OVER' : '  ok'`,
computed from the budget alone and printed *before* the other two checks had run. Now the
row's problems are collected first and the label is derived from all three, giving three
states that each mean something: **OVER** (too heavy), **FAIL** (redirected, or never
loaded), **ok** (genuinely nothing wrong). Re-ran all three sabotages against the fix —
`/learn` OVER, `/methodology` FAIL, `/robots.txt` FAIL, exit 1 — then a clean control:
six rows `ok`, exit 0. `pnpm lint` and `pnpm typecheck` both clean.

### ⚠️ Two method errors of mine in this layer, both caught by controls

**(i) I measured an exit code through a pipe.** `pnpm … | tail; echo $?` reports `tail`'s
status, not the guard's — so my first sabotage printed two correct failures beside
`exit=0`, which reads exactly like *"the guard prints red but CI stays green"*, the most
alarming result a guard can give. Re-measured without the pipe: **1 when broken, 0 when
clean.** The guard was always fine; the instrument was not. Every row above is now measured
directly, with a control.

**(ii) My first tier-palette sabotage tested a different check than I intended.** Changing
tier 4 in `ratings.ts` alone failed the *two-copies-in-step* check, and the printed adjacency
numbers were **identical to the clean run** — which is what gave it away. Had I stopped at
"exit 1, guard works", **the adjacency check would still be unproven** while I recorded it as
verified. Changing both copies exercised it properly. This is CLAUDE.md **11u**: a break that
fails in an unexpected way is a finding about your model, not a verdict on the test.

### F-007 🟡 `check:report-sections` is blind to a commented-out section

The guard collects components imported from `@/components/stocks/…`, then tests whether
`<Name` appears anywhere in the file. **It never strips comments**, so
`{/* <DrawdownOverlay … /> */}` still matches and the section counts as rendered.

Deleting a section is caught. **Commenting one out is not** — and commenting out is the more
likely real action: someone disables a section while debugging and forgets. The report would
silently lose a section a paying customer downloads, with the guard green.

⚠️ Note this is the *same* defect shape the repo already fixed once elsewhere:
`public-chrome.spec.ts` reads source **with comments stripped**, because its first version
failed on the very sentence documenting the fix. The lesson was learned in one guard and not
carried to this one — **11c-iv** again.

**Not fixed:** it is a CI guard change and the owner asked to see changes before they land.
**Proposed:** strip block and line comments before matching, and prove it by re-running the
comment-out sabotage — which must then exit 1.

### F-008 🟡 Two adjacent rating tiers are near-indistinguishable to a red-blind reader

From the *passing* baseline, not a sabotage:

```
tier 1-2   apart 17.1   protanope 18.6   deuteranope 24.6
tier 2-3   apart 28.8   protanope  2.8   deuteranope  7.3   ← Constructive vs Neutral
tier 3-4   apart 26.8   protanope 12.7   deuteranope  5.9
tier 4-5   apart 16.3   protanope 18.0   deuteranope 16.1
```

**Constructive (`#1E7C1E` green) against Neutral (`#87660F` gold) is 2.8 apart to a
protanope**, where every other pair sits between 12.7 and 26.1. Protanopia affects roughly 1%
of men. Constructive-versus-Neutral is also the most consequential boundary we draw — it is
the line between *our analysis likes this* and *our analysis is indifferent*.

**The guard is working exactly as designed.** It is a **ratchet** (CLAUDE.md **11t**): it
records today's measurement as the floor so a colour can never get *closer*, deliberately
rather than inventing a threshold that would fail on the day it was written. It therefore
prevents worsening and says nothing about adequacy — 2.8 is locked in as *acceptable* purely
because it was the value on the day.

**Graded 🟡, not 🔴, and here is the honest reason:** colour is not the only channel. Rating
tiers render with their **word** (`High Conviction` / `Constructive` / …) and score chips
carry the **number**, so a reader who cannot separate the hues still gets the information.
That keeps it clear of the accessibility rule that colour must never be the sole means. It is
a loss of *redundancy*, not of meaning.

**Status: ✅ FIXED 2026-08-23. Neutral is now a true grey, `#87660F` → `#72696D`.** Owner chose
it from three equivalent options after seeing them rendered under all three vision types.

| Pair | Protanope before → after | Deuteranope before → after |
|---|---|---|
| 2–3 | **2.8 → 25.2** | **7.3 → 22.0** |
| 3–4 | 12.7 → 27.0 | **5.9 → 24.6** |

Worst case across the scale: **2.8 → 16.1**, which is the ceiling — pairs 1–2 and 4–5 bind it
and neither was touched. Contrast is unchanged at 5.31 / 4.80. Verified on the rendered page,
not just the tokens: **11 grey elements measured, worst 5.07** against a 4.5 floor.

**Why gold could not be kept, measured rather than asserted.** All **15,866** golds clearing
both floors were searched; the best scores 12.9 and only by becoming `#3E301E`, a near-black
brown. A true yellow is worse — `#FFD700` scores **1.27** as text and the original `#D4A017`
scored **2.15**. Green and gold both lose the same channel for a red-blind reader and converge
on olive, which *is* the 2–3 collapse.

⚠️ **A test of mine that proved nothing.** I assumed the binding constraint was *white numerals
sit on this colour*, re-ran the search without it, and got **identical results** — which is how
I learned the test was a no-op. The real constraint is the *other* floor: Neutral is also used
**as text** on the light page, demanding luminance ≤ `0.1479` where white-on-it demands
`0.1688`. I had removed the requirement I suspected, and it was never the one binding.
**A control that changes nothing is telling you your model is wrong, not that the thing is
irrelevant** (11u).

**What moved:** `--c-tier-3`, `--c-tier-3-ink`, `--c-neutral-ink`, both `--tint-tier-3*`, the
profitability-pill border, `ratings.ts` tier 3, `ink.ts` neutral, and the guard's ink ground
plus its 2–3 / 3–4 floors, re-based upward so the new separation is now the ratchet.

⚠️ **The ink is NOT the colour.** `#72696D` scores **4.67** on its own 10% tint — just under
the floor — so the ink is `#6B6266` (5.18). Computing it rather than assuming they could be the
same is what caught that.

⚠️ **Two floors, two of my own errors, both caught by the guard rather than by me.** I set the
2–3 deuteranope floor to `22.0` when the measured value *displays* as 22.0 but is fractionally
below it, so the guard went red on the change that fixed it — the boundary-versus-margin lesson
(11i-b) in miniature. And I missed `--c-neutral-ink` entirely, because the guard's ink regex
matches `--c-<letters>-ink` and the one I had already fixed is `--c-tier-3-ink`; two variables,
one concept, and only one of them is what the ink layer reads.

### F-009 🟡 The composition bar still paints the pre-August palette, in a form the guard cannot see

Found while fixing F-008. `compositionRamp()` in `lib/ratings.ts` — which colours the
Health / Valuation / Cycle Payoff micro-bar under every Overall score — holds its own copy of
the tier palette as **`r,g,b` strings**:

```
1: '0,100,0'   2: '34,139,34'   3: '212,160,23'   4: '255,69,0'   5: '178,34,34'
```

Those are the **original pre-2026-08-22 colours**. The G6 contrast fix never reached them, so
the bar beneath a score chip has been drawn in the old palette while the chip itself uses the
new one.

⚠️ **The guard walks 278 files for stray copies and cannot see this**, because it searches for
**hex**. A copy written as `212,160,23` is invisible to it — so the one control that exists for
exactly this class of drift has a blind spot the width of a format change. Same family as F-007:
the guard is right about what it looks at and silent about the rest.

**✅ FIXED 2026-08-23, on the owner's instruction — and not by repainting the literals.**

Fixing the four remaining values would have left the mechanism intact and simply reset the
clock: a second copy of the palette, in a format the guard cannot read, waiting for the next
palette change. So **the copy is gone**. `compositionRamp` now derives its triplet from
`RATING_TIER_HEX` — CLAUDE.md **11c (iii)**: when a rule is shared, make the second consumer
*derive* from the first rather than restate it, because two things that merely agree today
will not agree forever.

| Tier | Bar was | Bar now | Chip |
|---|---|---|---|
| High Conviction | `0,100,0` | `6,95,70` | `#065F46` |
| Constructive | `34,139,34` | `30,124,30` | `#1E7C1E` |
| Neutral | `114,105,109` | unchanged | `#72696D` |
| Cautious | `255,69,0` | `199,54,0` | `#C73600` |
| Bearish | `178,34,34` | `139,20,20` | `#8B1414` |

Proven by changing tier 4 in the palette to magenta and confirming the bar followed it with no
second edit. ⚠️ **The guard's r,g,b blind spot is now moot for this file** — there is no
literal left to drift — but it remains true of the guard, and is worth teaching it if another
such copy ever appears. Recorded rather than fixed: widening the guard was not part of what was
asked, and the defect it would catch no longer exists here.

---

## Layer 2 — the machine sweep

Every automated gate run end to end on `feat/layer-g`, on a **fresh production build**, with
the number recorded rather than the colour. Run 2026-08-24.

| Gate | Result | Reconciliation |
|---|---|---|
| `pnpm typecheck` | **0 errors** | — |
| `pnpm lint` | **0 errors** | — |
| `pnpm build` | **succeeds** | compiled in 37.5s |
| `pytest analytics/` | **170 passed** | 153 at step zero + 17 added in Layer 1 |
| `ruff check analytics/` + `web/_engine api` | ✅ | **missed on the first pass — see F-016** |
| `mypy analytics/` | **43 files, no issues** | 42 at step zero **+2** new test files **−1** deleted cron script |
| `check:report-sections` | ✅ | 22 sections match |
| `check:entitlement-gates` | ✅ | 11 checks |
| `check:data-integrity` | ✅ | 61 checks over 230 TS + 45 Python files |
| `check:seo` | ✅ | 587 checks over 11 public pages (7 indexable) |
| `check:tier-palette` | ✅ | 284 files swept for stray copies |
| `check:render-modes` | ✅ | 7 prerendered, 6 dynamic, 13 asserted; nonce invariant holds |
| `check:csp` | ✅ | 12 routes, 7 nonce, 5 prerendered, **zero violations** |
| `check:page-weight` | ✅ | 6 pages within budget; heaviest `/stocks/us/AAPL` **1223 / 1400 KB** |

**Reconciled against CI, by title.** Both the local run and CI run 32686988274 report
**589 passed**. Equal counts are not the check — a renamed test and a silently skipped one both
move the number and mean opposite things — so the two logs were compared title for title, with
CI's forward slashes, its check-mark reporter and each test's `line:col` normalised away.
**588 of 589 matched exactly**, and the one that did not turned out to be F-017 rather than a
missing test.

⚠️ **That comparison took four attempts and the first three were all wrong**, each in a way
that reads as success. (i) The parser matched the local reporter's `ok` marker; CI prints a
check mark, so it extracted **0 CI titles** — which then listed all 589 local tests as "missing
from CI", a terrifying and entirely false result. (ii) Fixed, it dropped one local test whose
duration reads `(1.1m)` rather than seconds. (iii) Then a shell-escaping error left **both**
lists empty — and `diff` on two empty files reports them identical, so it printed
**"RECONCILED"** while comparing nothing. That is 14g in the instrument built to enforce 14g.
The script now refuses to compare at all unless both lists reach 589, and the heredoc that
mangled the escape was abandoned for a real file.

Each number is a reconciliation, not a reading: **mypy's file count moving 42 → 43** is the
kind of thing that would otherwise pass as "still green" while a file quietly stopped being
checked (14g). It matches the day's edits exactly.

### F-013 🟠 My own F-011 fix cost the ticker page 19 Lighthouse points — FIXED

**Found:** by running `pnpm lighthouse` and *reconciling against the recorded figure* rather
than reading the new one on its own. `docs/architecture.md` records `/stocks/us/AAPL` at
**84** (2026-08-22, median of 3, production build). Today's median: **65** — runs 65 / 68 / 54.

The suspect was immediate and it was mine. F-011 put an existence check in
`stocks/[market]/[ticker]/layout.tsx`, and that check ran its **own** query. So the route went
from two sequential cross-region database round trips to **three**.

⚠️ **The justification I wrote for the extra query was about the wrong quantity.** The comment
read: *"`readStockRow` cannot be reused for this: it does `select('*')`, which drags the whole
fundamentals JSONB across for a question whose answer is one bit."* That is an argument about
**bytes**. Measured from the owner's machine against the database in `us-east-1`, interleaved
so a network mood swing hits both arms:

| Query | Payload | Median (round 1) | Median (round 2) |
|---|---|---|---|
| `select ticker` | **17 bytes** | 553 ms | 463 ms |
| `select *` | **48,489 bytes** | 531 ms | 533 ms |

**48 KB costs the same as 17 bytes.** The payload is free; the round trip is the entire cost —
about **500 ms each, from Australia**. So the "lighter" read was not lighter. It was a third
trip bought at full price, to avoid a cost that does not exist. CLAUDE.md **14f** exactly: a
mechanism that is genuinely present is not thereby the one responsible.

**Fixed** by making the layout and the page share one `cache()`d row read, so whichever asks
first pays and the other is free. The route is back to two round trips — *the same number it
made before the layout existed*, so the 404 fix now costs nothing at all.

| | Before F-011 | With F-011 | Now |
|---|---|---|---|
| DB round trips on the ticker page | 2 | **3** | 2 |
| Lighthouse performance (median of 3) | 84 (2026-08-22) | **65** | **72** |
| Individual runs | — | 54 / 65 / 68 | 68 / 72 / 77 |

**How I know the sharing actually happens.** The fix rests on React's `cache()` deduplicating
between a layout and the page inside it — if it did not, the row would simply be read twice and
the route would still make three trips. **That is exactly what the measurement rules out:** had
the dedupe failed, the trip count would be unchanged and there would be no improvement to see.
The improvement is the evidence. (The same mechanism was already load-bearing here for
`generateMetadata` and the page, which is why it was reasonable to reach for.)

**Every quantile improved** — sorted, 54→68, 65→72, 68→77 — which is a shift, not noise around
a shared mean. The saving lands *after* the shell, exactly where the removed trip was: TTFB is
**540 ms** (one round trip, the layout's), LCP **1.8 s**.

⚠️ **72 is still not 84, and I am not claiming the gap is closed.** Two honest caveats. (i) The
local score is dominated by ~500 ms per database round trip to a machine 15,000 km away;
production runs in `iad1`, the same region as the database, where the same two trips cost tens
of milliseconds. The local number understates production by roughly a second. (ii) It is noisy
day to day for the same reason, so **84 and 72 were not measured under the same conditions**
and the difference between them is not evidence of anything on its own. What *is* evidence is
the before/after taken minutes apart on one machine, above.

### F-014 ✅ The ticker page's two database reads now start together — and it is worth ~15ms

`fetchStockDetail` awaits the `stocks` row and *then* the price bars. Given the ticker, those
two reads do not depend on each other — they are sequential only because they are written that
way. Running them together would make the page's wall-clock cost one round trip instead of two.

**Done 2026-08-24 at the owner's instruction** — `Promise.all` in `fetchStockDetail`, so the
row and the bars are in flight together. It benefits the callers with no layout above them:
the report route and `generateMetadata`.

⚠️ **And it is worth far less than it looks, which is the honest part.** The round trip is
~500 ms *from Australia*; the functions run in `iad1`, beside the database, where it is tens of
milliseconds. **The production gain is ~15 ms.** The local Lighthouse number will improve more
than production does, and reporting that improvement as a win would be measuring the distance
from this desk to Virginia.

⚠️ **The larger version of this fix was deliberately NOT taken.** Starting the price-history
read in the *layout*, alongside the existence check, would overlap the last two trips and save
~500 ms locally. It would also mean any signed-in reader could make the database run a
price-history query for a ticker that does not exist, just by typing URLs — a free amplifier,
bought for 15 ms in the environment that matters. Security first; the owner's standing rule.

### Where the ticker page's points ACTUALLY are — measured, not assumed

The reason F-014 was never going to reach 90 is visible the moment the score is decomposed
rather than read. From the same report:

| Metric | Weight | Score | **Points lost** |
|---|---|---|---|
| **Total Blocking Time** | 30 | 0.39 | **18.3** |
| Largest Contentful Paint | 25 | 0.71 | 7.3 |
| Speed Index | 10 | 0.44 | 5.6 |
| First Contentful Paint | 10 | 0.93 | 0.7 |
| Cumulative Layout Shift | 25 | 1.00 | **0.0** |

**Over half the loss is Total Blocking Time — JavaScript occupying the main thread — and that
number is the same in production**, because it is CPU, not network. Database round trips move
LCP and Speed Index, the *smaller* half, and only on this machine.

Attributed to a single file: chunk `02jjyeg9mlceh.js`, **221 KB, 1,494 ms of script evaluation**
under Lighthouse's 4× CPU throttle. Fingerprinted rather than guessed — it contains `react-dom`
and `hydrateRoot`. So the cost is **React booting and hydrating the page**, not the chart
libraries, which sit in separate chunks and cost 167 ms and 39 ms.

🔵 **The remaining work is therefore about how much of this page is a client component**, which
is a real change to a paid surface and goes to the owner as a plan first (**11l**), not as a
quiet edit inside a measurement layer.

## Layer 3 — the wire sweep

**Run 2026-08-24, against the DEPLOYED PREVIEW.** 50 checks: 10 billing states × 5 premium
surfaces, each recording the status code, the `Cache-Control` header and the **raw response
body**. States enumerated from `lib/entitlement.ts`; premium field names parsed out of
`PREMIUM_FIELDS` in `lib/cycle.ts` at run time, so the needle list cannot drift from the real one.

### F-023 🔴 This sweep is MEANINGLESS on localhost — and it silently passed there first

The sweep was written against `localhost:3200` and reported a perfect result: no premium keys in
any body, in any state. **It was worthless**, and the control is what said so.

`/api/cycle` is a Vercel **Python** function. `next start` does not serve it, so on the local
production build the entire cycle block renders **nothing** — verified directly: no "Overall
Rating", no "Health Score", no "The Verdict", and not even the *free* "Current Drawdown" or the
"Major Cycle — not available at this horizon" notice. There was no paid payload on the page for
anyone, so of course none leaked.

⚠️ **Two instrument failures, stacked, both of which produce a clean bill of health.** The first
needle searched for `"overallRating"` with real quotes; in the RSC payload the JSON sits inside a
JavaScript string literal with every quote backslash-escaped, so it matched nothing anywhere.
Fixing that revealed the second and larger problem above. **A leak sweep that cannot see a leak
reports the same thing as a system with no leaks** — 14g, on the one layer whose entire job is
to find an authorisation bug.

**The fix is a positive control, and it is now part of the sweep**: an entitled viewer's page
*must* contain premium keys. If it does not, the run prints "THE SEARCH IS BROKEN, ignore every
row above" and fails. The harness also **refuses to run against localhost** rather than
producing a number that looks like evidence.

### Result on the preview — clean, with the control passing

| | |
|---|---|
| **Control** | entitled page contains all **9** premium fields — the search works |
| **Leaks** | **zero** premium keys in the raw body across all 7 denied states |
| Report download | 200 for `active` / `trialing` / `past_due` in grace; **402** for all 7 denied |
| `/api/analyze` | 200 for the 3 entitled; **402** for all 7 denied |
| `/api/cycle` direct | **401 in every state** — the internal-secret gate holds |
| `/run` | 216 KB entitled vs ~29 KB denied — the locked panel, not the screener |
| Cache headers | `private, no-store` or `private, no-cache, no-store` on **every** row; no `public`, no `s-maxage`, no `stale-while-revalidate` anywhere |

The four states the plan flagged as never-before-tested — `unpaid`, `incomplete`,
`incomplete_expired`, `paused` — all deny correctly and leak nothing. **CLAUDE.md 11b's failure
mode (a score hidden in the UI but sitting in View Source) is not present on any surface in any
state.**

⚠️ Note what this cost to learn: the same environmental limit that broke F-021's measurement
broke this sweep too, in a completely different way. **Localhost is not a place where this
product's paid surfaces can be audited.** Any remaining layer that touches the cycle payload
must run against a deployment.

---

## Where the audit stands — 2026-08-24

| Stage | Status |
|---|---|
| Step zero — sync + fold-ins | ✅ |
| Layer 0 — prove the instruments | ✅ 8 guards, 13 sabotages |
| Layer 1 — the coverage map | ✅ `docs/layer-g-coverage-map.md`, 5 defects |
| Layer 2 — the machine sweep | ✅ 16 of 16 gates; Playwright **597** |
| Layer 3 — the wire sweep | ✅ 50 checks on the deployed preview, clean |
| Layer 3b — the platform sweep | ✅ live Supabase / Vercel / Stripe / Actions |
| F-024 + F-025 | ✅ both fixed and guarded, 2026-08-25 |
| Layer 4 — the data sweep | ✅ live DB + on-screen, 2026-08-25 — 4 findings, **all four now fixed** |
| F-026 · F-027 · F-028 · F-029 | ✅ all applied 2026-08-25 after owner decisions; the listings alarm proven on GitHub in both directions |
| **Layer 5a — my visual sweep** | ⬜ **next** |
| Layer 5b — the owner's judgement sweep | ⬜ |

**Owner decision, 2026-08-24 — the next session did, in order:**

1. **F-024** ✅ — `anon`'s write grants on `profiles` revoked (migration `20260825000000`,
   applied live). Guarded by `e2e/db-grants.spec.ts` (5 tests), broken on purpose by re-granting
   the privilege and confirmed red at the right assertion.
2. **F-025** ✅ — `PRICE_TABLE` now asserted against Stripe's actual prices by
   `e2e/pricing-parity.spec.ts` (3 tests), broken on purpose three ways. The stated limit stands:
   a CI guard sees only the **sandbox**, so the six live figures are re-read at merge — now a row
   in the owner-only table above rather than a memory.
3. **F-026** 🟡 **new, found while fixing F-024** — the same over-grant is on all 12 tables, and
   `authenticated` still holds `DELETE` and `TRUNCATE`. Unreachable today, recorded rather than
   fixed: the approved scope was `anon` on `profiles`, and revoking across twelve tables is a
   change whose failure mode is a broken app (CLAUDE.md 11l). **Owner's call.**
4. **Layer 4** ✅ — the data sweep, run against the live database and the rendered page. The bulk
   is clean, including the three nightly invariants (proven able to fail, with a control) and the
   reporting-currency note verified **on screen** in all seven currencies. Four findings:
   **F-027** 🟠 the ASX listings source had answered nothing for a month behind an HTTP 200
   (**fixed the same day** — owner chose "fix both"), **F-028** 🔵 the `.V` case has no live data
   to check, **F-029** 🔵 insider values print a bare `$`, **F-030** 🔵 five index members are not
   fetchable companies. **Three still need an owner decision** — see the table below.

**Waiting on the owner, from Layers 3b and 4:**

| | Decision |
|---|---|
| ~~**F-027**~~ | ✅ **"Fix both", done 2026-08-25.** New source live, and the alarm **proven on GitHub** — a dispatched run with the dead URL went red at the gate, a control run with the real one went green with the gate skipped. The delisting sweep was made safe after a dry run found it would have retired 158 live companies |
| ~~**F-028**~~ | ✅ **Yes, done.** TSX Venture on; Canada's menu 1,235 → 2,692 |
| ~~**F-029**~~ | ✅ **Stock Detail only, done.** Owner: *"we can fix the stock detail page for this but not the results tab"* — the Results table's bare `$` stays as it is, by decision |
| ~~**F-026**~~ | ✅ **Done.** Both public roles now hold exactly the verbs their row policies allow, and nothing on the nine server-only tables |

**Nothing from Layers 3b or 4 is now waiting on the owner.**

5. **Layer 5a** — my visual sweep. Next.

⚠️ Real-user monitoring is **deferred, not dropped**. Until it exists, decision #33's merge-gate
row stays **red**, and the reason is written into that row so nobody reads it as unfinished work
and repeats F-019 → F-021.

---

## Layer 4 — the data sweep

**Run 2026-08-25 against the LIVE database**, per the approved method: *"Only this layer can catch
a number that is plausible and wrong. Run against the live database, not fixtures… Every check
asserts the field is present before judging it, because 'I could not read it' has been reported
here as 'clean' before."*

Half of it is in the database and half is on the screen, and 14d is why both halves are needed:
the reporting-currency fix once shipped **inert** — code, tests and guards all green while every
page still printed `A$` — and only a screenshot caught it. So the currency work below was checked
in the database *and* read off the rendered page.

### Verified clean

| Check | Result |
|---|---|
| Nightly units + invariants, live | **39 fields across 867 stocks, every median in band.** The log names the invariants — *zero-margin sentinel, cross-currency fcf_yield_pct, financial_currency coverage* — rather than counting them (the 14g fix) |
| …and **proven able to fail** | all three sabotaged: a single `0.0` margin, one cross-currency `fcf_yield_pct`, and the `financial_currency` field wiped. Each went red naming the row. **With a control**: 4 rows missing out of 100 stays correctly quiet, because that invariant is a *proportion* — a check that cries wolf gets ignored |
| Seven reporting currencies | **USD 599 · AUD 200 · CAD 54 · NZD 10 · EUR 2 · SGD 1 · TWD 1**, plus 4 with none (the benchmark indexes, which have no financial statements) |
| Cross-currency withholding | **79** cross-currency stocks. `fcf_yield_pct` present on **0 of 79** and on **713 of 788** same-currency stocks — a positive control, not merely an absence (14g) |
| The currency note, **on screen** | rendered verbatim for USD-in-AUD (BHP.AX), USD-in-CAD (AMD.TO), NZD (A2M.AX), EUR (ASML), SGD (TUA.AX), TWD (TSM) — *"Figures reported in US dollars (USD) — the company's reporting currency, not its share price currency (AUD)."* — and correctly **absent** on the two same-currency controls, AAPL and CBA.AX |
| Bank zero-margin sentinel | `gross_margin` and `ebitda_margin` are **null** for all seven banks probed (C, WFC, SYF, JPM, BAC, EQB.TO, CBA.AX) while `operating_margin` and `net_margin` carry real figures. Across all 871 rows, **zero** exact `0.0` in any of the four margins |
| Stocks paying no dividend | **197** rows store `null`, **zero** store `0.0` — so a non-payer is absent rather than a real 0%. `payout_ratio_pct` meanwhile has **199 genuine zeros**, which is correct: 14b covers only the four margins |
| The ASX date bug (14a) | **0 Saturdays and 0 Sundays** across all **6.6M** bars in all three markets, with Fridays in normal proportion. The bug produced 273,700 Sundays and 0 Fridays |
| Three markets, all current | US 4,688,581 bars / 542 tickers · AU 1,409,011 / 250 · CA 504,616 / 79. Last bar 2026-08-25 (AU and US), 2026-08-24 (CA) |
| The four index rows | `market = 'index'`, excluded from Browse by `.neq('market','index')` and unreachable through the ticker router, which knows only `us`/`au`/`ca` |
| Truncation headroom (14c) | `stocks` **871** — 129 from PostgREST's silent 1000-row cap; `listings` **9,136**, i.e. long past it. `selectAll()` is load-bearing today, not prophylactic |
| Request-a-Ticker queue | 8 fetched, 1 correctly marked `unsupported` after 3 attempts. No stuck rows |

### F-027 ✅ The ASX listings source returned nothing for a month — FIXED 2026-08-25, both halves

`listings` rows for `au` are stamped **2026-07-24**. The `us` and `ca` rows are stamped
**2026-08-24**. The nightly job fetches all three markets every night, so AU has been failing
silently for a month.

**Run by hand, it is unambiguous:** `sources.fetch_au()` returns **0 symbols**, logging
*"ASX CSV: no 'ASX code' header row found"*.

⚠️ **And here is why nothing was ever red.** The ASX now sits behind Imperva bot protection, and
what it returns is:

    status   : 200
    type     : text/html
    bytes    : 379
    <html><head><title>Request Rejected</title></head>…

**A rejection wearing a success code.** `requests.get` does not raise, `raise_for_status()` would
pass, and only the *content* is wrong. `refresh_listings` then treats an empty pull as a
deliberate **soft failure** — warn, skip the upsert, and specifically *do not* deactivate the
market, which is the right call for a format change — so the workflow **succeeds**, and GitHub's
failed-workflow email, which is the only alerting channel this project has, never fires.

**What it costs a reader, in the owner's own market:** any ASX ticker outside the 250 already
covered is refused by Request-a-Ticker as *"not a known US/AU/CA listed stock"*, and
`/api/listings/search` serves a month-old ASX menu — missing every new listing and still offering
every delisting. It will not self-heal and nothing will ever say so.

✅ **A working replacement exists and it is one line.** The directory behind the ASX's own site —
`https://asx.api.markitdigital.com/asx-research/1.0/companies/directory/file?access_token=…` —
returns `text/csv` with the **identical** `"ASX code","Company name"` header the current parser
already looks for. Pointed at it, the **unchanged** `fetch_au()` reads **~1,810 symbols**, with
BHP, CBA, A2M, VUL and TUA all present. The URL is already env-overridable (`ASX_LISTINGS_URL`),
so this is a constant, not a rewrite.

**Siblings swept.** The class is *a third-party fetch that fails with a success code*. The US
(`nasdaqtrader.com`, two files) and CA (`tsx.com`) sources are the same shape and are working
today — proven by their `updated_at`, not assumed. `index_membership` is fresh (2026-08-24) and
complete for all three indexes.

#### What was done — owner chose "fix both", 2026-08-25

**Half one — the address.** `_ASX_URL` now points at the directory the ASX's own site reads. The
parser is unchanged.

**Half two — the alarm, and this is where it got interesting.** My first plan was to make
`refresh_listings` exit non-zero. ⚠️ **That would have been a fix that changes nothing anybody
ever sees.** The workflow step runs `continue-on-error: true` — deliberately, so a flaky listings
source can never block the nightly price refresh — which means a non-zero exit is **recorded and
ignored**. There were *three* stacked silences, not two, and removing any two of them leaves it
silent:

1. the URL answering `200` with an error page,
2. `run()`'s soft-failure policy (correct, but not a signal),
3. `continue-on-error` swallowing the exit code.

So the exit code is paired with a **gate step at the end of the workflow** — placed last, after
the prices, the units check and the landing snapshot, for the same reason the units check is last:
failing must not skip any work. It reads `steps.listings.outcome`, which is the step's own result
*before* `continue-on-error` rewrites it (`conclusion` would always read success and the gate
would never fire), and fails the job — firing GitHub's failed-workflow email, the only channel
this project has ever proven to work.

**The rule itself compares against what we already hold**, not a magic per-market constant: a pull
under **half** the stored active count is a regression, and a market with nothing stored — a
genuine cold start — is correctly quiet.

**Proven both ways, against the real dead URL:**

| | result |
|---|---|
| sabotage — `ASX_LISTINGS_URL` pointed back at the dead address | `au LISTINGS REGRESSION: pulled 0, we already had 1981 active` · `::error::` annotation · **exit code 2** · nothing written |
| the fix — the working address | **1,841 symbols**, `regressed=[]`, **exit 0** *(1,810 an hour later — the file moves)* |

⚠️ **The exit code had to be read without a pipe.** My first reading was `exit=0` because the
command was piped through `grep | tail` and I had read *tail's* status. An exit code you have not
actually observed is exactly what this whole finding is about.

#### ⚠️ And the fix would have caused a WORSE bug — caught by a dry run before anything was written

The replacement source is **not a superset**. It carries ~1,810 of the 1,999 symbols we hold, and
the ~190 it omits are **not all delistings**. Two of them are companies we actively cover, with
current price data: **QUB.AX (Qube Holdings, an ASX 200 constituent) and CVW.AX**. 27 of 29
well-known ASX codes are present; those two simply are not in the file, and the file is not
truncated — it runs alphabetically to `ZNO`.

So applying the URL fix alone would have let the delisting sweep mark **158 live companies "not a
known listing"** — turning a source that returned *nothing* into one that returned something
*wrong*, which is worse, because the second looks like it is working.

⚠️ **And the count MOVES, which is a finding in its own right.** The first measurement read
**1,841**; the GitHub run an hour later read **1,810**, and a simultaneous re-fetch from a second
machine also read 1,810 — so it is the ASX directory changing during the day, not a difference
between an Australian and an American IP. Any single number here is a snapshot, and that is
exactly why the guard is a **proportion** rather than a symbol count: a fixed threshold would need
re-tuning every time the source breathes. `analytics/tests/test_listings_regression.py` asserts
**both** measurements, because a rule that only survives one snapshot of a moving source is not a
rule.

**The asymmetry decides it.** Leaving a delisted company in the menu costs a reader one failed
request, which `drain_requests` already handles by marking it `unsupported`. Removing a **live**
company tells them their real stock does not exist, and nothing ever corrects it. So
`is_safe_to_deactivate` refuses the sweep when a pull would retire more than **2%** of a market —
ordinary churn is a handful of companies a week, well under 1%.

⚠️ **Two rules, not one, and they are independent.** ~1,810 against 1,999 is nowhere near a
regression — the market did not collapse — and yet its omissions must not delist anyone. A single
threshold would have had to choose between crying wolf on a healthy pull and silently delisting
QUB. The set difference is also counted **per symbol** rather than inferred from the totals,
because a source that adds 200 and drops 158 nets out to a comfortable-looking number while still
retiring 158 live companies.

⚠️ It logs a **warning**, not a workflow failure: this state persists while two sources disagree,
and a red X every night for something nobody can act on is how people learn to ignore red.

**Live result** — the fix applied to production the same day:

    AU listings: 1841 symbols (ASX)
    au: skipping the delisting sweep — this pull would retire 158 of 1999 symbols (7.9%) …
    counts={'au': 1841} refreshed=['au'] failed=[] regressed=[]      exit 0

`listings` AU went **1,981 → 1,999 active**, 18 added, **none removed**. Verified in the database:
BHP, CBA and VUL carry today's timestamp; **QUB.AX and CVW.AX kept their old one and are still
active.**

Guarded by `analytics/tests/test_listings_regression.py` — 18 cases across both rules, including
the ones that must stay **quiet** (a cold start, an ordinary 8%-smaller month, exactly half
surviving), because a rule that answers "yes" to everything satisfies every must-fire case and
fails the product.

⚠️ **One thing is NOT verified end to end and should not be read as if it were:** the workflow gate
step itself has never executed. The YAML parses, the step is last, and the `if` names the right
step id — but GitHub Actions cannot be run from here, so its first real exercise will be the next
nightly run. `steps.<id>.outcome` under `continue-on-error` is documented behaviour, not measured
behaviour.

### F-028 ✅ TSX Venture turned on — 2026-08-25, owner approved

The method singles out *"a `.V` ticker — the one case where a URL collision would silently serve
one company's data under another's name."* There are **zero** `.V` rows anywhere: not in `stocks`
(871), not in `listings` (9,136 at the time — 10,611 now that venture is on), not in
`ticker_requests`.

The reason is explicit and deliberate. `analytics/listings/sources.py` fetches **TSX only**, and
says so: *"This is now a PRODUCT choice, not a technical block — the routing limitation this
comment used to cite was fixed on 2026-08-04."* Turning TSX Venture on is one line.

So the collision CLAUDE.md #14 warns about is handled in code (`MARKET_SUFFIXES`, plus
`analytics/tests/test_market_inference.py`) and **had no data behind it**.

#### What was done — owner said yes, 2026-08-25

`fetch_ca` now pulls both boards, as two independent calls so a TSXV outage cannot take TSX with
it. Canada's requestable menu went **1,235 → 2,692**: 1,235 TSX plus **1,457 TSX Venture**, live
in `listings` and confirmed in the database with `exchange = 'TSXV'`.

⚠️ **The collision the rule exists for does not occur today** — checked rather than assumed: zero
roots are listed on both boards, so no `ABC.V`/`ABC.TO` pair exists in the current universe. The
rule still holds (`.V` keeps its suffix in the URL, and `e2e/ticker-routing.spec.ts` already
asserts the round trip), but it is protecting against a future case rather than a present one.
That is worth writing down so the next reader does not mistake "no collisions" for "the rule was
exercised".

### F-029 ✅ Insider values printed a bare `$` on every non-US stock — FIXED on Stock Detail, 2026-08-25

`fmtValue()` in `components/stocks/SmartMoneyActivity.tsx` hard-codes `$` and **takes no currency
argument at all** — it cannot know which currency it is printing.

Seen live on BHP.AX, a stock the same page prices at **A$67.67**: *"64 shares · $1K"*.

#### ⚠️ A correction to my own first report of this, and it changed the fix

I wrote that the value "may not even be in the stock's currency", from BHP's stored row —
`value: 1304.0`, `"at price 0.00 - 40.74 per share"`, which is clearly the **US ADR** price. That
observation was correct about BHP and **wrong as a generalisation**, and I had drawn it from one
stock.

Measured properly across **4,539 AU and CA transactions**, comparing each implied per-share price
against that stock's own 52-week range:

| | transactions | implied price sits inside the local range |
|---|---|---|
| AU | 2,258 | **2,138 — 94.7%** |
| CA | 2,281 | **2,213 — 97.0%** |

So the values *are* in the local currency for the overwhelming majority; BHP is the exception
because it is dual-listed with a US ADR and yfinance surfaces the US filing. **This mattered:**
had the first claim stood, the honest fix would have been to strip the value or leave it
unlabelled. The measurement is what made labelling it the right answer — a bare `$` is read as US
dollars by convention, so it was wrong on 100% of those pages, where the local symbol is right on
~95%.

#### What was done — Stock Detail only, 2026-08-25

Owner's instruction: *"we can fix the stock detail page for this but not the results tab."*
So `SmartMoneyActivity` gains a **required** `currency` prop — required rather than defaulting to
`'USD'`, because a default lets the next caller forget it and silently reproduce this exact
defect, and the type error is the only thing that makes an omission visible.

⚠️ **The private formatter was DELETED, not corrected** (CLAUDE.md 11c-viii). `lib/format.ts`
already exports `fmtCompact(value, currency)`, which does the same K/M/B job currency-aware, so
`fmtValue` is now a two-line wrapper that keeps the `" · "` separator and calls it. Writing a
fourth private money formatter would have reset the clock rather than closed the hole.

⚠️ **And a second hard-coded `$` was found in the same file while fixing the first** — the Smart
Money chart's crosshair tooltip printed `$${price.toFixed(2)}` for the *share price*. Same
component, same defect, and it would have survived a fix aimed only at the insider values. Now
`fmtPrice(price, currency)`.

⚠️ **This is the third instance of this precise defect.** `fmtPerShare` in `lib/format.ts` says in
its own docstring that it exists "mainly to fix the hardcoded '$' in
EarningsHistory/DividendHistory so AUD/CAD render A$/CA$". The fix reached those two components
and never reached this one — 11c-iv, the rule that one consumer never received.

**Guarded** by `e2e/stock-currency.spec.ts`: an ASX page must show `A$` and must contain no bare
`$`, **with a US control** that must NOT say `A$` — because every Australian assertion is equally
satisfied by a formatter hard-coded to `A$`, which is a different bug of the same size. It also
carries a loud precondition that insider rows with values actually rendered, since a page with no
transactions would pass every assertion having measured nothing.

**Still open, and unchanged:** the Results table's bare `$`, which the owner has deliberately left
alone.

### F-030 🔵 Five index members are not fetchable companies

| Index | Members | In `stocks` | Missing |
|---|---|---|---|
| sp500 | 509 | 505 | `FDXF`, `HONA`, `HONIV`, `Q` |
| asx200 | 208 | 207 | `CNIXX.AX` |
| tsx60 | 60 | 60 | — |

The four US ones are when-issued and spin-off lines (FedEx Freight, two Honeywell lines);
`CNIXX.AX` is a cash-sweep line in the IOZ holdings. None has a single price bar and none was ever
queued as a ticker request. A reader running the "S&P 500" basket therefore sees four tickers come
back unavailable with no explanation. The fix would be filtering the ETF holdings to real equity
lines. Low severity, recorded.

### ⚠️ Four instrument errors of mine in this layer — every one caught by checking

The audit's own rule is that a guard which has never failed proves nothing; the same applies to a
probe written five minutes ago (11p). All four of these produced confident, plausible, wrong
output.

1. **I searched `fundamentals` for `financialCurrency`. The key is `financial_currency`.** The
   result read *"0 of 871 rows carry the reporting currency"* — which would have been a
   catastrophic finding (14g's exact shape: the invariant's own field wiped out). It was a wrong
   needle. Same failure as Layer 3's escaped-quote search, one day later.
2. **I looked for `pe_history` inside `fundamentals`.** It is a top-level column on `stocks`. My
   probe reported it as absent on every row in the universe.
3. **A regex reported BHP.AX as missing its reporting-currency note.** It requires three letters
   after "reported in", and the real sentence is *"reported in US dollars"* — two. The note is
   there, verbatim, twice on the page. It matched NZD only because `New` is three letters.
4. **`waitUntil: 'load'` read four ticker pages as "thin"** (under 2,000 characters) and I nearly
   filed them as failing to render. Waiting on a positive signal — the Key Metrics heading —
   showed all four render in full (11q: *wait for a positive signal, not a plateau*).

**The habit that caught all four is the same one:** print what the system actually returned before
concluding anything from it.

---

## Layer 3b — the platform sweep

**Run 2026-08-24 against the LIVE systems** (Supabase, Vercel, Stripe, GitHub Actions). None of
this lives in the repository, so no test, guard or code review can see it — it has to be asked
of the platforms directly.

### The headline: there is no paywall bypass in the database

The question the method singles out is *can a signed-in customer edit their own subscription
status and give themselves the paid product?* **No.** The column-level grant for `authenticated`
on `profiles` is exactly three columns:

    acknowledged_disclaimer_at, country, display_name

`subscription_status`, `grace_until`, `billing_blocked`, `stripe_subscription_id` and the rest
are not writable by a customer at all. The row policy (`auth.uid() = id`) scopes them to their
own row on top of that.

| Area | Result |
|---|---|
| Row-level security | **on for all 12 tables**; 9 carry no policy (deny-all — the intended state for server-only tables), 3 are scoped to the caller's own rows |
| Security advisors | **9, all INFO**, all "RLS enabled, no policy" — i.e. the deny-all tables above |
| Stripe live webhook | **1 endpoint**, enabled, livemode, 13 events, on the `www` host (the apex 307s and Stripe counts a 3xx as failed delivery) |
| Prices charged vs shown | **all six match** — see below |
| Scheduled jobs | both GitHub crons **succeeded on their last 3 runs**; `stocks` last updated 08:41 UTC today |
| Account purge | scheduled in `web/vercel.json` (`0 3 * * *`); **0 profiles overdue** past the 30-day promise (1 scheduled, none stale) |
| Hosting plan | **hobby** — the launch blocker, re-verified live rather than remembered |

### F-024 ✅ `anon` could write every profile column — FIXED 2026-08-25

`authenticated` was deliberately narrowed to three columns. **`anon` was not**: it retains
`UPDATE` and `INSERT` on all 20 columns of `profiles`, `subscription_status` included.

⚠️ **Not exploitable, and I proved that rather than reasoning it.** An anonymous client was
pointed at a throwaway profile and told to set `subscription_status` to `active`. Result: no
error, **0 rows returned, value unchanged** — the row policy compares `auth.uid() = id`, and for
an anonymous caller `auth.uid()` is NULL, which is never true. **With a control**: the same row
was then written successfully by the service role, so "nothing changed" is a refusal rather than
an unreachable row or a silently broken client.

It is still the shape this project has been bitten by four times: **a rule applied to one
consumer and not its sibling** (CLAUDE.md 11c-iv). One `revoke` closes it, plus a guard so a
future migration cannot widen it back in silence.

#### What was done — 2026-08-25

`supabase/migrations/20260825000000_revoke_anon_writes_on_profiles.sql`, applied live:
`REVOKE ALL ON public.profiles FROM anon;` then `GRANT SELECT ON public.profiles TO anon;`

⚠️ **It had to be table-level.** Postgres does not let a column-level REVOKE subtract from a
table-level GRANT — a trap already documented at length inside `20260726010000`, in the same
comment that said of this very grant *"Tightening that grant is tracked separately."* **A
sentence in a comment is not a gate** (CLAUDE.md 11f); it sat there for a month.

**Measured at the wire, before and after, with the same probe:**

| anon, on `profiles` | before | after |
|---|---|---|
| UPDATE `subscription_status` | `200`, no error, **0 rows** | `42501 permission denied for table profiles` |
| INSERT a profile | `42501` — *"violates row-level security policy"* | `42501 permission denied for table profiles` |
| DELETE a profile | `200`, no error, **0 rows** | `42501 permission denied for table profiles` |
| CONTROL — SELECT | `200`, 0 rows | `200`, 0 rows *(unchanged)* |

⚠️ **The refusal becoming VISIBLE is the part that made this testable.** Before, a refusal and
a client that silently did nothing were the same response. That is the same silence documented
in `app/(app)/actions.ts`, where an early browser-side write "returned NO error: a silent
non-save".

⚠️ **And it is why the guard cannot assert on the error code alone.** INSERT *already* answered
42501 before the fix — from the row policy. A test matching `42501` would have passed on the
broken state and proved nothing. `web/e2e/db-grants.spec.ts` asserts the **message** in both
directions: it must say *"permission denied for table"* and must **not** say *"row-level
security"*.

**Why SELECT was deliberately kept.** Every server read of `profiles` runs on a cookie-bound
client, and a client whose JWT has just expired falls back to `anon`. Today that read answers
"0 rows", which callers treat as "no entitlement" — the safe direction. Without the grant it
would answer an error, and a page whose token expired mid-request would break for a paying
customer. RLS already returns nothing, so the grant buys an attacker nothing and costs us a
failure mode. Writes have no such caller: every profile write in the app is preceded by
`getUser()` bailing out when there is no user, so it always runs as `authenticated` — checked
across all 34 `from('profiles')` call sites, including `proxy.ts`, which reads only when a
`userId` already exists.

**The guard — `web/e2e/db-grants.spec.ts`, 5 tests, broken on purpose.** It reads the running
database, not the migration (CLAUDE.md 11d: a migration file is a claim that someone once tried
to change something). Sabotage: `GRANT UPDATE ON public.profiles TO anon` put the defect back
and the UPDATE test went red at the right assertion; the grant was restored and the catalog
re-read to confirm `anon` holds `SELECT` and nothing else.

Two controls, and the second is the one that matters most:

- the anon key must still **read** successfully and get zero rows — otherwise a wrong URL or a
  revoked key would satisfy every refusal above for entirely the wrong reason;
- a real signed-in account (throwaway, created and deleted in the spec) must still be able to
  save `display_name` and `country`, and must still be refused `subscription_status`. **A
  database that refuses everyone passes every other assertion in the file** — and would surface
  not as a red test but as a customer unable to save their own name.

### F-025 ✅ The price shown and the price charged now have a link — FIXED 2026-08-25, sandbox only

Checked by hand, and every figure agrees — Stripe live, `PRICE_TABLE` in `lib/pricing.ts`, and
locked decision #18:

| | Stripe (live) | the site shows |
|---|---|---|
| Monthly | US$15 · A$19 · C$20 | US$15 · A$19 · C$20 |
| Annual | US$126 · A$159 · C$168 | US$126 · A$159 · C$168 |

⚠️ **Nothing enforces that agreement.** The amounts live in two systems that cannot see each
other, and a change to either is silent: edit `PRICE_TABLE` and the site advertises a price
Stripe will not charge; edit the Stripe price and the site advertises one it no longer charges.
The second direction is a consumer-law problem, not a bug — and this is exactly **11c (v)**,
a number stated in one place and enforced in another, which is where copies go to drift.

⚠️ **And a CI guard can only see half of it.** The Stripe key in CI is the sandbox
(`stripe-key-scope.spec.ts` proves it is restricted), so a test can assert `PRICE_TABLE` against
**sandbox** prices — which catches the common case of someone editing the table, and cannot see
a live-mode change at all. Worth building with that limit stated, with the live figures re-read
at merge. Owner's call.

#### What was done — 2026-08-25

`web/e2e/pricing-parity.spec.ts`, 3 tests. It imports the real `PRICE_TABLE` and the real
`PLAN_LOOKUP_KEYS` and asks Stripe what it charges, rather than restating either — a test
carrying its own copy of the numbers would be a **third** copy to drift, which is the defect
and not the guard (CLAUDE.md 11c iii).

Per plan (`majorcycle_monthly`, `majorcycle_annual`) it asserts:

- **exactly one** active price for the lookup key — zero would make every comparison below
  vacuous and pass having compared nothing (14g); more than one means checkout picks whichever
  Stripe happens to list first;
- the billing **interval** — a right amount on a wrong interval is the expensive version of
  this bug, and nothing about the sticker would look wrong;
- every currency the site advertises **exists** in Stripe's `currency_options` — otherwise a
  customer is shown a price Checkout cannot charge;
- and each amount **equals** `PRICE_TABLE`, in minor units.

A third test ties the annual figures to locked decision #18's *"Annual ~30% off"* by asserting
the relationship through `annualSavingPercent()` — the same function the "Save N%" badge
renders — rather than adding a fourth copy of the numbers.

⚠️ **`currency_options` is not returned unless expanded**, and that is guarded as a control on
the *instrument*: without `expand`, every amount reads `undefined` and the natural failure says
*"Stripe has no USD amount"* — true of the response, false about Stripe, and it would send the
reader to the dashboard instead of to the request. An explicit assertion now fails first,
naming the real cause.

**Broken on purpose, three ways, each red with the right message:** an edited `PRICE_TABLE`
(*"AUD monthly: the site shows 18, Stripe charges 19"*); the `expand` deleted (*"the request is
missing expand: ['data.currency_options']"*); a lookup key that does not exist (*"expected
exactly one active Stripe price…"*).

⚠️ **THE LIMIT IS NOT A FOOTNOTE — this suite is blind to live mode.** Test and live are
separate objects that merely share a `lookup_key`, and CI holds only the restricted test key.
So an edit made in the **live** dashboard produces exactly the mismatch this file exists to
catch, invisibly. That is why the merge-gate table below now carries an owner-only row to
re-read the six live figures at merge, rather than leaving it to memory. Last read by hand
2026-08-24 (Layer 3b): all six matched.

### F-026 ✅ The same over-grant was on all 12 tables — FIXED 2026-08-25, owner approved

**Found while fixing F-024, by asking a wider question of the same catalog.** F-024 was written
as a `profiles`-and-`anon` problem. It is not: it is the stock Supabase posture on **every**
table in `public`.

Supabase grants `ALL` privileges on a new public table to both `anon` and `authenticated`, and
safety then rests entirely on row-level security. Measured across all 12 tables on 2026-08-25,
both roles hold `SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE` on every one —
with exactly two exceptions, both deliberate: `authenticated`'s UPDATE on `profiles`, narrowed
to three columns in July, and `anon` on `profiles`, narrowed to `SELECT` today.

⚠️ **`TRUNCATE` is the one that deserves naming, because row-level security does not apply to
it.** RLS governs `SELECT`/`INSERT`/`UPDATE`/`DELETE`; a `TRUNCATE` is not filtered by a policy
at all. So the layer everything else in this table rests on is, for that one verb, absent.

**It is not reachable, and that was checked rather than assumed:**

- PostgREST only ever issues `SELECT`/`INSERT`/`UPDATE`/`DELETE` and function calls. It has no
  path that emits `TRUNCATE`.
- `anon` and `authenticated` both have **`rolcanlogin = false`** — nobody can connect to
  Postgres directly as either. Only `authenticator` can log in, and it switches into them.
- Eight of the twelve tables carry **no policy at all**, so every ordinary verb is already
  denied to both roles through the API.

So: no hole today. But "unreachable today" is precisely where F-024 started, and the missing
verb here is the one RLS was never going to catch.

⚠️ **Deliberately NOT fixed in this session.** Revoking grants across twelve tables is a change
whose failure mode is a broken production app the owner cannot debug, and the approved scope was
`anon` on `profiles`. Recording a defect I am not authorised to fix, rather than quietly
widening the change and calling it tidying, is the rule set by CLAUDE.md 11l.

#### What was done — 2026-08-25

Migration `20260825010000_least_privilege_public_roles.sql`, applied live. Every grant was
derived from `pg_policy` and from a sweep of **every** `.from('<table>')` call site in the app,
not from memory.

| | `anon` | `authenticated` |
|---|---|---|
| the **nine** policy-less tables | *(nothing)* | *(nothing)* |
| `analysis_runs` | `SELECT` | `SELECT, INSERT` |
| `referrals` | `SELECT` | `SELECT, INSERT` |
| `profiles` | `SELECT` | `SELECT` + `UPDATE(display_name, country, acknowledged_disclaimer_at)` |

The three policy tables now grant exactly what their policies allow — `SELECT + INSERT` on own
rows for `analysis_runs` and `referrals`, `SELECT + UPDATE` on own row for `profiles` — and
nothing else. `DELETE`, `TRUNCATE`, `TRIGGER` and `REFERENCES` are gone from both roles
everywhere.

**Why the nine were safe to strip:** they carry no policy, so both public roles were already
getting nothing through the API. Verified before writing, not assumed — every read of `stocks`,
`price_bars`, `listings`, `ticker_requests`, `universe_log`, `index_membership`, `split_events`,
`stripe_events` and `trial_tombstones` goes through `createAdminClient()`. The only
session-client reads and writes in the entire app are on the three tables above.

**Why `anon` keeps `SELECT` on those three**, the same reasoning as F-024: a cookie-bound server
client whose JWT has just expired falls back to `anon`, and "0 rows" is an answer every caller
already handles, where a permission error would break a paying customer's page mid-request. RLS
returns nothing to an anonymous caller either way.

⚠️ **`REVOKE ALL` also drops `profiles`' three-column UPDATE**, which is why the migration
re-grants it explicitly and the catalog was re-read afterwards to confirm all three columns
survived. Losing that line would not error — it would silently stop `/account` saving.

**Guarded** by nine new cases in `e2e/db-grants.spec.ts` (suite 5 → 15), each asserting the
*message* rather than the code, plus a control proving the same client can still reach
`analysis_runs` — without which a broken key would satisfy all nine refusals.

### Recorded, no action

`stocks` is **871 rows** — 129 from PostgREST's silent 1000-row truncation, and the universe
grows on every reader's ticker request (#16). `listings` is **10,611** (9,134 before TSX Venture was turned on), i.e. already far past it,
so `selectAll()` is load-bearing today rather than prophylactic. Both are covered by
`pnpm check:data-integrity`, which Layer 0 proved able to fail.

---

### F-021 🔴 The ticker page's score cannot be measured honestly from here — and my theory about it was wrong

**My hypothesis, stated to the owner:** every number in this session came from a laptop in
Australia talking to Supabase in `us-east-1`, and the project's own notes put ~390 ms of that
round trip down to pure distance. In production the function runs in `iad1`, beside the
database. So the local 83 should be *pessimistic*, and the deployed page might already be near
the 90 decision #33 asks for. Worth measuring before spending anything more.

**Measured on the deployed preview, signed in, three runs. The hypothesis was wrong.**

| | local `:3200` | Vercel preview |
|---|---|---|
| performance | **83** (85/82/83) | **64** (64/61/74) |
| total blocking time | 220 ms | **370 / 540 / 990 ms** |
| largest contentful paint | 1.6 s | 1.5–1.8 s |
| cumulative layout shift | 0 | 0 / 0 / **0.022** |

⚠️ **But the preview number is not trustworthy either, and that is the actual finding.** A
2.7× swing in blocking time across three consecutive runs is not a measurement, it is noise;
and every request now crosses the Pacific to reach this machine, which inflates Lighthouse's
simulated load in a way no customer experiences. **The two available numbers are contaminated in
opposite directions and neither is what a reader in New York sees.**

⚠️ **And there is no third instrument.** Google's PageSpeed Insights would measure from near
the deployment, removing my distance entirely — but it cannot reach this page twice over: the
preview is SSO-gated, and the ticker page is behind sign-in even in production. **A lab tool
outside the session boundary can never measure a page inside it.**

⚪ **So decision #33 — "Lighthouse 90+ on per-ticker pages" — currently sets a target on a
number nobody can measure reliably.** It was agreed during planning, before this page existed
and before anyone had run Lighthouse against it. That is not an argument for abandoning the
goal; it is an argument that the goal needs an instrument, and today it has none.

✅ **OWNER DECISION, 2026-08-24: real-user monitoring will be added LATER, not now.** The
audit resumes instead. So decision #33's row stays red and open rather than being quietly
dropped — the target is not abandoned, it is waiting for the instrument that can measure it,
and the reason it cannot be ticked today is written down above rather than left as a mystery for
whoever reads the merge gate next.

**The instrument that fits is real-user monitoring** — it measures actual customers on actual
devices and networks, works perfectly well on gated pages because it runs inside the session,
and replaces a contaminated proxy with the thing the target is actually about. Nothing of the
sort is installed today (no `@vercel/speed-insights`, no `@vercel/analytics`, no Sentry). Adding
one is a change to the locked stack, so it goes to the owner rather than being slipped in.

⚠️ **What survives all of this: the byte counts.** `lighthouse.mjs` says so in its own
header — "the byte counts do not have this problem and are the better evidence when one
exists". The document went 3,019 → 2,004 KB and transferred-to-load 1,222 → 1,079 KB, measured
identically three times each. Those numbers are exact, they are not affected by which machine
took them, and they are the honest evidence that F-019 was worth doing — not the score, which
did not move.

⚠️ One thing to watch rather than act on: **CLS was 0.022 on one preview run** and 0 on the
other two, where local is reliably 0. A single non-zero reading inside a noisy set is not a
regression, but the benchmark fetch landing during load is a plausible mechanism and this is
the first reading that has ever been non-zero. Worth re-checking once a real instrument exists.

### F-020 ⚪ Splitting hydration with Suspense boundaries made it WORSE — REVERTED

**Owner constraint that framed this:** *"I don't want to change the interactive things
happening in the stock detail page. I made it interactive so that the user can easily view
things and make decisions."* That rules out the standard remedy for blocking time — fewer
client components — so the search was for something that keeps every control live.

**What the research found.** Next's own streaming guide, shipped in `node_modules` at the exact
installed version (`01-app/02-guides/streaming.md`, line 600):

> Each `<Suspense>` boundary is a hydration unit. Without them, React hydrates the entire page
> in one blocking pass. With them, hydration is broken into smaller tasks that yield to the
> browser, keeping the main thread responsive.

That looked ideal. Total Blocking Time counts only the part of each task beyond 50 ms, so the
same total work split across many tasks scores far better — with **nothing** deferred, removed
or made lazy. And the page was a good fit on inspection: all 7 existing boundaries sat in
`sec-thesis` and `sec-cycle`, while `sec-fundamentals` and `sec-sentiment` — six recharts
components including the 743-line `SmartMoneyActivity` — had **none**.

**Measured, and it went the wrong way.** Nine client components each given their own boundary,
7 → 16:

| | before | after |
|---|---|---|
| performance | **83** (85/82/83) | **73** (73/76/71) |
| total blocking time | 220 ms | **430 ms** |
| script evaluation | 1,688 ms | 2,081 ms |

Blocking time nearly doubled. Reverted; `page.tsx` is byte-identical to the committed version.

⚠️ **Why the documented mechanism does not apply here, which is the part to remember.** The
guide describes boundaries that actually *stream* — async content arriving in separate chunks,
which is what gives React distinct hydration units to interleave. These sections render
**synchronously**: nothing suspends, so nothing streams, and the boundaries bought no splitting
at all while still costing payload structure and hydration bookkeeping on every one. **A
Suspense boundary around synchronous content is overhead with no upside.**

⚪ **The honest conclusion: with the interactivity requirement in place, the blocking-time
points are not available by configuration.** They are the intrinsic cost of ~18 interactive
components and two charting libraries hydrating. The remaining real lever is consolidating
`lightweight-charts` and `recharts` into one library — a genuine JS reduction with no loss of
interactivity, but a rewrite of the chart components and a visual change, so it is an owner
decision rather than a tuning exercise.

⚠️ Recorded as a NEGATIVE finding on purpose. It reads like an obvious win, it is
well-documented by the framework, and the next person to look at this page's blocking time will
find the same guide and reach the same conclusion. The measurement is the only thing that
stops it being tried again.

### F-019 🟠 A third of every Stock Detail page was four index series, re-sent per ticker — FIXED

**Found by chasing the wrong thing first, twice, which is the part worth recording.**

Layer 2 had reported the ticker page's loss as Total Blocking Time and blamed React's
hydration. Reading the report's **score contributions** rather than its timings said otherwise:
of 16 points lost on `/stocks/us/AAPL`, **10.2 were Largest Contentful Paint (6.5) and Speed
Index (3.7)** — both dominated by how long the document takes to arrive — against 5.1 for
blocking time, which was only 190 ms. **The earlier diagnosis was inferred from timings; this
one is read off the report.**

Measuring the document then showed 3,019 KB of HTML for AAPL, 97% of it RSC payload.

⚠️ **My first fix was wrong, and the measurement is what said so.** Counting repeated
*dates* in the payload, I concluded the stock's own price bars were being serialised three to
five times, and moved all four charts onto a shared React context so the bars would be written
once. Rebuilt, re-measured: **3,019 KB before, 3,019 KB after. Not one kilobyte.** React had
been deduping the shared array all along. The change was reverted — six files and 370
re-indented lines on a paid surface for zero measured benefit is churn, not a fix.

Locating the duplicates properly — printing what *surrounds* each occurrence instead of
counting them — named the real holder immediately: `\"benchmarks\"`, four index series
(`^GSPC`, `^IXIC`, `^AXJO`, `^GSPTSE`). A date appearing 5x was the stock's bar plus one point
in each of four indices. The arithmetic then matched exactly: AAPL's 11,660 own bars + ~20,000
benchmark points = the 31,641 counted.

| page | benchmarks in the document | points shipped | points the chart can draw |
|---|---|---|---|
| `/stocks/us/AAPL` | **1,011 KB (33%)** | 20,126 | 720 |
| `/stocks/au/BHP` | **1,011 KB (38%)** | 20,126 | 720 |
| `/stocks/us/ABNB` | 285 KB (40%) | 5,730 | 720 |

AAPL's and BHP's figures are identical **because the data is identical** — same indices, same
window, every stock, every reader — and `RelativePerformance` downsamples to 180 points per
line, so 20,126 points were shipped to draw at most 720.

**Fixed** by serving them once from `/api/benchmarks` and letting the browser keep them.
Document 3,019 → **2,004 KB**; transferred-to-load 1,222 → **1,079 KB**; the second ticker page
downloads **nothing**, proven on the wire (914,376 bytes, then 0).

⚠️ **The cache header is the one deliberate exception in the codebase.** Every other gated
route says `private, no-store`; this says `private, max-age=3600`. `private` is what makes it
safe — it forbids shared caches outright, so **11a**'s failure mode cannot occur — and the
payload has no viewer dimension at all. `check:entitlement-gates` keeps `private` mandatory and
every shared-cache directive forbidden, with the carve-out naming `max-age` alone; broken three
ways before being trusted.

⚠️ **The owner caught the freshness bug before it shipped**, by asking what happens the next
day when the stock and the four indices each gain a bar. The server held the series for a flat
**24 hours measured from whenever an instance first warmed** — a duration unrelated to when
closes arrive, so an instance warmed at 09:00 UTC served pre-cron data through the 22:30
refresh and on to 09:00 the next day. **Pre-existing**, and survivable only because Vercel
recycles instances often enough to hide it — safe by someone else's behaviour again. Letting
*browsers* hold the same payload would have made it reliable, because a browser does not
recycle. And the failure is invisible: the index lines simply run flat for the final day while
alpha compares today's stock against yesterday's market, both figures plausible. Now keyed to
`benchmarkDataVersion()`, turning over just after each cron for the same number of reads, with
the browser bounding its lag at an hour.

⚠️ **And the fetch had to WAIT.** Moving the bytes out of the document and fetching them on
mount made the document a third smaller and **LCP worse (1.7s → 2.2s)** — the bytes had not
gone away, they had moved into the load. Speed Index improving at the same time is the tell.
Armed on browser-idle or within 600px of the chart, whichever comes first, LCP returned to
1.6s. This is the owner's own "load it when idle" proposal, landing where it actually earns
its keep.

⚠️ **Honest about the score: it did not move.** 83 before, 83 after. Lighthouse measures one
cold load with an empty cache, which is exactly the case this helps least; the spread tightened
(74/83/85 → 85/82/83) and the bytes are real, but the median is unchanged. The saving is for a
reader opening several stocks, on a phone, or on a slow connection — none of which Lighthouse
simulates. **Kept on its merits, not on a number it did not produce.**

`check:page-weight` ratcheted **1400 → 1250 KB** so the saving cannot be given back silently;
the 588 KB regression it was written for still trips it (**11t**).

Playwright **589 → 596**, the 7 new tests covering the cron boundary; setting the settle window
to 0 fails 2 of them for the right reasons. `pnpm gates` 16 of 16.

🔵 **Still open, and unchanged by this:** the remaining 17 points are **7.8 on blocking
time**, 5.8 on LCP, 2.9 on Speed Index. Blocking time is React starting up, and reducing it
means fewer client components — a real change to a paid surface that goes to the owner as a
plan first (**11l**).

### F-018 🔵 `pnpm gates` passing locally does NOT guarantee CI passes — the Python toolchain drifts

**Found by the owner asking the right question:** *"confirm there is no drift between the local
checks and the ones that run in CI."* I had implied `pnpm gates` closed that gap. It does not,
and the distinction matters: **it closes the LIST gap — which commands run — and says nothing
about the VERSION gap — what those commands are.**

Measured rather than assumed, local against what CI's own log shows it installed on run
32691216636:

| | local | CI (today) | pinned? |
|---|---|---|---|
| Python | **3.14.4** | **3.12** | CI yes, local no |
| ruff | **0.15.14** | **0.16.4** | ❌ `ruff>=0.4.0` — whatever is newest at run time |
| mypy | **2.1.0** | **2.3.1** | ❌ `mypy>=1.10.0` |
| pytest | **9.0.3** | **9.1.1** | ❌ `pytest>=8.2.0` |
| Node | v24.18.0 | 24 | ✅ |
| JS dependencies | lockfile | `--frozen-lockfile` | ✅ identical |

**The JavaScript half has no drift.** The lockfile is committed and CI installs from it frozen,
so every JS gate judges the same code with the same tools. The whole gap is on the Python side.

⚠️ **And this has already bitten, once, exactly this way.** `web/ruff.toml` exists *because* of
it, and its own comment says so: on 2026-08-01 **ruff 0.16.1 added UP045 to its defaults** and
failed the build on `web/_engine/major_cycle.py` — *"Nobody had touched that code. Any future
default-rule change would do the same again."* The fix at the time made the **rulebook** match
across the two directories. It did not make the **version** match across the two machines, and
that sentence is still true today: local is on 0.15, CI is on 0.16.

**So the practical consequence is concrete, not theoretical:** a rule added in ruff 0.16 passes
`pnpm gates` on this machine and fails CI, on code nobody edited. Local being *older* is the
unlucky direction — CI is stricter than the thing that is supposed to predict it.

⚠️ **One claim I nearly made and checked first.** CI installed `yfinance 1.6.0` while the cron
pins `yfinance==1.5.2`, and I was about to report the test suite as validating a different
library than production runs — a serious claim under CLAUDE.md **14e**. It is **wrong**:
`test_yfinance_provider.py` drives the provider with `MagicMock`/`patch`, so the tests exercise
our wrapper against a fake and never the real library's behaviour. The residual risk is only
that `import yfinance` must keep working at whatever version CI grabs. **Recorded because the
check is the point** — the mechanism was real, present, and not responsible (14f).

### The third environment — what the WEBSITE runs, which is neither of the above

The owner asked the sharper question: *"CI and local have 2 versions — what is the website
actually using?"* There are **four** Python environments, not two:

| Environment | Python | Packages | Pinned? |
|---|---|---|---|
| This machine | 3.14.4 | ad hoc | ❌ |
| CI | 3.12 | `ruff>=`, `mypy>=`, `pytest>=`, `pandas>=` … | ❌ resolved per run |
| **The live website** (`/api/cycle`, `/api/analyze`) | **3.12** | `web/requirements.txt` — `pandas>=2.2.0`, `numpy>=1.26.0`, `supabase>=2.4.0` | ❌ **resolved per deploy** |
| The nightly data cron | 3.12 | `analytics/requirements-cron.txt` | ✅ exact `==` pins |

**Read off the real Vercel build log** for deployment `dpl_DHr8Cfm4bYzP7q8r3xjC8dVEshu7`, not
inferred: `Using python version: 3.12` … `Installing required dependencies from
web/requirements.txt`.

⚠️ **The build log mentions a `uv.lock`, and I checked before concluding anything.** Neither
`web/uv.lock` nor `web/pyproject.toml` exists in the repository — Vercel **generates** both from
`requirements.txt` during each build. So the lock is per-build and pins nothing *between*
deploys. Had I stopped at the word "lock" in the log I would have reported the opposite.

**The consequence, stated carefully.** `pandas>=2.2.0` admits pandas **3.x**, a major version,
and the functions it governs are `/api/cycle` and `/api/analyze` — the paid analysis itself.
Every deploy re-resolves them. That is CLAUDE.md **14e**'s argument exactly (*"an unpinned
install is an unreviewed deploy … an upstream release can change what a number MEANS"*), and
14e was written about the cron, which was then pinned. **The website never was.** 11c again: the
rule reached one consumer and not the other — and this time the consumer it missed is the one
customers pay for.

⚠️ **And note what cannot be observed from here:** the build log does not print the resolved
versions, and no endpoint reports them. **There is currently no way to tell what pandas the live
analysis is running.** Not knowing is the finding.

🔵 **Owner's decision, not fixed.** Pinning CI's lint/type/test tools is a change to the build
pipeline, and it carries a real trade-off — a pin means new rules arrive when someone chooses
rather than overnight, but it also means nobody is told about them until that choice is made.
The cron already made this decision, in `analytics/requirements-cron.txt`, with the reasoning
written out. CI was simply never given the same treatment: **11c, one rule applied to one
consumer and not the other.**

### F-017 ✅ A CI secret's value was the word "Bearer" — CONFIRMED and ROTATED

**Found by the local-vs-CI title diff, and not by looking for it.** The two runs each report
**589 passed**; comparing the *titles* left exactly one row on each side, and it is the same
test:

| | title as printed |
|---|---|
| local | `purge cron › who counts as Vercel Cron › the exact **Bearer** form is the only thing that passes` |
| CI | `purge cron › who counts as Vercel Cron › the exact **\*\*\*** form is the only thing that passes` |

GitHub redacts a string from a log **only when that string is the value of a secret available
to the job.** The word `Bearer` appears **zero** times unmasked anywhere in the CI log, and the
same redaction marker appears beside `E2E_PASSWORD`, `STRIPE_SECRET_KEY` and the rest. So one
of the five secrets that job uses has the exact value `Bearer`.

By elimination it is almost certainly **`E2E_PASSWORD`** — the other four have known shapes
(an email address, a `whsec_…`, an `rk_test_…`, and a JWT), and none of them can be one English
word. ⚠️ **I have not read any secret's value and will not**; this is inference from what the
masking did, not from the value.

**Why it matters, and it is two things.** A password that is one common English word is not a
password, and this account is a real Supabase user on the real project — CI signs in as it on
every push. And separately, the masking now fires on an ordinary word, so **every legitimate
use of "Bearer" in any future CI log is redacted** — which is how a log stops being readable
and, worse, how a genuinely masked value stops standing out.

**Rotated 2026-08-24.** The owner generated a 40-character random value in their own
terminal — deliberately never through this conversation — and set it in the GitHub secret and
in `web/.env.local` themselves.

⚠️ **Supabase turned out to have no way to set a password from the dashboard**, only *"send a
password recovery email"* to `e2e@majorcycle.com`, a mailbox that may not receive. So the third
copy was closed by syncing Supabase **to the file the owner had already updated**, via the admin
API in a single process: read from `.env.local`, sent to Supabase, never printed, never logged.

**Verified three ways, and the third is the one that proves anything:**

| | evidence |
|---|---|
| Supabase | sign-in with the new password succeeded — **and the old password `Bearer` was REFUSED**, the control without which a successful sign-in only proves the credentials are valid, not that they changed |
| `web/.env.local` | `account.spec.ts` **5 passed, 0 skipped** locally — these self-skip when the credentials are absent, so a skip would have looked like a pass |
| GitHub secret | the E2E job **re-run after the rotation**: **589 passed, 0 skipped**, with the 5 sign-in tests present in the log |

⚠️ The earlier green CI run proved nothing about the new secret — it had started *before* the
rotation. Re-running the job was the only thing that could answer the question.

ℹ️ Note this was invisible to both runs individually — each said 589 passed. **Only the diff
of titles could show it**, which is the argument for doing the reconciliation by title rather
than by count, made by a defect nobody was hunting.

### F-016 🔴 My "everything automated" sweep was missing a whole tool — CI caught it

**The push went red, and it was right to.** `ruff` found **6 errors**, all of them in
`analytics/tests/test_drain_requests.py` — a file *I* wrote in Layer 1 — and all six had been
sitting in the branch since then: five `UP037` (quotes around a type annotation in a module
that already defers annotations, so they are redundant) and one `F841` (`fake = patched(…)`
assigned and never read).

⚠️ **The defect is not the six lint errors. It is that Layer 2 declared a complete sweep of
"everything automated" and never ran ruff.** I ran typecheck, lint, build, pytest, mypy, eight
guards, page weight, CSP, render modes and Lighthouse — and reported them as the full set. CI
runs **eleven** things; I ran ten. A missing check is invisible in exactly the way this whole
audit exists to catch: nothing was red, because nothing had looked.

**Why I missed it, and it is structural rather than careless.** Every JavaScript gate has a
`pnpm` script, so the set is enumerable from `package.json`. The Python gates exist **only as
steps inside `.github/workflows/ci.yml`** — there is no local command that runs them, and
therefore no local command that can be *complete*. I assembled my list from the thing that
lists things, and the Python lint was not in it.

**Fixed** and re-run exactly as CI invokes it (`ruff check analytics/`, then
`cd web && ruff check _engine/ api/`) — both clean, with pytest 170 and mypy 43 re-confirmed
after the edits, since an auto-fix that changes source is not proven by the linter that made it.

✅ **CLOSED the same day, at the owner's instruction — `pnpm gates`.** One command runs all
**sixteen** checks, cheapest first, stopping at the first failure.

**The part that matters is not the convenience, it is that the list polices itself.** A
hand-maintained list of gates rots exactly the way the old situation did, one CI step at a time.
So before running anything, `scripts/gates.mjs` reads `ci.yml` and asserts that **every command
CI runs is accounted for** — as a gate, or as an explicit non-gate with a reason. Add a step to
CI and forget this file and it refuses to run, naming the step.

**Proven both ways before being trusted**, per Layer 0's own rule:

| Sabotage | Result |
|---|---|
| a fake `pnpm check:something-new` step added to `ci.yml` | **exit 1** — *"this list is OUT OF DATE"*, named the command, ran nothing |
| an orphan file in `web/_engine/` | **exit 1** at `check:engine-drift`, then enumerated all 7 gates that consequently did **not** run |
| clean control, both reverted | **exit 0** — 15 of 15 (16 with e2e) |

⚠️ **A twelfth gate turned up while building it**, and it is the same disease: the `_engine`
drift check was ~30 lines of **inline shell inside `ci.yml`**, so it too ran there and nowhere
else. It is now `scripts/check-engine-drift.mjs`, called by **both** CI and `pnpm gates` — one
implementation rather than a second copy of the rule in another language (11c). ⚠️ Moving it
also meant moving the *step*: it had been sitting in the Python job, which has no `pnpm`, so
calling the script from where it stood would have failed on the runner. Caught by asking which
job the step belonged to rather than assuming.

The three server-dependent checks (`check:page-weight`, `check:csp`, `lighthouse`) are printed
as **NOT RUN with the reason** rather than omitted — silent omission being the entire defect.

CLAUDE.md **#17** now names `pnpm gates` instead of listing four commands out of sixteen.

⚠️ Note what this says about the value of pushing. The branch had **25 unpushed commits** and
these six errors had survived every local gate for a day. **The first thing CI did was fail.**

### F-015 🟠 The a11y scan waited on quiet, on a page that never goes quiet — FIXED

The full suite came back **589 listed = 588 passed + 1 flaky, 0 failed, 0 skipped**, exit code
**0** measured without a pipe. The flake: `app-a11y.spec.ts` › *`/stocks/us/AAPL` has no axe
violations* — `page.goto` timing out at 45 s waiting for `networkidle`.

⚠️ **The file already argued against exactly this**, twenty lines below the offending call:

> *Waiting on a POSITIVE signal (enough elements exist) rather than on quiet: `networkidle` is
> satisfied by a page that has stopped fetching and not yet rendered, which is the same trap
> the public suite hit at 47 elements of 291.*

That reasoning produced two good waits — the stylesheet sentinel and a 420-element floor — and
**the `goto` above them was never changed to match**. So the function's first act was the one
wait its own comment rejects, and the only one that could expire before either positive signal
ran. CLAUDE.md **11c-iv** in miniature: the rule existed, was written down, and one consumer
never received it.

Fixed by navigating with `domcontentloaded` and letting the two positive signals do the
waiting. **Scope kept deliberately narrow:** sixteen other specs also pass `networkidle`, and
none of them flaked — they drive prerendered public pages where quiet arrives immediately.
Sweeping all seventeen would have been a change to fifteen tests that are working, to fix one
that is not.

⚠️ **And my own monitoring instrument misreported the re-run as finished**, because
`grep -E "^  [0-9]+ passed|failed"` binds the alternation across the whole pattern — so the
bare word `failed` matched a Resend log line (`send failed 422`) mid-run. It reported a
finished suite at test 29 of 589. Harmless here because the real completion signal was
independent, and worth writing down anyway: **this is the same class as measuring an exit code
through a pipe** (Layer 0). The instrument was wrong, the thing it measured was fine, and the
reading looked entirely normal.

⚠️ **A pass from re-running this spec alone would prove nothing** — the flake needs the heavy
page *plus* full-suite parallel load. The verification is therefore the whole suite again.

---

## Two live defects reported by the OWNER, 2026-08-28

Neither came from this audit. Both were found by a person using the product and noticing
something odd, which is worth recording on its own: the suite was green, every gate passed, and
both bugs were sitting in merged, production code.

### F-031 (RED) A failed profile read was shown to the customer as "you have never agreed" - and the only way past it DESTROYED the record - FIXED 2026-08-28

**What the owner saw.** Signed in on a laptop, went to `majorcycle.com`, was redirected to
`/stocks` and met the first-login disclaimer gate - on an account created 2026-06-15 that had
acknowledged months earlier. They pressed *Agree*. Hours later, on a second laptop, the gate
appeared again; they closed the tab instead, reopened the site, and went straight through.

**The defect.** `getViewerEntitlement` read the caller's `profiles` row and discarded the error:

```ts
const { data: profile } = await supabase.from('profiles')...   // no `error`
if (!profile) return { ...SIGNED_OUT, userId };                // "no row" === "unreadable"
```

Every field then came back null, `acknowledgedDisclaimerAt` among them, and `app/(app)/layout.tsx`
gated the modal on that field alone. So one unreadable read presented as *this person has never
agreed to anything*.

WARNING: **A FALSE PROMPT IS NOT A COSMETIC FAULT WHEN THE PROMPT WRITES.** The modal has one
button and it stamps `acknowledged_disclaimer_at = now()`. Confirmed on the live database: the
account created `2026-06-15 12:54:52` carried an acknowledgement of `2026-08-27 04:09:48`, while
its sibling created a day later still showed its own, three minutes after signup. **A compliance
record under locked decisions #23/#24 was overwritten by the bug's own remedy.**

**Why a null row here always means "unreadable".** `on_auth_user_created` (migration
`20260614030000`) creates the row for every account; verified live, 7 auth users and 7 profiles.
So for a caller holding a verified `userId`, the row exists by construction and an empty read did
not see it. Reproduced against the live project: the expired-JWT fallback to `anon` answers
**HTTP 406 / PGRST116, "0 rows"** - an *error*, discarded. Corroborating: the owner's
`last_sign_in_at` was **2026-08-12**, fifteen days before the incident, so the access token was
certainly stale.

WARNING: **The `anon` SELECT grant that produces this is deliberate and stays** (F-024, the RLS
section above). Its justification was that a 0-row read is *"the safe direction"* - true for
entitlement, and exactly backwards for the disclaimer flag, where empty means "prompt them, then
write". **One reading of the same value was safe and the other was destructive, and only
entitlement had been considered.**

**Fixed in three places, because the gate and the write fail differently:**

| Layer | Change |
|---|---|
| Meaning | `viewerFromProfileRead()` sets `profileUnreadable`; unreadable is no longer the same value as never-agreed |
| Gate | `shouldShowOnboarding()` needs the timestamp absent **and** the row readable |
| Write | `acknowledgeDisclaimer()` is write-once - it reads first, returns early if a date exists, and repeats the check as an `.is(..., null)` filter on the UPDATE so two tabs cannot race |

Entitlement still **fails closed** on an unreadable read, unchanged and deliberate; the guard
asserts that as a control, because a fix that quietly opened the paywall would pass every other
assertion. The mapping moved to `lib/entitlement.ts` (pure) so it can be driven by a
credential-free spec - `lib/entitlement.server.ts` carries `import 'server-only'`, which takes the
whole suite down rather than failing one file. Guarded by `web/e2e/onboarding-gate.spec.ts`
(7 tests), broken on purpose in both directions first: restoring the bare null check went red, and
so did an over-correction that never prompts anyone.

**Data.** The destroyed date is not recoverable. Reconstructed to `2026-06-15T12:54:52.172869Z` -
the account's own creation instant - because that is the last timestamp still provable and it
invents no precision. Recorded in `architecture.md` 6.6 as a reconstruction, so it is never
mistaken for a measurement.

### F-032 (RED) A nightly refresh DELETED 15 market caps because the provider omitted one field - FIXED 2026-08-28

Found while building the article's verification workbook: a published figure would not reproduce.
The S&P 500 "largest 60" median came out **-18.7%** against the **-19.0%** printed two days
earlier, on identical code and an identical method.

**The cause was not the study.** The refresh of 2026-08-27 wrote `market_cap = NULL` for 15 of 863
companies - Salesforce, Lowe's, Micron, AutoZone, Kroger among them, all large and actively
traded - because yfinance's `info` blob simply did not contain `marketCap` that night. Nothing
raised. The value arrived as `None`, and:

```python
"market_cap": fund.market_cap if fund else None,   # overwrites a good figure with nothing
```

WARNING: **THE IDENTICAL RULE WAS ALREADY IN THAT FUNCTION, TEN LINES BELOW, GUARDING `news`:**
*"Only overwrite when we actually got items, so a transient yfinance hiccup never wipes the
previously-stored news for a ticker."* It was never given to `market_cap`. **11c-iv, in the same
function as its own precedent.**

**Why it was invisible.** A null cap is a blank cell, not an error. It drops a company out of any
size-ranked cohort silently, and `fcf_yield_pct` - computed from the cap, and an input to
Financial Health - went null with it on all 15. It took a study that ranks *by* market cap, run
three days later by someone checking arithmetic, to surface it.

**REVERSED IN PART BY THE OWNER, 2026-08-29 - and the reversal is the lesson.**
The first fix had the writer OMIT the column when the provider had nothing, so the
stored figure survived a bad night. The owner's objection: that also survives a bad
MONTH. If yfinance stops returning a cap for a company we would go on showing a
months-old market cap as though it were current, and nothing about it would look
wrong to anyone. "I don't want to manipulate anything. Just show what the provider
give to us."

That is right, and it generalises past this field: **a null renders as an empty cell,
which a reader can see and a check can alarm on; a stale number renders as a
plausible one, which nobody can see.** Of the two ways to be wrong, prefer the
visible one. `_with_market_cap` now writes the provider's answer through, null
included.

**Fixed on both sides, because either alone leaves a hole:**

- **Provider** - `_extract_fundamentals` falls back to `fast_info` when `info` has no cap. That
  endpoint carried one for all 15, so we are less often empty-handed.
- **Writer** - `_with_market_cap()` writes what the provider answered, null included (see the
  reversal above). An upsert builds its `SET` list from the columns present, so `market_cap:
  None` and a missing key are opposite instructions to Postgres while being one value in Python
  - which is why the test asserts the key is PRESENT and null, not merely that it "is None".

**And a nightly invariant, because the fix should not have to be the only thing watching.**
`check_invariants()` now fails when more than **0.5%** of rows lack a cap. WARNING: **that floor
was measured, not chosen.** The real event was 15 of 871 - **1.7%** - so the 2% threshold written
first would have passed the very incident the check is named after. *A guard tuned above the
defect it exists for is worse than no guard: it reports "clean" with authority.*

Guarded by `analytics/tests/test_market_cap_from_provider.py` (9 tests), broken on purpose and
confirmed red for the right reason: restoring the preserve behaviour fails the two write-through
assertions and nothing else. The load-bearing assertion is that the key is **present AND null** -
`is None` alone would pass on a payload that silently kept yesterday's number.

WARNING: **THE INCIDENT RECURRED WHILE THE FIX SAT UNMERGED.** The 2026-08-28 run blanked 13
companies - AutoZone, Kroger, Lowe's and Micron among them again - because a scheduled workflow
checks out the **default branch** and `feat/layer-g` is not it (14g). Checked by hand the same
day, BOTH endpoints carried a cap for all 13, which is the evidence that the omission is
transient and per-RUN rather than per-company: the fallback would have caught every one. All 13
repaired; they revert nightly until merge.

**Data repaired:** all 15 refetched through the real provider (so `normalise_fundamentals` runs
and a cross-currency FCF yield is still withheld) and written with `UPDATE`, not upsert - a repair
names the columns it changes. 0 of 871 now missing; the nightly invariants run clean against the
live universe. WARNING: **the repair holds only until the next US+CA refresh (22:30 UTC) unless
this branch is merged** - a scheduled workflow checks out the default branch, so it will run the
old code (14g).

---

*Log continues as the audit proceeds.*
