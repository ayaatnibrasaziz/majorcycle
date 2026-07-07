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

const SITE = 'https://www.majorcycle.com';

const FONT_STACK =
  "'Sora',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

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
  const year = new Date().getUTCFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#eef2f7;">
${
  preheader
    ? `  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">${preheader}</div>\n`
    : ''
}  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#eef2f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(16,42,90,0.08);">
          <tr>
            <td bgcolor="#04163E" style="background-color:#04163E;background:linear-gradient(120deg,#010F2C 0%,#04214F 58%,#063A80 100%);border-bottom:3px solid #2E7DE8;padding:22px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:middle;padding:0 14px 0 0;">
                    <img src="${SITE}/email-icon.png" width="37" height="44" alt="MajorCycle" style="display:block;height:44px;width:37px;border:0;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-family:${FONT_STACK};font-size:19px;font-weight:700;color:#ffffff;letter-spacing:0.2px;line-height:1.1;">MajorCycle</div>
                    <div style="font-family:${FONT_STACK};font-size:12.5px;font-weight:600;color:#9db8e0;line-height:1.4;padding-top:3px;">${heading}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;font-family:${FONT_STACK};color:#0f1923;">
${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 28px;">
              <div style="font-family:${FONT_STACK};font-size:11px;color:#94a3b8;line-height:1.5;">
                MajorCycle provides educational information only &mdash; not financial advice.
                <br />&copy; ${year} MajorCycle &middot; <a href="${SITE}" style="color:#1E5CB3;text-decoration:none;">majorcycle.com</a>
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
