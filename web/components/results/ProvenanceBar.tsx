'use client';

import type { AnalyzeRequest } from '@/lib/types';
import type { RunMeta } from '@/lib/analysis';
import { PRESET_LABELS, PRESETS, type PresetKey } from '@/lib/presets';

// The run-provenance strip at the top of Results: when the analysis ran, how many
// tickers, the Major Cycle horizon used, and the engine name. We deliberately do
// NOT name the third-party data provider in user-facing copy (design-system.md
// S9, owner decision) — so no "via <provider>" here.

function horizonLabel(params: AnalyzeRequest | null): string {
  if (!params) return 'Major Cycle';
  if (params.preset === 'custom') {
    const p = params.pullbackThreshold ?? '?';
    const pr = params.profitThreshold ?? '?';
    const lb = params.lookbackBars ?? '?';
    return `Custom horizon (${p}% / +${pr}% / ${lb}d)`;
  }
  const key = params.preset as PresetKey;
  const preset = PRESETS[key];
  return `${PRESET_LABELS[key]} horizon (${preset.pullbackThreshold}% / +${preset.profitThreshold}% / ${preset.lookbackBars}d)`;
}

function runTimeLabel(runMeta: RunMeta | null): string {
  const iso = runMeta?.finishedAt ?? runMeta?.startedAt;
  if (!iso) return 'No analysis run';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `Analysis run ${date} · ${time}`;
}

export function ProvenanceBar({
  params,
  runMeta,
  tickerCount,
}: {
  params: AnalyzeRequest | null;
  runMeta: RunMeta | null;
  tickerCount: number;
}) {
  return (
    <div className="provenance">
      <span className="pv-dot" />
      <span>{runTimeLabel(runMeta)}</span>
      <span className="pv-sep">·</span>
      <span>
        {tickerCount} ticker{tickerCount === 1 ? '' : 's'}
      </span>
      <span className="pv-sep">·</span>
      <span>{horizonLabel(params)}</span>
      <span className="pv-sep">·</span>
      <span>Major Cycle engine</span>
    </div>
  );
}
