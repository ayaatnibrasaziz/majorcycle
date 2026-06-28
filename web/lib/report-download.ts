// Client-side "Download Report" — builds ONE self-contained, fully-interactive
// .html file for a stock and triggers the download. Unlike a static snapshot, the
// file embeds the real app code (the prebuilt offline bundle) + this stock's data,
// so opening it from `file://` behaves exactly like the live Stock Detail page:
// section-nav, chart pan/zoom over the full history, the Drawdown↔Profit and
// 1Y/3Y/All toggles, and every tooltip all work with no server and no network.
//
// Flow:
//   1. fetch the stock's JSON data from the gated /report/data route,
//   2. fetch the prebuilt bundle (report.js + report.css) — static, CDN-cached,
//   3. assemble a single HTML doc that inlines all three,
//   4. blob → a.click().
//
// Latency: the two big costs are the ~1.3 MB static bundle and the stock's data.
// `prefetchReportBundle()` (call on mount) warms the bundle once for the whole
// session, and `prefetchReportData()` (call on hover/focus) starts the data fetch
// before the click — so by the time the user clicks, both are usually already in
// hand and the save dialog appears almost immediately.

/** Escape `<` so an embedded JSON/text blob can't break out of its <script>. */
function escapeForScriptJson(text: string): string {
  return text.replace(/</g, '\\u003c');
}

/** Neutralise any `</script`/`<!--` that could close the inline <script> early. */
function escapeForInlineScript(js: string): string {
  return js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

// ── Prefetch caches ──────────────────────────────────────────────────────────
// The offline bundle is identical for every stock, so cache it for the session.
let bundlePromise: Promise<{ js: string; css: string }> | null = null;
function getBundle(): Promise<{ js: string; css: string }> {
  if (!bundlePromise) {
    bundlePromise = Promise.all([
      fetchText('/report-bundle/report.js'),
      fetchText('/report-bundle/report.css'),
    ])
      .then(([js, css]) => ({ js, css }))
      .catch((err) => {
        bundlePromise = null; // let a later attempt retry
        throw err;
      });
  }
  return bundlePromise;
}

/** Warm the static offline bundle (call once on mount). Fire-and-forget. */
export function prefetchReportBundle(): void {
  if (typeof document === 'undefined') return;
  void getBundle().catch(() => {});
}

const dataUrl = (a: Pick<DownloadReportArgs, 'market' | 'ticker' | 'horizonQuery'>): string =>
  `/stocks/${a.market}/${a.ticker}/report/data${a.horizonQuery}`;

// One in-flight data fetch per URL (horizon-specific), consumed on download so a
// later click re-fetches fresh.
const dataPromises = new Map<string, Promise<string>>();
function getData(url: string): Promise<string> {
  let p = dataPromises.get(url);
  if (!p) {
    p = fetchText(url).catch((err) => {
      dataPromises.delete(url);
      throw err;
    });
    dataPromises.set(url, p);
  }
  return p;
}

/** Start fetching this stock's report data (call on button hover/focus). */
export function prefetchReportData(
  args: Pick<DownloadReportArgs, 'market' | 'ticker' | 'horizonQuery'>,
): void {
  if (typeof document === 'undefined') return;
  void getData(dataUrl(args)).catch(() => {});
}

export interface DownloadReportArgs {
  /** Route market segment, e.g. "au". */
  market: string;
  /** Route ticker segment, e.g. "BHP". */
  ticker: string;
  /** Horizon query string from horizonQuery(sp), e.g. "?preset=long" or "". */
  horizonQuery: string;
  /** Bare symbol for the filename, e.g. "BHP". */
  symbol: string;
  /** Document <title> for the saved file. */
  title: string;
}

/**
 * Build + trigger the interactive report download. No-op on the server. Throws on
 * any fetch failure so the caller can surface a friendly message.
 */
export async function downloadInteractiveReport(args: DownloadReportArgs): Promise<void> {
  if (typeof document === 'undefined') return;
  const { symbol, title } = args;

  // Reuse the hover-prefetched data + the session-cached bundle when available.
  const reqUrl = dataUrl(args);
  const [dataJson, { js, css }] = await Promise.all([getData(reqUrl), getBundle()]);
  dataPromises.delete(reqUrl); // consume so a later click re-fetches fresh data

  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${title}</title>` +
    `<style>${css}</style>` +
    '<style>html,body{margin:0;background:#fff;}html{scroll-behavior:smooth;}' +
    'body{padding:24px;font-family:var(--font-sans, "Sora", sans-serif);' +
    'color:var(--text-primary, #0f172a);}</style>' +
    '</head><body class="report-page">' +
    '<div id="report-mount"></div>' +
    `<script type="application/json" id="__REPORT_DATA__">${escapeForScriptJson(dataJson)}</script>` +
    `<script>${escapeForInlineScript(js)}</script>` +
    '</body></html>';

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `majorcycle_${symbol}_report.html`;
  a.click();
  URL.revokeObjectURL(url);
}
