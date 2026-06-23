'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { InfoTip } from '@/components/ui/InfoTip';
import { boundError, CUSTOM_PARAM_BOUNDS, PRESETS } from '@/lib/presets';
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
  { value: 'short', name: 'Short-Term', horizon: '~3 Months' },
  { value: 'medium', name: 'Medium-Term', horizon: '~1 Year' },
  { value: 'long', name: 'Long-Term', horizon: '~3 Years' },
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

  // Per-field validity for instant, field-local feedback. Presets are always in
  // bounds, so these only ever fire for a hand-edited (Custom) value.
  const pullbackErr = boundError(value.pullbackThreshold, CUSTOM_PARAM_BOUNDS.pullbackThreshold);
  const profitErr = boundError(value.profitThreshold, CUSTOM_PARAM_BOUNDS.profitThreshold);
  const lookbackErr = boundError(value.lookbackBars, CUSTOM_PARAM_BOUNDS.lookbackBars, true);

  return (
    <div>
      <div className="flex gap-2">
        {PRESET_CARDS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => selectPreset(c.value)}
            aria-pressed={value.preset === c.value}
            className="preset-btn"
          >
            <div className="preset-btn-name">{c.name}</div>
            <div className="preset-btn-horizon">{c.horizon}</div>
          </button>
        ))}
      </div>

      <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
        {PRESET_DESC[value.preset]}
      </p>

      <button type="button" onClick={() => setAdvOpen((o) => !o)} className="adv-toggle mt-1">
        <ChevronRight className={cn('adv-caret h-3.5 w-3.5', advOpen && 'open')} />
        Advanced parameters
      </button>

      {advOpen && (
        <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="Pullback Threshold %"
            tip="How deep a dip must be to count as a real pullback event in the cycle. More negative = only larger dips count."
            value={value.pullbackThreshold}
            step={0.5}
            error={pullbackErr}
            onChange={(n) => editField({ pullbackThreshold: n })}
          />
          <Field
            label="Profit Threshold %"
            tip="How large a rally must be to count as a real recovery event. Higher = only bigger rallies count."
            value={value.profitThreshold}
            step={0.5}
            error={profitErr}
            onChange={(n) => editField({ profitThreshold: n })}
          />
          <Field
            label="Rolling Lookback (bars)"
            tip="How far back the cycle engine scans for highs and lows. 1 bar = 1 trading day (~252 = 1 year)."
            value={value.lookbackBars}
            step={1}
            error={lookbackErr}
            onChange={(n) => editField({ lookbackBars: Math.round(n) })}
          />
        </div>
      )}

      {/* When Advanced is collapsed the per-field notes are hidden, so surface a
          single prompt if a hand-edited value is out of bounds. */}
      {!advOpen && validateHorizon(value) && (
        <button
          type="button"
          onClick={() => setAdvOpen(true)}
          className="mt-2 text-[11px] font-semibold text-[var(--c-tier-5)] underline"
        >
          A custom value is out of range — open Advanced to fix it.
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  tip,
  value,
  step,
  error,
  onChange,
}: {
  label: string;
  tip: string;
  value: number;
  step: number;
  error: string | null;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="set-field-label">
        {label}
        <InfoTip title={label}>{tip}</InfoTip>
      </div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        aria-label={label}
        aria-invalid={error !== null}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className={cn('set-field-input', error && 'set-field-input--error')}
      />
      {error && (
        <p className="mt-1 text-[10.5px] font-semibold text-[var(--c-tier-5)]">{error}</p>
      )}
    </div>
  );
}
