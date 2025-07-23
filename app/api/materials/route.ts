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

  let query;
  
  // If filtering by a specific list, join with the materials_list_items table
  if (listFilter && listFilter !== 'all') {
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

  // Transform the data to match the expected format
  const transformedData = data.map(material => {
    let lists: string[] = [];
    
    if (listFilter && listFilter !== 'all') {
      // When filtering by a specific list, we don't need to extract list names
      // since we already know which list they belong to
      lists = [];
    } else {
      // When getting all materials, extract the list names
      lists = material.materials_list_items?.map((item: { materials_lists?: { name: string } }) => item.materials_lists?.name).filter(Boolean) || [];
    }
    
    return {
      id: material.id,
      material: material.material,
      lists
    };
  });

  return NextResponse.json(transformedData);
}
