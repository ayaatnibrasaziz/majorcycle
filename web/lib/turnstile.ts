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
 * The pages that draw the widget: the three auth forms, and `/account`, whose
 * password change re-checks the current password with `signInWithPassword`.
 * `/account/update-password` is NOT here — it calls `updateUser` on a session
 * the reset link already proved, which Supabase does not captcha.
 */
export const TURNSTILE_ROUTES = ['/login', '/signup', '/reset-password', '/account'] as const;

/** Does this page need Cloudflare's origin in its CSP? `false` whenever the key is unset. */
export function usesTurnstile(pathname: string): boolean {
  if (!CAPTCHA_REQUIRED) return false;
  const path =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return (TURNSTILE_ROUTES as readonly string[]).includes(path);
}
