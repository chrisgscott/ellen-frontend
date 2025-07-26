import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Use admin client to check auth.users table
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Check if user was invited using admin client
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error listing users:', error);
      return NextResponse.json({ error: 'Failed to check invite status' }, { status: 500 });
    }

    // Find user by email
    const user = data.users.find(u => u.email === email);
    
    if (!user) {
      // User doesn't exist - not invited
      return NextResponse.json({ invited: false });
    }

    // Check if user was invited (has invited_at timestamp)
    const wasInvited = user.invited_at !== null;
    const isConfirmed = user.email_confirmed_at !== null;
    
    return NextResponse.json({ 
      invited: wasInvited,
      confirmed: isConfirmed
    });

  } catch (error) {
    console.error('Error checking invite status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
