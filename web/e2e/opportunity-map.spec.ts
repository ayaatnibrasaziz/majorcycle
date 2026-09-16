import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

/**
 * The Opportunity Map, on a screen that has actually been run.
 *
 * ⚠️ THIS SURFACE HAD NO TEST OF ANY KIND. `/results` renders NOTHING until a
 * screen completes — the rows live in client state, not in a table anyone can
 * seed — so every sweep that has ever visited it measured an empty page and
 * reported it clean. That is the same false-clean as auditing a paid surface on
 * a free account (CLAUDE.md 11bd) and as searching for a needle that cannot
 * match (11v): the check ran, found nothing, and had nothing to find.
 *
 * So this drives a REAL run — the Magnificent Seven, the smallest basket the
 * product offers — and then measures. What it found on the first pass, at 320px:
 *
 *   · the legend chip "Neutral" printed INSIDE the plot, across "Weak but
 *     cheap" and "Opportunity Zone" (21x6 and 16x6 of shared ink, 11x6 and 6x6
 *     at 340). The legend was a Recharts `<Legend verticalAlign="top">`, which
 *     reserves one row of height; a second row lands on the chart.
 *   · "Weak & expensive" and "Healthy, fully priced" overlapping by 13px,
 *     reading as one run-together phrase.
 *   · "Weak but cheap" and "Opportunity Zone" touching, gap exactly 0.
 *
 * ⚠️ And the run that found it showed only THREE tiers. The legend lists a chip
 * per tier PRESENT, so a screen spanning all five is ~430px of chips and wraps
 * at about 490px — far commoner than 320. The phone is where it was seen, not
 * where it ends; the fix (an ordinary DOM list above the plot) is structural for
 * that reason, and this test asserts the outcome rather than the markup.
 *
 * ⚠️ THE FOUR ZONE NAMES ARE CONDITIONAL (owner, 2026-09-16). They belong INSIDE
 * their quadrants — that is where they read best and the desktop layout is not to
 * change — and they move to a legend under the chart only *"when the screen size
 * becomes small and the text is overlapping / away from its own quadrant"*.
 *
 * So the rule has three parts, and each fails differently:
 *   · exactly one of the two presentations is on at any width (never both, and
 *     never neither — a chart with no zone names anywhere is the real defect);
 *   · a name drawn INSIDE the chart must fit inside its own quadrant, since the
 *     quadrants are 65% and 35% of the plot and the right-hand pair is tight;
 *   · the tier legend above the plot never prints on the plot.
 */

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const RUN = Date.now();
const EMAIL = `oppmap-e2e-${RUN}@example.com`;
const PASSWORD = `E2e!oppmap-${RUN}`;

/** 320 is this product's floor; 490 is where a five-tier legend wraps. */
const WIDTHS = [320, 340, 360, 375, 414, 480, 520, 768, 1024, 1280];

type Box = { t: string; x: number; y: number; r: number; b: number };

function overlap(a: Box, z: Box): { w: number; h: number } | null {
  const w = Math.min(a.r, z.r) - Math.max(a.x, z.x);
  const h = Math.min(a.b, z.b) - Math.max(a.y, z.y);
  return w > 1 && h > 1 ? { w: Math.round(w), h: Math.round(h) } : null;
}

test.describe('the Opportunity Map on a completed screen', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(
    !SERVICE_KEY || !SUPABASE_URL,
    'set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to run',
  );

  let admin: SupabaseClient;
  let userId = '';

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: created, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      email_confirm: true,
      password: PASSWORD,
    });
    if (error || !created?.user) throw new Error(`could not create user: ${error?.message}`);
    userId = created.user.id;
    const { error: upd } = await admin
      .from('profiles')
      .update({
        subscription_status: 'active',
        grace_until: null,
        billing_blocked: false,
        acknowledged_disclaimer_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (upd) throw new Error(`could not grant entitlement: ${upd.message}`);
  });

  test.afterAll(async () => {
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  async function runTheScreen(page: Page): Promise<number> {
    await page.goto('/login');
    await page.fill('input#email', EMAIL);
    await page.fill('input#password', PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/stocks/, { timeout: 45_000 });

    await page.goto('/run');
    await page.locator('button.basket-chip', { hasText: 'Magnificent Seven' }).click();
    await page.locator('button.btn-run').click();
    await page.waitForURL(/\/results/, { timeout: 300_000 }).catch(() => {});
    await page.goto('/results');
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('.opp-legend-item').length), {
        message: 'the Opportunity Map legend never rendered',
        timeout: 120_000,
      })
      .toBeGreaterThan(1);
    await page.waitForTimeout(800);
    return page.evaluate(() => document.querySelectorAll('.opp-legend-item').length);
  }

  test('the legend never prints on the plot, and no two quadrant labels collide', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const tiers = await runTheScreen(page);

    const failures: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(700);

      const seen = await page.evaluate(() => {
        const wrap = document.querySelector('.opp-map-wrap');
        const svg = wrap?.querySelector('svg');
        const card = wrap?.closest('.card, section');
        if (!wrap || !svg || !card) return null;
        const box = (e: Element, t?: string) => {
          const r = e.getBoundingClientRect();
          return { t: t ?? (e.textContent ?? '').trim(), x: r.left, y: r.top, r: r.right, b: r.bottom };
        };
        const ZONE_WORDS = /Opportunity\s*Zone|Weak\s*but\s*cheap|Weak\s*&\s*expensive|fully\s*priced/;
        const grid = svg.querySelector('.recharts-cartesian-grid')?.getBoundingClientRect();
        return {
          // Zone names drawn inside the chart, with the box each one has to fit.
          inChart: [...svg.querySelectorAll('text')]
            .filter((t) => ZONE_WORDS.test((t.textContent ?? '').replace(/\s+/g, ' ')))
            .map((t) => box(t, (t.textContent ?? '').replace(/\s+/g, ' ').trim())),
          // The same names in the legend below, when that is what is on.
          inLegend: [...card.querySelectorAll('.opp-zone-name')].map((z) => box(z)),
          chips: [...wrap.querySelectorAll('.opp-legend-item')].map((c) => box(c)),
          plot: box(svg, 'the plot'),
          gridLeft: grid?.left ?? null,
          gridWidth: grid?.width ?? null,
        };
      });

      expect(seen, `the Opportunity Map did not render at ${width}px`).not.toBeNull();
      const { inChart, inLegend, chips, plot, gridLeft, gridWidth } = seen!;

      // THE CONTROL. Exactly ONE presentation, and four names in it — "nothing
      // overlaps" is satisfied perfectly by a card that names its zones nowhere.
      const named = inChart.length > 0 ? inChart.length : inLegend.length;
      expect(
        named,
        `${inChart.length} zone names in the chart and ${inLegend.length} in a legend at ` +
          `${width}px — the map has four regions and must name them in exactly one place`,
      ).toBe(4);
      expect(
        inChart.length > 0 && inLegend.length > 0,
        `both presentations are on at ${width}px — the names are in the chart AND in a legend`,
      ).toBe(false);
      expect(chips.length, `the legend lost its tier chips at ${width}px`).toBe(tiers);

      // A name kept in the chart has to fit the quadrant it names. The divider is
      // at 65, so the right-hand pair gets 35% of the plot and is the tight one.
      if (inChart.length > 0 && gridLeft !== null && gridWidth !== null) {
        for (const z of inChart) {
          const onRight = z.x - gridLeft > gridWidth * 0.5;
          const room = gridWidth * (onRight ? 0.35 : 0.65);
          const w = z.r - z.x;
          if (w > room) {
            failures.push(
              `${width}px: "${z.t}" is ${Math.round(w)}px in a ${Math.round(room)}px quadrant — ` +
                'it has left its own region, so the legend should have taken over',
            );
          }
        }
      }

      for (const chip of chips) {
        const hit = overlap(chip, plot);
        if (hit) failures.push(`${width}px: legend chip "${chip.t}" sits ON the plot (${hit.w}x${hit.h})`);
      }
      const all = [...inChart, ...inLegend];
      for (let i = 0; i < all.length; i += 1) {
        for (let j = i + 1; j < all.length; j += 1) {
          const hit = overlap(all[i]!, all[j]!);
          if (hit) {
            failures.push(
              `${width}px: zone names "${all[i]!.t}" and "${all[j]!.t}" overlap by ${hit.w}x${hit.h}`,
            );
          }
        }
      }
    }

    expect(
      failures,
      `the Opportunity Map is unreadable at these widths:\n  ${failures.join('\n  ')}\n` +
        'The tier legend must live OUTSIDE the SVG so a wrapped row pushes the plot down; the ' +
        'four zone names stay INSIDE their quadrants while they fit, and move to a legend below ' +
        'only when they no longer do.',
    ).toEqual([]);
  });
});
