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
