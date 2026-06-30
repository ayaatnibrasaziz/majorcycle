'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Download, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { MethodologyModal } from '@/components/stocks/MethodologyModal';
import {
  downloadInteractiveReport,
  prefetchReportBundle,
  prefetchReportData,
} from '@/lib/report-download';
import { useScrollSpy } from '@/lib/useScrollSpy';

const SECTIONS = [
  { id: 'sec-thesis', label: 'Thesis' },
  { id: 'sec-scorecard', label: 'Scorecard' },
  { id: 'sec-cycle', label: 'Cycle' },
  { id: 'sec-fundamentals', label: 'Fundamentals' },
  { id: 'sec-sentiment', label: 'Sentiment' },
] as const;

const SECTION_IDS = SECTIONS.map((s) => s.id);

type SectionId = (typeof SECTIONS)[number]['id'];

/**
 * Sticky sub-navigation strip for the Stock Detail page. Five anchor pills +
 * two right-side actions (Methodology dialog, Download Report). Sticks below
 * the global header, frosted-glass background.
 *
 * "Download Report" is a one-click action: it builds a single self-contained,
 * fully-interactive .html for this stock (this stock's data + the prebuilt
 * offline bundle) and downloads it — see lib/report-download.ts. Styled like the
 * Results-tab Export button (blue `.export-btn` gradient).
 */
export function StockSubnav({
  market,
  ticker,
  horizonQuery,
  symbol,
  reportTitle,
}: {
  market: string;
  ticker: string;
  horizonQuery: string;
  symbol: string;
  reportTitle: string;
}) {
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Warm the static offline bundle (~1.3 MB, same for every stock) once on mount,
  // so a later Download click only waits on this stock's data, not the bundle.
  useEffect(() => {
    prefetchReportBundle();
  }, []);

  // Start fetching this stock's report data the moment the user hovers/focuses the
  // button, so the file is usually ready by the time they click.
  function warmReportData() {
    prefetchReportData({ market, ticker, horizonQuery });
  }

  // Deterministic scroll-spy: a section is active once its heading reaches just
  // below this sticky subnav. The offset auto-tracks the subnav's current bottom
  // (≈105 when stuck) + a gap matching the sections' scroll-mt-[120px].
  const subnavRef = useRef<HTMLDivElement>(null);
  const { active, setActive, lock } = useScrollSpy(
    SECTION_IDS,
    () => (subnavRef.current?.getBoundingClientRect().bottom ?? 105) + 24,
  );

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadInteractiveReport({
        market,
        ticker,
        horizonQuery,
        symbol,
        title: reportTitle,
      });
    } catch {
      // Non-technical owner safety net: never fail silently. The report bundle
      // or data fetch failed — tell the user plainly rather than doing nothing.
      window.alert(
        'Sorry — the report could not be prepared just now. Please try again in a moment.',
      );
    } finally {
      setDownloading(false);
    }
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: SectionId) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    // Clear the full sticky chrome: header (58) + this sticky subnav (~47) plus
    // a little breathing room. Matches the sections' own scroll-mt-[120px], so
    // the section heading lands just below the subnav instead of behind it.
    const headerOffset = 120;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    // Highlight the clicked pill immediately and lock the scroll-spy so the
    // in-flight smooth scroll doesn't walk the highlight through every section.
    setActive(id);
    lock();
    history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <>
    <div
      ref={subnavRef}
      className="sticky top-[var(--header-h)] z-[50] -mx-6 px-6 border-b border-[var(--border)] bg-white/92 backdrop-blur-md"
      role="navigation"
      aria-label="Section navigation"
    >
      <div className="flex items-center justify-between gap-4 h-[46px] overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 flex-shrink-0">
          {SECTIONS.map(({ id, label }) => {
            const isActive = active === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => handleClick(e, id)}
                className={cn(
                  'inline-flex items-center gap-[7px] px-[14px] py-[7px] rounded-[var(--radius-sm)] text-[12px] font-semibold transition-colors duration-150 select-none',
                  isActive
                    ? 'bg-[var(--brand-mid)] text-white shadow-[0_1px_0_var(--brand-deep)_inset]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-stripe)] hover:text-[var(--brand-mid)]',
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                <span
                  className={cn(
                    'w-[5px] h-[5px] rounded-full',
                    isActive ? 'bg-white/70' : 'bg-current opacity-60',
                  )}
                  aria-hidden="true"
                />
                {label}
              </a>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMethodologyOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={methodologyOpen}
            className="inline-flex items-center gap-1.5 bg-white border border-[var(--border-strong)] text-[var(--text-secondary)] text-[11px] font-semibold px-3 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)] transition-all"
            title="How this stock is scored"
          >
            <ShieldCheck className="w-[13px] h-[13px]" strokeWidth={1.8} />
            Methodology
          </button>
          <button
            type="button"
            onClick={handleDownload}
            onMouseEnter={warmReportData}
            onFocus={warmReportData}
            disabled={downloading}
            aria-busy={downloading}
            className="export-btn disabled:opacity-70 disabled:cursor-default"
            title="Download a full interactive report for this stock"
          >
            {downloading ? (
              <Loader2 className="w-[13px] h-[13px] animate-spin" strokeWidth={1.8} />
            ) : (
              <Download className="w-[13px] h-[13px]" strokeWidth={1.8} />
            )}
            {downloading ? 'Preparing…' : 'Download Report'}
          </button>
        </div>
      </div>
    </div>

    <MethodologyModal open={methodologyOpen} onOpenChange={setMethodologyOpen} />
    </>
  );
}
