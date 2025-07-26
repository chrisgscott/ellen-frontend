'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, KeyRound } from 'lucide-react';

export function OTPForm() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createClient();
      
      // Check if user exists and was invited
      const { data: { user } } = await supabase.auth.getUser();
      let shouldCreateUser = true;
      
      // For invited users, we need to use shouldCreateUser: true but handle the signup disabled error
      // This is because invited users exist but aren't fully confirmed yet
      if (!user) {
        shouldCreateUser = true;
      }
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser,
        },
      });



      if (error) {
        if (error.message.includes('Signups not allowed') || error.message.includes('signup is disabled')) {
          setError('If you were invited, please click the confirmation link in your invite email first, then return here to sign in.');
        } else {
          setError(`Authentication error: ${error.message}`);
        }
      } else {
        setSuccess('Check your email for a 6-digit verification code.');
        setStep('otp');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) {
        setError(error.message);
      } else {
        // Successful authentication - redirect to home
        window.location.href = '/home';
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setOtp('');
    setError(null);
    setSuccess(null);
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        if (error.message.includes('Signups not allowed') || error.message.includes('signup is disabled')) {
          setError('If you were invited, please click the confirmation link in your invite email first, then return here to sign in.');
        } else {
          setError(`Authentication error: ${error.message}`);
        }
      } else {
        setSuccess('New verification code sent to your email.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          {step === 'email' ? (
            <>
              <Mail className="h-5 w-5" />
              Sign in to Ellen
            </>
          ) : (
            <>
              <KeyRound className="h-5 w-5" />
              Enter verification code
            </>
          )}
        </CardTitle>
        <CardDescription>
          {step === 'email' 
            ? 'Enter your email address to receive a verification code'
            : `We sent a 6-digit code to ${email}`
          }
        </CardDescription>
      </CardHeader>

      {step === 'email' ? (
        <form onSubmit={handleSendOTP}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending code...
                </>
              ) : (
                'Send verification code'
              )}
            </Button>
          </CardFooter>
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                disabled={loading}
                className="text-center text-lg tracking-widest"
                maxLength={6}
              />
              <p className="text-sm text-muted-foreground text-center">
                Enter the 6-digit code from your email
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
            <div className="flex justify-between w-full text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBackToEmail}
                disabled={loading}
              >
                ← Change email
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResendOTP}
                disabled={loading}
              >
                Resend code
              </Button>
            </div>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
