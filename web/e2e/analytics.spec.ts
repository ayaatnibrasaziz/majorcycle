import { expect, test } from '@playwright/test';

import {
  GA_CSP,
  analyticsEnabledFor,
  cleanLocation,
  cleanReferrer,
  isShareableAddress,
} from '../lib/analytics';
import { contentSecurityPolicy } from '../lib/csp';

/**
 * Google Analytics (lib/analytics.ts): what Google may see, and where it may run.
 *
 * The first three tests are pure — the real functions, no browser — so they run on
 * a fork with no secrets. The last loads a real page on the dev server and asserts
 * that NOTHING is fetched from Google there, because localhost is not the live host.
 */

test.describe('analytics — what leaves the browser', () => {
  test('a page address keeps its path and campaign tags, and nothing else', () => {
    expect(
      cleanLocation('https://www.majorcycle.com/login?next=%2Faccount&error=expired#x'),
    ).toBe('https://www.majorcycle.com/login');
    expect(
      cleanLocation('https://www.majorcycle.com/stocks/au/BHP?preset=long&session_id=cs_live_x'),
    ).toBe('https://www.majorcycle.com/stocks/au/BHP?preset=long');
    // The return from Stripe: the setting that counts a trial survives, the session id never.
    expect(
      cleanLocation('https://www.majorcycle.com/account?checkout=success&session_id=cs_live_x'),
    ).toBe('https://www.majorcycle.com/account?checkout=success');
    // Control: the tags that say where a visit came from DO survive, or the owner
    // could not tell a Reddit visit from a YouTube one — and a cleaner that simply
    // dropped every query would pass the two lines above.
    expect(
      cleanLocation(
        'https://www.majorcycle.com/?utm_source=reddit&utm_medium=social&token=abc&utm_campaign=asx',
      ),
    ).toBe('https://www.majorcycle.com/?utm_source=reddit&utm_medium=social&utm_campaign=asx');
    expect(cleanLocation('not a url')).toBe('');
  });

  test('a referrer keeps only its origin and path', () => {
    expect(cleanReferrer('https://www.reddit.com/r/ASX/comments/abc/?share_id=xyz')).toBe(
      'https://www.reddit.com/r/ASX/comments/abc/',
    );
    expect(cleanReferrer('')).toBe('');
  });

  test('the tag may only START on an address with nothing private in it', () => {
    // Shareable: a bare page, campaign tags, an in-page anchor, no referrer at all.
    for (const ok of [
      'https://www.majorcycle.com/learn',
      'https://www.majorcycle.com/?utm_source=reddit&utm_campaign=asx',
      'https://www.majorcycle.com/stocks/us/AAPL#sec-thesis',
      '',
      'https://www.reddit.com/',
      // Present at start-up but blanked by the property's redaction list (lib/analytics.ts).
      'https://www.majorcycle.com/login?next=%2Faccount',
      'https://www.majorcycle.com/login?error=auth_callback_failed',
      'https://www.majorcycle.com/account?checkout=success',
      'https://www.majorcycle.com/stocks/au/BHP?preset=long',
    ]) {
      expect(isShareableAddress(ok), ok).toBe(true);
    }
    // Not: anything else in the query, a token in the fragment, junk.
    for (const bad of [
      'https://www.majorcycle.com/?utm_source=reddit&token=abc',
      'https://www.majorcycle.com/account?checkout=success&session_id=cs_live_x',
      'https://www.majorcycle.com/auth/confirm?token_hash=abc&type=recovery',
      'https://www.majorcycle.com/auth/callback#access_token=abc&type=recovery',
      'not a url',
    ]) {
      expect(isShareableAddress(bad), bad).toBe(false);
    }
  });

  test('it runs on the live host only', () => {
    expect(analyticsEnabledFor('www.majorcycle.com')).toBe(true);
    expect(analyticsEnabledFor('majorcycle.com')).toBe(true);
    for (const host of ['localhost', '127.0.0.1', 'majorcycle-git-feat-x.vercel.app', 'evil.com']) {
      expect(analyticsEnabledFor(host), host).toBe(false);
    }
  });

  test("Google's origins are in the policy when passed, and absent when not", () => {
    const args = {
      nonce: 'n',
      dev: false,
      supabaseUrl: 'https://example.supabase.co',
      siteOrigin: 'https://www.majorcycle.com',
    };
    const on = contentSecurityPolicy({ ...args, analytics: GA_CSP });
    const off = contentSecurityPolicy(args);
    const dir = (p: string, name: string) => p.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

    // Only the gtag path, never the whole Tag Manager host: `gtm.js?id=GTM-anyone`
    // would run code its container's owner wrote (lib/analytics.ts, GA_CSP).
    expect(dir(on, 'script-src')).toContain('https://www.googletagmanager.com/gtag/');
    expect(dir(on, 'script-src')).not.toContain('*.googletagmanager.com');
    expect(dir(on, 'connect-src')).toContain('https://*.google-analytics.com');
    expect(dir(on, 'connect-src')).toContain('https://*.analytics.google.com');
    expect(dir(on, 'img-src')).toContain('https://*.google-analytics.com');
    // Control: switched off, the policy is byte-identical to the one without the feature.
    expect(off).not.toContain('google-analytics');
    expect(off).not.toContain('googletagmanager');
  });
});

test('nothing is fetched from Google off the live host', async ({ page }) => {
  const google: string[] = [];
  page.on('request', (r) => {
    if (/googletagmanager\.com|google-analytics\.com/.test(r.url())) google.push(r.url());
  });
  await page.goto('/');
  await page.waitForLoadState('load');
  // Past the idle callback the tag would be installed in.
  await page.waitForTimeout(1500);
  // Positive control: the page really ran its scripts (the film wires itself up).
  await expect(page.locator('[data-film]')).toBeVisible();
  expect(await page.evaluate(() => typeof (window as { gtag?: unknown }).gtag)).toBe('undefined');
  expect(google).toEqual([]);
});
