'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';

export function ResetPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account/update-password`,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <div className="text-center py-2">
          <div className="text-[32px] mb-4">🔑</div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            We sent a password reset link to{' '}
            <strong className="text-[var(--text-primary)]">{email}</strong>.
          </p>
          <Link
            href="/login"
            className="mt-4 block text-[12px] text-[var(--brand-mid)] font-semibold hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link"
    >
      <form onSubmit={handleReset} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
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

        {error && (
          <p role="alert" className="text-[11px] text-[var(--c-tier-5)] bg-[var(--tint-tier-5)] border border-[var(--tint-tier-5-strong)] rounded-[var(--radius-sm)] px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full mt-1">
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-4 text-center text-[12px] text-[var(--text-muted)]">
        Remember it?{' '}
        <Link href="/login" className="text-[var(--brand-mid)] font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
