/**
 * The 13 sign-in emails Supabase sends, written HERE and pasted into the dashboard.
 *
 * ⚠️ UNTIL 2026-10-13 THESE EXISTED ONLY IN THE SUPABASE DASHBOARD, and nothing in this
 * project could read them. They drifted from the app's own emails in every way that is
 * easy to miss: slate-grey body text where ours is near-black, a fine-print grey of
 * #94a3b8 (2.56:1 on white, under the 4.5 floor the app's emails were fixed to in
 * 5A-091), a different button, a 480px card, and the title in the body instead of the
 * header. The owner saw the difference side by side in a real inbox. Each template is
 * now built from the SAME wrapper and helpers as the app's emails (`renderBrandEmail`,
 * `p`, `muted`, `button`), so they cannot differ in style again — only in wording.
 *
 * ⚠️ WHAT THIS FILE CANNOT DO: reach the dashboard. `pnpm build:auth-emails` writes
 * the finished HTML to `reference/supabase-email-templates/`, and somebody pastes each
 * file into Authentication → Emails → Templates by hand. `e2e/auth-email-templates.spec.ts`
 * fails if those files and this source disagree; nothing can fail if the DASHBOARD and
 * those files disagree. Paste after every change here.
 *
 * Wording is exactly what the dashboard held on 2026-10-13. `{{ .X }}` placeholders are
 * Supabase's own (Go templates) and are filled in by Supabase when it sends.
 */

import { renderBrandEmail } from '@/lib/email/brandEmail';
import { FONT, button, muted, p } from '@/lib/email/format';

/** Supabase's own placeholders, never ours: they must reach the dashboard verbatim. */
const SITE_URL = '{{ .SiteURL }}';
const TOKEN_HASH = '{{ .TokenHash }}';
const EMAIL = '{{ .Email }}';
const TOKEN = '{{ .Token }}';

const LINK = 'color:#1E5CB3;text-decoration:underline;';

/** Every link email lands on the one confirm route (app/auth/confirm/route.ts). */
function confirmUrl(type: string, next: string): string {
  return `${SITE_URL}/auth/confirm?token_hash=${TOKEN_HASH}&type=${type}&next=${next}`;
}

/** The paste-this-link fallback, in the app's fine-print style. */
function fallbackLink(url: string): string {
  return (
    muted(`If the button doesn’t work, paste this link into your browser:`) +
    `<p style="margin:6px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.6;word-break:break-all;"><a href="${url}" style="${LINK}">${url}</a></p>`
  );
}

/** The security alerts' last line: who to tell if it wasn't them. */
function notYou(lead: string, rest: string): string {
  return p(
    `<strong>${lead}</strong> ${rest.replace(
      'security@majorcycle.com',
      `<a href="mailto:security@majorcycle.com" style="${LINK}">security@majorcycle.com</a>`,
    )}`,
  );
}

export interface AuthTemplate {
  /** The dashboard's Subject field. */
  subject: string;
  /** The small label under the wordmark — where the app's emails put their title. */
  heading: string;
  bodyHtml: string;
}

export const AUTH_TEMPLATES = {
  'confirm-sign-up': {
    subject: 'Confirm your MajorCycle email',
    heading: 'Confirm your email',
    bodyHtml: [
      p(`Welcome to MajorCycle. Confirm your email address to activate your account and start exploring where stocks sit in their Major Cycle.`),
      button('Confirm email', confirmUrl('email', '/stocks')),
      fallbackLink(confirmUrl('email', '/stocks')),
      muted(`This secure link can only be used once and expires after a short time. If you didn’t create a MajorCycle account, you can safely ignore this email.`),
    ].join('\n'),
  },
  'invite-user': {
    subject: "You're invited to MajorCycle",
    heading: 'You’ve been invited',
    bodyHtml: [
      p(`You’ve been invited to join MajorCycle, a premium terminal for Major Cycle analysis on US, Australian, and Canadian equities. Accept the invitation to set up your account.`),
      button('Accept invitation', confirmUrl('invite', '/account/update-password')),
      fallbackLink(confirmUrl('invite', '/account/update-password')),
      muted(`This secure link can only be used once and expires after a short time. If you weren’t expecting this invitation, you can safely ignore this email.`),
    ].join('\n'),
  },
  'magic-link-or-otp': {
    subject: 'Your MajorCycle sign-in link',
    heading: 'Sign in to MajorCycle',
    bodyHtml: [
      p(`Use the button below to securely sign in to your MajorCycle account. No password needed.`),
      button('Sign in', confirmUrl('email', '/stocks')),
      fallbackLink(confirmUrl('email', '/stocks')),
      muted(`This secure link can only be used once and expires after a short time. If you didn’t request it, you can safely ignore this email.`),
    ].join('\n'),
  },
  'change-email-address': {
    subject: 'Confirm your new MajorCycle email',
    heading: 'Confirm your new email',
    bodyHtml: [
      p(`You requested to change the email address on your MajorCycle account. Confirm this address to complete the change.`),
      button('Confirm new email', confirmUrl('email_change', '/stocks')),
      fallbackLink(confirmUrl('email_change', '/stocks')),
      muted(`This secure link can only be used once and expires after a short time. If you didn’t request this change, please secure your account.`),
    ].join('\n'),
  },
  'reset-password': {
    subject: 'Reset your MajorCycle password',
    heading: 'Reset your password',
    bodyHtml: [
      p(`We received a request to reset the password for your MajorCycle account. Click below to choose a new one.`),
      button('Reset password', confirmUrl('recovery', '/account/update-password')),
      fallbackLink(confirmUrl('recovery', '/account/update-password')),
      muted(`This secure link can only be used once and expires after a short time. If you didn’t request a password reset, you can safely ignore this email — your password won’t change.`),
    ].join('\n'),
  },
  reauthentication: {
    subject: 'Your MajorCycle verification code',
    heading: 'Your verification code',
    bodyHtml: [
      p(`Enter this code to confirm it’s you:`),
      `<p style="margin:6px 0 18px;font-family:${FONT};font-size:26px;font-weight:700;letter-spacing:6px;color:#0f1923;">${TOKEN}</p>`,
      muted(`This code expires after a short time. If you didn’t request it, you can safely ignore this email.`),
    ].join('\n'),
  },
  'password-changed': {
    subject: 'Your MajorCycle password was changed',
    heading: 'Your password was changed',
    bodyHtml: [
      p(`The password for your MajorCycle account (<strong>${EMAIL}</strong>) was just changed.`),
      p(`If this was you, you're all set — no further action is needed.`),
      notYou('Didn’t change your password?', 'Your account may be at risk. Reset it immediately and email security@majorcycle.com.'),
    ].join('\n'),
  },
  'email-address-changed': {
    subject: 'Your MajorCycle email address was changed',
    heading: 'Your email address was changed',
    bodyHtml: [
      p(`The email address associated with your MajorCycle account was just changed.`),
      p(`This confirms the update was applied. You're receiving this at an address linked to the change.`),
      notYou('Didn’t request this change?', 'Your account may be at risk — email security@majorcycle.com right away.'),
    ].join('\n'),
  },
  'phone-number-changed': {
    subject: 'Your MajorCycle phone number was changed',
    heading: 'Your phone number was changed',
    bodyHtml: [
      p(`The phone number linked to your MajorCycle account was just changed.`),
      notYou('Didn’t make this change?', 'Your account may be at risk — email security@majorcycle.com right away.'),
    ].join('\n'),
  },
  'sign-in-method-linked': {
    subject: 'A new sign-in method was added to your MajorCycle account',
    heading: 'A new sign-in method was linked',
    bodyHtml: [
      p(`A new way to sign in was just linked to your MajorCycle account (<strong>${EMAIL}</strong>) — for example a Google account, an email &amp; password, or a passkey.`),
      p(`If this was you, no action is needed.`),
      notYou('Didn’t link this?', 'Your account may be at risk — email security@majorcycle.com so we can help secure it.'),
    ].join('\n'),
  },
  'sign-in-method-removed': {
    subject: 'A sign-in method was removed from your MajorCycle account',
    heading: 'A sign-in method was removed',
    bodyHtml: [
      p(`A sign-in method was just removed from your MajorCycle account (<strong>${EMAIL}</strong>) — for example a Google account, an email &amp; password, or a passkey.`),
      p(`If this was you, no action is needed.`),
      notYou('Didn’t remove this?', 'Your account may be at risk — email security@majorcycle.com so we can help secure it.'),
    ].join('\n'),
  },
  'mfa-method-added': {
    subject: 'Two-factor authentication was added to your MajorCycle account',
    heading: 'Two-factor authentication added',
    bodyHtml: [
      p(`A two-factor authentication (2FA) method was just added to your MajorCycle account (<strong>${EMAIL}</strong>). Your account is now better protected.`),
      p(`If this was you, no action is needed.`),
      notYou('Didn’t set this up?', 'Your account may be at risk — email security@majorcycle.com immediately.'),
    ].join('\n'),
  },
  'mfa-method-removed': {
    subject: 'Two-factor authentication was removed from your MajorCycle account',
    heading: 'Two-factor authentication removed',
    bodyHtml: [
      p(`A two-factor authentication (2FA) method was just removed from your MajorCycle account (<strong>${EMAIL}</strong>). Your account may be less protected than before.`),
      p(`If this was you, no action is needed.`),
      notYou('Didn’t remove this?', 'Your account may be at risk — email security@majorcycle.com immediately.'),
    ].join('\n'),
  },
} as const satisfies Record<string, AuthTemplate>;

export type AuthTemplateSlug = keyof typeof AUTH_TEMPLATES;

/** The finished HTML for the dashboard's Body field. */
export function renderAuthTemplate(slug: AuthTemplateSlug): string {
  const t = AUTH_TEMPLATES[slug];
  return renderBrandEmail({ heading: t.heading, bodyHtml: t.bodyHtml });
}
