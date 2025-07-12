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

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Fetch news items from rss_feeds table
    const { data: newsItems, error } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('show', true) // Only show items marked as visible
      .order('created_at', { ascending: false })
      .limit(20); // Limit to most recent 20 items

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
      category: 'Strategic Materials', // Default category since column doesn't exist
      link: item.link || '#',
      commentary: item.implications || item.assessment || item.recommended_action || 'No commentary available',
      publishedAt: item.created_at || new Date().toISOString()
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
