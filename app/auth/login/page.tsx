'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from "@/components/login-form";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    // Check if this is an invite callback (has type=invite in hash)
    const hash = window.location.hash;
    if (hash.includes('type=invite')) {
      // This is an invite callback, redirect to password setup with the hash
      router.push(`/auth/set-password${hash}`);
    }
  }, [router]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
