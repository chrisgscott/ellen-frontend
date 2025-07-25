import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Sign out the user
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }

  // Redirect to login page after successful sign out
  const origin = process.env.NODE_ENV === 'production' 
    ? 'https://meetellen.co' 
    : request.headers.get('origin') || 'http://localhost:3000';
  
  return NextResponse.redirect(new URL('/auth/login', origin));
}
