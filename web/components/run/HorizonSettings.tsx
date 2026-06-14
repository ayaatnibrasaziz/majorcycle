'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { InfoTip } from '@/components/ui/InfoTip';
import { CUSTOM_PARAM_BOUNDS, PRESETS } from '@/lib/presets';
import { cn } from '@/lib/utils';

// Horizon presets lead; raw thresholds + lookback are tucked behind an "Advanced"
// disclosure so a beginner never has to reason about −5% / 252 bars. Editing any
// advanced field switches the selector to Custom (mirrors the reference UX).

export type PresetChoice = 'short' | 'medium' | 'long' | 'custom';

export interface HorizonValue {
  preset: PresetChoice;
  pullbackThreshold: number;
  profitThreshold: number;
  lookbackBars: number;
}

const PRESET_CARDS: { value: PresetChoice; name: string; horizon: string }[] = [
  { value: 'short', name: 'Short-Term', horizon: '≈ 3 months' },
  { value: 'medium', name: 'Medium-Term', horizon: '≈ 1 year' },
  { value: 'long', name: 'Long-Term', horizon: '≈ 3 years' },
  { value: 'custom', name: 'Custom', horizon: 'Manual' },
];

const PRESET_DESC: Record<PresetChoice, string> = {
  short: 'Tuned for recent swings — looks back ~1 quarter and flags smaller −3% dips / +3% rallies.',
  medium: 'The balanced default — looks back ~1 year using the standard −5% / +5% thresholds.',
  long: 'Tuned for structural moves — looks back ~3 years with wider −8% / +8% thresholds.',
  custom: 'Your own parameters — adjust any field below; presets won’t override your values.',
};

/** Returns an error message if the (custom) params are out of contract bounds. */
export function validateHorizon(v: HorizonValue): string | null {
  if (v.preset !== 'custom') return null;
  const b = CUSTOM_PARAM_BOUNDS;
  if (!(v.pullbackThreshold >= b.pullbackThreshold.min && v.pullbackThreshold <= b.pullbackThreshold.max))
    return `Pullback must be between ${b.pullbackThreshold.min} and ${b.pullbackThreshold.max}.`;
  if (!(v.profitThreshold >= b.profitThreshold.min && v.profitThreshold <= b.profitThreshold.max))
    return `Profit must be between ${b.profitThreshold.min} and ${b.profitThreshold.max}.`;
  if (
    !Number.isInteger(v.lookbackBars) ||
    !(v.lookbackBars >= b.lookbackBars.min && v.lookbackBars <= b.lookbackBars.max)
  )
    return `Lookback must be a whole number between ${b.lookbackBars.min} and ${b.lookbackBars.max}.`;
  return null;
}

export function HorizonSettings({
  value,
  onChange,
}: {
  value: HorizonValue;
  onChange: (v: HorizonValue) => void;
}) {
  const [advOpen, setAdvOpen] = useState(false);

  const selectPreset = (preset: PresetChoice) => {
    if (preset === 'custom') {
      onChange({ ...value, preset });
      setAdvOpen(true);
      return;
    }
    const p = PRESETS[preset];
    onChange({
      preset,
      pullbackThreshold: p.pullbackThreshold,
      profitThreshold: p.profitThreshold,
      lookbackBars: p.lookbackBars,
    });
  };

  // A manual edit to any field switches to Custom.
  const editField = (patch: Partial<HorizonValue>) =>
    onChange({ ...value, ...patch, preset: 'custom' });

  const error = validateHorizon(value);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRESET_CARDS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => selectPreset(c.value)}
            aria-pressed={value.preset === c.value}
            className={cn(
              'rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-colors',
              value.preset === c.value
                ? 'border-[var(--brand-bright)] bg-[var(--brand-light)]'
                : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--brand-bright)]',
            )}
          >
            <div className="text-[12px] font-bold text-[var(--text-primary)]">{c.name}</div>
            <div className="font-mono text-[10px] text-[var(--text-muted)]">{c.horizon}</div>
          </button>
        ))}
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
        {PRESET_DESC[value.preset]}
      </p>

      <button
        type="button"
        onClick={() => setAdvOpen((o) => !o)}
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--brand-mid)]"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', advOpen && 'rotate-90')} />
        Advanced parameters
      </button>

      {advOpen && (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="Pullback Threshold %"
            tip="How deep a dip must be to count as a real pullback event in the cycle. More negative = only larger dips count."
            value={value.pullbackThreshold}
            step={0.5}
            onChange={(n) => editField({ pullbackThreshold: n })}
          />
          <Field
            label="Profit Threshold %"
            tip="How large a rally must be to count as a real recovery event. Higher = only bigger rallies count."
            value={value.profitThreshold}
            step={0.5}
            onChange={(n) => editField({ profitThreshold: n })}
          />
          <Field
            label="Rolling Lookback (bars)"
            tip="How far back the cycle engine scans for highs and lows. 1 bar = 1 trading day (~252 = 1 year)."
            value={value.lookbackBars}
            step={1}
            onChange={(n) => editField({ lookbackBars: Math.round(n) })}
          />
        </div>
      )}

      {error && <p className="mt-2 text-[11px] font-semibold text-[var(--c-tier-5)]">{error}</p>}
    </div>
  );
}

function Field({
  label,
  tip,
  value,
  step,
  onChange,
}: {
  label: string;
  tip: string;
  value: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </span>
        <InfoTip title={label}>{tip}</InfoTip>
      </div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--brand-bright)]"
      />
    </div>
  );
}
