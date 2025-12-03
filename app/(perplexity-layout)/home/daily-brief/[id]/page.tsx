'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Mic, ChevronRight, ArrowLeft, ExternalLink, Newspaper } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { RelatedMaterialsCard } from '@/components/related-materials-card';
import type { DailyBrief } from '@/app/api/daily-brief/route';
import type { Material } from '@/app/(perplexity-layout)/home/chat/types';
import {
  type MaterialInfo,
  createMaterialMatcher,
  createMaterialMap,
  processChildrenWithMaterialLinks,
} from '@/lib/utils/link-materials';

export default function DailyBriefDetailPage() {
  const params = useParams<{ id: string }>();
  const [brief, setBrief] = React.useState<DailyBrief | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [relatedMaterials, setRelatedMaterials] = React.useState<Material[] | null>(null);
  const [loadingMaterials, setLoadingMaterials] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [showMiniHeader, setShowMiniHeader] = React.useState(false);
  
  // Material linking state
  const [allMaterials, setAllMaterials] = React.useState<MaterialInfo[]>([]);
  const materialMatcher = React.useMemo(() => createMaterialMatcher(allMaterials), [allMaterials]);
  const materialMap = React.useMemo(() => createMaterialMap(allMaterials), [allMaterials]);

  React.useEffect(() => {
    async function fetchBrief() {
      try {
        setLoading(true);
        const res = await fetch(`/api/daily-brief?id=${encodeURIComponent(params.id)}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch brief (${res.status})`);
        }
        const data = await res.json();
        setBrief(data);
      } catch (e: unknown) {
        setError((e as Error).message || 'Failed to load brief');
      } finally {
        setLoading(false);
      }
    }
    if (params?.id) fetchBrief();
  }, [params?.id]);

  // Fetch related materials metadata
  React.useEffect(() => {
    const loadMaterials = async () => {
      if (!brief?.featured_materials || brief.featured_materials.length === 0) {
        setRelatedMaterials(null);
        return;
      }
      try {
        setLoadingMaterials(true);
        const names = brief.featured_materials.join(',');
        const res = await fetch(`/api/materials?names=${encodeURIComponent(names)}`);
        if (!res.ok) throw new Error(`Failed to load materials: ${res.status}`);
        const data: Material[] = await res.json();
        setRelatedMaterials(data);
      } catch (err) {
        console.error('Error loading related materials', err);
        setRelatedMaterials(null);
      } finally {
        setLoadingMaterials(false);
      }
    };
    loadMaterials();
  }, [brief?.featured_materials]);

  // Fetch all materials for linking
  React.useEffect(() => {
    async function fetchAllMaterials() {
      try {
        const res = await fetch('/api/materials');
        if (!res.ok) return;
        const data = await res.json();
        // Extract just id and material name
        setAllMaterials(data.map((m: { id: string; material: string }) => ({
          id: m.id,
          material: m.material,
        })));
      } catch (err) {
        console.error('Error loading materials for linking:', err);
      }
    }
    fetchAllMaterials();
  }, []);

  // Sticky header on scroll
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowMiniHeader(el.scrollTop > 140);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <Button asChild variant="ghost" size="sm" className="mb-4 px-2">
            <Link href="/home/daily-brief">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to archive
            </Link>
          </Button>
          <div className="text-sm text-red-600">{error || 'Brief not found'}</div>
        </div>
      </div>
    );
  }

  // Extract audio link from content if present
  const audioMatch = brief.email_content?.match(/\[.*Listen to today'?s brief.*\]\((https:\/\/[^)]+)\)/i);
  const audioLink = audioMatch ? audioMatch[1] : null;

  const readingMins = brief?.metadata?.word_count ? Math.max(1, Math.round(brief.metadata.word_count / 200)) : null;
  
  // Format date for header
  const briefDate = new Date(brief.date_sent).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  
  // Convert headline to title case
  const toTitleCase = (str: string) => {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };

  return (
    <div className="flex h-full w-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Sticky mini header */}
        {showMiniHeader && brief && (
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
            <div className="max-w-4xl mx-auto px-8 py-2 flex items-center justify-between gap-3">
              <div className="text-sm font-medium line-clamp-1">{brief.top_story_title}</div>
              <div className="flex items-center gap-2">
                {audioLink && (
                  <Button asChild variant="outline" size="sm">
                    <a href={audioLink} target="_blank" rel="noopener noreferrer">
                      <Mic className="w-3 h-3 mr-1" /> Audio
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="max-w-4xl mx-auto p-8">{/* Content wrapper with padding */}

          {/* Header */}
          <div className="mb-8">
            {/* Breadcrumbs */}
            <nav className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Link href="/home/daily-brief" className="hover:text-foreground">Daily Brief</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground/90">Archive</span>
            </nav>

            {/* Pre-heading */}
            <div className="text-sm text-muted-foreground mb-2">
              Strategic Materials Brief
            </div>

            <h1 className="text-4xl font-bold text-foreground leading-tight">{briefDate}</h1>

            {/* Reading meta */}
            {(readingMins || brief.article_count) && (
              <div className="mt-2 text-xs text-muted-foreground">
                {brief.article_count} articles
                {readingMins && (
                  <>
                    {' • '}
                    {readingMins} min read
                  </>
                )}
                {brief.metadata?.word_count && (
                  <>
                    {' • '}
                    {brief.metadata.word_count.toLocaleString()} words
                  </>
                )}
              </div>
            )}

            {/* Audio Player */}
            {audioLink && (
              <div className="mt-4">
                <Button asChild variant="default" size="lg" className="w-full">
                  <a href={audioLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3">
                    <Mic className="w-6 h-6" />
                    <span className="text-base font-medium">Listen to Audio Brief</span>
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Top Story Highlight */}
          <div className="mb-8">
            <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-start gap-3">
                <Newspaper className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-foreground text-base md:text-lg font-medium">{toTitleCase(brief.top_story_title)}</p>
              </div>
            </div>
          </div>

          {/* Brief Content */}
          <div className="bg-muted/50 rounded-lg p-6 mb-8">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-bold mt-6 mb-3">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {children}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ),
                  p: ({ children }) => (
                    <p className="mb-4 leading-relaxed">
                      {processChildrenWithMaterialLinks(children, materialMatcher, materialMap)}
                    </p>
                  ),
                  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
                  li: ({ children }) => (
                    <li>
                      {processChildrenWithMaterialLinks(children, materialMatcher, materialMap)}
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold">
                      {processChildrenWithMaterialLinks(children, materialMatcher, materialMap)}
                    </strong>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/30 pl-4 italic my-4">
                      {processChildrenWithMaterialLinks(children, materialMatcher, materialMap)}
                    </blockquote>
                  ),
                }}
              >
                {brief.email_content || ''}
              </ReactMarkdown>
            </div>
          </div>

          {/* Related Materials */}
          {brief.featured_materials && brief.featured_materials.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-3">Featured Materials</h3>
              <div className="relative">
                <Carousel opts={{ align: 'start', dragFree: true }}>
                  <CarouselContent>
                    {loadingMaterials && (
                      <CarouselItem className="basis-auto pr-4">
                        <div className="min-w-[240px] max-w-[280px] h-24 rounded-xl border p-4 bg-muted animate-pulse" />
                      </CarouselItem>
                    )}
                    {!loadingMaterials && relatedMaterials && relatedMaterials.length > 0 &&
                      relatedMaterials.map((mat) => (
                        <CarouselItem key={mat.id} className="basis-auto pr-4">
                          <RelatedMaterialsCard material={mat} />
                        </CarouselItem>
                      ))}
                    {!loadingMaterials && (!relatedMaterials || relatedMaterials.length === 0) &&
                      brief.featured_materials.map((m) => (
                        <CarouselItem key={m} className="basis-auto pr-4">
                          <RelatedMaterialsCard material={{ id: m, material: m }} />
                        </CarouselItem>
                      ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel>
              </div>
            </div>
          )}
        </div>{/* End content wrapper */}
      </div>
    </div>
  );
}
