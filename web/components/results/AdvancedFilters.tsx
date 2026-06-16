'use client';

import { useEffect, useRef, useState } from 'react';

import { FIELD_BY_KEY } from './columns';
import type { ResultRow } from './columns';
import {
  ADV_FIELDS,
  defaultRule,
  distinctValues,
  firstAvailableField,
  opsFor,
  usedCategoricalFields,
  type AdvOp,
  type AdvRule,
} from './filters';

// The reference's "Advanced filters" multi-rule panel, ported to React. Rules
// combine with AND and the table updates live. Numeric fields support ≥ / ≤ /
// between; categorical fields use a multi-select checkbox dropdown (one rule per
// categorical field); text fields use contains.

export function AdvancedFilters({
  rows,
  rules,
  onChange,
}: {
  rows: ResultRow[];
  rules: AdvRule[];
  onChange: (rules: AdvRule[]) => void;
}) {
  const addRule = () => onChange([...rules, defaultRule(firstAvailableField(rules))]);
  const removeRule = (id: number) => onChange(rules.filter((r) => r.id !== id));
  const clearRules = () => onChange([]);

  const updateRule = (id: number, patch: Partial<AdvRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const changeField = (rule: AdvRule, fieldKey: string) => {
    const f = FIELD_BY_KEY[fieldKey];
    if (!f) return;
    // Guard: don't let two rules target the same categorical field.
    if (f.type === 'categorical' && usedCategoricalFields(rules, rule.id).includes(fieldKey)) return;
    const op = opsFor(f.type)[0]![0];
    const value: string | string[] =
      f.type === 'numeric' ? (op === 'between' ? ['', ''] : '') : f.type === 'categorical' ? [] : '';
    updateRule(rule.id, { field: fieldKey, type: f.type, op, value });
  };

  const changeOp = (rule: AdvRule, op: AdvOp) => {
    const value: string | string[] =
      rule.type === 'numeric' ? (op === 'between' ? ['', ''] : '') : rule.value;
    updateRule(rule.id, { op, value });
  };

  return (
    <div className="adv-panel">
      <div className="adv-head">
        <span className="adv-title">Advanced filters</span>
        <span className="adv-hint">All rules combine with AND · table updates live</span>
        {rules.length > 0 && (
          <button type="button" className="adv-clear" onClick={clearRules}>
            Clear all
          </button>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="adv-empty">No filters yet — click “+ Add filter” to narrow the table.</div>
      ) : (
        rules.map((rule) => {
          const used = usedCategoricalFields(rules, rule.id);
          return (
            <div key={rule.id} className="adv-rule">
              <select
                className="adv-field"
                value={rule.field}
                onChange={(e) => changeField(rule, e.target.value)}
              >
                {ADV_FIELDS.map((f) => {
                  const taken = f.type === 'categorical' && used.includes(f.key);
                  return (
                    <option key={f.key} value={f.key} disabled={taken}>
                      {f.label}
                      {taken ? ' (in use)' : ''}
                    </option>
                  );
                })}
              </select>

              <select
                className="adv-op"
                value={rule.op}
                onChange={(e) => changeOp(rule, e.target.value as AdvOp)}
              >
                {opsFor(rule.type).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>

              <RuleValue rows={rows} rule={rule} onChange={(value) => updateRule(rule.id, { value })} />

              <button
                type="button"
                className="adv-rmv"
                onClick={() => removeRule(rule.id)}
                title="Remove filter"
                aria-label="Remove filter"
              >
                ×
              </button>
            </div>
          );
        })
      )}

      <button type="button" className="adv-add" onClick={addRule}>
        + Add filter
      </button>
    </div>
  );
}

function RuleValue({
  rows,
  rule,
  onChange,
}: {
  rows: ResultRow[];
  rule: AdvRule;
  onChange: (value: string | string[]) => void;
}) {
  if (rule.type === 'numeric') {
    if (rule.op === 'between') {
      const [a, b] = Array.isArray(rule.value) ? rule.value : ['', ''];
      return (
        <>
          <input
            type="number"
            value={a}
            onChange={(e) => onChange([e.target.value, b ?? ''])}
            aria-label="Lower value"
          />
          <span className="adv-and">AND</span>
          <input
            type="number"
            value={b}
            onChange={(e) => onChange([a ?? '', e.target.value])}
            aria-label="Upper value"
          />
        </>
      );
    }
    return (
      <input
        type="number"
        value={typeof rule.value === 'string' ? rule.value : ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Value"
      />
    );
  }

  if (rule.type === 'categorical') {
    return <CategoricalSelect rows={rows} rule={rule} onChange={onChange} />;
  }

  return (
    <input
      type="text"
      value={typeof rule.value === 'string' ? rule.value : ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Value"
    />
  );
}

function CategoricalSelect({
  rows,
  rule,
  onChange,
}: {
  rows: ResultRow[];
  rule: AdvRule;
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = Array.isArray(rule.value) ? rule.value : [];
  const options = distinctValues(rows, rule.field);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  const caption = selected.length === 0 ? 'Any' : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  const toggle = (val: string, checked: boolean) => {
    const set = new Set(selected);
    if (checked) set.add(val);
    else set.delete(val);
    onChange([...set]);
  };

  return (
    <div className="adv-cbd" ref={ref}>
      <button
        type="button"
        className="adv-cbd-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="adv-cbd-cap">{caption}</span>
        <span className="adv-cbd-arr">▼</span>
      </button>
      {open && (
        <div className="adv-cbd-menu">
          {options.length === 0 ? (
            <div className="adv-empty px-1">No values</div>
          ) : (
            options.map((o) => (
              <label key={o} className="adv-cbd-opt">
                <input
                  type="checkbox"
                  checked={selected.includes(o)}
                  onChange={(e) => toggle(o, e.target.checked)}
                />
                {o}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
