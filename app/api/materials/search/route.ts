import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let dbQuery = supabase
      .from('materials')
      .select('id, material')
      .order('material', { ascending: true });

    // If there's a search query, filter by material name
    if (query.trim()) {
      dbQuery = dbQuery.ilike('material', `%${query.trim()}%`);
    }

    // Limit results to prevent overwhelming the UI
    dbQuery = dbQuery.limit(50);

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Error searching materials:', error);
      return NextResponse.json({ error: 'Failed to search materials' }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in GET /api/materials/search:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
