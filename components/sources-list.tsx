'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';

interface Source {
  id: string;
  title: string;
  content: string;
  url?: string;
}

interface SourcesListProps {
  sources: Source[];
}

export function SourcesList({ sources }: SourcesListProps) {
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
