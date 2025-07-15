import { useState, useCallback, useEffect, useRef } from 'react';
import { Session, Source, Material } from '../types';
import { fetchSession as fetchSessionData, createNewSession } from './useSessionManagement';
import { processStreamingResponse, createOptimisticThread } from './useMessageStreaming';

interface UseSessionReturn {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  createSession: (initialMessage?: string) => Promise<Session>;
}

/**
 * Hook for managing chat sessions
 * Handles:
 * - Loading an existing session
 * - Creating a new session
 * - Sending messages and streaming responses
 */
export function useSession(
  initialSessionId?: string,
  projectId?: string
): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!initialSessionId);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  // Use refs to break circular dependencies
  const sendMessageRef = useRef<(content: string, sessionIdOverride?: string) => Promise<void>>(async () => {
    throw new Error('sendMessage not initialized');
  });

  // Load session data from database
  const fetchSession = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const sessionData = await fetchSessionData(id);
      setSession(sessionData);
    } catch (err) {
      console.error('Error fetching session:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(async (initialMessage?: string): Promise<Session> => {
    try {
      setIsLoading(true);
      
      // Create session in database
      const title = initialMessage ? initialMessage.substring(0, 50) : 'New Chat';
      const newSession = await createNewSession(title, projectId);
      
      setSession(newSession);
      
      // If there's an initial message, send it
      if (initialMessage && sendMessageRef.current) {
        await sendMessageRef.current(initialMessage, newSession.id);
      }
      
      return newSession;
    } catch (err) {
      console.error('Error creating session:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, sendMessageRef]);

  // Append streaming tokens to the last thread
  const appendAssistantToken = useCallback((token: string) => {
    setSession(prev => {
      if (!prev) return prev;
      
      const threads = [...prev.threads];
      const lastThread = threads[threads.length - 1];
      
      if (lastThread && lastThread.assistant_message) {
        lastThread.assistant_message = {
          ...lastThread.assistant_message,
          content: token
        };
      }
      
      return { ...prev, threads };
    });
  }, []);

  // Update sources in the last thread
  const updateSources = useCallback((sources: Source[]) => {
    setSession(prev => {
      if (!prev) return prev;
      const threads = [...prev.threads];
      const lastThread = threads[threads.length - 1];
      
      if (lastThread) {
        lastThread.sources = sources;
      }
      
      return { ...prev, threads };
    });
  }, []);

  // Update materials in the last thread
  const updateMaterials = useCallback((materials: Material[]) => {
    setSession(prev => {
      if (!prev) return prev;
      const threads = [...prev.threads];
      const lastThread = threads[threads.length - 1];
      
      if (lastThread) {
        lastThread.related_materials = materials;
      }
      
      return { ...prev, threads };
    });
  }, []);

  // Update suggested questions in the last thread
  const updateSuggestions = useCallback((suggestions: string[]) => {
    setSession(prev => {
      if (!prev) return prev;
      const threads = [...prev.threads];
      const lastThread = threads[threads.length - 1];
      
      if (lastThread) {
        lastThread.suggested_questions = suggestions;
      }
      
      return { ...prev, threads };
    });
  }, []);

  // Send a message and stream the response
  const sendMessage = useCallback(async (content: string, sessionIdOverride?: string) => {
    try {
      // Abort any ongoing requests
      if (abortController) {
        abortController.abort();
      }
      
      const newController = new AbortController();
      setAbortController(newController);
      
      const currentSessionId = sessionIdOverride || session?.id;
      
      // If no session exists, create one
      if (!currentSessionId) {
        await createSession(content);
        return;
      }
      
      // Create optimistic thread for immediate UI feedback
      const tempThread = createOptimisticThread(currentSessionId, content);
      
      // Update UI with optimistic thread
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          threads: [...prev.threads, tempThread],
          is_loading: true
        };
      });
      
      // Send message to API
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          project_id: projectId,
          message: content
        }),
        signal: newController.signal
      });
      
      if (!res.ok || !res.body) {
        throw new Error(`Stream error: ${res.status} ${res.statusText}`);
      }
      
      // Process streaming response
      const reader = res.body.getReader();
      await processStreamingResponse(
        reader,
        appendAssistantToken,
        updateSources,
        updateMaterials,
        updateSuggestions,
        (err) => setError(err.message)
      );
      
      // Refresh session from database to get the real thread ID
      await fetchSession(currentSessionId);
      
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Error sending message:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setAbortController(null);
      setSession(prev => prev ? { ...prev, is_loading: false } : null);
    }
  }, [session, projectId, abortController, createSession, fetchSession, appendAssistantToken, updateSources, updateMaterials, updateSuggestions]);
  
  // Store the sendMessage function in the ref to break circular dependency
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // Load session on mount if initialSessionId is provided
  useEffect(() => {
    if (initialSessionId) {
      fetchSession(initialSessionId);
    }
  }, [initialSessionId, fetchSession]);

  return {
    session,
    isLoading,
    error,
    sendMessage,
    createSession
  };
}
