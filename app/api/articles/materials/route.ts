import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export interface ArticleMaterials {
  url: string;
  materials: string[];
}

/**
 * GET /api/articles/materials?urls=url1,url2,url3
 * Returns materials associated with each article URL from rss_feeds table
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const urlsParam = searchParams.get('urls');

    if (!urlsParam) {
      return NextResponse.json({ error: 'Missing urls parameter' }, { status: 400 });
    }

    // Parse URLs - they come comma-separated
    const urls = urlsParam.split(',').map(u => u.trim()).filter(Boolean);

    if (urls.length === 0) {
      return NextResponse.json([]);
    }

    // Query rss_feeds for these URLs
    const { data, error } = await supabase
      .from('rss_feeds')
      .select('link, related_materials')
      .in('link', urls);

    if (error) {
      console.error('Error fetching article materials:', error);
      return NextResponse.json({ error: 'Failed to fetch article materials' }, { status: 500 });
    }

    // Transform to a map of url -> materials
    // Handle related_materials which may be jsonb[] - ensure it's a flat string array
    const result: ArticleMaterials[] = (data || []).map(row => {
      let materials: string[] = [];
      if (Array.isArray(row.related_materials)) {
        materials = row.related_materials.flat().filter((m): m is string => typeof m === 'string');
      }
      return {
        url: row.link,
        materials,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
