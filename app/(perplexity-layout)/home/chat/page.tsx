'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RelatedMaterialsCard } from '@/components/related-materials-card';
import { Search, Send, ArrowRight, ExternalLink } from 'lucide-react';

interface Material {
  id: number;
  name: string;
  description: string;
}

interface ConversationThread {
  id: string;
  query: string;
  messages: Array<{role: 'user' | 'assistant', content: string}>;
  relatedMaterials: Material[];
  sources: Array<{id: string, title: string, content: string, url?: string}>;
  suggestedQuestions: string[];
  isLoading: boolean;
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
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <div className={`prose prose-sm max-w-none ${message.role === 'assistant' ? 'prose-headings:mt-4 prose-headings:mb-2' : ''}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
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

// Mock data for initial development
const mockRelatedMaterials = [
  { id: 1, name: 'Magnesium', description: 'Lightweight metal with many applications' },
  { id: 2, name: 'Lithium', description: 'Critical for battery technology' },
  { id: 3, name: 'Cobalt', description: 'Used in batteries and superalloys' },
];

const mockSuggestedQuestions = [
  'What is the current market price of lithium?',
  'How might upcoming supply and demand trends affect magnesium prices?',
  'Are there regional differences in magnesium pricing?',
  'What factors are influencing the stability of magnesium prices?',
];

export default function ChatPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [newQuery, setNewQuery] = useState('');


  // Initialize with the query from URL
  useEffect(() => {
    if (initialQuery) {
      createNewThread(initialQuery);
    }
  }, [initialQuery]);

  const createNewThread = (queryText: string) => {
    const threadId = Date.now().toString();
    const newThread: ConversationThread = {
      id: threadId,
      query: queryText,
      messages: [{ role: 'user', content: queryText }],
      relatedMaterials: mockRelatedMaterials,
      sources: [],
      suggestedQuestions: mockSuggestedQuestions,
      isLoading: true
    };
    
    setThreads(prev => [...prev, newThread]);

    
    // Simulate API call
    setTimeout(() => {
      setThreads(prev => prev.map(thread => 
        thread.id === threadId 
          ? {
              ...thread,
              messages: [...thread.messages, {
                role: 'assistant',
                content: `Based on the latest market data for ${queryText}, here's what I found:

Magnesium prices have shown relative stability in Q3 2025, reflecting a 2.60% increase over the past month, though this is still 7.22% lower than a year ago.

**Key points:**

• **China domestic price**: 16,300–16,400 yuan/ton (July 8–11, 2025)
• **FOB China international price**: $2,250–$2,330/ton
• **Recent trend**: Prices have stabilized after a recent uptick, with the market in a wait-and-see mode due to weak supply and demand

If you need magnesium prices in a different region or for a specific product form (such as alloys or high-purity magnesium), please specify.`
              }],
              sources: [
                { 
                  id: '1', 
                  title: 'Global Metals Market Report - July 2025', 
                  content: 'Comprehensive analysis of global metals markets including magnesium pricing data and trends.',
                  url: 'https://example.com/metals-report-2025'
                },
                { 
                  id: '2', 
                  title: 'China Magnesium Market Analysis', 
                  content: 'Detailed breakdown of domestic and export pricing for magnesium products in the Chinese market.',
                  url: 'https://example.com/china-magnesium-2025'
                },
                { 
                  id: '3', 
                  title: 'Magnesium Price Trends Q3 2025', 
                  content: 'Analysis of recent price movements and forecasts for magnesium markets globally.',
                  url: 'https://example.com/mg-trends-q3-2025'
                },
              ],
              isLoading: false
            }
          : thread
      ));
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuery.trim()) {
      createNewThread(newQuery);
      setNewQuery('');
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    createNewThread(question);
  };



  return (
    <div className="flex flex-col h-screen">
      {/* Main Content - Multiple Conversation Threads */}
      <div className="flex-1 overflow-auto pb-24">
        {threads.map((thread) => (
          <div key={thread.id} className="mb-8">
            {/* Sticky Thread Header */}
            <header className="sticky top-0 z-10 bg-background p-4 relative">
              {/* Header fade overlay */}
              <div className="absolute -bottom-4 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent pointer-events-none"></div>
              <div className="max-w-4xl mx-auto border-b border-border pb-4">
                <h1 className="text-2xl font-medium">{thread.query}</h1>
                
                {/* Tabs */}
                <Tabs defaultValue="answer" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="answer">Answer</TabsTrigger>
                    <TabsTrigger value="sources">Sources</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </header>
            
            {/* Thread Content */}
            <Tabs defaultValue="answer" className="w-full">
              <TabsContent value="answer" className="mt-0 p-0">
                <div className="max-w-4xl mx-auto p-4">
                  {/* Related Materials Cards */}
                  {thread.relatedMaterials.length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-sm font-medium text-muted-foreground mb-3">Related Materials</h2>
                      <div className="grid grid-flow-col auto-cols-[240px] gap-4 overflow-x-auto pb-2">
                        {thread.relatedMaterials.map((material) => (
                          <RelatedMaterialsCard key={material.id} material={material} />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Chat Messages - Only show assistant responses */}
                  <div className="space-y-6">
                    {thread.messages
                      .filter(message => message.role === 'assistant')
                      .map((message, index) => (
                        <ChatMessage 
                          key={index} 
                          message={message} 
                          isLoading={thread.isLoading && index === thread.messages.filter(m => m.role === 'assistant').length - 1} 
                        />
                      ))}
                  </div>
                  
                  {/* Suggested Questions */}
                  {!thread.isLoading && 
                   thread.messages.length > 0 && 
                   thread.messages[thread.messages.length - 1].role === 'assistant' && (
                    <div className="mt-8">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Related Questions</h3>
                      <div className="flex flex-wrap gap-2">
                        {thread.suggestedQuestions.map((question, index) => (
                          <Button 
                            key={index} 
                            variant="outline" 
                            size="sm" 
                            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                            onClick={() => handleSuggestedQuestion(question)}
                          >
                            {question}
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="sources" className="mt-0 p-0">
                <div className="max-w-4xl mx-auto p-4">
                  <SourcesList sources={thread.sources} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ))}
        
        {/* Empty state */}
        {threads.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-medium mb-2">Start a conversation</h2>
              <p className="text-muted-foreground">Ask a question to get started</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Chat Input */}
      <div className="sticky bottom-0 bg-background relative z-50">
        {/* Fade overlay */}
        <div className="absolute -top-20 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
        <div className="max-w-4xl mx-auto p-4">
          <form onSubmit={handleSubmit} className="relative">
            <Input
              type="text"
              placeholder="Ask a follow-up question..."
              className="pl-10 pr-16 py-6 text-base rounded-full border border-input bg-background shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              disabled={threads.some(thread => thread.isLoading)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <Button 
                type="submit" 
                size="sm" 
                className="h-8 rounded-full"
                disabled={!newQuery.trim() || threads.some(thread => thread.isLoading)}
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
