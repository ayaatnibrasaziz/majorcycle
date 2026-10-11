// Entry point for the OFFLINE interactive report bundle. esbuild compiles this
// (+ React, the section components, lightweight-charts, recharts) into a single
// self-contained browser script (public/report-bundle/report.js).
//
// At download time the client wraps that script together with this stock's data
// (inlined as a <script type="application/json" id="__REPORT_DATA__">) into one
// .html file. Opening that file runs THIS code from `file://` with no network:
// it reads the inlined JSON and mounts the real ReportDocument, so nav, pan/zoom,
// full price history, chips/toggles and every tooltip behave exactly like live.

import { createRoot } from 'react-dom/client';

import { RevealFocus } from '@/components/RevealFocus';
import { ReportDocument } from '@/components/stocks/ReportDocument';
import type { ReportData } from '@/lib/report-types';

function readReportData(): ReportData | null {
  const el = document.getElementById('__REPORT_DATA__');
  if (!el || !el.textContent) return null;
  try {
    return JSON.parse(el.textContent) as ReportData;
  } catch {
    return null;
  }
}

function mount(): void {
  const host = document.getElementById('report-mount');
  const data = readReportData();
  if (!host) return;
  if (!data) {
    host.textContent = 'Report data could not be loaded.';
    return;
  }
  // The report is a second build of the same components (CLAUDE.md 11d), so it needs
  // the site's focus rule too: its Key Metrics table scrolls sideways on a phone.
  createRoot(host).render(
    <>
      <ReportDocument data={data} />
      <RevealFocus />
    </>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
