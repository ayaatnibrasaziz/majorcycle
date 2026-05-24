import Link from 'next/link';
import { TrendingUp, ShieldCheck, BarChart3, Activity, Sparkles } from 'lucide-react';

const tiers = [
  { label: 'High Conviction', color: '#22c55e', glow: '#16a34a' },
  { label: 'Constructive',    color: '#84cc16', glow: '#65a30d' },
  { label: 'Neutral',         color: '#fbbf24', glow: '#d97706' },
  { label: 'Cautious',        color: '#fb923c', glow: '#ea580c' },
  { label: 'Bearish',         color: '#f87171', glow: '#dc2626' },
];

const features = [
  { icon: BarChart3,   text: 'Coverage across S&P 500, ASX 200, and S&P/TSX 60' },
  { icon: Activity,    text: 'Major Cycle drawdown & recovery analysis on every ticker' },
  { icon: ShieldCheck, text: 'Five-pillar financial health scoring' },
];

export function AuthHero() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 overflow-hidden text-white">
      {/* Layered background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 18% 18%, #2E7DE8 0%, transparent 38%), radial-gradient(circle at 82% 82%, #1A3A6E 0%, transparent 42%), linear-gradient(135deg, #14274a 0%, #1A3A6E 50%, #1E5CB3 100%)',
        }}
      />
      {/* Grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Vignette */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(10,20,40,0.45) 100%)',
        }}
      />

      {/* Logo */}
      <div className="relative">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-[10px] bg-white flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-[1.04]">
            <TrendingUp className="w-[22px] h-[22px] text-[var(--brand-deep)]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[19px] font-bold tracking-[-0.4px] leading-none">MajorCycle</div>
            <div className="text-[10px] font-semibold uppercase tracking-[1.4px] text-white/65 mt-1.5 font-mono">
              Financial Terminal
            </div>
          </div>
        </Link>
      </div>

      {/* Center content */}
      <div className="relative max-w-[460px]">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-6 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-[10.5px] font-bold uppercase tracking-[1.4px] text-white/85">
          <Sparkles className="w-3 h-3" strokeWidth={2.5} />
          Premium financial terminal
        </div>

        <h2 className="text-[40px] xl:text-[44px] font-bold leading-[1.08] tracking-[-0.8px] mb-5">
          Know exactly where each stock sits in its{' '}
          <span className="relative inline-block">
            <span className="relative bg-gradient-to-r from-white via-[#bfdbfe] to-[#7dd3fc] bg-clip-text text-transparent">
              Major Cycle.
            </span>
          </span>
        </h2>
        <p className="text-[15px] leading-[1.6] text-white/75 mb-10 max-w-[420px]">
          Map every ticker against its historical drawdown and recovery cycles — alongside fundamental
          health, valuation positioning, and analyst data.
        </p>

        <ul className="flex flex-col gap-4 mb-12">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3.5">
              <span className="w-9 h-9 rounded-[9px] bg-white/8 backdrop-blur-sm border border-white/15 flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2} />
              </span>
              <span className="text-[14px] text-white/90 leading-snug">{text}</span>
            </li>
          ))}
        </ul>

        {/* Tier legend */}
        <div>
          <div className="text-[10px] font-bold tracking-[1.4px] uppercase text-white/55 mb-3 font-mono">
            Our 5 rating tiers
          </div>
          <div className="flex flex-wrap gap-2">
            {tiers.map((t) => (
              <div
                key={t.label}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11.5px] font-semibold bg-white/10 backdrop-blur-sm border border-white/15"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: t.color, boxShadow: `0 0 8px ${t.glow}` }}
                />
                <span className="text-white/95">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative text-[11px] text-white/45 leading-relaxed max-w-[420px] italic">
        Information only — not financial advice. Past performance does not indicate future results.
      </div>
    </div>
  );
}
