export default function StockDetailLoading() {
  return (
    <div className="-mt-2 animate-pulse">
      <div className="sticky top-[var(--header-h)] z-[50] -mx-6 px-6 border-b border-[var(--border)] bg-white/92 backdrop-blur-md">
        <div className="h-[46px] flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[28px] w-[88px] bg-[var(--bg-stripe)] rounded-[var(--radius-sm)]"
            />
          ))}
        </div>
      </div>

      <div className="pt-5 space-y-[18px]">
        <div className="h-[120px] bg-[var(--bg-stripe)] rounded-[var(--radius)]" />
        <div className="h-[220px] bg-[var(--bg-stripe)] rounded-[var(--radius)]" />
        <div className="h-[320px] bg-[var(--bg-stripe)] rounded-[var(--radius)]" />
        <div className="h-[260px] bg-[var(--bg-stripe)] rounded-[var(--radius)]" />
      </div>
    </div>
  );
}
