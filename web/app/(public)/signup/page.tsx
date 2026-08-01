import type { Metadata } from 'next';
import { SignupForm } from './SignupForm';

// Signing up creates a FREE account — the trial starts later, at Checkout (F3
// Step 10). This is the browser-tab title and the search-result headline, so it has
// to make the same promise the page body does.
export const metadata: Metadata = { title: 'Create a Free Account' };

export default function SignupPage() {
  return <SignupForm />;
}
