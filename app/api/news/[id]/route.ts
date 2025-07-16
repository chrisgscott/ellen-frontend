import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const requestBody = await request.json();
    const { show } = requestBody;
    const { id } = await params;
    
    console.log('PATCH /api/news/[id] - Request data:', { id, show, requestBody });
    
    // Convert string ID to number for database query
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: 'Invalid item ID' },
        { status: 400 }
      );
    }
    
    // First check if the item exists
    const { error: checkError } = await supabase
      .from('rss_feeds')
      .select('id, show')
      .eq('id', itemId)
      .single();

    if (checkError) {
      console.error('Error checking news item:', checkError);
      return NextResponse.json(
        { error: 'News item not found', details: checkError.message },
        { status: 404 }
      );
    }

    // Update the show field for the specific news item
    console.log('Updating item:', { itemId, show });
    const { data, error } = await supabase
      .from('rss_feeds')
      .update({ show })
      .eq('id', itemId)
      .select();

    if (error) {
      console.error('Error updating news item:', error);
      return NextResponse.json(
        { error: 'Failed to update news item', details: error.message },
        { status: 500 }
      );
    }

    console.log('Update result:', { data, error });
    return NextResponse.json({ 
      success: true, 
      data: data?.[0] || null,
      message: `News item ${show ? 'shown' : 'hidden'}` 
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
