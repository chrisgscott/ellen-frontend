'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, Mail, ExternalLink, Calendar } from 'lucide-react';
import type { MaterialContentResponse } from '@/app/api/materials/[material]/content/route';

interface RelatedContentProps {
  materialName: string;
}

export function RelatedContent({ materialName }: RelatedContentProps) {
  const [data, setData] = React.useState<MaterialContentResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchContent() {
      try {
        setLoading(true);
        const res = await fetch(`/api/materials/${encodeURIComponent(materialName)}/content`);
        if (!res.ok) return;
        const content = await res.json();
        setData(content);
      } catch (err) {
        console.error('Error fetching related content:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, [materialName]);

  if (loading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Newspaper className="mr-3 h-6 w-6 text-primary" /> Related News & Briefs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.articles.length === 0 && data.briefs.length === 0)) {
    return null; // Don't show section if no content
  }

  return (
    <Card id="related-content" className="mb-8 scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Newspaper className="mr-3 h-6 w-6 text-primary" /> Related News & Briefs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={data.articles.length > 0 ? 'articles' : 'briefs'}>
          <TabsList className="mb-4">
            <TabsTrigger value="articles" className="gap-2">
              <Newspaper className="h-4 w-4" />
              Articles ({data.articles.length})
            </TabsTrigger>
            <TabsTrigger value="briefs" className="gap-2">
              <Mail className="h-4 w-4" />
              Daily Briefs ({data.briefs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="articles" className="space-y-2">
            {data.articles.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No articles found mentioning this material.</p>
            ) : (
              data.articles.map((article) => (
                <a
                  key={article.id}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {article.source && (
                          <span className="truncate max-w-[200px]">
                            {article.source.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(article.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5" />
                  </div>
                </a>
              ))
            )}
          </TabsContent>

          <TabsContent value="briefs" className="space-y-2">
            {data.briefs.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No daily briefs found featuring this material.</p>
            ) : (
              data.briefs.map((brief) => (
                <Link
                  key={brief.id}
                  href={`/home/daily-brief/${brief.id}`}
                  className="block p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {brief.top_story_title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(brief.date_sent).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </div>
                    </div>
                    <Mail className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5" />
                  </div>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
