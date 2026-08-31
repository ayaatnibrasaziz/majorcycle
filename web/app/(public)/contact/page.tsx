import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { AuthCard } from '@/components/AuthCard';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = pageMetadata({
  path: '/contact',
  title: 'Contact',
  description: 'Ask a question about MajorCycle, report a problem with the data, or tell us what would make the analysis more useful to you.',
});

export default function ContactPage() {
  return (
    <AuthCard
      title="Contact us"
      subtitle="Questions, feedback, or an issue to report? Send us a message and we'll reply by email."
    >
      <ContactForm />
    </AuthCard>
  );
}
