import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const listFilter = searchParams.get('list');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('materials')
    .select('id, material, lists')
    .order('material', { ascending: true });

  // Apply list filter if provided
  if (listFilter && listFilter !== 'all') {
    query = query.contains('lists', [listFilter]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching materials:', error);
    return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 });
  }

  return NextResponse.json(data);
}
