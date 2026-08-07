# MajorCycle — web app

Next.js **16.2.6** (App Router) + React 19.2.4 + TypeScript + Tailwind v4. *(Scaffolded on 15 —
check `package.json` before relying on any version-specific API.)* This directory holds the frontend
**and** the Vercel Python serverless functions (`api/`).

> Read `../CLAUDE.md` first — it is the master brief and overrides anything here.
> Architecture lives in `../docs/architecture.md`, conventions in `../docs/coding-standards.md`.

## Getting started

**pnpm only** (the lockfile is `pnpm-lock.yaml`; npm/yarn/bun will produce a different tree).

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000. Signed-in routes need a real session, so you'll be sent
to `/login` — see "Local Stripe + auth" below.

Copy `../.env.example` to `web/.env.local` and fill it in. `.env.local` is gitignored and
must stay that way; a pre-commit hook (`.githooks/pre-commit`, enabled with
`git config core.hooksPath .githooks`) blocks committed `sk_`/`rk_`/`whsec_`/PEM strings.

## Layout

| Path | What |
|---|---|
| `app/(public)/` | Signed-out routes — marketing, auth, legal, `/pricing` |
| `app/(app)/` | Signed-in app shell — Browse, Stock Detail, `/run`, `/results`, `/account` |
| `app/api/` | TypeScript route handlers (auth, checkout, portal, Stripe webhook) |
| `api/` | **Python** serverless functions (`api/cycle.py` → `/api/cycle`) |
| `_engine/` | Vendored snapshot of `../analytics/`, kept in sync by a CI drift check |
| `lib/` | Types, Supabase clients, entitlement, billing, cycle fetching |
| `components/` | React components (`ui/` = shadcn-style primitives owned in-repo) |
| `proxy.ts` | Middleware — auth boundary, premium API gate, `/api/cycle` secret branch |
| `e2e/` | Playwright suites (auth, account, Stripe webhook contract, entitlement) |

Fonts are **Sora** (UI) and **JetBrains Mono** (numbers) — locked decision #26, not the
create-next-app default.

## Checks — all of these must pass before anything is "done"

```bash
pnpm typecheck              # tsc --noEmit — zero errors
pnpm lint                   # eslint — zero errors
pnpm build                  # production build
pnpm check:entitlement-gates # paywall can't silently regress (no credentials needed)
pnpm check:report-sections   # downloaded report stays in step with Stock Detail
pnpm check:data-integrity    # unpaginated reads, currency labelling, the P/E currency gate
pnpm check:seo               # robots/sitemap/canonical registry and its four consumers
pnpm e2e                     # Playwright — the ONLY TS test runner. Do NOT add Vitest/Jest.
```

**Read the COUNT, not the colour** — a suite that silently skipped is also green. The
credential-free specs (`entitlement`, `export-parity`, `stock-read-errors`, `seo`) are pure
and *cannot* skip; only the Stripe/auth matrix needs credentials.

`pnpm e2e` starts its **own** dev server on port **3100** (`E2E_PORT`), separate from
`pnpm dev` on 3000, and writes to `.next-dev` rather than `.next`. ⚠️ **It never reuses a
running server** (`reuseExistingServer: false`). That setting is load-bearing, not tidiness:
it used to reuse whatever held 3100, so a server left alive across several `git checkout`s
answered from **stale code** — one test failed 8 of 8 against it and passed 4 of 4 the moment
it was killed, and a "control" run on an older commit measured nothing at all. Booting costs
~30s; not being able to trust a green run costs far more. If 3100 is occupied, kill it.

## Local Stripe + auth

```bash
pnpm stripe:listen
```

Forwards Stripe webhooks to the local dev server, forcing the **sandbox** account by
reading `STRIPE_SECRET_KEY` from `.env.local` (never printed, never in argv) — this
sidesteps the Stripe-CLI-default-account trap. Run it alongside `pnpm dev`.

The full billing loop (checkout → webhook → account updates) only closes **locally** or in
**production**. It cannot close on a Vercel preview: previews are behind Vercel's auth
wall, so Stripe can't POST to them.

## Things that will bite you

- **Never `Cache-Control: public`/`s-maxage` on anything that varies by viewer.** The edge
  keys on URL alone, so that is an authorisation bypass, not a caching bug (CLAUDE.md 11a).
- **Hiding a value in JSX doesn't withhold it.** Client-component props are serialised into
  the HTML; strip restricted fields at the data layer (CLAUDE.md 11b).
- **Edit `../analytics/<file>.py` first**, then mirror into `_engine/` in the same commit,
  or the CI drift check fails.
