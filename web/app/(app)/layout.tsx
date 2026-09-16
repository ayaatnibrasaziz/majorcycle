import { redirect } from 'next/navigation';
import { shouldShowOnboarding } from '@/lib/entitlement';
import { getViewerEntitlement } from '@/lib/entitlement.server';
import { AppShell } from '@/components/AppShell';
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
      // Dev bypass renders the ENTITLED view so local work sees the full app.
      // Set DEV_FORCE_FREE=true to preview the locked/free-tier states instead.
      <AppShell
        subscriptionStatus={null}
        entitled={process.env.DEV_FORCE_FREE !== 'true'}
      >
        {children}
      </AppShell>
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

  // Onboarding is a GATE, so render it as one: the page underneath is never shown
  // and never usable, and building it costs a universe fetch plus a 120-row client
  // component on every first login.
  //
  // It also fixes a hydration warning that survived four narrower attempts. Radix
  // sets `aria-hidden` directly on sibling DOM nodes when a modal opens, and App
  // Router hydrates the page subtree progressively — so the mutation landed on nodes
  // React hadn't hydrated yet, and React discarded and re-rendered that subtree on
  // the client. Deferring the open (`ssr: false`, `useSyncExternalStore`,
  // requestAnimationFrame) all failed because the race is with a large subtree that
  // finishes hydrating whenever it finishes; upgrading @radix-ui/react-dialog to
  // 1.1.23 didn't help either (radix-ui/primitives#1386, still open). With no page
  // rendered behind the dialog there is nothing to race.
  //
  // ⚠️ The condition is `shouldShowOnboarding`, not a bare null check on the
  // timestamp. A bare null check cannot tell "this reader has never agreed" from
  // "we could not read this reader's row", and on 2026-08-27 it showed the gate to
  // an account that had agreed in June — whose only way past it then OVERWROTE the
  // June record with an August one. See lib/entitlement.ts.
  if (shouldShowOnboarding(viewer)) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <OnboardingModal />
      </div>
    );
  }

  return (
    <AppShell
      email={viewer.email}
      subscriptionStatus={viewer.subscriptionStatus}
      entitled={viewer.entitled}
      billingBlocked={viewer.billingBlocked}
    >
      {children}
    </AppShell>
  );
}
