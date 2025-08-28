'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ArticleView } from '@/components/article-view';
import type { NewsItem } from '@/components/newsfeed-sidebar';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewsDetailPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = React.useState<NewsItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    async function fetchItem() {
      try {
        setLoading(true);
        const res = await fetch(`/api/news?id=${encodeURIComponent(params.id)}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch article (${res.status})`);
        }
        const data = await res.json();
        if (isMounted) setItem(data as NewsItem);
      } catch (e: unknown) {
        if (isMounted) setError((e as Error).message || 'Failed to load article');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    if (params?.id) fetchItem();
    return () => {
      isMounted = false;
    };
  }, [params?.id]);

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto text-sm text-red-600">{error}</div>
      </div>
    );
  }

  return <ArticleView article={item} />;
}
