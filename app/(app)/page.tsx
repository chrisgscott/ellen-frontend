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
      console.log('Root page auth flow:', {
        hasHash: !!hash,
        hash: hash?.substring(0, 50) + '...',
        hasAccessToken: hash?.includes('access_token'),
        url: window.location.href
      });
      
      if (hash && hash.includes('access_token')) {
        console.log('Processing magic link tokens at root...');
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        console.log('Token extraction:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accessTokenLength: accessToken?.length,
          refreshTokenLength: refreshToken?.length
        });
        
        if (accessToken && refreshToken) {
          try {
            console.log('Calling setSession...');
            const { error, data } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            console.log('SetSession result:', {
              error: error?.message,
              hasUser: !!data.user,
              userEmail: data.user?.email
            });
            
            if (error) {
              console.error('Session error:', error);
              router.push('/auth/login');
              return;
            }
            
            console.log('Magic link authentication successful, redirecting to /home');
            // Clear hash and redirect to home
            window.history.replaceState(null, '', '/');
            router.push('/home');
            return;
          } catch (err) {
            console.error('Unexpected error:', err);
            router.push('/auth/login');
            return;
          }
        } else {
          console.log('Missing access or refresh token');
        }
      }
      
      // Check if user is already authenticated
      console.log('Checking existing auth...');
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('Existing auth check:', {
        hasUser: !!user,
        userEmail: user?.email,
        error: error?.message
      });
      
      if (user) {
        console.log('User already authenticated, redirecting to /home');
        router.push('/home');
      } else {
        console.log('No user found, redirecting to /auth/login');
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

