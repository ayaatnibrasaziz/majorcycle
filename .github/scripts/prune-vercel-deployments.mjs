#!/usr/bin/env node
/**
 * Delete old Vercel deployments so Function Storage stops filling up.
 *
 * ── Why this exists (2026-09-08) ────────────────────────────────────────────
 * Vercel emailed that the free team had used 100% of its 10 GB Function
 * Storage. Nothing about the site is big; the storage is OLD COPIES. Every
 * deployment keeps its own function bundles, and this project ships TWO Python
 * functions that each bundle pandas + numpy:
 *
 *     measured, unpacked:  pandas 44 MB + numpy 30 MB + numpy.libs 27 MB
 *                          + cryptography 15 MB + the rest  =  134 MB
 *     per deployment:      134 MB x 2 Python functions      =  ~268 MB
 *
 * and the project deploys roughly four times a day (every push, plus a nightly
 * data commit to main). Nothing ever removed the old ones.
 *
 * ⚠️ DELETION IS IRREVERSIBLE, so the rules here are deliberately timid and the
 * script REFUSES to guess. It deletes a deployment only when ALL of these hold:
 *
 *   - it is not the current production deployment;
 *   - it is not one of the newest KEEP_PRODUCTION production deployments
 *     (so Instant Rollback still has somewhere to go);
 *   - it is older than KEEP_DAYS;
 *   - its state is settled (READY / ERROR / CANCELED) — never one that is
 *     BUILDING or QUEUED, which would kill a live build.
 *
 * ⚠️ DRY RUN IS THE DEFAULT. It prints what it would delete and exits 0. Pass
 * --apply (or set APPLY=1) to actually delete. A script whose default is
 * destructive is one bad cron expression away from an outage.
 *
 * Needs VERCEL_TOKEN (a personal API token) and VERCEL_TEAM_ID.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Read the repo-root .env.local when a variable is not already in the
// environment, so a local dry run is one command. This is a no-op in CI: the
// file does not exist on a runner, and an already-set value always wins, so
// nothing here can quietly override the workflow's own secret.
try {
  for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
    if (line.trimStart().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (value && process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
} catch {
  // Absent (CI, or a fresh clone) — fine; the check below says what is missing.
}

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID;
const PROJECT = process.env.VERCEL_PROJECT || 'majorcycle';
const KEEP_DAYS = Number(process.env.KEEP_DAYS || 14);
const KEEP_PRODUCTION = Number(process.env.KEEP_PRODUCTION || 5);
const APPLY = process.argv.includes('--apply') || process.env.APPLY === '1';

if (!TOKEN || !TEAM) {
  console.error(
    'VERCEL_TOKEN and VERCEL_TEAM_ID are required.\n' +
      '  local : put them in .env.local at the repo root\n' +
      '  CI    : VERCEL_TOKEN is a repo secret, VERCEL_TEAM_ID a repo variable',
  );
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) },
  });
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
};

/** Every deployment, newest first. The API pages backwards via `until`. */
async function listAll() {
  const out = [];
  let until;
  for (;;) {
    const qs = new URLSearchParams({ projectId: PROJECT, teamId: TEAM, limit: '100' });
    if (until) qs.set('until', String(until));
    const { deployments, pagination } = await api(`/v6/deployments?${qs}`);
    if (!deployments?.length) break;
    out.push(...deployments);
    if (!pagination?.next) break;
    until = pagination.next;
  }
  return out;
}

const all = await listAll();
const cutoff = Date.now() - KEEP_DAYS * 86_400_000;

const production = all
  .filter((d) => d.target === 'production')
  .sort((a, b) => b.created - a.created);
const keepIds = new Set(production.slice(0, KEEP_PRODUCTION).map((d) => d.uid || d.id));

const SETTLED = new Set(['READY', 'ERROR', 'CANCELED']);
const doomed = all.filter((d) => {
  if (keepIds.has(d.uid || d.id)) return false;
  if (!SETTLED.has(d.state)) return false;
  return d.created < cutoff;
});

// ⚠️ NO GIGABYTE ESTIMATE IS PRINTED, deliberately. The obvious one — 268 MB of
// unpacked dependencies per deployment — does not reconcile: 216 retained
// deployments x 268 MB is ~58 GB against a quota of 10 GB that Vercel says is
// 100% used. So Vercel's Function Storage is accounted differently (compressed
// bundles, or shared layers, or only a subset of deployments) and the multiplier
// is not something this script can stand behind. Printing it anyway would be a
// confident number nobody had checked, which is how a wrong figure gets quoted
// back later as fact. The COUNT is exact; the count is what is reported.

console.log(`project           : ${PROJECT}`);
console.log(`deployments total : ${all.length}  (production ${production.length})`);
console.log(
  `keeping           : newest ${KEEP_PRODUCTION} production + everything < ${KEEP_DAYS} days old`,
);
console.log(
  `to delete         : ${doomed.length} of ${all.length} (${Math.round((100 * doomed.length) / all.length)}% of stored deployments)`,
);
console.log(`mode              : ${APPLY ? 'APPLY — deleting' : 'DRY RUN — nothing will be deleted'}\n`);

if (!doomed.length) process.exit(0);

let ok = 0;
let failed = 0;
for (const d of doomed) {
  const id = d.uid || d.id;
  const age = Math.round((Date.now() - d.created) / 86_400_000);
  const label = `${new Date(d.created).toISOString().slice(0, 10)}  ${String(age).padStart(3)}d  ${(d.target ?? 'preview').padEnd(10)}  ${id}`;
  if (!APPLY) {
    console.log(`  would delete  ${label}`);
    continue;
  }
  try {
    await api(`/v13/deployments/${id}?teamId=${TEAM}`, { method: 'DELETE' });
    ok += 1;
    if (ok % 25 === 0) console.log(`  deleted ${ok}/${doomed.length}...`);
  } catch (e) {
    failed += 1;
    console.error(`  FAILED ${label}: ${e.message}`);
  }
}

if (APPLY) {
  console.log(`\ndeleted ${ok}, failed ${failed}`);
  // A partial failure must be visible, not averaged away into a green tick.
  if (failed) process.exit(1);
}
