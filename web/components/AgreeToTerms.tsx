import Link from 'next/link';

/**
 * "By creating an account, you agree to…" (beta review A-22 / F-13, owner-approved
 * 2026-10-03). The Terms bind "by creating an account", and the Privacy Policy holds the
 * overseas-storage disclosure (APP 8) — yet sign-up never showed or linked either.
 *
 * Shown under BOTH ways in: the email form and Google. On sign-in too, because a first
 * Google sign-in creates the account there.
 */
export function AgreeToTerms({ action }: { action: 'creating an account' | 'continuing' }) {
  return (
    <p className="mt-4 text-center text-[11.5px] leading-relaxed text-[var(--text-muted)]">
      By {action}, you agree to our{' '}
      <Link href="/terms" className="font-semibold text-[var(--brand-mid)] underline underline-offset-2 hover:text-[var(--brand-deep)]">
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link href="/privacy" className="font-semibold text-[var(--brand-mid)] underline underline-offset-2 hover:text-[var(--brand-deep)]">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
