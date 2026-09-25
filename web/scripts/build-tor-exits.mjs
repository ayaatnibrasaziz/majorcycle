#!/usr/bin/env node
/**
 * Refresh lib/tor-exits.json from the Tor Project's published exit list — ON VERCEL
 * BUILDS ONLY (lib/torExits.ts says why the list exists).
 *
 * Only on Vercel, because the file is committed: a local `pnpm build` rewriting it
 * would leave every developer with a dirty tree. Production is what needs a fresh
 * list, and production rebuilds daily.
 *
 * ⚠️ FAILS SAFE, NEVER SHORT. If the download fails, or comes back looking wrong —
 * an error page answering 200 is a known shape on this project (CLAUDE.md 11z) — the
 * committed copy is kept and the build carries on. A list that shrank to a handful
 * of addresses would quietly re-open the door, so anything under MIN_ADDRESSES is
 * refused as a bad download rather than trusted.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = 'https://check.torproject.org/torbulkexitlist';
const FILE = resolve(import.meta.dirname, '..', 'lib', 'tor-exits.json');
/** The live list has held ~1,200–1,500 exits; well under that is a broken fetch. */
const MIN_ADDRESSES = 500;

if (process.env.VERCEL !== '1') {
  console.log('tor-exits: not a Vercel build — using the committed list');
  process.exit(0);
}

const committed = JSON.parse(readFileSync(FILE, 'utf8'));
try {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const addresses = [...new Set(text.split(/\s+/).filter((l) => /^\d{1,3}(\.\d{1,3}){3}$/.test(l)))].sort();
  if (addresses.length < MIN_ADDRESSES) {
    throw new Error(`only ${addresses.length} addresses — refusing a list that short`);
  }
  writeFileSync(
    FILE,
    JSON.stringify({ source: SOURCE, fetchedAt: new Date().toISOString(), addresses }),
  );
  console.log(`tor-exits: refreshed — ${addresses.length} exits`);
} catch (err) {
  console.warn(
    `tor-exits: could not refresh (${err}) — keeping the committed list of ` +
      `${committed.addresses.length}, fetched ${committed.fetchedAt}`,
  );
}
