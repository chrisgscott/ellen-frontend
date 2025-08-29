'use client';
/* eslint-disable @next/next/no-img-element */

import React from "react";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Newspaper, 
  RefreshCw, 
  EyeOff 
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import ScoreIndicator from "./score-indicator";
import { getCategoryColor } from "@/components/news/category-colors";

// Types for Next.js integration
export interface NewsItem {
  id: number;
  headline: string;
  snippet: string;
  category: string;
  link: string;
  commentary: string;
  publishedAt: string | Date;
  assessment: string;
  implications: string;
  recommended_action: string;
  estimated_impact: string;
  estimated_impact_level?: number | null;
  confidence_score: number;
  // Optional extras from rss_feeds
  source?: string;
  geographic_focus?: string;
  geographic_focus_array?: string[];
  interest_cluster?: string;
  type?: string;
  related_materials?: string[];
  analysis_version?: string | null;
  analysis_completed_at?: string | null;
}

export interface NewsFeedSidebarProps {
  apiEndpoint?: string;
  className?: string;
  showFooter?: boolean;
  onItemClick?: (item: NewsItem) => void;
}


const NewsItemSkeleton = () => (
  <div className="space-y-3 p-4">
    <div className="flex items-center gap-2">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-4 w-20" />
    </div>
    <Skeleton className="h-6 w-full" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-24" />
    <Separator />
    <div className="flex items-start gap-2">
      <Skeleton className="h-6 w-6 rounded-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  </div>
);

interface NewsItemCardProps {
  item: NewsItem;
  onItemClick?: (item: NewsItem) => void;
  onHide?: (itemId: number) => void;
  isHiding?: boolean;
}

// Helpers to format source and favicon URL (aligns with article view behavior)
const formatSource = (domain?: string | null) => String(domain || '').toLowerCase();
const getFaviconUrl = (source?: string, link?: string) => {
  const src = formatSource(source);
  let host = src;
  try {
    if (!host && link) host = new URL(link).hostname.toLowerCase();
  } catch {}
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=16`;
};

const NewsItemCard = ({ item, onItemClick, onHide, isHiding }: NewsItemCardProps) => (
  <Card className="shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow duration-300">
    <CardContent className="p-4">
      <div className="space-y-3">
        {/* Category Badge and Time */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${getCategoryColor(item.category)} border-transparent`}>
            {item.category}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
          </span>
        </div>
        
        {/* Headline */}
        <h3 
          className="text-lg font-semibold text-foreground leading-tight hover:text-primary transition-colors cursor-pointer"
          onClick={() => onItemClick?.(item)}
        >
          {item.headline}
        </h3>
        
        {/* Snippet */}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {item.snippet}
        </p>

        {/* Estimated Impact (compact) */}
        {item.estimated_impact && (
          <div className="mt-1">
            <ScoreIndicator
              label="Impact"
              score={item.estimated_impact}
              scoreType='categorical'
              tooltip={item.estimated_impact}
              className="scale-90 origin-left"
            />
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center justify-between">
          <a 
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            {getFaviconUrl(item.source, item.link) && (
              <img
                src={getFaviconUrl(item.source, item.link) as string}
                alt=""
                width={14}
                height={14}
                className="rounded-sm"
              />
            )}
            <span>Read Original</span>
          </a>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onHide?.(item.id)}
            disabled={isHiding}
            className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            title={isHiding ? "Hiding..." : "Hide this article"}
          >
            <EyeOff className={`w-4 h-4 ${isHiding ? 'animate-pulse' : ''}`} />
          </Button>
        </div>
        
        {/* Commentary Section */}
        <div className="border-t border-border pt-3 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Image src="/images/ellen-logo.svg" width={20} height={20} alt="ELLEN logo" className="rounded-sm" />
            <span className="text-sm font-medium text-muted-foreground">ELLEN&apos;s Take:</span>
          </div>
          <p className="text-xs italic text-muted-foreground">
            {item.commentary}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Types for filter options
interface FilterOption {
  value: string;
  label: string;
}

interface FilterOptions {
  regions: FilterOption[];
  sources: FilterOption[];
  clusters: FilterOption[];
}

// Custom hook for fetching filter options
const useFilterOptions = () => {
  return useQuery<FilterOptions>({
    queryKey: ['news-filters'],
    queryFn: async () => {
      const response = await fetch('/api/news/filters');
      if (!response.ok) {
        throw new Error('Failed to fetch filter options');
      }
      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - filter options don't change often
  });
};

// Custom hook for fetching news data (compatible with Next.js)
const useNewsData = (apiEndpoint: string, filters: { region: string; cluster: string }) => {
  const { region, cluster } = filters;
  
  const queryParams = new URLSearchParams();
  if (region && region !== 'all') queryParams.append('region', region);
  if (cluster && cluster !== 'all') queryParams.append('cluster', cluster);
  
  const finalApiEndpoint = `${apiEndpoint}?${queryParams.toString()}`;

  return useQuery<NewsItem[]>({
    queryKey: ['news', apiEndpoint, filters],
    queryFn: async () => {
      const response = await fetch(finalApiEndpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch news data');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });
};

export const NewsFeedSidebar = ({
  apiEndpoint = '/api/news',
  className = '',
  showFooter = true,
  onItemClick
}: NewsFeedSidebarProps) => {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Initialize from URL so the UI reflects the query immediately on first paint
  const [region, setRegion] = React.useState<string>(() => {
    const r = searchParams.get('region');
    return r ? decodeURIComponent(r).replace(/\+/g, ' ') : 'all';
  });
  const [cluster, setCluster] = React.useState<string>(() => {
    const c = searchParams.get('cluster');
    return c ? decodeURIComponent(c).replace(/\+/g, ' ') : 'all';
  });
  const { data: newsItems, isLoading, error, refetch } = useNewsData(apiEndpoint, { region, cluster });
  const { data: filterOptions, isLoading: filtersLoading } = useFilterOptions();
  const [hidingItems, setHidingItems] = React.useState<Set<number>>(new Set());
  const [submitUrl, setSubmitUrl] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  // Initialize filters from URL on mount and when URL changes (e.g., clicking chips)
  React.useEffect(() => {
    const rawRegion = searchParams.get('region');
    const rawCluster = searchParams.get('cluster');
    const urlRegion = (rawRegion ? decodeURIComponent(rawRegion).replace(/\+/g, ' ') : 'all').toString();
    const urlCluster = (rawCluster ? decodeURIComponent(rawCluster).replace(/\+/g, ' ') : 'all').toString();
    if (urlRegion !== region) setRegion(urlRegion);
    if (urlCluster !== cluster) setCluster(urlCluster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Helper to update URL without scrolling
  const updateUrl = React.useCallback((nextRegion: string, nextCluster: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (nextRegion && nextRegion !== 'all') params.set('region', nextRegion); else params.delete('region');
    if (nextCluster && nextCluster !== 'all') params.set('cluster', nextCluster); else params.delete('cluster');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleRegionChange = (value: string) => {
    setRegion(value);
    updateUrl(value, cluster);
  };

  const handleClusterChange = (value: string) => {
    setCluster(value);
    updateUrl(region, value);
  };

  // Compute friendly labels for placeholders to reflect current selection immediately
  const regionDisplay = React.useMemo(() => {
    if (region === 'all') return 'All Regions';
    return region;
  }, [region]);
  const clusterDisplay = React.useMemo(() => {
    if (cluster === 'all') return 'All Clusters';
    // Title-case cluster value for display
    return cluster.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }, [cluster]);

  // Hide items with estimated impact marked as 'minimal'
  const visibleNewsItems = React.useMemo(
    () => (newsItems ?? []).filter((item) => !(item.estimated_impact && item.estimated_impact.toLowerCase() === 'minimal')),
    [newsItems]
  );

  const handleHideItem = async (itemId: number) => {
    // Prevent multiple clicks
    if (hidingItems.has(itemId)) {
      return;
    }

    setHidingItems(prev => new Set(prev).add(itemId));

    try {
      const response = await fetch(`/api/news/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ show: false }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to hide item');
      }

      // Invalidate and refetch the news data
      await queryClient.invalidateQueries({ queryKey: ['news', apiEndpoint] });
      await refetch();
    } catch (error) {
      console.error('Error hiding news item:', error);
      // You could add a toast notification here if you have one set up
    } finally {
      setHidingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  const isValidHttpUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = submitUrl.trim();
    if (!trimmed || !isValidHttpUrl(trimmed)) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid http(s) URL.',
        variant: 'destructive',
      });
      return;
    }
    // Immediate acknowledgment and clear input
    toast({ title: 'Submission received', description: 'Working on it now. This can take a few minutes.' });
    setSubmitUrl('');
    // Focus the input so the user can paste another URL right away
    setTimeout(() => inputRef.current?.focus(), 0);
    try {
      const res = await fetch('/api/news/submit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const data: { error?: string } | null = await res.json().catch(() => null);
        throw new Error(data?.error || 'Submission failed');
      }
      // Start background polling for completion

      // Non-blocking background check: if API indicates immediate completion, refresh; else poll
      (async () => {
        const data: { ok?: boolean; status?: number; message?: string } | null = await res.json().catch(() => null);
        const immediate = (data?.message || '').toLowerCase().includes('completed');
        if (immediate) {
          await refetch();
          toast({ title: 'Analysis complete', description: 'Feed refreshed.' });
          return;
        }
        // Poll for up to ~2 minutes to detect completion by URL appearance with analysis
        const maxAttempts = 24; // 24 * 5s = 120s
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const { data: refreshed } = await refetch();
          const found = (refreshed || []).some(n => {
            const link = (n.link || '').trim();
            const hasAnalysis = Boolean(n.snippet || n.assessment || n.estimated_impact);
            return link === trimmed && hasAnalysis;
          });
          if (found) {
            toast({ title: 'Analysis complete', description: 'Your article is now in the feed.' });
            break;
          }
        }
      })();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again later.';
      toast({
        title: 'Submission failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  if (error) {
    return (
      <Card className={`w-full max-w-sm mx-auto ${className}`}>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <p className="text-destructive">Failed to load news</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-6 bg-card shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">News Feed</h1>
              <p className="text-sm text-muted-foreground">Latest updates</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-8 h-8 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-4 border-b border-border bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Select value={region} onValueChange={handleRegionChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={regionDisplay} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {filterOptions?.regions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              {/* Ensure current value appears even if options have not loaded yet */}
              {!filtersLoading && region !== 'all' && !filterOptions?.regions.find(r => r.value === region) && (
                <SelectItem value={region}>{regionDisplay}</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select value={cluster} onValueChange={handleClusterChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={clusterDisplay} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clusters</SelectItem>
              {filterOptions?.clusters.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              {!filtersLoading && cluster !== 'all' && !filterOptions?.clusters.find(c => c.value === cluster) && (
                <SelectItem value={cluster}>{clusterDisplay}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Submit Link */}
      <div className="px-4 py-4 border-b border-border bg-card">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            type="url"
            placeholder="Paste article URL…"
            value={submitUrl}
            onChange={(e) => setSubmitUrl(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={!submitUrl.trim()} className="shrink-0">
            Submit
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">Share an article link to include it in the feed.</p>
      </div>

      {/* Scrollable Feed Area */}
      <ScrollArea className="bg-card flex-grow">
        <div className="p-4 space-y-4">
          {isLoading || filtersLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <NewsItemSkeleton key={i} />
            ))
          ) : visibleNewsItems.length > 0 ? (
            visibleNewsItems.map((item) => (
              <NewsItemCard 
                key={item.id} 
                item={item} 
                onItemClick={onItemClick}
                onHide={handleHideItem}
                isHiding={hidingItems.has(item.id)}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {filtersLoading ? 'Loading filters...' : 'No news items available'}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {showFooter && (
        <div className="p-4 border-t border-border bg-muted/50 shrink-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{visibleNewsItems.length} articles</span>
            {pathname !== '/home/news' && (
              <Link href="/home/news" className="text-primary hover:text-primary/80 transition-colors font-medium p-0 h-auto text-sm">
                View all news
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export individual components for more flexibility
export { NewsItemCard, NewsItemSkeleton, getCategoryColor };