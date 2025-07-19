'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { ChatInput } from '@/components/chat-input';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { RelatedMaterialsCard } from '@/components/related-materials-card';
import { useSession } from './hooks/useSession';
import { clearInitialQuery } from './hooks/useSessionManagement';

function ChatPageContent() {
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
  const threadRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const initialQuerySentRef = useRef(false); // Add this ref to track submission
  
  // Document staging state
  const [stagedDocuments, setStagedDocuments] = useState<Array<{name: string; size: number; uploadedAt: Date}>>([]);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  
  const {
    session,
    isLoading,
    error,
    sendMessage
  } = useSession(sessionId || undefined, projectId || undefined);
  
  // Effect to scroll to latest thread when NEW threads are added (not during streaming)
    // Effect to scroll to latest thread when NEW threads are added (not during streaming)
  useEffect(() => {
    if (session?.threads && session.threads.length > 0) {
      const latestThread = session.threads[session.threads.length - 1];
      const threadId = latestThread.thread_id || `thread-${session.threads.length - 1}`;
      
      console.log('🧵 THREAD COUNT CHANGED - Latest thread ID:', threadId);
      console.log('🧵 Total threads:', session.threads.length);
      
      // Only scroll if this is a genuinely new thread (has user message but no/minimal assistant response)
      const isNewThread = latestThread.user_message && (!latestThread.assistant_message || latestThread.assistant_message.content.length < 50);
      
      if (isNewThread) {
        console.log('🎯 NEW THREAD DETECTED - SCROLLING TO:', threadId);
        // Scroll to the latest thread
        setTimeout(() => {
          const threadElement = threadRefs.current[threadId];
          if (threadElement) {
            console.log('🎯 EXECUTING SCROLL TO LATEST THREAD:', threadId);
            threadElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          } else {
            console.log('🔴 Thread element not found for ID:', threadId);
          }
        }, 100); // Small delay to ensure DOM is updated
      } else {
        console.log('🔴 EXISTING THREAD UPDATE - NOT SCROLLING (streaming in progress)');
      }
    }
  }, [session?.threads?.length, session?.threads]); // Only trigger when thread COUNT changes
  
  // Get initial query from session metadata
  const initialQuery = session?.metadata?.initial_query as string | undefined;
  
  // Handle document staging
  const handleDocumentStaged = useCallback((file: File) => {
    console.log('📄 CHAT PAGE: Document staged:', file.name);
    setStagedFiles(prev => [...prev, file]);
    setStagedDocuments(prev => [...prev, {
      name: file.name,
      size: file.size,
      uploadedAt: new Date()
    }]);
  }, []);
  
  // Note: stagedDocuments is passed directly to ChatInput
  
  // Handle initial query from session metadata
  const handleInitialQuery = useCallback(async () => {
    console.log('💬 CHAT PAGE: handleInitialQuery called with:', initialQuery);
    
    // Prevent duplicate submissions from React Strict Mode
    if (initialQuerySentRef.current) {
      console.log('💬 CHAT PAGE: Initial query already sent, skipping.');
      return;
    }
    
    if (!initialQuery || !sessionId) {
      console.log('💬 CHAT PAGE: No initial query in session metadata or no session ID, returning');
      return;
    }
    console.log('💬 CHAT PAGE: Sending initial message from session metadata:', initialQuery);
    try {
      initialQuerySentRef.current = true; // Mark as sent immediately
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
    
    // If we have staged documents and no session yet, we need to upload them first
    if (stagedFiles.length > 0 && !sessionId) {
      console.log('📄 CHAT PAGE: Uploading staged documents before sending message:', stagedFiles.length);
      
      try {
        // Send the message first to create the session
        console.log('💬 CHAT PAGE: Sending message to create session:', newQuery);
        await sendMessage(newQuery);
        
        // Poll for session creation with exponential backoff
        const pollForSession = async (attempts = 0, maxAttempts = 10): Promise<string | null> => {
          // Fetch the session from the server to ensure we have the latest data
          try {
            const response = await fetch('/api/sessions');
            const data = await response.json();
            
            // Find the most recent session
            if (data.sessions && data.sessions.length > 0) {
              // Sort sessions by created_at to get the most recent one
              const sortedSessions = [...data.sessions].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              );
              
              const serverSessionId = sortedSessions[0].id;
              console.log('📄 CHAT PAGE: Found latest session from server API:', serverSessionId);
              
              // Also check URL parameter as backup
              const currentParams = new URLSearchParams(window.location.search);
              const urlSessionId = currentParams.get('session');
              
              console.log('📄 CHAT PAGE: Checking for session (attempt', attempts + 1, ')', {
                serverSessionId,
                urlSessionId,
                currentSessionId: sessionId,
                timestamp: new Date().toISOString()
              });
              
              // Return server-side session ID as most authoritative source
              return serverSessionId;
            }
          } catch (error) {
            console.error('📄 CHAT PAGE: Error fetching sessions from server:', error);
          }
          
          // Fallback to URL parameter
          const currentParams = new URLSearchParams(window.location.search);
          const urlSessionId = currentParams.get('session');
          
          if (urlSessionId) {
            console.log('📄 CHAT PAGE: Using session from URL:', urlSessionId);
            return urlSessionId;
          }
          
          if (attempts >= maxAttempts) {
            console.error('📄 CHAT PAGE: Failed to find session after', maxAttempts, 'attempts');
            return null;
          }
          
          // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
          const delay = Math.min(100 * Math.pow(2, attempts), 2000);
          console.log('📄 CHAT PAGE: Session not found, retrying in', delay, 'ms (attempt', attempts + 1, ')');
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return pollForSession(attempts + 1, maxAttempts);
        };
        
        const currentSessionId = await pollForSession();
        
        if (currentSessionId) {
          console.log('📄 CHAT PAGE: Session created, now uploading documents to session:', currentSessionId);
          
          // Double-verify the session exists in the database before uploading
          try {
            const verifyResponse = await fetch('/api/sessions');
            const verifyData = await verifyResponse.json();
            const sessionExists = verifyData.sessions?.some((s: {id: string}) => s.id === currentSessionId);
            
            if (!sessionExists) {
              console.error('📄 CHAT PAGE: Session not found in database, cannot upload documents:', currentSessionId);
              throw new Error('Session not found in database');              
            }
            
            console.log('📄 CHAT PAGE: Session verified in database:', currentSessionId);
          } catch (error) {
            console.error('📄 CHAT PAGE: Error verifying session:', error);
            // Continue with upload anyway, since session might exist but verification failed
          }
          
          // Upload each staged document to the session
          for (const file of stagedFiles) {
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('sessionId', currentSessionId);
              
              console.log('📄 CHAT PAGE: Uploading document:', {
                filename: file.name,
                fileSize: file.size,
                sessionId: currentSessionId,
                formDataSessionId: formData.get('sessionId'),
                timestamp: new Date().toISOString()
              });
              
              const response = await fetch('/api/chat/upload-document', {
                method: 'POST',
                body: formData,
                headers: {
                  // Add headers to ensure request completes properly
                  'X-Session-ID': currentSessionId
                }
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                console.error('📄 CHAT PAGE: Failed to upload document:', file.name, errorData);
              } else {
                const responseData = await response.json();
                console.log('📄 CHAT PAGE: Successfully uploaded document:', file.name, responseData);
              }
            } catch (error) {
              console.error('📄 CHAT PAGE: Error uploading document:', file.name, error);
            }
          }
          
          // Clear staged documents after upload
          console.log('📄 CHAT PAGE: Clearing staged documents after successful upload');
          setStagedFiles([]);
          setStagedDocuments([]);
        } else {
          console.error('📄 CHAT PAGE: Could not find session ID after message creation');
        }
        
      } catch (error) {
        console.error('📄 CHAT PAGE: Error in document upload flow:', error);
      }
    } else {
      // Normal message sending (no staged documents or session already exists)
      console.log('💬 CHAT PAGE: Sending new message:', newQuery);
      await sendMessage(newQuery);
    }
    
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
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {session?.threads && session.threads.length > 0 ? (
        <>
          {session.threads.map((thread, index) => {
            const threadId = thread.thread_id || `thread-${index}`;
            return (
              <div 
                key={threadId} 
                ref={(el) => { threadRefs.current[threadId] = el; }}
                className="flex flex-col flex-1"
              >
              {/* Sticky Header - User Query */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
                <h2 className="text-2xl font-semibold leading-tight line-clamp-2" style={{ color: '#1D638B' }}>
                  {thread.user_message?.content}
                </h2>
              </div>
              
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
              {/* Assistant Response */}
              {thread.assistant_message && (
                <div className="prose prose-gray max-w-none mb-8 prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-code:text-gray-900 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-50 prose-pre:border prose-table:border-collapse prose-th:border prose-th:border-gray-300 prose-th:bg-gray-50 prose-th:px-4 prose-th:py-2 prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Custom table styling
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-6">
                          <table className="min-w-full border-collapse border border-gray-300 rounded-lg">
                            {children}
                          </table>
                        </div>
                      ),
                      // Custom code block styling
                      pre: ({ children }) => (
                        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                          {children}
                        </pre>
                      ),
                      // Custom inline code styling
                      code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded text-sm font-mono">
                            {children}
                          </code>
                        ) : (
                          <code className={className}>{children}</code>
                        );
                      },
                      // Custom blockquote styling
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 italic text-gray-700">
                          {children}
                        </blockquote>
                      )
                    }}
                  >
                    {thread.assistant_message.content}
                  </ReactMarkdown>
                </div>
              )}
              
              {/* Sources */}
              {thread.sources && thread.sources.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Sources</h4>
                  <ul className="space-y-2">
                    {thread.sources.map((source, index) => (
                      <li key={index}>
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                        >
                          {source.title || source.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Related Materials Carousel */}
              {thread.related_materials && thread.related_materials.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Related Materials</h3>
                  <Carousel className="w-full">
                    <CarouselContent className="-ml-2 md:-ml-4">
                      {thread.related_materials.map((material, index) => (
                        <CarouselItem key={material.id || index} className="pl-2 md:pl-4 basis-auto">
                          <RelatedMaterialsCard material={material} />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {thread.related_materials.length > 1 && (
                      <>
                        <CarouselPrevious className="-left-4" />
                        <CarouselNext className="-right-4" />
                      </>
                    )}
                  </Carousel>
                </div>
              )}
              
              {/* Suggested Questions */}
              {thread.suggested_questions && thread.suggested_questions.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Ask a follow-up</h4>
                  <div className="space-y-2">
                    {thread.suggested_questions.map((question, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          console.log('🔴 FOLLOW-UP CLICKED:', question);
                          e.preventDefault();
                          e.stopPropagation();
                          sendMessage(question);
                        }}
                        className="w-full text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-3 rounded-lg border border-gray-200 transition-colors text-left flex items-center gap-2"
                      >
                        <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: '#1D638B' }} />
                        <span>{question}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
            );
          })}
          
          {/* Floating Input Form */}
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-6 z-20">
            <ChatInput
              value={newQuery}
              onChange={setNewQuery}
              onSubmit={handleSubmit}
              placeholder="Ask a follow-up..."
              disabled={isLoading}
              sessionId={sessionId || undefined}
              onDocumentStaged={handleDocumentStaged}
              stagedDocuments={stagedDocuments}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center justify-center flex-1 text-center text-gray-500 px-6">
            <h2 className="text-xl font-semibold mb-2">Welcome to Ellen Materials Chat</h2>
            <p>Ask a question about materials science and engineering</p>
          </div>
          
          {/* Floating Input Form */}
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-6 z-20">
            <ChatInput
              value={newQuery}
              onChange={setNewQuery}
              onSubmit={handleSubmit}
              placeholder="Ask anything or @mention a Space"
              disabled={isLoading}
              sessionId={sessionId || undefined}
              onDocumentStaged={handleDocumentStaged}
              stagedDocuments={stagedDocuments}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
