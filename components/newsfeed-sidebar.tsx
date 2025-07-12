'use client';

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Newspaper, 
  RefreshCw, 
  ExternalLink 
} from "lucide-react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";

// Types for Next.js integration
export interface NewsItem {
  id: number;
  headline: string;
  snippet: string;
  category: string;
  link: string;
  commentary: string;
  publishedAt: string | Date;
}

export interface NewsFeedSidebarProps {
  apiEndpoint?: string;
  maxHeight?: string;
  className?: string;
  showFooter?: boolean;
  onItemClick?: (item: NewsItem) => void;
}

const getCategoryColor = (category: string) => {
  const colors = {
    Technology: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    Environment: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    Business: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    Breaking: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    Health: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    default: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  };
  return colors[category as keyof typeof colors] || colors.default;
};

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
}

const NewsItemCard = ({ item, onItemClick }: NewsItemCardProps) => (
  <Card className="shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow duration-300">
    <CardContent className="p-4">
      <div className="space-y-3">
        {/* Category Badge and Time */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={getCategoryColor(item.category)}>
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
        
        {/* External Link */}
        <a 
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <span>Read full article</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        
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

// Custom hook for fetching news data (compatible with Next.js)
const useNewsData = (apiEndpoint: string) => {
  return useQuery<NewsItem[]>({
    queryKey: ['news', apiEndpoint],
    queryFn: async () => {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch news data');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });
};

export function NewsFeedSidebar({
  apiEndpoint = '/api/news',
  maxHeight = '600px',
  className = '',
  showFooter = true,
  onItemClick
}: NewsFeedSidebarProps) {
  const { data: newsItems, isLoading, error, refetch } = useNewsData(apiEndpoint);

  const handleRefresh = () => {
    refetch();
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
    <div className={`w-full max-w-sm mx-auto overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 bg-card">
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

      {/* Scrollable Feed Area */}
      <ScrollArea style={{ height: maxHeight }} className="bg-card">
        <div className="p-4 space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <NewsItemSkeleton key={i} />
            ))
          ) : newsItems && newsItems.length > 0 ? (
            newsItems.map((item) => (
              <NewsItemCard 
                key={item.id} 
                item={item} 
                onItemClick={onItemClick}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No news items available
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {showFooter && (
        <div className="p-4 border-t border-border bg-muted/50">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{newsItems?.length || 0} articles</span>
            <Button 
              variant="link" 
              className="text-primary hover:text-primary/80 transition-colors font-medium p-0 h-auto"
            >
              View all news
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Export individual components for more flexibility
export { NewsItemCard, NewsItemSkeleton, getCategoryColor };