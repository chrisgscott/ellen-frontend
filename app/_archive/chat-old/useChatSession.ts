import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  ChatSession,
  ChatThread,
  Message,
  SSEPayload,
} from './types';
import { createThreads } from './threading';

const supabase = createClient();

interface UseChatSessionOptions {
  /** Existing session ID to load (if navigating via URL) */
  initialSessionId?: string;
  /** Existing project ID (to create the session under) */
  projectId?: string;
}

interface UseChatSessionReturn {
  session: ChatSession | null;
  loading: boolean;
  error: string | null;
  sendUserMessage: (content: string) => Promise<void>;
  /** Append streaming assistant tokens to UI before thread completes */
  appendAssistantToken: (token: string) => void;
}

/**
 * Centralised hook that provides a `ChatSession` with threads.
 * Handles:
 *  - Loading threads for a session from the DB
 *  - Creating a new session if none provided
 *  - Streaming assistant response via SSE
 *  - Fallback to in-memory threading if the session predates `threads` table
 */
export function useChatSession({
  initialSessionId,
  projectId,
}: UseChatSessionOptions): UseChatSessionReturn {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | undefined>();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const fetchSession = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('threads_view') // view will join threads + messages; fallback handled below
        .select('*')
        .eq('session_id', id);

      if (fetchErr) throw fetchErr;

      let threads: ChatThread[];

      if (data && data.length) {
        // denormalised rows - group by thread id
        const map = new Map<string, ChatThread>();
        data.forEach((row: Record<string, unknown>) => {
          if (!map.has(row.thread_id as string)) {
            map.set(row.thread_id as string, {
              id: row.thread_id as string,
              userMessage: row.user_message as Message,
              assistantMessage: row.assistant_message as Message | null,
              sources: (row.sources as any[]) || [],
              materials: (row.related_materials as any[]) || [],
              suggestions: (row.suggested_questions as string[]) || [],
            });
          }
        });
        threads = Array.from(map.values());
      } else {
        // No rows - legacy session; fall back to messages -> threads
        const { data: msgs, error: mErr } = await supabase
          .from('messages')
          .select('*')
          .eq('session_id', id)
          .order('created_at', { ascending: true });
        if (mErr) throw mErr;
        threads = createThreads((msgs || []) as Message[]);
      }

      setSession({ id, projectId, threads, isLoading: false });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load or create session on mount ------------------------------------------
  useEffect(() => {
    (async () => {
      if (initialSessionId) {
        await fetchSession(initialSessionId);
      } else {
        // create new session row
        const { data, error: insErr } = await supabase
          .from('sessions')
          .insert({ project_id: projectId || null, metadata: {} })
          .select('id')
          .single();
        if (insErr) {
          setError(insErr.message);
          setLoading(false);
          return;
        }
        if (data) {
          await fetchSession(data.id);
        }
      }
    })();
  }, [initialSessionId, fetchSession, projectId]);

  // Append streaming token helper -------------------------------------------
  const appendAssistantToken = useCallback(
    (token: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        const threads = [...prev.threads];
        const last = threads[threads.length - 1];
        if (last && last.assistantMessage) {
          last.assistantMessage.content = token;
        }
        return { ...prev, threads };
      });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Sending user message + SSE streaming
  // ---------------------------------------------------------------------------
  const sendUserMessage = useCallback(
    async (content: string) => {
      try {
        if (!session) {
          // Create new session row
          const { data, error: insErr } = await supabase
            .from('sessions')
            .insert({ project_id: projectId || null, metadata: {} })
            .select('id')
            .single();
          if (insErr) {
            setError(insErr.message);
            setLoading(false);
            return;
          }
          if (!data) {
            throw new Error('Failed to create session');
          }
          
          const newSessionId = data.id;
          const newSession: ChatSession = {
            id: newSessionId,
            projectId,
            threads: [],
            isLoading: true
          };
          
          // Initialize session with empty threads
          setSession(newSession);

          // Create a temp thread for immediate UI feedback
          const tempThread: ChatThread = {
            id: `temp-${Date.now()}`,
            userMessage: {
              role: 'user',
              content,
            },
            assistantMessage: { role: 'assistant', content: '' },
            sources: [],
            materials: [],
            suggestions: [],
          };

          // Update session with the temp thread
          setSession({
            ...newSession,
            threads: [tempThread],
          });

          // Make API call with the new session ID
          const controller = new AbortController();
          abortRef.current = controller;

          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: newSessionId,
              project_id: projectId,
              message: content,
            }),
            signal: controller.signal,
          });

          if (!res.ok || !res.body) throw new Error('Stream error');

          // Process the streaming response
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let currentAssistant = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });

            // Expect Server-Sent Events as JSON lines
            chunk
              .trim()
              .split('\n')
              .filter(Boolean)
              .forEach((line) => {
                try {
                  const payload: SSEPayload = JSON.parse(line);
                  if (payload.type === 'token') {
                    currentAssistant += payload.content as string;
                    appendAssistantToken(currentAssistant);
                  }
                } catch (err) {
                  console.error('Error parsing SSE line:', err);
                }
              });
          }

          // Refresh session from DB once complete
          await fetchSession(newSessionId);
          return;
        }

        // We have a session, proceed with sending the message
        // Optimistic local thread with loader
        const tempThread: ChatThread = {
          id: `temp-${Date.now()}`,
          userMessage: {
            role: 'user',
            content,
          },
          assistantMessage: { role: 'assistant', content: '' },
          sources: [],
          materials: [],
          suggestions: [],
        };

        setSession((prev) =>
          prev
            ? { ...prev, threads: [...prev.threads, tempThread] }
            : prev,
        );

        // POST to chat API to trigger OpenAI call (SSE streaming)
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            project_id: projectId,
            message: content,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error('Stream error');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let currentAssistant = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // Expect Server-Sent Events as JSON lines
          chunk
            .trim()
            .split('\n')
            .filter(Boolean)
            .forEach((line) => {
              try {
                const payload: SSEPayload = JSON.parse(line);
                if (payload.type === 'token') {
                  currentAssistant += payload.content as string;
                  appendAssistantToken(currentAssistant);
                } else if (payload.type === 'materials') {
                  // TODO: merge materials
                } else if (payload.type === 'sources') {
                  // TODO: merge sources
                } else if (payload.type === 'suggestions') {
                  // TODO: merge suggestions
                }
              } catch (err) {
                console.error('Error parsing SSE line:', err);
              }
            });
        }

        // Refresh session threads from DB once complete
        await fetchSession(session.id);
      } catch (err) {
        console.error('Error sending message:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [session, projectId, fetchSession, appendAssistantToken],
  );
    }),
    signal: controller.signal,
  });
  
  if (!res.ok || !res.body) throw new Error('Stream error');
  
  // Process the streaming response
  await processStreamResponse(res, content);
  
  // Refresh session from DB once complete
  await fetchSession(newSessionId);
  return;
}
// Optimistic local thread with loader
const tempThread: ChatThread = {
  id: `temp-${Date.now()}`,
  userMessage: {
    role: 'user',
    content,
  },
  assistantMessage: { role: 'assistant', content: '' },
  sources: [],
  materials: [],
  suggestions: [],
};
setSession((prev) =>
  prev
    ? { ...prev, threads: [...prev.threads, tempThread] }
    : prev,
);

// POST to chat API to trigger OpenAI call (SSE streaming)
abortRef.current?.abort();
const controller = new AbortController();
abortRef.current = controller;

const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: session.id,
    project_id: projectId,
    message: content,
  }),
  signal: controller.signal,
});

if (!res.ok || !res.body) throw new Error('Stream error');

// Helper function to process streaming response
const processStreamResponse = async (res: Response, content: string) => {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let currentAssistant = '';
  
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    
    // Expect Server-Sent Events as JSON lines
    chunk
      .trim()
      .split('\n')
      .filter(Boolean)
      .forEach((line) => {
        try {
          const payload: SSEPayload = JSON.parse(line);
          if (payload.type === 'token') {
            currentAssistant += payload.content as string;
            appendAssistantToken(currentAssistant);
          }
        } catch (err) {
          console.error('Error parsing SSE line:', err);
        if (!prev) return prev;
        const threads = [...prev.threads];
        const last = threads[threads.length - 1];
        if (last && last.assistantMessage) {
          last.assistantMessage.content = token;
        }
        return { ...prev, threads };
      });
    },
    [],
  );

  return { session, loading, error, sendUserMessage, appendAssistantToken };
}
