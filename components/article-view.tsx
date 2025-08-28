/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

import { NewsItem } from './newsfeed-sidebar';

import { useRouter } from 'next/navigation';
import { createNewSession } from '@/app/(perplexity-layout)/home/chat/hooks/useSessionManagement';
import { Button } from '@/components/ui/button';
import ScoreIndicator from './score-indicator';
import { ExternalLink, MessageSquare, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { RelatedMaterialsCard } from '@/components/related-materials-card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import type { Material } from '@/app/(perplexity-layout)/home/chat/types';

interface ArticleViewProps {
  article: NewsItem | null;
}

export const ArticleView = ({ article }: ArticleViewProps) => {
  const router = useRouter();
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [showMiniHeader, setShowMiniHeader] = React.useState(false);
  const [relatedMaterials, setRelatedMaterials] = React.useState<Material[] | null>(null);
  const [loadingMaterials, setLoadingMaterials] = React.useState(false);

  // Consistent label formatting
  const toTitleCaseLabel = (value?: string | null) => {
    if (!value) return '';
    const cleaned = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  };
  const formatSource = (domain?: string | null) => String(domain || '').toLowerCase();
  const getFaviconUrl = (domain?: string | null) => {
    const d = formatSource(domain);
    if (!d) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=32`;
  };

  const wordCount = React.useMemo(() => {
    if (!article) return 0;
    const text = [article.snippet, article.assessment, article.implications, article.recommended_action]
      .filter(Boolean)
      .join(' ')
      .replace(/<[^>]*>/g, ' ');
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [article]);
  const readingMins = Math.max(1, Math.round(wordCount / 200));

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowMiniHeader(el.scrollTop > 140);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Fetch full related materials metadata for carousel cards
  React.useEffect(() => {
    const loadMaterials = async () => {
      if (!article?.related_materials || article.related_materials.length === 0) {
        setRelatedMaterials(null);
        return;
      }
      try {
        setLoadingMaterials(true);
        const names = article.related_materials.join(',');
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
  }, [article?.related_materials]);

  const handleAskEllen = async () => {
    if (!article) return;

    const prompt = `Let's discuss the following article titled "${article.headline}".\n\nHere is a summary: ${article.snippet}\n\nAI Assessment: ${article.assessment}\nPotential Implications: ${article.implications}\nRecommended Action: ${article.recommended_action}\n\nWhat are the key takeaways and what should I be most concerned about?`;

    try {
      const newSession = await createNewSession(
        article.headline, // title
        null, // projectId
        prompt // initialQuery
      );
      router.push(`/home/chat?session=${newSession.id}`);
    } catch (error) {
      console.error("Failed to create session from article:", error);
      // Optionally, add user-facing error handling here, like a toast notification.
    }
  };

  if (!article) {
    return (
      <div className="flex-1 p-8 h-full flex flex-col items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="mx-auto h-80 w-80">
            <DotLottieReact
              src="https://lottie.host/9720c7b5-6d97-44d9-b050-26ad388dae01/ZKZ7TylpUm.lottie"
              loop
              autoplay
            />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Select an Article</h2>
          <p className="text-muted-foreground">Choose an item from the news feed to read it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Sticky mini header */}
        {showMiniHeader && (
          <div className="sticky top-0 z-30 -mx-8 mb-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
            <div className="px-8 py-2 flex items-center justify-between gap-3">
              <div className="text-sm font-medium line-clamp-1">{article.headline}</div>
              <div className="flex items-center gap-2">
                {article.link && (
                  <Button asChild variant="outline" size="sm">
                    <a href={article.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" /> Read Original
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="mb-8">
          {/* Breadcrumbs */}
          <nav className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Link href="/home/news" className="hover:text-foreground">News</Link>
            <ChevronRight className="w-3 h-3" />
            {article.interest_cluster ? (
              <>
                <Link href={`/home/news?cluster=${encodeURIComponent(article.interest_cluster)}`} className="hover:text-foreground">
                  {toTitleCaseLabel(article.interest_cluster)}
                </Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground/90">Article</span>
              </>
            ) : (
              <span className="text-foreground/90">Article</span>
            )}
          </nav>
          {/* Source + Date pre-heading */}
          <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
            {getFaviconUrl(article.source) && (
              <img src={getFaviconUrl(article.source)} alt="" width={14} height={14} className="rounded-sm" />
            )}
            <span className="lowercase">{formatSource(article.source)}</span>
            <span>•</span>
            <span>{new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground leading-tight">{article.headline}</h1>
          {/* Reading meta */}
          <div className="mt-2 text-xs text-muted-foreground">{readingMins} min read • {wordCount.toLocaleString()} words</div>
          {/* Meta row: chips */}
          <div className="flex items-center mt-4">
            <div className="flex flex-wrap items-center gap-2">
              {article.geographic_focus && (
                <Badge variant="outline">{toTitleCaseLabel(article.geographic_focus)}</Badge>
              )}
              {article.interest_cluster && (
                <Badge variant="outline">{toTitleCaseLabel(article.interest_cluster)}</Badge>
              )}
              {article.type && (
                <Badge variant="outline">{toTitleCaseLabel(article.type)}</Badge>
              )}
            </div>
          </div>

          {/* Actions with source identity */}
          <div className="flex items-center justify-end mt-3 gap-2">
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={article.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Read Original
                </a>
              </Button>
              <Button variant="default" size="sm" onClick={handleAskEllen}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask ELLEN
              </Button>
            </div>
          </div>
        </div>

        {/* Highlighted Summary */}
        <div className="mb-8">
          <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-foreground text-base md:text-lg font-medium">{article.snippet}</p>
          </div>
        </div>

        {/* AI Analysis Section */}
        <div className="bg-muted/50 rounded-lg p-6 space-y-6">
                    {(article.estimated_impact || article.confidence_score > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pb-6 border-b border-border">
              {article.estimated_impact && (
                <ScoreIndicator
                  label="Estimated Impact"
                  score={article.estimated_impact}
                  scoreType='categorical'
                  tooltip={article.estimated_impact}
                />
              )}
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
          {(article.analysis_version || article.analysis_completed_at) && (
            <div className="pt-4 border-t border-border text-xs text-muted-foreground">
              {`Analyzed${article.analysis_version ? ` v${article.analysis_version}` : ''}${article.analysis_completed_at ? ` on ${new Date(article.analysis_completed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}`}
            </div>
          )}
        </div>

        {/* Related Materials */}
        {article.related_materials && article.related_materials.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-foreground mb-3">Related Materials</h3>
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
                    article.related_materials.map((m) => (
                      <CarouselItem key={m} className="basis-auto pr-4">
                        {/* Fallback minimal card if metadata not available */}
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
      </div>
    </div>
  );
};
