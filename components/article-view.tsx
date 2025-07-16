import React from 'react';

import { NewsItem } from './newsfeed-sidebar';

import { Button } from '@/components/ui/button';
import ScoreIndicator from './score-indicator';
import { ExternalLink, MessageSquare } from 'lucide-react';

interface ArticleViewProps {
  article: NewsItem | null;
}

export const ArticleView = ({ article }: ArticleViewProps) => {
  if (!article) {
    return (
      <div className="flex-1 p-8 h-full flex flex-col items-center justify-center bg-muted/20">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Select an Article</h2>
          <p className="text-muted-foreground">Choose an item from the news feed to read it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-primary font-semibold mb-2">{article.category}</p>
          <h1 className="text-4xl font-bold text-foreground leading-tight">{article.headline}</h1>
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">{new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={article.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Read Original
                </a>
              </Button>
              <Button variant="default" size="sm">
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask ELLEN
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-lg dark:prose-invert max-w-none mb-12" dangerouslySetInnerHTML={{ __html: article.snippet }} />

        {/* AI Analysis Section */}
        <div className="bg-muted/50 rounded-lg p-6 space-y-6">
                    {(article.estimated_impact || article.confidence_score > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pb-6 border-b border-border">
              {article.estimated_impact && <ScoreIndicator label="Estimated Impact" score={article.estimated_impact} scoreType='categorical' />}
              {article.confidence_score > 0 && <ScoreIndicator label="Confidence Score" score={article.confidence_score} scoreType='numerical' />}
            </div>
          )}
          {article.assessment && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">AI Assessment</h3>
              <p className="text-muted-foreground">{article.assessment}</p>
            </div>
          )}
          {article.implications && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Potential Implications</h3>
              <p className="text-muted-foreground">{article.implications}</p>
            </div>
          )}
          {article.recommended_action && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Recommended Action</h3>
              <p className="text-muted-foreground">{article.recommended_action}</p>
            </div>
          )}
        </div>

        
      </div>
    </div>
  );
};
