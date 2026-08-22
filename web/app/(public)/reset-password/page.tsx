import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ResetPasswordForm } from './ResetPasswordForm';

// noindex (crawlable) — see lib/seo.ts.
export const metadata: Metadata = pageMetadata({
  path: '/reset-password',
  title: 'Reset Password',
  description: 'Reset the password for your MajorCycle account.',
});

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}

/**
 * ⚠️ NEVER STATIC — parity with `/login` and `/signup`, which are `force-dynamic`
 * for their own reasons and send `private, no-cache, no-store`. This page holds
 * nothing per-viewer, so prerendering it would not have exposed anything; it
 * simply became shared-cacheable for a year the moment the site started
 * prerendering, and an auth surface should not quietly change its caching as a
 * side effect of an unrelated change. Stated, not inherited (CLAUDE.md 11a).
 */
export const dynamic = 'force-dynamic';
