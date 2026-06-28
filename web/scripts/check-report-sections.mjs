// CI guard: the downloadable report must contain every analytical section the
// live Stock Detail page shows. The two render differently (the detail page
// streams sections via Suspense; the report renders them all at once from
// baked-in data), so they keep separate JSX — and could silently drift. This
// script fails the build if they do, naming the offending section.
//
// It works by static text scan: for each file, find the section components it
// imports from @/components/stocks/* and which of those it actually renders
// (`<Name`). The report's rendered set must be a SUPERSET of the detail page's
// (minus chrome-only components that legitimately live on the page alone).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGE = path.join(webRoot, 'app', '(app)', 'stocks', '[market]', '[ticker]', 'page.tsx');
const REPORT = path.join(webRoot, 'components', 'stocks', 'ReportDocument.tsx');

// Components that belong only to the live page chrome, never to the report.
const PAGE_ONLY = new Set(['StockSubnav']);

/** Names imported from '@/components/stocks/...' in a source file. */
function importedStockComponents(src) {
  const names = new Set();
  const importRe = /import\s+\{([^}]+)\}\s+from\s+['"]@\/components\/stocks\/[^'"]+['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** Of the imported stock components, those actually rendered (`<Name`). */
function renderedStockSections(file) {
  const src = readFileSync(file, 'utf8');
  const imported = importedStockComponents(src);
  const rendered = new Set();
  for (const name of imported) {
    if (new RegExp(`<${name}[\\s/>]`).test(src)) rendered.add(name);
  }
  return rendered;
}

const pageSections = renderedStockSections(PAGE);
const reportSections = renderedStockSections(REPORT);

const missingFromReport = [...pageSections].filter(
  (s) => !PAGE_ONLY.has(s) && !reportSections.has(s),
);
const missingFromPage = [...reportSections].filter(
  (s) => !pageSections.has(s),
);

let failed = false;
if (missingFromReport.length) {
  failed = true;
  console.error(
    'DRIFT: these sections are on the Stock Detail page but NOT in the report\n' +
      '       (ReportDocument.tsx):\n  - ' +
      missingFromReport.join('\n  - '),
  );
}
if (missingFromPage.length) {
  failed = true;
  console.error(
    'DRIFT: these sections are in the report but NOT on the Stock Detail page\n' +
      '       (page.tsx) — remove them or add to PAGE_ONLY:\n  - ' +
      missingFromPage.join('\n  - '),
  );
}

if (failed) {
  console.error(
    '\nThe download report (components/stocks/ReportDocument.tsx) is out of sync\n' +
      'with the live Stock Detail page. Add/remove the section in both, then re-run.',
  );
  process.exit(1);
}

console.log(
  `report sections in sync (${reportSections.size} sections match the detail page)`,
);
