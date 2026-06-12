'use client';

import { ShieldCheck } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface MethodologyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Section heading: a brand-accent bar + bold label (mirrors the reference
 *  `.methodology-body h4` with its ::before accent). */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-2 mt-[18px] first:mt-0 mb-2 text-[13px] font-bold tracking-[-0.1px] text-[var(--text-primary)]">
      <span
        className="w-[3px] h-[14px] rounded-[2px] bg-[var(--brand-mid)] flex-shrink-0"
        aria-hidden="true"
      />
      {children}
    </h4>
  );
}

/** Monospace formula block with a left brand accent (mirrors `.methodology-formula`). */
function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="font-[var(--font-mono)] text-[12px] leading-[1.55] whitespace-pre-wrap bg-[var(--bg-stripe)] border border-[var(--border)] border-l-[3px] border-l-[var(--brand-mid)] rounded-[var(--radius-sm)] px-3.5 py-2.5 my-2.5 text-[var(--text-primary)] overflow-x-auto">
      {children}
    </pre>
  );
}

/** The five composite rating tiers. Same hex as the reference grid; only the
 *  labels change to our compliant, advice-free vocabulary (design-system §4). */
const TIERS = [
  { range: '80–100', label: 'High Conviction', color: 'var(--c-tier-1)' },
  { range: '65–79', label: 'Constructive', color: 'var(--c-tier-2)' },
  { range: '50–64', label: 'Neutral', color: 'var(--c-tier-3)' },
  { range: '35–49', label: 'Cautious', color: 'var(--c-tier-4)' },
  { range: '0–34', label: 'Bearish', color: 'var(--c-tier-5)' },
] as const;

/**
 * In-app scoring methodology, opened from the "Methodology" button in the Stock
 * Detail subnav. Explains what the signed-in user is looking at — the Overall
 * Rating and its three pillars, the rating tiers, and the Verdict price bands —
 * with the actual formulas. Visual parity with the reference methodology modal
 * (`reference/original-design.html:794`), content corrected to the current
 * (post-S3) engine. Static: the same general explainer on every stock.
 */
export function MethodologyModal({ open, onOpenChange }: MethodologyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[680px] p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col gap-0.5 px-6 py-[18px] border-b border-[var(--border)] bg-gradient-to-br from-[#FAFBFC] to-[#F4F7FB]">
          <DialogTitle className="flex items-center gap-2.5 text-[16px]">
            <ShieldCheck
              className="w-[18px] h-[18px] text-[var(--brand-mid)] flex-shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            MajorCycle Scoring Methodology
          </DialogTitle>
          <DialogDescription className="pl-[28px]">
            How this stock is scored — every weight and formula shown.
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-[13px] leading-[1.65] text-[var(--text-secondary)]">
          <SectionHeading>Overall Rating (0–100)</SectionHeading>
          <p className="mb-2.5">
            A composite score that blends three pillars of the analysis into a
            single number, designed to answer one question:{' '}
            <em>is this stock worth my attention right now?</em>
          </p>
          <Formula>{`Overall Rating = (Financial Health × 0.40)
               + (Valuation × 0.35)
               + (Cycle Payoff × 0.25)`}</Formula>
          <p className="mb-2.5">
            <strong className="text-[var(--text-primary)]">Why these weights:</strong>{' '}
            Financial Health carries the largest weight because a strong business
            at a fair price tends to fare better over a full cycle than a fair
            business at a cheap price. Valuation is the timing input — where the
            price sits relative to its own historical drawdown band. Cycle Payoff
            is a reliability and reward-vs-risk tiebreaker.
          </p>

          <SectionHeading>Rating Tiers</SectionHeading>
          <div className="grid grid-cols-5 gap-1.5 my-3">
            {TIERS.map((t) => (
              <div
                key={t.label}
                className="text-center px-1.5 py-2 rounded-[var(--radius-sm)] text-white"
                style={{ background: t.color }}
              >
                <div className="font-[var(--font-mono)] text-[11px] font-semibold mb-[3px] opacity-95">
                  {t.range}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.6px] leading-tight opacity-95">
                  {t.label}
                </div>
              </div>
            ))}
          </div>

          <SectionHeading>Financial Health (0–100)</SectionHeading>
          <p className="mb-2.5">
            Measures the underlying strength of the business across five pillars.
            Higher is better.
          </p>
          <Formula>{`Financial Health = (Profitability   × 0.30)
                 + (Balance Sheet  × 0.25)
                 + (Growth         × 0.20)
                 + (Cash Flow      × 0.15)
                 + (Shareholder    × 0.10)`}</Formula>
          <p className="mb-2.5">
            When a pillar has no data, it is{' '}
            <strong className="text-[var(--text-primary)]">left out and the
            remaining pillars are re-weighted</strong> — we never fill the gap
            with a fabricated middle score. If fewer than three of the five
            pillars have data, Financial Health is withheld and shown as{' '}
            <em>&ldquo;Not enough data&rdquo;</em>{' '}
            (this is why some banks and REITs, whose accounts don&apos;t fit the
            standard template, show that).
          </p>

          <SectionHeading>Valuation (35% pillar)</SectionHeading>
          <p className="mb-2.5">
            Starts as{' '}
            <strong className="text-[var(--text-primary)]">cycle position</strong>{' '}
            — how deep today&apos;s drawdown is versus the stock&apos;s{' '}
            <em>typical</em> drawdown — shown as a zone:{' '}
            <strong>Deep Value · Value · Fair · Stretched</strong>. The score that
            feeds the Overall Rating is then scaled by company quality, so a
            cheap-but-weak business can&apos;t score as a bargain:
          </p>
          <Formula>{`quality_factor  = 0.30 + 0.70 × (Financial Health / 100) ^ 1.5
Valuation score = raw cycle score × quality_factor`}</Formula>
          <p className="mb-2.5">
            The zone <em>label</em> always reflects the raw price position; only
            the <em>score</em> is quality-adjusted.
          </p>

          <SectionHeading>Cycle Payoff (0–100)</SectionHeading>
          <p className="mb-2.5">
            <strong className="text-[var(--text-primary)]">Not a measure of
            current price trend.</strong>{' '}
            It blends two things equally: how many
            historical dip-then-recover cycles we&apos;ve observed (more cycles =
            a more trustworthy pattern; around 10+ is reliable) and the
            reward-vs-risk of those cycles:
          </p>
          <Formula>{`signal reliability  = how many historical cycles detected
reward vs risk      = typical profit ÷ |typical drawdown|`}</Formula>
          <p className="mb-2.5">
            To see the actual shape and{' '}
            <strong className="text-[var(--text-primary)]">timing</strong> of
            recoveries, read the <strong>Drawdown Analysis</strong> and{' '}
            <strong>Profit Recovery</strong> charts in the Cycle section — the
            curves are the real signal; this score just compresses them.
          </p>

          <SectionHeading>Verdict Price Bands</SectionHeading>
          <p className="mb-2.5">
            Every price level on the Verdict card is back-solved from the rolling
            peak over your selected lookback window and the stock&apos;s
            historical cycle statistics:
          </p>
          <Formula>{`peak          = close ÷ (1 + drawdown / 100)
typical price = peak × (1 + typical_drawdown / 100)
entry zone    = typical price, down to 85% of the way
                toward the lower bound
lower bound   = peak × (1 + worst_drawdown / 100)`}</Formula>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] bg-[var(--bg-stripe)] px-6 py-3 text-center text-[11px] tracking-[0.1px] text-[var(--text-muted)]">
          Information only — not financial advice. Every weight and threshold is
          shown above; nothing is computed off-screen.
        </div>
      </DialogContent>
    </Dialog>
  );
}
