interface AuthDividerProps {
  label?: string;
}

export function AuthDivider({ label = 'or continue with' }: AuthDividerProps) {
  return (
    <div className="flex items-center gap-3 my-5" aria-hidden="true">
      <div className="flex-1 h-px bg-[var(--border)]" />
      <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-[var(--text-muted)] font-mono">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}
