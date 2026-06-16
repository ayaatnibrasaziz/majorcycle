'use client';

import { useRef, useState } from 'react';
import { Upload, Download } from 'lucide-react';

import { cn } from '@/lib/utils';

// A small example file so users see the expected format: a single `ticker`
// column, one symbol per row. Non-US tickers use their storage suffix (.AX / .TO)
// — that's how they must be written to match our universe. 15 real large-caps
// across all three markets (5 US, 5 AU, 5 CA), so every row validates on import.
const SAMPLE_CSV =
  'ticker\n' +
  'AAPL\nMSFT\nNVDA\nGOOGL\nAMZN\n' +
  'BHP.AX\nRIO.AX\nCBA.AX\nWBC.AX\nNAB.AX\n' +
  'RY.TO\nTD.TO\nSHOP.TO\nENB.TO\nBNS.TO\n';

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tickers_sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// CSV import — demoted to a small secondary action (most beginners use baskets
// or search). Validation logic is ported from the reference design's validateCSV:
// detect a 'ticker' column (or treat as a single-column list), dedupe, and split
// into known (added) vs unrecognised (skipped — live universe expansion is a
// deferred fast-follow). Known tickers feed the shared selection.

interface Preview {
  kind: 'ok' | 'warn' | 'error';
  lines: string[];
}

const PREVIEW_COLOR: Record<Preview['kind'], string> = {
  ok: 'var(--c-tier-2)',
  warn: 'var(--c-tier-3)',
  error: 'var(--c-tier-5)',
};

export function CsvImport({
  knownTickers,
  onAdd,
}: {
  knownTickers: Set<string>;
  onAdd: (tickers: string[]) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parse = (filename: string, text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      setPreview({ kind: 'error', lines: [`${filename} is empty.`] });
      return;
    }
    const header = (lines[0] ?? '').split(',').map((c) => c.trim().toLowerCase());
    let col = header.indexOf('ticker');
    let dataLines: string[];
    if (col >= 0) {
      dataLines = lines.slice(1);
    } else {
      col = 0; // no header — assume a single-column ticker list
      dataLines = lines;
    }

    const seen = new Set<string>();
    const valid: string[] = [];
    const unknown: string[] = [];
    let dupes = 0;
    for (const line of dataLines) {
      const raw = (line.split(',')[col] ?? '').trim().toUpperCase();
      if (!raw) continue;
      if (seen.has(raw)) {
        dupes += 1;
        continue;
      }
      seen.add(raw);
      if (knownTickers.has(raw)) valid.push(raw);
      else unknown.push(raw);
    }

    const total = valid.length + unknown.length;
    if (total === 0) {
      setPreview({ kind: 'error', lines: [`No tickers found in ${filename}.`] });
      return;
    }

    const out: string[] = [`${filename} · ${total} ticker${total === 1 ? '' : 's'} detected`];
    out.push(`✓ ${valid.length} ready to analyse`);
    if (unknown.length > 0) {
      const sample = unknown.slice(0, 6).join(', ') + (unknown.length > 6 ? '…' : '');
      out.push(`⚠ ${unknown.length} unrecognised — ${sample} (skipped)`);
    }
    if (dupes > 0) out.push(`⚠ ${dupes} duplicate${dupes === 1 ? '' : 's'} removed`);

    if (valid.length === 0) setPreview({ kind: 'error', lines: out });
    else if (unknown.length > 0 || dupes > 0) setPreview({ kind: 'warn', lines: out });
    else setPreview({ kind: 'ok', lines: out });

    if (valid.length > 0) onAdd(valid);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setPreview({ kind: 'error', lines: [`${file.name} is not a .csv file.`] });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => parse(file.name, String(ev.target?.result ?? ''));
    reader.onerror = () => setPreview({ kind: 'error', lines: [`Could not read ${file.name}.`] });
    reader.readAsText(file);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          'upload-zone',
          dragging && 'drag-over',
          preview?.kind === 'ok' && 'upload-valid',
          preview?.kind === 'warn' && 'upload-warn',
          preview?.kind === 'error' && 'upload-error',
        )}
      >
        <Upload className="h-4 w-4" />
        <span>
          Import a CSV with a <span className="font-[var(--font-mono)]">ticker</span> column —
          drop here or click to browse
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        // Reset the value AFTER capturing the file so picking the SAME file again
        // (or re-opening the dialog) still fires onChange.
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={downloadSampleCsv}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-mid)] hover:text-[var(--brand-bright)] hover:underline"
      >
        <Download className="h-3 w-3" /> Download sample CSV
      </button>
      {preview && (
        <div className="upload-preview" style={{ color: PREVIEW_COLOR[preview.kind] }}>
          {preview.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
