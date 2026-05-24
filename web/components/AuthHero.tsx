import Link from 'next/link';
import { TrendingUp, ShieldCheck, BarChart3, Activity } from 'lucide-react';

const tiers = [
  { label: 'High Conviction', score: '82', color: 'var(--c-tier-1)', bg: 'rgba(0,100,0,0.18)' },
  { label: 'Constructive',    score: '71', color: 'var(--c-tier-2)', bg: 'rgba(34,139,34,0.18)' },
  { label: 'Neutral',         score: '58', color: 'var(--c-tier-3)', bg: 'rgba(212,160,23,0.18)' },
  { label: 'Cautious',        score: '42', color: 'var(--c-tier-4)', bg: 'rgba(255,69,0,0.18)' },
  { label: 'Bearish',         score: '28', color: 'var(--c-tier-5)', bg: 'rgba(178,34,34,0.18)' },
];

const features = [
  { icon: BarChart3,   text: 'S&P 500 · ASX 200 · S&P/TSX 60 coverage' },
  { icon: Activity,    text: 'Major Cycle drawdown & recovery analysis' },
  { icon: ShieldCheck, text: '5-pillar financial health scoring' },
];

export function AuthHero() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-12 overflow-hidden bg-gradient-to-br from-[var(--brand-deep)] via-[#1E5CB3] to-[var(--brand-bright)] text-white">
      {/* Decorative grid overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Glow orbs */}
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{ background: 'radial-gradient(circle, #2E7DE8 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full blur-3xl opacity-25"
        style={{ background: 'radial-gradient(circle, #EBF3FF 0%, transparent 70%)' }}
      />

      {/* Logo */}
      <div className="relative z-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-[10px] bg-white/95 flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition-transform group-hover:scale-105">
            <TrendingUp className="w-6 h-6 text-[var(--brand-deep)]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[18px] font-bold tracking-[-0.4px] leading-none">MajorCycle</div>
            <div className="text-[10px] font-medium uppercase tracking-[1.2px] text-white/70 mt-1">
              Financial Terminal
            </div>
          </div>
        </Link>
      </div>

      {/* Center content */}
      <div className="relative z-10 max-w-md">
        <h2 className="text-[34px] xl:text-[38px] font-bold leading-[1.12] tracking-[-0.6px] mb-5">
          Discover where stocks sit in their{' '}
          <span className="bg-gradient-to-r from-white to-[var(--brand-light)] bg-clip-text text-transparent">
            Major Cycle.
          </span>
        </h2>
        <p className="text-[14.5px] leading-[1.65] text-white/80 mb-8">
          A premium financial terminal that maps every stock against its historical drawdown and
          recovery cycles — alongside fundamental health, valuation positioning, and analyst data.
        </p>

        <ul className="flex flex-col gap-3.5 mb-10">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[13.5px] text-white/90">
              <span className="w-8 h-8 rounded-[8px] bg-white/12 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-[17px] h-[17px]" strokeWidth={2} />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {/* Tier legend */}
        <div className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-[var(--radius)] p-4">
          <div className="text-[10px] font-bold tracking-[1px] uppercase text-white/60 mb-3">
            Our Rating Tiers
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tiers.map((t) => (
              <div
                key={t.label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{ background: t.bg, color: 'white', border: `1px solid ${t.color}66` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: t.color, boxShadow: `0 0 6px ${t.color}` }}
                />
                {t.label}
                <span className="font-mono text-white/70 ml-0.5">{t.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-[11px] text-white/55 leading-relaxed max-w-md italic">
        Information only — not financial advice. Past performance does not indicate future results.
      </div>
    </div>
  );
}
