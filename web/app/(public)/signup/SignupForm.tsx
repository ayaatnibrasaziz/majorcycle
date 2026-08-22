'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Mail, Check, Sparkles } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { AuthDivider } from '@/components/AuthDivider';
import { GoogleSignIn } from '@/components/GoogleSignIn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/authErrors';
import { getSiteURL, safeNextPath } from '@/lib/url';

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
  // Where to land AFTER the confirmation email is clicked. Signup previously dropped
  // this on the floor and always went to /stocks, which is why someone who arrived
  // from "Start 7-day free trial" on /pricing was bounced back to a page telling them
  // to create the account they'd just created (F3 Step 10, owner-reported).
  // `safeNextPath` is the same open-redirect guard the login form uses.
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  // Arrived by clicking "Start 7-day free trial" while signed out. Without saying so,
  // landing on a page headed "Create your free account" reads as the button having
  // failed — the reader asked for a trial and appears to have been given something
  // else. The trial genuinely needs an account first (checkout is session-gated), so
  // the honest fix is to name this as step one rather than to hide it.
  //
  // /account is where that button now points: /pricing is the signed-out shop window
  // and redirects a signed-in reader away, so it can't be a post-signup destination.
  const startingTrial = next.startsWith('/account');

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
        emailRedirectTo: `${getSiteURL()}/auth/callback?next=${encodeURIComponent(next)}`,
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
        <div className="bg-gradient-to-br from-white to-[var(--brand-light)] border border-[var(--brand-light-border)] rounded-[var(--radius)] p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-white shadow-[var(--shadow-md)] flex items-center justify-center mb-4">
            <Mail className="w-7 h-7 text-[var(--brand-mid)]" strokeWidth={2} />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] leading-relaxed">
            We sent a confirmation link to{' '}
            <strong className="text-[var(--brand-deep)]">{email}</strong>.
          </p>
          <p className="text-[12.5px] text-[var(--text-secondary)] mt-2 leading-relaxed">
            {startingTrial
              ? 'Click it and we’ll take you straight back to start your 7-day free trial.'
              : 'Click it to activate your free account.'}
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
      title={startingTrial ? 'First, create your account' : 'Create your free account'}
      subtitle={
        startingTrial
          ? 'Step 1 of 2 — your 7-day free trial starts right after this. No card needed yet.'
          : 'Free to sign up and free to keep. No card needed.'
      }
    >
      {startingTrial && (
        <div className="mb-5 flex gap-2.5 rounded-[var(--radius-sm)] border border-[var(--brand-light-border)] bg-[var(--brand-light)] px-3.5 py-3">
          <Sparkles
            className="mt-[2px] h-[15px] w-[15px] flex-shrink-0 text-[var(--brand-mid)]"
            strokeWidth={2}
            aria-hidden
          />
          <p className="text-[12.5px] leading-relaxed text-[var(--brand-deep)]">
            {/* Deliberately not "once you confirm your email": Google sign-up has no
                confirmation step — it signs you straight in and lands you back here.
                One line has to be true for both providers. */}
            Your trial is waiting. We just need an account to attach it to — as soon as
            it&apos;s ready we&apos;ll take you straight back to start it.
          </p>
        </div>
      )}

      {/* Free-tier value props — matches reference briefing-card aesthetic */}
      <div className="mb-6 bg-gradient-to-br from-white to-[var(--brand-light)] border border-[var(--brand-light-border)] rounded-[var(--radius)] px-4 py-3.5">
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
          sentence — a reader who takes only half of this must still take a true half.
          Which is also why it is --text-secondary rather than --text-muted (2.97:1)
          from Layer G on: the sentence that stops someone misreading "free account"
          as "free trial, card required" cannot be the faintest text on the page. */}
      <p className="-mt-3 mb-6 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
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

      <GoogleSignIn next={next} onError={setError} disabled={loading} label="signup_with" />

      <p className="mt-7 pt-6 border-t border-[var(--border)] text-center text-[13px] text-[var(--text-secondary)]">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--brand-mid)] font-semibold hover:text-[var(--brand-bright)] transition-colors">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
