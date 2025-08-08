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
  geographic_focus: string;
}

interface SourceRow {
  source: string;
}

interface ClusterRow {
  interest_cluster: string;
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Get distinct values for each filter column
    const [regionsResult, sourcesResult, clustersResult] = await Promise.all([
      supabase
        .from('rss_feeds')
        .select('geographic_focus')
        .not('geographic_focus', 'is', null)
        .order('geographic_focus'),
      
      supabase
        .from('rss_feeds')
        .select('source')
        .not('source', 'is', null)
        .order('source'),
      
      supabase
        .from('rss_feeds')
        .select('interest_cluster')
        .not('interest_cluster', 'is', null)
        .order('interest_cluster')
    ]);

    if (regionsResult.error || sourcesResult.error || clustersResult.error) {
      console.error('Database error:', regionsResult.error || sourcesResult.error || clustersResult.error);
      return NextResponse.json({ error: 'Failed to fetch filter options' }, { status: 500 });
    }

    // Extract unique values with proper typing
    const regions = [...new Set((regionsResult.data as RegionRow[]).map((item: RegionRow) => item.geographic_focus))];
    const sources = [...new Set((sourcesResult.data as SourceRow[]).map((item: SourceRow) => item.source))];
    const clusters = [...new Set((clustersResult.data as ClusterRow[]).map((item: ClusterRow) => item.interest_cluster))];

    // Create display name mappings
    const regionLabels: Record<string, string> = {
      'north_america': 'North America',
      'europe': 'Europe', 
      'asia': 'Asia',
      'apac': 'Asia-Pacific',
      'global': 'Global',
      'other': 'Other'
    };

    const clusterLabels: Record<string, string> = {
      'aerospace_defense': 'Aerospace & Defense',
      'renewable_energy': 'Renewable Energy',
      'semiconductors': 'Semiconductors',
      'other': 'Other'
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
      clusters: clusters.map(value => ({
        value,
        label: clusterLabels[value as keyof typeof clusterLabels] || toTitleCaseLabel(String(value))
      }))
    });

  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
