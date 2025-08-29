import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Helper function to decode HTML entities and strip HTML tags
function cleanHtmlText(text: string): string {
  if (!text) return text;
  
  // First decode HTML entities
  const decoded = text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
  
  // Then strip HTML tags
  return decoded.replace(/<[^>]*>/g, '');
}

// Normalize geographic_focus from DB to string[]
// Accepts: enum[], text[], JSON array as text, or scalar string
function parseRegionArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return (input as unknown[])
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v): v is string => Boolean(v));
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    // Try JSON array literal
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed
            .map((v: unknown) => (typeof v === 'string' ? v.trim() : ''))
            .filter((v): v is string => Boolean(v));
        }
      } catch {}
    }
    // Fallback: treat scalar string as single region
    return [s];
  }
  return [];
}

// Title-case a label for display
function toTitleCaseLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// Minimal shape of rss_feeds row fields we use for category derivation
interface RssFeedRowPartial {
  categories?: string[] | null;
  type?: string | null;
  interest_cluster?: string | null;
}

// Extract primary category from DB row
function getPrimaryCategory(item: RssFeedRowPartial): string {
  // categories may be text[]; prefer first non-empty string
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  const firstCategory = categories
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .find((v) => v);
  const raw = firstCategory || (typeof item?.type === 'string' && item.type.trim()) || (typeof item?.interest_cluster === 'string' && item.interest_cluster.trim()) || 'General';
  return toTitleCaseLabel(String(raw));
}

// Normalize related_materials from DB (array, JSON string, or CSV string) to string[]
function parseRelatedMaterials(input: unknown): string[] {
  if (Array.isArray(input)) {
    return (input as unknown[])
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v): v is string => Boolean(v));
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v: unknown) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v): v is string => Boolean(v));
      }
    } catch {}
    return input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Fetch news items from rss_feeds table
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const region = searchParams.get('region');
    const source = searchParams.get('source');
    const type = searchParams.get('type');
    const cluster = searchParams.get('cluster');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const q = searchParams.get('q');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : undefined;
    const offset = offsetParam ? Math.max(0, Number(offsetParam)) : undefined;

    let query = supabase
      .from('rss_feeds')
      .select('*')
      .eq('show', true); // Only show items marked as visible

    // If fetching a single item by id, ignore other filters
    if (id) {
      const { data: item, error } = await query.eq('id', id).maybeSingle();
      if (error) {
        console.error('Error fetching news by id:', error);
        return NextResponse.json({ error: 'Failed to fetch news item' }, { status: 500 });
      }
      if (!item) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const regionsArr = parseRegionArray(item.geographic_focus as unknown);
      interface RssRowWithLevel { estimated_impact_level?: number }
      const lvl = (item as RssRowWithLevel).estimated_impact_level;
      const transformed = {
        id: item.id,
        headline: cleanHtmlText(item.title) || 'No title',
        snippet: cleanHtmlText(item.snippet) || 'No description available',
        category: getPrimaryCategory(item),
        link: item.link || '#',
        commentary: item.implications || item.assessment || item.recommended_action || 'No commentary available',
        publishedAt: item.created_at || new Date().toISOString(),
        assessment: item.assessment || '',
        implications: item.implications || '',
        recommended_action: item.recommended_action || '',
        estimated_impact: item.estimated_impact || '',
        estimated_impact_level: typeof lvl === 'number' ? lvl : null,
        confidence_score: item.confidence_score || 0,
        source: item.source || '',
        geographic_focus: regionsArr[0] || '',
        geographic_focus_array: regionsArr,
        interest_cluster: item.interest_cluster || '',
        type: item.type || '',
        related_materials: parseRelatedMaterials(item.related_materials as unknown),
        analysis_version: item.analysis_version || null,
        analysis_completed_at: item.analysis_completed_at || null,
      };
      return NextResponse.json(transformed);
    }

    if (region) {
      // Prefer new enum[] column introduced in Phase A
      // This avoids applying array contains to legacy text column
      query = query.contains('geographic_focus_new', [region]);
    }
    if (source) {
      // Using ilike for case-insensitive matching of source names
      query = query.ilike('source', `%${source}%`);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (cluster) {
      query = query.eq('interest_cluster', cluster);
    }

    // Server-side text search on title/snippet when q is provided
    if (q && q.trim()) {
      const term = q.trim();
      // Supabase .or() expects filter string
      query = query.or(`title.ilike.%${term}%,snippet.ilike.%${term}%`);
    }

    // Add ordering after applying filters
    query = query.order('created_at', { ascending: false });
    if (limit) {
      query = query.limit(limit);
    }
    if (offset) {
      query = query.range(offset, offset + (limit ? Math.max(0, limit - 1) : 99));
    }

    const { data: newsItems, error } = await query;

    if (error) {
      console.error('Error fetching news:', error);
      return NextResponse.json(
        { error: 'Failed to fetch news items' },
        { status: 500 }
      );
    }

    // Transform the data to match the NewsItem interface
    const transformedNews = newsItems?.map(item => {
      const regionsArr = parseRegionArray(item.geographic_focus as unknown);
      interface RssRowWithLevel { estimated_impact_level?: number }
      const lvl = (item as RssRowWithLevel).estimated_impact_level;
      return ({
        id: item.id,
        headline: cleanHtmlText(item.title) || 'No title',
        snippet: cleanHtmlText(item.snippet) || 'No description available',
        category: getPrimaryCategory(item),
        link: item.link || '#',
        commentary: item.implications || item.assessment || item.recommended_action || 'No commentary available',
        publishedAt: item.created_at || new Date().toISOString(),
        assessment: item.assessment || '',
        implications: item.implications || '',
        recommended_action: item.recommended_action || '',
        estimated_impact: item.estimated_impact || '',
        estimated_impact_level: typeof lvl === 'number' ? lvl : null,
        confidence_score: item.confidence_score || 0,
        // Additional fields from rss_feeds used by ArticleView
        source: item.source || '',
        geographic_focus: regionsArr[0] || '',
        geographic_focus_array: regionsArr,
        interest_cluster: item.interest_cluster || '',
        type: item.type || '',
        related_materials: parseRelatedMaterials(item.related_materials as unknown),
        analysis_version: item.analysis_version || null,
        analysis_completed_at: item.analysis_completed_at || null,
    })}) || [];

    return NextResponse.json(transformedNews);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
