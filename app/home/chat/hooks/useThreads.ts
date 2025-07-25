import { createClient } from '@/lib/supabase/client';
import { Thread } from '../types';

const supabase = createClient();

/**
 * Fetch threads for a specific session from the database
 * Uses the threads_view to get joined data with user and assistant messages
 */
export async function fetchThreads(sessionId: string): Promise<Thread[]> {
  try {
    const { data, error } = await supabase
      .from('threads_view')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
      
    if (error) throw new Error(error.message);
    
    // Transform data to match our Thread type
    return data.map((thread: {
      thread_id: string;
      session_id: string;
      user_message_id: string;
      assistant_message_id?: string;
      user_message_role: 'user';
      user_message_content: string;
      assistant_message_role?: 'assistant';
      assistant_message_content?: string;
      sources?: Array<{
        title: string;
        url: string;
        snippet?: string;
      }>;
      related_materials?: Array<{
        id: string;
        material: string;
        description?: string;
        url?: string;
      }>;
      suggested_questions?: string[];
      created_at: string;
    }) => ({
      thread_id: thread.thread_id,
      session_id: thread.session_id,
      user_message_id: thread.user_message_id,
      assistant_message_id: thread.assistant_message_id,
      user_message: {
        id: thread.user_message_id,
        session_id: thread.session_id,
        role: thread.user_message_role,
        content: thread.user_message_content
      },
      assistant_message: thread.assistant_message_id ? {
        id: thread.assistant_message_id,
        session_id: thread.session_id,
        role: 'assistant' as const,
        content: thread.assistant_message_content || ''
      } : null,
      sources: thread.sources || [],
      related_materials: thread.related_materials || [],
      suggested_questions: thread.suggested_questions || [],
      created_at: thread.created_at
    }));
  } catch (err) {
    console.error('Error fetching threads:', err);
    throw err;
  }
}
