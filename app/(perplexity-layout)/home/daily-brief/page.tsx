'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, FileText, Mic, Mail } from 'lucide-react';
import type { DailyBrief } from '@/app/api/daily-brief/route';

export default function DailyBriefArchivePage() {
  const [briefs, setBriefs] = React.useState<DailyBrief[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchBriefs() {
      try {
        setLoading(true);
        const res = await fetch('/api/daily-brief');
        if (!res.ok) {
          throw new Error(`Failed to fetch briefs (${res.status})`);
        }
        const data = await res.json();
        setBriefs(data);
      } catch (e: unknown) {
        setError((e as Error).message || 'Failed to load briefs');
      } finally {
        setLoading(false);
      }
    }
    fetchBriefs();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Daily Brief Archive</h1>
              <p className="text-sm text-muted-foreground">
                {briefs.length} editions • {briefs.length > 0 && (
                  <>
                    {new Date(briefs[briefs.length - 1].date_sent + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' - '}
                    {new Date(briefs[0].date_sent + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Brief Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {briefs.map((brief) => (
              <Link
                key={brief.id}
                href={`/home/daily-brief/${brief.id}`}
                className="group"
              >
                <Card className="h-full hover:border-primary/50 transition-all">
                  <CardContent className="p-4 space-y-3">
                    {/* Date and Audio */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(brief.date_sent + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      {brief.metadata?.has_audio_link && (
                        <Mic className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-3">
                      {brief.top_story_title}
                    </h3>

                    {/* Article Count */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{brief.article_count} articles</span>
                    </div>
                    
                    {/* Materials */}
                    {brief.featured_materials && brief.featured_materials.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {brief.featured_materials.slice(0, 5).map((material) => (
                          <Badge key={material} variant="secondary" className="text-xs px-2 py-0">
                            {material}
                          </Badge>
                        ))}
                        {brief.featured_materials.length > 5 && (
                          <Badge variant="outline" className="text-xs px-2 py-0">
                            +{brief.featured_materials.length - 5}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {briefs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No briefs found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
