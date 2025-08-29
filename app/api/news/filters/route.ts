import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helpers for consistent labeling across UI
const toTitleCaseLabel = (value: string): string => {
  if (!value) return '';
  // Replace underscores with spaces, collapse whitespace, then Title Case
  const cleaned = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
};

// Types for database results
interface RegionRow {
  geographic_focus_new?: string[] | null; // enum[] after Phase A/B
  geographic_focus?: string | null;      // legacy text or JSON array string
}

interface SourceRow {
  source: string;
}

interface TypeRow {
  type: string | null;
}

interface CategoriesRow {
  categories: string[] | null;
}

interface ClusterRow {
  interest_cluster: string | null;
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Get values for each filter column
    const [regionsResult, sourcesResult, categoriesResult, clustersResult, typesResult] = await Promise.all([
      supabase
        .from('rss_feeds')
        .select('geographic_focus_new, geographic_focus')
        .order('created_at', { ascending: false }),
      
      supabase
        .from('rss_feeds')
        .select('source')
        .not('source', 'is', null)
        .order('source'),
      // categories is a text[] column; we'll flatten in Node
      supabase
        .from('rss_feeds')
        .select('categories')
        .not('categories', 'is', null),
      // legacy clusters for back-compat
      supabase
        .from('rss_feeds')
        .select('interest_cluster')
        .not('interest_cluster', 'is', null)
        .order('interest_cluster'),
      // types for new Type filter
      supabase
        .from('rss_feeds')
        .select('type')
        .not('type', 'is', null)
        .order('type')
    ]);

    if (regionsResult.error || sourcesResult.error || categoriesResult.error || clustersResult.error || typesResult.error) {
      console.error('Database error:', regionsResult.error || sourcesResult.error || categoriesResult.error || clustersResult.error || typesResult.error);
      return NextResponse.json({ error: 'Failed to fetch filter options' }, { status: 500 });
    }

    // Extract region enum values only (not per-row combinations)
    const regionSet = new Set<string>();
    for (const row of (regionsResult.data as RegionRow[])) {
      // Prefer new enum[] column
      if (Array.isArray(row.geographic_focus_new) && row.geographic_focus_new.length) {
        for (const v of row.geographic_focus_new) {
          const s = typeof v === 'string' ? v.trim() : '';
          if (s) regionSet.add(s);
        }
        continue;
      }
      // Fallback: legacy text which might be scalar or JSON array as text
      const gf = typeof row.geographic_focus === 'string' ? row.geographic_focus.trim() : '';
      if (!gf) continue;
      if (gf.startsWith('[')) {
        try {
          const arr = JSON.parse(gf);
          if (Array.isArray(arr)) {
            for (const v of arr) {
              if (typeof v === 'string' && v.trim()) regionSet.add(v.trim());
            }
          }
        } catch {
          // ignore malformed JSON
        }
      } else {
        regionSet.add(gf);
      }
    }
    // Canonical order for UI
    const canonicalOrder = ['Africa','Asia-Pacific','Europe','North America','South America','Global','Other'];
    const regions = Array.from(regionSet)
      .map((v) => v.trim())
      .filter(Boolean)
      .sort((a, b) => canonicalOrder.indexOf(a) - canonicalOrder.indexOf(b));
    const sources = [...new Set((sourcesResult.data as SourceRow[]).map((item: SourceRow) => item.source))];
    const types = [...new Set(((typesResult.data as TypeRow[] | null) || [])
      .map((row) => (row.type || '').trim())
      .filter((v) => v !== ''))].sort((a, b) => a.localeCompare(b));
    const categoriesRaw = (categoriesResult.data as CategoriesRow[] | null) || [];
    const categories = [...new Set(
      categoriesRaw
        .flatMap((row) => Array.isArray(row.categories) ? row.categories : [])
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .map((v) => v.trim())
    )].sort((a, b) => a.localeCompare(b));
    const clusters = [...new Set(((clustersResult.data as ClusterRow[] | null) || [])
      .map((row) => (row.interest_cluster || '').trim())
      .filter((v) => v !== ''))];

    // Create display name mappings
    const regionLabels: Record<string, string> = {
      'North America': 'North America',
      'South America': 'South America',
      'Europe': 'Europe', 
      'Asia-Pacific': 'Asia-Pacific',
      'Africa': 'Africa',
      'Global': 'Global',
      'Other': 'Other'
    };

    // Source label: keep URL domain lowercase for consistency
    const getSourceDisplayName = (domain: string): string => String(domain || '').toLowerCase();

    return NextResponse.json({
      regions: regions.map(value => ({
        value,
        label: regionLabels[value as keyof typeof regionLabels] || toTitleCaseLabel(String(value))
      })),
      sources: sources.map(value => ({
        value,
        label: getSourceDisplayName(value as string)
      })),
      categories: categories.map(value => ({
        value,
        label: toTitleCaseLabel(String(value))
      })),
      clusters: clusters.map(value => ({
        value,
        label: toTitleCaseLabel(String(value))
      })),
      types: types.map(value => ({
        value,
        label: toTitleCaseLabel(String(value))
      })),
    });

  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
