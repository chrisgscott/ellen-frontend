'use client';

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatSession } from "./useChatSession";
import { ThreadView } from "./components/ThreadView";
import { SourcesList } from "./components/SourcesList";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const sessionIdFromUrl = searchParams.get('session') || '';
  const [newQuery, setNewQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isUpdatingUrl = useRef(false);

  // Use the chat session hook to manage all session state
  const { 
    session, 
    loading, 
    error, 
    sendUserMessage 
  } = useChatSession({
    initialSessionId: sessionIdFromUrl,
    // projectId can be added here if we have it
  });

  // Handle initial query from URL
  useEffect(() => {
    if (initialQuery && !loading && !session) {
      // Send the query and wait for session creation
      sendUserMessage(initialQuery);
    }
  }, [initialQuery, loading, session, sendUserMessage]);

  // Update URL when session changes
  useEffect(() => {
    if (session?.id) {
      // Always update URL when session changes to ensure clean URL
      isUpdatingUrl.current = true;
      const url = new URL(window.location.href);
      
      // Remove query param and ensure only session ID is present
      url.searchParams.delete('q');
      url.searchParams.set('session', session.id);
      
      window.history.replaceState({}, '', url.toString());
      isUpdatingUrl.current = false;
    }
  }, [session?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.threads]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuery.trim() || loading) return;
    
    await sendUserMessage(newQuery);
    setNewQuery('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {error && (
          <div className="bg-destructive/20 p-4 rounded-md text-destructive">
            {error}
          </div>
        )}
        
        {/* Display threads */}
        {session?.threads && session.threads.length > 0 && (
          <div className="max-w-4xl mx-auto space-y-8">
            {session.threads.map((thread) => (
              <ThreadView 
                key={thread.id} 
                thread={thread} 
                loading={session.isLoading && thread.id === session.threads[session.threads.length - 1].id}
              />
            ))}
          </div>
        )}
        
        {/* Empty state */}
        {!loading && (!session || session.threads.length === 0) && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-medium mb-2">Start a conversation</h2>
              <p className="text-muted-foreground">Ask a question to get started</p>
            </div>
          </div>
        )}

        {/* Sources tab (if any sources exist) */}
        {session?.threads && session.threads.some(thread => thread.sources && thread.sources.length > 0) && (
          <Tabs defaultValue="chat" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="mt-0 p-0">
              {/* Chat content is already shown above */}
            </TabsContent>
            <TabsContent value="sources" className="mt-0 p-0">
              <div className="max-w-4xl mx-auto p-4">
                {/* Combine all sources from all threads */}
                <SourcesList 
                  sources={session.threads.flatMap(thread => thread.sources || [])}
                />
              </div>
            </TabsContent>
          </Tabs>
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
              disabled={loading || session?.isLoading}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <Button 
                type="submit" 
                size="sm" 
                className="h-8 rounded-full"
                disabled={!newQuery.trim() || loading || session?.isLoading}
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
