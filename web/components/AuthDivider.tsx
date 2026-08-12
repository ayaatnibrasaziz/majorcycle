interface AuthDividerProps {
  label?: string;
}

export function AuthDivider({ label = 'or continue with' }: AuthDividerProps) {
  return (
    <div className="flex items-center gap-3 my-5" aria-hidden="true">
      <div className="flex-1 h-px bg-[var(--border)]" />
      {/* --text-secondary: muted is 2.97:1 here, and "or continue with" is the
          only thing telling a reader the Google button is an alternative to the
          form above rather than an extra step. */}
      <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-[var(--text-secondary)] font-mono">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}
