'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Send, ExternalLink } from 'lucide-react';

// Initialize Supabase client
const supabase = createClient();

// Function to get authentication headers
const getAuthHeaders = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  const token = data.session?.access_token;
  return {
    Authorization: `Bearer ${token}`,
  };
};

// Endpoint for new in-house streaming chat API
const API_URL = '/api/chat';

// Friendly loading messages to show while waiting for the webhook
const LOADING_MESSAGES = [
  'Analyzing material supply chains…',
  'Cross-checking vector store sources…',
  'Consulting criticality indices…',
  'Running strategic risk model…',
];

interface Material {
  material: string;
  supply_score: number;
  ownership_score: number;
  material_card_color?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  related_materials?: Material[];
  suggested_questions?: string[];
}

interface ChatSession {
  id: string;
  messages: Message[];
  sources: Source[];
  isLoading: boolean;
}

interface SSEPayload {
  type: 'token' | 'materials' | 'sources' | 'suggestions';
  content: string | Material[] | Source[] | string[];
}

interface Source {
  id: string;
  title: string;
  content: string;
  url?: string;
}

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
  };
  isLoading?: boolean;
}

function ChatMessage({ message, isLoading = false }: ChatMessageProps) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-3 max-w-3xl ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {message.role === 'assistant' ? (
            <div className="w-8 h-8 rounded-sm overflow-hidden">
              <Image src="/images/ellen-logo.svg" width={32} height={32} alt="ELLEN" />
            </div>
          ) : (
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
              <span className="text-sm">U</span>
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
          {isLoading && !message.content.trim() ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <p className="text-xs italic text-muted-foreground">
                Analyzing material supply chains…
              </p>
            </div>
          ) : (
            <div className={`prose prose-sm max-w-none ${message.role === 'assistant' ? 'prose-headings:mt-4 prose-headings:mb-2' : ''}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {isLoading && (
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Source {
  id: string;
  title: string;
  content: string;
  url?: string;
}

interface SourcesListProps {
  sources: Source[];
}

function SourcesList({ sources }: SourcesListProps) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No sources available for this response
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Sources</h2>
      <p className="text-sm text-muted-foreground">
        ELLEN used the following sources to generate this response:
      </p>
      
      <div className="space-y-3">
        {sources.map((source) => (
          <Card key={source.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-medium text-foreground">{source.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{source.content}</p>
                </div>
                {source.url && (
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


export default function ChatPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const sessionIdFromUrl = searchParams.get('session') || '';
  const [session, setSession] = useState<ChatSession | null>(null);
  const [newQuery, setNewQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session]);

  // Track if we're updating the URL ourselves to prevent duplicate session creation
  const isUpdatingUrl = useRef(false);

  // Initialize session - either from URL or create new one
  useEffect(() => {
    // Skip effect if we're the ones updating the URL
    if (isUpdatingUrl.current) {
      isUpdatingUrl.current = false;
      return;
    }

    if (initialQuery && !session) {
      createNewSession(initialQuery);
    } else if (sessionIdFromUrl && !session) {
      loadExistingSession(sessionIdFromUrl);
    }
  }, [initialQuery, sessionIdFromUrl, session]);

  // Load existing session from database
  const loadExistingSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/${sessionId}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Session not found, showing empty state');
          return;
        }
        throw new Error(`Failed to load session: ${response.status}`);
      }
      
      const sessionData: ChatSession = await response.json();
      setSession(sessionData);
      
      console.log('Loaded session:', sessionData);
    } catch (error) {
      console.error('Error loading session:', error);
      // Show empty state on error
      setSession(null);
    }
  };

  // Create new session with initial query
  const createNewSession = (queryText: string) => {
    const sessionId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    
    const newSession: ChatSession = {
      id: sessionId,
      messages: [
        { role: 'user', content: queryText },
        {
          role: 'assistant',
          content: LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)],
        },
      ],
      sources: [],
      isLoading: true
    };
    
    setSession(newSession);
    
    // Set flag to prevent duplicate session creation from URL change
    isUpdatingUrl.current = true;
    
    // Update URL to include session ID
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    url.searchParams.delete('q'); // Remove query param since we're now using session
    window.history.replaceState({}, '', url.toString());

    
    // Call in-house chat API (SSE streaming)
    const makeRequest = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        return fetch(API_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({ query: queryText, session_id: sessionId }),
        });
      } catch (error) {
        console.warn('Failed to get auth headers, proceeding without authentication:', error);
        return fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryText, session_id: sessionId }),
        });
      }
    };
    
    makeRequest()
      .then(async (res) => {
        if (!res.ok || !res.body) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        // Stream SSE
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';

        const processBuffer = () => {
          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const rawLine = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!rawLine.startsWith('data:')) continue;
            const jsonStr = rawLine.slice(5).trim();
            if (jsonStr === '[DONE]') {
              setSession((prev) => prev ? { ...prev, isLoading: false } : null);
              continue;
            }
            let payload: SSEPayload;
            try {
              payload = JSON.parse(jsonStr);
            } catch {
              continue;
            }
            if (payload.type === 'token') {
              assistantContent += payload.content as string;
              setSession((prev) => prev ? {
                ...prev,
                messages: prev.messages.map((msg, idx) => 
                  idx === prev.messages.length - 1 && msg.role === 'assistant' 
                    ? { ...msg, content: assistantContent }
                    : msg
                )
              } : null);
            } else if (payload.type === 'materials') {
              console.log('Received materials:', payload.content);
              setSession((prev) => {
                if (!prev) return null;
                const materials = payload.content as Material[];
                const lastMsgIndex = prev.messages.length - 1;
                if (lastMsgIndex < 0) return prev;

                const updatedMessages = [...prev.messages];
                updatedMessages[lastMsgIndex] = {
                  ...updatedMessages[lastMsgIndex],
                  related_materials: materials
                };

                return { ...prev, messages: updatedMessages };
              });
            } else if (payload.type === 'sources') {
              setSession((prev) => prev ? { ...prev, sources: payload.content as Source[] } : null);
            } else if (payload.type === 'suggestions') {
              setSession((prev) => {
                if (!prev) return null;
                const suggestions = payload.content as string[];
                const lastMsgIndex = prev.messages.length - 1;
                if (lastMsgIndex < 0) return prev;

                const updatedMessages = [...prev.messages];
                updatedMessages[lastMsgIndex] = {
                  ...updatedMessages[lastMsgIndex],
                  suggested_questions: suggestions
                };

                return { ...prev, messages: updatedMessages };
              });
            }
          }
        };

        const pump = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            processBuffer();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          processBuffer();
          await pump();
        };
        await pump();
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Chat API fetch error:', err);
        }
        setSession(prev => prev ? { ...prev, isLoading: false } : null);
      });
  };

  // Add message to existing session
  const addMessageToSession = (queryText: string) => {
    if (!session) {
      createNewSession(queryText);
      return;
    }

    // Add user message to current session
    const updatedSession = {
      ...session,
      messages: [
        ...session.messages,
        { role: 'user' as const, content: queryText },
        {
          role: 'assistant' as const,
          content: LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)],
        },
      ],
      isLoading: true
    };
    
    setSession(updatedSession);
    
    // Call API with existing session ID
    const makeFollowUpRequest = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        return fetch(API_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({ query: queryText, session_id: session.id }),
        });
      } catch (error) {
        console.warn('Failed to get auth headers, proceeding without authentication:', error);
        return fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryText, session_id: session.id }),
        });
      }
    };
    
    makeFollowUpRequest()
      .then(async (res) => {
        if (!res.ok || !res.body) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        // Stream SSE
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';

        const processBuffer = () => {
          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const rawLine = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!rawLine.startsWith('data:')) continue;
            const jsonStr = rawLine.slice(5).trim();
            if (jsonStr === '[DONE]') {
              setSession(prev => prev ? { ...prev, isLoading: false } : null);
              continue;
            }
            let payload: SSEPayload;
            try {
              payload = JSON.parse(jsonStr);
            } catch {
              continue;
            }
            if (payload.type === 'token') {
              assistantContent += payload.content;
              setSession(prev => prev ? {
                ...prev,
                messages: prev.messages.map((msg, idx) => 
                  idx === prev.messages.length - 1 && msg.role === 'assistant' 
                    ? { ...msg, content: assistantContent }
                    : msg
                )
              } : null);
            } else if (payload.type === 'materials') {
              console.log('Received materials:', payload.content);
              setSession((prev) => {
                if (!prev) return null;
                const materials = payload.content as Material[];
                const lastMsgIndex = prev.messages.length - 1;
                if (lastMsgIndex < 0) return prev;

                const updatedMessages = [...prev.messages];
                updatedMessages[lastMsgIndex] = {
                  ...updatedMessages[lastMsgIndex],
                  related_materials: materials
                };

                return { ...prev, messages: updatedMessages };
              });
            } else if (payload.type === 'sources') {
              setSession(prev => prev ? { ...prev, sources: payload.content as Source[] } : null);
            } else if (payload.type === 'suggestions') {
              setSession((prev) => {
                if (!prev) return null;
                const suggestions = payload.content as string[];
                const lastMsgIndex = prev.messages.length - 1;
                if (lastMsgIndex < 0) return prev;

                const updatedMessages = [...prev.messages];
                updatedMessages[lastMsgIndex] = {
                  ...updatedMessages[lastMsgIndex],
                  suggested_questions: suggestions
                };

                return { ...prev, messages: updatedMessages };
              });
            }
          }
        };

        const pump = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            processBuffer();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          processBuffer();
          await pump();
        };

        await pump();
      })
      .catch((error) => {
        console.error('Chat API error:', error);
        setSession(prev => prev ? { ...prev, isLoading: false } : null);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuery.trim()) {
      addMessageToSession(newQuery);
      setNewQuery('');
    }
  };

  const handleFollowUp = (question: string) => {
    addMessageToSession(question);
  };



  return (
    <div className="flex flex-col h-screen">
      {/* Main Content - Single Session */}
      <div className="flex-1 overflow-auto pb-24">
        {session && (
          <div className="mb-8">
            {/* Session Content with Tabs */}
            <Tabs defaultValue="answer" className="w-full">
              {/* Sticky Session Header */}
              <header className="sticky top-0 z-10 bg-background p-4">
                {/* Header fade overlay */}
                <div className="absolute -bottom-4 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent pointer-events-none"></div>
                <div className="max-w-4xl mx-auto border-b border-border pb-4">
                  <h1 className="text-2xl font-medium">
                    {session.messages.find(m => m.role === 'user')?.content || 'Chat Session'}
                  </h1>
                  
                  {/* Tabs */}
                  <div className="mt-4">
                    <TabsList>
                      <TabsTrigger value="answer">Answer</TabsTrigger>
                      <TabsTrigger value="sources">Sources</TabsTrigger>
                    </TabsList>
                  </div>
                </div>
              </header>
              <TabsContent value="answer" className="mt-0 p-0">
                <div className="max-w-4xl mx-auto p-4">
                  {/* Chat Messages - Show all messages */}
                  <div className="space-y-6">
                    {session.messages.map((message: Message, index: number) => (
                      <div key={index}>
                        <ChatMessage 
                          message={message} 
                          isLoading={session.isLoading && index === session.messages.length - 1 && message.role === 'assistant'} 
                        />
                        
                        {/* Show related materials for this specific message */}
                        {message.related_materials && message.related_materials.length > 0 && (
                          <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-2">Related Materials</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {message.related_materials.map((material, materialIndex) => (
                                <div key={materialIndex} className="border rounded-lg p-4" style={{ borderColor: material.material_card_color || '#e0e0e0' }}>
                                  <h4 className="font-bold text-md">{material.material}</h4>
                                  <p className="text-sm text-gray-600">Supply Score: {material.supply_score}</p>
                                  <p className="text-sm text-gray-600">Ownership Score: {material.ownership_score}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Show suggested questions for this specific message */}
                        {message.suggested_questions && message.suggested_questions.length > 0 && (
                          <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-2">Suggested Questions</h3>
                            <div className="flex flex-wrap gap-2">
                              {message.suggested_questions.map((question, questionIndex) => (
                                <button
                                  key={questionIndex}
                                  onClick={() => handleFollowUp(question)}
                                  className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                                >
                                  {question}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="sources" className="mt-0 p-0">
                <div className="max-w-4xl mx-auto p-4">
                  <SourcesList sources={session.sources} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
        
        {/* Empty state */}
        {!session && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-medium mb-2">Start a conversation</h2>
              <p className="text-muted-foreground">Ask a question to get started</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Chat Input */}
      <div className="sticky bottom-0 bg-background z-50">
        {/* Fade overlay */}
        <div className="absolute -top-20 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
        <div className="max-w-4xl mx-auto p-4">
          <form onSubmit={handleSubmit} className="relative">
            <Input
              type="text"
              placeholder={session ? "Ask a follow-up question..." : "Ask a question to get started..."}
              className="pl-10 pr-16 py-6 text-base rounded-full border border-input bg-background shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              disabled={session?.isLoading}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <Button 
                type="submit" 
                size="sm" 
                className="h-8 rounded-full"
                disabled={!newQuery.trim() || session?.isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
