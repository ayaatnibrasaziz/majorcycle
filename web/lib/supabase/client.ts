import { createBrowserClient as _createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// One client per browser tab. Creating a fresh client on every call spins up a
// new GoTrueClient — each with its own auto-refresh loop — all sharing the same
// cookie storage. Those loops race on refresh-token rotation: one rotates the
// token, the others (and the SSR middleware) are left holding an already-used
// token, the refresh 401s, and the whole session is invalidated (intermittent,
// unrecoverable sign-outs). Memoising at module scope means every Client Component
// shares ONE instance and one refresh loop. The module re-evaluates per full page
// load, so each navigation still starts from the current cookies.
let _browserClient: SupabaseClient | null = null;

/** Browser singleton — safe to use in Client Components. */
export function createBrowserClient(): SupabaseClient {
  if (_browserClient) return _browserClient;
  _browserClient = _createBrowserClient(
    requireEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env['NEXT_PUBLIC_SUPABASE_URL']
    ),
    requireEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    )
  );
  return _browserClient;
}
