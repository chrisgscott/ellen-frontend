'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ChatSession {
  id: string;
  initial_message_content: string;
}

interface ChatHistorySidebarProps {
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export function ChatHistorySidebar({ onSelectSession, onNewChat }: ChatHistorySidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch('http://localhost:8000/sessions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    };

    fetchSessions();
  }, []);

  return (
    <aside className="w-64 bg-muted/40 p-4 border-r flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Chat History</h2>
        <button onClick={onNewChat} className="text-sm font-semibold hover:underline">New</button>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className="p-2 rounded-md hover:bg-muted cursor-pointer truncate"
            title={session.initial_message_content}
          >
            {session.initial_message_content || 'New Chat'}
          </div>
        ))}
      </div>
    </aside>
  );
}
