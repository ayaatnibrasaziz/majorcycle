// Representative IANA time zone per country (ISO-3166 alpha-2), used to render
// billing dates (trial end / renewal) in the account's own calendar day rather than
// the server's UTC day. SubscriptionCard is a Server Component, so an unqualified
// toLocaleDateString formats in the runtime zone (UTC on Vercel) — a UTC-evening
// instant then shows as the *previous* day for users east of UTC (e.g. Australia).
//
// Day-precision only; a country spanning several zones uses one representative zone.
// We already lock billing currency by country, so keying the display zone off the
// same field is consistent. Unknown/absent country -> undefined, and the caller
// falls back to the runtime default (today's behaviour — no regression).
const COUNTRY_ZONE: Record<string, string> = {
  // The three launch markets (must be correct).
  US: 'America/New_York',
  AU: 'Australia/Sydney',
  CA: 'America/Toronto',
  // Common others, best-effort representative zones.
  GB: 'Europe/London',
  IE: 'Europe/Dublin',
  NZ: 'Pacific/Auckland',
  IN: 'Asia/Kolkata',
  SG: 'Asia/Singapore',
  HK: 'Asia/Hong_Kong',
  JP: 'Asia/Tokyo',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  NL: 'Europe/Amsterdam',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  ZA: 'Africa/Johannesburg',
  AE: 'Asia/Dubai',
};

/**
 * Representative IANA zone for a country code, or undefined when unknown/absent
 * (caller should then omit `timeZone` and use the runtime default).
 */
export function zoneForCountry(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return COUNTRY_ZONE[code.toUpperCase()];
}
