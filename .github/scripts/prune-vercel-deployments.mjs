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

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID;
const PROJECT = process.env.VERCEL_PROJECT || 'majorcycle';
const KEEP_DAYS = Number(process.env.KEEP_DAYS || 14);
const KEEP_PRODUCTION = Number(process.env.KEEP_PRODUCTION || 5);
const APPLY = process.argv.includes('--apply') || process.env.APPLY === '1';

if (!TOKEN || !TEAM) {
  console.error('VERCEL_TOKEN and VERCEL_TEAM_ID are required.');
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
};

/** Every deployment, oldest last. The API pages by `until`. */
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

const settled = new Set(['READY', 'ERROR', 'CANCELED']);
const doomed = all.filter((d) => {
  const id = d.uid || d.id;
  if (keepIds.has(id)) return false;
  if (!settled.has(d.state)) return false;
  return d.created < cutoff;
});

const bytes = (n) => `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
const PER_DEPLOYMENT_MB = 268; // measured; see the header

console.log(`project           : ${PROJECT}`);
console.log(`deployments total : ${all.length}  (production ${production.length})`);
console.log(`keeping           : newest ${KEEP_PRODUCTION} production + everything < ${KEEP_DAYS} days old`);
console.log(`to delete         : ${doomed.length}`);
console.log(`approx. reclaimed : ${bytes(doomed.length * PER_DEPLOYMENT_MB * 1024 * 1024)} of function storage`);
console.log(`mode              : ${APPLY ? 'APPLY — deleting' : 'DRY RUN — nothing will be deleted'}\n`);

if (!doomed.length) process.exit(0);

let ok = 0;
let failed = 0;
for (const d of doomed) {
  const id = d.uid || d.id;
  const age = Math.round((Date.now() - d.created) / 86_400_000);
  const label = `${new Date(d.created).toISOString().slice(0, 10)}  ${age}d  ${d.target ?? 'preview'}  ${id}`;
  if (!APPLY) {
    console.log(`  would delete  ${label}`);
    continue;
  }
  try {
    await api(`/v13/deployments/${id}?teamId=${TEAM}`, { method: 'DELETE' });
    ok++;
    if (ok % 25 === 0) console.log(`  deleted ${ok}/${doomed.length}…`);
  } catch (e) {
    failed++;
    console.error(`  FAILED ${label}: ${e.message}`);
  }
}

if (APPLY) {
  console.log(`\ndeleted ${ok}, failed ${failed}`);
  // A partial failure must be visible, not averaged away into a green tick.
  if (failed) process.exit(1);
}
