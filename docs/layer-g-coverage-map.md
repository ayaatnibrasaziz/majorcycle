# Layer G audit · Layer 1 — the coverage map

**Built 2026-08-23 on `feat/layer-g`.** What the test suite actually covers, and — the
point of the exercise — **what it does not**.

**No test was written from this document.** Layer 1's job is to produce the uncovered list
and stop, so the owner decides what is worth guarding before any code is added. That
sequencing is deliberate: a list written *and* acted on in one pass is a list nobody
reviewed.

---

## The instrument

The suite is **523 Playwright tests in 26 files**, and `pytest` is **153**. *(⚠️ Those are the figures on the day this map was built, 2026-08-23, and this document is a dated record — do not read them as current. As at 2026-08-25 the suite is **617 Playwright in 34 files** and **188 pytest**; the merge-gate table in `layer-g-audit.md` is the row that stays current.)*

⚠️ **A grep for `test(` returns 406, not 523** — a third of the suite is generated inside
loops, so counting the source undercounts it by 117. Every number below comes from
`npx playwright test --list`, which enumerates what the runner will actually execute.
The local list agrees exactly with CI run `32585813431`, which is the only reason to
believe either.

---

## Dimension 1 — routes

Forty-three routes, transcribed from the production build's own output rather than from
the `app/` directory, so a route that fails to build cannot silently drop off the list.

### Covered, and by how many spec files

| Route | Files | | Route | Files |
|---|---|---|---|---|
| `/` | 26 | | `/learn` | 6 |
| `/login` | 18 | | `/privacy` | 6 |
| `/stocks` | 16 | | `/disclaimer` | 6 |
| `/account` | 15 | | `/signup` | 6 |
| `/results` | 10 | | `/request` | 5 |
| `/pricing` | 9 | | `/reset-password` | 5 |
| `/run` | 8 | | `/account/update-password` | 4 |
| `/stocks/[market]/[ticker]` | 8 | | `/learn/[slug]` | 4 |
| `…/report` | 8 | | `/deletion-requested` | 3 |
| `/contact` | 8 | | `/reactivate` | 2 |
| `/terms` | 8 | | | |

API: `/auth/signout` 5 · `/auth/recovery-done` 3 · `/api/portal` 2 · `/api/stripe/webhook` 2 ·
`/auth/confirm` 2 · `/api/checkout` 1 · `/api/billing-context` 1 · `/api/analyze-dev` 1 ·
`/auth/callback` 1. Python: `/api/cycle` 4 · `/api/analyze` 2.

### 🔴 Zero coverage

⚠️ **Verified individually, not inferred from the absence of a string.** A first pass
listed eight routes; two of those turned out to be words in comments (`purge` in a test
*title*, `listings` in a sentence), and two more are out of scope by design. What survives:

| | Route | What it does | Why it matters |
|---|---|---|---|
| 🔴 | `/api/cron/purge-accounts` | **Permanently deletes accounts** after the 30-day window | The highest-stakes route we own. Verified by hand in live-check S3, never since, and nothing would go red if it broke |
| 🟠 | `/api/request-ticker` | Queues a ticker for the universe (decisions #12/#16) | Per-user write. Has a 5-branch refusal ladder — 400 / 404 / 409 / 500 / success — none exercised |
| 🟡 | `/api/search` | Ticker autocomplete inside Run Analysis | Gated route; feeds the screener |
| 🟡 | `/api/listings/search` | The Request-a-Ticker menu | |
| 🟡 | `/api/listings/status` | Same menu's status column | |
| 🟡 | `/_not-found` | The 404 page itself | See dimension 3 — the soft-404 |

**Out of scope, not gaps:** `/dev-fixtures` is gitignored and local-only, so on CI the
route does not exist and a test would pass because its subject is *absent* — the 14g
failure, worse than no test. `/icon.png` is a static file emitted by the build.

---

## Dimension 2 — viewer states

`lib/entitlement.ts` recognises eight subscription statuses. How often each appears across
`entitlement.spec.ts`, `entitlement-routes.spec.ts` and `stripe-webhook.spec.ts`:

| State | Mentions | |
|---|---|---|
| `active` | 36 | ✅ |
| `past_due` | 19 | ✅ |
| `canceled` | 15 | ✅ |
| `trialing` | 14 | ✅ |
| `paused` | 2 | 🟡 |
| `incomplete` | 1 | 🟡 |
| `unpaid` | 1 | 🟡 |
| `incomplete_expired` | **0** | 🟠 |

⚠️ **Entitlement itself is correct for all eight by construction** — `LIVE_STATES` is
`{active, trialing}` and everything else falls through to "no". The gap is not access, it
is **what the reader is told**: `AccessDenialReason` has four values, and all four thin
states collapse to `no_subscription`, which says *"you don't have a subscription"* to
someone whose card merely failed to complete. That is finding **F-005**, already open for
the owner's decision.

---

## Dimension 3 — the soft-404, guarded on one route of many

**The entire suite contains one assertion on a 404 status code**, in `learn.spec.ts:493`,
for an unknown article slug. Every status assertion in 523 tests:

`200`×10 · `403`×4 · `401`×3 · `402`×2 · `307`×2 · `500` · `405` · `404` · `400` · `303`

CLAUDE.md **11r** records that until 2026-08-18 *every* `notFound()` on this site answered
**200** — a sitewide soft-404 caused by `app/loading.tsx` flushing the Suspense shell
before the status was set. It was fixed by deleting that file.

**So the bug is guarded on exactly one of the routes it affected.** An unknown ticker —
`/stocks/us/ZZZZ` — is not tested anywhere in the suite, by any string. The route that
would regress most quietly is the one with no assertion on it.

---

## Dimension 4 — 🟠 four API responses send no `Cache-Control` (new)

Measured **on the wire**, signed in, against the production build on `:3200`:

```
GET   /api/search?q=AAP           200   cache-control: (NONE)
GET   /api/listings/search?q=AAP  200   cache-control: (NONE)
POST  /api/listings/status        200   cache-control: (NONE)
POST  /api/request-ticker         400   cache-control: (NONE)
```

This is the CLAUDE.md **11a** family — **the fifth instance**. The mechanism is the one
already written down there: *Next attaches no `Cache-Control` to route handlers*, so a
habit formed on pages does not carry over, and "I didn't see a bad header" is not the same
as "the header is right."

⚠️ **Nothing is exposed today**, and I nearly reported this wrong in both directions.
Reading the source alone said *five* routes send nothing; on the wire, the signed-**out**
refusals all carry `private, no-store` correctly, because the proxy sets it on its own 307
before any handler runs. What genuinely sends nothing is the signed-**in** 200. Vercel
shared-caches only on `s-maxage`, so there is no live leak — which is exactly 11a's
complaint: **safe because of someone else's default, not because we said so.**
`/api/cron/purge-accounts` likewise answers its 401 bare.

Stakes are lower than the four previous instances — the payloads are ticker names, the
same for every signed-in reader — but `/api/search` and `/api/listings/*` **are gated**,
so a shared cache storing one would serve gated content at a URL a signed-out reader can
type. And none of the four is covered by `check:entitlement-gates`, which guards the
billing endpoints only.

---

## Dimension 5 — Python modules no test references

`pytest` is 153 tests across 12 files. Eleven modules are referenced by none of them.

⚠️ **A first pass listed seventeen, and six of those were wrong** — `financial_health`,
`overall`, `valuation`, `normalize`, `sources` and `base` have no file named after them and
are all covered by `test_scoring.py` and `test_field_spec.py`. **A module is not untested
because nothing is named after it**; the list below comes from grepping what the tests
actually import.

| Module | What it is | |
|---|---|---|
| `presets` | The three Run Analysis presets + Custom (decision #15) | 🟠 product logic |
| `drain_requests` | The cron that fulfils reader ticker requests (#16) | 🟠 |
| `build_mag7_snapshot` | The landing page's seven real stocks | 🟡 and see 11k — its numbers expire |
| `build_landing_snapshot` | The landing's Apple figures | 🟡 same |
| `refresh_listings` | Nightly exchange symbol directories | 🟡 |
| `refresh_index_membership` | Nightly SPY/IOZ/XIU holdings | 🟡 |
| `fmp_provider` | Phase 2 stub, deliberately unimplemented | ℹ️ not a gap |
| `config` | Constants | ℹ️ |
| `fix_split_history` | Repairs split-corrupted price history | ℹ️ **KEEP — not dead.** See correction below |
| `fix_pe_history` | Recomputes thin `pe_history` | ℹ️ **KEEP** — see correction below |
| `fix_insider_transactions` | Repairs insider dates stored as row indices | ✅ **DELETED 2026-08-23** — owner-approved |

### ⚠️ Correction — I recommended deleting three scripts and was wrong about two

The table above originally read *"one-off historical repair scripts … arguably should be
archived rather than tested"*, and the owner approved acting on it. Checking before
deleting — the owner's standing rule, and CLAUDE.md **11h**'s "grep the audit docs before
deriving a diagnosis" — showed the premise was false for two of the three:

- **`fix_split_history.py` is a live operational tool.** `architecture.md` §73 names it as
  *the* remedy for an already-corrupted ticker, with its flags, and records a standing
  case (**DD**, where yfinance lists a split but never back-adjusts the prices). Deleting
  it would have removed the documented answer to a problem the docs say still happens.
- **`fix_pe_history.py` repairs thin `pe_history`**, which is a condition that recurs for
  newly added tickers rather than a one-time historical mess.
- **`fix_insider_transactions.py`** is the only genuinely spent one: it repairs dates
  stored as row indices by a bug that was fixed at source and cannot recur.

**Nothing was deleted at the time.** One clearly-dead script is not the three the owner
agreed to, so the decision went back rather than being quietly narrowed — and the owner then
authorised the one. `fix_insider_transactions.py` is gone; the other two remain. ⚠️ The general lesson is the
one this audit keeps re-learning in new costumes: **"no test references it" and "nothing
needs it" are different claims**, and I had let the first stand in for the second. A
maintenance tool is *supposed* to have no automated caller — that is what makes it a
maintenance tool, not what makes it dead.

---

## What this layer did NOT examine

Stated so silence is not mistaken for a clean bill:

- **Depth.** This maps *whether* a route is touched, never *how well*. `/reactivate` appears
  in two files; that is not evidence its logic is covered.
- **Assertion quality.** A test that visits a page and checks it returns 200 counts the
  same here as one that drives a form.
- **The offline report artifact.** `report-download.spec.ts` is one test. Per 11d it is the
  right *kind* of test — it opens the built file over `file://` — but one is one.
- **Data edge cases** (nulls, cross-currency, missing fields). Layer 4.

---

## ✅ What was done about it (2026-08-23)

The owner approved acting on all eight. **Playwright 523 → 589, pytest 153 → 170**, and
acting on the list turned up **two defects nobody knew about**.

| | Gap | Outcome |
|---|---|---|
| 1 | `/api/cron/purge-accounts` | 16 tests. Row selection driven by a stub client; the Bearer comparison extracted and tested **with an invented secret**. ⚠️ No test may hold the real one: the day someone loosens the check to a substring match, such a test stops being a refusal and becomes a live purge of the production database |
| 2 | Unknown ticker → 404 | **Was a live bug** — F-011, fixed, skeleton kept |
| 3 | `/api/request-ticker` | All five refusal branches. **Found F-012** — a failed read read as “not covered”, which would have queued a duplicate request |
| 4 | Missing `Cache-Control` | Fixed on 5 routes; guard widened from 2 files to 7 |
| 5 | `presets`, `drain_requests` | 17 Python tests |
| 6 | search + listings | 18 tests |
| 7 | Four thin subscription states | F-005 fixed — each now says what actually happened |
| 8 | Three `fix_*` scripts | Narrowed to one, deleted |

**Not driven, and stated rather than left to silence:** a *valid* call to the purge cron (it
would really delete accounts — there is no test database), and a *successful*
`POST /api/request-ticker` (it writes a real row and the nightly cron would then permanently
expand the universe from a test run).

⚠️ **Two of this document's own first-pass numbers were wrong**, and both are corrected
above: seventeen “untested” Python modules were really eleven, and eight “untested” routes
were really six. In each case the check that fixed it was cheap and the confident version
would have sent someone chasing work that did not exist.

---

## The list that goes to the owner

Ranked by what would hurt most if it broke silently:

1. 🔴 **`/api/cron/purge-accounts`** — deletes accounts, no automated test at all
2. 🟠 **Unknown ticker → 404** — the sitewide soft-404 is guarded on one route of several
3. 🟠 **`/api/request-ticker`** — five refusal branches, none exercised
4. 🟠 **Four API routes send no `Cache-Control`** — 11a, fifth instance
5. 🟠 **`presets` and `drain_requests`** — product logic with no Python test
6. 🟡 **`/api/search`, `/api/listings/*`** — gated routes, no test
7. 🟡 **Four thin subscription states** — already F-005, awaiting the owner
8. ✅ ~~Three `fix_*` scripts — propose archiving~~ → **narrowed to one, then done.** Two are
   live tools and stay; `fix_insider_transactions.py` deleted 2026-08-23
