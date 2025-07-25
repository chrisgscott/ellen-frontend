'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthFlow = async () => {
      const supabase = createClient();
      
      // Check for auth tokens in URL hash (magic link)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken && refreshToken) {
          try {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('Session error:', error);
              router.push('/auth/login');
              return;
            }
            
            // Clear hash and redirect to home
            window.history.replaceState(null, '', '/');
            router.push('/home');
            return;
          } catch (err) {
            console.error('Unexpected error:', err);
            router.push('/auth/login');
            return;
          }
        }
      }
      
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

