import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AUTH_TEMPLATES, renderAuthTemplate, type AuthTemplateSlug } from '@/lib/email/authTemplates';

/**
 * The 13 Supabase sign-in emails (owner, 2026-10-13).
 *
 * They are written in lib/email/authTemplates.ts, built into
 * reference/supabase-email-templates/ by `pnpm build:auth-emails`, and PASTED into the
 * Supabase dashboard by hand. This file can check the first two steps and never the
 * third: no test can read the dashboard. If a template here changes, paste it.
 *
 * Pure: no browser, no network.
 */

const DIR = join(process.cwd(), '..', 'reference', 'supabase-email-templates');
const SLUGS = Object.keys(AUTH_TEMPLATES) as AuthTemplateSlug[];

test.describe('the Supabase sign-in emails', () => {
  test('all 13 are built, and the files match the source', () => {
    expect(SLUGS).toHaveLength(13);
    const files = readdirSync(DIR).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort();
    expect(files, 'a template file is missing, or one has no source').toEqual([...SLUGS].sort());
    for (const slug of SLUGS) {
      expect(readFileSync(join(DIR, `${slug}.html`), 'utf8'), `${slug}: run pnpm build:auth-emails`).toBe(renderAuthTemplate(slug));
    }
    const subjects = JSON.parse(readFileSync(join(DIR, 'subjects.json'), 'utf8'));
    for (const slug of SLUGS) expect(subjects[slug], `${slug}: subject`).toBe(AUTH_TEMPLATES[slug].subject);
  });

  test('they wear the app emails\' styles, not the old dashboard ones', () => {
    // The drift the owner saw side by side: slate-grey body text (#475569) and a
    // fine-print grey (#94a3b8, 2.56:1 on white) that the app's emails never used.
    for (const slug of SLUGS) {
      const html = renderAuthTemplate(slug);
      expect(html, `${slug}: no image wordmark`).toContain('/email-wordmark.png');
      expect(html, `${slug}: not the app body colour`).toContain('color:#0f1923');
      expect(html, `${slug}: old slate body text`).not.toContain('#475569');
      expect(html, `${slug}: old pale fine print`).not.toContain('#94a3b8');
      expect(html, `${slug}: not the 600px card`).toContain('max-width:600px');
      expect(html, `${slug}: lost the footer`).toContain('&copy; MajorCycle &middot; Educational information only &mdash; not financial advice.');
    }
  });

  test('every link lands on the confirm route with the right type, and keeps Supabase\'s placeholders', () => {
    const EXPECT: Partial<Record<AuthTemplateSlug, [string, string]>> = {
      'confirm-sign-up': ['email', '/stocks'],
      'magic-link-or-otp': ['email', '/stocks'],
      'change-email-address': ['email_change', '/stocks'],
      'reset-password': ['recovery', '/account/update-password'],
      'invite-user': ['invite', '/account/update-password'],
    };
    for (const [slug, [type, next]] of Object.entries(EXPECT) as [AuthTemplateSlug, [string, string]][]) {
      const html = renderAuthTemplate(slug);
      const url = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`;
      // Button, fallback link and its visible text: three copies of one URL.
      expect(html.split(url).length - 1, `${slug}: link`).toBe(3);
    }
    expect(renderAuthTemplate('reauthentication')).toContain('{{ .Token }}');
    // A placeholder Supabase does not know renders as empty text in a real email.
    for (const slug of SLUGS) {
      for (const v of renderAuthTemplate(slug).match(/\{\{[^}]*\}\}/g) ?? []) {
        expect(['{{ .SiteURL }}', '{{ .TokenHash }}', '{{ .Email }}', '{{ .Token }}'], `${slug}: ${v}`).toContain(v);
      }
    }
  });
});
