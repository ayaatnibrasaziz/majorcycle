// Filtering + sorting logic for the Results screener. Pure functions over
// ResultRow[], shared by the toolbar, the advanced rule-builder, and the
// orchestrator so the table, Opportunity Map and export all see the same set.

import type { OverallLabel } from '@/lib/types';
import { FIELD_BY_KEY, FILTER_FIELDS, type Field, type ResultRow } from './columns';

export type QuickFilter = 'all' | 'constructivePlus' | 'weak';

export const POSITIVE_LABELS: OverallLabel[] = ['High Conviction', 'Constructive'];
export const NEGATIVE_LABELS: OverallLabel[] = ['Cautious', 'Bearish'];

export type AdvOp = 'gte' | 'lte' | 'between' | 'isany' | 'contains';

export interface AdvRule {
  id: number;
  field: string;
  type: 'numeric' | 'categorical' | 'text';
  op: AdvOp;
  value: string | string[];
}

export interface FilterState {
  query: string;
  /** Empty = all tiers; otherwise restrict to this overall label. */
  tier: OverallLabel | '';
  minRating: number;
  quick: QuickFilter;
  rules: AdvRule[];
}

export const INITIAL_FILTER: FilterState = {
  query: '',
  tier: '',
  minRating: 0,
  quick: 'all',
  rules: [],
};

// ── Advanced rules (mirror the reference's rulePasses/advRulesPass) ───────────

function ruleValue(r: ResultRow, field: string): number | string | null {
  return FIELD_BY_KEY[field]?.get(r) ?? null;
}

function rulePasses(r: ResultRow, rule: AdvRule): boolean {
  const v = ruleValue(r, rule.field);
  if (rule.type === 'numeric') {
    if (v == null || typeof v !== 'number' || Number.isNaN(v)) return false;
    if (rule.op === 'gte') {
      const n = Number(rule.value);
      return rule.value !== '' && !Number.isNaN(n) && v >= n;
    }
    if (rule.op === 'lte') {
      const n = Number(rule.value);
      return rule.value !== '' && !Number.isNaN(n) && v <= n;
    }
    if (rule.op === 'between') {
      const [a, b] = Array.isArray(rule.value) ? rule.value : ['', ''];
      if (a === '' || b === '') return true; // incomplete range = no constraint
      const lo = Number(a);
      const hi = Number(b);
      return v >= Math.min(lo, hi) && v <= Math.max(lo, hi);
    }
    return true;
  }
  if (rule.type === 'categorical') {
    const sel = Array.isArray(rule.value) ? rule.value : [];
    if (sel.length === 0) return true; // no selection = no constraint
    return v != null && sel.includes(String(v));
  }
  // text
  const needle = typeof rule.value === 'string' ? rule.value : '';
  if (!needle) return true;
  return String(v ?? '').toLowerCase().includes(needle.toLowerCase());
}

export function advRulesPass(r: ResultRow, rules: AdvRule[]): boolean {
  return rules.every((rule) => rulePasses(r, rule));
}

// ── Top-level filter + sort ──────────────────────────────────────────────────

export function applyFilters(rows: ResultRow[], f: FilterState): ResultRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.ticker.toLowerCase().includes(q) && !(r.name ?? '').toLowerCase().includes(q)) {
      return false;
    }
    if (f.tier && r.overallLabel !== f.tier) return false;
    if (r.overallRating < f.minRating) return false;
    if (f.quick === 'constructivePlus' && !POSITIVE_LABELS.includes(r.overallLabel)) return false;
    if (f.quick === 'weak' && !NEGATIVE_LABELS.includes(r.overallLabel)) return false;
    if (!advRulesPass(r, f.rules)) return false;
    return true;
  });
}

export function sortRows(rows: ResultRow[], key: string, asc: boolean): ResultRow[] {
  const field = FIELD_BY_KEY[key];
  if (!field) return rows;
  const dir = asc ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = field.get(a);
    const bv = field.get(b);
    // Nulls always sort last regardless of direction.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

export function isFilterActive(f: FilterState): boolean {
  return (
    f.query.trim() !== '' ||
    f.tier !== '' ||
    f.minRating > 0 ||
    f.quick !== 'all' ||
    f.rules.length > 0
  );
}

// ── Advanced rule-builder helpers ────────────────────────────────────────────

export const ADV_FIELDS: Field[] = FILTER_FIELDS;

export function opsFor(type: AdvRule['type']): Array<[AdvOp, string]> {
  if (type === 'numeric') {
    return [
      ['gte', '≥'],
      ['lte', '≤'],
      ['between', 'between'],
    ];
  }
  if (type === 'categorical') return [['isany', 'is any of']];
  return [['contains', 'contains']];
}

/** Distinct, sorted values present in the data for a categorical field. */
export function distinctValues(rows: ResultRow[], field: string): string[] {
  const f = FIELD_BY_KEY[field];
  if (!f) return [];
  const set = new Set<string>();
  for (const r of rows) {
    const v = f.get(r);
    if (v != null && v !== '') set.add(String(v));
  }
  return [...set].sort();
}

/** Categorical fields already claimed by another rule (one rule per such field). */
export function usedCategoricalFields(rules: AdvRule[], exceptId: number | null): string[] {
  return rules
    .filter((r) => r.type === 'categorical' && r.id !== exceptId)
    .map((r) => r.field);
}

export function firstAvailableField(rules: AdvRule[]): string {
  const used = usedCategoricalFields(rules, null);
  const found = ADV_FIELDS.find((f) => f.type !== 'categorical' || !used.includes(f.key));
  return (found ?? ADV_FIELDS[0]!).key;
}

let _ruleSeq = 0;
export function defaultRule(field: string): AdvRule {
  const f = FIELD_BY_KEY[field]!;
  const op = opsFor(f.type)[0]![0];
  const value: string | string[] =
    f.type === 'numeric' ? (op === 'between' ? ['', ''] : '') : f.type === 'categorical' ? [] : '';
  return { id: ++_ruleSeq, field, type: f.type, op, value };
}
