'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import {
  QUICK_BASKETS,
  industriesBySector,
  sectorsFromUniverse,
  tickersInIndustry,
  tickersInSector,
  type Basket,
} from '@/lib/baskets';
import type { UniverseStock } from '@/lib/universe.server';

// Quick baskets solve the blank-canvas problem: one click fills the selection.
// Sectors are an 11+-item list, so they live in a compact dropdown. Industries
// (~126) live in a second dropdown, grouped under their sector via <optgroup>.

export function BasketPicker({
  universe,
  onAdd,
}: {
  universe: UniverseStock[];
  onAdd: (tickers: string[]) => void;
}) {
  const [sector, setSector] = useState('');
  const [industry, setIndustry] = useState('');
  const sectors = useMemo(() => sectorsFromUniverse(universe), [universe]);
  const industryGroups = useMemo(() => industriesBySector(universe), [universe]);

  const addBasket = (basket: Basket) => onAdd(basket.resolve(universe));

  const addSector = (value: string) => {
    setSector(value);
    if (value) onAdd(tickersInSector(universe, value));
  };

  const addIndustry = (value: string) => {
    setIndustry(value);
    if (value) onAdd(tickersInIndustry(universe, value));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {QUICK_BASKETS.map((b) => (
        <button
          key={b.id}
          type="button"
          title={b.description}
          onClick={() => addBasket(b)}
          className="basket-chip"
        >
          <Plus className="h-3.5 w-3.5" />
          {b.label}
        </button>
      ))}
      <select
        aria-label="Add a sector"
        value={sector}
        onChange={(e) => addSector(e.target.value)}
        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-[6px] text-[12px] text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--brand-bright)]"
      >
        <option value="">+ By sector…</option>
        {sectors.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        aria-label="Add an industry"
        value={industry}
        onChange={(e) => addIndustry(e.target.value)}
        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-[6px] text-[12px] text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--brand-bright)]"
      >
        <option value="">+ By industry…</option>
        {industryGroups.map((g) => (
          <optgroup key={g.sector} label={g.sector}>
            {g.industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
