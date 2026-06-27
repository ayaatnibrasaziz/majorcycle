// Client-side "Download HTML" for the Stock Detail report. Mirrors the
// downloadCsv (ratings.ts) / downloadXlsx (xlsx.ts) blob+click pattern, but
// packages the whole #report-root into ONE self-contained .html file that works
// offline:
//   1. clone #report-root,
//   2. swap every <canvas> (Lightweight-Charts) for an <img> of its toDataURL —
//      a cloned canvas is blank, so we read the bitmap from the LIVE node in
//      document order (Recharts SVG serializes natively, no action needed),
//   3. inline any remaining same-origin <img> (the logo) as a data URL,
//   4. embed every same-origin stylesheet (Tailwind + globals, incl. the :root
//      CSS variables) into one <style>,
//   5. blob → a.click() → revoke (no-op on the server).

const ROOT_ID = 'report-root';

/** Read one same-origin URL as a data: URL. Returns null on any failure. */
async function toDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Concatenated cssText of every reachable (same-origin) stylesheet. */
function collectCss(): string {
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules; // throws for cross-origin sheets — skip those
    } catch {
      rules = null;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) css += rule.cssText + '\n';
  }
  return css;
}

/** Replace every <canvas> in the clone with an <img> of the live canvas bitmap. */
function inlineCanvases(root: HTMLElement, clone: HTMLElement): void {
  const live = Array.from(root.querySelectorAll('canvas'));
  const cloned = Array.from(clone.querySelectorAll('canvas'));
  cloned.forEach((canvas, i) => {
    const source = live[i];
    let dataUrl = '';
    try {
      dataUrl = source ? source.toDataURL('image/png') : '';
    } catch {
      dataUrl = '';
    }
    const img = document.createElement('img');
    if (dataUrl) img.src = dataUrl;
    // Preserve the canvas box so the chart lands where it did (LWC stacks
    // absolutely-positioned canvases inside a relative wrapper).
    if (canvas.getAttribute('style')) img.setAttribute('style', canvas.getAttribute('style')!);
    if (canvas.width) img.width = canvas.width;
    if (canvas.height) img.height = canvas.height;
    img.className = canvas.className;
    canvas.replaceWith(img);
  });
}

/** Inline same-origin <img> sources (e.g. the brand logo) as data URLs. */
async function inlineImages(clone: HTMLElement): Promise<void> {
  const imgs = Array.from(clone.querySelectorAll('img')).filter((img) => {
    const src = img.getAttribute('src') ?? '';
    return src.length > 0 && !src.startsWith('data:');
  });
  await Promise.all(
    imgs.map(async (img) => {
      const dataUrl = await toDataUrl(img.src); // resolves relative → absolute
      if (dataUrl) {
        img.setAttribute('src', dataUrl);
        // next/image emits a srcset/sizes pointing at /_next/image?… — offline the
        // browser would prefer that (now-dead) srcset over our inlined src, so drop
        // them and let the data URL win.
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
      }
    }),
  );
}

/**
 * Build + trigger a self-contained .html download of the report. No-op on the
 * server. `title` becomes the document <title>.
 */
export async function downloadReportHtml(filename: string, title: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const clone = root.cloneNode(true) as HTMLElement;
  inlineCanvases(root, clone);
  await inlineImages(clone);

  const css = collectCss();
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${title}</title><style>${css}</style></head>` +
    `<body style="background:#fff;margin:0;padding:24px;">${clone.outerHTML}</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
