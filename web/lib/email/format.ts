/**
 * Shared building blocks for MajorCycle transactional email bodies. Table +
 * inline-style only (Gmail/Outlook strip <style>), matching the brand chrome in
 * `brandEmail.ts`. Used by `accountEmails.ts` and `referralEmails.ts` so the
 * paragraph / button / greeting styling stays identical across every app email.
 */

import { zoneForCountry } from '@/lib/timezone';

export const FONT =
  "'Sora',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.majorcycle.com';

/** Escape any user-controlled value (display name, email, message) before interpolating. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function p(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:14.5px;line-height:1.65;color:#0f1923;">${html}</p>`;
}

export function muted(html: string): string {
  return `<p style="margin:16px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:#64748b;">${html}</p>`;
}

export function button(label: string, url: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;"><tr>` +
    `<td bgcolor="#1E5CB3" style="border-radius:8px;">` +
    `<a href="${url}" style="display:inline-block;padding:11px 24px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>` +
    `</td></tr></table>`
  );
}

/** "Hi Alex," when a display name exists, else the "Hi there," fallback. */
export function greetingHtml(name: string | null): string {
  const n = name?.trim();
  return p(n ? `Hi ${escapeHtml(n)},` : 'Hi there,');
}

export function greetingText(name: string | null): string {
  const n = name?.trim();
  return n ? `Hi ${n},` : 'Hi there,';
}

/**
 * "Friday, 10 August 2026" — en-AU for a deterministic day-month-year style.
 *
 * Emails render on the server (no browser), so the date is shown in the account's
 * COUNTRY zone (from `profiles.country`) — the same `zoneForCountry` helper the
 * account UI uses, so an email date and the on-screen date never disagree by a day.
 * Unknown/absent country -> the runtime default zone (UTC on Vercel), i.e. today's
 * behaviour. See web/lib/timezone.ts and SubscriptionCard.
 */
export function formatDate(date: Date, country?: string | null): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: zoneForCountry(country),
  }).format(date);
}
