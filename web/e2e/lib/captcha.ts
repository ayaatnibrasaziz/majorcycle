/**
 * The typed door onto the ONE captcha rule.
 *
 * The rule itself lives in `./captchaRoute.mjs`, because the four gate scripts
 * (`check-page-weight`, `check-csp`, `lighthouse`, `audit-wire-sweep`) are plain
 * `.mjs` run by node and must obey exactly the same rule — and on 2026-09-23,
 * the day Supabase's check was switched on, `check-page-weight` went red for
 * precisely this reason while every e2e spec was still green. Read that file for
 * why the mechanism is safe and what it cannot prove.
 */
export {
  passCaptchaForTests,
  userSessionForTests,
  userClientForTests,
} from './captchaRoute.mjs';
