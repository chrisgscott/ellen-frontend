'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSession } from './hooks/useSession';
import { clearInitialQuery } from './hooks/useSessionManagement';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session') || searchParams.get('session_id'); // Support both formats
  const projectId = searchParams.get('project_id');
  
  console.log('💬 CHAT PAGE: Component rendered with params:', {
    sessionId,
    projectId,
    searchParams: Object.fromEntries(searchParams.entries())
  });
  
  const [newQuery, setNewQuery] = useState('');
  
  const {
    session,
    isLoading,
    error,
    sendMessage
  } = useSession(sessionId || undefined, projectId || undefined);
  
  // Get initial query from session metadata
  const initialQuery = session?.metadata?.initial_query as string | undefined;
  
  // Handle initial query from session metadata
  const handleInitialQuery = useCallback(async () => {
    console.log('💬 CHAT PAGE: handleInitialQuery called with:', initialQuery);
    if (!initialQuery || !sessionId) {
      console.log('💬 CHAT PAGE: No initial query in session metadata or no session ID, returning');
      return;
    }
    console.log('💬 CHAT PAGE: Sending initial message from session metadata:', initialQuery);
    try {
      await sendMessage(initialQuery);
      // Clear the initial query from session metadata to prevent re-sending on refresh
      console.log('💬 CHAT PAGE: Clearing initial query from session metadata');
      await clearInitialQuery(sessionId);
    } catch (error) {
      console.error('💬 CHAT PAGE: Error sending initial message or clearing metadata:', error);
    }
  }, [initialQuery, sendMessage, sessionId]);
  
  useEffect(() => {
    console.log('💬 CHAT PAGE: useEffect for initial query triggered:', {
      initialQuery,
      sessionId,
      hasSession: !!session,
      threadsCount: session?.threads?.length || 0,
      sessionMetadata: session?.metadata
    });
    
    // Send the initial query if we have one from session metadata and no threads yet
    if (initialQuery && session && (!session.threads || session.threads.length === 0)) {
      console.log('💬 CHAT PAGE: Conditions met, calling handleInitialQuery');
      handleInitialQuery();
      
      // Clear the initial query from session metadata after using it to prevent re-sending on refresh
      // We'll do this after the message is sent successfully
    } else {
      console.log('💬 CHAT PAGE: Conditions not met for initial query:', {
        hasInitialQuery: !!initialQuery,
        hasSessionId: !!sessionId,
        hasSession: !!session,
        hasThreads: !!(session?.threads?.length),
        sessionMetadata: session?.metadata
      });
    }
  }, [initialQuery, sessionId, handleInitialQuery, session]);
  
  // Update URL with session ID
  useEffect(() => {
    if (session?.id && !sessionId) {
      const url = new URL(window.location.href);
      url.searchParams.delete('q');
      url.searchParams.set('session', session.id); // Use 'session' as the parameter name
      if (projectId) url.searchParams.set('project_id', projectId);
      router.replace(url.pathname + url.search);
    }
  }, [session?.id, sessionId, projectId, router]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('💬 CHAT PAGE: Form submitted with newQuery:', newQuery.trim());
    
    if (!newQuery.trim() || isLoading) {
      console.log('💬 CHAT PAGE: Form submission blocked:', { isEmpty: !newQuery.trim(), isLoading });
      return;
    }
    
    console.log('💬 CHAT PAGE: Sending new message:', newQuery);
    await sendMessage(newQuery);
    setNewQuery('');
  };
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-2xl w-full">
          <h2 className="text-red-800 text-lg font-semibold">Error</h2>
          <p className="text-red-700">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
  
  if (isLoading && !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto mb-4 space-y-6">
        {session?.threads && session.threads.length > 0 ? (
          session.threads.map((thread, index) => (
            <div key={thread.thread_id || `thread-${index}`} className="mb-8 space-y-4">
              {/* User message */}
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white mr-2">
                  U
                </div>
                <div className="flex-1 bg-blue-50 p-3 rounded-lg">
                  <p className="whitespace-pre-wrap">{thread.user_message?.content}</p>
                </div>
              </div>
              
              {/* Assistant message */}
              {thread.assistant_message && (
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white mr-2">
                    A
                  </div>
                  <div className="flex-1 bg-green-50 p-3 rounded-lg">
                    <p className="whitespace-pre-wrap">{thread.assistant_message.content}</p>
                  </div>
                </div>
              )}
              
              {/* Sources */}
              {thread.sources && thread.sources.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-semibold">Sources:</h4>
                  <ul className="list-disc pl-5">
                    {thread.sources.map((source, index) => (
                      <li key={index}>
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {source.title || source.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Materials */}
              {thread.related_materials && thread.related_materials.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-semibold">Related Materials:</h4>
                  <ul className="list-disc pl-5">
                    {thread.related_materials.map((material, index) => (
                      <li key={index}>
                        <span 
                          className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full"
                        >
                          {material.material}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Suggested Questions */}
              {thread.suggested_questions && thread.suggested_questions.length > 0 && (
                <div className="ml-10 mt-2">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Suggested Follow-up Questions:</h4>
                  <div className="flex flex-wrap gap-2">
                    {thread.suggested_questions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setNewQuery(question);
                          // Focus the input
                          document.getElementById('chat-input')?.focus();
                        }}
                        className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-lg transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <h2 className="text-xl font-semibold mb-2">Welcome to Ellen Materials Chat</h2>
            <p>Ask a question about materials science and engineering</p>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="flex items-center">
        <input
          id="chat-input"
          type="text"
          value={newQuery}
          onChange={(e) => setNewQuery(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 border border-gray-300 rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-lg disabled:bg-blue-300"
          disabled={isLoading || !newQuery.trim()}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
