import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface DailyBrief {
  id: number;
  created_at: string;
  subject_line: string;
  date_sent: string;
  top_story_title: string;
  article_count: number;
  featured_materials: string[];
  metadata: {
    has_audio_link?: boolean;
    word_count?: number;
    processed_at?: string;
  };
  email_content?: string; // Only included for single item fetch
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Daily Brief API - User:', user?.id, 'Error:', userError);
    
    if (userError || !user) {
      console.log('Daily Brief API - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    
    const id = searchParams.get('id');
    const material = searchParams.get('material');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    
    const limit = limitParam ? Math.max(1, Math.min(100, Number(limitParam))) : 50;
    const offset = offsetParam ? Math.max(0, Number(offsetParam)) : 0;

    // Fetch single brief by ID
    if (id) {
      const { data: brief, error } = await supabase
        .from('daily_critmat_emails')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching brief:', error);
        return NextResponse.json({ error: 'Failed to fetch brief' }, { status: 500 });
      }

      if (!brief) {
        return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
      }

      const transformed: DailyBrief = {
        id: brief.id,
        created_at: brief.created_at,
        subject_line: brief.subject_line || 'The Strategic Materials Brief',
        date_sent: brief.date_sent || brief.created_at.split('T')[0],
        top_story_title: brief.top_story_title || '',
        article_count: brief.article_count || 0,
        featured_materials: brief.featured_materials || [],
        metadata: brief.metadata || {},
        email_content: typeof brief.email_content === 'string' 
          ? brief.email_content 
          : JSON.stringify(brief.email_content),
      };

      return NextResponse.json(transformed);
    }

    // Build query for list view
    let query = supabase
      .from('daily_critmat_emails')
      .select('id, created_at, subject_line, date_sent, top_story_title, article_count, featured_materials, metadata')
      .order('id', { ascending: false });

    // Filter by material if specified
    if (material) {
      query = query.contains('featured_materials', [material]);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: briefs, error } = await query;

    if (error) {
      console.error('Error fetching briefs:', error);
      return NextResponse.json({ error: 'Failed to fetch briefs' }, { status: 500 });
    }

    const transformed: DailyBrief[] = (briefs || []).map(brief => ({
      id: brief.id,
      created_at: brief.created_at,
      subject_line: brief.subject_line || 'The Strategic Materials Brief',
      date_sent: brief.date_sent || brief.created_at.split('T')[0],
      top_story_title: brief.top_story_title || '',
      article_count: brief.article_count || 0,
      featured_materials: brief.featured_materials || [],
      metadata: brief.metadata || {},
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
