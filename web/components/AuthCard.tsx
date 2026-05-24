interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] shadow-[0_24px_60px_-12px_rgba(15,25,35,0.12),0_8px_24px_-8px_rgba(15,25,35,0.08)] overflow-hidden">
      <div className="px-7 py-8 sm:px-9 sm:py-10">
        {/* Heading */}
        <div className="mb-7">
          <h1 className="text-[22px] sm:text-[24px] font-bold text-[var(--text-primary)] tracking-[-0.4px] leading-[1.2]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
