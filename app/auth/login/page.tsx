import { OTPForm } from '@/components/otp-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ellen | AI Critical Materials Analyst',
  description: 'AI-powered critical materials analysis and insights.',
};

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <OTPForm />
      </div>
    </div>
  );
}
