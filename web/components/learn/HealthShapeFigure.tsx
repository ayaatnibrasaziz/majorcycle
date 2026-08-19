import { Figure, LegendItem } from '@/components/Figure';
import { healthColor, healthRatingLabel } from '@/lib/ratings';
import type { Company } from './bargainGeometry';
import {
  BIGGEST_PILLAR_GAP,
  CHECKS,
  GEARED,
  GEARED_HEALTH,
  GEARED_WEAKEST,
  SOLID,
  SOLID_HEALTH,
  SOLID_WEAKEST,
} from './healthShapeGeometry';

/**
 * The one figure for "How to check if a company is financially healthy".
 *
 * Two companies with the **same total** and opposite shapes. The bargain
 * article's figure made the point that one chart can hide two businesses; this
 * one makes the harder point that one *score* can too.
 *
 * ⚠️ Product palette (`healthColor` / `healthRatingLabel`) and no white-on-tier
 * text, for the same reasons as the other health figure (CLAUDE.md 11l, 11m).
 */

function Panel({ company, health }: { company: Company; health: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
          {company.name}
        </span>
        <span
          className="font-[family-name:var(--font-mono)] text-[13px] font-semibold text-[var(--text-primary)]"
          data-health-total={company.name}
        >
          {health.toFixed(0)}{' '}
          <span className="ml-1.5 font-[family-name:inherit] text-[12px] font-normal text-[var(--text-secondary)]">
            {healthRatingLabel(health)}
          </span>
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-[7px]" data-shape={company.name}>
        {CHECKS.map((chk) => {
          const value = company.scores[chk.key];
          return (
            <li key={chk.key} className="grid grid-cols-[1fr_auto] items-center gap-x-2">
              <span className="text-[12px] leading-tight text-[var(--text-secondary)]">
                {chk.label}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[var(--text-secondary)]">
                {value}
              </span>
              <span className="col-span-2 h-[7px] w-full rounded-full bg-[var(--border)]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${value}%`, backgroundColor: healthColor(value) }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HealthShapeFigure() {
  return (
    <Figure
      legend={
        <LegendItem
          swatch={
            <span
              className="block h-[7px] w-6 rounded-full"
              style={{ backgroundColor: 'var(--c-tier-1)' }}
            />
          }
        >
          Each bar is one of the five checks, scored out of 100
        </LegendItem>
      }
      caption={
        <>
          Two imaginary companies with{' '}
          <strong>exactly the same score — {GEARED_HEALTH.toFixed(0)} out of 100</strong>{' '}
          — and nothing else in common. Company C earns well but is carrying real
          debt; its weakest check is {GEARED_WEAKEST.label.toLowerCase()}, at{' '}
          {GEARED_WEAKEST.value}. Company D is dull and almost unbreakable; its
          weakest is {SOLID_WEAKEST.label.toLowerCase()}, at {SOLID_WEAKEST.value}.
          On one check they are {BIGGEST_PILLAR_GAP} points apart. The headline
          number is honest and still does not tell you which risk you would be
          taking — which is why it is worth opening.
        </>
      }
    >
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-6">
        <Panel company={GEARED} health={GEARED_HEALTH} />
        <Panel company={SOLID} health={SOLID_HEALTH} />
      </div>
    </Figure>
  );
}
