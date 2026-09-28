# Findings A — public site. Returned as text; saved by main session.
Counts: 1 blocker · 8 major · 25 minor. Evidence shots/A-*.png
A-6 [BLOCKER security] Open redirect: /login?next=/%09/evil.com (or %0A) passes safeNextPath (lib/url.ts:63 checks only 2nd char) → window.location.assign in LoginForm.tsx:126, GoogleSignIn.tsx:140 → http://evil.com/. Test list lacks tab/newline. Fix: new URL(next, origin) same-origin.
A-1 [major] Landing "Top pick: GOOGL", "standout", "setting an exit", "before you buy", "worth owning". page.tsx:188; guard doesn't scan app/(public) nor "pick".
A-10 [major] Recovery article: "20%→50% roughly doubles the wait; 50%→70% quadruples" contradicts its own table (0.30y→1.5y→2.9y→8.3y). content.tsx:484; not in assert_all.py.
A-15 [major] /learn/what-is-a-drawdown nightly Apple figure 1.2% makes fixed prose ("sounds like a meaningful drop") nonsense. learn/content.tsx:303-304.
A-16 [major] Free 25-new-stocks/day limit only in Terms; landing "Browse all 868", signup "every stock", 12 Learn CTAs "look up any company"; pricing silent.
A-18 [major] 14/22 article tables overflow at 375, cut mid-number, no scroll hint; .art-tablewrap lacks tabindex despite CSS comment. DataTable.tsx:134.
A-21 [major] /contact server-side rejection (me@gmail, whitespace) wipes all fields; generic error. React 19 form reset + defaultValue. actions.ts:43.
A-22 [major, compliance] /signup no Terms/Privacy link or "by creating an account you agree". (with F-13)
A-28 [major, unsure] WebKit renders Sora headings at 400 since variable font registered as 5 fixed-weight @font-face (globals.css:21-25); fix font-weight: 100 800. Needs real Safari check.
A-2 [minor] META Health "80 Adequate" (raw 79.6). lib/ratings.ts:100. (with C-14)
A-3 [minor] "Checking five hundred companies" under "868 companies".
A-4 [minor] Trial CTA drops Monthly/Annual choice (/signup?next=/account).
A-5 [minor] Annual per-month: US$10.50, A$13.25, C$14 (no cents).
A-7 [minor] Signed-in /login?next=… drops next (proxy.ts:326).
A-8 [minor] No skip-to-content link on public pages.
A-9 [minor] /articles: "4 articles" but 5; "1 in progress" vs badge "Planned"; "Sep 2026" lapses.
A-11 [minor] ASX article banks table includes Macquarie, excludes Judo contrary to text; S&P 500/499; ASX FS 28/27.
A-13 [minor] ASX 200 article says second column is best close; it's intraday high. content.tsx:826.
A-14 [minor] TSX60/S&P captions "five full years" but Falls counts all; sector tables out of order (Real Estate 42% above 46%).
A-17 [minor] "High Conviction = all three strong… Rare" vs GOOGL Valuation 63 "Reasonable".
A-19 [minor] /learn/analyst-price-target 320px "Today" "Average" 3px apart.
A-20 [minor] /contact ends "← Back to sign in".
A-23 [minor] No show/hide password; 8-char minimum only as placeholder.
A-24 [minor] /signup from trial: "Step 1 of 2 — trial starts after this" vs "Yours to keep free — no card".
A-25 [minor] Signed-out unknown URLs (/random, /LEARN) → /login instead of 404.
A-26 [minor] 404 page no menu; ghost panel.
A-27 [minor] No-JS: login/signup buttons disabled without message; menu dead.
A-29 [minor] Signed-in reader can't reach How it works/landing (redirect to /stocks).
A-30 [minor] /pricing Annual toggle lost before hydration (no useHydrated).
A-31 [minor] /learn hero image lazy-loaded (LCP warning).
A-32 [minor] /#how-it-works lands below "HOW A SCAN WORKS".
A-33 [minor] "Fall" means different things: 610 vs 611 falls vs "a handful"; 610 falls vs 631 recoveries unexplained; garbled sentence on recoveries page.
A-34 [minor] Signed-in /account/update-password: "Cancel and return to sign in" signs out; no way back.
A-35 [minor] Titles "Sign In"/"Create a Free Account" title case; TSX 60 article title 71 chars.
Checked fine: 60 links/31 pages 200; robots; sitemap 25 all 200; canonical/OG; no sideways scroll; landing figures consistent; pricing per currency + 30%; article sums reconcile; worked example 67; mobile menu; keyboard order/focus; auth validation; ?next=https:// and // rejected; signed-in redirects; contact limits/honeypot; 404s; spelling; disclaimers; learn figures at 320.
Not checked: real Safari (A-28), actual sign-in via redirect, Stripe, Sentry privacy line, prod speed, WebKit link tabbing.
