import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  ChatSession,
  ChatThread,
  Message,
  Project,
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
  const abortRef = useRef<AbortController>();

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

      if (data.length) {
        // denormalised rows – group by thread id
        const map = new Map<string, ChatThread>();
        data.forEach((row: any) => {
          if (!map.has(row.thread_id)) {
            map.set(row.thread_id, {
              id: row.thread_id,
              userMessage: row.user_message as Message,
              assistantMessage: row.assistant_message as Message | null,
              sources: row.sources || [],
              materials: row.related_materials || [],
              suggestions: row.suggested_questions || [],
            });
          }
        });
        threads = Array.from(map.values());
      } else {
        // No rows ⇒ legacy session; fall back to messages -> threads
        const { data: msgs, error: mErr } = await supabase
          .from('messages')
          .select('*')
          .eq('session_id', id)
          .order('created_at', { ascending: true });
        if (mErr) throw mErr;
        threads = createThreads(msgs as Message[]);
      }

      setSession({ id, projectId, threads, isLoading: false });
    } catch (e: any) {
      setError(e.message);
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
        await fetchSession(data.id);
      }
    })();
  }, [initialSessionId, fetchSession, projectId]);

  // ---------------------------------------------------------------------------
  // Sending user message + SSE streaming
  // ---------------------------------------------------------------------------
  const sendUserMessage = useCallback(
    async (content: string) => {
      if (!session) return;
      try {
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
            });
        }

        // Refresh session threads from DB once complete
        await fetchSession(session.id);
      } catch (e: any) {
        setError(e.message);
      }
    },
    [session, projectId, fetchSession],
  );

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

  return { session, loading, error, sendUserMessage, appendAssistantToken };
}
