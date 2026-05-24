import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Results',
};

export default function ResultsPage() {
  return (
    <div className="text-[var(--text-secondary)] text-sm">
      Results tab — coming in Layer C.
    </div>
  );
}
