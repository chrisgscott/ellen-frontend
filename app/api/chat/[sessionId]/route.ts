import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  try {
    // Get session details
    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId);

    if (sessionError || !sessions || sessions.length === 0) {
      console.error('Error fetching session or session not found:', sessionError);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = sessions[0];

    // Get all messages for this session, including all metadata fields
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*, related_materials, suggested_questions, sources')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Error fetching messages' }, { status: 500 });
    }

    // Transform messages to match frontend format
    const formattedMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      related_materials: msg.related_materials || [],
      suggested_questions: msg.suggested_questions || [],
      sources: msg.sources || []
    }));

    // We've moved sources to the message level, but keep session-level sources for backward compatibility
    const sessionLevelSources = session.metadata?.sources || [];

    const sessionData = {
      id: session.id,
      messages: formattedMessages,
      // For backward compatibility, include session-level sources
      sources: sessionLevelSources,
      isLoading: false
    };

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error('Error in session API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
