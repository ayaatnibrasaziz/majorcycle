// Re-export all Supabase client helpers from their respective modules.
// Client Components: import from '@/lib/supabase/client'
// Server Components / Route Handlers: import from '@/lib/supabase/server'
// This barrel file is kept for convenience — do not import it in Client Components
// because the server module pulls in next/headers.

export { createBrowserClient } from '@/lib/supabase/client';
export { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
