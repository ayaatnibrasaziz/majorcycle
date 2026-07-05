'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { GoogleButton } from '@/components/GoogleButton';
import { createBrowserClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/authErrors';
import { getSiteURL, safeNextPath } from '@/lib/url';

// ── Minimal typings for the Google Identity Services (GIS) client ────────────
interface CredentialResponse {
  credential: string;
}
interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    nonce?: string;
    use_fedcm_for_prompt?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'small' | 'medium' | 'large';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
    }
  ): void;
  prompt(): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

interface GoogleSignInProps {
  /** Where to land after a successful sign-in. */
  next: string;
  /** Surface auth errors to the host form. */
  onError: (message: string) => void;
  /** Only affects the fallback button (Google renders its own when active). */
  disabled?: boolean;
  /** Button copy — signup pages use `signup_with`. */
  label?: 'signin_with' | 'signup_with' | 'continue_with';
}

/** Generate a nonce: hashed (SHA-256 hex) for Google, raw for Supabase. */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hashed };
}

/**
 * Google sign-in that avoids the `*.supabase.co` address-bar flash.
 *
 * When `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set it uses Google Identity Services
 * (official button + One Tap) → `signInWithIdToken`, so Google returns the ID
 * token directly to this page and the browser never travels to supabase.co.
 *
 * When that env var is missing (e.g. before the console step is done) it falls
 * back to the classic redirect flow so Google sign-in keeps working — this
 * reintroduces the brief flash only until the client ID is configured.
 */
export function GoogleSignIn({ next, onError, disabled, label = 'continue_with' }: GoogleSignInProps) {
  const router = useRouter();
  const clientId = process.env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'];
  const buttonRef = useRef<HTMLDivElement>(null);
  const rawNonceRef = useRef<string>('');
  const [scriptReady, setScriptReady] = useState(false);

  // Exchange Google's ID token with Supabase — no redirect to supabase.co.
  const handleCredential = useCallback(
    async (response: CredentialResponse) => {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
        nonce: rawNonceRef.current,
      });
      if (error) {
        onError(friendlyAuthError(error.message));
        return;
      }
      router.push(safeNextPath(next));
      router.refresh();
    },
    [next, onError, router]
  );

  // Fallback only — classic redirect flow when no client ID is configured yet.
  const handleRedirectFallback = useCallback(async () => {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getSiteURL()}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`,
      },
    });
    if (error) onError(friendlyAuthError(error.message));
  }, [next, onError]);

  useEffect(() => {
    if (!clientId || !scriptReady || !buttonRef.current || !window.google) return;
    let cancelled = false;
    (async () => {
      const { raw, hashed } = await makeNonce();
      if (cancelled || !buttonRef.current || !window.google) return;
      rawNonceRef.current = raw;
      const api = window.google.accounts.id;
      api.initialize({
        client_id: clientId,
        callback: handleCredential,
        nonce: hashed,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: true,
      });
      const width = Math.max(240, Math.min(buttonRef.current.offsetWidth || 400, 400));
      api.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: label,
        shape: 'pill',
        logo_alignment: 'center',
        width,
      });
      api.prompt();
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, scriptReady, handleCredential, label]);

  // No client ID yet → safe fallback button (redirect flow, keeps sign-in live).
  if (!clientId) {
    return (
      <GoogleButton
        onClick={handleRedirectFallback}
        disabled={disabled}
        label={label === 'signup_with' ? 'Sign up with Google' : 'Continue with Google'}
      />
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      {/* Google renders its official button into this container. It lives in a
          cross-origin iframe, so it can't be custom-styled — width is matched
          to the container for mobile (375px) responsiveness. */}
      <div ref={buttonRef} className="flex justify-center min-h-[44px]" aria-busy={!scriptReady} />
    </>
  );
}
