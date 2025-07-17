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
    console.log('💬 useSession: sendMessage called with:', {
      content,
      sessionIdOverride,
      currentSessionId: sessionIdOverride || session?.id,
      hasSession: !!session
    });
    
    try {
      // Abort any ongoing requests
      if (abortController) {
        console.log('💬 useSession: Aborting previous request');
        abortController.abort();
      }
      
      const newController = new AbortController();
      setAbortController(newController);
      
      const currentSessionId = sessionIdOverride || session?.id;
      console.log('💬 useSession: Using session ID:', currentSessionId);
      
      // If no session exists, create one
      if (!currentSessionId) {
        console.log('💬 useSession: No session ID, creating new session');
        await createSession(content);
        return;
      }
      
      // Create optimistic thread for immediate UI feedback
      console.log('💬 useSession: Creating optimistic thread');
      const tempThread = createOptimisticThread(currentSessionId, content);
      
      // Update UI with optimistic thread
      setSession(prev => {
        if (!prev) return prev;
        console.log('💬 useSession: Adding optimistic thread to session');
        return {
          ...prev,
          threads: [...prev.threads, tempThread],
          is_loading: true
        };
      });
      
      // Send message to API
      const apiPayload = {
        session_id: currentSessionId,
        project_id: projectId,
        message: content
      };
      console.log('💬 useSession: Sending API request with payload:', apiPayload);
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
        signal: newController.signal
      });
      
      console.log('💬 useSession: API response status:', res.status);
      
      if (!res.ok || !res.body) {
        if (res.status === 429) {
          // Gracefully handle "Too Many Requests" without crashing
          const errorText = await res.text();
          console.warn('🚫 useSession: Received 429 status. Server is busy or request is a duplicate.');
          setError(errorText || 'Server is busy, please try again in a moment.');
          // Remove the optimistic thread since the request failed
          setSession(prev => {
            if (!prev) return prev;
            return { ...prev, threads: prev.threads.slice(0, -1) };
          });
          return; // Stop further processing
        }
        throw new Error(`Stream error: ${res.status} ${res.statusText}`);
      }
      
      // Process streaming response
      console.log('💬 useSession: Starting to process streaming response');
      const reader = res.body.getReader();
      await processStreamingResponse(
        reader,
        appendAssistantToken,
        updateSources,
        updateMaterials,
        updateSuggestions,
        (err) => setError(err.message)
      );
      
      console.log('💬 useSession: Streaming complete, refreshing session');
      // Refresh session from database to get the real thread ID
      await fetchSession(currentSessionId);
      
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('💬 useSession: Request was aborted');
      } else {
        console.error('💬 useSession: Error sending message:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      console.log('💬 useSession: sendMessage completed');
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
