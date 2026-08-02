# Prompt for the next session — Phase 1, Layer G (SEO + Performance)

> Copy everything below the line into a fresh chat. It is written to be pasted as-is.

---

Plan Phase 1 **Layer G — SEO + Performance** for MajorCycle. **Start in plan mode. Do not write
any code until I approve the plan.**

## Before you plan anything, read these

1. `CLAUDE.md` — the master brief. It wins over every other file. Note especially non-negotiables
   **11a** (never share-cache a per-viewer response), **11b** (withhold paid data at the data
   layer, not in JSX), and **11c** (one rule, one place — added after two live defects).
2. `docs/roadmap.md` — go to **§ Layer G**. It opens with a red box of facts I verified against
   production on 2026-08-02. **Read that box first; the checklist under it rests on a premise that
   turned out to be false.** Also read §6 Build Order and §3 Success Criteria.
3. `docs/architecture.md` §6.5 (Page Surface — what gates every screen) and §7.1 (free vs premium).
4. `docs/data-contracts.md` — the `CycleAnalysis` / `FreeCycleAnalysis` split and `PREMIUM_FIELDS`.
5. `docs/coding-standards.md` — conventions, the anti-pattern table, and the verification section
   (several instruments in this repo lie; that section says which and how).
6. `docs/design-system.md` — before touching anything visual.
7. `docs/layer-f-audit.md` — the audit format Layer G will eventually be held to, and the standard
   of evidence expected. Skim Part 1 only.

## The situation

Layers A–F are **built, merged, live and audited**. Layer F closed on 2026-08-02 (F-A1…F-A6, nine
findings, all fixed, including a 14-state subscription matrix driven against the live database).
The site is live at `www.majorcycle.com` with real Stripe billing. **G is the next build layer.**

Stack reality — verify, don't assume: **Next 16.2.6, React 19.2.4**, Tailwind v4, Supabase,
Vercel Hobby, Python analytics on GitHub Actions cron. The docs said "Next.js 15" until today; if
you find another version claim, check `web/package.json` and trust that.

## The decision that must come first

**Ticker pages are not crawlable.** Signed out, `GET /stocks/us/AAPL` returns `307 → /login`, and
so does `/stocks`. The roadmap's "dynamic sitemap with every ticker page included" would publish
~863 URLs that all redirect to a login screen, which Google treats as a soft-404 farm — actively
worse than shipping no sitemap.

So Layer G cannot start with metadata. It starts with a product question that is **mine to answer,
not yours to assume**: *which pages should be publicly crawlable, and how much of a ticker page
does an anonymous visitor see?*

Lay out the realistic options with their trade-offs — including SEO upside, the effect on the
free-vs-premium contract (§7.1), the 25/day free-view anti-scraping fence, and any risk of giving
away the product — then **recommend one** and ask me to confirm. Do not design the rest of the
layer until that is settled, because it determines almost everything else.

Related trap, already verified: `/robots.txt` and `/sitemap.xml` **also 307 to `/login`** today.
They aren't in `PUBLIC_PATHS`, so adding `app/robots.ts` and `app/sitemap.ts` is necessary but not
sufficient. Whatever we ship must be proven **on the wire** (200 + correct content-type), not in
the source.

## Use current sources, not memory

This is a live commercial product; stale API knowledge costs real money and real downtime.

- **Use the MCP connectors** for anything about live state: Vercel (deployments, project settings,
  env vars, analytics), Supabase (schema, RLS, advisors, logs), Stripe (read-only — never create
  charges), Resend. If a connector needs authorising, tell me and I'll do it.
- **Consult the current official docs** — the Vercel and Supabase skills/docs available to you, and
  `search_docs` on the Supabase connector — before proposing any framework-level pattern
  (Cache Components / `use cache` / PPR, `generateMetadata`, `@vercel/og`, ISR, image config,
  Routing Middleware). Next 16 changed several of these. **Cite what you checked** in the plan.
- **Run `mcp__supabase__get_advisors`** for security and performance advisories and fold anything
  relevant into the plan.
- If a Vercel or Supabase **project setting** would genuinely improve performance, security, cost
  or SEO, propose it explicitly with the reason and the risk — don't silently change it. I want
  the site set up to best practice, but every settings change is my call.

## Scope

In scope for G: sitemap, robots, canonical URLs, per-page metadata, JSON-LD, OG images, image
optimisation, bundle-size audit, Lighthouse 90+ on ticker pages (locked decision #33), Lighthouse
CI, and a deliberate review of `web/next.config.ts` (**CSP is still `Report-Only`**; there's no
`images` config; `poweredByHeader` isn't disabled).

Also settle the **apex vs `www`** question: pick one canonical host. Be careful — the live Stripe
webhook is registered on `www` and Stripe counts a 3xx as a failed delivery, so this must not break
billing.

Out of scope: 375px mobile, cross-browser and Sentry (all **Layer H**); the analytics engine; any
new product features. Don't relitigate the 34 locked decisions. Don't propose the "paid during
deletion" handler — I considered it and declined.

## How I work

I'm a **non-coder solopreneur** in Australia. Explain trade-offs in plain language and define
jargon inline. I can't debug, so anything that could break in production needs a safety net. I
expect **evidence, not adjectives** — show me the passing output, the before/after, the screenshot.
Push back if you think I'm wrong, with reasoning. When something is genuinely uncertain, ask me one
clear question rather than guessing.

Standing gates before anything is called done: `pnpm typecheck`, `pnpm lint`,
`pnpm check:entitlement-gates`, `pnpm check:report-sections`, `pnpm e2e` (currently **105** — check
the count, a skipped suite is also green), `pytest analytics/` (**86**), and `pnpm build`. Any new
guard must be **broken on purpose first** to prove it can fail — that rule has caught four real
defects here, and a red run is not automatically red for your reason, so read the failure message.

## What the plan should contain

1. The crawlability options, a recommendation, and the question for me.
2. Sessions (G1, G2, …) in dependency order, each with its own verification step, following how
   Layers C–F were run.
3. For each item: what changes, which file, how it will be proven — and proven **on the deployed
   site**, not only locally. Several of this repo's worst bugs were invisible locally.
4. Anything you find along the way that's wrong in the docs or the code, listed separately rather
   than silently fixed.
5. A short list of what Layer G will deliberately **not** do, so scope stays honest.

Finish by asking for approval before writing code.
