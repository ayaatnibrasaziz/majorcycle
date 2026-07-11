import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { OnboardingModal } from '@/components/OnboardingModal';
import { AnalysisProvider } from '@/lib/analysis';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dev-only bypass: skip auth so the local preview server can render pages
  // without a Supabase session. Guard by NODE_ENV so this can never fire in prod.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <Sidebar subscriptionStatus={null} />
        <Header />
        <main
          className="ml-[var(--sidebar-w)] mt-[var(--header-h)] p-6 min-h-[calc(100vh-var(--header-h))]"
          id="main-content"
        >
          <div className="mb-4 px-3 py-2 bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[11px] text-[var(--text-muted)] italic">
            ⚠ For educational and research purposes only. Not financial advice.
            Always conduct independent due diligence.
          </div>
          <AnalysisProvider>{children}</AnalysisProvider>
        </main>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  // Local JWT verification (asymmetric key + cached JWKS) — no Auth-server
  // round-trip. The middleware already refreshed the token for this request.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;

  if (!claims) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, acknowledged_disclaimer_at, deletion_scheduled_at')
    .eq('id', claims.sub)
    .single();

  // Soft-deleted (deletion scheduled) accounts are confined to /reactivate — the
  // account is deactivated during the grace window until the user reactivates or
  // it's purged. /reactivate lives in the (public) route group, so it isn't
  // wrapped by this layout and can't loop.
  if (profile?.deletion_scheduled_at) {
    redirect('/reactivate');
  }

  const needsOnboarding = profile && !profile.acknowledged_disclaimer_at;

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <Sidebar subscriptionStatus={profile?.subscription_status ?? null} />
      <Header />
      <main
        className="ml-[var(--sidebar-w)] mt-[var(--header-h)] p-6 min-h-[calc(100vh-var(--header-h))]"
        id="main-content"
      >
        {/* Disclaimer strip — required on all authenticated pages */}
        <div className="mb-4 px-3 py-2 bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[11px] text-[var(--text-muted)] italic">
          ⚠ For educational and research purposes only. Not financial advice.
          Always conduct independent due diligence.
        </div>
        <AnalysisProvider>{children}</AnalysisProvider>
      </main>
      {needsOnboarding && <OnboardingModal userId={claims.sub} />}
    </div>
  );
}
