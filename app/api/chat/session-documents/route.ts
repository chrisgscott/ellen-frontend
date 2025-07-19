import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic'; // Ensure route is not cached

const sessionDocumentsRequestSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // Validate session ID
    const validationResult = sessionDocumentsRequestSchema.safeParse({ sessionId });
    if (!validationResult.success) {
      console.error('📄 SESSION_DOCS: Invalid session ID provided');
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    console.log('📄 SESSION_DOCS: Fetching documents for session:', sessionId);

    const supabase = await createClient();
    const { data: documents, error } = await supabase
      .from('session_documents')
      .select('id, original_filename, file_size, uploaded_at')
      .eq('session_id', sessionId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('📄 SESSION_DOCS: Error fetching documents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    console.log(`📄 SESSION_DOCS: Found ${documents?.length || 0} documents`);

    return NextResponse.json({
      documents: documents || []
    });

  } catch (error) {
    console.error('📄 SESSION_DOCS: Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
