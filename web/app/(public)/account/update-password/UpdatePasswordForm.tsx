'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/authErrors';

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setError(friendlyAuthError(authError.message));
      setLoading(false);
    } else {
      // Clear the recovery-confinement marker (no-op for a normal logged-in user
      // who has none) so the now-full session can leave this page for the app.
      await fetch('/auth/recovery-done', { method: 'POST' }).catch(() => {});
      setDone(true);
      setTimeout(() => {
        router.push('/results');
        router.refresh();
      }, 1500);
    }
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <div className="bg-gradient-to-br from-white to-[var(--brand-light)] border border-[#bfdbfe] rounded-[var(--radius)] p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-white shadow-[var(--shadow-md)] flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-[var(--c-tier-2)]" strokeWidth={2} />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] leading-relaxed">
            Your password has been changed. Taking you to your terminal…
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a strong password you do not use elsewhere."
    >
      <form onSubmit={handleUpdate} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
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
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>

      {/* Escape hatch — a recovery-confined session is restricted to this page, so
          this native POST to /auth/signout is the guaranteed way out (clears the
          session + recovery marker). Also the right exit for a Google account that
          has no password to set here. */}
      <form
        action="/auth/signout"
        method="post"
        className="mt-7 pt-6 border-t border-[var(--border)] text-center"
      >
        <button
          type="submit"
          className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--brand-mid)] transition-colors"
        >
          Cancel and sign out
        </button>
      </form>
    </AuthCard>
  );
}
