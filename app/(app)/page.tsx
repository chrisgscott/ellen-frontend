'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthFlow = async () => {
      const supabase = createClient();
      
      // Check if user is already authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/home');
      } else {
        router.push('/auth/login');
      }
    };
    
    handleAuthFlow();
  }, [router]);

  return (
    <div className="min-h-screen bg-white">
      {/* Blank white page - auth processing happens in background */}
    </div>
  );
}

