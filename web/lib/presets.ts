// Run Analysis preset definitions.
// MUST stay in sync with analytics/presets.py — both files define the same values.

export const PRESETS = {
  short: { pullbackThreshold: -3, profitThreshold: 3, lookbackBars: 63 },
  medium: { pullbackThreshold: -5, profitThreshold: 5, lookbackBars: 252 },
  long: { pullbackThreshold: -8, profitThreshold: 8, lookbackBars: 756 },
} as const;

export type PresetKey = keyof typeof PRESETS;

export const PRESET_LABELS: Record<PresetKey, string> = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
};

export const PRESET_HORIZONS: Record<PresetKey, string> = {
  short: '~3 months',
  medium: '~1 year',
  long: '~3 years',
};

export const CUSTOM_PARAM_BOUNDS = {
  pullbackThreshold: { min: -30, max: -1 },
  profitThreshold: { min: 1, max: 30 },
  lookbackBars: { min: 21, max: 5040 },
} as const;
