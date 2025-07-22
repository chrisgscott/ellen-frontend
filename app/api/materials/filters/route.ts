import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get distinct list values using unnest to expand array columns
    const { data, error } = await supabase
      .from('materials')
      .select('lists')
      .not('lists', 'is', null);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch filter options' }, { status: 500 });
    }

    // Extract unique list values from array columns
    const allLists = new Set<string>();
    data.forEach(row => {
      if (row.lists && Array.isArray(row.lists)) {
        row.lists.forEach((list: string) => {
          if (list && list.trim()) {
            allLists.add(list.trim());
          }
        });
      }
    });

    const lists = Array.from(allLists).sort().map(value => ({
      value,
      label: value
    }));

    return NextResponse.json({ lists });

  } catch (error) {
    console.error('Error fetching material filter options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
