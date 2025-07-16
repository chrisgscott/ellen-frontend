'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSession } from './hooks/useSession';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q'); // Get query parameter
  const sessionId = searchParams.get('session') || searchParams.get('session_id'); // Support both formats
  const projectId = searchParams.get('project_id');
  
  const [newQuery, setNewQuery] = useState('');
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  
  const {
    session,
    isLoading,
    error,
    sendMessage
  } = useSession(sessionId || undefined, projectId || undefined);
  
  // Track if initial query has been sent to prevent multiple sends
  const initialQuerySentRef = useRef(false);
  
  // Handle the initial query from URL parameter or session title
  useEffect(() => {
    // Skip if we've already sent a query
    if (initialQuerySentRef.current) return;
    
    // If we have a session ID but no session yet, show processing state
    if (sessionId && !session) {
      setIsProcessingQuery(true);
      return; // Wait for session to load
    }
    
    // If we have a session with threads already, we're done
    if (session?.threads && session.threads.length > 0) {
      console.log('Session already has threads, no need to submit query');
      initialQuerySentRef.current = true;
      setIsProcessingQuery(false);
      return;
    }
    
    // Case 1: Use query parameter if available
    if (initialQuery && sessionId && session) {
      console.log('Submitting query from URL parameter:', initialQuery);
      initialQuerySentRef.current = true;
      sendMessage(initialQuery);
      return;
    }
    
    // Case 2: Extract query from session title if we have a session with no threads yet
    if (sessionId && session && (!session.threads || session.threads.length === 0)) {
      if (session.title && session.title.startsWith('Chat about: ')) {
        const extractedQuery = session.title.replace('Chat about: ', '');
        if (extractedQuery) {
          console.log('Submitting query from session title:', extractedQuery);
          initialQuerySentRef.current = true;
          sendMessage(extractedQuery);
        }
      }
    }
  }, [initialQuery, sessionId, session, sendMessage]);
  
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
    if (!newQuery.trim() || isLoading) return;
    
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
  
  // Show loading state when loading session or processing query
  if (isLoading || isProcessingQuery) {
    // Extract query from session title if available
    const queryFromTitle = session?.title && session.title.startsWith('Chat about: ') 
      ? session.title.replace('Chat about: ', '') 
      : '';
      
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
          {queryFromTitle && (
            <div className="mt-6 text-gray-700 text-center max-w-xl">
              <div className="font-medium mb-2">Processing query:</div>
              <div className="p-3 bg-gray-100 rounded-lg">
                &ldquo;{queryFromTitle.substring(0, 100)}{queryFromTitle.length > 100 ? '...' : ''}&rdquo;
              </div>
              <div className="mt-2 text-sm text-gray-500">Please wait while ELLEN processes your question...</div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto mb-4 space-y-6">
        {session?.threads && session.threads.length > 0 ? (
          session.threads.map((thread, index) => (
            <div key={thread.thread_id || `thread-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`} className="mb-8 space-y-4">
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
                    {thread.sources.map((source, sourceIndex) => (
                      <li key={`source-${thread.thread_id || index}-${sourceIndex}`}>
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
                    {thread.related_materials.map((material, materialIndex) => (
                      <li key={`material-${thread.thread_id || index}-${materialIndex}`}>
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
                    {thread.suggested_questions.map((question, questionIndex) => (
                      <button
                        key={`question-${thread.thread_id || index}-${questionIndex}`}
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
