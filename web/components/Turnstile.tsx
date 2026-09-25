'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { CAPTCHA_REQUIRED, TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY } from '@/lib/turnstile';

/**
 * The Turnstile widget and the one hook every auth form uses to drive it.
 *
 * The protection is Supabase's, not this component's — read `lib/turnstile.ts`
 * first. This only obtains a token for Supabase to verify.
 */

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * One script for the whole page, however many forms mount. A failed load clears
 * the promise so the next mount can try again rather than inheriting the failure.
 */
let loading: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    // Allowed by URL: the CSP names Cloudflare's origin on every page while the
    // check is on (lib/turnstile.ts `turnstileCspOrigin`), so no nonce is needed.
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing'));
    script.onerror = () => {
      loading = null;
      reject(new Error('turnstile failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Below this the "flexible" widget (300px minimum) would push a 320px phone sideways. */
const FLEXIBLE_MIN_PX = 300;

function TurnstileWidget({
  action,
  onToken,
}: {
  action: string;
  onToken: (token: string | null) => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !slot.current) return;
        widgetId = api.render(slot.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          // Invisible unless Cloudflare genuinely needs the reader to click: for
          // nearly everyone the form looks exactly as it did before.
          appearance: 'interaction-only',
          size: slot.current.clientWidth < FLEXIBLE_MIN_PX ? 'compact' : 'flexible',
          theme: 'light',
          'refresh-expired': 'auto',
          callback: (token: string) => {
            setFailed(false);
            onToken(token);
          },
          'expired-callback': () => onToken(null),
          'error-callback': () => {
            onToken(null);
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, onToken]);

  return (
    <>
      <div ref={slot} className="turnstile-slot" />
      {failed && (
        <p role="alert" className="text-[12px] leading-relaxed text-[var(--status-danger-ink)]">
          We couldn&rsquo;t run our quick security check. Check your connection, or allow
          challenges.cloudflare.com if you use a content blocker, then reload the page.
        </p>
      )}
    </>
  );
}

/**
 * The token for ONE submission.
 *
 * - `ready` gates the submit button: with no site key it is always true, so the
 *   forms behave exactly as before until the owner switches the check on.
 * - `options` spreads into a Supabase auth call's `options`.
 * - ⚠️ `renew()` after EVERY attempt, success or failure. A Turnstile token is
 *   single-use: Supabase spends it verifying, so a reader who mistypes a password
 *   and tries again would otherwise be refused with no way forward but a reload.
 */
export function useCaptcha(action: string): {
  ready: boolean;
  options: { captchaToken?: string };
  widget: ReactNode;
  renew: () => void;
} {
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  return {
    ready: !CAPTCHA_REQUIRED || token !== null,
    options: token ? { captchaToken: token } : {},
    // `key={round}` remounts the widget, which is Turnstile's documented way to get
    // a fresh token; a stale one can then never be sent twice.
    widget: CAPTCHA_REQUIRED ? (
      <TurnstileWidget key={round} action={action} onToken={setToken} />
    ) : null,
    renew: () => {
      setToken(null);
      setRound((r) => r + 1);
    },
  };
}
