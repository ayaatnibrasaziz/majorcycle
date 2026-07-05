'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { AuthDivider } from '@/components/AuthDivider';
import { GoogleSignIn } from '@/components/GoogleSignIn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/authErrors';
import { safeNextPath } from '@/lib/url';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));

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
      setError(friendlyAuthError(authError.message));
      setLoading(false);
    } else {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to your terminal."
    >
      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <div className="flex justify-end">
            <Link
              href="/reset-password"
              className="text-[11.5px] font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-bright)] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
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
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <AuthDivider />

      <GoogleSignIn next={next} onError={setError} disabled={loading} label="continue_with" />

      <p className="mt-7 pt-6 border-t border-[var(--border)] text-center text-[13px] text-[var(--text-secondary)]">
        New to MajorCycle?{' '}
        <Link href="/signup" className="text-[var(--brand-mid)] font-semibold hover:text-[var(--brand-bright)] transition-colors">
          Start your free trial
        </Link>
      </p>
    </AuthCard>
  );
}
