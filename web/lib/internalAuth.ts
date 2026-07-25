/**
 * Shared contract for the internal-only `/api/cycle` endpoint (F3 Step 10).
 *
 * `/api/cycle` cannot be gated by session auth: the Stock Detail page renders on the
 * server and fetches it over the PUBLIC url with no cookies attached, so a session
 * check would redirect our own render to /login and blank every cycle section (see
 * the note in web/proxy.ts). A shared secret is what separates "our server rendering
 * a page" from "anyone on the internet".
 *
 * Three places must agree, which is why the constant lives here rather than being
 * repeated: the caller (web/lib/cycle.ts), the edge check (web/proxy.ts), and the
 * authoritative check (web/api/cycle.py, `INTERNAL_HEADER`).
 *
 * Deliberately dependency-free — no node: imports, no next/* — so it is safe to pull
 * into the proxy, which runs on the edge runtime.
 */

/** Header carrying the shared secret. Must match `INTERNAL_HEADER` in api/cycle.py. */
export const INTERNAL_HEADER = 'x-mc-internal';

/**
 * Length-safe, constant-time-ish string comparison. Avoids leaking the secret's
 * prefix through early-exit timing. `node:crypto.timingSafeEqual` isn't available on
 * the edge runtime, so this is the portable equivalent: always walk the full width
 * of the longer string and accumulate differences rather than returning early.
 */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Does this request carry the internal secret?
 *
 * Fails CLOSED when `CYCLE_INTERNAL_SECRET` is unset — never treat "no secret
 * configured" as "allow everyone", which would silently reopen the hole this closes.
 * The Python function returns a loud 503 in the same situation so a missing env var
 * is unmistakable in the logs rather than looking like a data problem.
 */
export function hasInternalSecret(presented: string | null | undefined): boolean {
  const secret = process.env.CYCLE_INTERNAL_SECRET ?? '';
  if (!secret) return false;
  return safeEqual(presented ?? '', secret);
}
