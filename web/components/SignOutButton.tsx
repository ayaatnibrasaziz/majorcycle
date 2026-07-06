import { LogOut } from 'lucide-react';

/**
 * Signs the user out via a native form POST to /auth/signout (route handler
 * clears the session + redirects to /login). No client JS — progressive
 * enhancement, so it works even if hydration hasn't run. Rendered at the foot of
 * the sidebar, under the Licence Status badge.
 */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post" className="mt-2">
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-[7px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[#bfdbfe] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)]"
      >
        <LogOut className="h-[14px] w-[14px]" strokeWidth={1.8} aria-hidden="true" />
        Sign out
      </button>
    </form>
  );
}
