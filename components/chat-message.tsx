'use client';

import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
  };
  isLoading?: boolean;
}

export function ChatMessage({ message, isLoading = false }: ChatMessageProps) {
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
            <Avatar className="w-8 h-8 bg-primary text-primary-foreground">
              <span className="text-sm">U</span>
            </Avatar>
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
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children, ...props }) => (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
