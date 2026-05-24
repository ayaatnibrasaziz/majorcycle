export default function AppLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-8 w-48 bg-[var(--bg-stripe)] rounded-[var(--radius-sm)]" />
      <div className="h-32 bg-[var(--bg-stripe)] rounded-[var(--radius)]" />
      <div className="h-64 bg-[var(--bg-stripe)] rounded-[var(--radius)]" />
    </div>
  );
}
