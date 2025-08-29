import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('rss_feeds')
      .select('estimated_impact')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching impacts:', error);
      return NextResponse.json({ error: 'Failed to fetch impacts' }, { status: 500 });
    }

    const set = new Set<string>();
    for (const row of data || []) {
      const v = typeof row.estimated_impact === 'string' ? row.estimated_impact.trim() : '';
      if (v) set.add(v);
    }

    const values = Array.from(set).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ impacts: values });
  } catch (e) {
    console.error('Unhandled error fetching impacts:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
