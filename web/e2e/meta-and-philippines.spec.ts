import { expect, test } from '@playwright/test';
import type Stripe from 'stripe';

import { cleanLocation, isShareableAddress } from '@/lib/analytics';
import { contentSecurityPolicy } from '@/lib/csp';
import { META_CSP, inEuropeanTimeZone, metaEventFor, metaPixelIdValid } from '@/lib/metaPixel';
import {
  META_GRAPH_VERSION,
  clientIpFrom,
  metaCheckoutMetadata,
  metaCookieFrom,
  metaEventsForStripeEvent,
  metaHash,
  metaWebsiteEvent,
  sendToMeta,
} from '@/lib/metaServer';
import { formErrorReason } from '@/lib/analytics';
import { CURRENCY_SYMBOL, PRICE_TABLE, formatCharge } from '@/lib/pricing';
import { currencyForCountry } from '@/lib/stripe';
import { LEARN_ARTICLES } from '@/lib/learn';
import { SITE } from '@/lib/email/format';
import { WELCOME_START_HERE, buildWelcomeEmail, welcomeEmailAllowed } from '@/lib/email/welcomeEmail';
import { ctaTarget, uiLabel } from '@/components/FunnelTracker';

/**
 * The Philippines launch (owner decisions, 2026-11-27): peso prices, Meta advertising
 * measurement in the browser (lib/metaPixel.ts) and from the Stripe webhook
 * (lib/metaServer.ts), the extra funnel events, and the one welcome email.
 *
 * Pure: no browser, no network, no credentials. What must hold:
 *   - a Filipino reader is priced and charged in pesos, at ₱299 / ₱899;
 *   - Meta hears the milestones and nothing personal: a hashed email at most, never the
 *     address itself, no name, no IP, and nothing at all from test-mode Stripe;
 *   - a Meta ad's landing page is still counted (`fbclid`), yet Google never receives it;
 *   - the pixel's script origin is two paths, never the whole Meta host;
 *   - the welcome email lists every Learn article and can never be sent from a dev
 *     server, a preview or to a test address.
 */

// ── Prices ─────────────────────────────────────────────────────────────────────
test.describe('peso prices', () => {
  test('a Filipino reader is priced in pesos at ₱299 a month and ₱899 a year', () => {
    expect(currencyForCountry('PH')).toBe('php');
    expect(currencyForCountry('ph')).toBe('php');
    expect(PRICE_TABLE.php).toEqual({ monthly: 299, annual: 899 });
    expect(CURRENCY_SYMBOL.php).toBe('₱');
    expect(formatCharge(29900, 'php')).toBe('₱299.00');
    // Control: the other markets are untouched.
    expect(currencyForCountry('AU')).toBe('aud');
    expect(currencyForCountry('CA')).toBe('cad');
    expect(currencyForCountry('US')).toBe('usd');
    expect(currencyForCountry('NZ')).toBe('usd');
    expect(PRICE_TABLE.usd).toEqual({ monthly: 15, annual: 126 });
  });
});

// ── The browser pixel ────────────────────────────────────────────────────────────
test.describe('Meta pixel (browser)', () => {
  test('Meta hears the milestones, and nothing else', () => {
    expect(metaEventFor('sign_up', { method: 'google' })).toEqual({
      name: 'CompleteRegistration', custom: false, params: { content_name: 'free_account', status: 'google' },
    });
    expect(metaEventFor('view_item', { items: [{ item_id: 'AAPL', item_name: 'AAPL', item_category: 'us' }] })).toEqual({
      name: 'ViewContent', custom: false, params: { content_type: 'stock', content_ids: ['AAPL'], content_category: 'us' },
    });
    // Checkout is sent from the SERVER only (the browser leaves for Stripe at once).
    expect(metaEventFor('begin_checkout', { plan: 'annual' })).toBeNull();
    expect(metaEventFor('view_paywall', { feature: 'verdict' })).toEqual({
      name: 'ViewPaywall', custom: true, params: { feature: 'verdict' },
    });
    expect(metaEventFor('run_screen', { tickers: 50 })).toEqual({ name: 'RunScreen', custom: true, params: {} });
    // Everything else stays in Google Analytics only.
    for (const e of ['login', 'search', 'filter_results', 'read_article', 'select_content', 'generate_lead',
      'account_deletion_requested', 'refer_friend', 'export_results', 'ui_click', 'view_section', 'form_error'] as const) {
      expect(metaEventFor(e, {}), e).toBeNull();
    }
  });

  test('a pixel id must look like one, or nothing loads', () => {
    expect(metaPixelIdValid('123456789012345')).toBe(true);
    expect(metaPixelIdValid('1234567890123456')).toBe(true);
    for (const bad of ['', '12345', 'abc', '123456789012345 ', '12345678901234567', '1e14']) {
      expect(metaPixelIdValid(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  test('visitors whose browser is set to a European time zone are left out', () => {
    for (const tz of ['Europe/London', 'Europe/Berlin', 'Europe/Dublin', 'Atlantic/Reykjavik', 'Atlantic/Canary']) {
      expect(inEuropeanTimeZone(tz), tz).toBe(true);
    }
    for (const tz of ['Asia/Manila', 'Australia/Sydney', 'America/Toronto', 'America/New_York', '']) {
      expect(inEuropeanTimeZone(tz), tz).toBe(false);
    }
  });

  test("a Meta ad's landing page is counted, and Google never receives the click id", () => {
    const landing = 'https://www.majorcycle.com/?fbclid=IwAR0abc_DEF-123&utm_source=meta';
    expect(isShareableAddress(landing)).toBe(true);
    expect(cleanLocation(landing)).toBe('https://www.majorcycle.com/?utm_source=meta');
    // Control: the gate still refuses everything it refused before.
    expect(isShareableAddress('https://www.majorcycle.com/auth/confirm?token_hash=abc')).toBe(false);
    expect(isShareableAddress('https://www.majorcycle.com/stocks?q=apple')).toBe(false);
  });

  test("the pixel's script is two paths on Meta's host, never the whole host", () => {
    const args = { nonce: 'n', dev: false, supabaseUrl: 'https://example.supabase.co', siteOrigin: 'https://www.majorcycle.com' };
    const policy = contentSecurityPolicy({
      ...args,
      analytics: { script: [...META_CSP.script], connect: [...META_CSP.connect], img: [...META_CSP.img] },
    });
    const dir = (name: string) => policy.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';
    const scripts = dir('script-src').split(' ');
    expect(scripts).toContain('https://connect.facebook.net/en_US/fbevents.js');
    expect(scripts).toContain('https://connect.facebook.net/signals/');
    expect(scripts).not.toContain('https://connect.facebook.net');
    expect(scripts.some((s) => s.includes('*'))).toBe(false);
    expect(dir('img-src')).toContain('https://www.facebook.com');
    expect(dir('connect-src')).toContain('https://www.facebook.com');
    // Control: without the pixel the policy names no Meta origin at all.
    expect(contentSecurityPolicy(args)).not.toContain('facebook');
  });
});

// ── The server half ──────────────────────────────────────────────────────────────
const FBP = 'fb.1.1764201234567.1234567890';
const FBC = 'fb.1.1764201234567.IwAR0abc_DEF-123';
const UA = 'Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile Safari/537.36';
const META = { user_id: 'uuid-of-user', meta_fbp: FBP, meta_fbc: FBC, meta_ua: UA };
const sub = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1', customer: 'cus_1', status: 'trialing', currency: 'php', metadata: META,
  items: { data: [{ price: { unit_amount: 89900, recurring: { interval: 'year' } } }] }, ...over,
});
const inv = (over: Record<string, unknown> = {}) => ({
  id: 'in_1', customer: 'cus_1', amount_paid: 89900, currency: 'php', billing_reason: 'subscription_cycle',
  customer_email: '  Reader@Example.com ', customer_name: 'A Reader',
  parent: { subscription_details: { subscription: 'sub_1', metadata: META } }, ...over,
});
const ev = (type: string, object: unknown, extra: Record<string, unknown> = {}, livemode = true) =>
  ({ id: 'evt_1', type, created: 1_764_201_234, livemode, data: { object, ...extra } }) as unknown as Stripe.Event;

test.describe('Meta Conversions API (server)', () => {
  test('a trial start is StartTrial, tied to the ad click, from the website', () => {
    const [e, ...rest] = metaEventsForStripeEvent(ev('customer.subscription.created', sub()));
    expect(rest).toEqual([]);
    expect(e).toEqual({
      event_name: 'StartTrial',
      event_time: 1_764_201_234,
      event_id: 'evt_1',
      action_source: 'website',
      event_source_url: 'https://www.majorcycle.com/account',
      user_data: { external_id: [metaHash('uuid-of-user')], fbp: FBP, fbc: FBC, client_user_agent: UA },
      custom_data: { currency: 'PHP', content_name: 'annual', value: 899 },
    });
  });

  test('a paid start, a converted trial, and a payment', () => {
    expect(metaEventsForStripeEvent(ev('customer.subscription.created', sub({ status: 'active' })))[0]?.event_name).toBe('Subscribe');
    const converted = metaEventsForStripeEvent(ev('customer.subscription.updated', sub({ status: 'active' }), { previous_attributes: { status: 'trialing' } }));
    expect(converted).toHaveLength(1);
    expect(converted[0]).toMatchObject({ event_name: 'Subscribe', action_source: 'system_generated' });
    const paid = metaEventsForStripeEvent(ev('invoice.paid', inv()));
    expect(paid[0]).toMatchObject({
      event_name: 'Purchase',
      action_source: 'system_generated',
      custom_data: { currency: 'PHP', value: 899, content_name: 'renewal', order_id: 'in_1' },
    });
    // The email reaches Meta only as Meta's documented hash of the normalised address.
    expect(paid[0]?.user_data['em']).toEqual([metaHash('reader@example.com')]);
    expect(metaHash('  Reader@Example.com ')).toBe(metaHash('reader@example.com'));
    expect(metaHash('reader@example.com')).toMatch(/^[0-9a-f]{64}$/);
  });

  test('nothing personal leaves in plain form, and test mode sends nothing', () => {
    const all = [
      ...metaEventsForStripeEvent(ev('customer.subscription.created', sub())),
      ...metaEventsForStripeEvent(ev('invoice.paid', inv())),
    ];
    const wire = JSON.stringify(all).toLowerCase();
    for (const plain of ['reader@example.com', 'a reader', 'uuid-of-user', 'cus_1']) {
      expect(wire, plain).not.toContain(plain);
    }
    expect(wire).not.toContain('ip_address');
    // Test-mode events (previews, CI, the owner's test purchases) never reach Meta.
    expect(metaEventsForStripeEvent(ev('customer.subscription.created', sub(), {}, false))).toEqual([]);
    expect(metaEventsForStripeEvent(ev('invoice.paid', inv(), {}, false))).toEqual([]);
  });

  test('the events Meta must not hear', () => {
    expect(metaEventsForStripeEvent(ev('invoice.paid', inv({ amount_paid: 0 })))).toEqual([]); // the trial's $0 invoice
    expect(metaEventsForStripeEvent(ev('customer.subscription.created', sub({ status: 'incomplete' })))).toEqual([]);
    expect(metaEventsForStripeEvent(ev('customer.subscription.updated', sub({ status: 'active' }), { previous_attributes: { cancel_at_period_end: true } }))).toEqual([]);
    for (const t of ['customer.subscription.deleted', 'invoice.payment_failed', 'charge.dispute.created', 'invoice.payment_succeeded']) {
      expect(metaEventsForStripeEvent(ev(t, inv())), t).toEqual([]);
    }
  });

  test('a first payment with no trial counts as from the website', () => {
    const [e] = metaEventsForStripeEvent(ev('invoice.paid', inv({ billing_reason: 'subscription_create' })));
    expect(e).toMatchObject({ action_source: 'website', custom_data: { content_name: 'first_payment' } });
  });

  test('cookies are taken only in the shape Meta writes them', () => {
    const header = `_ga=GA1.1.1.1; _fbp=${FBP}; _fbc=${FBC}`;
    expect(metaCookieFrom(header, '_fbp')).toBe(FBP);
    expect(metaCookieFrom(header, '_fbc')).toBe(FBC);
    for (const junk of ['_fbp=hello', '_fbp=fb.1.1.1', '_fbp=fb.1.1764201234567.12<script>', '_fbp=%E0%A4%A']) {
      expect(metaCookieFrom(junk, '_fbp'), junk).toBeNull();
    }
    expect(metaCookieFrom(null, '_fbp')).toBeNull();
    // Every value we put in Stripe metadata must fit its 500-character limit, or Stripe
    // refuses the checkout. The longest click id we accept still fits; one longer is dropped.
    const longest = `fb.1.1764201234567.${'a'.repeat(400)}`;
    expect(metaCookieFrom(`_fbc=${longest}`, '_fbc')).toBe(longest);
    expect(longest.length).toBeLessThanOrEqual(500);
    expect(metaCookieFrom(`_fbc=fb.1.1764201234567.${'a'.repeat(401)}`, '_fbc')).toBeNull();
    // Stripe caps a metadata value at 500 characters.
    const md = metaCheckoutMetadata(header, 'x'.repeat(900));
    expect(md).toEqual({ meta_fbp: FBP, meta_fbc: FBC, meta_ua: 'x'.repeat(500) });
    expect(metaCheckoutMetadata(null, null)).toEqual({});
    expect(metaCheckoutMetadata(null, null, '203.0.113.7', 'PH')).toEqual({ meta_ip: '203.0.113.7', meta_country: 'ph' });
    expect(metaCheckoutMetadata(null, null, null, 'Philippines')).toEqual({});
  });

  test('the IP is read from the platform header, and only a real address is kept', () => {
    const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    expect(clientIpFrom(h({ 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIpFrom(h({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' }))).toBe('198.51.100.2');
    expect(clientIpFrom(h({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    for (const bad of ['', 'not-an-ip', '1.2.3', '<script>']) {
      expect(clientIpFrom(h({ 'x-real-ip': bad })), bad).toBeNull();
    }
  });

  test('a server copy of a browser moment carries everything Meta matches on', () => {
    const e = metaWebsiteEvent({
      name: 'CompleteRegistration', eventId: 'reg_uuid-of-user', sourceUrl: 'https://www.majorcycle.com/stocks',
      userId: 'uuid-of-user', email: 'Reader@Example.com', cookieHeader: `_fbp=${FBP}; _fbc=${FBC}`,
      userAgent: UA, ip: '203.0.113.7', country: 'PH', now: new Date(1_764_201_234_000),
    });
    expect(e).toEqual({
      event_name: 'CompleteRegistration', event_time: 1_764_201_234, event_id: 'reg_uuid-of-user',
      action_source: 'website', event_source_url: 'https://www.majorcycle.com/stocks',
      user_data: {
        external_id: [metaHash('uuid-of-user')], em: [metaHash('reader@example.com')], fbp: FBP, fbc: FBC,
        client_user_agent: UA, client_ip_address: '203.0.113.7', country: [metaHash('ph')],
      },
      custom_data: {},
    });
    // Meta: the IP "must never be hashed"; the email and country always are.
    expect(JSON.stringify(e).toLowerCase()).not.toContain('reader@example.com');
  });

  test('the Graph API version is the one Meta documents', () => {
    expect(META_GRAPH_VERSION).toBe('v27.0');
  });

  test('with no token configured, nothing is sent', async () => {
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response('{}');
    }) as typeof fetch;
    try {
      delete process.env['META_CAPI_TOKEN'];
      await sendToMeta(metaEventsForStripeEvent(ev('invoice.paid', inv())));
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(calls).toBe(0);
  });
});

// ── Funnel ───────────────────────────────────────────────────────────────────────
test.describe('funnel: labels and form errors never carry a reader’s data', () => {
  test('a button label is our copy; an email or a long number is dropped', () => {
    expect(uiLabel('  Start 7-day   free trial ')).toBe('Start 7-day free trial');
    expect(uiLabel('maria@gmail.com')).toBeNull();
    expect(uiLabel('Account maria@gmail.com')).toBeNull();
    expect(uiLabel('Card 4242424242424242')).toBeNull();
    expect(uiLabel('')).toBeNull();
    expect(uiLabel('x'.repeat(90))).toHaveLength(60);
    // Control: a ticker and a year are fine.
    expect(uiLabel('AAPL 2026')).toBe('AAPL 2026');
  });

  test('a form error is our message, or "other"', () => {
    expect(formErrorReason('Incorrect email or password.')).toBe('Incorrect email or password.');
    expect(formErrorReason('User maria@gmail.com already exists')).toBe('other');
    expect(formErrorReason('')).toBe('other');
  });
});

test.describe('funnel: which links count as a call to action', () => {
  test('sign-up, sign-in and pricing on this site, and nothing else', () => {
    const o = 'https://www.majorcycle.com';
    expect(ctaTarget('/signup', o)).toBe('signup');
    expect(ctaTarget('/signup?plan=annual', o)).toBe('signup');
    expect(ctaTarget('/login', o)).toBe('login');
    expect(ctaTarget('https://www.majorcycle.com/pricing', o)).toBe('pricing');
    for (const href of ['/learn', '/stocks/us/AAPL', 'https://evil.com/signup', 'mailto:x@y.z', '']) {
      expect(ctaTarget(href, o), href).toBeNull();
    }
  });
});

// ── The welcome email ────────────────────────────────────────────────────────────
test.describe('the one welcome email', () => {
  test('it links every Learn article, start-here pieces first, and offers the trial', () => {
    const { bodyHtml, text } = buildWelcomeEmail('Maria');
    for (const a of LEARN_ARTICLES) {
      // SITE, not a literal: the test server sets NEXT_PUBLIC_SITE_URL to localhost.
      const url = `${SITE}/learn/${a.slug}`;
      expect(bodyHtml, a.slug).toContain(url);
      expect(text, a.slug).toContain(url);
    }
    // Both start-here slugs still exist — if one is renamed, this says so.
    for (const slug of WELCOME_START_HERE) {
      expect(LEARN_ARTICLES.some((a) => a.slug === slug), slug).toBe(true);
    }
    const first = WELCOME_START_HERE.map((s) => text.indexOf(`/learn/${s}`));
    const others = LEARN_ARTICLES.filter((a) => !(WELCOME_START_HERE as readonly string[]).includes(a.slug))
      .map((a) => text.indexOf(`/learn/${a.slug}`));
    expect(Math.max(...first)).toBeLessThan(Math.min(...others));
    expect(text).toContain(`${SITE}/account`);
    expect(text).toContain('not financial advice');
    expect(text).toContain(`${SITE}/contact`);
    // noreply@ is unmonitored: the email must never ask for a reply.
    expect(text.toLowerCase()).not.toMatch(/reply to this|just reply|hit reply/);
  });

  test('it sends only from production, and never to a test address', () => {
    expect(welcomeEmailAllowed('production', 'maria@gmail.com')).toBe(true);
    for (const env of [undefined, 'preview', 'development']) {
      expect(welcomeEmailAllowed(env, 'maria@gmail.com'), String(env)).toBe(false);
    }
    for (const addr of ['x@example.com', 'x@sub.example.org', 'a@foo.test', 'b@bar.invalid', 'c@dev.localhost']) {
      expect(welcomeEmailAllowed('production', addr), addr).toBe(false);
    }
    // Control: lookalikes are real addresses.
    expect(welcomeEmailAllowed('production', 'x@myexample.com')).toBe(true);
    expect(welcomeEmailAllowed('production', 'x@testing.com')).toBe(true);
  });
});
