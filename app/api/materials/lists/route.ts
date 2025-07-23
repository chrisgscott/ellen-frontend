import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Fetch all lists for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('id');

    let query = supabase
      .from('materials_lists')
      .select(`
        id,
        name,
        description,
        is_global,
        created_at,
        materials_list_items(
          materials(
            id,
            material
          )
        )
      `);

    if (listId) {
      query = query.eq('id', listId);
    } else {
      query = query.order('name');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching lists:', error);
      return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
    }

    if (listId) {
      return NextResponse.json(data[0]);
    } else {
      return NextResponse.json({ lists: data });
    }

  } catch (error) {
    console.error('Error in GET /api/materials/lists:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new custom list
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, isGlobal, materialIds } = body;

    if (!name || !Array.isArray(materialIds)) {
      return NextResponse.json({ error: 'Name and materialIds are required' }, { status: 400 });
    }

    // Create the list
    const { data: listData, error: listError } = await supabase
      .from('materials_lists')
      .insert({
        name,
        description,
        is_global: isGlobal || false,
        created_by: userData.user.id
      })
      .select()
      .single();

    if (listError) {
      console.error('Error creating list:', listError);
      return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
    }

    // Add materials to the list
    if (materialIds.length > 0) {
      const listItems = materialIds.map((materialId: string) => ({
        list_id: listData.id,
        material_id: materialId
      }));

      const { error: itemsError } = await supabase
        .from('materials_list_items')
        .insert(listItems);

      if (itemsError) {
        console.error('Error adding materials to list:', itemsError);
        // Clean up the list if adding materials failed
        await supabase.from('materials_lists').delete().eq('id', listData.id);
        return NextResponse.json({ error: 'Failed to add materials to list' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      id: listData.id, 
      name: listData.name,
      description: listData.description,
      isGlobal: listData.is_global 
    });

  } catch (error) {
    console.error('Error in POST /api/materials/lists:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing list
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, isGlobal, materialIds } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'ID and name are required' }, { status: 400 });
    }

    // Update the list (only if user owns it)
    const { data: listData, error: listError } = await supabase
      .from('materials_lists')
      .update({
        name,
        description,
        is_global: isGlobal,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('created_by', userData.user.id) // Ensure user owns the list
      .select()
      .single();

    if (listError) {
      console.error('Error updating list:', listError);
      return NextResponse.json({ error: 'Failed to update list or list not found' }, { status: 500 });
    }

    // Update materials if provided
    if (Array.isArray(materialIds)) {
      // Remove existing materials
      await supabase
        .from('materials_list_items')
        .delete()
        .eq('list_id', id);

      // Add new materials
      if (materialIds.length > 0) {
        const listItems = materialIds.map((materialId: string) => ({
          list_id: id,
          material_id: materialId
        }));

        const { error: itemsError } = await supabase
          .from('materials_list_items')
          .insert(listItems);

        if (itemsError) {
          console.error('Error updating materials in list:', itemsError);
          return NextResponse.json({ error: 'Failed to update materials in list' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ 
      id: listData.id, 
      name: listData.name,
      description: listData.description,
      isGlobal: listData.is_global 
    });

  } catch (error) {
    console.error('Error in PUT /api/materials/lists:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a list
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'List ID is required' }, { status: 400 });
    }

    // Delete the list (only if user owns it)
    // The CASCADE will automatically delete materials_list_items
    const { error: deleteError } = await supabase
      .from('materials_lists')
      .delete()
      .eq('id', id)
      .eq('created_by', userData.user.id); // Ensure user owns the list

    if (deleteError) {
      console.error('Error deleting list:', deleteError);
      return NextResponse.json({ error: 'Failed to delete list or list not found' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in DELETE /api/materials/lists:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
