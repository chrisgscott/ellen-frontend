'use client';

import { useState, useEffect } from 'react';
import { Search, Newspaper, FlaskConical, Folders } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { createNewSession } from './chat/hooks/useSessionManagement';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [firstName, setFirstName] = useState<string | null>(null);
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  console.log('🏠 HOME PAGE: Component rendered with query:', query);

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile?.full_name) {
          setFirstName(profile.full_name.split(' ')[0]);
        }
      }
    };
    fetchProfile();
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🏠 HOME PAGE: Form submitted with query:', query.trim());
    
    if (query.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        // Create a new session with a descriptive title and store the initial query
        const sessionTitle = `Chat about: ${query.trim().substring(0, 50)}${query.trim().length > 50 ? '...' : ''}`;
        console.log('🏠 HOME PAGE: Creating session with title:', sessionTitle);
        console.log('🏠 HOME PAGE: Storing initial query in session metadata');
        
        const session = await createNewSession(sessionTitle, null, query.trim());
        console.log('🏠 HOME PAGE: Session created with initial query:', session);
        
        // Redirect to the chat page with only the session ID
        const chatUrl = `/home/chat?session=${session.id}`;
        console.log('🏠 HOME PAGE: Redirecting to:', chatUrl);
        
        router.push(chatUrl);
      } catch (error) {
        console.error('🏠 HOME PAGE: Error creating session:', error);
        // Show an error message instead of falling back to the old behavior
        alert('Failed to create a chat session. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <div className="absolute top-4 right-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">Back to Original Dashboard</Button>
        </Link>
      </div>
      {/* Logo and Title */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-3">Hello, {firstName || 'there'}.</h1>
        <p className="text-lg text-gray-500">I&apos;m ELLEN, your critical materials AI analyst. How can I help you today?</p>
      </div>

      {/* Search Form */}
      <div className="w-full max-w-2xl">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <Input
              type="text"
              placeholder="Ask anything or @mention a Space"
              className="pl-10 pr-16 py-6 text-base rounded-full border border-input bg-background"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <Button 
                type="submit" 
                size="sm" 
                className="h-8 rounded-full"
                disabled={!query.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Navigation Cards */}
      <div className="mt-12 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/home/news">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader>
              <Newspaper className="h-6 w-6 mb-2 text-primary" />
              <CardTitle>Recent News</CardTitle>
              <CardDescription>Catch up on the latest market-moving updates.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/home/research">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader>
              <FlaskConical className="h-6 w-6 mb-2 text-primary" />
              <CardTitle>Research Materials</CardTitle>
              <CardDescription>Explore intelligence reports on critical materials.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/home/spaces">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader>
              <Folders className="h-6 w-6 mb-2 text-primary" />
              <CardTitle>Your Spaces</CardTitle>
              <CardDescription>Access your saved research and collections.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
