'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { createNewSession } from './chat/hooks/useSessionManagement';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        // Create a new session with a descriptive title
        const sessionTitle = `Chat about: ${query.trim().substring(0, 50)}${query.trim().length > 50 ? '...' : ''}`;
        const session = await createNewSession(sessionTitle);
        // Redirect to the chat page with only the session ID
        router.push(`/home/chat?session=${session.id}`);
      } catch (error) {
        console.error('Error creating session:', error);
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
        <h1 className="text-4xl font-medium text-foreground mb-2">Ask ELLEN...</h1>
        <p className="text-muted-foreground">Your materials intelligence assistant</p>
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
    </div>
  );
}
