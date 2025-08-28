'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArticleView } from '@/components/article-view';
import type { NewsItem } from '@/components/newsfeed-sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NewsDetailPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = React.useState<NewsItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [related, setRelated] = React.useState<NewsItem[]>([]);
  const [relatedLoading, setRelatedLoading] = React.useState(false);

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

  // Load related: prioritize related_materials overlap + recency; fallback to cluster, then geo, then type
  React.useEffect(() => {
    let isMounted = true;
    async function fetchRelated() {
      try {
        setRelatedLoading(true);
        // Fetch a recent slice to evaluate client-side similarity
        const baseParams = new URLSearchParams();
        baseParams.set('limit', '60');
        // If we have a cluster, narrow results to that cluster to reduce noise
        if (item?.interest_cluster) baseParams.set('cluster', item.interest_cluster);
        const res = await fetch(`/api/news?${baseParams.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch related articles');
        const data = (await res.json()) as NewsItem[];
        const pool = (data || []).filter((n) => String(n.id) !== String(item?.id));

        // scoring function
        const targetMaterials = new Set((item?.related_materials || []).map((m) => m.toLowerCase()));
        const score = (n: NewsItem) => {
          let s = 0;
          // material overlap
          if (n.related_materials && n.related_materials.length && targetMaterials.size) {
            const overlap = n.related_materials.filter((m) => targetMaterials.has(String(m).toLowerCase())).length;
            s += overlap * 5;
          }
          // same cluster
          if (item?.interest_cluster && n.interest_cluster === item.interest_cluster) s += 3;
          // same geo
          if (item?.geographic_focus && n.geographic_focus === item.geographic_focus) s += 2;
          // same type
          if (item?.type && n.type === item.type) s += 1;
          // recency boost (newer higher)
          const ts = n.publishedAt ? new Date(n.publishedAt).getTime() : 0;
          s += Math.min(3, Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24) < 7 ? 3 : (Date.now() - ts) / (1000 * 60 * 60 * 24) < 30 ? 2 : 1));
          return s;
        };

        const ranked = pool
          .map((n) => ({ n, s: score(n) }))
          .sort((a, b) => b.s - a.s || new Date(b.n.publishedAt).getTime() - new Date(a.n.publishedAt).getTime())
          .map(({ n }) => n)
          .slice(0, 6);

        const filtered = ranked;
        if (isMounted) setRelated(filtered);
      } catch {
        if (isMounted) setRelated([]);
      } finally {
        if (isMounted) setRelatedLoading(false);
      }
    }
    fetchRelated();
    return () => { isMounted = false; };
  }, [item?.interest_cluster, item?.geographic_focus, item?.type, item?.related_materials, item?.id]);

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

  return (
    <div className="flex-1 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumbs / Back */}
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="px-2">
            <Link href="/home/news">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to feed
            </Link>
          </Button>
        </div>

        {/* Article */}
        <ArticleView article={item} />

        {/* Related Articles */}
        <div className="max-w-4xl mx-auto mt-10">
          <div>
            <h2 className="text-lg font-semibold mb-3">Related articles</h2>
            {relatedLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : related.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/home/news/${encodeURIComponent(String(r.id))}`}
                    className="group block rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="text-sm font-medium group-hover:text-primary line-clamp-2">{r.headline}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      {r.source && <span>{String(r.source).toLowerCase()}</span>}
                      <span>•</span>
                      <span>{new Date(r.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No related articles yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
