import { createServerClient as _createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const SUPABASE_URL = () =>
  requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env['NEXT_PUBLIC_SUPABASE_URL']);
const SUPABASE_ANON_KEY = () =>
  requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
const SUPABASE_SERVICE_KEY = () =>
  requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env['SUPABASE_SERVICE_ROLE_KEY']);

/** Per-request server client — use in Server Components and Route Handlers. */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return _createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Cookies are read-only in Server Components — middleware handles refresh.
        }
      },
    },
  });
}

/** Service-role client — trusted server-side ops only. Never expose to the browser. */
export function createAdminClient() {
  return createClient(SUPABASE_URL(), SUPABASE_SERVICE_KEY(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
