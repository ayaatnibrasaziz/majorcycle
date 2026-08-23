# Coding Standards

> **Purpose:** Defines the conventions every line of code in this repo follows — naming, file structure, error handling, anti-patterns. Read this before writing new files or refactoring. Violations cause build failures.
>
> See also: `CLAUDE.md`, `architecture.md`.

---

## 1. The Core Posture

Code in this repo is read more often than it's written. Optimize for:

1. **Clarity** over cleverness — boring code is good
2. **Failure transparency** — every failure must be loud and traceable
3. **Local reasoning** — a function should be understandable without reading 5 other files
4. **Reproducibility** — every behaviour should be deterministic given the same inputs

The owner is non-coder. Future-Claude reading this six months from now is the audience.

---

## 2. File & Directory Naming

### Frontend (`/web`)

| Type | Convention | Example |
|---|---|---|
| App Router route | lowercase, kebab-case folder | `app/stocks/[market]/[ticker]/page.tsx` |
| React component | PascalCase, one component per file | `components/StockDetailHeader.tsx` |
| Hook | camelCase prefixed `use` | `lib/hooks/useStockData.ts` |
| Utility | camelCase, descriptive | `lib/ticker.ts`, `lib/case.ts` |
| Constants | `UPPER_SNAKE_CASE` exports from a regular `.ts` file | `lib/presets.ts` |
| Type | PascalCase, lives in `lib/types.ts` or co-located | `interface StockRecord` |
| Test | **`*.spec.ts` in `web/e2e/`**, never next to source | `e2e/entitlement.spec.ts` |

### Backend (`/analytics`, `/web/_engine`, `/web/api`)

| Type | Convention | Example |
|---|---|---|
| Module | lowercase, snake_case | `analytics/major_cycle.py`, `web/api/cycle.py` |
| Serverless function | one file per endpoint, filename matches URL | `web/api/cycle.py` → `/api/cycle` |
| Class | PascalCase | `class YFinanceProvider` |
| Function / variable | snake_case | `def fetch_price_history()` |
| Constant | `UPPER_SNAKE_CASE` | `PIVOT_BARS = 5` |
| Test | `test_*.py` in `analytics/tests/` | `tests/test_major_cycle.py` |

### Universal

- No spaces or special chars in filenames
- No `index.tsx` files except where Next.js requires it
- ⚠️ **The test row said `*.test.ts` next to source until 2026-08-22** — a leftover from the
  Vitest era that contradicted both § 8 (Playwright is the only TS runner, owner decision)
  and the actual layout. There has never been a `*.test.ts` file in this project, and a
  convention table is exactly where a future session goes to learn what to create.
- No `utils.ts` catch-all dumping grounds — name files by their actual purpose

---

## 3. TypeScript Conventions

### Strictness

```json
// tsconfig.json — these settings are non-negotiable
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Imports

- Absolute imports from `@/` root (configured in `tsconfig.json`)
- Group imports: (1) external packages, (2) `@/lib/*`, (3) `@/components/*`, (4) relative
- No wildcard imports (`import * as X`) except for namespaces (`import * as XLSX from 'xlsx'`)

### Component Patterns

```typescript
// ✅ GOOD — Server Component by default
export default async function StockPage({
  params,
}: {
  params: { market: Market; ticker: string };
}) {
  const data = await getStockData(params.market, params.ticker);
  return <StockDetailView data={data} />;
}
```

```typescript
// ✅ GOOD — Client Component when interactivity needed
'use client';
import { useState } from 'react';

export function HorizonSelector({ onSelect }: { onSelect: (preset: Preset) => void }) {
  const [active, setActive] = useState<Preset>('medium');
  return (/* ... */);
}
```

```typescript
// ❌ BAD — fetching in useEffect for SEO-relevant data
'use client';
export function StockPage({ ticker }: { ticker: string }) {
  const [data, setData] = useState(null);
  useEffect(() => { fetch(`/api/some-ticker-endpoint/${ticker}`).then(...) }, [ticker]);
  // Googlebot sees null. Use Server Component instead.
  // (The endpoint is hypothetical — no such route exists, deliberately. Stock Detail
  //  reads Supabase during the server render. See data-contracts.md §5.)
}
```

### App-Page Chrome & Cards (shared — don't re-create per page)

Authenticated pages under `web/app/(app)/` inherit chrome. Match it exactly:

- **Page title comes from the Header.** `components/Header.tsx` renders the visible title + subtitle keyed by pathname (`PAGE_TITLES`). A page's own `<h1>` must be **`sr-only`** (document outline / screen readers only) — never a second visible title. Pattern: Results, Request a Ticker. *(F2's account page first shipped a duplicate visible "Account" heading + subtitle on top of the Header's — fixed 2026-07-11 by making the h1 `sr-only`.)*
- **Disclaimer strip is layout-level.** `(app)/layout.tsx` renders the "educational only — not financial advice" strip above every page. Don't add your own.
- **Use the shared card classes.** Section/settings cards use `.card` / `.card-header` / `.card-title` (uppercase 12px) / `.card-body` from `globals.css` (visual parity with `reference/original-design.html`) — **not** ad-hoc `rounded-[var(--radius)] border … p-5` boxes. This keeps every card identical to the rest of the terminal (the F2 account cards were migrated onto `.card` on 2026-07-11 for exactly this reason).

### Type Safety

- Never use `any`. If you genuinely need an escape hatch, use `unknown` and narrow.
- Never use non-null assertion (`!`) — handle the null case explicitly
- Discriminated unions over flag booleans:
  ```ts
  // ✅ GOOD
  type Result = { status: 'success'; data: T } | { status: 'error'; error: string };
  // ❌ BAD
  type Result = { ok: boolean; data?: T; error?: string };
  ```

### React Patterns

- Function components only. No class components.
- Hooks at the top, no conditional hook calls.
- Destructure props in the signature.
- Default exports for routes/pages; named exports for everything else.
- No `React.FC` typing — use direct prop types.
- **Never gate a portal / JSX branch on `typeof document` or `typeof window` for content that renders at hydration time.** The branch is `false` on the server and `true` on the client → the first client render differs from the SSR HTML → **hydration mismatch**. Instead: render imperative DOM with `document.createElement` + `appendChild` inside an effect (for imperatively-updated nodes like a chart tooltip), or gate the portal on a state that is `false` on the first render (e.g. `InfoTip`'s `open`, a chart's `dayPanel` — both null/false until interaction, so they render nothing at hydration). A `mounted` flag set in `useEffect` works too but trips the `react-hooks/set-state-in-effect` lint rule.
- The `react-hooks/refs` lint rule forbids mutating a ref during render (`ref.current = x` in the component body). Sync derived-from-prop refs inside a `useEffect` instead.
- **A modal that is open on first render can't be fixed by delaying it — don't render the page behind it.** Radix writes `aria-hidden` straight onto sibling DOM nodes when a modal opens. App Router hydrates progressively, so that write lands on subtrees React hasn't hydrated yet and React discards and re-renders them. Deferring the open makes it *more* likely, not less: `dynamic(ssr:false)`, `useSyncExternalStore`, `requestAnimationFrame` and a Radix upgrade were all tried on the onboarding modal and none worked ([radix-ui/primitives#1386](https://github.com/radix-ui/primitives/issues/1386), still open). The fix is structural — when a blocking modal is showing, return it *instead of* `children`. See architecture §7.3.
- **`setState` inside an effect body is a lint ERROR here (`react-hooks/set-state-in-effect`), and it's usually telling you the feature is wrong.** Reaching for `useEffect(() => { if (x) setOpen(true) }, [x])` to auto-open a dialog on arrival is the classic case: the rule blocks the cascading render, and the Radix trap above blocks the alternative (opening on first render). Take the hint — make it a control the reader clicks rather than something that happens *to* them. The `/account?start=` auto-open was dropped for exactly this, and the simpler version is what shipped.
- **A page that is reachable signed-out must not carry signed-in state.** `/pricing` had accumulated six branches — a denial banner keyed off `?reason=`, a dispute-hold heading, an in-place support dialog, "you already have a plan", "you already used your trial", a resumed-signup greeting — all serving readers the paywall had bounced there. Once premium pages locked in place instead of redirecting, none of those readers could arrive, and every branch became an unreachable claim about somebody's money. Rule: give a public page exactly one audience. If a signed-in user needs different words, redirect them somewhere that already knows who they are (`/pricing` → `/account`), rather than teaching the public page to reason about billing. Unreachable branches don't announce themselves — they just quietly become wrong.
- **Never write text either side of an interpolation across a line break.** JSX trims the leading whitespace off a text segment that follows `{expr}`, so ``opened {limit}\n  different stocks`` renders **"25different stocks"** (a real F3 Step 10 bug, invisible to every test — it only shows in a browser). Put the whole sentence in one template literal: `` {`opened ${limit} different stocks`} ``.
- 🔴 **Not rendering a value does NOT keep it private — anything a server component passes to a client component is serialised into the page source.** React writes the props of client components into the RSC flight payload embedded in the HTML, so a conditional like `{entitled && <Score value={cycle.overallRating} />}` hides the number on screen while `cycle` still ships in full, readable via View Source. Observed live on 2026-07-28: the page showed **🔒 Unlock** while the source carried `"overallRating":60,"overallLabel":"Neutral","financialHealthScore":81`. **Rule: withhold restricted data at the data layer — strip the fields from the object before it can reach a client component — and treat the conditional render as presentation only, never as the control.** `fetchCycleAnalysis`'s `stripPremium()` is the pattern. This failure mode is especially dangerous because the UI *looks* correct, so it survives visual review; assert on `document.documentElement.innerHTML`, not on what's on screen.
- **Two independent locks on anything paid.** A premium surface should require the *viewer's* entitlement **and** the data's presence. Narrowing on a type guard alone (`isFullCycle(cycle)`) means "the API stripped it" is your only control, and a single control that fails open takes the paywall with it (finding B1). `KpiStrip` and the header chips were type-guard-only until `ea84d01`.
- **"Loading" and "failed" are different states — never let one `null` mean both.** A CTA whose label depends on fetched context must be **inert** while that context is in flight, not a live control carrying a guessed default. `UpgradeDialog` used `ctx === null` for both, so the in-flight moment rendered a real, clickable `<Link href="/pricing">` — and a reader quick enough to click it was thrown out of the in-place dialog they had just opened (fixed `f8374d0`). Render a `disabled` button while loading; reserve the escape hatch for a genuine failure. The same rule stops the opposite error: optimistically showing "Start free trial" before you know the reader has already used theirs is a false promise, which is the bug class the signup CTA hit on 2026-07-27.
- 🔴 **An orthogonal flag must be honoured by every surface that displays what it overrides — and by the till.** `billing_blocked` is not a `subscription_status` value; a disputed account keeps whatever Stripe status it had. Entitlement ranked the flag above the status from day one, so enforcement was correct everywhere — while the sidebar badge said **ACTIVE** and the account card said **"ACTIVE — You're on the Monthly plan"** to someone locked out of every paid surface. Worse, `/api/checkout` didn't consult it either: losing a chargeback cancels the subscription, `canceled` is the one status allowed to re-subscribe, so a held user could **pay again and still be denied** (fixed `aabc865`). Rule: when you add a flag that overrides a state, grep for every reader of that state — display, copy, CTA gating and the purchase path — not just the access check. Enforcement and presentation drift apart silently, because only one of them has tests.
- 🔴 **If a guard stops enforcing and starts only reporting, the caller's early return becomes the enforcement — say so, and pin it.** `requireEntitled()` used to `redirect()` an unentitled viewer; `requirePremiumPage()` deliberately doesn't (a signed-in reader must stay inside the app). Same name-shaped call, same import site, but a page that keeps calling it and *ignores the result* now renders its premium content to everyone. The danger is that the diff looks like a refactor. Rule: when a guard's failure mode moves from "it acts" to "it tells you", every call site must gain an explicit branch, the branch must sit **before** any privileged fetch (see the RSC-serialisation rule above), and CI must assert both halves — `check-entitlement-gates.mjs` greps for the call *and* for `if (!viewer.entitled) return <PremiumLockPage…>`.
- 🔴 **Next attaches NO `Cache-Control` to route handlers — pages get one free, so a habit formed on pages does not transfer.** A dynamic page ships `no-cache, must-revalidate` without you asking; a `route.ts` ships **nothing at all**. On 2026-08-01 that meant `/api/portal` and `/api/checkout` — whose payloads are credential-equivalent and scoped to one customer, the portal's 303 `Location` being a live session granting that person's card, invoices and cancel button — stated no caching posture whatsoever. Only **3 of 15** route handlers said anything. Nothing was exposed (Vercel caches only on `s-maxage`, and both are POSTs), which is exactly the objection: safe by someone else's default rather than by our own statement. **Rule: read the wire, not the source.** "I didn't see a bad header" is not the same as "the header is right" — this was found by printing response headers from a real signed-in session, and reading the code had not caught it, because the bug is a line that *isn't there*. Then guard it: the CI check asserts the count of `headers: NO_STORE` **equals** the count of `NextResponse` returns, because one unguarded branch is the whole hole.
- 🔴 **When a rule outranks another, apply it at every layer — a page-only guard is a guard the URL bar can skip.** Deletion confinement was evaluated in `requirePremiumPage()`, so every *page* correctly sent a deletion-scheduled account to `/reactivate`. The route handlers gate themselves and simply never asked, so the same account still got the full paid report from `/report`, the full screener payload from `/api/analyze*`, and a 303 into a live Stripe portal from `/api/portal` — while being signed out globally and told everywhere else that it was deactivated. `/api/checkout` had no check either and merely *happened* to refuse in testing, for an unrelated reason (that account also had a subscription), which is how a gap hides inside a passing test. **Rule: a precedence rule ("deletion outranks billing") is a property of the system, not of the page layer — grep every self-gating surface when you add one, and assert the ordering, not just the outcome.** The refusal must also name the right thing: 403 `account_deleting`, never 402, because 402 invites someone whose account is being deleted to pay again.
- **Two copies of a money derivation will drift — extract, don't duplicate.** When the checkout landing page needed to provision a subscription (closing the webhook race), the tempting move was a second small "apply the subscription to the profile" block next to the webhook's. That derivation decides *who has paid*; two of them silently disagreeing is a customer either charged without access or given access without paying. `syncSubscription()` and its helpers moved to `web/lib/billing/sync.ts` so the webhook and `reconcileCheckoutSession()` run the identical function (`b2d2343`). The webhook contract tests (21/21) are what proved the extraction was behaviour-preserving — extract *behind* a test suite, never in front of one.
- **An unreachable surface is a liability, not dead weight — delete it.** The on-screen report preview page (`/stocks/[market]/[ticker]/report`) rendered the full scorecard server-side and nothing in the product had ever linked to it. It still had to be gated, cached correctly and kept in step with `ReportDocument` — three ongoing obligations for a page with no users, and one more place for the paywall to regress unnoticed. Removed 2026-07-29. Before deleting, check what *else* the file kept alive: the `.report-page` CSS looked orphaned but is the `<body>` class of the **downloaded** file, and `ReportDocument` is still mounted by the offline bundle.
- **A conditional branch is only tested by a viewer who actually lands on it.** Paywalled UI multiplies branches by entitlement, and a pass done entirely as one persona verifies half the product. The analyst chip rendered correctly as "Analysts: Buy" for free readers while showing a bare, unattributed "Buy" to every *subscriber* — invisible to a free-tier visual sweep, caught only once a real trial was running (`7ff5abe`). Walk each surface at least twice: unentitled, and entitled.
- 🔴 **Two lists of the same claims WILL drift, and the one further from the money drifts unnoticed.** `/pricing`, `UpgradeDialog` and `StartTrialModal` each kept a private array of "what a subscription includes". When `/pricing`'s was corrected (it had been advertising the free tier back to a prospective subscriber), the other two were untouched — and `StartTrialModal`, **the last screen a reader sees before paying**, still listed three things a free account already had, while the dialog one click earlier listed the right four. Found on the live site, Layer F audit F-A4-b. **Rule: user-facing claims about what is paid for live in ONE exported constant** (`PREMIUM_UNLOCKS` in `lib/pricing.ts`), imported by every surface. Rewriting the words alone would have fixed the symptom and left the mechanism. The constant's doc comment carries the test each line must pass: *it must name something in `PREMIUM_FIELDS` or the screener* — charts, the drawdown cycle, the fundamentals sections and all three markets are free, so they can never appear.
- 🔴 **A page-level rule enforced in two places with two memberships is a rule any third page opts out of by omission.** "Signed-out readers only" lived in `proxy.ts` (for `/login`, `/signup`) and again in `pricing/page.tsx` — so `/deletion-requested`, in neither, told **any** signed-in reader that their account was scheduled for permanent deletion (F-A4-c; it said so to the owner, live). Being in `PUBLIC_PATHS` only exempts a page from the *login bounce*; it says nothing about who *should* see it. **Rule: one list, one place — `SIGNED_OUT_ONLY_PATHS`. When a page's copy is only true in one session state, membership of that list is part of writing the page.**

### Supabase from the client (learned the hard way — F3)

- **`createBrowserClient()` must be a module-level singleton.** Building a new client per call spins up multiple `GoTrueClient`s, each with its own auto-refresh loop over the same cookie storage; they race on refresh-token rotation and can invalidate the session (intermittent, unrecoverable sign-outs). `web/lib/supabase/client.ts` memoises it — never `new` one ad-hoc.
- **Authenticated DB writes go through a server action, not the browser client.** A cold browser client can fire an `UPDATE` before it has hydrated the session from cookies → the write goes out unauthenticated → RLS matches **zero rows** → and PostgREST returns **no error** for a zero-row update, so the UI shows a *false* success while nothing persisted. In a server action the cookie-bound client is already authenticated for the request, so the write is reliable and its result is truthful. (See `ProfileForm` → `updateProfile` in `web/app/(app)/account/actions.ts`.)
- **`signOut()` defaults to `scope: 'global'` — pass `'local'` for a normal Sign-out button.** The default revokes the user's sessions on **every device**, so signing out on one device silently logs them out everywhere (and, in the e2e suite where suites share one test user, one suite's sign-out revoked another's session mid-test). A normal Sign-out must be `signOut({ scope: 'local' })` (this device only). Reserve `'global'` for deliberate "end everywhere" actions — e.g. account deletion. (See `web/app/auth/signout/route.ts` vs `account/actions.ts`.)
- **A DB-write server action that changes what a page renders must `revalidatePath()` that page.** The write persists, but Next's client Router Cache keeps the *pre-write* RSC snapshot, so a soft-navigation away and **Back** re-renders the stale page (the change looks lost though the DB is correct). `updateProfile` saved the country fine, but save → `/pricing` → Back showed the old country until we added `revalidatePath('/account')` after the successful update. Rule: after any successful mutating server action, invalidate every path whose render depends on the changed row (`revalidatePath`/`revalidateTag`), or `router.refresh()` on the client for the current view. (Fixed 2026-07-18, commit `9029762`.)
- **The `OnboardingModal` first-login write was the last remaining client-side write → now a server action too** (`web/app/(app)/actions.ts` `acknowledgeDisclaimer`, commit `cc9c0a5`). A DB-write sweep (2026-07-18) confirmed no other flow has the stale-render bug: deletion signs out globally; reactivation redirects (fresh layout); referrals/contact display nothing back; request-ticker owns its client list; password/onboarding use `router.refresh`.

### Billing currency: one resolver so shown price == charged price (F3)

- **Resolve the billing currency in exactly one place — `effectiveBillingCountry(savedCountry, edgeCountry)` in `web/lib/stripe.ts` → `currencyForCountry`.** Used by `/pricing`, the account **Start-free-trial** modal, and `/api/checkout`. Stripe **locks a subscription's currency permanently at creation**, and we set it explicitly (from the user's country, else the Vercel `x-vercel-ip-country` edge header, else USD), so the price we *display* must be computed the SAME way as the currency we *charge* — otherwise a user with no saved country sees one currency and is billed another (the exact bug the trial modal exposed, commit `e30c7aa`). Checkout also **persists the resolved country** before the subscription locks the currency, so the stored (soon-locked) country always matches the charge. Because currency is locked per subscription, the account **country field is read-only while subscribed**.

---

## 4. Python Conventions

### Versions & Tools

- Python 3.12 minimum
- Type hints on every function signature (PEP 695 syntax preferred)
- `ruff` for linting (config in `pyproject.toml`)
- `mypy --ignore-missing-imports --explicit-package-bases` for type checking
- `pytest` for tests

### Type Hints

```python
# ✅ GOOD
def fetch_price_history(
    self,
    ticker: str,
    period: str = "max",
) -> Optional[pd.DataFrame]:
    ...

# ❌ BAD — missing return type
def fetch_price_history(self, ticker, period="max"):
    ...
```

### Dataclasses Over Dicts

```python
# ✅ GOOD
@dataclass
class CycleAnalysis:
    ticker: str
    overall_rating: int

# ❌ BAD
def analyze() -> dict:
    return {"ticker": "AAPL", "overall_rating": 80}
```

### Error Handling

- Catch specific exceptions, never bare `except:`
- Log with context, then re-raise or return None — never silently swallow
- Use `logging` module, not `print()` — `print` is banned in committed code

```python
# ✅ GOOD
try:
    df = yf.Ticker(ticker).history(period="max")
except (ConnectionError, Timeout) as e:
    logger.warning(f"yfinance connection failed for {ticker}: {e}")
    return None
except Exception as e:
    logger.exception(f"unexpected error fetching {ticker}")
    raise
```

### Async / Sync

Phase 1 is synchronous (yfinance is sync). Vercel Python functions wrap blocking calls in async with `asyncio.to_thread()`. Don't try to make yfinance async — wrap it.

### Vercel Python Serverless Functions (the `web/api/` directory)

Each `.py` file in `web/api/` becomes one Vercel serverless function (file path → URL path). Conventions:

- **Function shape.** Implement a class named `handler` inheriting from `http.server.BaseHTTPRequestHandler`. Define `do_GET` / `do_POST` as needed. See `web/api/cycle.py` for the canonical example.
- **Cycle math imports come from `_engine`, NOT `analytics`.** Vercel's project rootDirectory is `web/`, so `analytics/` (a sibling of `web/`) isn't reachable from the function bundle. We vendor the relevant files into `web/_engine/`. The CI drift check enforces parity. **Never edit files in `web/_engine/` without making the same edit in `analytics/<same_path>` in the same commit.**
- **sys.path setup.** Insert `web/` into sys.path at the top of the function so `from _engine.X import ...` resolves regardless of how Vercel launches the script:
  ```python
  import sys
  from pathlib import Path
  sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
  ```
- **Never call yfinance from a serverless function.** Data is already in Supabase from the daily cron. Functions read from Supabase only.
- **Dependencies.** Add Python deps to `web/requirements.txt`, NOT `analytics/pyproject.toml`. Keep the function bundle small — every function gets its own copy.
- **Env vars.** Functions read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (set in Vercel project env). The `NEXT_PUBLIC_` prefix is for client-side JS only.
- **JSON serialisation.** Use `dataclasses.asdict(obj)` then `json.dumps(d, default=str)`.
- **Caching.** GET responses that don't depend on per-user state should set `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` so Vercel's edge serves repeated hits without re-invoking the function.
  > 🔴 **"Don't depend on per-user state" is doing all the work in that sentence — read it before you copy the header.** `s-maxage` is a **shared**-cache directive and Vercel's edge keys on the **URL alone**. Any response whose *content* varies by who is asking — entitlement, plan, role — must NOT use it, or the first viewer's response is served to everyone else at that URL, from the CDN, **before your function runs**. That is not a caching bug, it is an authorisation bypass, and no amount of in-function checking can catch it because the function is never invoked.
  >
  > This happened: `/api/cycle` shipped `public, s-maxage=3600` while returning a fully scored analysis, which would have handed the paid product to anyone once the cache was warm (F3 Step 10, finding B1). It now sends **`Cache-Control: private, no-store`**, and `pnpm check:entitlement-gates` fails CI if `public`/`s-maxage` reappears there.
  >
  > **Rule:** if the response varies by viewer, either put the varying dimension **in the URL** (a query param — as `entitled` now is) *and* keep the cache private, or don't share-cache at all. Next's Data Cache (`next: { revalidate }`) is the safe alternative — it lives server-side and only we can fill it.
  >
  > **This applies to refusals too, and they're easy to miss.** `NextResponse.json(...)` defaults to `Cache-Control: public, max-age=0, must-revalidate`. Our middleware's 401 (`/api/cycle`) and 402 (`/api/analyze`) both shipped that — and the 402's body names the caller's denial reason, read from their billing columns. Not exploitable, because `max-age=0` + `must-revalidate` stop any reuse. But `public` on a viewer-dependent response is the exact directive from B1, and it left both refusals safe only because of a modifier someone could delete without knowing it was load-bearing. Both now pass an explicit `private, no-store`; the guard asserts it (the `/api/cycle` and `/api/analyze` sections) and is mutation-tested. **Set the header deliberately on every refusal — don't inherit the framework default.**
- **Errors.** Catch broad `Exception` at the top of the handler, log via `logger.exception`, return a structured JSON error: `{ "error": "...", "detail": "..." }`. Never expose stack traces directly.
- **Bundling.** Configure `includeFiles` in `web/vercel.json` to pull `_engine/**` into the function bundle (Vercel's auto-tracing may not catch the `sys.path` indirection).

---

## 5. The Strict Rules (Carry-over from Existing HTML Work)

These were learned the hard way in the reference HTML. Do NOT break them.

### Rule 1 — All chart instances declared once in master state
```javascript
// ✅ GOOD
let charts = { price: null, drawdown: null, financials: null };
charts.price = new Chart(...);

// ❌ BAD — second declaration crashes
let priceChart = new Chart(...);
// ... later in code ...
let priceChart = new Chart(...);  // SyntaxError or runtime overwrite
```

### Rule 2 — Never use Math.max/min spread syntax on large arrays
```javascript
// ❌ BAD — crashes V8 on arrays > ~125k items
const max = Math.max(...prices);

// ✅ GOOD
const max = prices.reduce((a, b) => Math.max(a, b), -Infinity);
```

### Rule 3 — No HTML comments inside JS template literals
```javascript
// ❌ BAD — browser HTML parser swallows everything after <!--
const html = `<div>${value}</div><!-- comment --><span>more</span>`;

// ✅ GOOD
// comment outside the template
const html = `<div>${value}</div><span>more</span>`;
```

### Rule 4 — CrosshairPlugin guards chart types
```javascript
// CrosshairPlugin afterDraw / afterEvent MUST guard:
if (chart.config.type === 'radar' || chart.config.type === 'doughnut' || chart.config.type === 'pie') return;
```

### Rule 5 — Edit existing files with targeted edits only
- Use `str_replace` style edits
- Never rewrite a full file unless explicitly asked
- Pull the existing structure before changing it

### Rule 6 — DataProvider interface is sacred
- No `import yfinance` outside `analytics/providers/yfinance_provider.py`
- Type your imports — if you can't import yfinance, you can't accidentally use it

### Rule 7 — No `console.log`, `print()`, or commented-out code
- Use proper logging (`console.error` for actual errors, `logger.info` in Python)
- Delete dead code; don't comment it out

---

## 6. State Management (Frontend)

Phase 1 uses **React's built-in state primitives**. No Redux, no Zustand, no Jotai.

- Server state → Server Components + `unstable_cache` (Next.js)
- URL state → search params (`useSearchParams`)
- Form state → controlled inputs with `useState`
- Cross-component state → React Context if truly needed; lift state first
- Persistent state → Supabase tables (e.g. saved watchlists)

If you find yourself reaching for a state library, the architecture is wrong. Push state to the server, the URL, or props.

---

## 7. Error Handling

### Frontend

```typescript
// Server Components — let errors bubble; Next.js renders error.tsx
// Use try/catch only when you have a meaningful fallback

// Client interactions — show user-facing error
async function handleAnalyze(tickers: string[]) {
  try {
    const result = await fetch('/api/analyze', { ... });
    if (!result.ok) throw new Error(`Analyze failed: ${result.status}`);
    const data = await result.json();
    setResults(data);
  } catch (e) {
    toast.error('Analysis failed. Please try again or contact support.');
    console.error(e);
  }
}
```

Every route has an `error.tsx` and `loading.tsx`. Every form has loading state and disabled submit during pending.

### Backend (Python)

```python
def run_analysis(tickers: list[str], params: CycleParams) -> AnalyzeResponse:
    results = []
    unavailable = []
    for ticker in tickers:
        try:
            df = load_price_history(ticker)
            if df is None:
                unavailable.append(ticker)
                continue
            results.append(analyze(df, params))
        except Exception as e:
            logger.exception(f"analysis failed for {ticker}")
            unavailable.append(ticker)
    return AnalyzeResponse(results=results, unavailable=unavailable)
```

**Rule:** A single failed ticker never aborts a batch. The unavailable list is returned to the user.

---

## 8. Testing Strategy (Phase 1 Floor)

Phase 1 does NOT require 100% coverage. It DOES require these things tested:

| Module | Test type | Required |
|---|---|---|
| `analytics/major_cycle.py` cycle math | Unit tests against known fixtures | ✅ |
| `analytics/scoring/` (FH, valuation, overall) | Unit tests | ✅ |
| `analytics/providers/yfinance_provider.py` | Integration test (network, can be skipped in CI) | ✅ |
| `web/lib/ticker.ts` URL↔storage mapping | Unit tests | ✅ |
| `web/lib/presets.ts` consistency with Python | Unit test | ✅ |
| Auth gating on API routes | Integration tests | ✅ |
| Stripe webhook handler | Unit tests with fixture events | ✅ |
| UI components | No tests required Phase 1 (visual reference is the spec) | — |

Run via `pytest` (Python) and **Playwright** (TS). Both must pass in CI.

> ### 🔒 OWNER DECISION, 2026-08-06 — Playwright is the ONLY TypeScript test runner.
>
> **Do not add Vitest, Jest, or any second TS test framework.** Do not "restore"
> one on the basis of an older doc. If a future need genuinely argues for one, it
> is a decision to put to the owner, not an implementation detail.
>
> **How this arose.** This line, and item 3 of § 13, both required
> `vitest` / `pnpm test` to pass — and **there has never been a `test` script or a
> Vitest dependency in this project.** Nothing was broken by it, but it advertised
> a layer of coverage that does not exist, and it read as an instruction to a
> future session to install one.
>
> **Why one runner, in one sentence:** the project's rule for judging a CI run is
> *check the COUNT, not the colour* — and that only works while there is **one**
> count. Two runners means two numbers, and a suite that silently stops running
> stays hidden behind the other one's green.
>
> **Where the "unit tests" live, then.** In `web/e2e/`, as **pure Playwright
> specs** — no browser, no network, no credentials — so they run everywhere,
> including a fork PR with no secrets configured, and can never self-skip.
> `entitlement.spec.ts` (the paywall truth table) and `export-parity.spec.ts` (the
> csv/xlsx rounding rule) are the reference examples to copy. They are also the
> fastest tests in the suite: both finish in tens of milliseconds.

### The three test shapes in `web/e2e/`, and when each is the right one

Everything lives in one runner, but not everything is the same kind of test. Picking
the wrong shape is how a feature ends up with a green suite and a broken half.

| Shape | Needs | Use it for | Examples |
|---|---|---|---|
| **Pure** — no browser, no network | nothing | A rule you can state as a function | `entitlement.spec.ts`, `export-parity.spec.ts`, `public-chrome.spec.ts`, `auth-contracts.spec.ts` |
| **Credential-free browser** | the dev server | Anything you can reach signed out, incl. a state you can fake with a cookie | `auth.spec.ts`, `auth-forms.spec.ts`, `seo.spec.ts`, `contrast.spec.ts`, `legal-doc.spec.ts` |
| **Throwaway account** | Supabase service key | A flow that must actually RUN, with side-effects too destructive for the shared login | `entitlement-routes.spec.ts`, `stripe-webhook.spec.ts`, `deletion-notice.spec.ts`, `recovery-confinement.spec.ts` |

**The throwaway pattern** — `admin.auth.admin.createUser` in `beforeAll`,
`admin.auth.admin.deleteUser` in `afterAll` (the `profiles` row follows via cascade),
`@example.com` so no mail is deliverable, and usually
`test.describe.configure({ mode: 'serial' })` because every test mutates one row.
`afterAll` runs even when the test fails, so a deliberately-broken run leaves nothing
behind — worth verifying once after any session that adds one.

⚠️ **`mode: 'serial'` is for shared MUTABLE state, not for "these tests are related" —
it SKIPS every remaining test after the first failure.** `recovery-confinement.spec.ts`
shares only its fixture user, so it runs in default mode deliberately. The difference
showed up while breaking the confinement on purpose: serial reported *one* failure and
hid the two controls, and those controls are what say which DIRECTION it broke in —
"confined when it shouldn't be" and "not confined when it should be" are opposite bugs
with opposite fixes. In default mode the same break reported 2 failed / 4 passed and the
shape read off the summary line. For a reader who cannot debug, a failure that names its
own direction is worth more than a short failure list.

⚠️ **You cannot test a third party's ACCEPTANCE by observing that its widget RENDERED.**
The Google sign-in button draws from a real `accounts.google.com` iframe, with a clean
console, **on an origin Google has never heard of** — `renderButton` validates nothing, and
the origin is only checked server-side when the popup opens. A whole verification pass was
written up backwards on exactly that evidence (2026-08-12); the owner clicking the button
produced `Error 400: origin_mismatch` in one second. **Only the completed round-trip is the
test.** Where the round-trip is not automatable — and this one is not, the popup opens
outside the automation's reach — say so plainly and hand it to a human, rather than
substituting a proxy signal that feels adjacent. See CLAUDE.md 11h.

⚠️ **Scattered failures across specs you did not touch = check for ORPHANED PROCESSES
before you debug a line of code.** Deliberately breaking things leaves Playwright browsers
and `next dev` instances behind, and they accumulate. On 2026-08-12 a full run reported 6
failures spread over `entitlement-routes`, `report-download`, `stripe-webhook`,
`auth.spec` and `recovery-confinement` — nothing in common, and every one of them passed
in isolation. There were **18 stray node/chrome processes**; after
`Get-Process node,chrome | Stop-Process -Force` the same suite ran **259 passed, 0 flaky
in 3.0m instead of 5.9m**. The tell is the shape, not the count: real breakage clusters
around what changed, resource starvation scatters. Two earlier runs that session showed
the same signature and cost time to chase.

⚠️ **Scope a `[role="alert"]` locator, always.** Next renders a route announcer —
`<p id="__next-route-announcer__" role="alert">` — on every page, in dev *and* in
production, and it is normally empty. A bare `page.locator('[role="alert"]')` therefore
finds one element on a pristine form and two after a real error, so `toHaveCount(1)` was
silently asserting the announcer. Use `form [role="alert"]`. Caught only because
`auth-forms.spec.ts` carried a no-error control; a suite that only ever looks at the
error state would never have noticed.

⚠️ **A gate and its setter are different failure modes, and one test rarely covers both.**
The deletion-notice work is the case study: handing the browser a marker cookie proves the
gate honours it, and says *nothing* about whether the Server Action ever sets one. If the
setter broke, a person who really deleted their account would be bounced to `/login` with
no confirmation, and every gate test would still be green. That is why
`deletion-notice.spec.ts` presses the real button — and why both halves were broken on
purpose before either was trusted.

⚠️ **Prove the page stayed put before asserting anything about it.** A test that
navigates somewhere gated can be silently redirected and then measure the wrong document.
`/deletion-requested` now redirects to `/login` without its marker — and `/login` is ALSO
`noindex`, so `seo.spec.ts`'s noindex assertion would have passed against the wrong page.
Every navigating test asserts the landing pathname first, the same rule `measure()` in
`contrast.spec.ts` already followed.

### Stripe webhooks — offline contract tests + a real end-to-end pass

- **Contract tests** (`web/e2e/stripe-webhook.spec.ts`) sign events **offline** with the same secret the route verifies with (`generateTestHeaderString` ↔ `constructEvent`), so any consistent `whsec_…` works — no reachable endpoint or network to Stripe needed. They create their **own throwaway user** per run (never the shared login account) so they can run in parallel without contention.
- **But also do one real end-to-end pass** — the offline tests fire events **one at a time** and miss ordering bugs. A real trial signup fires an **event storm** (`subscription.created` + a paid `$0` invoice) at once; that's how the "paid invoice clobbers `trialing`" bug was caught. Do it with the **Stripe CLI**: `stripe login` (owner-interactive) → `stripe listen --forward-to localhost:3000/api/stripe/webhook`; put its `whsec_` in `web/.env.local`; create a test subscription and assert the DB.
- **Vercel preview URLs are behind Deployment Protection** (`vercel_auth_enabled`) — Stripe's POST gets a **401** and never reaches the route. So webhooks can't be registered against a preview URL; test locally via the CLI, and register the **real** endpoint in **production** (not walled, LIVE mode).
- **Idempotency ledger uses `ON CONFLICT DO NOTHING`, not insert-then-catch.** Claim the event id with `admin.from('stripe_events').upsert({id,type},{onConflict:'id',ignoreDuplicates:true}).select('id')` — an empty returned array means the id was already processed (ack + skip). Catching the primary-key violation (23505) works too but makes every legitimate Stripe **redelivery** log a Postgres `duplicate key` error, which buries real errors. Both are concurrency-safe; prefer the ON CONFLICT form for clean logs. (2026-07-18, commit `907b948`.)
- **The Stripe client sets `maxNetworkRetries: 2`** (`web/lib/stripe.ts`) — the SDK does **0** retries by default, so a transient network blip on `checkout`/`prices` fails hard. Stripe's SDK auto-adds idempotency keys on retried POSTs, so this is safe.
- **Local cold-connect stall (specific machines).** On some machines the **first** outbound HTTPS connection to `*.supabase.co` / `api.stripe.com` stalls ~10–13 s (IPv6-first DNS) and trips undici's 10 s connect timeout. It surfaces as `pnpm stripe:listen` printing *"Couldn't reach Stripe: fetch failed"* and, worse, the checkout route returning **401 "Not signed in"** (its `getUser()` network call times out even though the page — which uses local `getClaims` — looks logged in). It is **client-side only, NOT a live/Vercel issue** (verified against Supabase logs 2026-07-20 — the failed requests never reach the server). **Root cause (pinned 2026-07-20): the AAAA (IPv6) DNS query stalls ~12 s inside `getaddrinfo`** (measured 12,087 ms verbatim → 28 ms once IPv4-only); `--dns-result-order=ipv4first` does **not** help because it only reorders results *after* resolution — the AAAA query still runs. **Fixed** by forcing IPv4-only resolution in dev: `web/scripts/prefer-ipv4.mjs` (`preferIPv4()` patches `dns.lookup` → `family: 4`, skipping the AAAA query), wired into `web/instrumentation.ts` (dev server — gated to `NODE_ENV !== 'production'` + `NEXT_RUNTIME === 'nodejs'`), `scripts/stripe-listen.mjs`, and `playwright.config.ts`. No flag or warm-up needed now; **production is untouched** (the instrumentation guard skips it). See the `reference-local-dev-ipv6-connect-fix` memory.

### Customer Portal (Manage billing)

- **`web/app/api/portal/route.ts`** is an auth-gated **POST** that mirrors the checkout route: `getUser` → read `profiles.stripe_customer_id` → `stripe.billingPortal.sessions.create({customer, return_url})` → **303 redirect** to the portal. No `stripe_customer_id` → `/account?billing=none`; a Stripe error (most often "no portal configuration in this mode") → `console.error` + `/account?billing=error`. NOT in `PUBLIC_PATHS`. The `/account` "Manage billing" button is a plain `<form action="/api/portal" method="post">` (no client JS, no Stripe key in the browser). **The Customer Portal must be activated per Stripe mode** — a config in live/main-test does NOT exist in a sandbox (create one there, e.g. sandbox `bpc_1TuR6R…`).

---

## 9. Git Workflow

### Branching

- `main` = production. Direct commits forbidden after launch.
- `feature/<short-name>` = work branches
- PRs require: passing CI, owner approval, no merge conflicts

### Commits

- Imperative mood ("Add", "Fix", "Refactor"), not "Added" or "Adding"
- One logical change per commit
- Reference the doc/decision in the commit body when relevant

### PR Template

Every PR description must include:
- **What changed:** 1-2 sentences
- **Why:** the user-visible reason or doc reference
- **How to verify:** steps to test in preview deploy
- **Risk:** what could break

---

## 10. Documentation In Code

### Frontend

JSDoc only for non-obvious functions. Self-documenting names preferred. Each component has a one-line purpose comment at the top:

```typescript
/** Renders the "Major Cycle stats" card for the Stock Detail tab. */
export function CycleStatsCard({ analysis }: { analysis: CycleAnalysis }) { ... }
```

### Backend

Docstrings on every public function. Google-style.

```python
def compute_overall_rating(fh: float, val: float, cycle_payoff: float) -> tuple[int, str]:
    """
    Compute the composite 0-100 rating and its label.

    Args:
        fh: Financial Health score (0-100)
        val: Valuation score (0-100)
        cycle_payoff: Cycle Payoff score (0-100)

    Returns:
        Tuple of (rating: int, label: str). Label is one of:
        'High Conviction', 'Constructive', 'Neutral', 'Cautious', 'Bearish'.
    """
```

---

## 11. Environment & Configuration

- Never hardcode URLs, keys, or magic numbers
- Use `process.env` (TS) or `os.environ` (Python) with defaults documented in `.env.example`
- Feature flags via environment variables (`FEATURE_NEWS_FEED=true`)
- Server-only env vars never get a `NEXT_PUBLIC_` prefix

---

## 12. Anti-Patterns (Things That Look Tempting But Cause Pain)

| Anti-pattern | Why it's bad | Do this instead |
|---|---|---|
| Fetching in `useEffect` for SSR content | Breaks SEO, double-renders | Server Component with `await` |
| Storing computed scores in DB | Goes stale, can't recompute with new params | Compute on read |
| Importing yfinance outside providers | Locks us out of FMP migration | Use the DataProvider abstraction |
| `as any` casts | Defeats the whole point of TypeScript | Narrow with type guards |
| Multiple Supabase client instances | Creates connection pool churn | Use the singleton from `@/lib/supabase` |
| Inline complex logic in JSX | Untestable | Extract to a hook or pure function |
| Catch-all `try/except: pass` | Silent failures = unfindable bugs | Catch specific, log, re-raise |
| Adding dependencies casually | Bundle bloat, supply chain risk | Justify every new dep in PR |
| Rewriting whole files | High blast radius | Targeted edits |
| Mock data left in production code | Will ship if forgotten | Use feature flags or test-only paths |
| Assuming a stale `web/.next` can still break the dev server | **Fixed at the root on 2026-07-30** — `next.config.ts` now sets `distDir` to `.next-dev` under `NODE_ENV=development`, so `next dev` (and `pnpm e2e`, which spawns its own) can no longer be poisoned by a production build. Two follow-ons this required: `.next-dev/**` had to be added to `eslint.config.mjs`'s ignores (eslint-config-next only knows `.next`, so lint started reporting generated Turbopack chunks as our errors), and both `.gitignore`s. | Nothing to remember day to day. **One residue:** `tsconfig.json` includes `.next/types`, so after **renaming or deleting a route** a stale production build makes `pnpm typecheck` fail naming the old module path — `rm -rf web/.next` and re-run. That failure is loud and names the file, which is the acceptable trade; the silent 404s below were not. **A second residue was worse and is now fixed: `tsconfig.json` also included `.next-dev/**/types`, so `pnpm build` type-checked files the DEV SERVER owns and rewrites.** Twice on 2026-08-22 the production build failed on a truncated `.next-dev/dev/types/routes.d.ts` — `Type error: Unexpected keyword or identifier` pointing at `dlerRoute extends`, a file cut off mid-write when a dev server was killed. Nothing was wrong with the code. **A production build's success must not depend on another process's scratch directory**, so `.next-dev` is now in `exclude`. |
| Running `pnpm build` while the dev/preview server is up | Poisons the shared `web/.next` cache. Two symptoms seen: **stale `globals.css`** (new JS but old CSS), and — 2026-07-30 — a **route handler that 404s as if it didn't exist**. The second is the dangerous one, because a paywalled route answering 404 instead of 402 reads exactly like a broken gate. Tell them apart by the body: our refusals are **JSON + `private, no-store`**; a routing miss is **HTML + `no-cache, must-revalidate`** (Next's own not-found), and the dev log still shows application-code time because the not-found boundary rendered. | After a prod build, `rm -rf web/.next` (or at least `.next/types`) and restart the dev/preview server before verifying anything. Confirmed: `/report` returned HTML 404 twice, then **402 `payment_failed` + `private, no-store`** immediately after a clean restart — the code was never wrong. |
| Trusting a **dev-server** reading of CSS after editing `globals.css` | Next HMRs the TSX but does **not** always recompile `globals.css`, so the browser gets NEW markup against OLD styles. Seen 2026-08-02 (Layer F audit F-A4): after tokenising a colour, `getComputedStyle` reported the new custom property as **empty** with **0** elements using it, while the HTML already referenced `var(--brand-light-border)` — which reads exactly like a shipped visual regression (a colourless border). The served stylesheet still held the pre-edit hexes. | **A CSS change is not verified until a build says so.** `pnpm build` and grep the emitted stylesheet in `.next/static/chunks/*.css` for both the token definition and its `var()` consumers. Do not file a styling regression from a dev-server reading alone. |
| Reading an HTTP **status alone** to decide whether a page guard fired | A server-component `redirect()` cannot send a 3xx once the streaming shell has flushed, so Next puts the redirect **inside a 200** as a `NEXT_REDIRECT` payload. 2026-07-30: `/run` and `/stocks` answered **200** for a deletion-scheduled account, which reads as confinement broken — it wasn't; both bodies redirected to `/reactivate`. A guard that *is* working looks identical to one that isn't. | Assert on the **body**: grep for `NEXT_REDIRECT` (and the target) as well as the status. Route handlers *do* return real 3xx/402 — the streaming caveat is pages only. Byte size is a useful second signal: the redirect shell is a fraction of the real page (29 KB vs 225 KB for `/run`). ⚠️ **`notFound()` has the SAME problem and it is worse, found 2026-08-15.** Once the shell has flushed the status is committed, so an unknown URL renders "Page not found" inside a **200** — a soft-404, which Google penalises harder than an honest 404, sitewide. Proved by control on a production build: with `app/loading.tsx` present `/learn/x` → 200; with it moved aside, same build → **404**. Control that makes it a finding rather than a guess: `/.well-known/nothing-here` returns a true 404 on the same server, so 404s do survive the middleware. Recorded as roadmap **GA-1b**, and ✅ **fixed 2026-08-18** by deleting that file — every `notFound()` now answers a real 404. ⬆️ **This row already described the mechanism for `redirect()` and I re-derived it from scratch** — grep the docs first. |
| Grepping SSR HTML for a marker that isn't unique to the state | Two markers in one session nearly produced false findings: `"reactivate"` and `"Run Analysis"` appear in **every** page's nav, so both matched everywhere and proved nothing. Worse, a **client-rendered** element is absent from SSR HTML entirely — the onboarding modal grep said "not present" while the modal was in fact blocking the whole page. | Grep for copy unique to that one state (the per-reason denial titles from `PremiumLockPage`, e.g. "We couldn't take your last payment"). Anything client-rendered must be confirmed in a **real browser**, not in the HTML. And verify the selector/marker discriminates *before* calling a defect — the same lesson as the `select[name="country"]` false alarm. |
| Trusting a `preview_start` that suddenly **fails every detail page** | Next lets a pre-existing `process.env` (a stale Supabase URL/key in the launching shell) **override `web/.env.local`**, so SSR reads the wrong/old project (looks like a code bug; it isn't). ⚠️ **The symptom changed on 2026-08-07** and the difference is now diagnostic: a *bad credential* errors, so `fetchStockDetail` throws `StockReadError` → the "Something went wrong" boundary; a *valid credential on the wrong/empty project* returns no row → `notFound()`. Before 11e both looked identical — a 404 — which is precisely why a broken environment was indistinguishable from a missing ticker. | Confirm the creds reach the data (a quick REST/Node check), then `preview_stop` + `preview_start` **fresh** to pick up the right env. A clean restart fixed it (2026-06-27). **Read which of the two failures you got** — the error boundary means credentials, a 404 means the wrong project. |
| Rendering a raw yfinance metric as a headline | Near-zero denominators give absurd values (P/E 3,500×, ROE 8,457%, payout 18,210%) that look broken | Cap the display via `MetricDef.cap` (show `>+cap`, true value in tooltip) + mirror in `medians.server.ts` `OUTLIER_BOUND`. Where a high value is *bad* (distress dividend yield), show it but recolour amber + ⚠, don't cap. See design-system §9 "Numeric display". |
| Naming the data provider ("Yahoo Finance") in user-facing copy | Owner decision (S9) — don't advertise the free source | Keep user-visible copy generic ("third-party data — not our rating"); the provider name may stay only in internal code/comments. |
| Hand-rolling price formatting (`Intl`/`currencySymbol`/hardcoded `$`) in a component | Drifts into inconsistency — `C$` vs `CA$`, `$1.71` for an AUD stock, or **mixed decimals within one group** (a `$95.20` target beside a `$120` one) | Use the shared **`fmtPrice`** (uniform 2 dp ≥ $1, more < $1 so sub-$1 never shows "$0") / **`fmtPerShare`** (EPS/DPS, 2 dp) from `web/lib/format.ts`. See design-system §9 "Price formatting". |
| A card "fill-to-N" fallback that asserts a metric claim | Can contradict the opposite card for the same ticker (e.g. Why-Attractive "accelerating 34%" vs Key-Risks "34% is modest") | Keep each metric's Attractive vs Risk thresholds **disjoint**; a fallback must be **gated** to the range that makes it true or a **tautological caveat** that can't be wrong. See design-system §9 "Statement engine — no contradictions". |
| Forcing a fixed magnitude unit on a large quantity (`/1e9 … 'B'`, `/1e6 … 'M'`) or pre-dividing chart data by `1e9` | A small-cap's real values **collapse to a meaningless "0.0M"/"$0B"** (e.g. SEK.AX cash axis was all "$0B"); the user is shown no information | Use **`fmtCompact(value, currency?)`** (adaptive K/M/B/T, mantissa always ≥ 1) for off-axis quantities, and **`makeCompactAxisFormatter(axisMax, currency?)`** for chart axes (uniform unit + uniform decimals across all ticks). Plot **raw** values; let the formatter drive the axis. See design-system §9. |
| A literal source space after a closing inline tag (`</strong> word`) when the next text **wraps to a new line** in JSX | Babel's JSX whitespace rule drops that leading space → the words run together ("trend.It blends", "data"(this") | Put an explicit `{' '}` after the closing tag (`</strong>{' '}word`) — never rely on a literal space across a line break. |
| Deriving a calendar date from a tz-aware timestamp with **`tz_convert(None)`** | It converts to **UTC first**, so the date is only right for exchanges **west** of Greenwich. New York midnight is 04:00 UTC the same day; **Sydney midnight is 14:00 UTC the day before**. Found 2026-08-04: every ASX bar had been stored **one day early since inception** — 1,413,737 rows with **0 Fridays and 273,700 Sundays**, while US/CA looked perfect. It survived review because the line reads as correct and *is* correct for two of our three markets. yfinance's own `utils.py` sets the index to `exchangeTimezoneName` deliberately and normalises daily bars to 00:00 so that "this doesn't affect date conversion" — we were using the library against its design. | **`tz_localize(None)`** — drops the zone, keeps local wall time, which is what a daily bar means. Guarded by `analytics/tests/test_no_utc_date_conversion.py` (scans `analytics/` + `web/_engine/`), which **also asserts it scanned a non-empty file list** — pointed at a bad path, the content check passed vacuously. |
| Reading a symptom's *appearance* instead of measuring the mapping | The ASX dates presented as "Friday bars land on Sunday", so I argued a timezone offset was impossible ("that would shift every weekday, but only the fifth is wrong") and **retracted the correct hypothesis**. All five weekdays *were* shifted; `Mon→Sun` is just the only one that yields an impossible date, so a uniform −1 shift disguises itself as a Friday-only defect. | When a hypothesis is cheap to test, **test it** rather than reasoning about whether it could be true. One print of the raw index beside the stored dates settled in seconds what two rounds of argument got backwards. Corollary, seen the same day: the first verification script reported **FAIL** for three reasons that were not the bug (today's bar not yet fetched, dividend re-adjustment drift, partial current-session bars). The decisive test was **offset alignment** — does a stored close match the source at offset 0, −1 or +1 — with untouched markets as controls. |

| Measuring a page **while signed in** — or on a Vercel **preview** — and calling it the anonymous view | 2026-08-07: reading canonical/`noindex` tags in the owner's browser produced five clean rows for **pages nobody asked about** — signed in, `/pricing` had bounced to `/account` and `/login` to `/stocks`. The redirect was followed silently, so every field was populated and plausible. ⚠️ And a preview **cannot** be read anonymously: its access cookie and the app session share one jar, so `credentials:'omit'` drops both and the request dies before reaching the app. | **Never follow redirects when measuring, and print the LANDED url beside every reading** — that single field is what exposed it. For a signed-out view, serve a **production build** locally (`next start`) and fetch with no cookies. **Calibrate first**: re-measure pages whose answer you already know from another instrument; only trust the new one if they match. Then add a **control** (gated paths must 307) so you know the reader can still detect a bounce. |
| Scoping typography with an **unlayered** class rule | Tailwind utilities live in `@layer utilities`, so ANY unlayered rule beats them regardless of specificity — and a layered one still loses to a more specific selector. `.reading a { color: var(--brand-mid) }` (0,1,1) outranked `.text-white` (0,1,0) and painted the `/methodology` call-to-action **brand-blue on a brand-blue button: 1.0:1, invisible**. Every token involved was correct; only the composite was wrong, which is why reading the CSS finds nothing. `globals.css` already carried this warning above its reset, for `* { padding: 0 }` vs `.px-6`. | Put scoped typography inside **`@layer base`**, so a utility on the element still wins. Then **measure the rendered pair** — `e2e/contrast.spec.ts` computes WCAG contrast from `getComputedStyle`, compositing every translucent ancestor, and is the only thing that could have seen this. |
| A checker that reports **clean when it cannot see** | The contrast spec was genuinely flaky: the same deliberate break reported "1 failed" on one run and "4 failed" on the next. On a cold dev-server compile the probe ran before the stylesheet applied — and an **unstyled page has no low-contrast text to find, so it scores as perfect**. Identical shape to `check_invariants()` finding zero cross-currency violations over a universe missing the field it inspects (CLAUDE.md 14g), and to the four SEO tests that stayed green against an unreachable `robots.txt`. | Wait on a **sentinel that can only be true once the thing under test is live** (here: `.reading` computing to 17px, which nothing else sets), and fail loudly on timeout. Every negative assertion needs a positive one proving you are looking at the real thing. |
| Treating **"no red checks"** as "green" | A push on 2026-08-08 created **no workflow run at all** — GitHub never fired the `pull_request` event — so `gh pr checks` listed only the Vercel entries and looked fine, while the newest verdict on record was the PREVIOUS commit's failure. The absence of a failure is not a pass. | Check a run **exists for the SHA you are on**: `gh run list --json headSha,status` against `gh pr view --json headRefOid`. If none, force one with an empty commit. Then read the **count** out of the log, per the standing rule. |
| A success message that prints its **intent** instead of its **result** | `build-og-image.mjs` logged `opengraph-image.png 1200x630 …` as literal text, and cheerfully printed it while writing an **800×418** card during a deliberate break. The line that was supposed to be the evidence was the one thing not measured. | Read the value back **out of the artifact** and assert on it — the script now parses width/height from the PNG's IHDR and throws if they are wrong. Applies to any "done, and here is what I did" output. |
| Assuming an **undefined CSS custom property** falls back gracefully | It does not — an unresolvable `var()` makes the **whole declaration invalid**, so the browser discards it and uses its own default. `font-family: var(--font-sans), 'Sora', sans-serif` with `--font-sans` undefined does **not** fall back to Sora or to sans-serif: it yields **Times New Roman**. Cost an hour on 2026-08-07 when the generated design gallery rendered entirely in Times New Roman *while labelled Sora* — every word, colour and layout correct, only the typeface wrong, which is invisible unless you look for it. Root cause: `--font-sans`/`--font-mono` are declared inside `@theme inline`, **above** the `:root` block, so a `:root`-only extraction silently dropped them. The same shape would make `color: var(--text-white)` (documented but never defined — removed the same day) inherit its colour, i.e. plausibly **navy text on a navy button: invisible**, reading as a rendering glitch rather than a typo. | Never judge fonts or colours by eye — **assert**: `document.fonts.check("16px Sora")` for typefaces, `getComputedStyle(el).color` for colours. When copying tokens out of `globals.css`, emit them from the **parsed map you already built** rather than slicing text, so the stylesheet and its consumers cannot disagree (11c iii). And grep before documenting a token: `docs/design-system.md` listed `--text-white` for months while `var(--text-white)` appeared in **zero** files. |
| A guard threshold you **guessed** rather than derived | `build-design-system.mjs` shipped with `if (T.size < 50) fail` as a sanity floor. `globals.css` has exactly **47** tokens, so the guard failed on a completely correct parse — and the instinct in that moment is to lower the number until it passes, which leaves a floor that means nothing. Same family as the `check-seo` 177-vs-178 file count and the "14 checks" total that drifted. | Assert **by name**, not by magnitude: the six tokens that cannot legitimately vanish (`--brand-deep`, `--brand-mid`, `--brand-bright`, `--font-sans`, `--font-mono`, `--radius`) — including the two that had actually gone missing. Keep a magnitude floor only as a *secondary* signal, set below the real value and with the real value written next to it. |
| A guard that checks a constant is **declared** rather than **used** | `check:entitlement-gates` asserted the report route still contained `'Cache-Control': 'private, no-store'` anywhere in the file. Adding a new response branch (the 503, 2026-08-07) would have shipped **without** the header and the guard would have stayed green — the same hole that let `/api/portal` and `/api/checkout` send no `Cache-Control` at all. | **Count, don't find.** The number of responses carrying the header must **equal** the number of responses. Then break it three ways, including one break that must stay GREEN (the `{ ...NO_STORE }` spread form) so you know the counter isn't simply over-matching. |

---

## 13. Required CI Checks (Must Pass Before Merge)

*This list is checked against `.github/workflows/ci.yml` — if they disagree, the
workflow is right and this list is stale.* (It was: until 2026-08-06 item 3 read
`pnpm test — all Vitest tests pass`, and there is no `test` script and no Vitest
in the project. **Playwright is now the only TypeScript test runner by owner
decision — see § 8.**)

1. `pnpm typecheck` — zero TS errors
2. `pnpm lint` — zero ESLint errors
3. `pnpm build` — Next.js production build succeeds (runs `build:report-bundle` first
   via the `build` script, so the offline bundle is always rebuilt with the site)
5. `ruff check analytics/` + `(cd web && ruff check _engine/ api/)` — zero Python lint errors
6. `mypy analytics/` + `(cd web && mypy _engine/ api/)` — zero type errors (`--ignore-missing-imports --explicit-package-bases`)
7. `pytest analytics/` — all Python tests pass
8. `_engine` drift check — `web/_engine/<file>.py` matches `analytics/<file>.py` modulo the `from analytics.` → `from _engine.` rewrite

9. `pnpm check:entitlement-gates` — credential-free paywall tripwires (§ CLAUDE.md 11a/11b).
   **The script derives and prints its own count** — cite sections by NAME, never by number
   (CLAUDE.md 11a records what happened when a hardcoded total drifted).
10. `pnpm check:report-sections` — the downloadable report matches the 22-section detail page
11. `pnpm check:data-integrity` — unpaginated reads of growing tables (§ 14c), statement
    figures labelled with the price currency (§ 14d), and the P/E chart's currency gate
    (§ 14e-2). **It prints its own count and a per-root file floor** — its first version
    reported OK while silently covering a third less code.
    ⚠️ The count used to be restated here as "55 checks" and had drifted to 60 by
    2026-08-22. A number in prose is a copy of a number in code (CLAUDE.md 11c-v), and this
    is the one section of the docs that tells you to read counts off the run. **Read it off
    the run.**
12. `pnpm check:seo` — the `PUBLIC_PAGES` registry and its four consumers, one
    `SITE_ORIGIN` (the literal was in **five** files and one disagreed), the indexable set
    pinned **by name** (deriving it from the same list made the test unfalsifiable), and the
    `Disallow`-vs-`noindex` contradiction. It prints its own totals — pages, indexable pages
    and TS files scanned. CI's file count is one lower than a local run, because
    `dev-fixtures` is gitignored.
14. `pnpm check:render-modes` — reads `.next/server/app/*.html`, the files Next actually
    emits, and asserts **both** columns: which routes are prerendered and which must never
    be. A missing static page and an extra one fail in opposite directions, and the extra
    one is the security case (§ CLAUDE.md 11s). Runs after `pnpm build`, because it guards
    the artifact rather than the source. ⚠️ Since 2026-08-23 it also carries the **CSP
    nonce invariant**, which is the one that would take the site down rather than slow it:
    a prerendered page's HTML was written at build time and carries no nonce, so a nonce
    policy refuses every script in it and the page renders and then does nothing (measured:
    14 violations on a deliberately mis-listed `/terms`). It imports `usesNonce` from
    `lib/csp.ts` rather than restating the list, and checks both directions — the reverse
    error, a per-request page silently shipping the weaker `'unsafe-inline'` policy, breaks
    nothing and so would never be noticed (14g).
15. `pnpm check:csp` — the production half, and a **script rather than a spec** for the
    same reason as `check:page-weight`: e2e boots `next dev`, where the policy deliberately
    allows `'unsafe-eval'` for Turbopack's hot reloading. Needs `pnpm start:fresh --port
    3200` and a real session. Across 12 routes it asserts the header is enforcing (never
    `Report-Only`), the right form per route, that the nonce reaches **every inline script**
    in the document, that it changes between two requests, that `'unsafe-eval'` never
    appears, and that a real browser reports **zero** `securitypolicyviolation` events —
    the last being the only one that answers "does the site still work". It counts inline
    scripts so a page that failed to load cannot pass by being empty.
13. Playwright e2e — *(no count here on purpose. It has read 121, 332 and 335, each stale
    within days, in the very section that tells you to read the count off the run. A doc
    figure is not a measurement.)* Includes the paywall behavioural matrix, the Stripe
    **key-scope** probe (`e2e/stripe-key-scope.spec.ts`),
    **`e2e/report-download.spec.ts`**, which downloads the real offline report and opens it
    over `file://` (§ CLAUDE.md 11d), and **`e2e/export-parity.spec.ts`**, which pins the
    `.csv` and the `.xlsx` of one screener run to the same figures *and* to the screen's
    (they disagreed by a cent until 2026-08-06). The key-scope probe is the one Stripe test that reaches
    the network: it asserts the key CI/dev is handed is a restricted `rk_`, that a permitted
    call (`prices.list`) succeeds, and that `customers.list` is refused with
    `StripePermissionError` specifically. Nothing else in the suite can tell a full key from
    a scoped one. Also **`e2e/seo.spec.ts`** (27 tests — robots/sitemap/canonical/`noindex`
    asserted on the real rendered response, signed out) and **`e2e/stock-read-errors.spec.ts`**
    (7 — a failed database read must throw, never masquerade as "not found"; § CLAUDE.md 11e),
    both credential-free and therefore unskippable. Added 2026-08-22:
    **`e2e/a11y.spec.ts`** (axe-core inside Playwright — never a second runner — over every
    public page and all twelve articles), **`e2e/app-a11y.spec.ts`** and
    **`e2e/app-contrast.spec.ts`** (the same two instruments over the SIGNED-IN product,
    which had no accessibility evidence of any kind until 2026-08-22 — these need
    credentials and can therefore skip, which is why they are separate files from the
    credential-free public pair), and the meta-description bounds inside `seo.spec.ts`,
    asserted on the rendered tag because three different routes produce it.

    ⚠️ **The exemptions those files carried are gone.** `[data-legacy-contrast]` and
    `KNOWN_DEFERRED` were both retired on 2026-08-22 when the rating palette and the ink
    layer paid the debts they excused; `KNOWN_DEFERRED` is now an empty array and the
    marker no longer exists in any markup. One carve-out remains and it is a WCAG rule
    rather than a debt: `.verdict-watermark`, exempt under 1.4.3 as a brand logotype,
    matched on opacity as well as colour and bounded to exactly one element.

> ⚠️ **Check the COUNT, not the colour.** A suite that silently skipped is also green — which
> is why the numbers above are worth reading off the run rather than trusting the badge.

CI is configured in `.github/workflows/ci.yml`. Bypassing CI to merge is forbidden.

> 🔴 **CI runs ONLY on pushes and PRs to `main`.** A long-lived feature branch therefore
> gets **no CI at all** until a PR is opened. F3 ran 98 commits that way, and opening the PR
> on merge day (2026-08-01) turned it red **twice**, on two things no local run could catch:
>
> 1. **An unpinned linter changed under us.** `analytics/` had its own ruff config; `web/`
>    had none, so `web/_engine/` and `web/api/` ran on ruff's *defaults*. CI installs
>    `ruff>=0.4.0`, and 0.16.1 promoted `UP045` into its defaults — so the build broke on
>    code nobody had touched, in a file whose `analytics/` twin passed the same step seconds
>    earlier. Fixed by adding `web/ruff.toml` mirroring `analytics/pyproject.toml`.
>    **Keep the two lint configs in step; the drift check only guarantees the CODE matches,
>    not the rules it is judged by.**
> 2. **The E2E job had no Python.** Its server is `next dev`, which computes a cycle by
>    *spawning* `web/api/cycle.py`. With no interpreter the spawn failed **silently**,
>    because `fetchCycleAnalysis` degrades to `null` by design — so the page returned 200
>    with every cycle section simply missing. Fixed with `setup-python` +
>    `pip install -r requirements.txt`.
>
> 3. **The E2E job never built the offline report bundle** (2026-08-05). `public/report-bundle/`
>    is produced by `prebuild`, which only runs for `pnpm build`; this job serves `next dev`.
>    So `report.js` did not exist, "Download Report" fetched a 404, and no download ever
>    fired — a new spec that passed locally failed twice in CI with an inscrutable two-minute
>    `waiting for event "download"` timeout. It passed on my machine only because I had run
>    `build:report-bundle` by hand.
>
>    **This is also the answer to why a blank downloaded report survived four days in
>    production: the download had never been exercised in CI at all.** Fixed with an explicit
>    build step, plus the spec asserting both bundle assets return 200 *before* it clicks — so
>    a missing bundle now fails in seconds naming itself instead of timing out.
>
> **Open a PR early on any branch that will run long.** All three failures were environmental,
> so a green local run said nothing about them — and #2 and #3 show the recurring hazard:
> *graceful degradation converts a configuration fault into an empty page.*

---

## 14. Verification Commands (Self-Check Before "Done")

Every task ends with the relevant command(s) and shown output:

| Task touched | Run | Expect |
|---|---|---|
| Any TS/React code | `pnpm typecheck && pnpm lint` | exit 0, no output |
| New TS test | `pnpm e2e` — Playwright is the **only** TS runner (§ 8, owner decision) | all pass, **and the count went UP** |
| Any Python code | `ruff check analytics/ && (cd web && ruff check _engine/ api/) && mypy analytics/ --ignore-missing-imports --explicit-package-bases && (cd web && mypy _engine/ api/ --ignore-missing-imports --explicit-package-bases)` | exit 0 |
| Edit to cycle math / scoring | Mirror the edit in `web/_engine/<same_file>.py` (replace `from analytics.` with `from _engine.`); run the drift check from `.github/workflows/ci.yml` locally | drift check exits 0 |
| Cycle math change | `pytest analytics/tests/test_major_cycle.py -v` | all pass |
| New API route | `pnpm build` then test in Vercel preview | route returns expected shape |
| UI change | Screenshot before/after | matches the DECISION recorded in `design-system.md` — not the mock-up (CLAUDE.md #1, changed 2026-08-22) |
| Schema change | Apply migration locally + run app | no broken queries |
| Public-page markup, CSS or a new page | `pnpm e2e e2e/a11y.spec.ts` | **0** axe violations — there are no public exemptions left |
| Signed-in markup, CSS or a colour | `pnpm e2e e2e/app-a11y.spec.ts e2e/app-contrast.spec.ts` | 0 violations; the ONE logotype carve-out stays at exactly 1 |
| Any rating or direction colour | `pnpm check:tier-palette` | two copies in step · all five tiers legible both ways · every adjacent pair still tellable apart · the ink layer in step |
| Anything that could change page weight | `pnpm lighthouse` (needs `next start` on **:3200**) | public pages 100; ticker page not below its recorded median |
| `proxy.ts`, `lib/csp.ts`, or anything that adds a script/style/font/API origin | `pnpm check:csp` (needs `pnpm start:fresh --port 3200`) + `pnpm check:render-modes` | 12 routes, zero violations; the nonce and prerendered sets do not overlap |

⚠️ **`pnpm lighthouse` refuses to run against `:3000`.** A dev-server score is meaningless —
unminified bundles, no prerender, a compile inside the first request — and the number looks
just as authoritative. It takes the **median of 3** runs because the same unchanged page
scored 85, 81, 76, 63 and 62 on five consecutive runs here, and it prints the URL it LANDED
on beside every row so a redirect can never pass for a measurement.

Never report "done" without showing the relevant verification output.

### ⚠️ Read the exit code, and make sure the harness is testing YOUR code

Three ways a green (or red) result has lied in this repo, all found in one session:

1. **`pnpm check:foo | tail -2` reports `tail`'s exit code, not the check's.** A `&&`
   chain after it continues happily over a failing guard. I committed a red guard this
   way. Run the command bare, or capture `$?` before piping.
2. **A reused dev server answers from stale code.** `playwright.config.ts` had
   `reuseExistingServer: !process.env.CI`, so a local run attached to whatever held
   port 3100 — including a server started from a *different branch*. One report test
   failed 8 of 8 against a reused server and passed 4 of 4 once it was killed, and a
   "control" run on an older commit was silently served by the new branch's code, so
   it measured nothing. **Now `reuseExistingServer: false`.** Never conclude "this
   flake predates my change" from a run that reused a server.
3. **A red run is not automatically red for your reason.** A new guard failed on the
   *comment* that documented it, and a second matched `dis**allow**` while looking for
   `allow`. Always read the failure message before believing the diagnosis — and when
   a guard fires, confirm it fired for the thing you meant.

Related, same family: a substring is not a token (`xdescription` contains
`description`), and an assertion about what a file does *not* contain is vacuously
true when the file is empty or unreachable — prove it arrived first.

**4. A CSS-only edit can be served STALE on the first run after it — which breaks the
break-it-on-purpose habit itself.** Found 2026-08-13 building the legal-page rail. I
deleted the rule I believed made the rail stick, re-ran the guard, and it passed. The
honest conclusion would have been "my guard is useless"; the true one was that `next dev`
served the previous CSS from `.next/cache` even though `reuseExistingServer: false` had
booted a brand-new server process. The *second* run compiled the change and the guard
failed correctly (`Expected <= 2, Received 500`).

⚠️ The damage is specific and nasty: this is the one failure mode that makes a **working**
guard look broken, so the instinct it provokes is to weaken or delete the test. **When a
deliberate break stays green, re-run before you conclude anything** — and if the second
run still passes, print what the browser actually computed (`getComputedStyle`,
`getBoundingClientRect`) before touching the assertion. Doing that is what separated the
stale cache from the two real findings below.

**5. An assertion bounded on ONE side passes in the direction you never imagined.** The
same rail guard asserted `expect(railTop).toBeLessThanOrEqual(90)` — the rail should sit
just under the 58px header. When genuinely unstuck it measured **−317**: scrolled clean
off the top of the viewport, and comfortably ≤ 90. It sailed through. A single bound tests
that the value is not too *large*, which was never how it could fail. Bound both sides, or
assert the value, whenever "wrong" can mean "far away in either direction".

**6. A FLAKY test is a finding. Trace the behaviour before you re-run it.** Same session,
and it produced the only user-facing defect of the day. One rail test reported *flaky* —
passed on retry, which is the most ignorable result a suite can give. Instead of re-running,
I drove all eight clause links and printed what each one did:

```
click #payment-and-refunds     → marked #payment-and-refunds     top=78
click #acceptable-use          → marked #contact                 top=131   ← wrong
click #limitation-of-liability → marked #contact                 top=335   ← wrong
click #changes-and-termination → marked #contact                 top=482   ← wrong
```

Clicking any of clauses 05–08 highlighted **"Contact"**. The cause was two changes meeting:
the type had just been re-set 17px → 13px, which made the document short enough that those
clauses sit where no scrolling reaches the scroll-spy's offset line, so its bottom-of-page
rule won. **Nothing about the spy changed; the page got shorter.**

Two habits from it. **A "flaky" result on a test you wrote this session is far more likely
to be your defect than the harness's** — the retry is hiding a real state, not a race. And
**a type-size change is a layout change**: expect second-order effects in anything that
measures the page, including shared code several files away.

⚠️ The fix was an **opt-in** option on the shared hook (`keepClickedAtPageEnd`), not a
change to its default, so the two existing callers — the Stock Detail subnav and the
offline report, both paid surfaces — stayed byte-identical. When a shared utility is wrong
for a *new* caller, widen it for that caller rather than re-tuning it for everyone.

**7. Replacing a hand-typed value with a token? Check whether the value was RESPONSIVE
first.** Deduplicating the public type scale meant pointing `AuthCard` at `--pub-title`
(24px) instead of its own literal. Its literal was `text-[22px] sm:text-[24px]` — **two**
values, not one. A straight swap would have grown every form title on a phone by 2px:
invisible in review, unreported by any user, and watched by nothing. Hence
`--pub-title-sm`, and hence a test that measures the phone breakpoint specifically. When
that test was broken on purpose by deleting the step, the title fell to **14px** — a far
worse outcome than the 2px the refactor would have caused, and a good illustration of how
much a single missing class can move.

**7b. "Local green" and "CI green" are different claims — reconcile the COUNT, not the
colour.** The commit that introduced the character-count guard came back **success** on
CI, and I very nearly reported it as such. Local said **277 passed**; CI said **275
passed**. Two apart, on a run whose conclusion was green.

The reconciliation is `275 passed + 2 flaky = 277` — Playwright reports a retried pass on
its own line, and I had grepped only the last line matching `passed`. **Read the whole
summary block.** The two flaky tests were the ones added that same hour.

⚠️ Diffing the CI log's test titles against `playwright test --list` is the reliable check:
it distinguishes *skipped* (a title missing from CI) from *retried* (a title appearing
twice, once with `(retry #1)`). Worth knowing that the first attempt at that diff produced
**zero matches** because CI prints `e2e/legal-doc.spec.ts` and Windows prints
`e2e\legal-doc.spec.ts` — a zero-row diff is not "no differences", it is a broken query,
and the difference between those two readings is the entire finding.

**Why it was flaky, and it is a general trap.** The count came back **430** — the whole
paragraph on one line, meaning the wrap search never found a wrap. The precondition was
`ready()`, which polls until the article computes 13px. That proves the *stylesheet*
applied and nothing at all about the two things a character count actually depends on:
that the column has taken its width, and that the real webfont is rendering rather than a
fallback with different metrics. Local (8 cores, warm `.next`) never hit the window; CI (2
cores, cold compile) hit it twice. **A precondition must cover everything the measurement
depends on, not merely something that correlates with readiness.**

Also: report the CAUSE alongside the symptom. `"runs 430 characters per line"` sent me
hunting a column-width bug; `"430 chars in a 2000px column"`, or better an explicit *"the
paragraph never wrapped"*, is unambiguous. Both are in the assertion messages now.

**8. A measurement in the wrong UNIT is not a measurement.** The legal column was guarded
as `width <= 680px` and passed while running **91 characters per line**, because the type
had shrunk underneath it and nothing about the width had changed. Pixels were never the
requirement; the readable band (45–75 characters) was. The guard now walks a DOM Range
along a real paragraph to find where it wraps, and bounds it on **both** sides — an
over-narrow column that breaks every few words satisfies a one-sided bound and is just as
unreadable. **Assert the thing the reader experiences, in the unit they experience it in.**

**9. Reveal-on-scroll: the SERVER renders the final state, and JavaScript arms the initial
one.** The instinct is the other way round — hide it in CSS, add a class in JS to reveal —
and that instinct costs you the whole page when JS never runs. A hydration error, a
blocked bundle, a reader with scripting off: all of them get a blank marketing page, with
no console error on the server and nothing red anywhere. The landing page's three motion
moments are therefore scoped behind a flag the client sets:

```css
.lp .ruler-fill                       { width: var(--w, 0); }   /* the truth */
.lp[data-motion] .ruler-fill:not(.in) { width: 0; }             /* armed, only if JS ran */
```

`LandingMotion.tsx` sets `data-motion` and thereafter **only ever adds** `.in` — never
removes it, so nothing can re-hide on scroll-up. `e2e/landing.spec.ts` asserts the contract
two ways: the **server payload** carries every section and no `data-motion`, and in the
browser, **stripping the flag** leaves every section at `opacity: 1; transform: none`.

⚠️ **Three things went wrong writing that guard, and each is the general lesson.**

**(a) `toBeVisible()` cannot see `opacity: 0`.** Playwright checks the bounding box plus
`visibility`/`display` and nothing else. Unscoping the armed rule on purpose hid all eight
sections behind `opacity: 0` and eight `toBeVisible()` assertions stayed **green, twice**.
The armed state *is* opacity and transform, so that is what has to be read out of
`getComputedStyle`. **Assert the property the defect actually moves.**

**(b) Stripping a class starts a TRANSITION, it does not arrive at a state.** Sections
below the fold have not been revealed, so removing the flag sets them animating toward the
final values. Measured immediately they return whatever the animation is passing through —
which is why the deliberate break first reported `opacity 0.0155657` rather than a clean
`0`, and why the test passed alone and failed in a full run. The fix is to inject
`transition: none !important` **before** mutating, because the assertion is about the
static end state. **A mid-animation reading is not a measurement**, and a test you wrote
this session going flaky is your defect long before it is the harness's (§14 item 3).

**(c) The first version used `javaScriptEnabled: false` — and it failed for an unrelated
reason that turned out to be a real finding.** See item 11 below.

⚠️ **And publish an animated value as a CUSTOM PROPERTY, never an inline `style`.** The
fills first shipped as `style={{ width: '61%' }}`. An inline style is (1,0,0,0) and
out-specifies any class rule, so the armed `width: 0` silently lost and each bar animated
from its final value to its final value — indistinguishable from "the animation was never
wired up", which is exactly how I read it. Moving the number to `--w` gives the stylesheet
the property back. **When an animation appears to be missing, suspect a specificity loss
before a missing listener**, and confirm with `getComputedStyle` rather than by reading the
rule you meant to write.

**10. An undefined CSS class is silence, not an error — so "the markup says `.card-note`"
is not evidence that `.card-note` exists.** Every provenance line on the rebuilt landing
page asked for a class `globals.css` had never defined. Each one inherited its parent's
15px full-strength ink and read as a second title instead of a footnote. Nothing errored,
nothing looked broken, and the page was perfectly plausible. It surfaced only from diffing
**computed** styles against the design-system artifact element by element.

This is the CSS instance of a shape this repo keeps meeting (11c iv, 11j): **the defect is
an omission, and omissions render fine.** Two habits follow. When you add a class name to
markup, grep the stylesheet for its definition in the same edit. And when comparing a build
against an approved design, compare `getComputedStyle` output, not source — the source is
what you *meant*, and the bug lives in the gap.

**11. ⚠️ OPEN FINDING (2026-08-15) — four public pages render only "Loading…" with
JavaScript disabled.** Found while trying to write the no-JS control in item 9, which
failed and sent me looking for a motion bug that did not exist.

**What was measured**, on a **production** build (`pnpm build` + `next start`), Chromium
with `javaScriptEnabled: false`, deterministic over three runs:

| Page | Server HTML | Without JS |
|---|---|---|
| `/` | 108 KB | **"Loading…" forever** |
| `/terms` | 46 KB | **"Loading…" forever** |
| `/privacy` | ~42 KB | **"Loading…" forever** |
| `/disclaimer` | 42 KB | **"Loading…" forever** |
| `/login`, `/signup`, `/pricing`, `/contact` | 25–29 KB | renders normally |

**The mechanism** (⚠️ **fixed 2026-08-18 — the file was deleted; see item 20 and `architecture.md` §7.2**). `app/loading.tsx` *used to* put a Suspense boundary around **every** route. When
a page's HTML overruns React's first flush, the shell ships the fallback inline
(`<!--$?--><template id="B:0">`) and the real content streams afterwards into a
`<div hidden>`, which an inline `$RC(…)` script swaps into place. No script, no swap. The
content **is** in the bytes — it is simply never unhidden. The split falls on page size,
not on anything about the pages themselves, which is why it hits the landing page and the
three legal documents and spares the four smaller auth cards.

**Why it was recorded rather than fixed at the time:** it is a platform-level consequence
of our own root loading boundary, it affects every large page equally, and the remedy was
an architectural choice that belonged to the owner. ⚠️ **The option named here — “scope
`loading.tsx` to the `(app)` group” — is exactly what was done, and it turned out to be
half a fix.** Scoping the boundary to `(app)` cured the public site and left the *same*
soft-404 inside the signed-in product for five days: an unknown ticker measured **200** on
the production build until 2026-08-23 (audit F-011). The lesson is not that the choice was
wrong, it is that **a fix expressed as “move the boundary” needs asking what is now under
the boundary in its new position.** Today only one `loading.tsx` remains, and the check
that decides a 404 sits in a *layout* above it — see `architecture.md` §7.2. **Severity is genuinely low** — Googlebot executes JavaScript, so indexing is
unaffected, and the raw markup is present for any crawler that reads bytes. It matters for
readers with scripting blocked and as a robustness floor.

⚠️ **The general lesson is about the instrument, not the bug.** A no-JS assertion on the
landing page would have gone red forever while pointing at the motion system — a guard
that fails for a true reason and names the wrong culprit is worse than no guard, because
the next person weakens the innocent code. When a new test fails, **confirm the mechanism
before accepting the accusation**: comparing four page sizes against four others took
minutes and moved the finding from "the motion hides content" to "our root loading
boundary defers large pages."

---

### 15. "It didn't apply" was my eyes — and a cache that hides behind two doors (2026-08-16)

Scaling two `/learn` illustrations up to match the third, I told the owner the change "had
not applied", from **eyeballing a downscaled screenshot**. Wrong instrument, and it sent me
chasing the wrong thing for several rounds.

Measuring settled it in one command. The bounding box of non-background pixels was **77.9%
of the frame on disk and 60.8% in the browser**, and 60.8/77.9 is exactly **1/1.28** — the
scale factor I had applied. So the change was real and the browser was serving old bytes.

**Two causes, and the first is the one to remember.**

**(a) `rm -rf` on a path that has never existed reports success.** I cleared
`.next-dev/cache/images`. The dev image cache is at **`.next-dev/dev/cache/images`**
(production: `.next/cache/images`). Deleting nothing and deleting something are
indistinguishable at the shell — the same shape as CLAUDE.md 14g, one layer down. Every
cache clear in this repo now **counts the files before and after and asserts the directory
is gone**, because "the command succeeded" is not evidence.

**(b) Next's image optimiser keys its cache on the `Accept` header.** curl asks for and
receives **PNG**; a browser receives **WebP** from a *separate* cache entry. So a hand check
with curl can return the new image while every real viewer still gets the old one —
`X-Nextjs-Cache: HIT`, `Content-Type: image/webp`. **Verifying an optimised image with curl
verifies a variant nobody looks at.** Ask the browser what it loaded, or fetch with the
browser's own `Accept`.

⚠️ **And a third, which cost the owner a confused message rather than me a wrong report:**
`:3000` (`next dev`) recompiles on save; **`:3200` (`next start`) serves a compiled snapshot
and never updates itself.** The owner looked at `localhost:3200/learn`, saw none of the
day's work, and reasonably asked why. Nothing was broken — the build was from the previous
night. **Neither the page nor the URL tells you which you are looking at**, so say which
server a result came from whenever both are running.

⚠️ **The ordering trap that caught me twice after I knew all of the above:** clearing the
cache while the server is *running* achieves nothing, because it re-persists from memory —
and `preview_start` answered `reused: true` and started nothing, so a "restart" wasn't one.
Order: **kill the process → confirm the port is free → delete → confirm the directory is
gone → start.** A delete is not a state; the state is what the next request returns.

---

### 14. A rule welded to the wrong class — the fourth type scale (2026-08-15)

The owner said the Learn pages "looked inconsistent". Measuring the built pages at 1280px
turned a vague feeling into a structural defect: `/learn` was running **36/26/20** while
every other non-landing public page ran **24/17/13**. A 50% jump in heading size crossing
one link.

**Nobody had written anything wrong.** `.reading` is the correct default for a long page.
The legal documents had opted out of it — but through `.reading .legal-layout`, and
`.legal-layout` is the class that builds the contents-rail **grid**. So the scale was only
available to a document that also wanted a two-column rail. The Learn pages wanted the
scale and not the grid, so they got neither and fell back to the default.

**The generalisable rule: a shared decision must not be reachable only through an
unrelated class.** If the scale is a decision about documents, it is a class about
documents — `.doc-scale` — and the layout is a separate one. This is CLAUDE.md 11c-iv
(*"the rule existed and one of its consumers never received it"*) in CSS rather than in a
component: extracting the constant is half the job, and the other half is that every
consumer can actually reach it.

⚠️ **Three second-order findings fell out of the same measurement**, all invisible to
review: two values below the 12px reading-page floor (`contrast.spec.ts` enforces it, so
they were build failures waiting to happen, not merely small), and a descriptive sentence
sitting exactly ON the floor because `.small` maps to `--pub-label` inside the document
scale — correct for a date stamp, wrong for a sentence somebody reads to make a decision.

⚠️ **And it reversed an earlier decision of mine**, which had argued from first principles
that an article is read while a legal page is scanned, so it deserved the larger scale. The
argument was fine and the outcome was a fourth scale. **When a local decision is defensible
on its own terms, check what it does to the set** — the question is never "is 17px right
for an article?", it is "how many scales does the site have after this?"

---

### 13. Building `/learn`: five deliberate breaks, two of which broke the guards (2026-08-15)

Every new rule in `check-seo.mjs` was broken on purpose before being trusted. Three
caught it. **Two did not**, and both failed the same way this file keeps recording:

**(a) The guard matched the line somebody had just commented out.** The rule requiring
`PUBLIC_PAGES` to spread the Learn registry was tested by commenting the spread with
`//` — which is exactly how a person disables it — and `check:seo` reported **OK**.
Meanwhile the app threw at request time, so the thing the check exists to catch *early*
was caught late by something else.

**(b) The guard matched its own documentation.** The rule requiring the dynamic article
route to call `notFound()` passed with **every real call deleted**, because the route's
doc comment explains that an unknown slug must call `notFound()`.

Both fixed by stripping comments first, which is now a shared `stripComments()` helper
in that file. That makes **five** instances of this class recorded here (`allow: '/'`
tripping on its own comment · `xdescription` containing `description` · an unused import
satisfying `PUBLIC_PAGES` · the two above). The rule has earned a one-line form:
**a guard that reads a file as text is testing the prose unless you strip it first.**

**(c) A missing space that only the DOM could see.** The article body interleaves prose
with `{…}` figures, and one rendered as **"81.4%is not a company"** — while the source
unambiguously contained a space, confirmed with `od -c` before anything was changed. JSX
drops whitespace between an expression and following text in some arrangements, and the
*identical* construction two lines above survived, so it is arrangement-sensitive and
reading the source proves nothing. Fixed with an explicit `{' '}` and guarded by a scan
for digit-against-letter run-ons in `e2e/learn.spec.ts`.

⚠️ **And that guard's first version was wrong in the instrument, not the page**: it read
`textContent`, which concatenates block elements with no separator, so the date line ran
into the answer — "…15 August 2026A drawdown is…" — and it reported three run-ons no
reader could ever see. `innerText` inserts the breaks layout actually produces. Same
lesson as §14 item 12(c): **the assertion was right and the selector was pointing at the
wrong thing.**

**(d) Reconciling a test count across a `git stash` — a trap worth naming.** The suite
went 314 → 328 passed, which looked like +14 against an expected +15. The missing test
was not missing: Playwright prints **flaky** on its own line (328 + 1 flaky = 329), and
the "before" baseline taken with `git stash` was wrong in the other direction because
**`git stash` without `-u` leaves untracked files in place** — the new spec was still
present in the "before" listing. Diffing test *titles* showed nothing removed, which is
the check that actually matters. Both halves of the arithmetic were wrong and they
nearly cancelled.

---

### 12. Three ways a guard lied, all found in one sitting (2026-08-15, applying the legal audit)

Adding prose to `/terms` and `/privacy` should have been the least eventful change of the
layer. It broke three things, none of them the pages, and each is a different failure mode
worth naming. The common thread: **every one of them was found by running something, and
none of them by reading it.**

**(a) An `import` in an e2e spec took down the ENTIRE suite — while typecheck and lint
stayed green.** The new guard needed `FREE_VIEW_DAILY_LIMIT`, so it did the obvious thing:

```ts
import { FREE_VIEW_DAILY_LIMIT } from '../lib/freeViews';   // ← do not do this
```

`freeViews.ts` starts with `import 'server-only'`, which resolves under Next and **not**
under plain Node, so Playwright died at collection with `Cannot find module 'server-only'`
and reported **zero** tests — not one failure, no run at all. `tsc` was perfectly happy,
because the types resolve fine. The specs in `web/e2e/` are required to be pure and
credential-free so they run on a fork PR with no secrets; **importing app code reaches
straight past that guarantee.** Read the constant out of its source file instead.

**(b) A deliberate break stayed GREEN because the pattern matched a SUBSTRING.** The
replacement read constants with `new RegExp(`${name} = (\\d+)`)`. Renaming
`GRACE_DAYS` → `DUNNING_GRACE_DAYS` — exactly the change the guard exists to catch —
passed, because `GRACE_DAYS = 3` is a substring of `DUNNING_GRACE_DAYS = 3`. In the same
codebase `ACCOUNT_DELETION_GRACE_DAYS` would have collided identically had it shared a
file. Fixed with a `(?<![A-Za-z0-9_])` lookbehind. **Any guard that matches an identifier
by name must anchor it, and the only way you find out is to rename the thing and watch.**

**(c) A guard failed on the new content, and the CONTENT was fine — the measurement had
started mid-line.** `legal-doc.spec.ts` counts characters on the first visual line of a
paragraph. Finding 2's clause opens with a bold lead-in:

```tsx
<p><strong>Where your information is stored.</strong> These providers host …</p>
```

The guard took the first text node over 60 characters — the run *after* the `</strong>`,
which begins **221px into the paragraph** — and counted to the wrap from there. It
reported `39 chars in a 494px column` and failed the lower bound. Per §14 item 4, the
computed geometry was printed before touching the assertion, and every paragraph that
genuinely starts at the left edge measured **72, 74, 76, 76**. Fixed by stating the
precondition the guard had left implicit — **a characters-per-line count is only valid
measured from the start of a line** — and checking it, rather than loosening the bound.
Then proven not to be a no-op: narrowing `--measure-doc` 560 → 280px took all three
documents red (24, 20, 24 chars in a 214px column).

⚠️ **And the observation that came free: the guard measures ONE paragraph per page and
stops.** Two paragraphs on `/privacy` sit at 76, one over the band, including one that
predates the change. It was never caught because the first qualifying paragraph measured
74 and the loop returned. **A check that samples one instance is silent about the rest,
not clean** (§14 item 8, CLAUDE.md 14g). Recorded as roadmap item GA-5 rather than fixed,
because the only remedies are the document measure or the type size — a design change
nobody asked for.

### 16. A test that has never failed is not a test — three in one afternoon (2026-08-16)

Regenerating the `/learn` illustrations, every claim the pictures make was checked with a
purpose-built probe. **Three of those probes were wrong**, and each was caught the same way:
by running it against a case whose answer was already known.

- **The seam detector scored image 1 — which has no seam — at Δ14.6.** It was measuring the
  vertical edges of skyline towers. Rewritten to sample only empty sky *above* the buildings,
  where a sharp vertical change can only be a seam. Image 1 then measured **0.25**, and the
  image under test **3.23**.
- **The teal-line check "confirmed" image 2's two falls were identical** — over a sample that
  included the pale blue hills, reporting teal 90% of the way down a frame whose lines live in
  the top third. A contaminated sample that yields a confident number is **worse than no
  number**: it looks like evidence. Tightened, then re-run against image 1 (one continuous
  curve, not two matched lines), which scored 87% different and failed as it should.
- **The dimension reader** was proven on four files of known size, including a square one, so
  it could be seen distinguishing sizes rather than echoing a constant — *before* being
  trusted on a paid 4K render where "asked for 4K, silently got 1K" is invisible.

⚠️ **The generalisation is about controls, not about images.** A probe you wrote five minutes
ago has never been observed failing, so a pass from it carries no information. Give it the
case that must fail — the picture with no seam, the image with one line, the file whose
dimensions you already know — and only then believe the case you care about.

⚠️ **And the same afternoon, an instrument disagreed with reality in the other direction.**
Checking the new images had reached the browser, `img.naturalWidth` reported `0` and
`loaded: false` for all three, while the network panel showed **200 OK** and a screenshot
showed them plainly on screen. The probe was reading elements mid-way through `srcset`
resolution. **Fetching the URL and decoding the bytes** gave the real answer (1600 × 1000,
187 KB). When two instruments disagree, the one that reads the artifact wins over the one
that asks the DOM how it feels.

### 17. Some assets cannot be regenerated — treat them like source, not output (2026-08-16)

The three `/learn` illustrations are generated images, and **generation is not reproducible**:
the same prompt returns a different picture — different skyline, different valley shapes, a
differently posed figure. That single fact changes three ordinary decisions:

- **Render at the maximum size you will ever want**, not the size you need today. 4K cost
  $0.24 against $0.13 for 2K. There is no going back for a bigger copy later, and no 8K
  exists anywhere on the Gateway to escape to.
- **Keep the master outside the shipped crop.** `reference/learn-masters/` is gitignored
  (~47 MB), carries the prompt that made each file, and has a README saying why deleting it
  is irreversible. The prompts document *intent*; they are not a recipe for recovery.
- **Fix flaws in the FILE, not by re-rolling.** Image 3's pale background sat 16–21 (RGB
  distance) from `--bg-page` and read as a panel on the page. A lightness-weighted shift of
  `(+16, +4, −3)` took it to 1 while leaving navy and teal byte-identical — asserted, by
  printing all three before and after. Re-rolling would have destroyed an approved
  composition to fix arithmetic.

⚠️ **A composition approved on a cheap model is not guaranteed by the expensive one.** Drafts
ran on Nano Banana 2 Lite ($0.034); finals on Pro ($0.24). Pro **reframed image 2** and ran
both price lines off the top edge — two teal pipes hanging from the sky, the fall invisible,
the picture's entire argument gone. It looked deliberate. Re-verify every measurement on the
final artifact; the draft settles the idea and nothing else. *(And check the uncropped master
before blaming your own crop — that was ruled out first, and it mattered, because the crop was
the more likely-looking culprit.)*

---

## 15. Previewing & Verifying Authenticated Pages Locally

Pages under `app/(app)/` are gated twice: the Edge middleware (`web/proxy.ts`) redirects an
unauthenticated request to `/login`, and pages that call `supabase.auth.getUser()` (e.g.
`/account`) additionally redirect if there's no session. So "just open it in the preview" doesn't
work for a logged-in page. Use the method that fits what you're verifying — in order of fidelity:

### A. `DEV_BYPASS_AUTH` — the simplest bypass, but **broken for the middleware on Next 16**

`web/proxy.ts` and `app/(app)/layout.tsx` both honour `DEV_BYPASS_AUTH=true` (guarded by
`NODE_ENV !== 'production'`, so it can never fire in prod). Historically you'd set it in
`web/.env.local`, run the dev server, and open the page.

- **⚠️ Gotcha (Next 16):** `proxy.ts` is the renamed **middleware**, which runs in the **Edge
  runtime**. Non-`NEXT_PUBLIC_` vars from `.env.local` are **not** exposed there — `process.env.DEV_BYPASS_AUTH`
  reads `undefined` in the middleware, so the gate still redirects (the Node-runtime layout *does*
  see it, but the middleware blocks first). Verified 2026-07-11. So this flag alone no longer lets
  you reach a gated page. It also only helps for pages that **don't** call `getUser()` (which still
  redirects with no session).
- **⚠️ The auto-mode safety classifier blocks writing `*_BYPASS_*` to `.env`** unless the user has
  explicitly asked to bypass auth — treat it as needing explicit owner sign-off.
- If you do change `proxy.ts` for a bypass, **revert it byte-for-byte** and confirm `git diff web/proxy.ts`
  is empty before finishing. Turbopack also inlines a stale middleware bundle — `rm -rf web/.next`
  to force a clean recompile after env changes.

### B. `/dev-fixtures` gallery — component states, no auth

`web/app/dev-fixtures/page.tsx` (gitignored, 404 in prod) renders components in isolation with mock
props — the right tool for eyeballing **null/edge states** and every variant of a component side by
side. It does **not** show the real page composition, real data, or the app shell.

### C. Session injection — render the **real** gated page in Claude preview (no auth weakened)

To see the actual route (real shell + real DB data) in the preview browser, give the browser a real
session instead of weakening any gate:

1. A throwaway Node script uses the app's own `@supabase/ssr` `createServerClient` with a
   cookie-recorder + `signInWithPassword({ E2E_EMAIL, E2E_PASSWORD })` (reads `.env.local`; the
   dedicated `e2e@majorcycle.com` test account) to capture the exact `sb-<ref>-auth-token`
   cookie(s) — same encoding/chunking the app uses.
2. Serve them to the browser via a **middleware-excluded path** — copy the captured cookies to
   `web/public/_mc-cookies.svg` (the `proxy.ts` matcher excludes `.svg$`, so it's fetchable without
   a session, and the token stays out of the transcript).
3. In the preview browser (already on the localhost origin), `fetch('/_mc-cookies.svg')` and set each
   cookie: `document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; SameSite=Lax'`
   (**must `encodeURIComponent`** — Next URL-encodes cookie values on the wire and base64 contains
   `+ / =`; `@supabase/ssr` cookies are not `httpOnly`, so `document.cookie` works). Then navigate to
   the page — real middleware + real `getUser()` accept it.
4. **Clean up:** delete the throwaway script, the cookies JSON, and `public/_mc-cookies.svg`.
5. **Gotchas:** the auto-mode classifier blocks minting/writing a live token to a file ("credential
   materialization") without explicit owner sign-off; after `signOut()` the access-token JWT stays
   valid for a short window then dies; a broad `preview_click` selector can hit the Sidebar **Sign
   out** button and end the session — click precisely.

#### C2. Magic-link variant — no password, a throwaway subscriber, works against **production**

Preferred over C when you need a *specific entitlement state* or are verifying the live site
(used throughout the 2026-08-05 data audit):

1. `admin.auth.admin.createUser()` a throwaway `@example.com` account, then upsert its
   `profiles` row with `subscription_status: 'active'` and `acknowledged_disclaimer_at`
   (skips the first-login modal). **Delete the user in a `finally`/`afterAll` — never flip the
   shared E2E login's subscription.**
2. `admin.auth.admin.generateLink({ type: 'magiclink' })`, then exchange
   `link.properties.hashed_token` via `supabase.auth.verifyOtp({ token_hash, type })` inside a
   `createServerClient` whose `setAll` records the cookies. That yields the **exact**
   `@supabase/ssr` cookie — no password typed, no cookie format guessed.
   ⚠️ The `token=` in the emailed URL is **not** the `token_hash`; using it returns
   `otp_expired`.
3. Inject with `document.cookie` on the target origin. ⚠️ The live origin is
   **`www.majorcycle.com`** (the apex 307s), so the cookie must be set there.

⚠️ **The Claude browser refuses to navigate to an external origin it hasn't been granted**
(a Supabase `/auth/v1/verify` URL fails), which is *why* the exchange happens server-side.
Node scripts must live in `web/` to resolve deps; use `node --env-file=.env.local`.

#### C3. Verifying a **downloaded artifact** (the offline report)

The downloaded `.html` is a *different product* from the route that feeds it (CLAUDE.md 11d),
so it has to be opened, not inspected.

- ⚠️ **Do not render it from a blob URL in an iframe.** A blob inherits the parent page's CSP,
  which blocks the file's inline `<script>` — the page is blank for a reason that has nothing
  to do with the bundle. An hour was lost to that false positive on 2026-08-05.
- ✅ Use Playwright: real download → `download.saveAs(file)` → `page.goto('file:///' + file)`.
  No CSP, exactly what the customer gets. Collect `pageerror` and assert it is empty.
- Assert the **outcome** — mounts, throws nothing, sections present, charts drawn — not the
  mechanism, so the test survives the next unrelated import breaking the bundle.

### D. Playwright — the **most robust + secure** way to verify authenticated interactions

For functional checks (a real DB write, form validation, gated flows), prefer the project's
Playwright suite (`web/e2e/`, run with `pnpm e2e`). It reads `E2E_EMAIL/E2E_PASSWORD` from
`.env.local` **itself** (you never handle the password), logs in through the real UI flow against a
real server with **middleware enforced** (`DEV_BYPASS_AUTH` unset), and can screenshot to the
gitignored `test-results/`. `e2e/account.spec.ts` is the reference example (real profile save +
persistence, password-guard checks). When asserting an error message, target the text
(`getByText`), not `getByRole('alert')` — Next's route-announcer also carries `role="alert"`.
**Never perform a *successful* password change against the shared test account** (it rotates
`E2E_PASSWORD` and breaks CI) — verify only the guard rails (mismatch, wrong current password).

### E. Sign in with the test account **in the Claude Browser preview** — to *watch* it live

Methods C and D render **nothing in the preview pane the owner is watching** — Playwright and session
injection both drive a *headless* browser, so a check done that way looks blank from the owner's side
(this is exactly why an F2 check appeared empty on 2026-07-11). For an **owner-visible** walkthrough of
a gated page:

1. `preview_start` the `web` dev server (opens the Browser pane at `localhost:3000`).
2. Navigate to `/login` and pre-fill the **email** with the test account (`e2e@majorcycle.com`) — an
   email is not a credential. **Claude cannot type the password** (a hard safety rule, even on a test
   account), so the **owner types the password once** in the preview and clicks Sign in.
3. The real session cookie now lives in the Browser pane, so Claude drives everything else (navigate,
   click, `form_input`, `read_page`, screenshots) on the real page with **middleware enforced** — no
   credential handling. Use the Supabase MCP (`execute_sql`) to confirm writes or to stage state (e.g. a
   temporary `subscription_status` to exercise the country-lock, reverted afterwards).

Use **E** to *show* a flow working live; use **D (Playwright)** for repeatable/CI functional assertions.
The single manual step (owner types the password) is unavoidable and by design.

**Browser-pane gotcha (seen 2026-07-12):** the Claude Browser pane can drift between screenshot-pixel
space and the accessibility-tree `ref` coordinates (and occasionally renders the whole page at a broken
micro-zoom), so `computer` clicks silently miss and screenshots mislead. When a click "does nothing,"
don't keep re-clicking — drive the element through `javascript_tool` instead: `el.click()`, then read the
resulting DOM in a **separate** call (React re-renders on the next tick, so a same-call check is stale).
Confirm the interaction really worked by asserting on DOM text/`getComputedStyle`, and cross-check with
Playwright (**D**), whose real `getByRole` clicks are authoritative. Prefer `read_page`/`find` refs and
`javascript_tool` state reads over pixel coordinates for anything the owner isn't watching in real time.

**🔴 `fetch()` cannot see a redirect that Next emits during streaming — test redirects by NAVIGATING.**
`redirect()` called from a **layout** (e.g. the `(app)` layout's deletion confinement) fires after the
response headers are already flushed, so Next cannot answer 307. It embeds the redirect in the RSC
payload for the **client router** to execute. `fetch()` never runs a client router, so it reports a
plain **200** — and the probe concludes the guard is missing. This nearly became a false "deletion
confinement is broken on production" finding (F-A6, 2026-08-02); a real navigation put every `(app)`
page on `/reactivate`, exactly as designed. **Fingerprint:** a 200 whose HTML has a correct `<title>`
but **no app shell and no headings** is a streamed redirect, not a rendered page. Route handlers
(`route.ts`) are unaffected — they answer with a real status, so `fetch` is the right tool there.

**A detector keyed to one variant of a UI reports the other variant as absent.** A lock-panel probe
searching for "See what's included" reported `/run` as *open* for a `billing_blocked` account — whose
lock panel deliberately shows **Contact support** instead, because offering a plan to someone whose
payment was disputed is an offer we refuse at the till. Assert the **state** (is the real feature
absent? is the pitch present?), never a single CTA string.

**Any claim of ABSENCE needs a positive control in the same read.** "Zero premium keys in the HTML" is
worthless if the read caught a loading state or the previous document. Assert `htmlLen` and a known
marker (the ticker symbol) **alongside** the zeros — a JS read fired immediately after `navigate` runs
against the *previous* page, and once returned an 8-character body that turned out to be `Loading…`.

---

## 16. Date & timezone display

**Decision (owner, 2026-07-15):** dates shown to a user are rendered in **their device
timezone** — never derived from `profiles.country`. Country is for **currency only**
(§8 of data-contracts). The device's OS timezone is the only signal for "where the user
actually is right now" (it normally auto-tracks location), and it's independent of the
account's stored country — a user who moves keeps a stale country but a correct device zone.

Store instants in **UTC** (Stripe timestamps, Postgres `timestamptz`); the instant is
absolute and unambiguous. Only the *display* is localised. Rules by surface:

- **On-screen (web).** Format on the **client**, in the device zone. A Server Component
  formats in the runtime zone (UTC on Vercel) → off-by-one near midnight, so use the
  `<LocalDate iso fallback />` client component (`web/components/LocalDate.tsx`): SSR emits
  the server-formatted `fallback`, and it reformats via
  `toLocaleDateString(undefined, …)` (device zone) on mount.
- **User-triggered emails** (the user clicked something, so a browser is present): capture
  `Intl.DateTimeFormat().resolvedOptions().timeZone` in the browser at action time and pass
  it to the server action / email, so the emailed date matches what the user just saw. See
  `DeleteAccountCard` → `requestAccountDeletion` → `sendDeletionScheduledEmail` (hidden
  `timeZone` field). `email/format.ts::formatDate(date, timeZone?)` takes the IANA zone
  directly and falls back to the runtime zone on an absent/invalid value.
- **System-triggered emails** (cron / Stripe webhook — **no** browser, so no device zone):
  prefer **relative phrasing** ("your trial ends in 2 days", "tomorrow") which sidesteps
  timezones entirely; if an exact calendar date is unavoidable, append an explicit zone
  label. Do **not** guess from country. (This is why the purge-cron "account deleted" email
  carries no date, and why F3 trial-reminder emails should count down in days.)

**Anti-pattern:** deriving a display timezone from `profiles.country` (a country-representative
zone is still a guess — the US/CA/AU each span several zones — and it conflates the
currency signal with the display signal). We tried it briefly on 2026-07-15 and replaced it.

### 18. When a measurement is wrong, instrument the MEASURING (2026-08-18)

The contrast probe scored text at **6.81** that a reader was seeing at **3.38** — it
composited a colour's own alpha and never `opacity`. Teaching it to see `opacity` then
broke it the other way: the landing's scroll-reveals rest at `opacity: 0`, so 244
elements were *correctly* skipped as invisible and the guard measured **47 of 291**.

**Three diagnoses were wrong first**, and each produced a plausible fix for a problem
that did not exist — a wait for the loading fallback, a wait for the element count to
settle, a wait for the animations. What settled it in one run was a **skip tally**:
counting *why* elements were dropped, rather than theorising about timing. The
contradiction that made it obvious was two numbers side by side —
`bodyEls=581` beside `measured=47`. The DOM was full.

- **When a measurement disagrees with the screen, the instrument is the suspect.** Add
  counters to the probe before adding waits to the harness.
- **A plateau is not a finish.** "Two consecutive equal readings" looks like settling
  and is not: a dev server serves a shell, pauses while it compiles, then streams, and
  two equal samples across that pause satisfy "stable" perfectly. Wait for a **positive**
  signal — ideally the one the assertion itself demands, so the two cannot disagree
  (`MIN_MEASURED` is now both the wait and the floor).
- **Reproduce the resting state deterministically rather than racing it.** The fix was
  to remove `data-motion` — the component's *own* no-JS path — after waiting for it to
  be set, because removing it on arrival simply lost the race against a mount effect
  (291 / 47 / 47 / 291 across four identical runs is the signature of a race, not of a
  page that renders differently).
- **A precondition can fail CLOSED and still be wrong.** `document.fonts.check()` with
  the computed `font-family` returns **false forever** — `next/font` renders it as
  `Sora, "Sora Fallback", Sora, sans-serif`, which is not a parseable font shorthand.
  Safe direction, wrong question. Probe the probe: full string false, first family true,
  `fonts.status` "loaded" throughout.

### 19. A sample of one is silent about the rest — and pick the right STATISTIC (2026-08-18)

The line-length guard measured the **first** qualifying paragraph per page and returned.
Widened to all of them it immediately found `/terms` running **81** characters —
worse than the `/privacy` 76 that was the only thing on record.

⚠️ **But the fix is not "assert the maximum".** Characters-per-line is not a property of
the column alone: a word-dense paragraph legitimately fits more. Asserting the max makes
the guard hostage to the unluckiest sentence, and the only way to satisfy it is to narrow
the column until the *typical* line falls below the readable band — making the page worse
to satisfy a statistic. So: **median ≤ 75** (the band describes a typical line) plus
**max ≤ 85** to catch a genuinely blown column. The original defect measured 91 (110
before), so both bounds still fail it, and no pixel of the approved design changed.

**Ask what the rule is actually about before choosing what to assert.**

### 20. A file can exist for a reason nobody wrote down (2026-08-18)

`app/loading.tsx` was deleted to fix a sitewide soft-404 and a no-JS failure. **The
deletion broke the build**, which is how its real job surfaced: `/login` and `/signup`
call `useSearchParams()`, and Next refuses to statically prerender a page that does —
that boundary had been satisfying the requirement **by accident, for the whole site**.
Reading the file could never have told you; only removing it did.

⚠️ **And the framework's documented fix was the wrong one here.** Next says wrap in
`<Suspense>`; a boundary renders its fallback on the server and fills in on the client,
so a no-JS visitor gets the fallback and never the form — on the two pages that must
work for everyone. `force-dynamic` was correct instead. **A documented fix is advice
about the common case; check it against your constraint before taking it.**

⚠️ **Postscript, 2026-08-23: the fix was incomplete for five days and nothing said so.**
Only the ROOT file went; `app/(app)/loading.tsx` stayed, so the identical soft-404 lived on
inside the signed-in product — an unknown ticker answered **200** on the production build.
It was found by the Layer G coverage map, which noticed the whole suite held **one**
assertion on a 404 status and it covered a Learn slug: *the route with no assertion on it
was the one still broken.* **When you fix a defect by deleting one instance of a pattern,
grep for the others in the same commit** (11c). Fixed by moving the existence check into
`stocks/[market]/[ticker]/layout.tsx` — a layout renders OUTSIDE the Suspense boundary its
sibling `loading.tsx` creates, so `notFound()` runs before a byte is sent and the skeleton
survives. ⚠️ Second-order trap found the same hour: **a layout's `notFound()` is caught by
the boundary ABOVE its segment**, so the route's own `not-found.tsx` stopped firing and
readers silently got the generic 404 instead of the friendly “Not in our coverage yet” page
with its Request button. Statuses green, experience worse; the e2e tests caught it.

### 21. A measurement can disprove your hypothesis backwards (2026-08-18)

Investigating a slow Stock Detail page, the theory was that the `get_price_bars_json`
RPC "fast path" was failing silently and every request was falling back. Measured on the
real database, four runs, AAPL = 11,510 bars:

    RPC                        1682-3317ms   error=none   fast path IS taken
    count + 12 parallel pages  1141-1454ms   same 11,510 rows

Not failing — and **~50% slower than the fallback it was written to replace.** The
justification in the code is that it avoids "~12 cross-region round-trips", but those
twelve run in **parallel** and finish in ~0.9s, while serialising 11,510 rows to one
jsonb takes ~1.7s.

**Not changed**, deliberately: it is a real trade-off (1 request vs 12, which may still
be right under rate limits), and flipping the data-loading strategy of every stock page
on one machine's numbers — from Australia, against a us-east-1 database — is not a
decision a measurement taken here can support. **Measuring hard enough to disprove your
own hypothesis is the win; shipping a change you cannot justify is not.**

---
### 22. A margin on a flex child may be the SECOND thing spacing it (2026-08-18)

The owner reported "a lot of space in the right hand side" of the header's Sign in and
Create free account buttons, and separately asked for a newly-added loading dot to be
removed. Measuring joined the two reports into one defect: the dot carried its own
`margin-left: 6px`, and `Button` is `display:flex` with `gap: 7px`. Both applied.

    Sign in              87px -> 105px
    Create free account 178px -> 196px

18px of dead space inside the one control the page most wants pressed, and it read as
a layout problem rather than as the dot's fault — which is why the owner filed it twice.

**Before giving a flex child a margin, ask what the container is already doing.**
`gap` and a child margin compose silently; nothing errors, and the number you get is
the sum of two decisions made in different files.

### 23. A verification pattern can be blind to the very thing it certifies (2026-08-18)

After removing that dot, the claim was "the header, footer and stylesheet are
byte-identical to before it existed", checked with:

    git diff <ref> -- <files> | grep -E "^[+-][^+-]"

Empty output, claim made. **The pattern cannot match a blank-line-only diff** — `^[+-]`
followed by `[^+-]` requires a character after the marker, and an added blank line is
just `+`. Two stray blank lines had in fact been left in `globals.css`, and they
survived a commit.

**For an identity claim use `git diff --quiet <ref> -- <file>` and read its exit code.**
A grep that filters diff lines decides for itself what counts as a difference — which
is precisely the judgement you were trying to avoid making. Same family as §18: the
instrument was the thing that was wrong.

### 24. Clearing the server's cache does not clear the client's (2026-08-18)

Swapping a Learn illustration, the server-side caches were cleared properly — counted
before, deleted, confirmed gone, server restarted (the discipline from §16). The page
still showed the **old** picture, and the numbers said so: sky blue-cast +13 where the
file on disk measured +20.

Diagnosed rather than re-cleared:

    fetch(url)                      -> blue cast +13   (the browser's HTTP cache)
    fetch(url, {cache: 'reload'})   -> blue cast +22   (what the server actually holds)

Next's own headers were fine — `max-age=14400, must-revalidate`, with an ETag that
changes with content, so real visitors pick up a changed image within four hours. The
stale copy was entirely client-side.

**When verifying that an asset changed, force the network** (`cache: 'reload'`), or you
are measuring your own browser's memory of the old file. And note the shape: three
different caches (Next's optimiser, the CDN, the browser) can each hold a stale copy,
and clearing one proves nothing about the other two.

### 25. Retrying is honest only when the failure had no ANSWER (2026-08-18)

One run in five, `POST /api/analyze-dev` died with `read ECONNRESET` — no status code,
just a dead socket, passing on retry. Three hypotheses were tested and **all three were
wrong**: an early middleware response that never drains the request body (22 B → 1 MB,
25 attempts each: zero resets), a keep-alive reuse race against Node's 5s
`keepAliveTimeout` (idle gaps 0–6s: zero), and something specific to `next dev` (60 more
requests: zero). It could not be reproduced in isolation.

So it was made survivable rather than explained — but only under a rule that keeps the
test honest: **retry a dropped CONNECTION, never an HTTP RESPONSE.** `transportRetry` in
`e2e/entitlement-routes.spec.ts` re-issues the request when the socket dies and hands
back any resolved response untouched, so a 500, or a 200 where 402 was due, still fails
its assertion exactly as before. Two drops in a row throw with both messages, because
that is no longer the known flake.

⚠️ **The distinction is the whole thing.** A retry that can absorb a wrong *answer*
turns a suite into scenery. The helper therefore carries four pure tests of its own —
including two controls proving an assertion failure is rethrown untouched and a
resolved 500 is passed straight through — because a leniency you cannot see the edges
of will be widened by the next person who meets a red build.

### 26. A deliberate break must be one the guard CAN see (2026-08-19)

This repo breaks a guard on purpose before trusting it. Building the drawdown article's
data-bound figure, I did exactly that — replaced `LANDING.currentDrawdownPct` with the
literal `-11.3` — and the guard **stayed green**. The tempting reading is "my guard is
useless", and the instinct that follows is to weaken or rewrite a test that was working.

The truth was that **the break was not a break.** `depth()` renders both `-11.332` and
`-11.3` as `"11.3%"`, so the page's output was genuinely identical. A guard comparing
rendered output to the snapshot cannot fail when the two agree. Re-breaking with `-22.2`
went red immediately, naming both values — so the guard was value-sensitive all along.

⚠️ **But the bad break exposed a real gap, which is why it was worth doing.** A
rendered-output guard catches a typed number only *after* the data moves — a day late. So
it now has a **source-level partner** that reads `DrawdownFigures.tsx` with comments
stripped and fails on any `pct:` bound to a literal. Proven with the same `-11.3` break
that fooled the first one: rendered guard passes, source guard fails naming the literal.

**Two habits.** Choose a break that changes the OBSERVABLE the guard reads, or the
experiment answers nothing. And when a break legitimately cannot be seen, that is a
finding about coverage — add the guard that can see it, rather than concluding the
existing one is broken.

### 27. A guard that measures more than it OWNS fails for someone else's reason (2026-08-19)

The figure guard originally asserted that `/learn/what-is-a-drawdown` does not scroll
sideways, measuring `document.documentElement`. It went red at 320px by 18px.

The figures were innocent: measuring every node showed the two offending elements were
the **public header's CTA pair** (`Create free account` / `Sign in`, `whitespace-nowrap`,
177.9px against a 320px viewport). The article's own content contributed **0px** at 375,
360 and 320.

⚠️ **The dangerous reflex here is to loosen the bound until it passes** — which would
also have blinded the guard to a real figure overflow, the only thing it exists to catch.
The fix is to measure the thing under test (`[data-article-body]`) at every width, keep a
separate document-level assertion at the supported 375px floor, and **record the header
defect** in the roadmap's deferred list rather than fixing a component this work does not
own (11l) or silently dropping the width that revealed it.

**The rule: scope a guard to what its change is responsible for.** A guard that fails for
someone else's defect will be loosened, and a loosened guard is worse than a narrow one.

### 28. Compare the RUNTIME, not only the pass count (2026-08-19)

A full-file run came back **14 failed, 11 passed** — including tests that had passed
twenty minutes earlier and that my change could not plausibly affect. The same file,
unchanged, re-run: **25 passed**.

What separated the two was not in the code. The failing run took **7.1 minutes**; the
clean one took **29.6 seconds**. A 14× wall-clock blowout with broad, unrelated failures
is an *environment* symptom — a dev server thrashing or recompiling — not a code one.

⚠️ **And I nearly reported the failing run as a pass.** Reading its tail showed a list of
test names ending in `11 passed`, which reads as a success summary; the `14 failed`
header was above the fold of what I looked at, and the wrapper exited **0**. This is
§14's "reconcile the count" in a new costume. **Read the whole summary block, and treat a
large unexplained runtime change as evidence in its own right.**

### 29. A guard the FIX makes structurally true is no longer evidence (2026-08-19)

The owner spotted that a marker on the drawdown figure looked wrong. It was: the curve was
computed from a **rescaled** path priced with the **original** calibration, so it ended at
−31.8% while the marker beside it — derived correctly, by a different route — said −20%.
The dot floated 11.8 points off its own line and the axis bottomed at −48% instead of −30%.
Nothing errored. Both numbers were individually plausible. It looked like a chart.

The fix was right: place the marker by reading its value **off the curve** it marks. Then I
wrote the obvious guard — *the marker must sit on the curve* — broke the code on purpose,
and it stayed **green**.

⚠️ **Because the fix had made that invariant structural.** Once the marker's position is
derived from the curve, the two move together and the assertion can never fail for this
cause. It still guards something real (a marker positioned from an independent number), but
it is worthless as evidence *about the bug it was written for*.

**The rule: after fixing a bug, ask what the fix made impossible, and check that your new
guard is not asserting exactly that.** If it is, the guard is proving the shape of your
implementation, not the correctness of the output.

The guard that does catch it compares the **picture against the prose** — the curve is a
rolling-peak series, the sentence comes from `drawdownFromPeakY`, and a miscalibration
moves one and not the other. Broken on purpose: *"a chart marks the fall as 32% while the
article's prose says 20%."*

⚠️ **And that guard was wrong on its first run, in a way worth keeping.** It matched "every
span that looks like a percentage" and swept up the **axis ticks**, failing with
*"marks the fall as 15% while the prose says 20%"* — where 15 was simply the midpoint label
on the scale. The message was specific, confident and about the wrong element. **A probe
that cannot tell a marker from an axis is measuring the wrong thing however plausible its
error reads**; the markers now carry `data-fall-marker`, the same naming discipline as
`data-record-row` and `data-article-body`.

### 30. A path and the function that prices it are ONE unit (2026-08-19)

The root cause above generalises past charts. `drawdownSeries(path, span)` defaulted to
`priceAt` — the calibration belonging to the *original* path. `recentView()` returns a path
whose y coordinates have been **re-fitted to its own range**, so pricing it with `priceAt`
read its peak as $125.7 instead of $100.4.

**Two things that must agree were separable, and nothing made the caller state which space
it was in.** The parameter is now required, so a caller has to name the mapping —
`recentView().priceOf` for a zoomed path, `priceAt` for the full one. A default that is
correct for one caller and silently wrong for another is worse than no default: it works
until someone adds the second caller, and then it produces plausible numbers.

### 31. "I cannot screenshot" was wrong, and the cost was two invisible defects (2026-08-19)

I told the owner three times that I could not see the figures I had built, because the
Browser pane would not composite frames. That was true of **one** tool and false of the
session: **Playwright had been running all afternoon and takes element screenshots.** The
owner asked "why can't you do it?" and the honest answer was that I had stopped at the
first tool that failed.

Ten minutes of looking then found two defects that every measurement had passed:

1. **The y-axis rendered as a ~6px pale band instead of a hairline.** `vector-effect` is
   **not an inherited SVG property**, so putting it on a wrapping `<g>` does nothing for the
   child lines — and under `preserveAspectRatio="none"` the vertical rule was scaled by the
   *horizontal* factor (6.14×) while the horizontal rule stayed thin. Two lines, one
   attribute, two different weights. It looked like a deliberate design element.
2. **A label jammed into its marker.** The geometric probe reported "no overlap" — correctly,
   the boxes were 4.5px apart — while the rendered text ran into the dot and the curve passed
   straight through the digits. **Bounding boxes not touching is a much weaker claim than
   legibility**, and only the picture carries the difference.

Both are in the class this repo keeps meeting: *renders perfectly, measures clean, looks
wrong.* Geometry tells you elements do not collide; it cannot tell you a figure reads well.

**Two habits.** When one instrument cannot see something, ask which other instrument in the
session already can — the test harness is a browser. And **look at visual work before
reporting it**, in addition to measuring it: a zoomed crop of one corner found a defect that
a full-page capture would also have hidden.

### 32. A guard written for ONE shape of a defect is silent about the others (2026-08-19)

The owner read the drawdown article and found **"How far does this company normally
fall?Its average"** — a space swallowed after `</strong>`. There has been a guard for
exactly this class of bug on this page since it was built, named *"has no words run
together by a lost JSX space"*, and it was **green the whole time**.

It was green because it was written from the instance that prompted it. That one was
`81.4%is not a company` — an interpolated *number* — so the regex is
`/[0-9%](?=[A-Za-z])|[a-z](?=[0-9])/`: a digit against a letter. A **letter** against a
letter matches nothing. The guard was never wrong; it was answering a narrower question
than its name claimed, and the name is what everyone reads.

⚠️ **The source proves nothing here, which is why this has to be caught at render.**
`od -c` showed a genuine `U+0020` after `</strong>` in the broken item, and the
*identical* construction in the sibling list item eight lines above rendered its space
correctly. Two byte-identical arrangements, two different outputs. Whatever the
compiler is doing, reading the file cannot tell you — only the DOM can.

**The fix generalises the guard by scanning the boundary instead of the text.** For
every inline element (`strong,em,a,code,b,i,abbr`) look at the text node either side and
flag a join that no punctuation explains. That holds whatever characters happen to sit
across the seam, so it covers the number case, the letter case, and the ones nobody has
hit yet. Broken on purpose by restoring the exact original arrangement: red, naming the
join — `s company normally fall?❘Its average` — and, tellingly, **the old regex
assertion stayed silent on the same run**, which is the evidence that it had been blind
rather than lucky.

**The habit:** when a guard catches a defect, ask what the defect is an *instance of*
before writing the assertion. If the assertion encodes the instance, the guard's name
starts writing cheques the code cannot cash — and a green run on a page a stranger
judges you by is the most expensive kind of silence.

---

### 33. Prose numbers have a shelf life too, and a sentence is the worst place to keep one (2026-08-19)

Same review: every article footer read *"MajorCycle runs this analysis over 863
companies."* Nothing was wrong with it on the day. But the universe **auto-expands on
every reader's ticker request** (CLAUDE.md #16), so that sentence is a literal that the
product is actively working to falsify, sitting on the pages we most want strangers to
trust. The owner's instruction was blunt and right: *"do not write numbers as it will
change eventually."*

This is CLAUDE.md **11c (v)** — prose is a copy of a constant — with the copy-detection
problem removed by simply **not making the claim**. The footer now says *"on listed
companies across the US, Australia and Canada"*: true at 863, true at 1,200, true after
the next reader adds a ticker.

**The rule of thumb:** in evergreen copy, only state a number when it is either (a)
derived from the constant at render time and guarded, or (b) genuinely fixed (the
25/day cap, the 30-day window). A count of things that grow is neither.

⚠️ **The landing's five copies were the same defect, and they had already drifted.**
Flagged rather than fixed in the first pass, because approved storyboard copy is a
design decision rather than a typo fix (11l) — the owner then asked for it, and the
count turned out to be **866 in the database against 863 on the page**. It now comes
from `landing-snapshot.json`, written nightly by the cron that already commits that
file, so the page keeps its static prerender and the number keeps itself honest.

⚠️ Two details worth carrying forward. **Count with `count="exact"`, never
`len(rows)`** — PostgREST's silent 1000-row cap (14c) would have made the figure
correct today, quietly stale as we grew, and permanently frozen at 1000. And **assert
the whole phrase, not the number**: all five sites are `text {EXPR} text`, the exact
arrangement that swallowed a space in the article on the same day, and a number-only
assertion passes happily on `all866 companies`.

---

### 34. A hand-written page list falls behind the content it is supposed to cover (2026-08-19)

Auditing the three Learn articles found the contrast guard measuring **one of them**.
`READING_PAGES` in `contrast.spec.ts` ended in a literal `'/learn/what-is-a-drawdown'`,
written when there was one article, and two more were published without anyone touching
it. Both new pages rendered perfectly and neither had ever been in front of the probe.

⚠️ **The comment underneath made it invisible.** It said the list "covers every entry in
PUBLIC_PAGES" — true when written, quietly false afterwards, and reassuring enough that
nobody re-checked. This is 11c-iv (a rule a new consumer never received) wearing 14g's
clothes (unmeasured is indistinguishable from clean).

The list now derives its articles from `LEARN_ARTICLES`, so the next article is covered
before anyone remembers to think about it. **A list that must be edited whenever content
is added will eventually not be** — and the failure is silent by construction.

Both previously-unmeasured articles passed once measured. That is the good outcome and it
is not the point: they were not passing, they were unexamined.

---

### 35. Rewording is not rewriting, and an exact-match check cannot see the difference (2026-08-19)

The same audit found `dip-correction-crash` closing with a four-bullet "what it cannot
tell you" list that was `what-is-a-drawdown`'s list with a thesaurus run over it — same
bullets, same order, "a collapsing business" → "a failing business", "the same
percentage" → "a similar-looking number". A second instance sat mid-article: "Individual
shares are far more volatile than that average, and they differ enormously from one
another. Some fall 30%… Others have rarely dropped more than 12%…" appeared in both,
near enough word for word.

Both read fine alone. Read together they are one passage written twice — the pattern
search engines discount, and a reader meets as filler on the second article they open.

⚠️ **An exact-sentence comparison found ZERO overlap between all three pairs** and would
have passed happily. The rewording defeated it completely. **Word-shingles (8-grams)
caught it**, because "take wildly different lengths of time to climb back, and time is a
real cost" survived the paraphrase intact.

⚠️ **The guard took three attempts, and each wrong version failed on CORRECT behaviour.**
First it flagged the internal links (a link's text is necessarily the sibling's title).
Then the mandatory disclaimer, which is identical by law. Then figure legends and the
closing call to action, which are deliberately consistent. **A guard that fires on the
thing you want people to do teaches them to delete it** (§14 item 27). It now strips
links, figures, the disclaimer and the final CTA section, and compares only the argument.

⚠️ **And the break found a defect the fix had not covered.** Restoring one reworded
bullet went red naming a *different* passage — the "differ enormously" paragraph, which I
had read past twice. **The purpose of breaking a guard is to learn what it sees, and
sometimes it sees more than you did.**

---

### 36. A break the guard cannot see is not a break (2026-08-19)

Testing the new "every article links to a sibling" guard, I removed one of the pillar's
two outbound links and the guard passed. The instinct in that moment is to distrust the
guard. It was correct: the assertion is *at least one* sibling link, and one remained.

Then the second attempt broke the file's syntax, so the run went red for a parse error —
red, and meaningless. Only the third attempt (repointing both links away, leaving valid
JSX) produced the real failure: `the cluster dead-ends there: what-is-a-drawdown`.

Three outcomes from one guard: a pass that proved nothing, a failure that proved nothing,
and finally the evidence. **Check that the break actually removes the property being
asserted, and that the run failed for the reason you intended** (§14 items 26 and 29).

---

---

**End of coding-standards.md.**
