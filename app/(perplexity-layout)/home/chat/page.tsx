'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { RelatedMaterialsCard } from '@/components/related-materials-card';
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
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {session?.threads && session.threads.length > 0 ? (
        <>
          {session.threads.map((thread, index) => (
            <div key={thread.thread_id || `thread-${index}`} className="flex flex-col flex-1">
              {/* Sticky Header - User Query */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
                <h2 className="text-2xl font-semibold leading-tight" style={{ color: '#1D638B' }}>
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
                        onClick={() => {
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
          ))}
          
          {/* Floating Input Form */}
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-6 z-20">
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative">
                <Input
                  id="chat-input"
                  type="text"
                  placeholder="Ask a follow-up..."
                  className="pl-10 pr-16 py-6 text-base rounded-full border border-input bg-background shadow-xl"
                  value={newQuery}
                  onChange={(e) => setNewQuery(e.target.value)}
                  disabled={isLoading}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <Button 
                    type="submit" 
                    size="sm" 
                    className="h-8 rounded-full"
                    disabled={!newQuery.trim() || isLoading}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>
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
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative">
                <Input
                  id="chat-input"
                  type="text"
                  placeholder="Ask anything or @mention a Space"
                  className="pl-10 pr-16 py-6 text-base rounded-full border border-input bg-background shadow-xl"
                  value={newQuery}
                  onChange={(e) => setNewQuery(e.target.value)}
                  disabled={isLoading}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <Button 
                    type="submit" 
                    size="sm" 
                    className="h-8 rounded-full"
                    disabled={!newQuery.trim() || isLoading}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
