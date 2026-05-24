'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Mail, CheckCircle2 } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { GoogleButton } from '@/components/GoogleButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';

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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setSent(true);
    }
  }

  async function handleGoogleSignup() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <div className="bg-gradient-to-br from-[var(--brand-light)] to-white border border-[#bfdbfe] rounded-[var(--radius)] p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-white shadow-[var(--shadow-md)] flex items-center justify-center mb-4">
            <Mail className="w-7 h-7 text-[var(--brand-mid)]" strokeWidth={2} />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] leading-relaxed">
            We sent a confirmation link to{' '}
            <strong className="text-[var(--brand-deep)]">{email}</strong>.
          </p>
          <p className="text-[12.5px] text-[var(--text-secondary)] mt-2 leading-relaxed">
            Click it to activate your 7-day free trial.
          </p>
        </div>
        <p className="mt-6 text-center text-[13px] text-[var(--text-secondary)]">
          Already confirmed?{' '}
          <Link href="/login" className="text-[var(--brand-mid)] font-semibold hover:text-[var(--brand-bright)] hover:underline transition-colors">
            Sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Start your free trial"
      subtitle="7 days free — no charge until trial ends. Card required."
    >
      {/* Trial value props */}
      <ul className="flex flex-col gap-2 mb-5 bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[var(--radius-sm)] p-3.5">
        {[
          'Full access to every stock and tab',
          'Cancel anytime in account settings',
          'Email reminder 2 days before trial ends',
        ].map((line) => (
          <li key={line} className="flex items-center gap-2 text-[12.5px] text-[var(--text-secondary)]">
            <CheckCircle2 className="w-[15px] h-[15px] text-[var(--c-tier-2)] flex-shrink-0" strokeWidth={2.5} />
            {line}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSignup} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
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
            placeholder="Min. 8 characters"
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

        <Button type="submit" size="lg" disabled={loading} className="w-full mt-2">
          {loading ? 'Creating account…' : 'Create account & start trial'}
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[var(--bg-surface)] px-3 text-[11px] uppercase tracking-[1px] font-semibold text-[var(--text-muted)]">
            or
          </span>
        </div>
      </div>

      <GoogleButton onClick={handleGoogleSignup} disabled={loading} label="Sign up with Google" />

      <p className="mt-6 text-center text-[13px] text-[var(--text-secondary)]">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--brand-mid)] font-semibold hover:text-[var(--brand-bright)] hover:underline transition-colors">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
