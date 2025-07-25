'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export default function AccountPage() {
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, email, phone')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('Error fetching profile:', error);
          toast({ title: 'Error', description: 'Could not fetch your profile.', variant: 'destructive' });
        } else if (profile) {
          setFullName(profile.full_name || '');
          setEmail(profile.email || '');
          setPhone(formatPhoneNumber(profile.phone || ''));
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, [supabase, toast]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    const rawPhone = phone.replace(/[^\d]/g, '');
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      phone: rawPhone,
    }).eq('id', userId);

    if (error) {
      toast({ title: 'Error', description: 'Could not update your profile.', variant: 'destructive' });
    } else {
      toast({ title: 'Success!', description: 'Your profile has been updated.' });
    }
    setLoading(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (newPassword !== confirmPassword) {
      toast({ 
        title: 'Error', 
        description: 'New passwords do not match.', 
        variant: 'destructive' 
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({ 
        title: 'Error', 
        description: 'Password must be at least 6 characters long.', 
        variant: 'destructive' 
      });
      return;
    }

    setPasswordLoading(true);
    
    try {
      // Update password with Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast({ 
          title: 'Error', 
          description: error.message || 'Could not update password.', 
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Success!', 
          description: 'Your password has been updated.' 
        });
        
        // Clear form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    }
    
    setPasswordLoading(false);
  };

  return (
    <div className="flex justify-center items-start pt-16 h-full">
      <div className="w-full max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>View and edit your personal information.</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateProfile}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input 
                id="fullName" 
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Your name"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input 
                id="phone" 
                type="tel" 
                value={phone} 
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setPhone(formatted);
                }} 
                placeholder="(555) 123-4567"
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password for security.</CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordChange}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input 
                id="currentPassword" 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                disabled={passwordLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input 
                id="newPassword" 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                disabled={passwordLoading}
                required
                minLength={6}
              />
              <p className="text-sm text-muted-foreground">Password must be at least 6 characters long.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                disabled={passwordLoading}
                required
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button 
              type="submit" 
              disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              variant="outline"
            >
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </CardFooter>
        </form>
      </Card>
      </div>
    </div>
  );
}
