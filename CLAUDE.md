# CLAUDE.md

> **READ THIS FIRST. Every session. Before any code.**
> If anything in this codebase conflicts with this file, **this file wins.**

This is the master brief for **MajorCycle** (`majorcycle.com`). Any AI assistant working on this project must read this top-to-bottom, then read the relevant doc in `/docs/` for the task at hand.

---

## 🎯 Mission

**MajorCycle** is a premium financial terminal that runs a proprietary **Major Cycle** analysis on US, Australian, and Canadian equities. Users discover where stocks sit relative to their historical drawdown/recovery cycles, alongside fundamental health scores, valuation positioning, and analyst data.

The product launches as a **web app** with a **7-day free trial** that converts to a monthly or annual subscription.

**This is not a financial advice product.** It is an educational/informational analysis tool. All copy, labels, and disclaimers reflect this.

---

## 👤 Project Owner Profile (Important)

- **Solopreneur, non-coder**, based in Australia
- Builds entirely via Claude Code + MCP-controlled deployments
- **Cannot debug code manually** — every output must self-verify before being reported complete
- Time is the binding constraint, not money (though cost stays minimal)

When in doubt about any decision: **ask, don't guess.**

---

## 🛠 Tech Stack (Locked — Do Not Suggest Changes)

| Layer | Tech | Why |
|---|---|---|
| Frontend framework | Next.js 15 (App Router) + TypeScript | SEO via SSR, MCP-controlled via Vercel, best Claude Code support |
| Styling | Tailwind v4 + shadcn/ui | Standard pairing, components owned in-repo |
| Charts | Lightweight Charts (candlesticks) + Recharts (everything else) | TradingView-grade rendering, free |
| Backend (batch) | Python via GitHub Actions cron | Free, no always-on cost |
| Backend (on-demand) | Python via Vercel Serverless Functions | Free Hobby tier, 10s timeout |
| Data provider (P1) | yfinance | Free; abstracted behind `DataProvider` interface |
| Data provider (P2) | Financial Modeling Prep (FMP) API | Drop-in via the same interface |
| Database & Auth | Supabase (Postgres + Auth) | Free tier, MCP-controlled |
| Hosting | Vercel Hobby | $0, edge CDN, Python runtime |
| Email | Resend | 3,000/mo free, MCP-controlled |
| Payments | Stripe (subscription, 7-day trial) | Standard SaaS, MCP-controlled |
| Source | GitHub | Required for Actions + Vercel + Claude Code |
| Domain/DNS | Cloudflare | At-cost registrar, MCP-controlled |
| Error tracking (P2) | Sentry | Free tier sufficient |

---

## 📐 Repository Structure

```
/
├── CLAUDE.md                       ← THIS FILE — read first
├── README.md                       ← brief project intro for GitHub
├── reference/
│   └── original-design.html        ← VISUAL SOURCE OF TRUTH for UI tasks
├── docs/
│   ├── architecture.md             ← system diagrams, data flow, hosting
│   ├── design-system.md            ← colours, fonts, components, visual rules
│   ├── data-contracts.md           ← TS types, Python dataclasses, DB schema
│   ├── coding-standards.md         ← conventions, anti-patterns, file rules
│   ├── glossary.md                 ← every domain term defined once
│   └── roadmap.md                  ← Phase 1 / Phase 2 scope and build order
├── web/                            ← Next.js app (frontend + Vercel Python functions)
│   ├── app/                        ← App Router routes
│   │   └── api/                    ← Next.js TS route handlers (auth, light reads)
│   ├── api/                        ← Vercel Python serverless functions (api/cycle.py → /api/cycle)
│   ├── _engine/                    ← Vendored snapshot of analytics/ for the Python function
│   │   ├── major_cycle.py          ← (kept in sync with analytics/ via CI drift check)
│   │   ├── presets.py
│   │   ├── providers/base.py
│   │   └── scoring/{financial_health,valuation,overall}.py
│   ├── components/                 ← React components
│   ├── lib/                        ← utilities, DB client, types
│   ├── public/                     ← static assets, favicons, OG images
│   ├── requirements.txt            ← Python deps for the Vercel function bundle
│   └── vercel.json                 ← functions config (includeFiles, memory, maxDuration)
├── analytics/                      ← Python analysis (cron-runnable; canonical cycle math)
│   ├── major_cycle.py              ← cycle math (canonical — web/_engine/ mirrors this)
│   ├── providers/                  ← DataProvider abstraction
│   │   ├── base.py                 ← abstract interface — DO NOT BYPASS
│   │   ├── yfinance_provider.py    ← Phase 1 implementation
│   │   └── fmp_provider.py         ← Phase 2 stub
│   ├── scoring/                    ← health / valuation / overall rating
│   ├── cron/                       ← GitHub Actions runner scripts
│   ├── universe/                   ← ticker list CSVs (sp500, asx200, tsx60)
│   └── tests/
├── .github/
│   └── workflows/                  ← daily cron + Vercel deploys + CI (includes _engine drift check)
└── .env.example                    ← documents every required env var
```

**Cycle math lives in two places by design.** `analytics/` is the canonical
home (cron runs it). `web/_engine/` is a vendored snapshot so the Vercel
Python function at `web/api/cycle.py` can import it locally (Vercel's
auto-install doesn't cleanly bundle code from outside the project root).
The two copies are kept in sync by a CI drift check that fails if they
diverge. **Edit `analytics/<file>.py` first**, then update the matching
`web/_engine/<file>.py` (with `from analytics.` rewritten to `from _engine.`),
in the same commit.

---

## ⚠️ Non-Negotiables

These rules cannot be bent. If a task seems to require breaking one, **stop and ask**.

### Visual & UX

1. **Visual parity rule.** Any UI section with an equivalent in `/reference/original-design.html` MUST visually match it: brand palette, fonts, spacing, layout, hover states, tooltips — all preserved. Open the reference before building UI. Match it.

2. **Rating labels.** The five tiers are **High Conviction / Constructive / Neutral / Cautious / Bearish**. Never use "Buy", "Sell", "Strong Buy", "Avoid" in our scoring outputs. (Wall Street analyst recommendations from yfinance display verbatim — that's third-party data, not our judgment.)

3. **Mobile first.** Every page must be responsive down to 375px. No horizontal scroll on phones.

4. **Disclaimer presence.** Any page that displays a rating, score, or signal must have an "Information only — not financial advice" disclaimer visible without scrolling.

### Code

5. **All chart instances declared once** in master state — never redeclare with a standalone `let`/`const`.

6. **Never use `Math.max(...arr)` / `Math.min(...arr)`** on large arrays (>10k items). Use `reduce()`.

7. **Never put HTML comments (`<!-- -->`) inside JavaScript template literals.** Browser parser breaks.

8. **CrosshairPlugin must guard against radar/doughnut/pie chart types** in `afterDraw` and `afterEvent` callbacks.

9. **DataProvider interface is sacred.** No code outside `analytics/providers/` may import `yfinance` directly. Phase 2 FMP migration must be a one-file change.

10. **Edit existing files with targeted edits only** — never rewrite a whole file unless explicitly asked.

11. **No `console.log`, no `print()`, no commented-out code** in committed files.

### Data & Compliance

12. **All scores, labels, and ratings shown to users MUST be accompanied by disclaimers** on the page. Educational/informational only. Not financial advice. ASIC-compliant.

13. **Currency display:** Stock prices always shown in the stock's home currency (USD/AUD/CAD). Subscription pricing shown in user's local currency.

14. **Ticker storage format:** Use yfinance native format internally (`AAPL`, `BHP.AX`, `SHOP.TO`). URL routing maps `/stocks/au/BHP` ↔ `BHP.AX`.

15. **Pre-computation policy:** Store raw price history + fundamentals only. Cycle math runs on demand. Never store rating outputs in the DB — they're always derived.

16. **Universe model:** Pre-seeded + auto-expanding. If a user uploads a ticker not in our universe, fetch it live, cache it forever, return results.

### Workflow

17. **Self-verification before "done".** Run the appropriate command (`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pytest`) and show passing output before reporting complete.

18. **Zero tolerance on errors.** Zero TypeScript errors. Zero ESLint errors. Zero Python type errors. No warnings ignored.

19. **Never commit secrets.** All sensitive values live in `.env.local` (dev) or Vercel/GitHub Secrets (prod). Document required vars in `.env.example`.

---

## ✅ Before You Start ANY Task — Mandatory Checklist

- [ ] Read this file (CLAUDE.md)
- [ ] Read `docs/architecture.md` if the task touches system structure or data flow
- [ ] Read `docs/design-system.md` if the task touches UI
- [ ] Read `docs/data-contracts.md` if the task involves data shapes or types
- [ ] Read `docs/coding-standards.md` if writing new files or refactoring
- [ ] Check `docs/glossary.md` if you hit an unfamiliar domain term
- [ ] Open `/reference/original-design.html` if implementing UI that exists there
- [ ] Confirm the task is in current Phase scope per `docs/roadmap.md`

---

## 🤝 How To Work With This Project Owner

- The owner is **non-technical**. Explain trade-offs in plain language. Avoid jargon, or define it inline.
- The owner **cannot debug**. If something might break in production, build a safety net (try/catch, fallback UI, logging).
- The owner uses **MCP-controlled deployments**. When suggesting changes, prefer MCP-friendly approaches.
- The owner **owns the strategy**. Don't suggest scope creep. Don't add features. Stay in the lane defined by `docs/roadmap.md`.
- The owner **expects evidence**. Don't say "fixed it" — show the before/after, the passing test, the screenshot.
- When in doubt, **ask one clear question**. Don't bombard with options.

---

## 📊 The 34 Locked Decisions (The Contract)

These were agreed during planning. Do not relitigate.

| # | Decision | Value |
|---|---|---|
| 1 | Frontend framework | Next.js 15 App Router + TypeScript + Tailwind v4 + shadcn/ui |
| 2 | Charts | Lightweight Charts (candlesticks), Recharts (rest) |
| 3 | Backend | Hybrid — Vercel Python serverless + GitHub Actions cron |
| 4 | Database & Auth | Supabase free tier |
| 5 | Hosting | Vercel Hobby ($0) |
| 6 | Domain registrar | Cloudflare (name TBD post-MCP setup) |
| 7 | Source control | GitHub |
| 8 | Transactional email | Resend (3,000/mo free) |
| 9 | Payments | Stripe (subscription with `trial_period_days=7`) |
| 10 | Data provider | yfinance Phase 1 via DataProvider interface → FMP Phase 2 |
| 11 | Geography | US + AU + CA equities (S&P 500, ASX 200, S&P/TSX 60) |
| 12 | Universe model | Pre-seeded + auto-expanding |
| 13 | URL structure | `/stocks/[market]/[ticker]` e.g. `/stocks/us/AAPL` |
| 14 | Pre-computation policy | Store raw price history + fundamentals only |
| 15 | Run Analysis presets | Short (-3/+3/63), Medium (-5/+5/252), Long (-8/+8/756), Custom |
| 16 | Rating labels | High Conviction / Constructive / Neutral / Cautious / Bearish |
| 17 | Analyst recommendations | Keep verbatim (third-party data) |
| 18 | Pricing | US$15/mo, AU$19/mo, CA$20/mo. Annual ~30% off. No usage limits. |
| 19 | Trial | 7 days, card required upfront, auto-converts |
| 20 | Trial-end UX | 3-day grace period on payment failure, then hard lock |
| 21 | Refunds | None — standard SaaS |
| 22 | Auth methods | Email/password + Google OAuth |
| 23 | First-login flow | Methodology + disclaimer acknowledgement modal |
| 24 | Compliance posture | Educational/informational only; disclaimers appropriate but not heavy |
| 25 | Brand colours | Deep #1A3A6E / Mid #1E5CB3 / Bright #2E7DE8 |
| 26 | Fonts | Sora (UI), JetBrains Mono (numbers/code) |
| 27 | App name & logo | **MajorCycle** · domain `majorcycle.com` · logo TBD |
| 28 | Mobile | Mobile-first responsive |
| 29 | Phase 1 launch scope | All 14 Stock Detail sections from current HTML + 3 existing tabs + Methodology/Contact/Disclaimer/Terms + Auth |
| 30 | Phase 2 | Smart Money Activity, watchlists, alerts, sector heatmaps, FMP migration |
| 31 | Repo structure | Monorepo: `/web` + `/analytics` + `/docs` + `/reference` |
| 32 | Cron schedule | Daily 23:00 UTC (after all three markets close) |
| 33 | Performance target | Lighthouse 90+ on per-ticker pages |
| 34 | Methodology content | Generated post-build from Python logic, owner refines |

---

## 🚨 What To Do If Something Goes Wrong

1. **Type/lint/build error:** Fix it before reporting complete. Never report a task done with a red CI.
2. **Logic uncertainty:** Ask the owner with one specific question. Don't guess.
3. **Spec conflict between docs:** This file (CLAUDE.md) wins → then `docs/roadmap.md` → then everything else.
4. **Reference HTML missing for a screen:** It's a new screen — design from `docs/design-system.md`.
5. **yfinance rate-limited / down:** Use the Stooq fallback already in `analytics/providers/yfinance_provider.py`. Don't switch to a paid API. Log and surface.
6. **Schema change needed:** Update `docs/data-contracts.md` first. Then code.
7. **You disagree with a decision:** Say so explicitly. The owner welcomes pushback with reasoning.

---

## 📞 Pointers

- Mission, decisions, non-negotiables → **this file**
- Phased scope and build order → `docs/roadmap.md`
- Visual specifications → `docs/design-system.md`
- Data shapes and provider interface → `docs/data-contracts.md`
- File-naming, anti-patterns, conventions → `docs/coding-standards.md`
- Domain vocabulary → `docs/glossary.md`
- System diagrams and infrastructure → `docs/architecture.md`
- Original UI source of truth → `/reference/original-design.html`

---

**End of CLAUDE.md. Now go read whichever `/docs/` file applies to your current task.**
