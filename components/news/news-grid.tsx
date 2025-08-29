"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, Plus, Newspaper, RefreshCw } from "lucide-react";
import type { NewsItem } from "@/components/newsfeed-sidebar";
import { NewsItemCard } from "@/components/newsfeed-sidebar";
import { useRouter } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

// Filter options shape from /api/news/filters
interface FilterOption { value: string; label: string }
interface FilterOptions { regions: FilterOption[]; sources: FilterOption[]; categories: FilterOption[]; types: FilterOption[] }

// Grouping options (Source/Type hidden; add Impact)
type GroupBy = "none" | "category" | "region" | "impact";

const useFilterOptions = () => {
  return useQuery<FilterOptions>({
    queryKey: ["news-filters"],
    queryFn: async () => {
      const res = await fetch("/api/news/filters");
      if (!res.ok) throw new Error("Failed to fetch filter options");
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
  });
};

// Map impact strings to numeric levels for filtering (with common synonyms)
// 0=minimal, 1=low, 2=moderate, 3=large, 4=massive
const impactToLevel = (value?: string | null): number | null => {
  if (!value) return null; // unknown
  const v = String(value).toLowerCase().trim();
  if (v.includes("minimal") || v === "none") return 0;
  if (v.includes("low") || v.includes("minor")) return 1;
  if (v.includes("moderate") || v.includes("medium")) return 2;
  if (v.includes("massive") || v.includes("very high") || v.includes("extreme") || v.includes("catastrophic")) return 4;
  if (
    v.includes("large") ||
    v.includes("high") ||
    v.includes("significant") ||
    v.includes("major") ||
    v.includes("severe")
  ) return 3; // map legacy "high"-like terms to large
  return null; // unrecognized
};

// Prefer numeric level from API when available
const getImpactLevel = (item: NewsItem): number | null => {
  if (typeof item.estimated_impact_level === 'number') return item.estimated_impact_level;
  return impactToLevel(item.estimated_impact);
};

const useNews = (filters: { region: string; category: string; type: string; q: string; impactRange: [number, number]; groupBy: GroupBy }) => {
  const [allItems, setAllItems] = React.useState<NewsItem[]>([]);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  
  // Initial query uses retry mechanism in queryFn
  
  const query = useQuery<NewsItem[]>({
    queryKey: ["news-grid", filters],
    queryFn: async () => {
      let currentOffset = 0;
      const itemsCollected: NewsItem[] = [];
      const targetCount = 24;
      let attempts = 0;
      const maxAttempts = 3;
      const rangeWidth = filters.impactRange[1] - filters.impactRange[0];
      const isSingleImpact = rangeWidth === 0; // e.g., Massive-only
      
      // Keep fetching until we have enough items or hit max attempts
      while (itemsCollected.length < targetCount && attempts < maxAttempts) {
        const fetchParams = new URLSearchParams();
        if (filters.region && filters.region !== "all") fetchParams.set("region", filters.region);
        if (filters.category && filters.category !== "all") fetchParams.set("category", filters.category);
        if (filters.type && filters.type !== "all") fetchParams.set("type", filters.type);
        if (filters.q && filters.q.trim()) fetchParams.set("q", filters.q.trim());
        // Fetch more items to account for restrictive impact filters (e.g., Massive-only)
        const baseLimit = Math.max(24, targetCount * 2);
        const boostedLimit = (isSingleImpact || filters.groupBy === 'impact') ? 300 : baseLimit; // server caps to 1000
        fetchParams.set("limit", String(boostedLimit));
        fetchParams.set("offset", String(currentOffset));
        const fetchEndpoint = `/api/news${fetchParams.toString() ? `?${fetchParams.toString()}` : ""}`;
        
        const res = await fetch(fetchEndpoint);
        if (!res.ok) throw new Error("Failed to fetch news");
        const data: NewsItem[] = await res.json();
        
        if (data.length === 0) break; // No more items available
        
        // Apply filters
        const includeUnknown = false;
        const ranged = data.filter((n) => {
          const lvl = getImpactLevel(n);
          if (lvl === null) return includeUnknown ? true : false;
          return lvl >= filters.impactRange[0] && lvl <= filters.impactRange[1];
        });
        const byCategory = filters.category && filters.category !== "all"
          ? ranged.filter((n) => n.category === filters.category)
          : ranged;
        
        // Deduplicate against already collected items
        const existingIds = new Set(itemsCollected.map(item => item.id));
        const uniqueNewItems = byCategory.filter(item => !existingIds.has(item.id));
        
        itemsCollected.push(...uniqueNewItems);
        currentOffset += data.length;
        attempts++;
      }
      
      return itemsCollected;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  // Reset items when filters change
  const filterKey = `${filters.region}-${filters.category}-${filters.type}-${filters.q}-${filters.impactRange.join(',')}-${filters.groupBy}`;
  const prevFilterKey = React.useRef(filterKey);
  React.useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      setAllItems([]);
      prevFilterKey.current = filterKey;
    }
  }, [filterKey]);

  // Set initial items when query loads
  React.useEffect(() => {
    if (query.data && allItems.length === 0) {
      setAllItems(query.data);
    }
  }, [query.data, allItems.length]);

  const loadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    
    try {
      let currentOffset = allItems.length;
      const newItemsCollected: NewsItem[] = [];
      const targetCount = 24;
      let attempts = 0;
      const maxAttempts = 3; // Prevent infinite loops
      const rangeWidth = filters.impactRange[1] - filters.impactRange[0];
      const isSingleImpact = rangeWidth === 0;
      
      // Keep fetching until we have enough items or hit max attempts
      while (newItemsCollected.length < targetCount && attempts < maxAttempts) {
        const moreParams = new URLSearchParams();
        if (filters.region && filters.region !== "all") moreParams.set("region", filters.region);
        if (filters.category && filters.category !== "all") moreParams.set("category", filters.category);
        if (filters.type && filters.type !== "all") moreParams.set("type", filters.type);
        if (filters.q && filters.q.trim()) moreParams.set("q", filters.q.trim());
        // Fetch more items to account for restrictive impact filters (e.g., Massive-only)
        const baseLimit = Math.max(24, targetCount * 2);
        const boostedLimit = (isSingleImpact || filters.groupBy === 'impact') ? 300 : baseLimit;
        moreParams.set("limit", String(boostedLimit));
        moreParams.set("offset", String(currentOffset));
        const moreEndpoint = `/api/news${moreParams.toString() ? `?${moreParams.toString()}` : ""}`;
        
        const res = await fetch(moreEndpoint);
        if (!res.ok) throw new Error("Failed to fetch more news");
        const data: NewsItem[] = await res.json();
        
        if (data.length === 0) break; // No more items available
        
        // Apply same filters as initial query
        const includeUnknown = false;
        const ranged = data.filter((n) => {
          const lvl = getImpactLevel(n);
          if (lvl === null) return includeUnknown ? true : false;
          return lvl >= filters.impactRange[0] && lvl <= filters.impactRange[1];
        });
        const byCategory = filters.category && filters.category !== "all"
          ? ranged.filter((n) => n.category === filters.category)
          : ranged;
        
        // Deduplicate against existing items and already collected new items
        const existingIds = new Set([...allItems.map(item => item.id), ...newItemsCollected.map(item => item.id)]);
        const uniqueNewItems = byCategory.filter(item => !existingIds.has(item.id));
        
        newItemsCollected.push(...uniqueNewItems);
        currentOffset += data.length;
        attempts++;
      }
      
      setAllItems(prev => [...prev, ...newItemsCollected]);
    } catch (error) {
      console.error('Error loading more items:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return {
    ...query,
    data: allItems,
    loadMore,
    isLoadingMore,
  };
};

const NewsCardSkeleton = () => (
  <Card>
    <CardContent className="p-4 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </CardContent>
  </Card>
);

function groupByKey(items: NewsItem[], key: GroupBy): Record<string, NewsItem[]> {
  if (key === "none") return { All: items };
  if (key === "impact") {
    const buckets: Record<string, NewsItem[]> = {
      Massive: [],
      Large: [],
      Moderate: [],
      Low: [],
      Unknown: [],
    };
    for (const it of items) {
      const lvl = getImpactLevel(it);
      if (lvl === 4) buckets.Massive.push(it);
      else if (lvl === 3) buckets.Large.push(it);
      else if (lvl === 2) buckets.Moderate.push(it);
      else if (lvl === 1) buckets.Low.push(it);
      else buckets.Unknown.push(it);
    }
    // Hide Unknown unless everything is Unknown
    const totalKnown = buckets.Massive.length + buckets.Large.length + buckets.Moderate.length + buckets.Low.length;
    const order = ["Massive", "Large", "Moderate", "Low"] as const;
    const ordered: Record<string, NewsItem[]> = {};
    for (const label of order) {
      if (buckets[label].length) ordered[label] = buckets[label];
    }
    if (totalKnown === 0 && buckets.Unknown.length) {
      ordered.Unknown = buckets.Unknown;
    }
    return ordered;
  }
  const map: Record<string, NewsItem[]> = {};
  for (const it of items) {
    const k =
      key === "category" ? (it.category || "Other") :
      key === "region" ? (it.geographic_focus || "Other") :
      "All";
    if (!map[k]) map[k] = [];
    map[k].push(it);
  }
  return map;
}

export default function NewsGrid() {
  const { data: filters, isLoading: filtersLoading } = useFilterOptions();
  const [region, setRegion] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [type] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [qDebounced, setQDebounced] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const [groupBy, setGroupBy] = React.useState<GroupBy>("none");
  const router = useRouter();
  const { toast } = useToast();
  // Impact 
  const [impactRange, setImpactRange] = React.useState<[number, number]>([1, 4]);
  // Submit-by-URL
  const [submitUrl, setSubmitUrl] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const queryResult = useNews({ region, category, type, q: qDebounced, impactRange, groupBy });
  const { data, isLoading, refetch, isFetching, dataUpdatedAt, loadMore, isLoadingMore } = queryResult;
  const list: NewsItem[] = React.useMemo(() => (data as NewsItem[] | undefined) ?? [], [data]);
  const [hidingItems, setHidingItems] = React.useState<Set<number>>(new Set());

  const grouped = React.useMemo(() => groupByKey(list, groupBy), [list, groupBy]);

  const handleHideItem = async (itemId: number) => {
    if (hidingItems.has(itemId)) return;
    setHidingItems(prev => new Set(prev).add(itemId));
    try {
      const response = await fetch(`/api/news/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show: false }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to hide item');
      }
      await refetch();
      toast({ title: 'Hidden', description: 'Article removed from the grid.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again later.';
      toast({ title: 'Hide failed', description: message, variant: 'destructive' });
    } finally {
      setHidingItems(prev => {
        const ns = new Set(prev);
        ns.delete(itemId);
        return ns;
      });
    }
  };

  // Utilities for URL submission
  const isValidHttpUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = submitUrl.trim();
    if (!trimmed || !isValidHttpUrl(trimmed)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid http(s) URL.",
        variant: "destructive",
      });
      return;
    }
    // Immediate UI acknowledgment (do not wait for server)
    toast({ title: 'Submission received', description: 'Working on it now. This can take a few minutes.' });
    // Clear the field immediately so users see progress
    setSubmitUrl("");
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
      // Background polling for completion

      (async () => {
        const data: { ok?: boolean; status?: number; message?: string } | null = await res.json().catch(() => null);
        const immediate = (data?.message || '').toLowerCase().includes('completed');
        if (immediate) {
          await refetch();
          toast({ title: 'Analysis complete', description: 'Feed refreshed.' });
          return;
        }
        // Poll for up to ~2 minutes
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
      toast({ title: 'Submission failed', description: message, variant: 'destructive' });
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">Critical Material News</h1>
            <p className="text-sm text-muted-foreground">Timely developments, risks, and opportunities across strategic materials</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Updated {dataUpdatedAt ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
                Math.round((Date.now() - dataUpdatedAt) / -60000), 'minute'
              ) : 'just now'}
            </span>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="flex-1 px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[18rem_1fr] lg:grid-cols-[20rem_1fr] gap-6">
          {/* Left: Sticky filter column */}
          <aside className="md:sticky md:top-20 self-start space-y-4">
            {/* Submit Link */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Add an Article</span>
                </div>
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
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters</span>
                </div>
                <Input
                  placeholder="Search headlines or snippets…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Region</span>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger><SelectValue placeholder="All Regions" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {(filters?.regions || [])
                        .filter((r) => r.value && r.value.trim() !== "")
                        .map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Category</span>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(filters?.categories || [])
                        .filter((c) => c.value && c.value.trim() !== "")
                        .map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Impact</span>
                    <span>
                      {impactRange[0] === 1 ? "Low" : impactRange[0] === 2 ? "Moderate" : impactRange[0] === 3 ? "Large" : "Massive"}
                      {" – "}
                      {impactRange[1] === 1 ? "Low" : impactRange[1] === 2 ? "Moderate" : impactRange[1] === 3 ? "Large" : "Massive"}
                    </span>
                  </div>
                  <Slider
                    aria-label="Impact range"
                    min={1}
                    max={4}
                    step={1}
                    value={impactRange}
                    onValueChange={(v) => {
                      const arr = (v as number[]);
                      const a: [number, number] = arr.length === 1
                        ? [arr[0], arr[0]] as [number, number] // allow single-value selection (e.g., Massive-only)
                        : [Math.min(arr[0], arr[1]), Math.max(arr[0], arr[1])] as [number, number];
                      // clamp to [1,4] but allow lo === hi
                      const lo = Math.max(1, Math.min(4, a[0]));
                      const hi = Math.max(1, Math.min(4, a[1]));
                      setImpactRange([lo as number, hi as number]);
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Low</span>
                    <span>Moderate</span>
                    <span>Large</span>
                    <span>Massive</span>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Group By</span>
                    <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                      <SelectTrigger><SelectValue placeholder="Group By" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Grouping</SelectItem>
                        <SelectItem value="category">By Category</SelectItem>
                        <SelectItem value="region">By Region</SelectItem>
                        <SelectItem value="impact">By Impact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Right: Grid content */}
          <main>
            {isLoading || filtersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <NewsCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(grouped).map(([group, items]) => {
                  // Show all items provided for this group. The overall count is already
                  // constrained by the global `limit` used in the query.
                  const visible = items;
                  return (
                    <section key={group}>
                      {groupBy !== "none" && (
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{group}</h2>
                          <span className="text-xs text-muted-foreground">{items.length} articles</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {visible.map((n: NewsItem) => (
                          <div key={n.id} data-news-id={n.id}>
                            <NewsItemCard
                              item={n}
                              onItemClick={(item) => router.push(`/home/news/${encodeURIComponent(item.id)}`)}
                              onHide={handleHideItem}
                              isHiding={hidingItems.has(n.id)}
                            />
                          </div>
                        ))}
                      </div>
                      <Separator className="my-6" />
                    </section>
                  );
                })}

                {/* Empty state when no results */}
                {Object.keys(grouped).length === 1 && (grouped['All']?.length || 0) === 0 && (
                  <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                    No results{qDebounced ? ` for "${qDebounced}"` : ""}.
                  </div>
                )}

                {/* Global Load more */}
                <div className="flex justify-center mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading..." : "Load more"}
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
