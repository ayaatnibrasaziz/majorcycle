// Builds the Claude Design bundle from the REAL design tokens.
//
// WHY THIS IS GENERATED RATHER THAN WRITTEN. The design system already exists in
// two places — the spec in `docs/design-system.md` and the shipped CSS in
// `app/globals.css`. Hand-authoring a third copy as gallery HTML is exactly the
// drift trap CLAUDE.md 11c is about: three descriptions of one rule, parting
// company silently. So the swatches and specimens here are PARSED OUT OF
// `globals.css`. A colour that isn't shipped cannot appear in the gallery, and a
// newly added token shows up on the next build without anyone remembering to
// add it.
//
// Components are deliberately NOT re-implemented here — they are captured as
// screenshots of the running product. A re-implementation is a fourth copy that
// looks right while diverging; a screenshot is a photograph of what actually
// ships (same reasoning as 11d: test the artifact, not the source).
//
// Output is gitignored and rebuilt on demand — it is a rendering, never a source
// of truth. Run: pnpm build:design-system

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const OUT = join(WEB, 'design-system-build');

const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');

/** Pull `--name: value;` pairs out of the real stylesheet. */
function tokens() {
  const found = new Map();
  for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim)) {
    const [, name, value] = m;
    // Tailwind v4 re-exports tokens as `--color-x: var(--x)`. Keep the source of
    // truth (the literal), not the alias, or every swatch renders as "var(...)".
    if (name.startsWith('--color-')) continue;
    if (!found.has(name)) found.set(name, value.trim());
  }
  return found;
}

const T = tokens();
const isColour = (v) => /^#|^rgba?\(|^hsla?\(/i.test(v);
const group = (prefixes) =>
  [...T].filter(([n]) => prefixes.some((p) => n.startsWith(p)));

const page = (title, cardGroup, body) => `<!-- @dsCard group="${cardGroup}" -->
<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
<link rel="stylesheet" href="${'../'.repeat((cardGroup.match(/\//g) || []).length + 1)}tokens.css">
<style>
  body { margin:0; padding:32px; background:var(--bg-page); font-family:var(--font-sans),'Sora',system-ui,sans-serif; color:var(--text-primary); }
  h1 { font-size:20px; font-weight:700; letter-spacing:-.4px; margin:0 0 4px; }
  .sub { font-size:12px; color:var(--text-muted); margin:0 0 24px; }
  .note { font-size:11px; color:var(--text-muted); margin-top:28px; padding-top:14px; border-top:1px solid var(--border); line-height:1.6; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; }
  .sw { background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow-sm); }
  .chip { height:64px; }
  .meta { padding:9px 11px; }
  .name { font-family:var(--font-mono),'JetBrains Mono',monospace; font-size:10.5px; color:var(--text-primary); }
  .val  { font-family:var(--font-mono),'JetBrains Mono',monospace; font-size:10px; color:var(--text-muted); margin-top:2px; }
</style>
<h1>${title}</h1>
${body}
<p class="note">Generated from <code>web/app/globals.css</code> by <code>scripts/build-design-system.mjs</code> — never hand-edited. A colour that is not shipped cannot appear here.</p>
`;

const swatches = (pairs) =>
  `<div class="grid">${pairs
    .map(
      ([n, v]) => `<div class="sw">
    <div class="chip" style="background:${isColour(v) ? v : 'var(' + n + ')'}"></div>
    <div class="meta"><div class="name">${n}</div><div class="val">${v}</div></div>
  </div>`,
    )
    .join('')}</div>`;

mkdirSync(join(OUT, 'foundations'), { recursive: true });
mkdirSync(join(OUT, 'components'), { recursive: true });

// Emit tokens.css from the SAME parsed map the swatches render from, rather than
// slicing `:root` out of the file as text.
//
// ⚠️ My first version did slice `:root`, and it was quietly wrong: `--font-sans`
// and `--font-mono` live in the `@theme inline` block ABOVE `:root`, so they were
// missing. `font-family: var(--font-sans), 'Sora', …` with an undefined variable
// is INVALID CSS, so the browser fell back to its default and the whole gallery —
// including the type specimen — rendered in **Times New Roman while labelled
// Sora**. It looked fine; only `document.fonts.check()` exposed it.
//
// One derivation now feeds both the stylesheet and the swatches, so they cannot
// disagree (CLAUDE.md 11c iii — make the second consume the first's output).
//
// The two `--font-*` values reference `--font-sora` / `--font-jetbrains`, which
// Next injects at runtime and which do not exist standalone, so they are pinned
// and the real webfonts loaded explicitly.
writeFileSync(
  join(OUT, 'tokens.css'),
  `/* GENERATED from web/app/globals.css by scripts/build-design-system.mjs — do not edit. */
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  /* Next injects these at runtime; pinned so the specimen shows the real faces. */
  --font-sora: 'Sora';
  --font-jetbrains: 'JetBrains Mono';

${[...T].map(([n, v]) => `  ${n}: ${v};`).join('\n')}
}
`,
);

// ── Colour ──────────────────────────────────────────────────────────────────
const brand = group(['--brand-']);
const surfaces = group(['--bg-']);
const text = group(['--text-']);
const borders = group(['--border']);
const tiers = group(['--c-tier-']);

writeFileSync(
  join(OUT, 'foundations', 'colors.html'),
  page(
    'Colour',
    'Foundations',
    `<p class="sub">Locked by decision #25. Brand values may not be changed.</p>
     <h2 style="font-size:13px;margin:22px 0 10px">Brand</h2>${swatches(brand)}
     <h2 style="font-size:13px;margin:22px 0 10px">Surfaces</h2>${swatches(surfaces)}
     <h2 style="font-size:13px;margin:22px 0 10px">Text</h2>${swatches(text)}
     <h2 style="font-size:13px;margin:22px 0 10px">Borders</h2>${swatches(borders)}
     ${tiers.length ? `<h2 style="font-size:13px;margin:22px 0 10px">Rating tiers — never relabel (#2/#16)</h2>${swatches(tiers)}` : ''}`,
  ),
);

// ── Type ────────────────────────────────────────────────────────────────────
const specimen = (font, label, rows) => `
  <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow-sm);margin-bottom:14px">
    <div class="name" style="color:var(--text-muted);margin-bottom:14px">${label}</div>
    ${rows
      .map(
        ([size, weight, sample]) => `<div style="font-family:${font};font-size:${size};font-weight:${weight};margin-bottom:10px;line-height:1.3">
        ${sample}
        <span class="val" style="margin-left:10px">${size} / ${weight}</span>
      </div>`,
      )
      .join('')}
  </div>`;

writeFileSync(
  join(OUT, 'foundations', 'typography.html'),
  page(
    'Typography',
    'Foundations',
    `<p class="sub">Locked by decision #26. <strong>Every word is Sora. Every number is JetBrains Mono. No exceptions.</strong></p>
     ${specimen("var(--font-sans),'Sora',sans-serif", 'Sora — all UI text', [
       ['24px', '700', 'Where is your stock in its cycle?'],
       ['16px', '600', 'Financial Health'],
       ['14px', '400', 'Body copy — the default reading size.'],
       ['13px', '600', 'Card title'],
       ['12px', '400', 'Body small, captions and helper text.'],
       ['11px', '400', 'Tooltip and legal fine print.'],
     ])}
     ${specimen("var(--font-mono),'JetBrains Mono',monospace", 'JetBrains Mono — every numeric value', [
       ['26px', '600', '312.41'],
       ['18px', '500', '−24.7%'],
       ['13px', '500', 'A$60.52'],
       ['11px', '400', 'UPDATED 7 AUG 2026'],
     ])}`,
  ),
);

// ── Spacing, radius, shadow ─────────────────────────────────────────────────
const radii = group(['--radius']);
const shadows = group(['--shadow']);
const bar = (label, px) => `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
    <div style="width:${px};height:14px;background:var(--brand-bright);border-radius:2px"></div>
    <span class="name">${label}</span><span class="val">${px}</span>
  </div>`;

writeFileSync(
  join(OUT, 'foundations', 'spacing-radius-shadow.html'),
  page(
    'Spacing · Radius · Shadow',
    'Foundations',
    `<p class="sub">The rhythm the reference design uses. Cards in a stack sit on <code>--shadow-sm</code>; a card floating alone on the page ground takes <code>--shadow-lift</code>; only modals earn <code>--shadow-lg</code>.</p>
     <h2 style="font-size:13px;margin:0 0 10px">Stack spacing</h2>
     ${bar('--space-stack-tight · header strip', '8px')}
     ${bar('--space-stack-snug · paired cards', '14px')}
     ${bar('--space-stack-base · distinct sections', '18px')}
     ${bar('page outer padding', '24px')}
     <h2 style="font-size:13px;margin:24px 0 10px">Radius</h2>
     <div style="display:flex;gap:14px;flex-wrap:wrap">${radii
       .map(
         ([n, v]) => `<div style="text-align:center">
         <div style="width:88px;height:60px;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:${v}"></div>
         <div class="name" style="margin-top:6px">${n}</div><div class="val">${v}</div></div>`,
       )
       .join('')}</div>
     <h2 style="font-size:13px;margin:24px 0 10px">Shadow</h2>
     <div style="display:flex;gap:20px;flex-wrap:wrap">${shadows
       .map(
         ([n, v]) => `<div style="text-align:center">
         <div style="width:130px;height:70px;background:var(--bg-surface);border-radius:var(--radius);box-shadow:${v}"></div>
         <div class="name" style="margin-top:10px">${n}</div></div>`,
       )
       .join('')}</div>`,
  ),
);

const written = ['tokens.css', 'foundations/colors.html', 'foundations/typography.html', 'foundations/spacing-radius-shadow.html'];
console.log(`design-system: ${written.length} files from ${T.size} real tokens`);
console.log(`  brand ${brand.length} · surfaces ${surfaces.length} · text ${text.length} · borders ${borders.length} · tiers ${tiers.length} · radii ${radii.length} · shadows ${shadows.length}`);
// Assert by NAME, not by a magic total. My first draft used `T.size < 50`, which
// was a guess — it failed on a correct parse of 47 real tokens. A floor nobody can
// justify is a floor that gets lowered until it means nothing; these three are
// named in locked decision #25 and cannot legitimately disappear.
// `--font-sans`/`--font-mono` are in this list for a reason: they were the two
// that went missing and turned the whole gallery into Times New Roman.
const MUST_EXIST = ['--brand-deep', '--brand-mid', '--brand-bright', '--font-sans', '--font-mono', '--radius'];
const missing = MUST_EXIST.filter((n) => !T.has(n));
if (missing.length > 0) {
  console.error(`design-system: FAILED — locked tokens absent from globals.css: ${missing.join(', ')}`);
  process.exit(1);
}
if (T.size < 40) {
  console.error(`design-system: FAILED — only ${T.size} tokens parsed (expected ~47); the globals.css format probably changed.`);
  process.exit(1);
}
console.log('design-system: OK →', OUT);
