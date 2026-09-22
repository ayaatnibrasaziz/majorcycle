import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { expect, test } from '@playwright/test';

import { contentSecurityPolicy } from '../lib/csp';
import { TURNSTILE_ORIGIN, TURNSTILE_ROUTES } from '../lib/turnstile';
import { passCaptchaForTests } from './lib/captcha';

/**
 * The human check (Cloudflare Turnstile) — 2026-09-22. Read lib/turnstile.ts first.
 *
 * ⚠️ WHAT THIS FILE CAN AND CANNOT SEE (14g). The enforcement is Supabase's and
 * uses the production secret, which no test holds; so no test here can prove a
 * bot is refused. What it proves is our half: every form that asks Supabase to
 * sign in, sign up or send a reset obtains a token and hands it over, renews it
 * after each attempt, fails visibly when Cloudflare cannot load, and that the
 * CSP admits Cloudflare on exactly those pages. The refusal itself was checked
 * by hand against the live project and is recorded in docs/architecture.md.
 */

const ROOT = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Strip comments so a sentence documenting the rule cannot satisfy it (11c-iv). */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CAPTCHA_CALLS = /\.auth\.(signUp|signInWithPassword|resetPasswordForEmail|signInWithOtp|resend)\(/;

test.describe('every captcha-checked auth call carries a token', () => {
  const callers = ['app', 'components', 'lib']
    .flatMap((d) => sourceFiles(join(ROOT, d)))
    .filter((f) => CAPTCHA_CALLS.test(code(f)));

  test('the sweep found the forms', () => {
    // CONTROL: a scan that finds nothing passes every assertion below.
    expect(callers.map((f) => relative(ROOT, f).replace(/\\/g, '/')).sort()).toEqual([
      'app/(public)/login/LoginForm.tsx',
      'app/(public)/reset-password/ResetPasswordForm.tsx',
      'app/(public)/signup/SignupForm.tsx',
      'components/account/PasswordForm.tsx',
    ]);
  });

  for (const file of callers) {
    const name = relative(ROOT, file).replace(/\\/g, '/');
    test(`${name} obtains, sends and renews the token`, () => {
      const src = code(file);
      expect(src, 'mounts the check').toMatch(/useCaptcha\(/);
      expect(src, 'passes the token to Supabase').toMatch(/\.\.\.captcha\.options|options:\s*captcha\.options/);
      expect(src, 'renews it after the attempt — a token is single-use').toMatch(/captcha\.renew\(\)/);
      expect(src, 'holds the button until a token exists').toMatch(/!captcha\.ready/);
      expect(src, 'draws the widget').toMatch(/\{captcha\.widget\}/);
    });
  }
});

test.describe('the CSP admits Cloudflare only where the check is drawn', () => {
  const base = {
    nonce: 'n',
    dev: false,
    supabaseUrl: 'https://x.supabase.co',
    siteOrigin: 'https://www.majorcycle.com',
  };
  const directive = (p: string, d: string) =>
    p.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${d} `)) ?? '';

  test('named in script-src and frame-src, and nowhere else', () => {
    const p = contentSecurityPolicy({ ...base, turnstileOrigin: TURNSTILE_ORIGIN });
    expect(directive(p, 'script-src')).toContain(TURNSTILE_ORIGIN);
    expect(directive(p, 'frame-src')).toContain(TURNSTILE_ORIGIN);
    expect(directive(p, 'frame-src')).toContain('https://accounts.google.com');
    for (const d of ['connect-src', 'img-src', 'style-src', 'form-action']) {
      expect(directive(p, d), `${d} gained Cloudflare`).not.toContain(TURNSTILE_ORIGIN);
    }
  });

  test('CONTROL — without it the policy is byte-identical to before', () => {
    expect(contentSecurityPolicy({ ...base, turnstileOrigin: null })).toBe(contentSecurityPolicy(base));
    expect(contentSecurityPolicy(base)).not.toContain('cloudflare');
  });

  test('the four pages, and exactly those', () => {
    expect([...TURNSTILE_ROUTES].sort()).toEqual(['/account', '/login', '/reset-password', '/signup']);
  });

  test('on the wire: /login carries it, /pricing does not', async ({ request }) => {
    const login = (await request.get('/login')).headers()['content-security-policy'] ?? '';
    const pricing = (await request.get('/pricing')).headers()['content-security-policy'] ?? '';
    expect(login, 'a policy was sent').toContain('script-src');
    expect(login).toContain(TURNSTILE_ORIGIN);
    expect(pricing).toContain('script-src');
    expect(pricing).not.toContain(TURNSTILE_ORIGIN);
  });
});

test.describe('the widget, in a browser, with the always-pass test key', () => {
  test.skip(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, 'set NEXT_PUBLIC_TURNSTILE_SITE_KEY (the test key) to run');

  test('the sign-in button waits for a token, then unlocks — with no CSP refusal', async ({ page }) => {
    const refused: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) refused.push(m.text());
    });
    // ⚠️ Not the widget's iframe: Turnstile draws it inside a CLOSED shadow root,
    // which no locator can enter — a count of 0 there says nothing. The script
    // arriving from Cloudflare and the button unlocking (which needs a token from
    // its callback) are the two observable halves.
    const fromCloudflare = page.waitForResponse(
      (r) => r.url().startsWith(`${TURNSTILE_ORIGIN}/turnstile/`) && r.ok(),
      { timeout: 30_000 },
    );
    await page.goto('/login');
    await fromCloudflare;
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeEnabled({ timeout: 30_000 });
    expect(refused, 'the CSP refused something on /login').toEqual([]);
  });

  test('after a failed attempt the form gets a FRESH check and can be retried', async ({ page }) => {
    await passCaptchaForTests(page);
    const sent: string[] = [];
    page.on('request', (r) => {
      if (/\/auth\/v1\/token/.test(r.url()) && r.method() === 'POST') {
        sent.push(JSON.parse(r.postData() ?? '{}')?.gotrue_meta_security?.captcha_token ?? '');
      }
    });
    // Each widget render asks Cloudflare for a new challenge. ⚠️ This, not the token,
    // is the evidence of renewal: the always-pass test key hands out the SAME dummy
    // token every time, so comparing tokens cannot tell a fresh one from a reused
    // one — and a deliberate break (renew() deleted) passed a token-only version.
    let challenges = 0;
    page.on('request', (r) => {
      if (r.url().includes('/cdn-cgi/challenge-platform/')) challenges += 1;
    });
    await page.goto('/login');
    const button = page.getByRole('button', { name: /^sign in$/i });
    await expect(button).toBeEnabled({ timeout: 30_000 });
    const before = challenges;
    expect(before, 'the first check never reached Cloudflare').toBeGreaterThan(0);
    await page.fill('input#email', 'nobody-turnstile@example.com');
    await page.fill('input#password', 'definitely-not-the-password');
    await button.click();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText(/doesn't match our records/, { timeout: 30_000 });
    // Renewed: a NEW check ran after the spent token, and the form is usable again.
    await expect.poll(() => challenges, { timeout: 30_000, message: 'no fresh check after the attempt' }).toBeGreaterThan(before);
    await expect(button).toBeEnabled({ timeout: 30_000 });
    await button.click();
    await expect.poll(() => sent.length, { timeout: 30_000 }).toBe(2);
    expect(sent.every((t) => t.length > 0), 'every attempt carried a token').toBe(true);
  });

  test('if Cloudflare cannot load, the reader is TOLD, and the form does not pretend', async ({ page }) => {
    await page.route(`${TURNSTILE_ORIGIN}/**`, (route) => route.abort());
    await page.goto('/login');
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText(/security check/i, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeDisabled();
  });
});
