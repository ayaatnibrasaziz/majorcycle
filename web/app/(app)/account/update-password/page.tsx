import type { Metadata } from 'next';
import { UpdatePasswordForm } from './UpdatePasswordForm';

export const metadata: Metadata = { title: 'Set a New Password' };

export default function UpdatePasswordPage() {
  return (
    <div className="mx-auto w-full max-w-[440px]">
      <UpdatePasswordForm />
    </div>
  );
}
