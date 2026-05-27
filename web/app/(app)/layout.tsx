import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { OnboardingModal } from '@/components/OnboardingModal';

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
          {children}
        </main>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, acknowledged_disclaimer_at')
    .eq('id', user.id)
    .single();

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
        {children}
      </main>
      {needsOnboarding && <OnboardingModal userId={user.id} />}
    </div>
  );
}
