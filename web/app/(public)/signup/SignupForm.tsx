'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Mail, Check } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { AuthDivider } from '@/components/AuthDivider';
import { GoogleSignIn } from '@/components/GoogleSignIn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/authErrors';
import { getSiteURL } from '@/lib/url';

// Signing up has never actually started a trial — `supabase.auth.signUp` just
// creates the account, and the 7-day trial begins at checkout, where the card is
// taken (decision #19). The old copy here promised a trial anyway, which is now
// plainly wrong: a new account lands on the FREE tier. These lines describe what
// creating an account really gets you, and the trial is offered separately.
//
// Each bullet describes the FREE ACCOUNT only. The trial is deliberately not
// mentioned here: putting "no card required" and "7-day free trial" in one breath
// reads as "the trial needs no card", which is the opposite of decision #19 (card
// upfront, charged on day 7). The trial gets its own separated note below, where the
// card requirement is stated in the same sentence and can't be detached from it.
const freeFeatures = [
  'Browse every US, Australian and Canadian stock we cover',
  'Full price history, cycle chart and company financials',
  'Yours to keep free — no card, no expiry',
];

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getSiteURL()}/auth/callback`,
      },
    });
    if (authError) {
      setError(friendlyAuthError(authError.message));
      setLoading(false);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <div className="bg-gradient-to-br from-white to-[var(--brand-light)] border border-[#bfdbfe] rounded-[var(--radius)] p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-white shadow-[var(--shadow-md)] flex items-center justify-center mb-4">
            <Mail className="w-7 h-7 text-[var(--brand-mid)]" strokeWidth={2} />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] leading-relaxed">
            We sent a confirmation link to{' '}
            <strong className="text-[var(--brand-deep)]">{email}</strong>.
          </p>
          <p className="text-[12.5px] text-[var(--text-secondary)] mt-2 leading-relaxed">
            Click it to activate your free account.
          </p>
        </div>
        <p className="mt-7 pt-6 border-t border-[var(--border)] text-center text-[13px] text-[var(--text-secondary)]">
          Already confirmed?{' '}
          <Link href="/login" className="text-[var(--brand-mid)] font-semibold hover:text-[var(--brand-bright)] transition-colors">
            Sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your free account"
      subtitle="Free to sign up and free to keep. No card needed."
    >
      {/* Free-tier value props — matches reference briefing-card aesthetic */}
      <div className="mb-6 bg-gradient-to-br from-white to-[var(--brand-light)] border border-[#bfdbfe] rounded-[var(--radius)] px-4 py-3.5">
        <ul className="flex flex-col gap-2">
          {freeFeatures.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[12.5px] text-[var(--text-secondary)] leading-snug">
              <span className="mt-[2px] w-[15px] h-[15px] rounded-full bg-[var(--c-tier-2)] flex items-center justify-center flex-shrink-0">
                <Check className="w-[10px] h-[10px] text-white" strokeWidth={3.5} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      {/* Kept OUT of the free-tier list on purpose. The trial is a separate, later
          choice with a different requirement, and the card must be named in the same
          sentence — a reader who takes only half of this must still take a true half. */}
      <p className="-mt-3 mb-6 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        Our ratings, scorecard and screener are paid. When you want them, you can start
        a 7-day free trial from your account — that step does ask for a card, and
        nothing is charged until day 7.{' '}
        <Link
          href="/pricing"
          className="font-semibold text-[var(--brand-mid)] underline underline-offset-2"
        >
          See what&apos;s included
        </Link>
        .
      </p>

      <form onSubmit={handleSignup} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 text-[12px] text-[var(--c-tier-5-ink)] bg-[var(--tint-tier-5)] border border-[var(--tint-tier-5-strong)] rounded-[var(--radius-sm)] px-3 py-2.5"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <Button type="submit" size="lg" disabled={loading} className="w-full mt-1">
          {loading ? 'Creating account…' : 'Create free account'}
        </Button>
      </form>

      <AuthDivider />

      <GoogleSignIn next="/stocks" onError={setError} disabled={loading} label="signup_with" />

      <p className="mt-7 pt-6 border-t border-[var(--border)] text-center text-[13px] text-[var(--text-secondary)]">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--brand-mid)] font-semibold hover:text-[var(--brand-bright)] transition-colors">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
