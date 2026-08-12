import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Auth-aware 404. A logged-out visitor who hits a bad/unbuilt URL is sent back to
 * sign-in (the old hard-coded "Back to Results" bounced them straight into a
 * /login redirect); a logged-in user still gets "Back to Results". Server
 * component so it can read the session.
 */
export default async function NotFound() {
  let signedIn = false;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
  } catch {
    signedIn = false;
  }

  const href = signedIn ? '/stocks' : '/login';
  const label = signedIn ? 'Back to Browse' : 'Back to sign in';

  return (
    // Standalone chrome on purpose. This is the ROOT not-found, so it also catches
    // unmatched paths inside the signed-in app — where a "Sign in / Create free
    // account" header would be nonsense. It borrows the public pages' card
    // language (same radius, border, surface and lift) without their nav.
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-6">
      <div className="w-full max-w-[var(--measure-narrow)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-lift)] px-7 py-10 sm:px-9 text-center">
        <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-[var(--bg-stripe)] border border-[var(--border)] flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35M11 8v3M11 14h.01" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-[-0.4px] leading-[1.2]">
          Page not found
        </h1>
        {/* --text-secondary, not --text-muted: muted is 2.9:1 on this surface and
            this is the only sentence explaining what happened. */}
        <p className="mt-2 mb-7 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        {/* href and label are UNCHANGED — e2e/auth.spec.ts asserts both the visible
            name and the href for the signed-out case. */}
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href={href}>{label}</Link>
        </Button>
      </div>
    </div>
  );
}
