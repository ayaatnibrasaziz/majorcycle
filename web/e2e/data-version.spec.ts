import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * `stocks.data_version` must move FORWARD on every write, and never backwards.
 *
 * ── Why this suite exists ───────────────────────────────────────────────────
 * The screener caches its per-stock results outside this database (Vercel Runtime
 * Cache, `web/api/analyze.py`). Every cache key carries this counter, so an answer
 * computed from older data is not deleted — it is unreachable. That is the whole
 * staleness protection, and it rests entirely on the counter behaving.
 *
 * It is deliberately NOT a webhook. A webhook is a message and a message can fail
 * to arrive with nothing logged on the reading side, leaving the cache serving
 * yesterday's numbers indefinitely (CLAUDE.md 11z's shape: a silence that reads as
 * health). A trigger fires inside the transaction of the write itself, so there is
 * no delivery to miss and it covers writers nobody thought to hook.
 *
 * ⚠️ **The comparison in the trigger was wrong first, and the wrong direction.**
 * Written as `new.data_version IS DISTINCT FROM old.data_version`, any write
 * carrying a LOWER value was honoured verbatim: measured on the live table, one
 * upsert sending `data_version = 1` took a stock from 500 back to 1, and every
 * cached answer ever written at versions 1..500 became reachable again. Nothing
 * sends that column today — which is not the argument, because the point of a
 * trigger is to hold against writers that do not exist yet, including a Studio
 * edit, a restore, or an import that round-trips a whole row.
 *
 * Note the asymmetry the fix turns on: FAILING to bump costs one recompute, while
 * going BACKWARDS serves a customer a wrong number. The two directions are not
 * equally bad, so the guard is built for the worse one, and `>` makes the counter
 * monotonic by construction rather than by anyone remembering.
 *
 * ── What this file writes ───────────────────────────────────────────────────
 * Only the counter, on rows that already exist. It creates no rows, deletes none,
 * and needs no cleanup, and costs NOTHING: the two rows it writes to are benchmark
 * indices the screener never analyses, so there is no cached answer for a bumped
 * counter to discard. Every write is a value read from the row and put straight
 * back, so nothing rendered anywhere changes. This runs against the live database
 * on every push, so it must not be able to leave anything behind.
 *
 * ⚠️ **Which half this covers.** The `price_bars` UPDATE path is driven for real
 * below, because that is the split-and-dividend re-pull (11ae/11af) — the case
 * that rewrites HISTORY without adding a bar, and the one a trigger armed only on
 * INSERT would silently miss. The INSERT and DELETE paths are NOT driven here: on
 * a production table that would mean creating and removing a real price bar on
 * every CI run, and a cleanup that fails once leaves a poisoned chart. They were
 * proven by hand on 2026-09-09 (a new bar +1, a delete +1) and their wiring is
 * asserted from the migration by `analytics/tests/test_data_version_triggers.py`.
 * Saying which half a guard can see beats letting silence read as coverage (14g).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Two BENCHMARK INDEX rows, and the choice is the whole point.
 *
 * ⚠️ **The counter cannot be put back, by anything, ever — that is the protection,
 * not an oversight.** A write carrying a lower value is overridden with old + 1
 * (see the migration), because anything able to restore a version is equally able
 * to make a stale cached answer reachable again. So a test that touches a real
 * company leaves that company's counter permanently higher, and its next screen
 * pays one recompute.
 *
 * The fix is not to undo the write; it is to write somewhere the cache never
 * looks. `market = 'index'` rows are excluded from the screener universe
 * (`lib/universe.server.ts` filters `.neq('market', 'index')`), so these four
 * benchmarks are never analysed and hold no cached result. Bumping one costs
 * exactly nothing. Nothing else keys on `data_version` — the benchmark chart's own
 * cache turns over on the cron schedule, not on this column.
 *
 * They are also touched by no other spec, which removes a second problem: the
 * a11y sweep flaked once on `/stocks/us/AAPL` in the run that introduced this
 * file, and arguing a coincidence is harmless is worse than removing it.
 */
const SUBJECT = '^GSPC';
const BYSTANDER = '^IXIC';

async function versionOf(db: SupabaseClient, ticker: string): Promise<number> {
  const { data, error } = await db
    .from('stocks')
    .select('data_version')
    .eq('ticker', ticker)
    .single();
  expect(error, `reading data_version for ${ticker}`).toBeNull();
  return Number(data!.data_version);
}

test.describe('stocks.data_version — the screener cache cannot go stale', () => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, 'needs service credentials');

  let db: SupabaseClient;

  test.beforeAll(() => {
    db = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  test('reading a stock does not move its version', async () => {
    // The control. A counter that ticks on everything would satisfy every other
    // assertion in this file while emptying the cache on every screener run.
    const before = await versionOf(db, SUBJECT);
    await versionOf(db, SUBJECT);
    expect(await versionOf(db, SUBJECT)).toBe(before);
  });

  /** A write that changes nothing: the row's own `name`, read and put straight
   *  back. Enough to fire the trigger, impossible to alter what anyone sees. */
  const touch = async (ticker: string) => {
    const { data } = await db.from('stocks').select('name').eq('ticker', ticker).single();
    const { error } = await db.from('stocks').update({ name: data!.name }).eq('ticker', ticker);
    expect(error, `touching ${ticker}`).toBeNull();
  };

  test('writing the stock row moves its version forward', async () => {
    const before = await versionOf(db, SUBJECT);
    await touch(SUBJECT);
    expect(await versionOf(db, SUBJECT)).toBeGreaterThan(before);
  });

  test('rewriting an existing price bar moves the version — the split/dividend path', async () => {
    const { data: bar, error: readErr } = await db
      .from('price_bars')
      .select('date, close')
      .eq('ticker', SUBJECT)
      .order('date', { ascending: false })
      .limit(1)
      .single();
    expect(readErr).toBeNull();

    const before = await versionOf(db, SUBJECT);
    // Writes the bar's own value back: fires the trigger, changes no data. This is
    // the shape a re-pull takes — an upsert onto rows that already exist, which in
    // Postgres travels the UPDATE path and not the INSERT one.
    const { error } = await db
      .from('price_bars')
      .update({ close: bar!.close })
      .eq('ticker', SUBJECT)
      .eq('date', bar!.date);
    expect(error).toBeNull();
    expect(await versionOf(db, SUBJECT)).toBeGreaterThan(before);
  });

  test('a write that tries to set the version BACKWARDS still moves it forward', async () => {
    // The load-bearing assertion. A version seen twice means a cached answer built
    // from old data becomes reachable again.
    // Put the counter somewhere it can visibly fall FROM. Relying on a sibling test
    // to have run first would make this pass or fail on execution order, and on a
    // freshly migrated database every row starts at 1 with nothing to fall from.
    await touch(SUBJECT);
    const before = await versionOf(db, SUBJECT);
    expect(before, 'the subject must be past 1 for this to prove anything')
      .toBeGreaterThan(1);

    const { error } = await db
      .from('stocks')
      .update({ data_version: 1 })
      .eq('ticker', SUBJECT);
    expect(error).toBeNull();

    const after = await versionOf(db, SUBJECT);
    expect(after, 'the counter went backwards — stale answers are reachable').toBeGreaterThan(before);
  });

  test('one stock moving does not move another', async () => {
    const bystanderBefore = await versionOf(db, BYSTANDER);
    await touch(SUBJECT);
    expect(await versionOf(db, BYSTANDER)).toBe(bystanderBefore);
  });
});
