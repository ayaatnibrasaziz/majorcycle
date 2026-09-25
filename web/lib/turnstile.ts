/**
 * Cloudflare Turnstile — the "are you a person?" check on every form that makes
 * Supabase send an email or test a password (2026-09-22).
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * On 2026-09-21 four fake accounts were created in a day, each followed 3–17 s
 * later by a password-reset request. A person does not ask to reset a password
 * seconds after choosing it; a bot flooding somebody's inbox with genuine-looking
 * mail from real companies does. Our sign-up and reset forms were the mail cannon.
 *
 * ── Where the protection actually lives ──────────────────────────────────────
 * ⚠️ NOT in this file, and not in the widget. Every one of these forms calls
 * Supabase's auth API straight from the browser with the PUBLIC anon key, so a
 * bot can skip our page entirely. The check is enforced by SUPABASE (Dashboard →
 * Authentication → Attack Protection → CAPTCHA, provider Turnstile, with the
 * secret key), which verifies each token server-side before it signs anyone up,
 * signs anyone in or sends any reset email. The widget's only job is to obtain the
 * token and hand it over as `captchaToken`. A widget without that setting is
 * decoration; the setting without the widget locks everybody out.
 *
 * Supabase exempts, by design (read from its source, `isIgnoreCaptchaRoute`):
 * Google sign-in (`id_token`), the OAuth callback (`pkce`) and token refresh —
 * none of which a bot can use to send email — and any request carrying ADMIN
 * credentials, which is how the test suite gets through (e2e/lib/captcha.ts).
 *
 * ── The key is the switch ────────────────────────────────────────────────────
 * Empty `NEXT_PUBLIC_TURNSTILE_SITE_KEY` ⇒ no widget, no script, no CSP origin,
 * no privacy-policy line — exactly the site as it was. It is baked in at BUILD
 * time, so the widget, the CSP and the disclosure ship together or not at all.
 * Dev and CI use Cloudflare's published always-pass TEST key
 * (`1x00000000000000000000AA`), so the real widget path runs on every test.
 *
 * ── LIVE since 2026-09-23 ────────────────────────────────────────────────────
 * Cloudflare widget **"MajorCycle auth"**, mode Managed, hostnames
 * `majorcycle.com` + `www.majorcycle.com`. The site key is set on Vercel for
 * **production only**, which has a consequence worth knowing before it surprises
 * somebody: a PREVIEW deployment is `*.vercel.app`, which is not in that hostname
 * list, so previews ship no widget — and Supabase's CAPTCHA setting is per
 * PROJECT, not per environment. Once it is on, a password sign-in on a preview
 * URL is refused. That is deliberate: adding `vercel.app` to the widget would
 * hand our site key to every site on that domain. Use production, or the local
 * test key, to exercise a password form by hand.
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

/** True when the forms must obtain a token before they may submit. */
export const CAPTCHA_REQUIRED = TURNSTILE_SITE_KEY.length > 0;

/** Script and iframe both come from here — Cloudflare's documented CSP. */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** `render=explicit`: we mount the widget ourselves, when React has the form. */
export const TURNSTILE_SCRIPT = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;

/**
 * Cloudflare's origin for EVERY page's CSP while the check is on; `null` when the
 * key is unset, so the policy is then byte-identical to the site before Turnstile.
 *
 * ⚠️ SITE-WIDE, NOT THE FOUR PAGES THAT DRAW IT — and the owner found why on the
 * live site on 2026-09-25. This used to admit Cloudflare only on `/login`,
 * `/signup`, `/reset-password` and `/account`. But a click on a `<Link>` is a
 * CLIENT-SIDE navigation: the browser keeps the document it already has, and with
 * it the Content-Security-Policy of the page the reader STARTED on. So a reader who
 * pressed "Sign in" on the landing page arrived at a sign-in form whose policy was
 * the landing page's, which does not name Cloudflare: `api.js` was refused, the
 * form said *"We couldn't run our quick security check"* and Sign In stayed
 * disabled. A reload fetched `/login`'s own policy and it worked — which is exactly
 * what the owner reported, and exactly what a test that loads `/login` directly
 * can never see. A per-route CSP holds only for pages reached by a full load, and
 * nothing in Next makes a page reachable only that way (redirects from `proxy.ts`
 * are followed client-side too), so a third-party origin a page needs must be in
 * every page's policy that can navigate to it — which on this site is every page.
 *
 * The cost is one origin in `script-src` + `frame-src` on pages that do not draw
 * the widget. It is Cloudflare's challenge host, and those two directives are the
 * whole of Cloudflare's documented CSP.
 */
export function turnstileCspOrigin(): string | null {
  return CAPTCHA_REQUIRED ? TURNSTILE_ORIGIN : null;
}
