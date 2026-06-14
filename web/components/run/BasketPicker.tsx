'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import {
  QUICK_BASKETS,
  sectorsFromUniverse,
  tickersInSector,
  type Basket,
} from '@/lib/baskets';
import type { UniverseStock } from '@/lib/universe.server';

// Quick baskets solve the blank-canvas problem: one click fills the selection.
// Sectors are an 11+-item list, so they live in a compact dropdown rather than
// taking a card each.

export function BasketPicker({
  universe,
  onAdd,
}: {
  universe: UniverseStock[];
  onAdd: (tickers: string[]) => void;
}) {
  const [sector, setSector] = useState('');
  const sectors = useMemo(() => sectorsFromUniverse(universe), [universe]);

  const addBasket = (basket: Basket) => onAdd(basket.resolve(universe));

  const addSector = (value: string) => {
    setSector(value);
    if (value) onAdd(tickersInSector(universe, value));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {QUICK_BASKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            title={b.description}
            onClick={() => addBasket(b)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--brand-bright)] hover:bg-[var(--brand-light)]"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--brand-mid)]" />
            {b.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label htmlFor="basket-sector" className="text-[12px] text-[var(--text-secondary)]">
          By sector
        </label>
        <select
          id="basket-sector"
          value={sector}
          onChange={(e) => addSector(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)]"
        >
          <option value="">Add a sector…</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
