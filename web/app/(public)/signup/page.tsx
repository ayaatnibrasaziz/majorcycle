import type { Metadata } from 'next';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'Start Free Trial' };

export default function SignupPage() {
  return <SignupForm />;
}
