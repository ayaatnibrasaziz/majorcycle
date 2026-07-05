import type { Metadata } from 'next';
import { AuthCard } from '@/components/AuthCard';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the MajorCycle team.',
};

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
