'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { GoogleButton } from '@/components/GoogleButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/results';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.push(next);
      router.refresh();
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to your terminal."
    >
      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/reset-password"
              className="text-[11.5px] font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-bright)] hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
          {loading ? 'Signing in…' : 'Sign in'}
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

      <GoogleButton onClick={handleGoogleLogin} disabled={loading} />

      <p className="mt-6 text-center text-[13px] text-[var(--text-secondary)]">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[var(--brand-mid)] font-semibold hover:text-[var(--brand-bright)] hover:underline transition-colors">
          Start free trial
        </Link>
      </p>
    </AuthCard>
  );
}
