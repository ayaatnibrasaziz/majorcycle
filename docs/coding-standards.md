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
| Test | `*.test.ts` or `*.test.tsx` next to source | `lib/ticker.test.ts` |

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
  useEffect(() => { fetch(`/api/ticker/${ticker}`).then(...) }, [ticker]);
  // Googlebot sees null. Use Server Component instead.
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

### Supabase from the client (learned the hard way — F3)

- **`createBrowserClient()` must be a module-level singleton.** Building a new client per call spins up multiple `GoTrueClient`s, each with its own auto-refresh loop over the same cookie storage; they race on refresh-token rotation and can invalidate the session (intermittent, unrecoverable sign-outs). `web/lib/supabase/client.ts` memoises it — never `new` one ad-hoc.
- **Authenticated DB writes go through a server action, not the browser client.** A cold browser client can fire an `UPDATE` before it has hydrated the session from cookies → the write goes out unauthenticated → RLS matches **zero rows** → and PostgREST returns **no error** for a zero-row update, so the UI shows a *false* success while nothing persisted. In a server action the cookie-bound client is already authenticated for the request, so the write is reliable and its result is truthful. (See `ProfileForm` → `updateProfile` in `web/app/(app)/account/actions.ts`.)
- **`signOut()` defaults to `scope: 'global'` — pass `'local'` for a normal Sign-out button.** The default revokes the user's sessions on **every device**, so signing out on one device silently logs them out everywhere (and, in the e2e suite where suites share one test user, one suite's sign-out revoked another's session mid-test). A normal Sign-out must be `signOut({ scope: 'local' })` (this device only). Reserve `'global'` for deliberate "end everywhere" actions — e.g. account deletion. (See `web/app/auth/signout/route.ts` vs `account/actions.ts`.)

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

Run via `pytest` (Python) and `vitest` (TS). Both must pass in CI.

### Stripe webhooks — offline contract tests + a real end-to-end pass

- **Contract tests** (`web/e2e/stripe-webhook.spec.ts`) sign events **offline** with the same secret the route verifies with (`generateTestHeaderString` ↔ `constructEvent`), so any consistent `whsec_…` works — no reachable endpoint or network to Stripe needed. They create their **own throwaway user** per run (never the shared login account) so they can run in parallel without contention.
- **But also do one real end-to-end pass** — the offline tests fire events **one at a time** and miss ordering bugs. A real trial signup fires an **event storm** (`subscription.created` + a paid `$0` invoice) at once; that's how the "paid invoice clobbers `trialing`" bug was caught. Do it with the **Stripe CLI**: `stripe login` (owner-interactive) → `stripe listen --forward-to localhost:3000/api/stripe/webhook`; put its `whsec_` in `web/.env.local`; create a test subscription and assert the DB.
- **Vercel preview URLs are behind Deployment Protection** (`vercel_auth_enabled`) — Stripe's POST gets a **401** and never reaches the route. So webhooks can't be registered against a preview URL; test locally via the CLI, and register the **real** endpoint in **production** (not walled, LIVE mode).

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
| Running `pnpm build` while the dev/preview server is up | Poisons the shared `web/.next` cache → the dev server serves **stale `globals.css`** (new JS but old CSS), even across a restart | After a prod build, `rm -rf web/.next` and restart the dev/preview server before verifying CSS |
| Trusting a `preview_start` that suddenly **404s every detail page** | Next lets a pre-existing `process.env` (a stale Supabase URL/key in the launching shell) **override `web/.env.local`**, so SSR reads the wrong/old project and `fetchStockDetail` returns null → `notFound()` for *every* ticker (looks like a code bug; it isn't) | Confirm the creds reach the data (a quick REST/Node check), then `preview_stop` + `preview_start` **fresh** to pick up the right env. A clean restart fixed it (2026-06-27). |
| Rendering a raw yfinance metric as a headline | Near-zero denominators give absurd values (P/E 3,500×, ROE 8,457%, payout 18,210%) that look broken | Cap the display via `MetricDef.cap` (show `>+cap`, true value in tooltip) + mirror in `medians.server.ts` `OUTLIER_BOUND`. Where a high value is *bad* (distress dividend yield), show it but recolour amber + ⚠, don't cap. See design-system §9 "Numeric display". |
| Naming the data provider ("Yahoo Finance") in user-facing copy | Owner decision (S9) — don't advertise the free source | Keep user-visible copy generic ("third-party data — not our rating"); the provider name may stay only in internal code/comments. |
| Hand-rolling price formatting (`Intl`/`currencySymbol`/hardcoded `$`) in a component | Drifts into inconsistency — `C$` vs `CA$`, `$1.71` for an AUD stock, or **mixed decimals within one group** (a `$95.20` target beside a `$120` one) | Use the shared **`fmtPrice`** (uniform 2 dp ≥ $1, more < $1 so sub-$1 never shows "$0") / **`fmtPerShare`** (EPS/DPS, 2 dp) from `web/lib/format.ts`. See design-system §9 "Price formatting". |
| A card "fill-to-N" fallback that asserts a metric claim | Can contradict the opposite card for the same ticker (e.g. Why-Attractive "accelerating 34%" vs Key-Risks "34% is modest") | Keep each metric's Attractive vs Risk thresholds **disjoint**; a fallback must be **gated** to the range that makes it true or a **tautological caveat** that can't be wrong. See design-system §9 "Statement engine — no contradictions". |
| Forcing a fixed magnitude unit on a large quantity (`/1e9 … 'B'`, `/1e6 … 'M'`) or pre-dividing chart data by `1e9` | A small-cap's real values **collapse to a meaningless "0.0M"/"$0B"** (e.g. SEK.AX cash axis was all "$0B"); the user is shown no information | Use **`fmtCompact(value, currency?)`** (adaptive K/M/B/T, mantissa always ≥ 1) for off-axis quantities, and **`makeCompactAxisFormatter(axisMax, currency?)`** for chart axes (uniform unit + uniform decimals across all ticks). Plot **raw** values; let the formatter drive the axis. See design-system §9. |
| A literal source space after a closing inline tag (`</strong> word`) when the next text **wraps to a new line** in JSX | Babel's JSX whitespace rule drops that leading space → the words run together ("trend.It blends", "data"(this") | Put an explicit `{' '}` after the closing tag (`</strong>{' '}word`) — never rely on a literal space across a line break. |

---

## 13. Required CI Checks (Must Pass Before Merge)

1. `pnpm typecheck` — zero TS errors
2. `pnpm lint` — zero ESLint errors
3. `pnpm test` — all Vitest tests pass
4. `pnpm build` — Next.js production build succeeds
5. `ruff check analytics/` + `(cd web && ruff check _engine/ api/)` — zero Python lint errors
6. `mypy analytics/` + `(cd web && mypy _engine/ api/)` — zero type errors (`--ignore-missing-imports --explicit-package-bases`)
7. `pytest analytics/` — all Python tests pass
8. `_engine` drift check — `web/_engine/<file>.py` matches `analytics/<file>.py` modulo the `from analytics.` → `from _engine.` rewrite

CI is configured in `.github/workflows/ci.yml`. Bypassing CI to merge is forbidden.

---

## 14. Verification Commands (Self-Check Before "Done")

Every task ends with the relevant command(s) and shown output:

| Task touched | Run | Expect |
|---|---|---|
| Any TS/React code | `pnpm typecheck && pnpm lint` | exit 0, no output |
| New TS test | `pnpm test` | all pass |
| Any Python code | `ruff check analytics/ && (cd web && ruff check _engine/ api/) && mypy analytics/ --ignore-missing-imports --explicit-package-bases && (cd web && mypy _engine/ api/ --ignore-missing-imports --explicit-package-bases)` | exit 0 |
| Edit to cycle math / scoring | Mirror the edit in `web/_engine/<same_file>.py` (replace `from analytics.` with `from _engine.`); run the drift check from `.github/workflows/ci.yml` locally | drift check exits 0 |
| Cycle math change | `pytest analytics/tests/test_major_cycle.py -v` | all pass |
| New API route | `pnpm build` then test in Vercel preview | route returns expected shape |
| UI change | Screenshot before/after | visual match with reference |
| Schema change | Apply migration locally + run app | no broken queries |

Never report "done" without showing the relevant verification output.

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

---

**End of coding-standards.md.**
