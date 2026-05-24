import { AuthHero } from '@/components/AuthHero';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] bg-[var(--bg-page)]">
      <AuthHero />
      <div className="flex items-center justify-center px-6 py-12 lg:px-12 lg:py-10 bg-[var(--bg-surface)] lg:bg-transparent">
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
