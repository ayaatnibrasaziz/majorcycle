/**
 * Shared brand wrapper for MajorCycle transactional emails.
 *
 * Matches the Supabase auth email templates (design-system.md §17): a diagonal
 * navy→blue gradient header with the floating transparent `email-icon.png` + a
 * live-text Sora wordmark, a white body card, and a grey footer carrying the
 * "educational information only" disclaimer. This is the one place the email
 * chrome is defined so every app-sent email (contact notifications today; welcome
 * / trial emails later) stays visually consistent with the auth mail.
 *
 * Email-client safe by construction: table layout + inline styles only (Gmail and
 * Outlook strip <style>/<head>), the gradient carries a solid `#04163E` bgcolor
 * fallback (Outlook ignores CSS gradients), and Sora falls back to system sans
 * where the web font can't load (expected — same as the reply signatures).
 *
 * `bodyHtml` is injected verbatim — callers MUST pass already-escaped, trusted
 * markup (see `escapeHtml` in the contact action).
 */

import { SITE_ORIGIN } from '@/lib/url';

// From lib/url.ts — the one home for the origin (rule 11c). Hard-coded here until
// Layer G G1, which made this the FIFTH copy of the same literal.
const SITE = SITE_ORIGIN;

const FONT_STACK =
  "'Sora',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * The email palette. An email cannot read a CSS custom property — Gmail and
 * Outlook strip <style> and there is no `:root` to resolve against — so literals
 * are unavoidable *in kind*. What was avoidable is that they were TYPED INTO the
 * markup rather than named, so the branded emails would silently keep the old
 * brand colours through any palette change (audit 5A-073). Same argument as
 * `lib/ink.ts`: one place, so a change reaches every template.
 *
 * ⚠️ `footer` was **#94a3b8 on #f8fafc — 2.45:1**, against a 4.5 floor, on the
 * line carrying our legal and no-reply notice in every transactional email we
 * send (audit 5A-091). That grey is the same family as the site's pre-August
 * `--text-muted`, which was darkened when it turned out to be failing 258
 * elements; the emails kept the old value because they are a separate palette
 * that nothing measured. Now **5.59:1**. The other tones in this file were
 * measured at the same time and all pass: body 17.74, wordmark 17.65,
 * sub-heading 7.76.
 */
const EMAIL = {
  pageBg: '#eef2f7',
  cardBg: '#ffffff',
  headerSolid: '#04163E',
  headerGradient: 'linear-gradient(120deg,#010F2C 0%,#04214F 58%,#063A80 100%)',
  headerRule: '#2E7DE8',
  wordmark: '#ffffff',
  subheading: '#9db8e0',
  body: '#0f1923',
  footerBg: '#f8fafc',
  footerRule: '#e2e8f0',
  footer: '#5a6675',
} as const;

export interface BrandEmailOptions {
  /** Small label shown under the wordmark, e.g. "New contact message". */
  heading: string;
  /** Trusted, pre-escaped HTML for the message body. */
  bodyHtml: string;
  /** Hidden preheader text shown in inbox list previews (optional). */
  preheader?: string;
}

/** Render a full, Gmail/Outlook-safe HTML email in the MajorCycle brand chrome. */
export function renderBrandEmail({ heading, bodyHtml, preheader }: BrandEmailOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:${EMAIL.pageBg};">
${
  preheader
    ? `  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">${preheader}</div>\n`
    : ''
}  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${EMAIL.pageBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;background:${EMAIL.cardBg};border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(16,42,90,0.08);">
          <tr>
            <td bgcolor="${EMAIL.headerSolid}" style="background-color:${EMAIL.headerSolid};background:${EMAIL.headerGradient};border-bottom:3px solid ${EMAIL.headerRule};padding:22px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:middle;padding:0 14px 0 0;">
                    <img src="${SITE}/email-icon.png" width="37" height="44" alt="MajorCycle" style="display:block;height:44px;width:37px;border:0;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-family:${FONT_STACK};font-size:19px;font-weight:700;color:${EMAIL.wordmark};letter-spacing:0.2px;line-height:1.1;">MajorCycle</div>
                    <div style="font-family:${FONT_STACK};font-size:12.5px;font-weight:600;color:${EMAIL.subheading};line-height:1.4;padding-top:3px;">${heading}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;font-family:${FONT_STACK};color:${EMAIL.body};">
${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:${EMAIL.footerBg};border-top:1px solid ${EMAIL.footerRule};padding:16px 28px;">
              <div style="font-family:${FONT_STACK};font-size:11px;color:${EMAIL.footer};line-height:1.5;">
                &copy; MajorCycle provides educational information only &mdash; not financial advice.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
