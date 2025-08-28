import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const listFilter = searchParams.get('list');
  const namesParam = searchParams.get('names'); // comma-separated material names

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query;
  
  // If filtering by a specific list, join with the materials_list_items table
  if (namesParam) {
    // Fetch specific materials by names with detailed fields
    const names = namesParam
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    query = supabase
      .from('materials')
      .select(`
        id,
        material,
        short_summary,
        symbol,
        material_card_color
      `)
      .in('material', names)
      .order('material', { ascending: true });
  } else if (listFilter && listFilter !== 'all') {
    query = supabase
      .from('materials')
      .select(`
        id, 
        material,
        materials_list_items!inner(
          list_id
        )
      `)
      .eq('materials_list_items.list_id', listFilter)
      .order('material', { ascending: true });
  } else {
    // Get all materials with their associated lists
    query = supabase
      .from('materials')
      .select(`
        id, 
        material,
        materials_list_items(
          materials_lists(
            id,
            name
          )
        )
      `)
      .order('material', { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching materials:', error);
    return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 });
  }

  // Transform output depending on query type
  if (namesParam) {
    // Return detailed records directly
    return NextResponse.json(data);
  } else {
    // Return lightweight listing with lists
    type MaterialRow = {
      id: string
      material: string
      materials_list_items?: Array<{ materials_lists?: { name: string } }>
    }
    const transformedData = (data as MaterialRow[]).map((material) => {
      let lists: string[] = [];
      if (listFilter && listFilter !== 'all') {
        lists = [];
      } else {
        lists = (
          material.materials_list_items
            ?.map((item: { materials_lists?: { name: string } }) => item.materials_lists?.name)
            .filter((n): n is string => Boolean(n))
        ) || [];
      }
      return {
        id: material.id,
        material: material.material,
        lists
      };
    });
    return NextResponse.json(transformedData);
  }
}
