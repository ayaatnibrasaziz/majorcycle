'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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

/**
 * Why the sign-in page explains a dead link.
 *
 * `/auth/callback` and `/auth/confirm` both answer an invalid, expired or
 * already-used token with `?error=…`, and until 2026-08-12 nothing read it. The
 * app worked out the diagnosis and threw it away, leaving the reader on a blank
 * sign-in form with no idea why they were sent there. The likeliest real case is
 * a reset link clicked twice, or one clicked after it aged out — and Supabase
 * documents a third: link PREFETCHING, where a corporate mail scanner follows the
 * link before the human does and burns the one-time token. That reader did
 * nothing wrong and, with no message, has no way to know a retry would work.
 *
 * ⚠️ ALLOW-LISTED, and the provider's own words are NEVER rendered. Both the
 * query string and the hash are attacker-supplied: anyone can send a target
 * `…/login#error_description=Your+account+is+locked,+call+1-800-…` and, if we
 * echoed it, put their sentence on our sign-in page in our own error styling.
 * React escapes the markup, so this is not XSS — it is worse in the way that
 * matters, because the result looks completely legitimate. So a code is matched
 * against a fixed set and OUR sentence is shown. One sentence for every code:
 * the reader does not care which exchange failed, and the remedy is the same.
 *
 * ⚠️ The HASH is read as well as the query string, per Supabase's documented
 * error handling: GoTrue returns failures as URL fragments, which are never sent
 * to the server — so middleware and route handlers cannot see them and only a
 * client component can. Our own routes use the query string; the hash covers a
 * Supabase-side failure that never reached them, and browsers carry a fragment
 * across a redirect, so both can arrive on the same URL.
 */
const LINK_FAILURE_MESSAGE =
  'That link has expired or has already been used. Enter your email to get a new one.';

const LINK_FAILURE_CODES = new Set([
  // Ours, in the query string.
  'auth_callback_failed', // app/auth/callback/route.ts — OAuth code exchange
  'auth_confirm_failed', // app/auth/confirm/route.ts — email token_hash
  // Supabase's, in the hash.
  'otp_expired', // the emailed token aged out
  'access_denied', // already used, or consent refused at the provider
]);

function linkFailure(code: string | null | undefined): string | null {
  return code && LINK_FAILURE_CODES.has(code) ? LINK_FAILURE_MESSAGE : null;
}

/**
 * The URL fragment, read as an external store.
 *
 * `useSyncExternalStore` rather than `useEffect` + `setState`: the fragment is a
 * browser value that does not exist during server rendering, and React's own
 * lint rule rejects a synchronous setState in an effect (cascading renders).
 * This is the API for the job — and the server snapshot being empty is not a
 * workaround, it is the literal truth: a fragment is never transmitted to the
 * server, which is the whole reason this has to be read on the client.
 */
const subscribeToHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};
const readHash = () => window.location.hash;
const noHashOnTheServer = () => '';

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hash = useSyncExternalStore(subscribeToHash, readHash, noHashOnTheServer);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
  const hashFailure = linkFailure(
    hashParams.get('error_code') ?? hashParams.get('error'),
  );

  // A real sign-in error outranks the link notice: once you have tried, what
  // happened just now matters more than how you arrived.
  const notice = error ?? linkFailure(searchParams.get('error')) ?? hashFailure;

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
      // Clear any lingering recovery-confinement marker (httpOnly → server-side)
      // so a stale marker can't trap this fresh login on the password-set page.
      await fetch('/auth/recovery-done', { method: 'POST' }).catch(() => {});
      // Hard navigation (not router.push) so the freshly-set auth cookies are
      // sent with the request for `next`; a client transition can race cookie
      // propagation and bounce through /login before the session is visible.
      window.location.assign(next);
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

        {notice && (
          <div
            role="alert"
            className="flex items-start gap-2 text-[12px] text-[var(--c-tier-5-ink)] bg-[var(--tint-tier-5)] border border-[var(--tint-tier-5-strong)] rounded-[var(--radius-sm)] px-3 py-2.5"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
            <span className="leading-relaxed">{notice}</span>
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
          Create a free account
        </Link>
      </p>
    </AuthCard>
  );
}
