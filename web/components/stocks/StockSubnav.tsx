'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Download } from 'lucide-react';

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
 */
export function StockSubnav() {
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
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

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: SectionId) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const headerOffset = 58 + 12;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: 'smooth' });
    setActive(id);
    history.replaceState(null, '', `#${id}`);
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
            <BookOpen className="w-[13px] h-[13px]" strokeWidth={1.8} />
            Methodology
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 bg-white border border-[var(--border-strong)] text-[var(--text-secondary)] text-[11px] font-semibold px-3 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-mid)] hover:border-[var(--brand-bright)] transition-all"
            disabled
            aria-disabled="true"
            title="Coming soon"
          >
            <Download className="w-[13px] h-[13px]" strokeWidth={1.8} />
            Download Report
          </button>
        </div>
      </div>
    </div>

    <MethodologyModal open={methodologyOpen} onOpenChange={setMethodologyOpen} />
    </>
  );
}
