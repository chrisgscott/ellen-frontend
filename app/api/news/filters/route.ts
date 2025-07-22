import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Create source display names (convert domain to friendly name)
    const getSourceDisplayName = (domain: string): string => {
      const domainMappings: Record<string, string> = {
        'bloomberg.com': 'Bloomberg',
        'reuters.com': 'Reuters',
        'fastmarkets.com': 'Fastmarkets',
        'ft.com': 'Financial Times',
        'wsj.com': 'Wall Street Journal',
        'investingnews.com': 'Investing News',
        'investorintel.com': 'Investor Intel',
        'federalregister.gov': 'Federal Register',
        'chicagotribune.com': 'Chicago Tribune',
        'asiafinancial.com': 'Asia Financial',
        'discoveryalert.com.au': 'Discovery Alert',
        'geneonline.com': 'GeneOnline',
        'borncity.com': 'Born City',
        'ainvest.com': 'AI Invest'
      };
      
      return domainMappings[domain] || domain.replace('.com', '').replace('.gov', '').replace('.au', '').split('.')[0].toUpperCase();
    };

    return NextResponse.json({
      regions: regions.map(value => ({
        value,
        label: regionLabels[value as keyof typeof regionLabels] || value
      })),
      sources: sources.map(value => ({
        value,
        label: getSourceDisplayName(value as string)
      })),
      clusters: clusters.map(value => ({
        value,
        label: clusterLabels[value as keyof typeof clusterLabels] || value
      }))
    });

  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
