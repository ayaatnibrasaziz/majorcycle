'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';

interface OnboardingModalProps {
  userId: string;
}

export function OnboardingModal({ userId }: OnboardingModalProps) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleProceed() {
    if (!acknowledged) return;
    setLoading(true);
    const supabase = createBrowserClient();
    await supabase
      .from('profiles')
      .update({ acknowledged_disclaimer_at: new Date().toISOString() })
      .eq('id', userId);
    router.refresh();
  }

  return (
    <Dialog open>
      <DialogContent hideClose className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-[8px] bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(30,92,179,.3)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 17l5-5 4 3 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 8h4v4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <DialogTitle>Welcome to MajorCycle</DialogTitle>
          </div>
          <DialogDescription>
            Before you begin, please read and acknowledge the following.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {/* Methodology summary */}
          <div>
            <h2 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-[0.6px] mb-2">
              How MajorCycle Works
            </h2>
            <p>
              MajorCycle identifies historical drawdown and recovery &quot;cycles&quot; in a
              stock&apos;s price history. For each ticker it calculates:
            </p>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              <li>
                <strong>Cycle Position</strong> — where the current price sits relative to
                typical historical pullbacks and recoveries
              </li>
              <li>
                <strong>Financial Health Score</strong> — a 5-pillar composite of
                profitability, balance sheet, growth, cashflow, and shareholder returns
              </li>
              <li>
                <strong>Valuation Score</strong> — how stretched or compressed key
                valuation multiples are relative to history
              </li>
              <li>
                <strong>Overall Rating</strong> — a 0–100 composite of all three signals,
                mapped to one of five labels:{' '}
                <span className="font-semibold text-[var(--c-tier-1)]">High Conviction</span>
                ,{' '}
                <span className="font-semibold text-[var(--c-tier-2)]">Constructive</span>
                ,{' '}
                <span className="font-semibold text-[var(--c-tier-3)]">Neutral</span>
                ,{' '}
                <span className="font-semibold text-[var(--c-tier-4)]">Cautious</span>
                ,{' '}
                <span className="font-semibold text-[var(--c-tier-5)]">Bearish</span>
              </li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="bg-[var(--bg-stripe)] border border-[var(--border)] rounded-[var(--radius-sm)] px-4 py-3">
            <h2 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-[0.6px] mb-2">
              ⚠ Important Disclaimer
            </h2>
            <p>
              MajorCycle is an <strong>educational and informational tool only</strong>. It does
              not constitute financial advice, investment advice, or a recommendation to buy or
              sell any security.
            </p>
            <p className="mt-2">
              <strong>Past performance does not indicate future results.</strong> Historical cycle
              data is no guarantee of future price behaviour. Always conduct your own independent
              research and consult a qualified financial adviser before making any investment
              decision.
            </p>
            <p className="mt-2">
              The ratings shown (High Conviction, Constructive, Neutral, Cautious, Bearish) are
              <strong> algorithmic summaries, not recommendations</strong>. Analyst consensus data
              is displayed verbatim as third-party information.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ack"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
            />
            <Label htmlFor="ack" className="text-[12px] font-medium text-[var(--text-secondary)] cursor-pointer">
              I understand and acknowledge — this is not financial advice
            </Label>
          </div>
          <Button
            onClick={handleProceed}
            disabled={!acknowledged || loading}
            size="default"
          >
            {loading ? 'Continuing…' : 'Continue to MajorCycle →'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
