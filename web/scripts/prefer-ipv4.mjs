// LOCAL DEV / TOOLING ONLY — never wired into production.
//
// On some machines the AAAA (IPv6) DNS query for `*.supabase.co` / `api.stripe.com`
// stalls ~12s and trips undici's 10s connect timeout — surfacing as
// `pnpm stripe:listen` "Couldn't reach Stripe: fetch failed" and, worse, the
// checkout route returning 401 "Not signed in" (its `getUser()` network call times
// out even though the page, which uses local `getClaims`, looks logged in).
//
// Root cause is `getaddrinfo` waiting on the stalling AAAA record — NOT our code
// and NOT a live/Vercel issue (verified against Supabase logs; the failed requests
// never reach the server). Forcing IPv4-only resolution skips the AAAA query
// entirely: measured 12,087ms → ~28ms (lookup) / ~450ms (cold fetch).
//
// `--dns-result-order=ipv4first` does NOT fix this — it only reorders results
// AFTER resolution; the AAAA query still stalls. We must skip AAAA, i.e. `family: 4`.
//
// See docs/coding-standards.md and the `reference-local-dev-ipv6-connect-fix` memory.

import dns from 'node:dns';

let patched = false;

/** Force every DNS lookup in this process to resolve IPv4-only (skips the AAAA query). */
export function preferIPv4() {
  if (patched) return;
  patched = true;

  const withV4 = (options) =>
    typeof options === 'number' ? { family: 4 } : { ...(options ?? {}), family: 4 };

  const origLookup = dns.lookup;
  dns.lookup = function (hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = undefined;
    }
    return origLookup.call(dns, hostname, withV4(options), callback);
  };

  const origPromisesLookup = dns.promises.lookup;
  dns.promises.lookup = function (hostname, options) {
    return origPromisesLookup.call(dns.promises, hostname, withV4(options));
  };
}
