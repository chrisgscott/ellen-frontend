import React from 'react';
import type { ChatThread } from '../types';
import { MessageView } from './MessageView';
import { SourcesList } from './SourcesList';

interface ThreadViewProps {
  thread: ChatThread;
  loading?: boolean; // when assistantMessage is still streaming
}

export const ThreadView: React.FC<ThreadViewProps> = ({ thread, loading }) => {
  return (
    <div className="space-y-4">
      {thread.userMessage && <MessageView message={thread.userMessage} />}
      {thread.assistantMessage && (
        <MessageView message={thread.assistantMessage} loading={loading} />
      )}
      <SourcesList sources={thread.sources} />
      {/* future: materials list, suggested questions */}
    </div>
  );
};
