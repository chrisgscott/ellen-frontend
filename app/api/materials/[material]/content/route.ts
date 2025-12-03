import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export interface RelatedArticle {
  id: number;
  title: string;
  link: string;
  source: string | null;
  created_at: string;
}

export interface RelatedBrief {
  id: number;
  date_sent: string;
  top_story_title: string;
}

export interface MaterialContentResponse {
  articles: RelatedArticle[];
  briefs: RelatedBrief[];
}

/**
 * GET /api/materials/[material]/content
 * Returns articles and daily briefs that mention the given material
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ material: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { material } = await params;
    const decodedMaterial = decodeURIComponent(material);

    // Fetch articles mentioning this material
    // related_materials is jsonb[], so we use a raw filter with text cast
    const { data: articles, error: articlesError } = await supabase
      .from('rss_feeds')
      .select('id, title, link, source, created_at')
      .filter('related_materials::text', 'ilike', `%${decodedMaterial}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (articlesError) {
      console.error('Error fetching articles:', articlesError);
    }

    // Fetch daily briefs mentioning this material
    // featured_materials is text[], so we use a raw filter with text cast
    const { data: briefs, error: briefsError } = await supabase
      .from('daily_critmat_emails')
      .select('id, date_sent, top_story_title, created_at')
      .filter('featured_materials::text', 'ilike', `%${decodedMaterial}%`)
      .order('id', { ascending: false })
      .limit(20);

    if (briefsError) {
      console.error('Error fetching briefs:', briefsError);
    }

    // Transform briefs to use created_at as fallback for date_sent
    const transformedBriefs: RelatedBrief[] = (briefs || []).map(brief => ({
      id: brief.id,
      date_sent: brief.date_sent || brief.created_at.split('T')[0],
      top_story_title: brief.top_story_title || '',
    }));

    const response: MaterialContentResponse = {
      articles: articles || [],
      briefs: transformedBriefs,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
