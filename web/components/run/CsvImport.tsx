'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

// CSV import — demoted to a small secondary action (most beginners use baskets
// or search). Validation logic is ported from the reference design's validateCSV:
// detect a 'ticker' column (or treat as a single-column list), dedupe, and split
// into known (added) vs unrecognised (skipped — live universe expansion is a
// deferred fast-follow). Known tickers feed the shared selection.

interface Preview {
  kind: 'ok' | 'warn' | 'error';
  lines: string[];
}

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

  const previewColor =
    preview?.kind === 'ok'
      ? 'var(--c-tier-2)'
      : preview?.kind === 'warn'
        ? '#D4A017'
        : 'var(--c-tier-5)';

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
        className={`flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] border border-dashed px-3 py-2.5 text-[12px] transition-colors ${
          dragging
            ? 'border-[var(--brand-bright)] bg-[var(--brand-light)]'
            : 'border-[var(--border-strong)] bg-[var(--bg-stripe)] hover:border-[var(--brand-bright)]'
        }`}
      >
        <Upload className="h-4 w-4 text-[var(--text-muted)]" />
        <span className="text-[var(--text-secondary)]">
          Import a CSV with a <span className="font-mono">ticker</span> column — drop here or
          click to browse
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {preview && (
        <div
          className="mt-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-stripe)] px-3 py-2 font-mono text-[11px] leading-relaxed"
          style={{ color: previewColor }}
        >
          {preview.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
