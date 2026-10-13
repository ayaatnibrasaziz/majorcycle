// Writes the 13 Supabase sign-in templates from lib/email/authTemplates.ts to
// reference/supabase-email-templates/, one HTML file per template plus subjects.json.
//
// Those files are what gets pasted into Supabase → Authentication → Emails →
// Templates. Nothing can paste them for you, and nothing can check the dashboard:
// e2e/auth-email-templates.spec.ts only proves these files match the source.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(web, '..', 'reference', 'supabase-email-templates');
const bundle = join(web, 'node_modules', '.cache', 'auth-emails', 'authTemplates.mjs');

mkdirSync(dirname(bundle), { recursive: true });
await build({
  entryPoints: [join(web, 'lib', 'email', 'authTemplates.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  tsconfig: join(web, 'tsconfig.json'),
  outfile: bundle,
  logLevel: 'warning',
});
const { AUTH_TEMPLATES, renderAuthTemplate } = await import(pathToFileURL(bundle).href);

mkdirSync(outDir, { recursive: true });
const subjects = {};
for (const slug of Object.keys(AUTH_TEMPLATES)) {
  writeFileSync(join(outDir, `${slug}.html`), renderAuthTemplate(slug));
  subjects[slug] = AUTH_TEMPLATES[slug].subject;
}
writeFileSync(join(outDir, 'subjects.json'), `${JSON.stringify(subjects, null, 2)}\n`);
console.log(`Wrote ${Object.keys(subjects).length} templates to ${outDir}`);
