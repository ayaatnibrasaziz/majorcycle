'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/authErrors';

interface PasswordFormProps {
  email: string;
}

export function PasswordForm({ email }: PasswordFormProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (next.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    if (next === current) {
      setError('Your new password must be different from your current one.');
      return;
    }

    setLoading(true);
    const supabase = createBrowserClient();

    // Re-verify the current password before allowing a change. This is a barrier
    // against a hijacked (session-only) attacker: knowing the session isn't
    // enough — they must also prove the existing password.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (reauthError) {
      setError('Your current password is incorrect.');
      setLoading(false);
      return;
    }

    // Current password verified → set the new one. This fires Supabase's branded
    // "password changed" security email.
    const { error: updateError } = await supabase.auth.updateUser({
      password: next,
    });
    if (updateError) {
      setError(friendlyAuthError(updateError.message));
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Password</h2>
      </div>
      <div className="card-body">
        <p className="mb-5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Change your password. We&apos;ll ask for your current one first, then
          email you to confirm the change.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
          {/* Hidden username field for password-manager association (a11y + UX). */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            hidden
            aria-hidden
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value);
                setDone(false);
              }}
              placeholder="Your current password"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                setDone(false);
              }}
              placeholder="Minimum 8 characters"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setDone(false);
              }}
              placeholder="Re-enter your new password"
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

          {done && (
            <div
              role="status"
              className="flex items-start gap-2 text-[12px] text-[var(--c-tier-2)] bg-[var(--tint-tier-2)] border border-[var(--tint-tier-2-strong)] rounded-[var(--radius-sm)] px-3 py-2.5"
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-px" strokeWidth={2} />
              <span className="leading-relaxed">
                Your password has been changed. We&apos;ve emailed you to confirm.
              </span>
            </div>
          )}

          <Button type="submit" disabled={loading} className="mt-1 self-start">
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </section>
  );
}
