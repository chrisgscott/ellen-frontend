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

  // Check for auth errors in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorCode = params.get('error_code');
      const errorDesc = params.get('error_description');
      
      if (errorCode === 'otp_expired') {
        setError('Magic link has expired. Please request a new one.');
      } else {
        setError(errorDesc || 'Authentication error occurred.');
      }
      
      // Clear the error from URL
      window.history.replaceState(null, '', window.location.pathname);
    }
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
        // No emailRedirectTo needed - magic links go to Site URL with tokens in hash
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
