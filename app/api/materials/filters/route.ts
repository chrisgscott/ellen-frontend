import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get all lists that the user can see (global lists + their own lists)
    const { data, error } = await supabase
      .from('materials_lists')
      .select('id, name, is_global, created_by')
      .order('name');

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch filter options' }, { status: 500 });
    }

    const lists = data.map(list => ({
      value: list.id,
      label: list.name,
      isGlobal: list.is_global,
      isOwnedByUser: list.created_by === userData.user.id
    }));

    return NextResponse.json({ lists });

  } catch (error) {
    console.error('Error fetching material filter options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
