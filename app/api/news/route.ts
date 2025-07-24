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

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Fetch news items from rss_feeds table
        const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const source = searchParams.get('source');
    const cluster = searchParams.get('cluster');

    let query = supabase
      .from('rss_feeds')
      .select('*')
      .eq('show', true); // Only show items marked as visible

    if (region) {
      query = query.eq('geographic_focus', region);
    }
    if (source) {
      // Using ilike for case-insensitive matching of source names
      query = query.ilike('source', `%${source}%`);
    }
    if (cluster) {
      query = query.eq('interest_cluster', cluster);
    }

    // Add ordering after applying filters
    query = query.order('created_at', { ascending: false });

    const { data: newsItems, error } = await query;

    if (error) {
      console.error('Error fetching news:', error);
      return NextResponse.json(
        { error: 'Failed to fetch news items' },
        { status: 500 }
      );
    }

    // Transform the data to match the NewsItem interface
    const transformedNews = newsItems?.map(item => ({
      id: item.id,
      headline: cleanHtmlText(item.title) || 'No title',
      snippet: cleanHtmlText(item.snippet) || 'No description available',
      category: 'Strategic Materials',
      link: item.link || '#',
      commentary: item.implications || item.assessment || item.recommended_action || 'No commentary available',
      publishedAt: item.created_at || new Date().toISOString(),
      assessment: item.assessment || '',
      implications: item.implications || '',
      recommended_action: item.recommended_action || '',
      estimated_impact: item.estimated_impact || '',
      confidence_score: item.confidence_score || 0,
    })) || [];

    return NextResponse.json(transformedNews);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
