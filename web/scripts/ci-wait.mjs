#!/usr/bin/env node
/**
 * Wait for CI on the commit you are standing on, and report it as ONE verdict.
 *
 *     pnpm ci:wait            # after `git push`
 *
 * The fast "done" path (CLAUDE.md #17): `pnpm gates --no-e2e` here (~1 min), push,
 * then this — the full E2E suite runs on 10 CI runners in ~6.5 min, where the same
 * suite takes over an hour on a laptop.
 *
 * It refuses to report success on anything it did not see:
 *   - no run for HEAD at all (CLAUDE.md 11an: a push can create NO run, and "no red"
 *     is not green) → fails after 3 minutes of looking;
 *   - a run that finished red, cancelled or skipped → fails, naming the jobs;
 *   - a green run → prints each job's time and the merged E2E count line, which is
 *     the e2e evidence ("E2E, all shards: N of N listed — …").
 *
 * Needs the GitHub CLI (`gh`), signed in. Reads only; it never pushes or re-runs.
 */
import { execSync } from 'node:child_process';

const gh = (args) => execSync(`gh ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// CI_WAIT_SHA: check a specific commit instead of HEAD (also how the no-run path is tested).
const sha = process.env.CI_WAIT_SHA || execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

console.log(`ci:wait — CI for ${sha.slice(0, 7)} on ${branch}`);

let run = null;
for (let waited = 0; !run; waited += 10_000) {
  const runs = JSON.parse(
    gh(`run list --workflow CI --commit ${sha} --limit 5 --json databaseId,status,conclusion,event,createdAt`),
  );
  run = runs[0] ?? null;
  if (!run) {
    if (waited >= 180_000) {
      console.error('  ✘ no CI run exists for this commit after 3 minutes. Was it pushed? Is the PR');
      console.error('    mergeable? (CLAUDE.md 11an: a conflicting PR produces no run at all.)');
      process.exit(1);
    }
    await sleep(10_000);
  }
}

const started = Date.now();
for (;;) {
  const r = JSON.parse(gh(`run view ${run.databaseId} --json status,conclusion,createdAt,updatedAt,jobs`));
  if (r.status === 'completed') {
    const mins = (a, b) => ((Date.parse(b) - Date.parse(a)) / 60000).toFixed(1);
    console.log(`  run ${run.databaseId}: ${r.conclusion} in ${mins(r.createdAt, r.updatedAt)} min`);
    for (const j of r.jobs) {
      console.log(`    ${(j.conclusion ?? '?').padEnd(9)} ${mins(j.startedAt, j.completedAt).padStart(5)}m  ${j.name}`);
    }
    const report = r.jobs.find((j) => j.name.startsWith('E2E (Playwright'));
    if (report?.databaseId) {
      try {
        const log = gh(`api repos/{owner}/{repo}/actions/jobs/${report.databaseId}/logs`);
        const line = log.split('\n').find((l) => l.includes('E2E, all shards:'));
        if (line) console.log(`  ${line.replace(/^\S+\s+/, '').trim()}`);
      } catch {
        console.log('  (could not read the merged E2E line from the report job)');
      }
    }
    if (r.conclusion !== 'success') {
      const bad = r.jobs.filter((j) => j.conclusion !== 'success' && j.conclusion !== 'skipped');
      console.error(`  ✘ CI ${r.conclusion}: ${bad.map((j) => j.name).join(', ') || 'see the run'}`);
      process.exit(1);
    }
    process.exit(0);
  }
  if (Date.now() - started > 40 * 60_000) {
    console.error('  ✘ still running after 40 minutes — a healthy run takes ~6.5. Look at it.');
    process.exit(1);
  }
  await sleep(20_000);
}
