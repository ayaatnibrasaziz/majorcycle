import { createBrowserClient as _createBrowserClient } from '@supabase/ssr';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/** Browser singleton — safe to use in Client Components. */
export function createBrowserClient() {
  return _createBrowserClient(
    requireEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env['NEXT_PUBLIC_SUPABASE_URL']
    ),
    requireEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    )
  );
}
