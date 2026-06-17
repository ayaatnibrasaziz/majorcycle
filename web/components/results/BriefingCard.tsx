'use client';

import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';

import { InfoTip } from '@/components/ui/InfoTip';
import { tickerToPath, tickerToUrlParts } from '@/lib/ticker';
import { buildBriefing, type BriefingRow } from '@/lib/ratings';
import type { QuickFilter } from './filters';

// The Analyst Briefing — a plain-English summary built entirely from the live,
// in-memory results (rating outputs; never read from the DB, CLAUDE.md #15). All
// language uses our compliant tiers — no "Buy Zone"/"Avoid" framing. The required
// "information only" disclaimer sits in this top card so it's visible without
// scrolling on any rating-bearing page (CLAUDE.md #4 / #12).

export function BriefingCard({
  rows,
  onQuickFilter,
}: {
  rows: BriefingRow[];
  onQuickFilter: (q: QuickFilter) => void;
}) {
  const router = useRouter();
  const briefing = buildBriefing(rows);

  const openTopPick = () => {
    if (briefing.topPick) router.push(tickerToPath(briefing.topPick.ticker));
  };

  return (
    <div className="briefing">
      <div className="briefing-icon">
        <TrendingUp className="h-[20px] w-[20px] text-white" strokeWidth={2.25} />
      </div>
      <div className="briefing-body">
        <div className="briefing-head">
          <span className="briefing-title">Analyst Briefing</span>
          <InfoTip title="Analyst Briefing">
            A plain-English summary of this run — how many stocks rate Constructive or better, the
            standout name, and any rated Cautious or Bearish. Built from your results; the tier
            words are our ratings, not buy/sell calls. Information only — not financial advice.
          </InfoTip>
        </div>

        {briefing.topPick ? (
          <>
            <p className="briefing-text">
              {briefing.sentences.map((s, i) => (
                <span key={i}>
                  {renderSentence(s, briefing.topPick!.ticker, openTopPick)}{' '}
                </span>
              ))}
            </p>
            <div className="briefing-pills">
              <button type="button" className="b-pill" onClick={() => onQuickFilter('constructivePlus')}>
                <span className="b-pill-n" style={{ color: 'var(--c-tier-2)' }}>
                  {briefing.constructivePlus}
                </span>{' '}
                Constructive or better
              </button>
              <button type="button" className="b-pill" onClick={openTopPick}>
                Top pick:{' '}
                <span className="b-pill-n" style={{ color: 'var(--brand-mid)' }}>
                  {tickerToUrlParts(briefing.topPick.ticker).symbol}
                </span>
              </button>
              {briefing.cautiousBearish > 0 && (
                <button type="button" className="b-pill" onClick={() => onQuickFilter('weak')}>
                  <span className="b-pill-n" style={{ color: 'var(--c-tier-5)' }}>
                    {briefing.cautiousBearish}
                  </span>{' '}
                  Cautious / Bearish
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="briefing-text">Run an analysis to generate your briefing.</p>
        )}

        <div className="briefing-disclaimer">Information only — not financial advice.</div>
      </div>
    </div>
  );
}

// Replace the {{TICKER}} placeholder in a briefing sentence with a clickable link
// to that stock's detail page (shown as the bare symbol, no .AX/.TO suffix).
function renderSentence(sentence: string, ticker: string, onOpen: () => void) {
  const parts = sentence.split('{{TICKER}}');
  if (parts.length === 1) return sentence;
  return (
    <>
      {parts[0]}
      <span
        role="link"
        tabIndex={0}
        className="b-link"
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        {tickerToUrlParts(ticker).symbol}
      </span>
      {parts[1]}
    </>
  );
}
