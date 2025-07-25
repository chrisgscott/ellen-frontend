"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Check for auth tokens or errors in URL hash
  useEffect(() => {
    const handleAuthFlow = async () => {
      const hash = window.location.hash;
      if (!hash) return;
      
      const params = new URLSearchParams(hash.substring(1));
      
      // Handle auth tokens (successful magic link)
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      
      if (accessToken && refreshToken) {
        console.log('Processing magic link tokens...');
        const supabase = createClient();
        
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Session error:', error);
            setError(`Authentication error: ${error.message}`);
          } else {
            console.log('Magic link authentication successful');
            // Redirect to home
            window.location.href = '/home';
            return;
          }
        } catch (err) {
          console.error('Unexpected error:', err);
          setError('An unexpected error occurred during authentication');
        }
      }
      
      // Handle auth errors
      else if (hash.includes('error=')) {
        const errorCode = params.get('error_code');
        const errorDesc = params.get('error_description');
        
        if (errorCode === 'otp_expired') {
          setError('Magic link has expired. Please request a new one.');
        } else {
          setError(errorDesc || 'Authentication error occurred.');
        }
      }
      
      // Clear the hash from URL after processing
      window.history.replaceState(null, '', window.location.pathname);
    };
    
    handleAuthFlow();
  }, []);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    const supabase = createClient();

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email for the magic link!");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Welcome to Ellen</CardTitle>
        <CardDescription>
          Enter your email to receive a magic link for secure, passwordless login.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          
          {message && (
            <div className="text-green-500 text-sm">{message}</div>
          )}
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Magic Link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
