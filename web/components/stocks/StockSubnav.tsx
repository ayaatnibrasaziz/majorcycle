'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Download } from 'lucide-react';

import { cn } from '@/lib/utils';
import { MethodologyModal } from '@/components/stocks/MethodologyModal';

const SECTIONS = [
  { id: 'sec-thesis', label: 'Thesis' },
  { id: 'sec-scorecard', label: 'Scorecard' },
  { id: 'sec-cycle', label: 'Cycle' },
  { id: 'sec-fundamentals', label: 'Fundamentals' },
  { id: 'sec-sentiment', label: 'Sentiment' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

/**
 * Sticky sub-navigation strip for the Stock Detail page. Five anchor pills +
 * two right-side actions (Methodology dialog, Download Report). Sticks below
 * the global header, frosted-glass background.
 *
 * `reportHref` points at the chrome-free report route for this stock, carrying
 * the current Major Cycle horizon; the Download Report action opens it in a new
 * tab (both export modes — Save-as-PDF / Download-HTML — live on that page).
 */
export function StockSubnav({ reportHref }: { reportHref: string }) {
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  // While a CLICK-triggered smooth scroll is in flight, the scroll-spy below
  // would otherwise light up every pill the viewport passes through (the
  // "walking highlight" bug). We lock it on click and release shortly after the
  // scroll settles on the target — so the clicked pill highlights once and stays.
  const scrollLockRef = useRef(false);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLockRef.current) return; // suppressed during click-scroll
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          setActive(visible.target.id as SectionId);
        }
      },
      {
        // Trigger when the section's top enters the band just below the
        // sticky header + subnav.
        rootMargin: '-120px 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // Release the scroll-lock ~140ms after scrolling stops (so the scroll-spy
  // resumes only once the click-scroll has settled on the target). A safety
  // timeout in handleClick covers the already-at-target case (no scroll events).
  useEffect(() => {
    const onScroll = () => {
      if (!scrollLockRef.current) return;
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = setTimeout(() => {
        scrollLockRef.current = false;
      }, 140);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: SectionId) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    // Clear the full sticky chrome: header (58) + this sticky subnav (~47) plus
    // a little breathing room. Matches the sections' own scroll-mt-[120px], so
    // the section heading lands just below the subnav instead of behind it.
    const headerOffset = 120;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    setActive(id);
    history.replaceState(null, '', `#${id}`);
    // Only lock when we'll actually scroll; otherwise no scroll events fire and
    // the lock would never release via onScroll.
    if (Math.abs(window.scrollY - top) > 2) {
      scrollLockRef.current = true;
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      // Absolute safety: release even if the scroll is clamped (e.g. the target
      // is near the page bottom and barely moves).
      releaseTimerRef.current = setTimeout(() => {
        scrollLockRef.current = false;
      }, 1500);
    }
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <>
    <div
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
            className="inline-flex items-center gap-1.5 bg-white border border-[var(--border-strong)] text-[var(--text-secondary)] text-[11px] font-semibold px-3 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)] transition-all"
            title="How this stock is scored"
          >
            <ShieldCheck className="w-[13px] h-[13px]" strokeWidth={1.8} />
            Methodology
          </button>
          <a
            href={reportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-white border border-[var(--border-strong)] text-[var(--text-secondary)] text-[11px] font-semibold px-3 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)] transition-all"
            title="Open a full printable report for this stock"
          >
            <Download className="w-[13px] h-[13px]" strokeWidth={1.8} />
            Download Report
          </a>
        </div>
      </div>
    </div>

    <MethodologyModal open={methodologyOpen} onOpenChange={setMethodologyOpen} />
    </>
  );
}
