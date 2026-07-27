import { redirect } from 'next/navigation';
import { getViewerEntitlement } from '@/lib/entitlement.server';
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
        {/* Dev bypass renders the ENTITLED view so local work sees the full app.
            Set DEV_FORCE_FREE=true to preview the locked/free-tier states instead. */}
        <Sidebar
          subscriptionStatus={null}
          entitled={process.env.DEV_FORCE_FREE !== 'true'}
        />
        <Header entitled={process.env.DEV_FORCE_FREE !== 'true'} />
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

  // One memoised read serves the whole render pass — this layout, the page beneath
  // it, and any nested server component that needs to know whether to lock.
  const viewer = await getViewerEntitlement();

  if (!viewer.userId) {
    redirect('/login');
  }

  // Soft-deleted (deletion scheduled) accounts are confined to /reactivate — the
  // account is deactivated during the grace window until the user reactivates or
  // it's purged. /reactivate lives in the (public) route group, so it isn't
  // wrapped by this layout and can't loop.
  //
  // Checked BEFORE entitlement: a mid-deletion account must be sent to /reactivate,
  // never to /pricing (it can't meaningfully subscribe while scheduled for purge).
  if (viewer.deletionScheduled) {
    redirect('/reactivate');
  }

  const needsOnboarding = !viewer.acknowledgedDisclaimerAt;

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <Sidebar subscriptionStatus={viewer.subscriptionStatus} entitled={viewer.entitled} />
      <Header email={viewer.email} entitled={viewer.entitled} />
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
      {needsOnboarding && <OnboardingModal />}
    </div>
  );
}
