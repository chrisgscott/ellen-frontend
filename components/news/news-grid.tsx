"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, Newspaper } from "lucide-react";
import type { NewsItem } from "@/components/newsfeed-sidebar";
import { NewsItemCard } from "@/components/newsfeed-sidebar";
import { useRouter } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

// Filter options shape from /api/news/filters
interface FilterOption { value: string; label: string }
interface FilterOptions { regions: FilterOption[]; sources: FilterOption[]; clusters: FilterOption[] }

// Grouping options
type GroupBy = "none" | "cluster" | "region" | "source" | "type";

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
  if (v.includes("massive")) return 4;
  if (
    v.includes("large") ||
    v.includes("high") ||
    v.includes("significant") ||
    v.includes("major") ||
    v.includes("severe")
  ) return 3; // map legacy "high"-like terms to large
  return null; // unrecognized
};

const useNews = (filters: { region: string; cluster: string; source: string; q: string; impactRange: [number, number] }) => {
  const params = new URLSearchParams();
  if (filters.region && filters.region !== "all") params.set("region", filters.region);
  if (filters.cluster && filters.cluster !== "all") params.set("cluster", filters.cluster);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  const endpoint = `/api/news${params.toString() ? `?${params.toString()}` : ""}`;
  return useQuery<NewsItem[]>({
    queryKey: ["news-grid", filters],
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch news");
      const data: NewsItem[] = await res.json();
      // filter by selected impact range (unknowns excluded)
      const includeUnknown = false;
      const ranged = data.filter((n) => {
        const lvl = impactToLevel(n.estimated_impact);
        if (lvl === null) return includeUnknown ? true : false; // include unknowns only when full range
        return lvl >= filters.impactRange[0] && lvl <= filters.impactRange[1];
      });
      // client-side text search filter (headline/snippet)
      if (filters.q.trim()) {
        const ql = filters.q.toLowerCase();
        return ranged.filter(
          (n) => n.headline.toLowerCase().includes(ql) || n.snippet.toLowerCase().includes(ql)
        );
      }
      return ranged;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
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
  const map: Record<string, NewsItem[]> = {};
  for (const it of items) {
    const k =
      key === "cluster" ? (it.interest_cluster || "Other") :
      key === "region" ? (it.geographic_focus || "Other") :
      key === "source" ? (it.source || "Other") :
      key === "type" ? (it.type || "Other") : "All";
    if (!map[k]) map[k] = [];
    map[k].push(it);
  }
  return map;
}

export default function NewsGrid() {
  const { data: filters, isLoading: filtersLoading } = useFilterOptions();
  const [region, setRegion] = React.useState("all");
  const [cluster, setCluster] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [groupBy, setGroupBy] = React.useState<GroupBy>("none");
  const [pageSize, setPageSize] = React.useState(24);
  const router = useRouter();
  const { toast } = useToast();
  // Impact range: 0=minimal, 1=low, 2=moderate, 3=large, 4=massive. Default excludes minimal.
  const [impactRange, setImpactRange] = React.useState<[number, number]>([1, 4]);
  // Submit-by-URL
  const [submitUrl, setSubmitUrl] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const { data, isLoading } = useNews({ region, cluster, source, q, impactRange });

  const grouped = React.useMemo(() => groupByKey(data || [], groupBy), [data, groupBy]);

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
    setSubmitting(true);
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
      setSubmitUrl("");
      toast({ title: 'Link submitted', description: 'Processing may take a few minutes.' });
      // If the workflow completes quickly, attempt refresh
      const data: { message?: string } | null = await res.json().catch(() => null);
      const completed = (data?.message || '').toLowerCase().includes('completed');
      if (completed) {
        // no-op; the grid fetch is on a timer; user can also interact to refresh
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again later.';
      toast({ title: 'Submission failed', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Critical Material News</h1>
            <p className="text-sm text-muted-foreground">Timely developments, risks, and opportunities across strategic materials</p>
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
              <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="Paste article URL…"
                    value={submitUrl}
                    onChange={(e) => setSubmitUrl(e.target.value)}
                    className="flex-1"
                    disabled={submitting}
                  />
                  <Button type="submit" size="sm" disabled={submitting || !submitUrl.trim()} className="shrink-0">
                    {submitting ? 'Submitting…' : 'Submit'}
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
                  <span className="text-xs text-muted-foreground">Cluster</span>
                  <Select value={cluster} onValueChange={setCluster}>
                    <SelectTrigger><SelectValue placeholder="All Clusters" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clusters</SelectItem>
                      {(filters?.clusters || [])
                        .filter((c) => c.value && c.value.trim() !== "")
                        .map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Source</span>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger><SelectValue placeholder="All Sources" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {(filters?.sources || [])
                        .filter((s) => s.value && s.value.trim() !== "")
                        .map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
                        ? [arr[0], arr[0]] as [number, number]
                        : [Math.min(arr[0], arr[1]), Math.max(arr[0], arr[1])] as [number, number];
                      // clamp to [1,4]
                      const lo = Math.max(1, Math.min(4, a[0]));
                      let hi = Math.max(1, Math.min(4, a[1]));
                      // enforce min distance of 1 step to keep two thumbs visible
                      if (hi === lo) hi = Math.min(4, lo + 1);
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
                        <SelectItem value="cluster">By Cluster</SelectItem>
                        <SelectItem value="region">By Region</SelectItem>
                        <SelectItem value="source">By Source</SelectItem>
                        <SelectItem value="type">By Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Page Size</span>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Page Size" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="24">24</SelectItem>
                        <SelectItem value="48">48</SelectItem>
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
                  const visible = items.slice(0, pageSize);
                  return (
                    <section key={group}>
                      {groupBy !== "none" && (
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{group}</h2>
                          <span className="text-xs text-muted-foreground">{items.length} articles</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {visible.map((n) => (
                          <NewsItemCard
                            key={n.id}
                            item={n}
                            onItemClick={(item) => router.push(`/home/news/${encodeURIComponent(item.id)}`)}
                          />
                        ))}
                      </div>
                      {items.length > pageSize && (
                        <div className="flex justify-center mt-4">
                          <Button variant="ghost" size="sm" onClick={() => setPageSize((s) => s + pageSize)}>
                            Load more
                          </Button>
                        </div>
                      )}
                      <Separator className="my-6" />
                    </section>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
