import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { Source } from '../types';

interface SourcesListProps {
  sources: Source[];
}

export const SourcesList: React.FC<SourcesListProps> = ({ sources }) => {
  if (!sources.length) return null;

  return (
    <div className="space-y-4 mt-4">
      <h3 className="text-sm font-medium text-muted-foreground">Sources</h3>
      <ul className="space-y-2">
        {sources.map((src) => (
          <li key={src.id} className="text-sm flex items-start gap-2">
            <ExternalLink size={14} className="mt-1 flex-shrink-0" />
            <a
              href={src.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {src.title || src.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
