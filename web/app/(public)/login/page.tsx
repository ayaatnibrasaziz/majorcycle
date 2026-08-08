import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { LoginForm } from './LoginForm';

// noindex (crawlable) — a sign-in form is not a search result. See lib/seo.ts.
export const metadata: Metadata = pageMetadata({
  path: '/login',
  title: 'Sign In',
  description: 'Sign in to your MajorCycle account.',
});

export default function LoginPage() {
  return <LoginForm />;
}
