import React from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Skeleton } from '@/components/ui/skeleton';
import type { Message } from '../types';

interface MessageViewProps {
  message: Message;
  loading?: boolean;
}

export const MessageView: React.FC<MessageViewProps> = ({ message, loading }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-3 max-w-3xl ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {isUser ? (
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
              <span className="text-sm">U</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-sm overflow-hidden">
              <Image src="/images/ellen-logo.svg" width={32} height={32} alt="ELLEN" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
          {loading && !message.content.trim() ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
};
