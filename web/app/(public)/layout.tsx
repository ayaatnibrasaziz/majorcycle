import { AuthHero } from '@/components/AuthHero';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] bg-[var(--bg-page)]">
      <AuthHero />
      <div className="flex items-center justify-center px-6 py-12 lg:px-16 lg:py-12 bg-[var(--bg-surface)] lg:bg-[var(--bg-page)]">
        <div className="w-full max-w-[400px]">
          {children}
        </div>
      </div>
    </div>
  );
}
