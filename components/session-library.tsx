'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';

interface Session {
  id: string;
  title: string;
  updated_at: string;
}

export function SessionLibrary() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const response = await fetch('/api/sessions');
        if (!response.ok) {
          throw new Error('Failed to fetch sessions');
        }
        const data = await response.json();
        setSessions(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchSessions();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="flex h-full flex-col p-2">
      <h4 className="mb-2 px-2 text-lg font-semibold tracking-tight">Library</h4>
      <div className="flex-1 overflow-y-auto">
        {sessions.length > 0 ? (
          <ul className="space-y-1">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/home/chat?session=${session.id}`}
                  className="flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <MessageSquare className="mr-2 size-4 flex-shrink-0" />
                  <span className="truncate">{session.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 text-sm text-muted-foreground">No past sessions found.</p>
        )}
      </div>
    </div>
  );
}
