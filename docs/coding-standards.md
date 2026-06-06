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

**End of coding-standards.md.**
