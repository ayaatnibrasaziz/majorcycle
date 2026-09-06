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
| `proxy.ts` | Middleware — auth boundary, premium API gate, `/api/cycle` secret branch, and the CSP (it mints the per-request nonce) |
| `lib/csp.ts` | The Content-Security-Policy, both forms, and `usesNonce()` — the one list saying which routes render per request |
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
pnpm check:tier-palette      # one rating palette, all five tiers legible, adjacent pairs apart
```

Four more need a **production build**, because the dev server is not the product. Run
`pnpm start:fresh --port 3200` first (it rebuilds, so it cannot serve stale code), then:

```bash
pnpm check:render-modes      # which routes are prerendered, and the CSP nonce invariant
pnpm check:csp               # the policy on the wire + zero violations in a real browser
pnpm check:page-weight       # bytes a reader actually pays for, per page
pnpm lighthouse              # median of 3 — never against :3000, where the numbers are fiction
```

⚠️ `check:render-modes` reads `.next/server/app/`, so it must follow `pnpm build`; it is the
only one of the four that runs in CI. The other three need a running server and a real
session, which is why they are scripts you run rather than specs that run themselves.

Not a check, but related — the design-system gallery:

```bash
pnpm build:design-system     # regenerate design-system-build/ from app/globals.css
pnpm build:og-image          # regenerate app/opengraph-image.png (the share card)
```

It **parses the real stylesheet** rather than restating it, so a colour that is not
shipped cannot appear in the gallery. The output is gitignored: it is a rendering, never
a source of truth. ⚠️ Outside Next, `--font-sans`/`--font-mono` do **not** resolve —
they live in `@theme inline`, not `:root`, and an unresolvable `var()` voids the whole
declaration rather than falling back, which once rendered the entire gallery in Times
New Roman while labelled Sora. The script pins them and loads the webfonts explicitly.

`build:og-image` renders the card in a real browser (satori's variable-font support
is unreliable and Sora is variable) and **refuses to write the file** unless
`document.fonts.check()` confirms Sora rasterised, then reads the dimensions back
out of the PNG. Its success line used to print "1200x630" as literal text — and
printed it while writing an 800×418 card. The output is **committed**: it is what
the site serves.

⚠️ **There is exactly ONE share image, sitewide.** Never add a per-page or
per-stock card: they are fetched by anonymous crawlers and cached publicly, so one
carrying a rating would publish paid output on a CDN. `e2e/seo.spec.ts` asserts
every indexable page declares exactly one, and that it is this one.

The landing page's worked example comes from `web/app/landing-snapshot.json`, which is
**frozen** — rebuilt only by `analytics/cron/build_landing_snapshot.py --worked-example`,
by hand, together with `build_mag7_snapshot.py` (they share Apple; see data-contracts §7a).
The nightly cron rebuilds the two LIVE files instead: `web/app/universe-count.json` (the
company count) and `web/app/learn-snapshot.json` (Apple's figures for the `/learn`
explainers, which describe how the product behaves today). It emits free-tier fields only, and that is *structural*: it calls
`calculate_cycle_metrics`, which cannot return a rating or a score.

```bash
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
- **A prerendered page can never carry a CSP nonce.** Its HTML was written at build time, so
  a nonce policy refuses every script in it and the page renders and then does nothing.
  `usesNonce()` in `lib/csp.ts` is an allow-list for exactly this reason, and
  `pnpm check:render-modes` fails the build if the two sets ever overlap.
- **A stale `.next-dev` survives `git stash`, a server restart and `reuseExistingServer:
  false`.** It once produced three clean failures and three clean passes across a controlled
  A/B and the code under test was innocent. Clear it *between* the arms of any experiment —
  and move it OUT of `web/`, never sideways within it, or Tailwind scans the compiled chunks.
